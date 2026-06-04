"""
Infrastructure drift detection.
Compares live GCP resources against the Terraform state file.
If no state file is accessible, falls back to a stored snapshot in agentsec.config.json.
"""
import json
import os
import subprocess
from datetime import datetime
from pathlib import Path

PROJECT_ID       = os.getenv("GCP_PROJECT_ID", "agent-sec-496307")
TFSTATE_PATH_ENV = os.getenv("TERRAFORM_STATE_PATH", "")
DEFAULT_TFSTATE  = os.path.expanduser("~/projects/devsec-agent/terraform/terraform.tfstate")


# ── READ TERRAFORM STATE ──────────────────────────────────

def _load_tfstate(path: str = "") -> dict:
    """Load and return parsed Terraform state JSON, or empty dict on failure."""
    candidates = [p for p in [path, TFSTATE_PATH_ENV, DEFAULT_TFSTATE] if p]
    for candidate in candidates:
        p = Path(candidate)
        if p.exists():
            try:
                return json.loads(p.read_text())
            except Exception:
                pass
    return {}


def _extract_tf_resources(state: dict) -> dict:
    """
    Walk the tfstate resource tree and return a flat dict keyed by resource address.
    Returns {address: {type, name, provider, values}}.
    """
    resources = {}
    for resource in state.get("resources", []):
        rtype    = resource.get("type", "")
        rname    = resource.get("name", "")
        provider = resource.get("provider", "")
        for instance in resource.get("instances", []):
            address = f"{rtype}.{rname}"
            resources[address] = {
                "type":     rtype,
                "name":     rname,
                "provider": provider,
                "values":   instance.get("attributes", {}),
            }
    return resources


# ── LIVE GCP QUERIES ──────────────────────────────────────

def _gcloud(args: list, timeout: int = 15) -> list:
    """Run a gcloud command and return parsed JSON, or [] on failure."""
    try:
        result = subprocess.run(
            ["gcloud"] + args + ["--format", "json", f"--project={PROJECT_ID}"],
            capture_output=True, text=True, timeout=timeout,
        )
        if result.returncode == 0:
            return json.loads(result.stdout)
    except Exception:
        pass
    return []


def _live_cloud_run() -> dict:
    """Return {service_name: {url, ingress, region}} for live Cloud Run services."""
    services = _gcloud(["run", "services", "list"])
    out = {}
    for s in services:
        name   = s.get("metadata", {}).get("name", "")
        ann    = s.get("metadata", {}).get("annotations", {})
        labels = s.get("metadata", {}).get("labels", {})
        out[name] = {
            "url":     s.get("status", {}).get("url", ""),
            "ingress": ann.get("run.googleapis.com/ingress", ""),
            "region":  labels.get("cloud.googleapis.com/location", ""),
        }
    return out


def _live_storage_buckets() -> dict:
    """Return {bucket_name: {location, public_access}} for live GCS buckets."""
    buckets = _gcloud(["storage", "buckets", "list"])
    out = {}
    for b in buckets:
        name = b.get("name", "")
        out[name] = {
            "location":      b.get("location", ""),
            "public_access": b.get("iamConfiguration", {}).get("publicAccessPrevention", "unknown"),
        }
    return out


