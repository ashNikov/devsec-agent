import os
import anthropic
from dotenv import load_dotenv

load_dotenv()

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """
You are DevSec Agent — an autonomous DevSecOps AI assistant.
You monitor, analyze and remediate security and infrastructure issues
across GCP and GitHub projects.
When given a task:
1. Think step by step
2. Decide which tools to use
3. Analyze the results
4. Give a clear prioritized finding report
Always be specific — name the exact resource, project, or file with the issue.
"""

def think(user_message: str, history: list = []) -> str:
    messages = history + [{"role": "user", "content": user_message}]
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        system=SYSTEM_PROMPT,
        messages=messages
    )
    return response.content[0].text

if __name__ == "__main__":
    result = think("Introduce yourself and explain what you can do.")
    print(result)
