import os
import requests
import base64
from dotenv import load_dotenv

load_dotenv()

# ── HELPERS ──────────────────────────────────────────────

def _headers(github_token: str) -> dict:
    return {
        "Authorization": f"Bearer {github_token}",
        "Accept": "application/vnd.github.v3+json"
    }

def _get_token_and_user(github_token: str = None, github_user: str = None):
    """Fall back to env vars only if not provided — for backwards compat."""
    token = github_token or os.getenv("GITHUB_TOKEN", "")
    user  = github_user  or os.getenv("GITHUB_USER", "ashNikov")
    return token, user


# ── CHECKS ───────────────────────────────────────────────

def check_repo_has_workflow(repo: str, github_token: str = None, github_user: str = None) -> bool:
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.get(
        f"https://api.github.com/repos/{user}/{repo}/contents/.github/workflows",
        headers=_headers(token), timeout=10
    )
    return r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) > 0

def check_repo_has_gitignore(repo: str, github_token: str = None, github_user: str = None) -> bool:
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.get(
        f"https://api.github.com/repos/{user}/{repo}/contents/.gitignore",
        headers=_headers(token), timeout=10
    )
    return r.status_code == 200

def check_branch_protection(repo: str, branch: str = "main", github_token: str = None, github_user: str = None) -> bool:
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.get(
        f"https://api.github.com/repos/{user}/{repo}/branches/{branch}/protection",
        headers=_headers(token), timeout=10
    )
    return r.status_code == 200

def check_repo_has_dockerfile(repo: str, github_token: str = None, github_user: str = None) -> bool:
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.get(
        f"https://api.github.com/repos/{user}/{repo}/contents/Dockerfile",
        headers=_headers(token), timeout=10
    )
    return r.status_code == 200


# ── SCAN ─────────────────────────────────────────────────

def scan_all_repos(github_token: str = None, github_user: str = None) -> list:
    """Scan all repos for the given user and return a findings report."""
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.get(
        f"https://api.github.com/users/{user}/repos?per_page=100&type=owner",
        headers=_headers(token), timeout=15
    )
    repos = r.json() if r.status_code == 200 else []
    if not isinstance(repos, list):
        return []

    findings = []
    for repo in repos:
        name           = repo["name"]
        full_name      = repo.get("full_name") or name
        default_branch = repo.get("default_branch", "main")
        missing        = []

        if not check_repo_has_workflow(name, token, user):
            missing.append("CI/CD pipeline")
        if not check_repo_has_gitignore(name, token, user):
            missing.append(".gitignore")
        if not check_branch_protection(name, default_branch, token, user):
            missing.append("branch protection")
        if not check_repo_has_dockerfile(name, token, user):
            missing.append("Dockerfile")

        findings.append({
            "repo":           full_name,
            "default_branch": default_branch,
            "private":        repo["private"],
            "missing":        missing,
            "score":          len(missing),
            "status":         "NEEDS_ATTENTION" if missing else "COMPLIANT"
        })

    findings.sort(key=lambda x: x["score"], reverse=True)
    return findings


# ── PROVISIONERS ─────────────────────────────────────────

def add_cicd_pipeline(repo: str, github_token: str = None, github_user: str = None) -> dict:
    """Push a security CI/CD pipeline to a repo missing one."""
    token, user = _get_token_and_user(github_token, github_user)
    workflow = """name: Security Pipeline

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  secret-scan:
    name: Secret Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Run Gitleaks
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  vulnerability-scan:
    name: Vulnerability Scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Trivy
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: fs
          scan-ref: .
          severity: CRITICAL,HIGH
          format: table
          exit-code: '0'
"""
    content_b64 = base64.b64encode(workflow.encode()).decode()
    r = requests.put(
        f"https://api.github.com/repos/{user}/{repo}/contents/.github/workflows/security.yml",
        headers=_headers(token),
        json={
            "message": "ci: add AgentSec security pipeline — Gitleaks + Trivy [auto-provisioned]",
            "content": content_b64
        },
        timeout=15
    )
    if r.status_code in (200, 201):
        return {"status": "success", "repo": repo, "action": "added CI/CD pipeline",
                "url": r.json().get("content", {}).get("html_url")}
    return {"status": "error", "repo": repo, "error": r.json().get("message", "unknown")}


