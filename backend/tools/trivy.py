import subprocess
import json

def scan_image(image_name: str) -> dict:
    result = subprocess.run(
        ["trivy", "image", "--format", "json", "--quiet", image_name],
        capture_output=True,
        text=True
    )
    try:
        data = json.loads(result.stdout)
        vulnerabilities = []
        for r in data.get("Results", []):
            for v in r.get("Vulnerabilities", []) or []:
                vulnerabilities.append({
                    "id": v.get("VulnerabilityID"),
                    "severity": v.get("Severity"),
                    "package": v.get("PkgName"),
                    "installed_version": v.get("InstalledVersion"),
                    "fixed_version": v.get("FixedVersion"),
                    "title": v.get("Title")
                })
        critical = [v for v in vulnerabilities if v["severity"] == "CRITICAL"]
        high = [v for v in vulnerabilities if v["severity"] == "HIGH"]
        return {
            "image": image_name,
            "total": len(vulnerabilities),
            "critical": len(critical),
            "high": len(high),
            "findings": vulnerabilities[:20]
        }
    except Exception as e:
        return {"image": image_name, "error": str(e), "raw": result.stdout[:500]}

def scan_filesystem(path: str) -> dict:
    result = subprocess.run(
        ["trivy", "fs", "--format", "json", "--quiet", path],
        capture_output=True,
        text=True
    )
    try:
        data = json.loads(result.stdout)
        vulnerabilities = []
        for r in data.get("Results", []):
            for v in r.get("Vulnerabilities", []) or []:
                vulnerabilities.append({
                    "id": v.get("VulnerabilityID"),
                    "severity": v.get("Severity"),
                    "package": v.get("PkgName"),
                    "title": v.get("Title")
                })
        return {
            "path": path,
            "total": len(vulnerabilities),
            "findings": vulnerabilities[:20]
        }
    except Exception as e:
        return {"path": path, "error": str(e)}

if __name__ == "__main__":
    print("=== Scanning project filesystem ===")
    result = scan_filesystem("/home/ashnikov/projects/devsec-agent")
    print(f"Path: {result['path']}")
    print(f"Total vulnerabilities: {result['total']}")
    for f in result.get("findings", [])[:5]:
        print(f"  - [{f['severity']}] {f['package']}: {f['title']}")
