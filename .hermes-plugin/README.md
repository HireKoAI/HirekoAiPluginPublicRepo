# Hireko for Hermes

A lightweight, self-contained MCP plugin for **Hermes Desktop and CLI** that connects to Hireko's recruiting platform:
- Recruiter authentication via **email/password** or **browser device login**
- Candidate screening **interview link creation**
- Asynchronous interview session status & link retrieval (`anonymousInterviewSession`)
- Candidate **search & match scoring**

---

## Capabilities & Tools

| Tool | Description |
|---|---|
| `auth_status` | Check if you are currently signed in, active tenant, and deployment stage. |
| `login` | Authenticate using recruiter email and password. |
| `login_browser` | Authenticate interactively via the recruiter device-login browser window. |
| `logout` | Sign out and clear stored session tokens. |
| `create_interview_link` | Initiate candidate interview creation. Starts an AWS Step Function and returns the `external_job_group_id`. |
| `get_interview_link` | Retrieve the completed candidate interview URL (`https://interview-test.<stage>.hireko.ai/anonymousInterviewSession/...`) using `external_job_group_id`. |
| `get_search_score` | Fetch candidate match scores for a given `job_id`. |
| `health` | Verify connectivity with Hireko's downstream recruiter services. |

---

## Interview Creation Workflow

Hireko uses an asynchronous AI Step Function to prepare questions (takes up to 150 seconds):

1. **Create & Poll:** Call `create_interview_link` with the job details (title, company, description, duration, dates). The tool polls for up to 150 seconds and returns the finished candidate URL directly once questions are generated:
   ```json
   {
     "status": "COMPLETED",
     "job_id": "job_1793294089408_9f1f3ef3-2f9d-415a-a5b4-966fa3d51098",
     "interview_link": "https://interview-test.beta.hireko.ai/anonymousInterviewSession/job_1793294089408_9f1f3ef3-2f9d-415a-a5b4-966fa3d51098?settings=eyJyZW5kZXJJRCI6ICJidWJibGUiLCAiaXNTY3JlZW5TaGFyZU1hbmRhdG9yeSI6IGZhbHNlfQ=="
   }
   ```
2. **Manual Retrieval (if needed):** If generation takes longer than 150s, the tool returns `status: "STARTED"` with `external_job_group_id`. Call `get_interview_link` with `external_job_group_id` to poll for completion:
   ```json
   {
     "status": "COMPLETED",
     "job_id": "job_1793294089408_9f1f3ef3-2f9d-415a-a5b4-966fa3d51098",
     "interview_link": "https://interview-test.beta.hireko.ai/anonymousInterviewSession/job_1793294089408_9f1f3ef3-2f9d-415a-a5b4-966fa3d51098?settings=eyJyZW5kZXJJRCI6ICJidWJibGUiLCAiaXNTY3JlZW5TaGFyZU1hbmRhdG9yeSI6IGZhbHNlfQ=="
   }
   ```

---

## Installation & Usage in Hermes

### Option 1: Local Testing in Hermes Desktop
Copy or link `.hermes-plugin` to your local Hermes plugins folder:
```powershell
Copy-Item -Recurse -Force ".hermes-plugin" "$env:USERPROFILE\.hermes\plugins\hireko"
```

Restart Hermes Desktop. In the chat prompt, use:
```text
/hireko
```
Or simply tell Hermes:
> *"Sign in to Hireko with email recruiter@example.com and password ... for tenant test"*  
> *"Create a 30-minute screening interview link for Senior Backend Engineer at Acme Corp"*

### Option 2: Install via Hermes CLI
```bash
hermes plugins install HireKoAI/HirekoAiPluginPublicRepo/.hermes-plugin
hermes plugins enable hireko
```
