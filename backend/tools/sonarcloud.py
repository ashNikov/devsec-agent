import os
import requests

SONAR_TOKEN   = os.getenv("SONARCLOUD_TOKEN")
SONAR_ORG     = os.getenv("SONARCLOUD_ORG", "ashnikov")
SONAR_PROJECT = os.getenv("SONARCLOUD_PROJECT", "ashNikov_devsec-agent")
SONAR_BASE    = "https://sonarcloud.io/api"

def get_sonarcloud_status() -> dict:
    """Fetch quality gate status and issue counts from SonarCloud."""
    if not SONAR_TOKEN:
        return {"status": "unavailable", "reason": "no token"}

    headers = {"Authorization": f"Bearer {SONAR_TOKEN}"}

    try:
        # Quality gate status
        qg = requests.get(
            f"{SONAR_BASE}/qualitygates/project_status",
            params={"projectKey": SONAR_PROJECT},
            headers=headers,
            timeout=10
        )
        gate = qg.json().get("projectStatus", {})
        gate_status = gate.get("status", "UNKNOWN")

        # Issue counts
        issues = requests.get(
            f"{SONAR_BASE}/issues/search",
            params={
                "projectKeys": SONAR_PROJECT,
                "resolved": "false",
                "ps": 1
            },
            headers=headers,
            timeout=10
        )
        issue_data = issues.json()
        total_issues = issue_data.get("total", 0)

        # Security issues specifically
        sec_issues = requests.get(
            f"{SONAR_BASE}/issues/search",
            params={
                "projectKeys": SONAR_PROJECT,
                "resolved": "false",
                "types": "VULNERABILITY,SECURITY_HOTSPOT",
                "ps": 1
            },
            headers=headers,
            timeout=10
        )
        sec_data = sec_issues.json()
        security_count = sec_data.get("total", 0)

        return {
            "status": "active",
            "quality_gate": gate_status,
            "total_issues": total_issues,
            "security_issues": security_count,
            "project": SONAR_PROJECT,
            "dashboard_url": f"https://sonarcloud.io/summary/overall?id={SONAR_PROJECT}"
        }

    except Exception as e:
        return {"status": "unavailable", "reason": str(e)}
