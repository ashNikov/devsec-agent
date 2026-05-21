import os
import subprocess
import json
import httpx
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "agent-sec-496307")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

# ── 1. AUTO-ROTATE EXPOSED SECRETS ───────────────────────
def rotate_gcp_secret(secret_id: str, new_value: str) -> dict:
    """Add a new version of a GCP secret — effectively rotating it."""
    try:
        result = subprocess.run(
            ["gcloud", "secrets", "versions", "add", secret_id,
             "--project", PROJECT_ID, "--data-file=-"],
            input=new_value.encode(),
            capture_output=True, timeout=15
        )
        if result.returncode == 0:
            return {"status": "rotated", "secret": secret_id, "action": "new_version_added"}
        return {"status": "error", "secret": secret_id, "error": result.stderr.decode()[:200]}
    except Exception as e:
        return {"status": "error", "secret": secret_id, "error": str(e)}

def disable_leaked_secret_version(secret_id: str, version: str = "1") -> dict:
    """Disable an old/leaked version of a GCP secret."""
    try:
        result = subprocess.run(
            ["gcloud", "secrets", "versions", "disable", version,
             "--secret", secret_id, "--project", PROJECT_ID],
            capture_output=True, timeout=15
        )
        if result.returncode == 0:
            return {"status": "disabled", "secret": secret_id, "version": version}
        return {"status": "error", "error": result.stderr.decode()[:200]}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ── 2. AUTO-FIX IAM OVER-PERMISSIONS ─────────────────────
def remove_iam_binding(member: str, role: str) -> dict:
    """Remove a risky IAM binding from the GCP project."""
    try:
        result = subprocess.run(
            ["gcloud", "projects", "remove-iam-policy-binding", PROJECT_ID,
             "--member", member, "--role", role],
            capture_output=True, text=True, timeout=15
        )
        if result.returncode == 0:
            return {"status": "removed", "member": member, "role": role}
        return {"status": "error", "error": result.stderr[:200]}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def fix_risky_iam_bindings() -> dict:
    """Find and remove allUsers/allAuthenticatedUsers IAM bindings."""
    try:
        result = subprocess.run(
            ["gcloud", "projects", "get-iam-policy", PROJECT_ID, "--format", "json"],
            capture_output=True, text=True, timeout=15
        )
        policy = json.loads(result.stdout)
        bindings = policy.get("bindings", [])
        fixed = []
        for b in bindings:
            for member in b.get("members", []):
                if member in ["allUsers", "allAuthenticatedUsers"]:
                    fix = remove_iam_binding(member, b["role"])
                    fixed.append(fix)
        return {
            "status": "complete",
            "risky_bindings_found": len(fixed),
            "actions": fixed,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ── 3. AUTO-PATCH VULNERABLE DEPENDENCIES ────────────────
def create_dependency_patch_pr(repo: str, package: str, current: str, fixed: str) -> dict:
    """Open a GitHub PR that bumps a vulnerable dependency."""
    if not GITHUB_TOKEN:
        return {"status": "error", "error": "GITHUB_TOKEN not set"}
    try:
        headers = {
            "Authorization": f"Bearer {GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        }
        # Get default branch SHA
        import requests
        r = requests.get(f"https://api.github.com/repos/ashNikov/{repo}", headers=headers, timeout=10)
        repo_data = r.json()
        default_branch = repo_data.get("default_branch", "main")

        branch_name = f"agentsec/fix-{package}-{fixed}".replace(".", "-")

        return {
            "status": "ready",
            "repo": repo,
            "package": package,
            "current_version": current,
            "fixed_version": fixed,
            "branch": branch_name,
            "action": "PR creation requires write access — flagged for manual review",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ── 4. AUTO-HARDEN DOCKERFILES ────────────────────────────
def analyze_dockerfile(dockerfile_path: str) -> dict:
    """Scan a Dockerfile for common security misconfigurations."""
    issues = []
    fixes = []
    try:
        with open(dockerfile_path, "r") as f:
            lines = f.readlines()

        for i, line in enumerate(lines):
            line = line.strip()
            # Check for root user
            if line.startswith("USER root") or (line.startswith("FROM") and "USER" not in "".join(lines)):
                issues.append({"line": i+1, "issue": "Container may run as root", "severity": "HIGH"})
                fixes.append("Add: USER nonroot (create with: RUN adduser --disabled-password --gecos '' nonroot)")

            # Check for latest tag
            if line.startswith("FROM") and ":latest" in line:
                issues.append({"line": i+1, "issue": "Using :latest tag — not reproducible", "severity": "MEDIUM"})
                fixes.append(f"Pin the image version: {line.replace(':latest', ':<specific-version>')}")

            # Check for ADD instead of COPY
            if line.startswith("ADD ") and "http" not in line:
                issues.append({"line": i+1, "issue": "Use COPY instead of ADD for local files", "severity": "LOW"})
                fixes.append(line.replace("ADD ", "COPY "))

            # Check for secrets in ENV
            for secret_keyword in ["PASSWORD", "SECRET", "API_KEY", "TOKEN"]:
                if line.startswith("ENV") and secret_keyword in line:
                    issues.append({"line": i+1, "issue": f"Potential secret in ENV: {secret_keyword}", "severity": "CRITICAL"})
                    fixes.append("Use --secret flag or runtime env injection instead of ENV for secrets")

        return {
            "dockerfile": dockerfile_path,
            "issues_found": len(issues),
            "issues": issues,
            "recommended_fixes": fixes,
            "timestamp": datetime.utcnow().isoformat()
        }
    except FileNotFoundError:
        return {"status": "error", "error": f"Dockerfile not found: {dockerfile_path}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

# ── 5. REMEDIATION REPORT ─────────────────────────────────
def generate_remediation_report(actions: list) -> dict:
    """Summarize all remediation actions taken."""
    return {
        "report_type": "remediation_summary",
        "generated_at": datetime.utcnow().isoformat(),
        "total_actions": len(actions),
        "actions": actions,
        "status": "complete"
    }

if __name__ == "__main__":
    print("=== Dockerfile Analysis ===")
    result = analyze_dockerfile("../Dockerfile")
    print(json.dumps(result, indent=2))

    print("\n=== IAM Check ===")
    iam = fix_risky_iam_bindings()
    print(json.dumps(iam, indent=2))
