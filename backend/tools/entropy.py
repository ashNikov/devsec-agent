import math
import re
import os
from pathlib import Path

# Characters common in secrets
BASE64_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=")
HEX_CHARS    = set("0123456789abcdefABCDEF")

SKIP_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2",
    ".ttf", ".eot", ".otf", ".mp4", ".mp3", ".pdf", ".zip", ".tar",
    ".gz", ".lock", ".sum", ".mod", ".map",
}
SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "dist", "build", ".next",
}

# Strings that look like secrets but aren't
WHITELIST_PATTERNS = [
    re.compile(p) for p in [
        r"^[a-zA-Z\s]+$",           # plain words
        r"^https?://",              # URLs
        r"^\d+\.\d+\.\d+",         # version numbers
        r"^[a-zA-Z0-9._%+-]+@",    # email addresses
    ]
]


def shannon_entropy(s: str) -> float:
    if not s:
        return 0.0
    freq = {}
    for ch in s:
        freq[ch] = freq.get(ch, 0) + 1
    length = len(s)
    return -sum((c / length) * math.log2(c / length) for c in freq.values())


def _is_whitelisted(token: str) -> bool:
    return any(p.match(token) for p in WHITELIST_PATTERNS)


def _classify(token: str, entropy: float) -> str:
    chars = set(token)
    if chars.issubset(HEX_CHARS) and len(token) in (32, 40, 64):
        return "hex_secret"
    if chars.issubset(BASE64_CHARS) and entropy > 4.5:
        return "base64_secret"
    if entropy > 5.0:
        return "high_entropy_string"
    return "suspicious_string"


def scan_string_for_entropy(content: str, min_length: int = 20, threshold: float = 4.5) -> list:
    """Extract high-entropy tokens from a string. Returns list of findings."""
    findings = []
    # Match long alphanumeric+symbol tokens (typical secrets)
    pattern = re.compile(r"['\"`]([A-Za-z0-9+/=_\-]{%d,})['\"`]" % min_length)
    for match in pattern.finditer(content):
        token = match.group(1)
        if _is_whitelisted(token):
            continue
        ent = shannon_entropy(token)
        if ent >= threshold:
            findings.append({
                "token_preview": token[:6] + "..." + token[-4:],
                "length":        len(token),
                "entropy":       round(ent, 3),
                "type":          _classify(token, ent),
                "offset":        match.start(),
            })
    return findings


def scan_file(file_path: str, threshold: float = 4.5) -> dict:
    """Scan a single file for high-entropy strings."""
    path = Path(file_path)
    if path.suffix.lower() in SKIP_EXTENSIONS:
        return {"file": file_path, "skipped": True, "findings": []}
    try:
        content = path.read_text(errors="ignore")
    except Exception as e:
        return {"file": file_path, "error": str(e), "findings": []}

    findings = []
    for i, line in enumerate(content.splitlines(), 1):
        for hit in scan_string_for_entropy(line, threshold=threshold):
            hit["line"] = i
            findings.append(hit)

    return {
        "file":     file_path,
        "skipped":  False,
        "findings": findings,
    }


def scan_directory(root: str, threshold: float = 4.5, max_files: int = 500) -> dict:
    """Walk a directory and entropy-scan every text file."""
    root_path = Path(root)
    if not root_path.exists():
        return {"error": f"Path does not exist: {root}", "files_scanned": 0, "total_findings": 0, "results": []}

    results = []
    files_scanned = 0
    total_findings = 0

    for dirpath, dirnames, filenames in os.walk(root_path):
        # Prune skipped dirs in-place so os.walk won't descend into them
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]

        for fname in filenames:
            if files_scanned >= max_files:
                break
            fpath = os.path.join(dirpath, fname)
            result = scan_file(fpath, threshold=threshold)
            files_scanned += 1
            if result.get("findings"):
                total_findings += len(result["findings"])
                results.append(result)

    return {
        "root":           root,
        "threshold":      threshold,
        "files_scanned":  files_scanned,
        "files_with_hits": len(results),
        "total_findings": total_findings,
        "results":        results,
    }


if __name__ == "__main__":
    import sys
    path = sys.argv[1] if len(sys.argv) > 1 else os.path.expanduser("~/projects/devsec-agent")
    out = scan_directory(path)
    print(f"Scanned {out['files_scanned']} files — {out['total_findings']} high-entropy strings in {out['files_with_hits']} files")
    for r in out["results"]:
        for f in r["findings"]:
            print(f"  [{f['type']}] {r['file']}:{f['line']}  entropy={f['entropy']}  preview={f['token_preview']}")
