from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
import sys
import os
import subprocess
import httpx
from dotenv import load_dotenv

# Load main env first, then OAuth env
load_dotenv(os.path.expanduser("~/projects/devsec-agent/backend/.env"))
load_dotenv(os.path.expanduser("~/projects/devsec-agent/backend/.oauth_env"))

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.github_tool import list_repos, scan_repo_for_secrets
from tools.trivy import scan_filesystem
from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.gcp import get_gcp_identity
from agent.core import think, analyze_and_alert

# OAuth config loaded from GCP Secret Manager via Ansible
GITHUB_CLIENT_ID     = os.getenv("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET")
OAUTH_REDIRECT_URI   = os.getenv("OAUTH_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL         = os.getenv("FRONTEND_URL", "http://localhost:3000")

app = FastAPI(title="AgentSec API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

class ScanRequest(BaseModel):
    target: str
    scan_type: str

class ThinkRequest(BaseModel):
    message: str

def check_tool(command: list) -> str:
    try:
        result = subprocess.run(command, capture_output=True, timeout=5)
        return "active" if result.returncode == 0 else "error"
    except Exception:
        return "unavailable"

# ── EXISTING ENDPOINTS ────────────────────────────────────
@app.get("/")
def root():
    return {"message": "AgentSec is running", "status": "healthy", "version": "2.0.0"}

@app.get("/identity")
def identity():
    return get_gcp_identity()

@app.get("/repos")
def repos():
    return list_repos()

@app.post("/scan/secrets")
def scan_secrets(request: ScanRequest):
    return gitleaks_scan(request.target)

@app.post("/scan/vulnerabilities")
def scan_vulnerabilities(request: ScanRequest):
    return scan_filesystem(request.target)

@app.get("/health")
def health():
    return {
        "status": "healthy",
        "tools": {
            "gitleaks": check_tool(["gitleaks", "version"]),
            "trivy":    check_tool(["trivy", "--version"]),
            "github":   check_tool(["gh", "auth", "status"]),
            "gcp":      check_tool(["gcloud", "auth", "list"])
        }
    }

@app.get("/scan/summary")
def scan_summary():
    project_path = os.path.expanduser("~/projects/devsec-agent")
    trivy_result    = scan_filesystem(project_path)
    gitleaks_result = gitleaks_scan(project_path)
    critical_count  = sum(1 for f in trivy_result.get("findings", []) if f.get("severity") == "CRITICAL")
    secrets_count   = gitleaks_result.get("total_secrets_found", 0)
    return {
        "critical_findings": critical_count + secrets_count,
        "vulnerabilities":   trivy_result.get("total", 0),
        "secrets":           secrets_count
    }

@app.post("/agent/think")
def agent_think(request: ThinkRequest):
    result = think(request.message)
    return {"response": result}

@app.post("/agent/scan")
def agent_scan():
    result = analyze_and_alert()
    return {"analysis": result}

# ── GITHUB OAUTH ENDPOINTS ────────────────────────────────
@app.get("/auth/login")
def auth_login():
    """Redirect user to GitHub OAuth login page."""
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
    """GitHub calls this with a code — exchange it for an access token."""
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

    access_token = token_data.get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="Failed to get access token")

    # Redirect to frontend with token
    return RedirectResponse(
        url=f"{FRONTEND_URL}?token={access_token}&auth=success"
    )

@app.get("/auth/me")
async def auth_me(request: Request):
    """Get the logged in GitHub user's info."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")

    token = auth_header.split(" ")[1]

    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        user_data = response.json()

    return {
        "login":      user_data.get("login"),
        "name":       user_data.get("name"),
        "avatar_url": user_data.get("avatar_url"),
        "email":      user_data.get("email"),
    }

@app.get("/auth/logout")
def auth_logout():
    """Clear the session and redirect to frontend."""
    return RedirectResponse(url=f"{FRONTEND_URL}?auth=logout")
