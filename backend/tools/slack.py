import os
import requests
from dotenv import load_dotenv

load_dotenv()

WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")

def send_alert(message: str, severity: str = "INFO") -> bool:
    if not WEBHOOK_URL:
        print("No Slack webhook configured")
        return False

    icons = {
        "CRITICAL": "🔴",
        "HIGH": "🟠", 
        "WARNING": "🟡",
        "INFO": "🟢",
        "SUCCESS": "✅"
    }

    icon = icons.get(severity, "🔵")

    payload = {
        "text": f"{icon} *AgentSec Alert*",
        "attachments": [
            {
                "color": "#ff4444" if severity == "CRITICAL" else "#ffaa00" if severity in ["HIGH", "WARNING"] else "#00ff88",
                "text": message,
                "footer": "AgentSec — Powered by Uwem",
                "ts": __import__("time").time()
            }
        ]
    }

    try:
        response = requests.post(WEBHOOK_URL, json=payload)
        return response.status_code == 200
    except Exception as e:
        print(f"Slack error: {e}")
        return False

if __name__ == "__main__":
    send_alert("AgentSec is online and monitoring your infrastructure.", "SUCCESS")
    send_alert("API key detected in ashflix/main — commit a3f92b", "CRITICAL")
    send_alert("2 HIGH vulnerabilities found in price-transparency Docker image", "HIGH")
