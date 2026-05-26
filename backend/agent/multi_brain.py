import os
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ── BRAIN DEFINITIONS ─────────────────────────────────────
BRAIN_A = "claude-haiku-4-5-20251001"    # Fast, cheap pre-filter
BRAIN_B = "claude-sonnet-4-20250514"     # Deep analysis

SYSTEM_PROMPT = """You are a DevSecOps security analyst.
Analyze the scan results and produce a prioritized security report.
Focus ONLY on: exposed secrets and cloud misconfigurations.
Be specific — name exact files, repos, or resources.
Format your response as:
CRITICAL: <list critical issues>
HIGH: <list high issues>
REMEDIATION: <specific fix steps>
CONFIDENCE: <HIGH/MEDIUM/LOW>"""

def run_brain(model: str, scan_summary: str) -> dict:
    """Run a single brain against scan results."""
    try:
        response = client.messages.create(
            model=model,
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": f"Analyze these scan results:\n\n{scan_summary}"}]
        )
        text = response.content[0].text
        return {
            "model": model,
            "response": text,
            "tokens": response.usage.input_tokens + response.usage.output_tokens,
            "status": "success"
        }
    except Exception as e:
        return {"model": model, "response": "", "tokens": 0, "status": "error", "error": str(e)}

def judge(brain_a: dict, brain_b: dict) -> dict:
    """
    Pure Python judge — no AI bias, no extra API cost.
    Scores both brains and returns the winner.
    Scoring: severity coverage 40%, remediation specificity 35%, confidence 25%
    """
    def score_response(result: dict) -> float:
        if result["status"] != "success":
            return 0.0
        text = result["response"].upper()
        score = 0.0

        # Severity coverage (40%)
        severity_score = 0.0
        if "CRITICAL:" in text: severity_score += 0.5
        if "HIGH:" in text: severity_score += 0.3
        if "MEDIUM:" in text or "LOW:" in text: severity_score += 0.2
        score += severity_score * 0.40

        # Remediation specificity (35%)
        remediation_score = 0.0
        if "REMEDIATION:" in text: remediation_score += 0.4
        if any(w in text for w in ["ROTATE", "REVOKE", "UPDATE", "PATCH", "FIX"]):
            remediation_score += 0.4
        if any(w in text for w in ["GCP", "GITHUB", "SECRET", "IAM", "TOKEN"]):
            remediation_score += 0.2
        score += remediation_score * 0.35

        # Confidence (25%)
        confidence_score = 0.0
        if "CONFIDENCE: HIGH" in text: confidence_score = 1.0
        elif "CONFIDENCE: MEDIUM" in text: confidence_score = 0.6
        elif "CONFIDENCE: LOW" in text: confidence_score = 0.3
        score += confidence_score * 0.25

        return round(score, 3)

    score_a = score_response(brain_a)
    score_b = score_response(brain_b)

    winner = brain_b if score_b >= score_a else brain_a
    loser  = brain_a if score_b >= score_a else brain_b

    return {
        "winner":       winner["model"],
        "winner_score": max(score_a, score_b),
        "loser_score":  min(score_a, score_b),
        "analysis":     winner["response"],
        "brain_a":      {"model": brain_a["model"], "score": score_a, "tokens": brain_a["tokens"]},
        "brain_b":      {"model": brain_b["model"], "score": score_b, "tokens": brain_b["tokens"]},
        "total_tokens": brain_a["tokens"] + brain_b["tokens"]
    }

def multi_brain_analyze(scan_summary: str) -> dict:
    """
    Run both brains sequentially, judge the results.
    Brain A runs first — if it finds nothing, Brain B is skipped (cost optimization).
    """
    print(f"[BRAIN A] Running {BRAIN_A}...")
    result_a = run_brain(BRAIN_A, scan_summary)

    # Cost optimization — only run Brain B if Brain A found something
    text_a = result_a["response"].upper()
    if result_a["status"] == "success" and ("CRITICAL:" in text_a or "CRITICAL" in text_a):
        print(f"[BRAIN B] Findings detected — running {BRAIN_B} for deep analysis...")
        result_b = run_brain(BRAIN_B, scan_summary)
    else:
        print(f"[BRAIN B] No critical findings from Brain A — skipping to save tokens")
        result_b = {"model": BRAIN_B, "response": result_a["response"], "tokens": 0, "status": "skipped"}

    verdict = judge(result_a, result_b)
    verdict["brain_b_skipped"] = result_b["status"] == "skipped"
    return verdict

if __name__ == "__main__":
    test_summary = """
    Scan results:
    - 48 secrets detected across 6 repos
    - 3 CRITICAL: API keys exposed in ashflix, footyiq-saas
    - 2 HIGH vulnerabilities in python-dotenv
    - GCP IAM: 0 risky bindings
    - Branch protection: enforced on all repos
    """
    print("Running multi-brain analysis...\n")
    result = multi_brain_analyze(test_summary)
    print(f"\nWINNER: {result['winner']} (score: {result['winner_score']})")
    print(f"Total tokens used: {result['total_tokens']}")
    print(f"\nAnalysis:\n{result['analysis']}")
