---
name: hireko
description: "Hireko recruiting platform: check authentication, sign in (password or browser), create candidate screening interview links, and retrieve candidate match scores."
argument-hint: "[stage] <tenant> [email] [password]"
user-invocable: true
disable-model-invocation: false
---

# Hireko recruiting workflows for Hermes

Use the tools exposed by the `hireko` MCP server (`auth_status`, `login`, `login_browser`, `logout`, `create_interview_link`, `get_interview_link`, `get_search_score`, `health`).

## 1. Authentication

Call `auth_status` first to check if an active session exists.

- **Email & Password login:** If the user provides or asks to use email and password, call `login({ tenant, username, password, stage })`.
- **Browser sign-in:** If the user requests browser login, asks to sign in without providing credentials, or prefers OAuth, call `login_browser({ tenant, stage })`. This opens the recruiter device login page in the default browser.
- **Sign out:** Call `logout({ tenant })` to end the session.

Only one tenant session is active at a time. Default stage is `beta` unless the user specifies `prod`.

## 2. Creating Candidate Interview Links

When the user asks to create or schedule an interview link:

### ⚠️ STRICT RULE: Ask Only ONE Question at a Time!
Do NOT ask the user for multiple details at once. Do NOT provide a bulleted list or multi-field questionnaire.
Always collect details **step-by-step, asking strictly ONE question per turn**:

1. **Job Title**:
   - If not provided in the user prompt, ask: *"What is the job title for this interview?"*
   - If the user already provided the title (e.g. "Javascript Developer"), immediately move to step 2.

2. **Duration (in minutes)**:
   - Ask ONLY: *"How long should the interview be? (e.g. 15, 30, or 45 minutes)"*
   - Wait for user response before asking the next question.

3. **Location**:
   - Ask ONLY: *"Where is this position located? (e.g. Remote, Seattle, WA, Bangalore)"*
   - Wait for user response before asking the next question.

4. **Company Name**:
   - Ask ONLY: *"What is the name of the hiring company?"*
   - Wait for user response before asking the next question.

5. **Start and Expiry Dates**:
   - Ask ONLY: *"What are the start and expiry dates? (You can also reply 'default' to start today and remain active for 7 days)."*

### Important Automation Rules:
- **Do NOT ask for Job Description**: Synthesize a concise, professional job description automatically from the job title.
- **Do NOT ask for Recruiter Email**: The authenticated recruiter's email is automatically injected by the backend proxy.
- **Do NOT combine steps**: Even if you know multiple fields are missing, ask for only the single next field.

Once all details are collected, call `create_interview_link`:
- `create_interview_link` triggers the AWS Step Function and automatically polls for up to 150 seconds for AI question generation to complete.
- When status is `"COMPLETED"`, present the candidate `interview_link` (e.g. `https://interview-test.beta.hireko.ai/anonymousInterviewSession/job_...`) and `job_id` prominently to the user.
- If the initial call returns `status: "STARTED"` or `"IN_PROGRESS"` after 150 seconds, inform the user that question generation is still in progress and call `get_interview_link({ external_job_group_id })` to continue polling for up to 150 seconds.

## 3. Candidate Search & Match Scores

When the user asks for candidate scores or job match relevance:
1. Call `get_search_score({ job_id, tenant, stage })`.
2. Format and summarize the candidate scoring breakdown clearly for the user.
