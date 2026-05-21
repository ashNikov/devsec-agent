import os
import uuid
import time
from typing import Optional
from tools.slack import send_alert

# ── IN-MEMORY APPROVAL STORE ─────────────────────────────
# Each pending approval lives here until approved/rejected/expired
_pending_approvals: dict = {}

APPROVAL_TIMEOUT_SECONDS = 300  # 5 minutes to approve

def request_approval(action: str, description: str, risk_level: str = "HIGH") -> str:
    """
    Create a pending approval and notify Slack + dashboard.
    Returns approval_id for tracking.
    """
    approval_id = str(uuid.uuid4())[:8].upper()

    _pending_approvals[approval_id] = {
        "id":          approval_id,
        "action":      action,
        "description": description,
        "risk_level":  risk_level,
        "status":      "pending",
        "created_at":  time.time(),
        "resolved_at": None,
        "resolved_by": None,
    }

    # Notify Slack
    send_alert(
        f"⚠️ *Approval Required — {risk_level} Risk Action*\n\n"
        f"*Action:* `{action}`\n"
        f"*Details:* {description}\n"
        f"*Approval ID:* `{approval_id}`\n\n"
        f"Go to AgentSec dashboard to *APPROVE* or *REJECT*\n"
        f"⏱️ Expires in 5 minutes",
        "WARNING"
    )

    return approval_id

def approve(approval_id: str, approved_by: str = "dashboard") -> dict:
    """Approve a pending action."""
    approval = _pending_approvals.get(approval_id)
    if not approval:
        return {"ok": False, "error": "Approval ID not found"}
    if approval["status"] != "pending":
        return {"ok": False, "error": f"Already {approval['status']}"}
    if _is_expired(approval):
        approval["status"] = "expired"
        return {"ok": False, "error": "Approval expired"}

    approval["status"]      = "approved"
    approval["resolved_at"] = time.time()
    approval["resolved_by"] = approved_by

    send_alert(
        f"✅ *Action Approved by {approved_by}*\n"
        f"*Action:* `{approval['action']}`\n"
        f"*ID:* `{approval_id}`",
        "SUCCESS"
    )
    return {"ok": True, "approval": approval}

def reject(approval_id: str, rejected_by: str = "dashboard") -> dict:
    """Reject a pending action."""
    approval = _pending_approvals.get(approval_id)
    if not approval:
        return {"ok": False, "error": "Approval ID not found"}
    if approval["status"] != "pending":
        return {"ok": False, "error": f"Already {approval['status']}"}

    approval["status"]      = "rejected"
    approval["resolved_at"] = time.time()
    approval["resolved_by"] = rejected_by

    send_alert(
        f"🚫 *Action Rejected by {rejected_by}*\n"
        f"*Action:* `{approval['action']}`\n"
        f"*ID:* `{approval_id}`",
        "INFO"
    )
    return {"ok": True, "approval": approval}

def get_pending() -> list:
    """Return all pending non-expired approvals."""
    now = time.time()
    result = []
    for a in _pending_approvals.values():
        if a["status"] == "pending":
            if _is_expired(a):
                a["status"] = "expired"
            else:
                result.append({**a, "expires_in": int(APPROVAL_TIMEOUT_SECONDS - (now - a["created_at"]))})
    return result

def get_all(limit: int = 20) -> list:
    """Return recent approvals — pending + resolved."""
    items = sorted(_pending_approvals.values(), key=lambda x: x["created_at"], reverse=True)
    return list(items)[:limit]

def is_approved(approval_id: str) -> bool:
    """Check if an action has been approved."""
    a = _pending_approvals.get(approval_id)
    return bool(a and a["status"] == "approved")

def _is_expired(approval: dict) -> bool:
    return time.time() - approval["created_at"] > APPROVAL_TIMEOUT_SECONDS
