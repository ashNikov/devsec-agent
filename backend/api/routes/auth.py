from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
import bcrypt
from datetime import datetime
import secrets
import string
import sys, os

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import SessionLocal, User, Organization, OrganizationMember, AuditLog
from auth.jwt_handler import create_access_token, verify_access_token

router = APIRouter(prefix="/auth", tags=["auth"])



# ── HELPERS ──────────────────────────────────────────────

def _slug_from_name(name: str) -> str:
    """Convert org name to a URL-safe slug."""
    slug = name.lower().strip().replace(" ", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    suffix = "".join(secrets.choice(string.digits) for _ in range(4))
    return f"{slug}-{suffix}"

def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# ── SCHEMAS ───────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: str
    password: str
    org_name: str

class LoginRequest(BaseModel):
    email: str
    password: str


# ── ENDPOINTS ─────────────────────────────────────────────

@router.post("/register")
def register(body: RegisterRequest):
    """Create a new user + org in one shot."""
    db = SessionLocal()
    try:
        # Check email not already taken
        existing = db.query(User).filter(User.email == body.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create user
        user = User(
            email=body.email,
            hashed_password=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
            email_verified=False,
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.flush()  # get user.id before commit

        # Create org
        org = Organization(
            name=body.org_name,
            slug=_slug_from_name(body.org_name),
            plan="pro" if body.email == os.getenv("OWNER_EMAIL", "") else "free",
            scans_this_month=0,
            created_at=datetime.utcnow(),
            is_active=True,
        )
        db.add(org)
        db.flush()

        # Make user the owner
        member = OrganizationMember(
            org_id=org.id,
            user_id=user.id,
            role="owner",
            joined_at=datetime.utcnow(),
        )
        db.add(member)

        # Audit log
        db.add(AuditLog(
            org_id=org.id,
            user_id=user.id,
            action="user.register",
            resource="user",
            details=f"New user registered: {body.email}",
            created_at=datetime.utcnow(),
        ))

        db.commit()

        # Mint JWT
        token = create_access_token(data={
            "sub":    body.email,
            "org_id": org.id,
            "role":   "owner",
            "plan":   "free",
        })

        return {
            "access_token": token,
            "token_type":   "bearer",
            "user": {
                "email":    user.email,
                "org_name": org.name,
                "org_slug": org.slug,
                "plan":     org.plan,
                "role":     "owner",
            }
        }
    finally:
        db.close()


@router.post("/login")
def login(body: LoginRequest):
    """Email + password login."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == body.email).first()
        if not user or not user.hashed_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not bcrypt.checkpw(body.password.encode(), user.hashed_password.encode()):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account disabled")

        # Get org + role
        membership = db.query(OrganizationMember).filter(
            OrganizationMember.user_id == user.id
        ).first()
        org = db.query(Organization).filter(
            Organization.id == membership.org_id
        ).first() if membership else None

        # Update last login
        user.last_login_at = datetime.utcnow()
        db.commit()

        token = create_access_token(data={
            "sub":    user.email,
            "org_id": org.id if org else None,
            "role":   membership.role if membership else "member",
            "plan":   org.plan if org else "free",
        })

        return {
            "access_token": token,
            "token_type":   "bearer",
            "user": {
                "email":    user.email,
                "org_name": org.name if org else None,
                "plan":     org.plan if org else "free",
                "role":     membership.role if membership else "member",
            }
        }
    finally:
        db.close()


@router.get("/me")
def me(request: Request, user: dict = Depends(get_current_user)):
    """Return current user info from JWT."""
    return {
        "email":    user.get("sub"),
        "org_id":   user.get("org_id"),
        "role":     user.get("role"),
        "plan":     user.get("plan"),
    }

class AcceptInviteRequest(BaseModel):
    token: str
    password: str

@router.post("/accept-invite")
def accept_invite(body: AcceptInviteRequest):
    """Accept an invitation token — join existing org with assigned role."""
    from db.models import Invitation
    db = SessionLocal()
    try:
        # Find invitation
        invite = db.query(Invitation).filter(
            Invitation.token == body.token,
            Invitation.accepted_at == None,
        ).first()
        if not invite:
            raise HTTPException(status_code=400, detail="Invalid or expired invite token")
        if invite.expires_at and invite.expires_at < datetime.utcnow():
            raise HTTPException(status_code=400, detail="Invite token has expired")

        # Check email not already taken
        existing = db.query(User).filter(User.email == invite.email).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Create user
        user = User(
            email=invite.email,
            hashed_password=bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
            email_verified=False,
            is_active=True,
            created_at=datetime.utcnow(),
        )
        db.add(user)
        db.flush()

        # Join existing org with invite role
        role = invite.role if invite.role else "member"
        member = OrganizationMember(
            org_id=invite.org_id,
            user_id=user.id,
            role=role,
            joined_at=datetime.utcnow(),
        )
        db.add(member)

        # Mark invite as accepted
        invite.accepted_at = datetime.utcnow()

        # Get org details
        org = db.query(Organization).filter(Organization.id == invite.org_id).first()

        db.add(AuditLog(
            org_id=invite.org_id,
            user_id=user.id,
            action="user.accept_invite",
            resource="user",
            details=f"User accepted invite: {invite.email} as {role}",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        # Mint JWT
        token_jwt = create_access_token(data={
            "sub":    invite.email,
            "org_id": invite.org_id,
            "role":   role,
            "plan":   org.plan if org else "free",
        })

        return {
            "access_token": token_jwt,
            "token_type":   "bearer",
            "user": {
                "email":    invite.email,
                "org_name": org.name if org else "",
                "org_slug": org.slug if org else "",
                "plan":     org.plan if org else "free",
                "role":     role,
            }
        }
    finally:
        db.close()
# ── FORGOT PASSWORD ───────────────────────────────────────────────────────────
import resend as _resend
from datetime import timedelta

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest):
    """Generate a reset token and send email via Resend."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == body.email).first()
        # Always return 200 — don't reveal if email exists
        if not user:
            return {"status": "ok", "message": "If that email exists, a reset link has been sent."}

        # Invalidate any existing unused tokens for this user
        from db.models import PasswordResetToken
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False
        ).delete()

        token = secrets.token_urlsafe(32)
        reset = PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1),
            used=False,
            created_at=datetime.utcnow(),
        )
        db.add(reset)
        db.commit()

        frontend_url = os.getenv("FRONTEND_URL", "https://www.ashtech.app")
        reset_url = f"{frontend_url}/reset-password?token={token}"

        _resend.api_key = os.getenv("RESEND_API_KEY", "")
        if _resend.api_key:
            try:
                _resend.Emails.send({
                    "from": "AgentSec <noreply@ashtech.app>",
                    "to": [body.email],
                    "subject": "Reset your AgentSec password",
                    "html": f"""<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
                        <div style="margin-bottom:24px;"><span style="font-size:22px;font-weight:700;color:#00E5A0;">Agent</span><span style="font-size:22px;font-weight:700;color:#1a1a1a;">Sec</span></div>
                        <h2 style="font-size:20px;color:#1a1a1a;margin-bottom:8px;">Reset your password</h2>
                        <p style="color:#555;margin-bottom:24px;">Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
                        <a href="{reset_url}" style="display:inline-block;background:#00E5A0;color:#07090F;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Reset Password</a>
                        <p style="color:#999;font-size:12px;margin-top:24px;">If you didn't request this, ignore this email.</p>
                        <p style="color:#999;font-size:12px;">Link expires in 1 hour.</p>
                    </div>"""
                })
            except Exception as e:
                print(f"[EMAIL ERROR] {e}")

        return {"status": "ok", "message": "If that email exists, a reset link has been sent."}
    finally:
        db.close()


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest):
    """Validate token and update password."""
    db = SessionLocal()
    try:
        from db.models import PasswordResetToken
        reset = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == body.token,
            PasswordResetToken.used == False,
            PasswordResetToken.expires_at > datetime.utcnow()
        ).first()

        if not reset:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token.")

        user = db.query(User).filter(User.id == reset.user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        user.hashed_password = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
        reset.used = True
        db.commit()

        return {"status": "ok", "message": "Password updated successfully."}
    finally:
        db.close()