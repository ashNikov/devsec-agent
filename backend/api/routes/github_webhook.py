import hashlib
import hmac
import httpx
import logging
import os
import sys

from fastapi import APIRouter, HTTPException, Request

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import SessionLocal, Integration, Organization, OrganizationMember, UserRepo

logger = logging.getLogger("agentsec.github_webhook")

router = APIRouter(prefix="/github", tags=["github"])

GITHUB_WEBHOOK_SECRET = os.getenv("GITHUB_WEBHOOK_SECRET", "")


# ── HELPERS ──────────────────────────────────────────────

def verify_signature(payload: bytes, signature: str) -> bool:
    if not GITHUB_WEBHOOK_SECRET:
        logger.warning("GITHUB_WEBHOOK_SECRET not set — skipping signature check")
        return True
    expected = "sha256=" + hmac.new(
        GITHUB_WEBHOOK_SECRET.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


async def sync_repos_for_org(org_id: int, github_token: str, plan: str):
    """Pull latest repos from GitHub and sync into DB for the given org."""
    MAX_REPOS = 1 if plan == "free" else 999
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/repos?per_page=100&sort=updated&type=owner",
                headers={
                    "Authorization": f"Bearer {github_token}",
                    "Accept": "application/vnd.github.v3+json",
                },
                timeout=10,
            )
        if resp.status_code != 200:
            logger.error(f"GitHub API error for org {org_id}: {resp.status_code}")
            return

        github_repos = {r["full_name"]: r for r in resp.json() if isinstance(r, dict)}

        db = SessionLocal()
        try:
            db_repos     = db.query(UserRepo).filter(UserRepo.org_id == org_id).all()
            db_repo_names = {r.repo_name: r for r in db_repos}
            added = 0

            for name, repo_data in github_repos.items():
                if name in db_repo_names:
                    if not db_repo_names[name].is_active:
                        db_repo_names[name].is_active = True
                        added += 1
                else:
                    active_count = sum(1 for r in db_repos if r.is_active)
                    if active_count >= MAX_REPOS:
                        break
                    db.add(UserRepo(
                        org_id=org_id,
                        repo_name=name,
                        repo_url=repo_data.get("html_url", ""),
                        is_active=True,
                        is_private=repo_data.get("private", False),
                    ))
                    added += 1

            # Deactivate repos no longer on GitHub
            for name, repo in db_repo_names.items():
                if name not in github_repos and repo.is_active:
                    repo.is_active = False

            db.commit()
            logger.info(f"Webhook sync: org {org_id} — {added} repos added/reactivated")
        finally:
            db.close()

    except Exception as e:
        logger.error(f"Webhook sync error for org {org_id}: {e}")


# ── ENDPOINT ─────────────────────────────────────────────

@router.post("/webhook")
async def github_webhook(request: Request):
    """
    Receive GitHub webhook events and trigger repo sync for the affected org.
    Handles: push, repository, member, installation events.
    """
    payload   = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    event     = request.headers.get("x-github-event", "")

    if not verify_signature(payload, signature):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Extract the repo owner's GitHub login from the event
    sender_login = data.get("sender", {}).get("login", "")
    repo_name    = data.get("repository", {}).get("full_name", "")

    logger.info(f"GitHub webhook received: event={event} repo={repo_name} sender={sender_login}")

    if event not in ("push", "repository", "member", "installation", "ping"):
        return {"status": "ignored", "event": event}

    if event == "ping":
        return {"status": "pong"}

    # Find the org by matching GitHub integration token owner
    db = SessionLocal()
    try:
        integrations = db.query(Integration).filter(
            Integration.provider == "github",
            Integration.is_active == True,
        ).all()

        matched_org_id    = None
        matched_token     = None
        matched_plan      = None

        for intg in integrations:
            if not intg.access_token_encrypted:
                continue
            # Verify this token belongs to the sender
            try:
                async with httpx.AsyncClient() as client:
                    r = await client.get(
                        "https://api.github.com/user",
                        headers={
                            "Authorization": f"Bearer {intg.access_token_encrypted}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                        timeout=5,
                    )
                if r.status_code == 200 and r.json().get("login") == sender_login:
                    org = db.query(Organization).filter(
                        Organization.id == intg.org_id
                    ).first()
                    matched_org_id = intg.org_id
                    matched_token  = intg.access_token_encrypted
                    matched_plan   = org.plan if org else "free"
                    break
            except Exception:
                continue

        if not matched_org_id:
            logger.warning(f"No matching org found for GitHub sender: {sender_login}")
            return {"status": "no_matching_org", "sender": sender_login}

    finally:
        db.close()

    # Trigger sync outside the DB session
    await sync_repos_for_org(matched_org_id, matched_token, matched_plan)

    return {
        "status":  "synced",
        "event":   event,
        "org_id":  matched_org_id,
        "repo":    repo_name,
    }
