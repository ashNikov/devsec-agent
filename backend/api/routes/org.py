from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timedelta
import secrets
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import (
    SessionLocal, Organization, OrganizationMember,
    User, Invitation, UserRepo, ApiKey, AuditLog
)
from auth.jwt_handler import verify_access_token

router = APIRouter(prefix="/org", tags=["org"])


# ── HELPERS ──────────────────────────────────────────────────────────────────

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

def require_owner(user: dict):
    if user.get("role") not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Owner or admin required")


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str

class AddRepoRequest(BaseModel):
    repo_name: str
    repo_url: str = None

class CreateApiKeyRequest(BaseModel):
    name: str


# ── ENDPOINTS ─────────────────────────────────────────────────────────────────

@router.get("/me")
def org_me(request: Request, user: dict = Depends(get_current_user)):
    """Return current org details + plan + member count."""
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=404, detail="No org found")
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Org not found")
        member_count = db.query(OrganizationMember).filter(
            OrganizationMember.org_id == org_id
        ).count()
        repo_count = db.query(UserRepo).filter(
            UserRepo.org_id == org_id, UserRepo.is_active == True
        ).count()
        return {
            "id":                         org.id,
            "name":                       org.name,
            "slug":                       org.slug,
            "plan":                       org.plan,
            "stripe_subscription_status": org.stripe_subscription_status,
            "scans_this_month":           org.scans_this_month,
            "trial_ends_at":              str(org.trial_ends_at) if org.trial_ends_at else None,
            "member_count":               member_count,
            "repo_count":                 repo_count,
            "is_active":                  org.is_active,
        }
    finally:
        db.close()


@router.get("/members")
def org_members(request: Request, user: dict = Depends(get_current_user)):
    """List all members in the org."""
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        members = db.query(OrganizationMember).filter(
            OrganizationMember.org_id == org_id
        ).all()
        result = []
        for m in members:
            u = db.query(User).filter(User.id == m.user_id).first()
            result.append({
                "user_id":   m.user_id,
                "email":     u.email if u else None,
                "role":      m.role,
                "joined_at": str(m.joined_at),
            })
        return result
    finally:
        db.close()


@router.post("/invite")
def invite_member(request: Request, body: InviteRequest, user: dict = Depends(get_current_user)):
    """Invite a teammate by email."""
    require_owner(user)
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()

        if org and org.plan == "free":
            count = db.query(OrganizationMember).filter(
                OrganizationMember.org_id == org_id
            ).count()
            if count >= 3:
                raise HTTPException(
                    status_code=403,
                    detail="Free plan limited to 3 members. Upgrade to Pro."
                )

        token = secrets.token_urlsafe(32)
        invite = Invitation(
            org_id=org_id,
            email=body.email,
            invited_by=None,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=7),
            created_at=datetime.utcnow(),
        )
        db.add(invite)
        db.add(AuditLog(
            org_id=org_id,
            action="member.invite",
            resource="invitation",
            details=f"Invited {body.email}",
            created_at=datetime.utcnow(),
        ))
        db.commit()
        return {
            "status":     "invited",
            "email":      body.email,
            "token":      token,
            "expires_at": str(invite.expires_at),
            "note":       "Share this token with the invitee to accept via /auth/accept-invite"
        }
    finally:
        db.close()


@router.get("/repos")
def list_repos(request: Request, user: dict = Depends(get_current_user)):
    """List repos registered to this org."""
    db = SessionLocal()
    try:
        repos = db.query(UserRepo).filter(
            UserRepo.org_id == user.get("org_id"),
            UserRepo.is_active == True
        ).all()
        return [{"id": r.id, "repo_name": r.repo_name, "repo_url": r.repo_url,
                 "added_at": str(r.added_at)} for r in repos]
    finally:
        db.close()


