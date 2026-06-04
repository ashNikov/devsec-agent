from sqlalchemy import (
    create_engine, Column, Integer, String, Float,
    DateTime, Text, Boolean, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DATABASE_URL", os.getenv("AGENTSEC_DB_URL", "sqlite:////tmp/agentsec.db"))
engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


# ─────────────────────────────────────────────
# ORGANIZATIONS & MULTI-TENANCY
# ─────────────────────────────────────────────

class Organization(Base):
    __tablename__ = "organizations"

    id                         = Column(Integer, primary_key=True, index=True)
    name                       = Column(String, nullable=False)
    slug                       = Column(String, unique=True, nullable=False, index=True)
    plan                       = Column(String, default="free")           # free | pro
    stripe_customer_id         = Column(String, nullable=True, unique=True)
    stripe_subscription_id     = Column(String, nullable=True)
    stripe_subscription_status = Column(String, nullable=True)            # active | past_due | cancelled | trialing
    trial_ends_at              = Column(DateTime, nullable=True)
    scans_this_month           = Column(Integer, default=0)
    quota_reset_at             = Column(DateTime, nullable=True)
    created_at                 = Column(DateTime, default=datetime.utcnow)
    is_active                  = Column(Boolean, default=True)

    members       = relationship("OrganizationMember", back_populates="organization")
    invitations   = relationship("Invitation", back_populates="organization")
    repos         = relationship("UserRepo", back_populates="organization")
    api_keys      = relationship("ApiKey", back_populates="organization")
    audit_logs    = relationship("AuditLog", back_populates="organization")
    schedules     = relationship("ScanSchedule", back_populates="organization")
    notifications = relationship("NotificationSetting", back_populates="organization")
    integrations  = relationship("Integration", back_populates="organization")


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=True)   # nullable — GitHub OAuth users have no password
    github_id       = Column(String, nullable=True, unique=True)
    email_verified  = Column(Boolean, default=False)
    is_active       = Column(Boolean, default=True)
    last_login_at   = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    memberships = relationship("OrganizationMember", back_populates="user")
    sessions    = relationship("UserSession", back_populates="user")
    api_keys    = relationship("ApiKey", back_populates="created_by_user")


class OrganizationMember(Base):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("org_id", "user_id"),)

    id        = Column(Integer, primary_key=True, index=True)
    org_id    = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    user_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    role      = Column(String, default="member")      # owner | admin | member
    joined_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="members")
    user         = relationship("User", back_populates="memberships")


class Invitation(Base):
    __tablename__ = "invitations"

    id          = Column(Integer, primary_key=True, index=True)
    org_id      = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    email       = Column(String, nullable=False)
    invited_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    token       = Column(String, unique=True, nullable=False, index=True)
    role        = Column(String, default="member")
    expires_at  = Column(DateTime, nullable=False)
    accepted_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="invitations")


class UserSession(Base):
    __tablename__ = "sessions"

    id                 = Column(Integer, primary_key=True, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False)
    refresh_token_hash = Column(String, unique=True, nullable=False)
    expires_at         = Column(DateTime, nullable=False)
    revoked            = Column(Boolean, default=False)
    created_at         = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class ApiKey(Base):
    __tablename__ = "api_keys"

    id           = Column(Integer, primary_key=True, index=True)
    org_id       = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=True)
    key_hash     = Column(String, unique=True, nullable=False)
    name         = Column(String, nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    last_used_at = Column(DateTime, nullable=True)
    is_active    = Column(Boolean, default=True)

    organization    = relationship("Organization", back_populates="api_keys")
    created_by_user = relationship("User", back_populates="api_keys")


class UserRepo(Base):
    __tablename__ = "user_repos"

    id        = Column(Integer, primary_key=True, index=True)
    org_id    = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    repo_name = Column(String, nullable=False)
    repo_url  = Column(String, nullable=True)
    added_at  = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    organization = relationship("Organization", back_populates="repos")


# ─────────────────────────────────────────────
# STRIPE & BILLING
# ─────────────────────────────────────────────

class StripeEvent(Base):
    __tablename__ = "stripe_events"

    id              = Column(Integer, primary_key=True, index=True)
    stripe_event_id = Column(String, unique=True, nullable=False, index=True)
    processed_at    = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
# AUDIT & OBSERVABILITY
# ─────────────────────────────────────────────

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id         = Column(Integer, primary_key=True, index=True)
    org_id     = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    action     = Column(String, nullable=False)
    resource   = Column(String, nullable=True)
    details    = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="audit_logs")


