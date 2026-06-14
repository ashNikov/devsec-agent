from db.encryption import decrypt_token
import os
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# ── SCHEDULED SCAN JOB ───────────────────────────────────
def run_scheduled_scan(org_id: int = None):
    """Full scan job — runs on schedule, alerts Slack."""
    try:
        from agent.core import analyze_and_alert
        logger.info(f"[SCHEDULER] Starting scheduled scan at {datetime.utcnow().isoformat()}")
        result = analyze_and_alert(org_id=org_id)
        logger.info(f"[SCHEDULER] Scan complete: {str(result)[:200]}")
        return result
    except Exception as e:
        logger.error(f"[SCHEDULER] Scan failed: {e}")
        return {"status": "error", "error": str(e)}


# ── REPO SYNC JOB ────────────────────────────────────────
def run_repo_sync():
    """Sync repos for all orgs with active GitHub integrations."""
    try:
        import asyncio
        from db.models import SessionLocal, Integration, Organization, UserRepo
        logger.info("[REPO SYNC] Starting repo sync for all orgs")
        import httpx

        db = SessionLocal()
        try:
            integrations = db.query(Integration).filter(
                Integration.provider == "github",
                Integration.is_active == True,
            ).all()
            logger.info(f"[REPO SYNC] Found {len(integrations)} active GitHub integrations")

            for intg in integrations:
                if not intg.access_token_encrypted:
                    continue
                org_id = intg.org_id
                org = db.query(Organization).filter(Organization.id == org_id).first()
                plan = org.plan if org else "free"
                MAX_REPOS = 1 if plan == "free" else 999

                try:
                    resp = httpx.get(
                        "https://api.github.com/user/repos?per_page=100&sort=updated&type=owner",
                        headers={
                            "Authorization": f"Bearer {decrypt_token(intg.access_token_encrypted)}",
                            "Accept": "application/vnd.github.v3+json",
                        },
                        timeout=10,
                    )
                    if resp.status_code != 200:
                        logger.warning(f"[REPO SYNC] GitHub API error for org {org_id}: {resp.status_code}")
                        continue

                    github_repos = {r["full_name"]: r for r in resp.json() if isinstance(r, dict)}
                    db_repos = db.query(UserRepo).filter(UserRepo.org_id == org_id).all()
                    db_repo_names = {r.repo_name: r for r in db_repos}
                    added = 0

                    for name, repo_data in github_repos.items():
                        if name in db_repo_names:
                            if not db_repo_names[name].is_active:
                                db_repo_names[name].is_active = True
                                added += 1
                        else:
                            active_count = sum(1 for r in db_repos if r.is_active)
                            if active_count >= MAX_REPOS:
                                break
                            db.add(UserRepo(
                                org_id=org_id,
                                repo_name=name,
                                repo_url=repo_data.get("html_url", ""),
                                is_active=True,
                                is_private=repo_data.get("private", False),
                            ))
                            added += 1

                    # Deactivate repos no longer on GitHub
                    deactivated = 0
                    for name, repo in db_repo_names.items():
                        if name not in github_repos and repo.is_active:
                            repo.is_active = False
                            deactivated += 1

                    if added > 0 or deactivated > 0:
                        db.commit()
                        logger.info(f"[REPO SYNC] Org {org_id} — {added} added/reactivated, {deactivated} deactivated")

                except Exception as e:
                    logger.error(f"[REPO SYNC] Error syncing org {org_id}: {e}")
                    continue

        finally:
            db.close()

        logger.info("[REPO SYNC] Complete")
    except Exception as e:
        logger.error(f"[REPO SYNC] Job failed: {e}")

# ── SCHEDULER SETUP ──────────────────────────────────────
_scheduler = BackgroundScheduler()

SCAN_INTERVAL_HOURS = int(os.getenv("SCAN_INTERVAL_HOURS", "6"))

def start_scheduler():
    """Start the background scheduler."""
    if _scheduler.running:
        logger.info("[SCHEDULER] Already running")
        return

    _scheduler.add_job(
        run_scheduled_scan,
        trigger=IntervalTrigger(hours=SCAN_INTERVAL_HOURS),
        id="scheduled_scan",
        name="AgentSec Scheduled Security Scan",
        replace_existing=True,
        max_instances=1,  # Never run two scans simultaneously
    )
    _scheduler.add_job(
        run_repo_sync,
        trigger=IntervalTrigger(minutes=2),
        id="repo_sync",
        name="AgentSec Repo Sync",
        replace_existing=True,
        max_instances=1,
    )
    _scheduler.start()
    logger.info(f"[SCHEDULER] Started — scanning every {SCAN_INTERVAL_HOURS} hours")

def stop_scheduler():
    """Stop the scheduler cleanly."""
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("[SCHEDULER] Stopped")

def get_scheduler_status() -> dict:
    """Return current scheduler state."""
    if not _scheduler.running:
        return {"status": "stopped", "jobs": []}

    jobs = []
    for job in _scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "name": job.name,
            "next_run": str(job.next_run_time),
            "interval_hours": SCAN_INTERVAL_HOURS
        })
    return {
        "status": "running",
        "jobs": jobs,
        "scan_interval_hours": SCAN_INTERVAL_HOURS
    }

def trigger_manual_scan(org_id: int = None) -> dict:
    """Trigger an immediate scan outside the schedule."""
    logger.info("[SCHEDULER] Manual scan triggered")
    result = run_scheduled_scan(org_id=org_id)
    return {"triggered": True, "result": result}