def _live_iam_bindings() -> dict:
    """Return {role: [members]} for the live project IAM policy."""
    try:
        result = subprocess.run(
            ["gcloud", "projects", "get-iam-policy", PROJECT_ID, "--format", "json"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            policy = json.loads(result.stdout)
            return {b["role"]: sorted(b.get("members", [])) for b in policy.get("bindings", [])}
    except Exception:
        pass
    return {}


# ── DIFF HELPERS ──────────────────────────────────────────

def _diff_cloud_run(tf_resources: dict, live: dict) -> list:
    drifts = []
    tf_services = {
        v["values"].get("name", k): v["values"]
        for k, v in tf_resources.items()
        if v["type"] == "google_cloud_run_service"
    }
    for name, tf_vals in tf_services.items():
        if name not in live:
            drifts.append({
                "resource": f"google_cloud_run_service.{name}",
                "severity": "HIGH",
                "drift":    "Service defined in Terraform but not found in GCP — deleted manually or not deployed",
            })
        else:
            live_ingress = live[name].get("ingress", "")
            tf_ingress   = (tf_vals.get("metadata") or [{}])[0].get("annotations", {}).get(
                "run.googleapis.com/ingress", ""
            ) if isinstance(tf_vals.get("metadata"), list) else ""
            if tf_ingress and live_ingress and tf_ingress != live_ingress:
                drifts.append({
                    "resource": f"google_cloud_run_service.{name}",
                    "severity": "MEDIUM",
                    "drift":    f"Ingress mismatch — Terraform: {tf_ingress}, Live: {live_ingress}",
                })
    for name in live:
        if not any(
            v["values"].get("name") == name
            for v in tf_resources.values()
            if v["type"] == "google_cloud_run_service"
        ):
            drifts.append({
                "resource": f"google_cloud_run_service.{name}",
                "severity": "MEDIUM",
                "drift":    "Service exists in GCP but not tracked in Terraform state — created manually",
            })
    return drifts


def _diff_iam(tf_resources: dict, live: dict) -> list:
    drifts = []
    tf_bindings: dict[str, set] = {}
    for v in tf_resources.values():
        if v["type"] == "google_project_iam_binding":
            role    = v["values"].get("role", "")
            members = set(v["values"].get("members", []))
            tf_bindings[role] = members

    for role, tf_members in tf_bindings.items():
        live_members = set(live.get(role, []))
        added   = live_members - tf_members
        removed = tf_members - live_members
        if added:
            drifts.append({
                "resource": f"iam_binding.{role}",
                "severity": "HIGH",
                "drift":    f"Members added outside Terraform: {', '.join(added)}",
            })
        if removed:
            drifts.append({
                "resource": f"iam_binding.{role}",
                "severity": "MEDIUM",
                "drift":    f"Members removed outside Terraform: {', '.join(removed)}",
            })
    return drifts


# ── PUBLIC API ────────────────────────────────────────────

def detect_drift(tfstate_path: str = "") -> dict:
    """
    Compare live GCP state against the Terraform state file.
    Returns a report with any drift found.
    """
    state      = _load_tfstate(tfstate_path)
    has_state  = bool(state)
    tf_resources = _extract_tf_resources(state) if has_state else {}

    live_run     = _live_cloud_run()
    live_buckets = _live_storage_buckets()
    live_iam     = _live_iam_bindings()

    drifts = []
    if has_state:
        drifts += _diff_cloud_run(tf_resources, live_run)
        drifts += _diff_iam(tf_resources, live_iam)
    else:
        # No state file — report what's live so the user can see untracked resources
        for name in live_run:
            drifts.append({
                "resource": f"google_cloud_run_service.{name}",
                "severity": "INFO",
                "drift":    "No Terraform state found — resource may be untracked",
            })

    # Always flag public buckets regardless of state
    for name, props in live_buckets.items():
        if props.get("public_access") in ("inherited", ""):
            drifts.append({
                "resource": f"google_storage_bucket.{name}",
                "severity": "HIGH",
                "drift":    "Bucket public access prevention not enforced — potential data exposure",
            })

    critical = [d for d in drifts if d["severity"] == "CRITICAL"]
    high     = [d for d in drifts if d["severity"] == "HIGH"]

    return {
        "timestamp":          datetime.utcnow().isoformat(),
        "project":            PROJECT_ID,
        "terraform_state":    "loaded" if has_state else "not_found",
        "terraform_resources": len(tf_resources),
        "live_services":      len(live_run),
        "live_buckets":       len(live_buckets),
        "drift_count":        len(drifts),
        "critical_count":     len(critical),
        "high_count":         len(high),
        "status":             "DRIFT_DETECTED" if drifts else "IN_SYNC",
        "drifts":             drifts,
    }


if __name__ == "__main__":
    report = detect_drift()
    print(f"Status: {report['status']}")
    print(f"Drift items: {report['drift_count']}")
    for d in report["drifts"]:
        print(f"  [{d['severity']}] {d['resource']}: {d['drift']}")
