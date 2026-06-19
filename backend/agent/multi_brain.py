import os
import anthropic
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# -- GEMINI (Brain A primary) -------------------------------------------------
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    print("[BRAIN A] WARNING: GEMINI_API_KEY not set - Brain A will fall back to Haiku")
GEMINI_MODEL = "gemini-2.5-flash"

# -- BRAIN DEFINITIONS --------------------------------------------------------
BRAIN_A = "claude-haiku-4-5-20251001"    # Fast, cheap pre-filter
BRAIN_B = "claude-sonnet-4-5-20250929"     # Deep analysis

SYSTEM_PROMPT = """You are a DevSecOps security analyst.

Analyze the scan results and produce a prioritized security report.
Focus ONLY on: exposed secrets and cloud misconfigurations.
Be specific - name exact files, repos, or resources.
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
        # Surface the real error so a dead key / bad model never fails silently again.
        print(f"[BRAIN ERROR] {model} failed: {type(e).__name__}: {e}")
        return {"model": model, "response": "", "tokens": 0, "status": "error", "error": str(e)}


def judge(brain_a: dict, brain_b: dict) -> dict:
    """
    Pure Python judge - no AI bias, no extra API cost.
    Scores both brains and returns the winner.
    Scoring: severity coverage 40%, remediation specificity 35%, confidence 25%

    Matching is tolerant of markdown: 'CRITICAL', '## CRITICAL', '**CRITICAL**'
    and 'CRITICAL:' all count. The model drifts from the literal format, so we
    match the label words, not the exact punctuation.
    """
    def score_response(result: dict) -> float:
        if result["status"] != "success":
            return 0.0
        text = result["response"].upper()
        score = 0.0

        # Severity coverage (40%) - match the word, ignore punctuation/markdown
        severity_score = 0.0
        if "CRITICAL" in text: severity_score += 0.5
        if "HIGH" in text:     severity_score += 0.3
        if "MEDIUM" in text or "LOW" in text: severity_score += 0.2
        score += severity_score * 0.40

        # Remediation specificity (35%)
        remediation_score = 0.0
        if "REMEDIATION" in text or "FIX" in text or "STEPS" in text:
            remediation_score += 0.4
        if any(w in text for w in ["ROTATE", "REVOKE", "UPDATE", "PATCH", "FIX"]):
            remediation_score += 0.4
        if any(w in text for w in ["GCP", "GITHUB", "SECRET", "IAM", "TOKEN"]):
            remediation_score += 0.2
        score += min(remediation_score, 1.0) * 0.35

        # Confidence (25%) - tolerant of markdown around the label
        confidence_score = 0.0
        if "CONFIDENCE" in text:
            tail = text.split("CONFIDENCE", 1)[-1][:50]
            if "HIGH" in tail:   confidence_score = 1.0
            elif "MEDIUM" in tail: confidence_score = 0.6
            elif "LOW" in tail:  confidence_score = 0.3
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


def run_gemini_brain(scan_summary: str) -> dict:
    """Run Gemini Flash as Brain A. Returns the same normalized dict as run_brain()
    so the judge and degrade logic handle it identically."""
    if not GEMINI_API_KEY:
        return {"model": GEMINI_MODEL, "response": "", "tokens": 0,
                "status": "error", "error": "GEMINI_API_KEY not set"}
    try:
        model = genai.GenerativeModel(GEMINI_MODEL, system_instruction=SYSTEM_PROMPT)
        response = model.generate_content(
            f"Analyze these scan results:\n\n{scan_summary}",
            generation_config={"max_output_tokens": 1024},
        )
        text = response.text
        tokens = 0
        if getattr(response, "usage_metadata", None):
            tokens = (getattr(response.usage_metadata, "prompt_token_count", 0)
                      + getattr(response.usage_metadata, "candidates_token_count", 0))
        return {"model": GEMINI_MODEL, "response": text, "tokens": tokens, "status": "success"}
    except Exception as e:
        print(f"[BRAIN A] Gemini failed: {type(e).__name__}: {e}")
        return {"model": GEMINI_MODEL, "response": "", "tokens": 0,
                "status": "error", "error": str(e)}


def multi_brain_analyze(scan_summary: str) -> dict:
    """
    Run both brains sequentially, judge the results.
    Brain A runs first - if it finds nothing, Brain B is skipped (cost optimization).
    """
    print(f"[BRAIN A] Running {GEMINI_MODEL} (Gemini)...")
    result_a = run_gemini_brain(scan_summary)
    # Gemini is primary; if it fails (rate limit / outage / no key), Haiku subs in
    # so the scan always completes. Haiku only runs when Gemini cannot.
    if result_a["status"] == "error":
        print(f"[BRAIN A] Gemini unavailable - falling back to {BRAIN_A} (Haiku)...")
        result_a = run_brain(BRAIN_A, scan_summary)

    # Cost optimization - only run Brain B if Brain A found something critical
    text_a = result_a["response"].upper()
    if result_a["status"] == "success" and "CRITICAL" in text_a:
        print(f"[BRAIN B] Findings detected - running {BRAIN_B} for deep analysis...")
        result_b = run_brain(BRAIN_B, scan_summary)
        # Graceful degrade: if Brain B can't run (e.g. model access), fall back
        # to Brain A's analysis instead of contributing an empty zero-scored ghost.
        if result_b["status"] == "error":
            print(f"[BRAIN B] errored - degrading gracefully to Brain A's analysis")
            result_b = {"model": BRAIN_B, "response": result_a["response"],
                        "tokens": 0, "status": "skipped"}
    else:
        print(f"[BRAIN B] No critical findings from Brain A - skipping to save tokens")
        result_b = {"model": BRAIN_B, "response": result_a["response"],
                    "tokens": 0, "status": "skipped"}

    verdict = judge(result_a, result_b)
    verdict["brain_b_skipped"] = result_b["status"] == "skipped"

    # Safety net: never return empty analysis if any brain produced text.
    if not verdict["analysis"]:
        verdict["analysis"] = (result_a["response"] or result_b["response"]
                               or "No analysis produced - check brain logs for errors.")
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