import os
import logging
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# ── SCHEDULED SCAN JOB ───────────────────────────────────
def run_scheduled_scan():
    """Full scan job — runs on schedule, alerts Slack."""
    try:
        from agent.core import analyze_and_alert
        logger.info(f"[SCHEDULER] Starting scheduled scan at {datetime.utcnow().isoformat()}")
        result = analyze_and_alert()
        logger.info(f"[SCHEDULER] Scan complete: {str(result)[:200]}")
        return result
    except Exception as e:
        logger.error(f"[SCHEDULER] Scan failed: {e}")
        return {"status": "error", "error": str(e)}

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

def trigger_manual_scan() -> dict:
    """Trigger an immediate scan outside the schedule."""
    logger.info("[SCHEDULER] Manual scan triggered")
    result = run_scheduled_scan()
    return {"triggered": True, "result": result}
