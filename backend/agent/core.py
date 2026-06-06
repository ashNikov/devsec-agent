import os
import sys
import anthropic
from dotenv import load_dotenv

load_dotenv()

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tools.gitleaks import scan_repo_for_secrets as gitleaks_scan
from tools.trivy import scan_filesystem
from tools.github_tool import list_repos, scan_repo_for_secrets as github_scan_repo
from tools.slack import send_alert
from agent.multi_brain import multi_brain_analyze
from db.repository import save_scan_result

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
    """Run all scans across ALL repos and return aggregated findings."""
    if not project_path:
        project_path = os.path.expanduser("~/projects/devsec-agent")

    results = {}

    # ── GET ALL REPOS ─────────────────────────────────────
    repos = list_repos()
    results["repos"] = repos

    # ── MULTI-REPO SECRET SCAN ────────────────────────────
    # Scan every repo via GitHub API — scales to any number of repos
    all_secret_findings = []
    repo_scan_summary = []

    for repo in repos:
        try:
            repo_result = github_scan_repo(repo["name"], github_token=github_token)
            findings = repo_result.get("findings", [])
            all_secret_findings.extend(findings)
            repo_scan_summary.append({
                "repo": repo["name"],
                "secrets_found": len(findings),
                "status": "scanned"
            })
        except Exception as e:
            repo_scan_summary.append({
                "repo": repo["name"],
                "secrets_found": 0,
                "status": f"error: {str(e)[:60]}"
            })

    results["secrets"] = {
        "total_secrets_found": len(all_secret_findings),
        "findings": all_secret_findings,
        "repos_scanned": len(repos),
        "repo_summary": repo_scan_summary
    }

    # ── TRIVY FILESYSTEM SCAN ─────────────────────────────
    # Scans local devsec-agent repo for vulns + Docker image issues
    vulns = scan_filesystem(project_path)
    results["vulnerabilities"] = vulns

    # ── GITLEAKS DEEP SCAN ────────────────────────────────
    # Deep local scan on devsec-agent repo
    gitleaks_result = gitleaks_scan(project_path)
    results["gitleaks"] = gitleaks_result

    return results

def analyze_and_alert(project_path: str = None, org_id: int = None) -> str:
    """Brain runs scans across all repos, analyzes findings, sends Slack alerts."""
    scan_results = run_full_scan(project_path, org_id=org_id)

    secrets_count = scan_results["secrets"].get("total_secrets_found", 0)
    vuln_count    = scan_results["vulnerabilities"].get("total", 0)
    repos_count   = len(scan_results["repos"])
    critical_vulns = [
        f for f in scan_results["vulnerabilities"].get("findings", [])
        if f.get("severity") == "CRITICAL"
    ]

    # Build per-repo summary for Slack
    repo_summary_lines = []
    for r in scan_results["secrets"].get("repo_summary", []):
        if r["secrets_found"] > 0:
            repo_summary_lines.append(f"  ⚠️  {r['repo']}: {r['secrets_found']} secret(s)")
        else:
            repo_summary_lines.append(f"  ✅ {r['repo']}: clean")
    repo_summary_text = "\n".join(repo_summary_lines)

    # Build summary for Claude brain
    summary = f"""
Multi-repo scan completed across {repos_count} repositories.

RESULTS:
- Total secrets found: {secrets_count}
- Total vulnerabilities: {vuln_count}
- Critical vulnerabilities: {len(critical_vulns)}
- Repos scanned: {repos_count}

PER-REPO SECRET SCAN:
{repo_summary_text}

Critical vulnerability details: {critical_vulns[:5]}
Secret findings sample: {scan_results["secrets"].get("findings", [])[:3]}

Analyze these findings and produce a prioritized security report.
Include which repos need immediate attention.
"""

    # Multi-brain analyzes results
    verdict = multi_brain_analyze(summary)
    analysis = verdict["analysis"]

    # ── SLACK ALERTS ──────────────────────────────────────
    if secrets_count > 0:
        send_alert(
            f"🔑 *AgentSec Multi-Repo Scan Complete*\n"
            f"*{secrets_count} secret(s)* detected across {repos_count} repos!\n\n"
            f"*Per-repo breakdown:*\n{repo_summary_text}\n\n"
            f"*Analysis:*\n{analysis[:400]}",
            "CRITICAL"
        )
    elif len(critical_vulns) > 0:
        send_alert(
            f"⚠️ *AgentSec Multi-Repo Scan Complete*\n"
            f"*{len(critical_vulns)} CRITICAL* vulns across {repos_count} repos\n"
            f"{vuln_count} total vulnerabilities\n\n"
            f"*Analysis:*\n{analysis[:400]}",
            "HIGH"
        )
    else:
        send_alert(
            f"✅ *AgentSec Multi-Repo Scan Complete*\n"
            f"{repos_count} repos scanned — {vuln_count} vulns, no secrets\n\n"
            f"*Analysis:*\n{analysis[:400]}",
            "SUCCESS"
        )

    # Save to scan history database
    try:
        save_scan_result(
            repo="agentsec",
            secrets=secrets_count,
            vulns=vuln_count,
            critical=len(critical_vulns),
            brain_winner=verdict.get("winner"),
            brain_score=verdict.get("winner_score"),
            tokens=verdict.get("total_tokens", 0),
            analysis=analysis[:1000]
        )
    except Exception as e:
        pass  # Never let DB errors break the scan

    return analysis

def think(user_message: str, history: list = []) -> str:
    messages = history + [{"role": "user", "content": user_message}]
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages
    )
    return response.content[0].text

if __name__ == "__main__":
    print("🔍 AgentSec multi-repo scan starting...")
    result = analyze_and_alert()
    print(result)
