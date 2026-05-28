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


# ── HELPERS ──────────────────────────────────────────────

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


# ── SCHEMAS ───────────────────────────────────────────────

class InviteRequest(BaseModel):
    email: str

class AddRepoRequest(BaseModel):
    repo_name: str
    repo_url: str = None

class CreateApiKeyRequest(BaseModel):
    name: str


# ── ENDPOINTS ─────────────────────────────────────────────

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

        # Free plan — max 3 members
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

# ── EMAIL INVITE OVERRIDE ─────────────────────────────────
# This overrides the invite endpoint above to send real emails
from fastapi import APIRouter as _AR
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

        # Send email via Resend
        _resend.api_key = os.getenv("RESEND_API_KEY", "")
        invited_by = user.get("sub", "your team")
        org_name = org.name if org else "AgentSec"
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        accept_url = f"{frontend_url}/accept-invite?token={token}"
        email_sent = False

        if _resend.api_key:
            try:
                _resend.Emails.send({
                    "from": "AgentSec <onboarding@resend.dev>",
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

        # Delete in order to respect foreign keys
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
