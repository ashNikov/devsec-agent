import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-2.0-flash")

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
    chat = model.start_chat(history=history)
    response = chat.send_message(SYSTEM_PROMPT + "\n\nTask: " + user_message)
    return response.text

if __name__ == "__main__":
    result = think("Introduce yourself and explain what you can do.")
    print(result)
