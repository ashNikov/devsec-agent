import json
import os
import uuid
from datetime import datetime

SESSIONS_FILE = os.path.expanduser("~/projects/devsec-agent/sessions.json")


def _load() -> list:
    if not os.path.exists(SESSIONS_FILE):
        return []
    try:
        with open(SESSIONS_FILE, "r") as f:
            return json.load(f)
    except Exception:
        return []


def _save(sessions: list) -> None:
    with open(SESSIONS_FILE, "w") as f:
        json.dump(sessions, f, indent=2, default=str)


def start_session(user: str, repo: str = None, scan_type: str = "manual") -> dict:
    """Create a new session entry and persist it."""
    session = {
        "id":         str(uuid.uuid4())[:8],
        "user":       user,
        "repo":       repo or "—",
        "scan_type":  scan_type,
        "started_at": datetime.utcnow().isoformat(),
        "ended_at":   None,
        "duration_s": None,
        "status":     "active",
        "findings":   None,
    }
    sessions = _load()
    sessions.insert(0, session)
    # Keep last 200 sessions only
    _save(sessions[:200])
    return session


def end_session(session_id: str, status: str = "completed", findings: int = 0) -> dict:
    """Close an open session and record its result."""
    sessions = _load()
    for s in sessions:
        if s["id"] == session_id:
            ended_at = datetime.utcnow()
            started_at = datetime.fromisoformat(s["started_at"])
            s["ended_at"]   = ended_at.isoformat()
            s["duration_s"] = round((ended_at - started_at).total_seconds())
            s["status"]     = status
            s["findings"]   = findings
            _save(sessions)
            return s
    return {"error": f"Session {session_id} not found"}


def get_sessions(limit: int = 50) -> list:
    """Return most recent sessions."""
    return _load()[:limit]
