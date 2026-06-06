import os
from github import Github
from dotenv import load_dotenv

load_dotenv()

def get_github_client():
    token = os.getenv("GITHUB_TOKEN")
    return Github(token)

def list_repos(username: str = "ashNikov", github_token: str = None) -> list:
    from github import Github
    g = Github(github_token) if github_token else get_github_client()
    user = g.get_user(username)
    repos = []
    for repo in user.get_repos():
        repos.append({
            "name": repo.full_name,
            "private": repo.private,
            "url": repo.html_url,
            "default_branch": repo.default_branch,
            "updated_at": str(repo.updated_at)
        })
    return repos

def scan_repo_for_secrets(repo_name: str, username: str = "ashNikov", max_seconds: int = 15, github_token: str = None) -> dict:
    from github import Github
    g = Github(github_token) if github_token else get_github_client()
    full_name = repo_name if "/" in repo_name else f"{username}/{repo_name}"
    repo = g.get_repo(full_name)
    findings = []
    secret_keywords = [
        "api_key", "secret", "password", "token",
        "private_key", "access_key", "credentials"
    ]
    import threading
    files_checked = 0
    MAX_FILES = 30  # Never scan more than 30 files per repo
    # Skip repos with large codebases — Gitleaks covers these locally
    SKIP_REPOS = ["parts-unlimited", "price-transparency"]
    if repo_name in SKIP_REPOS:
        return {"repo": repo_name, "findings": [], "total": 0, "files_checked": 0, "skipped": True}
    try:
        contents = repo.get_contents("")
    except Exception:
        return {"repo": repo_name, "findings": [], "total": 0, "files_checked": 0}
    while contents and files_checked < MAX_FILES:
        file = contents.pop(0)
        if file.type == "dir":
            # Skip heavy dirs
            if file.name in ("node_modules", "venv", ".next", "__pycache__", ".git"):
                continue
            contents.extend(repo.get_contents(file.path))
        else:
            if file.name.endswith((".env", ".json", ".yml", ".yaml", ".py")):
                files_checked += 1
                try:
                    content = file.decoded_content.decode("utf-8").lower()
                    for keyword in secret_keywords:
                        if keyword in content:
                            findings.append({
                                "file": file.path,
                                "keyword_found": keyword,
                                "severity": "HIGH"
                            })
                except:
                    pass
    return {
        "repo": repo_name,
        "findings": findings,
        "total": len(findings),
        "files_checked": files_checked
    }

if __name__ == "__main__":
    print("=== Your GitHub Repos ===")
    repos = list_repos()
    for r in repos:
        print(f"- {r['name']} ({'private' if r['private'] else 'public'})")