def add_gitignore(repo: str, language: str = "Python", github_token: str = None, github_user: str = None) -> dict:
    """Push a .gitignore to a repo missing one."""
    token, user = _get_token_and_user(github_token, github_user)
    templates = {
        "Python":     "__pycache__/\n*.pyc\n*.pyo\n.env\n.venv/\nvenv/\n*.egg-info/\ndist/\nbuild/\n.DS_Store\n*.log\n.pytest_cache/\n",
        "JavaScript": "node_modules/\n.env\n.next/\ndist/\nbuild/\n*.log\n.DS_Store\ncoverage/\n",
        "default":    ".env\n*.log\n.DS_Store\nbuild/\ndist/\n"
    }
    content     = templates.get(language, templates["default"])
    content_b64 = base64.b64encode(content.encode()).decode()
    r = requests.put(
        f"https://api.github.com/repos/{user}/{repo}/contents/.gitignore",
        headers=_headers(token),
        json={
            "message": "chore: add .gitignore [auto-provisioned by AgentSec]",
            "content": content_b64
        },
        timeout=15
    )
    if r.status_code in (200, 201):
        return {"status": "success", "repo": repo, "action": "added .gitignore"}
    return {"status": "error", "repo": repo, "error": r.json().get("message", "unknown")}


def add_dockerfile(repo: str, language: str = "Python", github_token: str = None, github_user: str = None) -> dict:
    """Push a starter Dockerfile to a repo missing one."""
    token, user = _get_token_and_user(github_token, github_user)
    templates = {
        "Python":     "FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install --no-cache-dir -r requirements.txt\nCOPY . .\nRUN useradd -m appuser\nUSER appuser\nEXPOSE 8000\nCMD [\"python\", \"main.py\"]\n",
        "JavaScript": "FROM node:20-slim\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nRUN useradd -m appuser\nUSER appuser\nEXPOSE 3000\nCMD [\"node\", \"index.js\"]\n",
        "default":    "FROM alpine:3.20\nWORKDIR /app\nCOPY . .\nRUN adduser -D appuser\nUSER appuser\nCMD [\"sh\"]\n",
    }
    content     = templates.get(language, templates["default"])
    content_b64 = base64.b64encode(content.encode()).decode()
    r = requests.put(
        f"https://api.github.com/repos/{user}/{repo}/contents/Dockerfile",
        headers=_headers(token),
        json={
            "message": "chore: add Dockerfile [auto-provisioned by AgentSec]",
            "content": content_b64
        },
        timeout=15
    )
    if r.status_code in (200, 201):
        return {"status": "success", "repo": repo, "action": "added Dockerfile"}
    return {"status": "error", "repo": repo, "error": r.json().get("message", "unknown")}


def enforce_branch_protection(repo: str, branch: str = "main", github_token: str = None, github_user: str = None) -> dict:
    """Enable branch protection on the default branch."""
    token, user = _get_token_and_user(github_token, github_user)
    r = requests.put(
        f"https://api.github.com/repos/{user}/{repo}/branches/{branch}/protection",
        headers=_headers(token),
        json={
            "required_status_checks":        None,
            "enforce_admins":                False,
            "required_pull_request_reviews": None,
            "restrictions":                  None,
            "allow_force_pushes":            False,
            "allow_deletions":               False
        },
        timeout=15
    )
    if r.status_code == 200:
        return {"status": "success", "repo": repo, "action": f"branch protection enabled on {branch}"}
    return {"status": "error", "repo": repo, "error": r.json().get("message", "unknown")}


if __name__ == "__main__":
    import json
    print("Scanning all repos for missing security baseline...\n")
    results = scan_all_repos()
    for r in results:
        status = "⚠️" if r["missing"] else "✅"
        print(f"{status} {r['repo']}: {', '.join(r['missing']) if r['missing'] else 'all good'}")
