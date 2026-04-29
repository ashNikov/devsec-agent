import os
import subprocess
import json
from dotenv import load_dotenv

load_dotenv()

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "devsec-agent-001")

def get_gcp_identity() -> dict:
    result = subprocess.run(
        ["gcloud", "auth", "list", "--format", "json"],
        capture_output=True, text=True, timeout=15
    )
    try:
        accounts = json.loads(result.stdout)
        active = [a for a in accounts if a.get("status") == "ACTIVE"]
        return {
            "active_account": active[0].get("account") if active else None,
            "total_accounts": len(accounts),
            "project": PROJECT_ID
        }
    except:
        return {"error": result.stderr[:200]}

def list_cloud_run_services() -> dict:
    result = subprocess.run(
        ["gcloud", "run", "services", "list",
         "--project", PROJECT_ID,
         "--format", "json"],
        capture_output=True, text=True, timeout=15
    )
    try:
        services = json.loads(result.stdout)
        return {
            "project": PROJECT_ID,
            "total": len(services),
            "services": [
                {
                    "name": s.get("metadata", {}).get("name"),
                    "region": s.get("metadata", {}).get("labels", {}).get("cloud.googleapis.com/location"),
                    "url": s.get("status", {}).get("url"),
                    "ingress": s.get("metadata", {}).get("annotations", {}).get("run.googleapis.com/ingress")
                }
                for s in services
            ]
        }
    except:
        return {"project": PROJECT_ID, "services": [], "total": 0, "raw": result.stdout[:200]}

def list_storage_buckets() -> dict:
    result = subprocess.run(
        ["gcloud", "storage", "buckets", "list",
         "--project", PROJECT_ID,
         "--format", "json"],
        capture_output=True, text=True, timeout=15
    )
    try:
        buckets = json.loads(result.stdout)
        return {
            "project": PROJECT_ID,
            "total": len(buckets),
            "buckets": [
                {
                    "name": b.get("name"),
                    "location": b.get("location"),
                    "public": b.get("iamConfiguration", {}).get("publicAccessPrevention") == "inherited"
                }
                for b in buckets
            ]
        }
    except:
        return {"project": PROJECT_ID, "buckets": [], "total": 0, "raw": result.stdout[:200]}

def check_iam_bindings() -> dict:
    result = subprocess.run(
        ["gcloud", "projects", "get-iam-policy", PROJECT_ID,
         "--format", "json"],
        capture_output=True, text=True, timeout=15
    )
    try:
        policy = json.loads(result.stdout)
        bindings = policy.get("bindings", [])
        risky = []
        for b in bindings:
            if "allUsers" in b.get("members", []) or "allAuthenticatedUsers" in b.get("members", []):
                risky.append({
                    "role": b.get("role"),
                    "members": b.get("members"),
                    "severity": "CRITICAL"
                })
        return {
            "project": PROJECT_ID,
            "total_bindings": len(bindings),
            "risky_bindings": risky,
            "risk_count": len(risky)
        }
    except:
        return {"project": PROJECT_ID, "error": result.stderr[:200]}

if __name__ == "__main__":
    print("=== GCP Identity ===")
    identity = get_gcp_identity()
    print(f"Active account: {identity.get('active_account')}")
    print(f"Project: {identity.get('project')}")

    print("\n=== GCP Cloud Run Services ===")
    services = list_cloud_run_services()
    print(f"Total services: {services['total']}")

    print("\n=== GCP Storage Buckets ===")
    buckets = list_storage_buckets()
    print(f"Total buckets: {buckets['total']}")

    print("\n=== IAM Risk Check ===")
    iam = check_iam_bindings()
    print(f"Total bindings: {iam.get('total_bindings')}")
    print(f"Risky bindings: {iam.get('risk_count')}")
