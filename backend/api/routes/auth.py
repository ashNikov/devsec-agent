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
            plan="free",
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
