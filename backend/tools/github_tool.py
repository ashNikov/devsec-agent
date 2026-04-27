import os
from github import Github
from dotenv import load_dotenv

load_dotenv()

def get_github_client():
    token = os.getenv("GITHUB_TOKEN")
    return Github(token)

def list_repos(username: str = "ashNikov") -> list:
    g = get_github_client()
    user = g.get_user(username)
    repos = []
    for repo in user.get_repos():
        repos.append({
            "name": repo.name,
            "private": repo.private,
            "url": repo.html_url,
            "default_branch": repo.default_branch,
            "updated_at": str(repo.updated_at)
        })
    return repos

def scan_repo_for_secrets(repo_name: str, username: str = "ashNikov") -> dict:
    g = get_github_client()
    repo = g.get_repo(f"{username}/{repo_name}")
    findings = []
    secret_keywords = [
        "api_key", "secret", "password", "token",
        "private_key", "access_key", "credentials"
    ]
    contents = repo.get_contents("")
    while contents:
        file = contents.pop(0)
        if file.type == "dir":
            contents.extend(repo.get_contents(file.path))
        else:
            if file.name.endswith((".env", ".json", ".yml", ".yaml", ".py")):
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
        "total": len(findings)
    }

if __name__ == "__main__":
    print("=== Your GitHub Repos ===")
    repos = list_repos()
    for r in repos:
        print(f"- {r['name']} ({'private' if r['private'] else 'public'})")