@router.post("/repos")
def add_repo(request: Request, body: AddRepoRequest, user: dict = Depends(get_current_user)):
    """Add a repo to the org. Free plan capped at 1 repo."""
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()

        if org and org.plan == "free":
            count = db.query(UserRepo).filter(
                UserRepo.org_id == org_id, UserRepo.is_active == True
            ).count()
            if count >= 1:
                raise HTTPException(
                    status_code=403,
                    detail="Free plan limited to 1 repo. Upgrade to Pro."
                )

        repo = UserRepo(
            org_id=org_id,
            repo_name=body.repo_name,
            repo_url=body.repo_url,
            added_at=datetime.utcnow(),
            is_active=True,
        )
        db.add(repo)
        db.add(AuditLog(
            org_id=org_id,
            action="repo.add",
            resource=body.repo_name,
            details=f"Added repo: {body.repo_name}",
            created_at=datetime.utcnow(),
        ))
        db.commit()
        return {"status": "added", "repo_name": body.repo_name, "plan": org.plan if org else "free"}
    finally:
        db.close()


@router.post("/repos/sync")
async def sync_repos(request: Request, user: dict = Depends(get_current_user)):
    """Sync repos from GitHub into DB. Adds new, deactivates deleted."""
    import httpx
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()
        plan = org.plan if org else "free"
        MAX_REPOS = 1 if plan == "free" else 999

        # Get GitHub token from Integration table only — no fallback to env var
        from db.models import Integration
        intg = db.query(Integration).filter(
            Integration.org_id == org_id,
            Integration.provider == "github",
            Integration.is_active == True
        ).first()

        if not intg:
            return {"repos": [], "added": 0, "message": "GitHub not connected — connect via Settings"}
        github_token = intg.access_token_encrypted
        if not github_token:
            return {"repos": [], "added": 0, "message": "GitHub not connected — connect via Settings"}

        # Fetch only repos owned by this user
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://api.github.com/user/repos?per_page=100&sort=updated&type=owner",
                headers={"Authorization": f"Bearer {github_token}", "Accept": "application/vnd.github.v3+json"},
                timeout=10,
            )
        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="GitHub API error")

        github_repos = {r["full_name"]: r for r in resp.json() if isinstance(r, dict)}

        # Get existing DB repos
        db_repos = db.query(UserRepo).filter(UserRepo.org_id == org_id).all()
        db_repo_names = {r.repo_name: r for r in db_repos}

        added = 0
        deactivated = 0

        # Add new repos
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
                    added_at=datetime.utcnow(),
                    is_active=True,
                ))
                added += 1

        # Deactivate repos deleted from GitHub
        for name, repo_obj in db_repo_names.items():
            if name not in github_repos and repo_obj.is_active:
                repo_obj.is_active = False
                deactivated += 1

        db.add(AuditLog(
            org_id=org_id,
            action="repo.sync",
            resource="github",
            details=f"Sync complete: +{added} added, -{deactivated} deactivated",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        repos = db.query(UserRepo).filter(
            UserRepo.org_id == org_id,
            UserRepo.is_active == True
        ).all()
        return {
            "status": "synced",
            "added": added,
            "deactivated": deactivated,
            "total": len(repos),
            "repos": [{"id": r.id, "repo_name": r.repo_name, "repo_url": r.repo_url, "added_at": str(r.added_at)} for r in repos]
        }
    finally:
        db.close()


@router.post("/api-keys")
def create_api_key(request: Request, body: CreateApiKeyRequest, user: dict = Depends(get_current_user)):
    """Create an API key for CI/CD integration."""
    require_owner(user)
    db = SessionLocal()
    try:
        raw_key = f"asec_{secrets.token_urlsafe(32)}"
        key_hash = __import__('hashlib').sha256(raw_key.encode()).hexdigest()
        api_key = ApiKey(
            org_id=user.get("org_id"),
            key_hash=key_hash,
            name=body.name,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        db.add(api_key)
        db.add(AuditLog(
            org_id=user.get("org_id"),
            action="api_key.create",
            resource="api_key",
            details=f"Created API key: {body.name}",
            created_at=datetime.utcnow(),
        ))
        db.commit()
        return {
            "status":   "created",
            "name":     body.name,
            "key":      raw_key,
            "warning":  "Save this key now — it will NOT be shown again."
        }
    finally:
        db.close()


@router.get("/audit-logs")
def audit_logs(request: Request, user: dict = Depends(get_current_user)):
    """Return last 50 audit log entries for this org."""
    require_owner(user)
    db = SessionLocal()
    try:
        logs = db.query(AuditLog).filter(
            AuditLog.org_id == user.get("org_id")
        ).order_by(AuditLog.created_at.desc()).limit(50).all()
        return [
            {"id": l.id, "action": l.action, "resource": l.resource,
             "details": l.details, "created_at": str(l.created_at)}
            for l in logs
        ]
    finally:
        db.close()


# ── EMAIL INVITE ──────────────────────────────────────────────────────────────
import resend as _resend

@router.post("/invite/send")
def invite_member_with_email(request: Request, body: InviteRequest, user: dict = Depends(get_current_user)):
    """Invite a teammate — creates token AND sends real email via Resend."""
    require_owner(user)
    db = SessionLocal()
    try:
        import os, secrets as _secrets
        from datetime import timedelta

        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()

        if org and org.plan == "free":
            count = db.query(OrganizationMember).filter(
                OrganizationMember.org_id == org_id
            ).count()
            if count >= 3:
                raise HTTPException(status_code=403, detail="Free plan limited to 3 members. Upgrade to Pro.")

        token = _secrets.token_urlsafe(32)
        invite = Invitation(
            org_id=org_id,
            email=body.email,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=7),
            created_at=datetime.utcnow(),
        )
        db.add(invite)
        db.add(AuditLog(
            org_id=org_id,
            action="member.invite",
            resource="invitation",
            details=f"Invited {body.email}",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        _resend.api_key = os.getenv("RESEND_API_KEY", "")
        invited_by = user.get("sub", "your team")
        org_name = org.name if org else "AgentSec"
        frontend_url = os.getenv("FRONTEND_URL", "https://frontend-alpha-nine-71.vercel.app")
        accept_url = f"{frontend_url}/accept-invite?token={token}"
        email_sent = False

        if _resend.api_key:
            try:
                _resend.Emails.send({
                    "from": "AgentSec <noreply@ashtech.app>",
                    "to": [body.email],
                    "subject": f"You've been invited to {org_name} on AgentSec",
                    "html": f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                        <div style="margin-bottom:24px;"><span style="font-size:22px;font-weight:700;color:#00E5A0;">Agent</span><span style="font-size:22px;font-weight:700;color:#1a1a1a;">Sec</span></div>
                        <h2 style="font-size:20px;color:#1a1a1a;margin-bottom:8px;">You've been invited</h2>
                        <p style="color:#555;margin-bottom:24px;"><strong>{invited_by}</strong> has invited you to join <strong>{org_name}</strong> on AgentSec — autonomous DevSecOps security scanning.</p>
                        <a href="{accept_url}" style="display:inline-block;background:#00E5A0;color:#07090F;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Accept Invitation</a>
                        <p style="color:#999;font-size:12px;margin-top:24px;">Or use token: <code style="background:#f5f5f5;padding:2px 6px;border-radius:3px;">{token}</code></p>
                        <p style="color:#999;font-size:12px;">Expires in 7 days.</p>
                    </div>"""
                })
                email_sent = True
            except Exception as e:
                print(f"[EMAIL ERROR] {e}")

        return {
            "status": "invited",
            "email": body.email,
            "token": token,
            "email_sent": email_sent,
            "expires_at": str(invite.expires_at),
        }
    finally:
        db.close()


@router.delete("/workspace")
def delete_workspace(request: Request, user: dict = Depends(get_current_user)):
    """Permanently delete org, all members, repos, findings. Owner only."""
    require_owner(user)
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        if not org_id:
            raise HTTPException(status_code=404, detail="No org found")

        db.query(AuditLog).filter(AuditLog.org_id == org_id).delete()
        db.query(Invitation).filter(Invitation.org_id == org_id).delete()
        db.query(OrganizationMember).filter(OrganizationMember.org_id == org_id).delete()
        db.query(UserRepo).filter(UserRepo.org_id == org_id).delete()
        db.query(ApiKey).filter(ApiKey.org_id == org_id).delete()
        db.query(Organization).filter(Organization.id == org_id).delete()

        db.commit()
        return {"status": "deleted", "org_id": org_id}
    finally:
        db.close()


@router.delete("/members/{user_id}")
def remove_member(user_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Remove a member from the org. Owner only."""
    require_owner(user)
    db = SessionLocal()
    try:
        org_id = user.get("org_id")
        current_user = db.query(User).filter(User.email == user.get("sub")).first()
        if current_user and current_user.id == user_id:
            raise HTTPException(status_code=400, detail="Cannot remove yourself")
        member = db.query(OrganizationMember).filter(
            OrganizationMember.org_id == org_id,
            OrganizationMember.user_id == user_id
        ).first()
        if not member:
            raise HTTPException(status_code=404, detail="Member not found")
        db.delete(member)
        db.add(AuditLog(
            org_id=org_id,
            action="member.remove",
            resource=str(user_id),
            details=f"Member {user_id} removed by {user.get('sub')}",
            created_at=datetime.utcnow(),
        ))
        db.commit()
        return {"status": "removed", "user_id": user_id}
    finally:
        db.close()


@router.get("/integrations/status")
def integrations_status(request: Request, user: dict = Depends(get_current_user)):
    """Return real integration status based on env vars."""
    def is_set(key: str) -> bool:
        val = os.getenv(key, "").strip()
        return bool(val) and val not in ("", "your_key_here", "changeme", "xxx")

    return [
        {
            "name": "GitHub",
            "desc": f"Repository scanning · {'OAuth connected' if is_set('GITHUB_TOKEN') else 'Token missing'}",
            "status": "connected" if is_set("GITHUB_TOKEN") else "disconnected",
        },
        {
            "name": "GCP",
            "desc": f"agent-sec-496307 · {'Cloud Run deployed' if is_set('GOOGLE_APPLICATION_CREDENTIALS') or is_set('GCP_PROJECT_ID') else 'Credentials missing'}",
            "status": "connected" if (is_set("GOOGLE_APPLICATION_CREDENTIALS") or is_set("GCP_PROJECT_ID")) else "disconnected",
        },
        {
            "name": "Supabase",
            "desc": f"Database · {'Connection string configured' if is_set('SUPABASE_URL') or is_set('DATABASE_URL') else 'Not configured'}",
            "status": "connected" if (is_set("SUPABASE_URL") or is_set("DATABASE_URL") or is_set("AGENTSEC_DB_URL")) else "disconnected",
        },
        {
            "name": "Paystack",
            "desc": f"Payments · {'API key configured' if is_set('PAYSTACK_SECRET_KEY') else 'API key pending'}",
            "status": "connected" if is_set("PAYSTACK_SECRET_KEY") else "pending",
        },
        {
            "name": "Slack",
            "desc": f"Notifications · {'Webhook active' if is_set('SLACK_WEBHOOK_URL') else 'Not connected'}",
            "status": "connected" if is_set("SLACK_WEBHOOK_URL") else "disconnected",
        },
        {
            "name": "ngrok",
            "desc": f"Tunneling · {'Auth token configured' if is_set('NGROK_AUTH_TOKEN') else 'Not configured'}",
            "status": "connected" if is_set("NGROK_AUTH_TOKEN") else "disconnected",
        },
    ]