from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os
import subprocess

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.github_tool import list_repos, scan_repo_for_secrets
from tools.trivy import scan_filesystem
from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.gcp import get_gcp_identity
from agent.core import think, analyze_and_alert

app = FastAPI(title="AgentSec API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
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

@app.get("/")
def root():
    return {"message": "AgentSec is running", "status": "healthy"}

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
            "trivy": check_tool(["trivy", "--version"]),
            "github": check_tool(["gh", "auth", "status"]),
            "gcp": check_tool(["gcloud", "auth", "list"])
        }
    }

@app.get("/scan/summary")
def scan_summary():
    project_path = os.path.expanduser("~/projects/devsec-agent")
    trivy_result = scan_filesystem(project_path)
    gitleaks_result = gitleaks_scan(project_path)
    critical_count = sum(1 for f in trivy_result.get("findings", []) if f.get("severity") == "CRITICAL")
    secrets_count = gitleaks_result.get("total_secrets_found", 0)
    return {
        "critical_findings": critical_count + secrets_count,
        "vulnerabilities": trivy_result.get("total", 0),
        "secrets": secrets_count
    }

@app.post("/agent/think")
def agent_think(request: ThinkRequest):
    result = think(request.message)
    return {"response": result}

@app.post("/agent/scan")
def agent_scan():
    result = analyze_and_alert()
    return {"analysis": result}
