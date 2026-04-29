from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.github_tool import list_repos, scan_repo_for_secrets
from tools.trivy import scan_filesystem
from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.gcp import get_gcp_identity

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
            "gitleaks": "active",
            "trivy": "active",
            "github": "active",
            "gcp": "active"
        }
    }
