import subprocess
import json
import os

def scan_repo_for_secrets(repo_path: str) -> dict:
    result = subprocess.run(
        ["gitleaks", "detect", "--source", repo_path,
         "--report-format", "json", "--report-path", "/tmp/gitleaks_report.json",
         "--gitleaks-ignore-path", os.path.expanduser("~/projects/devsec-agent/.gitleaksignore")],
        capture_output=True,
        text=True
    )
    try:
        with open("/tmp/gitleaks_report.json", "r") as f:
            findings = json.load(f)
    except:
        findings = []

    return {
        "path_scanned": repo_path,
        "total_secrets_found": len(findings),
        "findings": findings
    }

if __name__ == "__main__":
    repo_path = os.path.expanduser("~/projects/devsec-agent")
    result = scan_repo_for_secrets(repo_path)
    print(f"Scanning: {result['path_scanned']}")
    print(f"Secrets found: {result['total_secrets_found']}")
    for f in result['findings']:
        print(f"  - {f.get('Description')} in {f.get('File')}")
