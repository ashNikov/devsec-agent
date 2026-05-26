from fastapi import APIRouter, Request, HTTPException
from datetime import datetime
import hashlib
import hmac
import json
import time
import httpx
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import SessionLocal, AuditLog
from tools.approval import approve, reject, get_pending

router = APIRouter(prefix="/slack", tags=["slack"])

SLACK_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET")
SLACK_BOT_TOKEN      = os.getenv("SLACK_BOT_TOKEN")
SLACK_WEBHOOK_URL    = os.getenv("SLACK_WEBHOOK_URL")


# ── HELPERS ──────────────────────────────────────────────

def verify_slack_signature(request_body: bytes, timestamp: str, signature: str) -> bool:
    """Verify the request actually came from Slack."""
    if abs(time.time() - int(timestamp)) > 60 * 5:
        return False  # Replay attack protection — reject if older than 5 mins
    sig_basestring = f"v0:{timestamp}:{request_body.decode()}"
    expected = "v0=" + hmac.new(
        SLACK_SIGNING_SECRET.encode(),
        sig_basestring.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def post_to_slack(channel: str, blocks: list, text: str = "AgentSec Alert"):
    """Post a message with interactive blocks to Slack."""
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://slack.com/api/chat.postMessage",
            headers={
                "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
                "Content-Type":  "application/json",
            },
            json={
                "channel": channel,
                "text":    text,
                "blocks":  blocks,
            }
        )


# ── ENDPOINTS ─────────────────────────────────────────────

@router.post("/actions")
async def slack_actions(request: Request):
    """Handle button clicks from Slack interactive messages."""
    # Verify signature
    timestamp = request.headers.get("X-Slack-Request-Timestamp", "")
    signature = request.headers.get("X-Slack-Signature", "")
    body      = await request.body()

    if not verify_slack_signature(body, timestamp, signature):
        raise HTTPException(status_code=400, detail="Invalid Slack signature")

    # Slack sends payload as form data
    form    = await request.form()
    payload = json.loads(form.get("payload", "{}"))

    action_id   = payload.get("actions", [{}])[0].get("action_id", "")
    action_value= payload.get("actions", [{}])[0].get("value", "")
    user_name   = payload.get("user", {}).get("name", "unknown")
    response_url= payload.get("response_url", "")

    # Parse approval_id from action value
    # Format: "approve:APPROVAL_ID" or "reject:APPROVAL_ID"
    parts       = action_value.split(":", 1)
    action_type = parts[0] if len(parts) == 2 else ""
    approval_id = parts[1] if len(parts) == 2 else ""

    db = SessionLocal()
    try:
        if action_type == "approve":
            result = approve(approval_id, approved_by=user_name)
            status_text = f"✅ *Approved* by @{user_name}"
            color       = "#36a64f"
        elif action_type == "reject":
            result = reject(approval_id, rejected_by=user_name)
            status_text = f"❌ *Rejected* by @{user_name}"
            color       = "#ff0000"
        else:
            return {"status": "unknown_action"}

        # Audit log
        db.add(AuditLog(
            action=f"approval.{action_type}",
            resource="slack_button",
            details=f"Approval {approval_id} {action_type}d by {user_name} via Slack",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        # Update the Slack message to show result
        async with httpx.AsyncClient() as client:
            await client.post(response_url, json={
                "replace_original": True,
                "text": status_text,
                "attachments": [{
                    "color": color,
                    "text":  f"Action `{approval_id}` has been *{action_type}d* by @{user_name}"
                }]
            })

        return {"status": "ok"}
    finally:
        db.close()


@router.post("/send-approval")
async def send_approval_request(request: Request):
    """
    Send an approval request to Slack with Approve/Reject buttons.
    Called internally by the approval workflow.
    """
    body        = await request.json()
    approval_id = body.get("approval_id")
    description = body.get("description", "Action requires approval")
    risk_level  = body.get("risk_level", "MEDIUM")
    channel     = body.get("channel", "#devsecops-agent-")

    risk_emoji = "🔴" if risk_level == "HIGH" else "🟡"

    blocks = [
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"{risk_emoji} *AgentSec Approval Required*\n{description}"
            }
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Risk Level:*\n{risk_level}"},
                {"type": "mrkdwn", "text": f"*Approval ID:*\n`{approval_id}`"},
            ]
        },
        {
            "type": "actions",
            "elements": [
                {
                    "type":      "button",
                    "text":      {"type": "plain_text", "text": "✅ Approve"},
                    "style":     "primary",
                    "action_id": "approval_action",
                    "value":     f"approve:{approval_id}",
                },
                {
                    "type":      "button",
                    "text":      {"type": "plain_text", "text": "❌ Reject"},
                    "style":     "danger",
                    "action_id": "approval_action",
                    "value":     f"reject:{approval_id}",
                }
            ]
        }
    ]

    await post_to_slack(channel=channel, blocks=blocks,
                        text=f"⚠️ Approval required: {description}")

    return {"status": "sent", "approval_id": approval_id, "channel": channel}
