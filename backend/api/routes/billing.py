from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime
import hashlib
import hmac
import httpx
import os
import sys

sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from db.models import SessionLocal, Organization, User, AuditLog, StripeEvent
from auth.jwt_handler import verify_access_token

router = APIRouter(prefix="/billing", tags=["billing"])

PAYSTACK_SECRET_KEY = os.getenv("PAYSTACK_SECRET_KEY")
PAYSTACK_PLAN_CODE  = os.getenv("PAYSTACK_PLAN_CODE")
PAYSTACK_BASE_URL   = "https://api.paystack.co"


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


# ── SCHEMAS ───────────────────────────────────────────────

class InitializePaymentRequest(BaseModel):
    callback_url: str = "http://localhost:3000/billing/callback"


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
        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if not org:
            raise HTTPException(status_code=404, detail="Org not found")

        if org.plan == "pro":
            raise HTTPException(status_code=400, detail="Already on Pro plan")

        email = user.get("sub")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{PAYSTACK_BASE_URL}/transaction/initialize",
                headers=paystack_headers(),
                json={
                    "email":        email,
                    "amount":       1500000,  # NGN 15,000 in kobo (Paystack uses kobo)
                    "plan":         PAYSTACK_PLAN_CODE,
                    "callback_url": body.callback_url,
                    "metadata": {
                        "org_id":   org_id,
                        "org_name": org.name,
                        "plan":     "pro",
                    }
                }
            )
            data = response.json()

        if not data.get("status"):
            raise HTTPException(status_code=400, detail=data.get("message", "Paystack error"))

        # Audit log
        db.add(AuditLog(
            org_id=org_id,
            action="billing.initialize",
            resource="paystack",
            details=f"Pro plan checkout initialized for {email}",
            created_at=datetime.utcnow(),
        ))
        db.commit()

        return {
            "status":        "initialized",
            "checkout_url":  data["data"]["authorization_url"],
            "reference":     data["data"]["reference"],
            "plan":          "pro",
            "amount_ngn":    "15,000",
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

        # Upgrade org plan
        org_id = user.get("org_id")
        org = db.query(Organization).filter(Organization.id == org_id).first()
        if org:
            org.plan                       = "pro"
            org.stripe_subscription_status = "active"
            org.stripe_subscription_id     = tx.get("subscription_code") or reference

            db.add(AuditLog(
                org_id=org_id,
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
        org = db.query(Organization).filter(
            Organization.id == user.get("org_id")
        ).first()
        if not org:
            raise HTTPException(status_code=404, detail="Org not found")
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

    # Verify webhook signature
    expected = hmac.new(
        PAYSTACK_SECRET_KEY.encode(),
        payload,
        hashlib.sha512
    ).hexdigest()

    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = await request.json()
    event_type = event.get("event")
    data       = event.get("data", {})

    db = SessionLocal()
    try:
        # Idempotency check — don't process same event twice
        event_id = event.get("id", "")
        existing = db.query(StripeEvent).filter(
            StripeEvent.stripe_event_id == event_id
        ).first()
        if existing:
            return {"status": "already_processed"}

        # Log event
        db.add(StripeEvent(
            stripe_event_id=event_id,
            processed_at=datetime.utcnow(),
        ))

        # Handle subscription activated
        if event_type == "subscription.create":
            customer_email = data.get("customer", {}).get("email")
            sub_code       = data.get("subscription_code")

            user_obj = db.query(User).filter(User.email == customer_email).first()
            if user_obj:
                membership = __import__(
                    'db.models', fromlist=['OrganizationMember']
                ).OrganizationMember
                member = db.query(membership).filter(
                    membership.user_id == user_obj.id
                ).first()
                if member:
                    org = db.query(Organization).filter(
                        Organization.id == member.org_id
                    ).first()
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

        # Handle subscription disabled/cancelled
        elif event_type in ("subscription.disable", "subscription.not_renew"):
            customer_email = data.get("customer", {}).get("email")
            user_obj = db.query(User).filter(User.email == customer_email).first()
            if user_obj:
                membership = __import__(
                    'db.models', fromlist=['OrganizationMember']
                ).OrganizationMember
                member = db.query(membership).filter(
                    membership.user_id == user_obj.id
                ).first()
                if member:
                    org = db.query(Organization).filter(
                        Organization.id == member.org_id
                    ).first()
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
