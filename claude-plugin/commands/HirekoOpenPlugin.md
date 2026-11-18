---
description: Hireko - check the connection and show how to sign in and what you can do
argument-hint: "[status]"
---

Help the user get started with Hireko.

1. If the Hireko tools (from the `HirekoOpenPlugin` MCP server) are available, call `health` once.
   - Success: say Hireko is connected.
   - Authentication error or tools missing: explain how to connect:
     - Claude Code: run `/mcp`, select **HirekoOpenPlugin**, choose **Authenticate**.
     - Claude apps: open the connector settings and select **Connect** for Hireko.
     - The browser asks for the company name (the `<company>` in `recruiter-<company>.hireko.ai`), then the usual Hireko recruiter login.
2. List what the user can ask for, with one example each:
   - Create an AI screening interview link for a job.
   - Look up the interview link of a job created earlier.
   - Search the company's jobs by skills.
   - Get candidate scores for a job ID.
3. Mention that signing out or switching company is done by disconnecting Hireko and connecting again.

Never ask for a password, token or API key in chat. Never invent URLs.
