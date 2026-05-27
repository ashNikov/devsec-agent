from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pydantic import BaseModel, validator
import sys
import os
import subprocess
import httpx
from dotenv import load_dotenv
import threading
import time

# Load main env first, then OAuth env
load_dotenv(os.path.expanduser("~/projects/devsec-agent/backend/.env"))
load_dotenv(os.path.expanduser("~/projects/devsec-agent/backend/.oauth_env"))

# Fetch JWT_SECRET_KEY from GCP Secret Manager at startup
def _get_secret(secret_id: str) -> str:
    try:
        result = subprocess.run(
            ["gcloud", "secrets", "versions", "access", "latest",
             f"--secret={secret_id}", "--project=agent-sec-496307"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return os.getenv(secret_id, "")

_jwt_secret = _get_secret("JWT_SECRET_KEY")
if _jwt_secret:
    os.environ["JWT_SECRET_KEY"] = _jwt_secret

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.github_tool import list_repos, scan_repo_for_secrets
from tools.trivy import scan_filesystem
from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.gcp import get_gcp_identity
from agent.core import think, analyze_and_alert
from tools.sonarcloud import get_sonarcloud_status
from agent.scheduler import start_scheduler, stop_scheduler, get_scheduler_status, trigger_manual_scan
from tools.remediation import (
    fix_risky_iam_bindings,
    analyze_dockerfile,
    generate_remediation_report,
    rotate_gcp_secret,
    create_dependency_patch_pr
)
from auth.jwt_handler import create_access_token, verify_access_token

# OAuth config
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
OAUTH_REDIRECT_URI   = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Rate limiter — keyed by IP address
limiter = Limiter(key_func=get_remote_address, default_limits=["50/minute"])

app = FastAPI(title="AgentSec API", version="2.0.0")

@app.on_event("startup")
async def startup_event():
    start_scheduler()

@app.on_event("shutdown")
async def shutdown_event():
    stop_scheduler()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
    allow_credentials=True,
)

class ScanRequest(BaseModel):
    target: str
    scan_type: str

    @validator("target")
    def target_must_be_safe(cls, v):
        import re
        if not v or len(v) > 500:
            raise ValueError("target path too long or empty")
        if re.search(r"[;&|`$><]", v):
            raise ValueError("target contains unsafe characters")
        return v

    @validator("scan_type")
    def scan_type_must_be_valid(cls, v):
        allowed = {"secrets", "vulnerabilities", "filesystem", "docker"}
        if v not in allowed:
            raise ValueError(f"scan_type must be one of {allowed}")
        return v

class ThinkRequest(BaseModel):
    message: str

def check_tool(command: list) -> str:
    try:
        result = subprocess.run(command, capture_output=True, timeout=10)
        return "active" if result.returncode == 0 else "error"
    except Exception:
        return "unavailable"

# ── HEALTH CACHE ─────────────────────────────────────────
_health_cache = {
    "status": "healthy",
    "model": "claude-sonnet-4-20250514",
    "sonarcloud": {},
    "tools": {
        "gitleaks": "checking",
        "trivy":    "checking",
        "github":   "checking",
        "gcp":      "checking"
    }
}

def _refresh_health():
    while True:
        _health_cache["tools"] = {
            "gitleaks": check_tool(["gitleaks", "version"]),
            "trivy":    check_tool(["trivy", "--version"]),
            "github":   check_tool(["gh", "auth", "status"]),
            "gcp":      check_tool(["gcloud", "config", "get-value", "account"]),
        }
        _health_cache["sonarcloud"] = get_sonarcloud_status()
        time.sleep(60)

_health_thread = threading.Thread(target=_refresh_health, daemon=True)
_health_thread.start()

# ── SCAN SUMMARY CACHE ────────────────────────────────────
_summary_cache = {"critical_findings": None, "vulnerabilities": None, "secrets": None}

def _refresh_summary():
    while True:
        try:
            project_path = os.path.expanduser("~/projects/devsec-agent")
            trivy_result    = scan_filesystem(project_path)
            gitleaks_result = gitleaks_scan(project_path)
            critical_count  = sum(1 for f in trivy_result.get("findings", []) if f.get("severity") == "CRITICAL")
            secrets_count   = gitleaks_result.get("total_secrets_found", 0)
            sonar = get_sonarcloud_status()
            sonar_issues = sonar.get("total_issues", 0) if sonar.get("status") == "active" else 0
            _summary_cache.update({
                "critical_findings": critical_count + secrets_count,
                "vulnerabilities":   trivy_result.get("total", 0),
                "secrets":           secrets_count,
                "sonar_issues":      sonar_issues,
                "sonar_gate":        sonar.get("quality_gate", "UNKNOWN")
            })
        except Exception as e:
            pass
        time.sleep(300)

_summary_thread = threading.Thread(target=_refresh_summary, daemon=True)
_summary_thread.start()

def get_current_user(request: Request) -> dict:
    """Dependency — verify JWT on protected endpoints."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header.split(" ")[1]
    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

# ── EXISTING ENDPOINTS ────────────────────────────────────
@app.get("/")
def root():
    return {"message": "AgentSec is running", "status": "healthy",
    "model": "claude-sonnet-4-20250514",
    "sonarcloud": {}, "version": "2.0.0"}

@app.get("/identity")
def identity():
    return get_gcp_identity()

@app.get("/repos")
@limiter.limit("50/minute")
def repos(request: Request, user: dict = Depends(get_current_user)):
    return list_repos()

@app.post("/scan/secrets")
@limiter.limit("50/minute")
def scan_secrets(request: Request, body: ScanRequest, user: dict = Depends(get_current_user)):
    return gitleaks_scan(body.target)

@app.post("/scan/vulnerabilities")
@limiter.limit("50/minute")
def scan_vulnerabilities(request: Request, body: ScanRequest, user: dict = Depends(get_current_user)):
    return scan_filesystem(body.target)

@app.get("/health")
def health():
    return _health_cache

@app.get("/scan/summary")
@limiter.limit("50/minute")
def scan_summary(request: Request, user: dict = Depends(get_current_user)):
    return _summary_cache

@app.post("/agent/think")
@limiter.limit("50/minute")
def agent_think(request: Request, body: ThinkRequest, user: dict = Depends(get_current_user)):
    result = think(body.message)
    return {"response": result}

@app.post("/agent/scan")
@limiter.limit("50/minute")
def agent_scan(request: Request, user: dict = Depends(get_current_user)):
    result = analyze_and_alert()
    return {"analysis": result}

# ── SCAN HISTORY ENDPOINTS ───────────────────────────────
from db.repository import get_scan_history, get_repo_trends
from db.models import init_db

# Initialize DB on startup
init_db()

@app.get("/history/scans")
@limiter.limit("20/minute")
def scan_history(request: Request, user: dict = Depends(get_current_user), limit: int = 20):
    """Return recent scan history."""
    return get_scan_history(limit=limit)

@app.get("/history/trends/{repo}")
@limiter.limit("20/minute")
def repo_trends(repo: str, request: Request, user: dict = Depends(get_current_user)):
    """Return trend data for a specific repo."""
    return get_repo_trends(repo)

# ── PROJECT STATUS ENDPOINT ──────────────────────────────
import json as _json

@app.get("/project/status")
def project_status():
    """Return live project state from agentsec.config.json."""
    try:
        config_path = os.path.expanduser("~/projects/devsec-agent/agentsec.config.json")
        with open(config_path) as f:
            return _json.load(f)
    except Exception as e:
        return {"error": str(e)}

# ── SCHEDULER ENDPOINTS ──────────────────────────────────
@app.get("/scheduler/status")
def scheduler_status(request: Request, user: dict = Depends(get_current_user)):
    """Get scheduler status and next run time."""
    return get_scheduler_status()

@app.post("/scheduler/trigger")
@limiter.limit("5/minute")
def scheduler_trigger(request: Request, user: dict = Depends(get_current_user)):
    """Manually trigger an immediate scan."""
    return trigger_manual_scan()

# ── REMEDIATION ENDPOINTS ────────────────────────────────
@app.post("/remediate/iam")
@limiter.limit("10/minute")
def remediate_iam(request: Request, user: dict = Depends(get_current_user)):
    """Auto-fix risky IAM bindings on GCP."""
    result = fix_risky_iam_bindings()
    return result

@app.post("/remediate/dockerfile")
@limiter.limit("10/minute")
def remediate_dockerfile(request: Request, user: dict = Depends(get_current_user)):
    """Analyze Dockerfile for security issues."""
    dockerfile_path = os.path.expanduser("~/projects/devsec-agent/Dockerfile")
    result = analyze_dockerfile(dockerfile_path)
    return result

@app.post("/remediate/rotate-secret")
@limiter.limit("5/minute")
def remediate_rotate_secret(request: Request, user: dict = Depends(get_current_user)):
    """Rotate JWT_SECRET_KEY in GCP Secret Manager."""
    import secrets
    new_value = secrets.token_hex(32)
    result = rotate_gcp_secret("JWT_SECRET_KEY", new_value)
    return result

@app.get("/remediate/report")
@limiter.limit("10/minute")
def remediate_report(request: Request, user: dict = Depends(get_current_user)):
    """Get available remediation actions."""
    return generate_remediation_report([
        {"action": "IAM scan", "status": "available", "endpoint": "/remediate/iam"},
        {"action": "Dockerfile hardening", "status": "available", "endpoint": "/remediate/dockerfile"},
        {"action": "Secret rotation", "status": "available", "endpoint": "/remediate/rotate-secret"},
    ])

# ── PROVISIONER ENDPOINTS ────────────────────────────────
from tools.provisioner import scan_all_repos

@app.get("/provision/scan")
@limiter.limit("5/minute")
def provision_scan(request: Request, user: dict = Depends(get_current_user)):
    """Scan all repos and return compliance findings."""
    results = scan_all_repos()
    compliant = sum(1 for r in results if r["status"] == "COMPLIANT")
    return {
        "total_repos": len(results),
        "compliant": compliant,
        "needs_attention": len(results) - compliant,
        "findings": results
    }

# ── PROVISIONER FIX ENDPOINTS ───────────────────────────
from tools.provisioner import scan_all_repos, add_cicd_pipeline, add_gitignore, enforce_branch_protection
from tools.approval import request_approval, approve, reject, get_pending, is_approved

class ProvisionRequest(BaseModel):
    repo: str
    action: str
    branch: str = "main"
    language: str = "Python"

class ProvisionApproveRequest(BaseModel):
    approval_id: str
    repo: str
    action: str
    branch: str = "main"
    language: str = "Python"

ACTION_DESCRIPTIONS = {
    "add_cicd":                 "Add GitHub Actions security pipeline (Gitleaks + Trivy)",
    "add_gitignore":            "Create .gitignore file",
    "enforce_branch_protection":"Enable branch protection on default branch",
}

@app.post("/provision/request")
@limiter.limit("10/minute")
def provision_request(request: Request, body: ProvisionRequest, user: dict = Depends(get_current_user)):
    """Request approval before executing a provisioning fix."""
    desc = ACTION_DESCRIPTIONS.get(body.action, body.action)
    approval_id = request_approval(
        action=f"provision:{body.action}:{body.repo}",
        description=f"Repo: `{body.repo}` — {desc}",
        risk_level="MEDIUM"
    )
    return {"approval_id": approval_id, "status": "pending_approval", "repo": body.repo, "action": body.action}

@app.post("/provision/fix")
@limiter.limit("10/minute")
def provision_fix(request: Request, body: ProvisionApproveRequest, user: dict = Depends(get_current_user)):
    """Execute provisioning fix — only after approval."""
    if not is_approved(body.approval_id):
        return {"status": "error", "error": "Not approved or approval expired"}
    if body.action == "add_cicd":
        result = add_cicd_pipeline(body.repo)
    elif body.action == "add_gitignore":
        result = add_gitignore(body.repo, body.language)
    elif body.action == "enforce_branch_protection":
        result = enforce_branch_protection(body.repo, body.branch)
    else:
        return {"status": "error", "error": f"Unknown action: {body.action}"}
    return result

# ── GITHUB OAUTH ENDPOINTS ────────────────────────────────
@app.get("/auth/login")
def auth_login():
    if not GITHUB_CLIENT_ID:
        raise HTTPException(status_code=500, detail="GitHub OAuth not configured")
    github_auth_url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={GITHUB_CLIENT_ID}"
        f"&redirect_uri={OAUTH_REDIRECT_URI}"
        f"&scope=repo,user,read:org"
    )
    return RedirectResponse(url=github_auth_url)

@app.get("/auth/callback")
async def auth_callback(code: str, request: Request):
    if not code:
        raise HTTPException(status_code=400, detail="No code provided")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id":     GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code":          code,
                "redirect_uri":  OAUTH_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        token_data = response.json()

    github_token = token_data.get("access_token")
    if not github_token:
        raise HTTPException(status_code=400, detail="Failed to get access token")

    # Fetch GitHub user info
    async with httpx.AsyncClient() as client:
        user_response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        user_data = user_response.json()

    # Mint a short-expiry JWT (30 min) instead of passing raw GitHub token
    jwt_token = create_access_token(data={
        "sub":        user_data.get("login"),
        "name":       user_data.get("name"),
        "avatar_url": user_data.get("avatar_url"),
        "email":      user_data.get("email"),
    })

    return RedirectResponse(
        url=f"{FRONTEND_URL}?token={jwt_token}&auth=success"
    )

@app.get("/auth/me")
async def auth_me(request: Request, user: dict = Depends(get_current_user)):
    """Return user info from the JWT payload — no GitHub API call needed."""
    return {
        "login":      user.get("sub"),
        "name":       user.get("name"),
        "avatar_url": user.get("avatar_url"),
        "email":      user.get("email"),
        "role":       user.get("role"),
        "org_id":     user.get("org_id"),
        "plan":       user.get("plan"),
    }

@app.get("/auth/logout")
def auth_logout():
    return RedirectResponse(url=f"{FRONTEND_URL}?auth=logout")

# ── APPROVAL WORKFLOW ENDPOINTS ──────────────────────────
from tools.approval import (
    request_approval, approve, reject,
    get_pending, get_all, is_approved
)

@app.get("/approvals/pending")
@limiter.limit("50/minute")
def approvals_pending(request: Request, user: dict = Depends(get_current_user)):
    """Get all pending approvals waiting for action."""
    return get_pending()

@app.get("/approvals/all")
@limiter.limit("50/minute")
def approvals_all(request: Request, user: dict = Depends(get_current_user)):
    """Get recent approval history."""
    return get_all()

@app.post("/approvals/{approval_id}/approve")
@limiter.limit("20/minute")
def approval_approve(approval_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Approve a pending high-risk action."""
    result = approve(approval_id, approved_by=user.get("sub", "dashboard"))
    return result

@app.post("/approvals/{approval_id}/reject")
@limiter.limit("20/minute")
def approval_reject(approval_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Reject a pending high-risk action."""
    result = reject(approval_id, rejected_by=user.get("sub", "dashboard"))
    return result

@app.post("/approvals/test")
@limiter.limit("10/minute")
def approval_test(request: Request, user: dict = Depends(get_current_user)):
    """Test the approval workflow — creates a dummy pending approval."""
    approval_id = request_approval(
        action="rotate_gcp_secret",
        description="Rotate JWT_SECRET_KEY in GCP Secret Manager — all active sessions will be invalidated",
        risk_level="HIGH"
    )
    return {"approval_id": approval_id, "message": "Approval request created — check Slack + dashboard"}

# ── SAAS ROUTERS ─────────────────────────────────────────
from api.routes.auth import router as auth_router
from api.routes.org import router as org_router
from api.routes.billing import router as billing_router
from api.routes.slack import router as slack_router

app.include_router(auth_router)
app.include_router(org_router)
app.include_router(billing_router)
app.include_router(slack_router)
# ── FINDINGS CACHE ────────────────────────────────────────
_findings_cache = []

def _refresh_findings():
    while True:
        try:
            project_path = os.path.expanduser("~/projects/devsec-agent")
            results = []

            # Gitleaks — secrets (always critical)
            gl = gitleaks_scan(project_path)
            for i, f in enumerate(gl.get("findings", [])):
                results.append({
                    "id":       f"gitleaks-{i}",
                    "title":    f.get("Description", "Secret detected"),
                    "file":     f.get("File", "unknown"),
                    "line":     f.get("StartLine", 0),
                    "repo":     "devsec-agent",
                    "tool":     "Gitleaks",
                    "severity": "critical",
                    "status":   "open",
                })

            # Trivy — vulnerabilities
            sev_map = {"CRITICAL": "critical", "HIGH": "high",
                       "MEDIUM": "medium", "LOW": "low"}
            tv = scan_filesystem(project_path)
            for i, f in enumerate(tv.get("findings", [])):
                results.append({
                    "id":       f"trivy-{i}",
                    "title":    f.get("title") or f.get("id", "Vulnerability"),
                    "file":     f.get("package", "dependency"),
                    "line":     0,
                    "repo":     "devsec-agent",
                    "tool":     "Trivy",
                    "severity": sev_map.get(f.get("severity", ""), "low"),
                    "status":   "open",
                })

            _findings_cache.clear()
            _findings_cache.extend(results)
        except Exception:
            pass
        time.sleep(300)  # refresh every 5 minutes

_findings_thread = threading.Thread(target=_refresh_findings, daemon=True)
_findings_thread.start()


@app.get("/findings")
@limiter.limit("20/minute")
def get_findings(request: Request, user: dict = Depends(get_current_user)):
    """Return cached live findings from Gitleaks + Trivy."""
    return _findings_cache
# ── PROFILE UPDATE ───────────────────────────────────────
from datetime import datetime as _dt

class ProfileUpdateRequest(BaseModel):
    email: str

@app.patch("/auth/profile")
@limiter.limit("10/minute")
def update_profile(request: Request, body: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    """Update user profile."""
    from db.models import User as UserModel, AuditLog as AL, SessionLocal as SL
    db = SL()
    try:
        u = db.query(UserModel).filter(UserModel.email == user.get("sub")).first()
        if not u:
            raise HTTPException(status_code=404, detail="User not found")
        old_email = u.email
        u.email = body.email
        db.add(AL(action="user.profile_update", resource="user",
                  details=f"Email updated from {old_email} to {body.email}",
                  created_at=_dt.utcnow()))
        db.commit()
        return {"status": "updated", "email": body.email}
    finally:
        db.close()


# ── FINDINGS RESOLVE ─────────────────────────────────────
from db.models import Finding as FindingModel

@app.patch("/findings/{finding_id}/resolve")
@limiter.limit("20/minute")
def resolve_finding(finding_id: int, request: Request, user: dict = Depends(get_current_user)):
    """Resolve a finding — persists to DB."""
    from db.models import AuditLog as AL, SessionLocal as SL
    db = SL()
    try:
        finding = db.query(FindingModel).filter(FindingModel.id == finding_id).first()
        if not finding:
            finding = FindingModel(
                type="scan", severity="medium",
                title=f"Finding #{finding_id}",
                status="resolved",
                resolved_at=_dt.utcnow(),
                created_at=_dt.utcnow(),
            )
            db.add(finding)
        else:
            finding.status = "resolved"
            finding.resolved_at = _dt.utcnow()
        db.add(AL(action="finding.resolve", resource=str(finding_id),
                  details=f"Finding {finding_id} resolved by {user.get('sub')}",
                  created_at=_dt.utcnow()))
        db.commit()
        return {"status": "resolved", "finding_id": finding_id}
    finally:
        db.close()


@app.get("/findings/resolved")
@limiter.limit("20/minute")
def get_resolved_findings(request: Request, user: dict = Depends(get_current_user)):
    """Return resolved finding IDs from DB."""
    from db.models import SessionLocal as SL
    db = SL()
    try:
        resolved = db.query(FindingModel.id).filter(FindingModel.status == "resolved").all()
        return {"resolved_ids": [r.id for r in resolved]}
    finally:
        db.close()


# ── PER-REPO SCAN ────────────────────────────────────────
class RepoScanRequest(BaseModel):
    repo_name: str

@app.post("/scan/repo")
@limiter.limit("10/minute")
def scan_single_repo(request: Request, body: RepoScanRequest, user: dict = Depends(get_current_user)):
    """Scan a single repo via GitHub API."""
    result = scan_repo_for_secrets(body.repo_name)
    from db.repository import save_scan_result
    save_scan_result(
        repo=body.repo_name,
        secrets=result.get("total", 0),
        vulns=0,
        critical=result.get("total", 0),
    )
    return result
# ── INTEGRATIONS STATUS ENDPOINT ─────────────────────────
@app.get("/org/integrations/status")
@limiter.limit("20/minute")
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
