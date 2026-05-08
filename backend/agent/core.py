import os
import sys
import anthropic
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.trivy import scan_filesystem
from tools.github_tool import list_repos
from tools.slack import send_alert

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """
You are DevSec Agent — an autonomous DevSecOps AI assistant.
You monitor, analyze and remediate security and infrastructure issues
across GCP and GitHub projects.
When given a task:
1. Think step by step
2. Decide which tools to use
3. Analyze the results
4. Give a clear prioritized finding report
Always be specific — name the exact resource, project, or file with the issue.
"""

def run_full_scan(project_path: str = None) -> dict:
    """Run all scans and return real findings."""
    if not project_path:
        project_path = os.path.expanduser("~/projects/devsec-agent")

    results = {}

    # Run Gitleaks
    secrets = gitleaks_scan(project_path)
    results["secrets"] = secrets

    # Run Trivy
    vulns = scan_filesystem(project_path)
    results["vulnerabilities"] = vulns

    # Get repos
    repos = list_repos()
    results["repos"] = repos

    return results

def analyze_and_alert(project_path: str = None) -> str:
    """Brain runs scans, analyzes findings, sends Slack alerts."""
    scan_results = run_full_scan(project_path)

    secrets_count = scan_results["secrets"].get("total_secrets_found", 0)
    vuln_count = scan_results["vulnerabilities"].get("total", 0)
    critical_vulns = [
        f for f in scan_results["vulnerabilities"].get("findings", [])
        if f.get("severity") == "CRITICAL"
    ]

    # Build summary for brain
    summary = f"""
Scan completed. Here are the raw results:
- Secrets found: {secrets_count}
- Total vulnerabilities: {vuln_count}
- Critical vulnerabilities: {len(critical_vulns)}
- Repos monitored: {len(scan_results["repos"])}

Critical vulnerability details: {critical_vulns[:5]}
Secret findings: {scan_results["secrets"].get("findings", [])[:3]}

Analyze these findings and produce a prioritized security report.
"""

    # Brain analyzes results
    analysis = think(summary)

    # Send real Slack alerts based on findings
    if secrets_count > 0:
        send_alert(
            f"🔑 {secrets_count} secret(s) detected in scan — immediate rotation required!\n{analysis[:300]}",
            "CRITICAL"
        )
    elif len(critical_vulns) > 0:
        send_alert(
            f"⚠️ {len(critical_vulns)} CRITICAL vulnerabilities found across {vuln_count} total issues\n{analysis[:300]}",
            "HIGH"
        )
    else:
        send_alert(
            f"✅ Scan complete — {vuln_count} vulnerabilities found, no secrets detected\n{analysis[:300]}",
            "SUCCESS"
        )

    return analysis

def think(user_message: str, history: list = []) -> str:
    messages = history + [{"role": "user", "content": user_message}]
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages
    )
    return response.content[0].text

if __name__ == "__main__":
    print("🔍 AgentSec brain starting full scan...")
    result = analyze_and_alert()
    print(result)
