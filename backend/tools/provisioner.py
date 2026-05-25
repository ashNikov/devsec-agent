import os
import requests
from dotenv import load_dotenv

load_dotenv()

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_USER  = "ashNikov"
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}

def check_repo_has_workflow(repo: str) -> bool:
    """Check if repo has any GitHub Actions workflow files."""
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_USER}/{repo}/contents/.github/workflows",
        headers=HEADERS, timeout=10
    )
    return r.status_code == 200

def check_repo_has_gitignore(repo: str) -> bool:
    """Check if repo has a .gitignore at root."""
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_USER}/{repo}/contents/.gitignore",
        headers=HEADERS, timeout=10
    )
    return r.status_code == 200

def check_branch_protection(repo: str, branch: str = "main") -> bool:
    """Check if branch protection is enabled."""
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_USER}/{repo}/branches/{branch}/protection",
        headers=HEADERS, timeout=10
    )
    return r.status_code == 200

def check_repo_has_dockerfile(repo: str) -> bool:
    """Check if repo has a Dockerfile at root."""
    r = requests.get(
        f"https://api.github.com/repos/{GITHUB_USER}/{repo}/contents/Dockerfile",
        headers=HEADERS, timeout=10
    )
    return r.status_code == 200

def scan_all_repos() -> list:
    """Scan all repos and return a findings report."""
    r = requests.get(
        f"https://api.github.com/users/{GITHUB_USER}/repos?per_page=50",
        headers=HEADERS, timeout=15
    )
    repos = r.json()
    findings = []

    for repo in repos:
        name = repo["name"]
        default_branch = repo.get("default_branch", "main")
        missing = []

        if not check_repo_has_workflow(name):
            missing.append("CI/CD pipeline")
        if not check_repo_has_gitignore(name):
            missing.append(".gitignore")
        if not check_branch_protection(name, default_branch):
            missing.append("branch protection")
        if not check_repo_has_dockerfile(name):
            missing.append("Dockerfile")

        findings.append({
            "repo": name,
            "default_branch": default_branch,
            "private": repo["private"],
            "missing": missing,
            "score": len(missing),
            "status": "NEEDS_ATTENTION" if missing else "COMPLIANT"
        })

    findings.sort(key=lambda x: x["score"], reverse=True)
    return findings

if __name__ == "__main__":
    import json
    print("Scanning all repos for missing security baseline...\n")
    results = scan_all_repos()
    for r in results:
        status = "⚠️" if r["missing"] else "✅"
        print(f"{status} {r['repo']}: {', '.join(r['missing']) if r['missing'] else 'all good'}")
