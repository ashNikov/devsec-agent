from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime
import hashlib
import hmac
import httpx
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import SessionLocal, Organization, User, AuditLog, StripeEvent, OrganizationMember
from auth.jwt_handler import verify_access_token

router = APIRouter(prefix="/billing", tags=["billing"])

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
PAYSTACK_PLAN_CODE  = os.getenv("PAYSTACK_PLAN_CODE")
PAYSTACK_BASE_URL   = "https://api.paystack.co"
FRONTEND_URL        = os.getenv("FRONTEND_URL", "https://frontend-alpha-nine-71.vercel.app")


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

def paystack_headers():
    return {
        "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
        "Content-Type":  "application/json",
    }

def resolve_org(db, user: dict) -> Organization:
    """
    Resolve the org for the current user.
    Primary:  org_id from JWT
    Fallback: look up via email -> user -> membership -> org
    Raises 404 if still not found.
    """
    org_id = user.get("org_id")
    org = None

    if org_id:
        org = db.query(Organization).filter(Organization.id == org_id).first()

    if not org:
        # Fallback: email -> User -> OrganizationMember -> Organization
        email = user.get("sub")
        if email:
            user_obj = db.query(User).filter(User.email == email).first()
            if user_obj:
                member = db.query(OrganizationMember).filter(
                    OrganizationMember.user_id == user_obj.id
                ).first()
                if member:
                    org = db.query(Organization).filter(
                        Organization.id == member.org_id
                    ).first()

    if not org:
        raise HTTPException(status_code=404, detail="Org not found")

    return org


# ── SCHEMAS ───────────────────────────────────────────────

class InitializePaymentRequest(BaseModel):
    callback_url: str = f"{FRONTEND_URL}/billing/callback"


# ── ENDPOINTS ─────────────────────────────────────────────

@router.post("/initialize")
async def initialize_payment(
    request: Request,
    body: InitializePaymentRequest,
    user: dict = Depends(get_current_user)
):
    """Initialize a Paystack subscription checkout for the Pro plan."""
    db = SessionLocal()
    try:
        org   = resolve_org(db, user)
        email = user.get("sub")

        if org.plan == "pro":
            raise HTTPException(status_code=400, detail="Already on Pro plan")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/transaction/initialize",
                headers=paystack_headers(),
                json={
                    "email":        email,
                    "amount":       1500000,  # NGN 15,000 in kobo
                    "plan":         PAYSTACK_PLAN_CODE,
                    "callback_url": body.callback_url,
                    "metadata": {
                        "org_id":   org.id,
                        "org_name": org.name,
                        "plan":     "pro",
                    }
                }
            )
            data = response.json()

        if not data.get("status"):
            raise HTTPException(status_code=400, detail=data.get("message", "Paystack error"))

        db.add(AuditLog(
            org_id=org.id,
            action="billing.initialize",
            resource="paystack",
            details=f"Pro plan checkout initialized for {email}",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        return {
            "status":       "initialized",
            "checkout_url": data["data"]["authorization_url"],
            "reference":    data["data"]["reference"],
            "plan":         "pro",
            "amount_ngn":   "15,000",
        }
    finally:
        db.close()


@router.get("/verify/{reference}")
async def verify_payment(
    reference: str,
    request: Request,
    user: dict = Depends(get_current_user)
):
    """Verify a payment after callback and upgrade plan if successful."""
    db = SessionLocal()
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}",
                headers=paystack_headers(),
            )
            data = response.json()

        if not data.get("status"):
            raise HTTPException(status_code=400, detail="Verification failed")

        tx = data["data"]
        if tx["status"] != "success":
            return {"status": "failed", "reason": tx.get("gateway_response")}

        org = resolve_org(db, user)
        org.plan                       = "pro"
        org.stripe_subscription_status = "active"
        org.stripe_subscription_id     = tx.get("subscription_code") or reference

        db.add(AuditLog(
            org_id=org.id,
            action="billing.upgraded",
            resource="plan",
            details=f"Upgraded to Pro — ref: {reference}",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        return {
            "status":    "success",
            "plan":      "pro",
            "reference": reference,
            "amount":    tx.get("amount"),
            "paid_at":   tx.get("paid_at"),
        }
    finally:
        db.close()


@router.get("/status")
def billing_status(request: Request, user: dict = Depends(get_current_user)):
    """Return current billing status for the org."""
    db = SessionLocal()
    try:
        org = resolve_org(db, user)
        return {
            "plan":                       org.plan,
            "stripe_subscription_status": org.stripe_subscription_status,
            "scans_this_month":           org.scans_this_month,
            "trial_ends_at":              str(org.trial_ends_at) if org.trial_ends_at else None,
        }
    finally:
        db.close()


@router.post("/webhook")
async def paystack_webhook(request: Request):
    """Handle Paystack webhook events — subscription created, disabled."""
    payload   = await request.body()
    signature = request.headers.get("x-paystack-signature", "")

    expected = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event      = await request.json()
    event_type = event.get("event")
    data       = event.get("data", {})

    db = SessionLocal()
    try:
        event_id = event.get("id", "")
        existing = db.query(StripeEvent).filter(
            StripeEvent.stripe_event_id == event_id
        ).first()
        if existing:
            return {"status": "already_processed"}

        db.add(StripeEvent(
            stripe_event_id=event_id,
            processed_at=datetime.utcnow(),
        ))

        def get_org_by_email(email):
            user_obj = db.query(User).filter(User.email == email).first()
            if not user_obj:
                return None
            member = db.query(OrganizationMember).filter(
                OrganizationMember.user_id == user_obj.id
            ).first()
            if not member:
                return None
            return db.query(Organization).filter(
                Organization.id == member.org_id
            ).first()

        if event_type == "subscription.create":
            customer_email = data.get("customer", {}).get("email")
            sub_code       = data.get("subscription_code")
            org = get_org_by_email(customer_email)
            if org:
                org.plan                       = "pro"
                org.stripe_subscription_id     = sub_code
                org.stripe_subscription_status = "active"
                db.add(AuditLog(
                    org_id=org.id,
                    action="billing.subscription_created",
                    resource="plan",
                    details=f"Pro subscription activated: {sub_code}",
                    created_at=datetime.utcnow(),
                ))

        elif event_type in ("subscription.disable", "subscription.not_renew"):
            customer_email = data.get("customer", {}).get("email")
            org = get_org_by_email(customer_email)
            if org:
                org.plan                       = "free"
                org.stripe_subscription_status = "cancelled"
                db.add(AuditLog(
                    org_id=org.id,
                    action="billing.subscription_cancelled",
                    resource="plan",
                    details="Subscription cancelled — downgraded to Free",
                    created_at=datetime.utcnow(),
                ))

        db.commit()
        return {"status": "processed", "event": event_type}
    finally:
        db.close()
