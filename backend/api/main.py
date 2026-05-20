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

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.github_tool import list_repos, scan_repo_for_secrets
from tools.trivy import scan_filesystem
from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.gcp import get_gcp_identity
from agent.core import think, analyze_and_alert
from auth.jwt_handler import create_access_token, verify_access_token

# OAuth config
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
OAUTH_REDIRECT_URI   = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")

# Rate limiter — keyed by IP address
limiter = Limiter(key_func=get_remote_address, default_limits=["50/minute"])

app = FastAPI(title="AgentSec API", version="2.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
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
            _summary_cache.update({
                "critical_findings": critical_count + secrets_count,
                "vulnerabilities":   trivy_result.get("total", 0),
                "secrets":           secrets_count
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
    return {"message": "AgentSec is running", "status": "healthy", "version": "2.0.0"}

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
    }

@app.get("/auth/logout")
def auth_logout():
    return RedirectResponse(url=f"{FRONTEND_URL}?auth=logout")
