from db.models import SessionLocal, ScanResult, RemediationAction, RepoPattern
from datetime import datetime

def save_scan_result(repo: str, secrets: int, vulns: int, critical: int,
                     org_id: int = None, user_id: int = None,
                     brain_winner: str = None, brain_score: float = None,
                     tokens: int = 0, analysis: str = None) -> ScanResult:
    """Save a scan result to the database."""
    db = SessionLocal()
    try:
        result = ScanResult(
            repo=repo, org_id=org_id, user_id=user_id,
            secrets_found=secrets, vulns_found=vulns,
            critical_count=critical, brain_winner=brain_winner,
            brain_score=brain_score, tokens_used=tokens, analysis=analysis
        )
        db.add(result)
        db.commit()
        db.refresh(result)

        # Update repo patterns
        _update_pattern(db, repo, "secrets", secrets > 0)
        if critical > 0:
            _update_pattern(db, repo, "critical_vulns", True)
        return result
    finally:
        db.close()

def save_remediation(repo: str, action: str, approved_by: str = None,
                     success: bool = True, details: str = None):
    """Log a remediation action."""
    db = SessionLocal()
    try:
        record = RemediationAction(
            repo=repo, action=action, approved_by=approved_by,
            success=success, details=details
        )
        db.add(record)
        db.commit()
    finally:
        db.close()

def get_scan_history(repo: str = None, limit: int = 20, org_id: int = None) -> list:
    """Get recent scan history, optionally filtered by repo."""
    db = SessionLocal()
    try:
        q = db.query(ScanResult).order_by(ScanResult.scanned_at.desc())
        if org_id:
            q = q.filter(ScanResult.org_id == org_id)
        if repo:
            q = q.filter(ScanResult.repo == repo)
        results = q.limit(limit).all()
        return [
            {
                "id": r.id, "repo": r.repo,
                "scanned_at": str(r.scanned_at),
                "secrets_found": r.secrets_found,
                "vulns_found": r.vulns_found,
                "critical_count": r.critical_count,
                "brain_winner": r.brain_winner,
                "brain_score": r.brain_score,
                "tokens_used": r.tokens_used,
                "status": r.status
            }
            for r in results
        ]
    finally:
        db.close()

def get_repo_trends(repo: str) -> dict:
    """Get trend data for a repo — is it getting better or worse?"""
    db = SessionLocal()
    try:
        scans = db.query(ScanResult).filter(
            ScanResult.repo == repo
        ).order_by(ScanResult.scanned_at.desc()).limit(5).all()

        if len(scans) < 2:
            return {"trend": "insufficient_data", "scans": len(scans)}

        latest  = scans[0].critical_count
        previous = scans[1].critical_count

        if latest < previous:   trend = "IMPROVING"
        elif latest > previous: trend = "WORSENING"
        else:                   trend = "STABLE"

        return {
            "repo": repo, "trend": trend,
            "latest_critical": latest,
            "previous_critical": previous,
            "total_scans": len(scans)
        }
    finally:
        db.close()

def _update_pattern(db, repo: str, finding_type: str, found: bool):
    """Track recurring patterns per repo."""
    if not found:
        return
    pattern = db.query(RepoPattern).filter(
        RepoPattern.repo == repo,
        RepoPattern.finding_type == finding_type
    ).first()
    if pattern:
        pattern.occurrence_count += 1
        pattern.last_seen = datetime.utcnow()
    else:
        db.add(RepoPattern(repo=repo, finding_type=finding_type))
    db.commit()