# ─────────────────────────────────────────────
# SECURITY FINDINGS
# ─────────────────────────────────────────────

class Finding(Base):
    __tablename__ = "findings"

    id          = Column(Integer, primary_key=True, index=True)
    scan_id     = Column(Integer, ForeignKey("scan_results.id"), nullable=True)
    org_id      = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    type        = Column(String, nullable=False)          # secret | misconfiguration
    severity    = Column(String, nullable=False)          # critical | high | medium | low
    title       = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    location    = Column(String, nullable=True)           # file path or cloud resource
    status      = Column(String, default="open")          # open | acknowledged | false_positive | resolved
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)


# ─────────────────────────────────────────────
# SCHEDULING & NOTIFICATIONS
# ─────────────────────────────────────────────

class ScanSchedule(Base):
    __tablename__ = "scan_schedules"

    id              = Column(Integer, primary_key=True, index=True)
    org_id          = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    repo_name       = Column(String, nullable=False)
    cron_expression = Column(String, nullable=False)
    is_active       = Column(Boolean, default=True)
    last_run_at     = Column(DateTime, nullable=True)
    next_run_at     = Column(DateTime, nullable=True)
    created_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at      = Column(DateTime, default=datetime.utcnow)

    organization = relationship("Organization", back_populates="schedules")


class NotificationSetting(Base):
    __tablename__ = "notification_settings"

    id               = Column(Integer, primary_key=True, index=True)
    org_id           = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    channel          = Column(String, nullable=False)     # email | slack | webhook
    destination      = Column(String, nullable=False)
    on_critical      = Column(Boolean, default=True)
    on_new_finding   = Column(Boolean, default=True)
    on_scan_complete = Column(Boolean, default=False)
    is_active        = Column(Boolean, default=True)

    organization = relationship("Organization", back_populates="notifications")


class Integration(Base):
    __tablename__ = "integrations"

    id                     = Column(Integer, primary_key=True, index=True)
    org_id                 = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    provider               = Column(String, nullable=False)   # github | slack | pagerduty
    access_token_encrypted = Column(Text, nullable=True)
    metadata_json          = Column(Text, nullable=True)
    created_at             = Column(DateTime, default=datetime.utcnow)
    is_active              = Column(Boolean, default=True)

    organization = relationship("Organization", back_populates="integrations")


# ─────────────────────────────────────────────
# EXISTING TABLES — upgraded with org/user FKs
# ─────────────────────────────────────────────

class ScanResult(Base):
    __tablename__ = "scan_results"

    id             = Column(Integer, primary_key=True, index=True)
    org_id         = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=True)
    scanned_at     = Column(DateTime, default=datetime.utcnow)
    repo           = Column(String, index=True)
    secrets_found  = Column(Integer, default=0)
    vulns_found    = Column(Integer, default=0)
    critical_count = Column(Integer, default=0)
    brain_winner   = Column(String, nullable=True)
    brain_score    = Column(Float, nullable=True)
    tokens_used    = Column(Integer, default=0)
    analysis       = Column(Text, nullable=True)
    status         = Column(String, default="complete")

    findings = relationship("Finding", backref="scan")


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id          = Column(Integer, primary_key=True, index=True)
    org_id      = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=True)
    actioned_at = Column(DateTime, default=datetime.utcnow)
    repo        = Column(String, index=True)
    action      = Column(String)
    approved_by = Column(String, nullable=True)
    success     = Column(Boolean, default=True)
    details     = Column(Text, nullable=True)


class RepoPattern(Base):
    __tablename__ = "repo_patterns"

    id                = Column(Integer, primary_key=True, index=True)
    org_id            = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    repo              = Column(String, index=True)
    finding_type      = Column(String)
    occurrence_count  = Column(Integer, default=1)
    first_seen        = Column(DateTime, default=datetime.utcnow)
    last_seen         = Column(DateTime, default=datetime.utcnow)
    is_false_positive = Column(Boolean, default=False)


def init_db():
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables created")


if __name__ == "__main__":
    init_db()


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"
    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token      = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
