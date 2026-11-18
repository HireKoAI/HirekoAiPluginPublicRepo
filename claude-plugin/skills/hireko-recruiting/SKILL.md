---
name: hireko-recruiting
description: Use Hireko recruiting tools - create AI screening interview links, look up an interview link, search a company's jobs by skills, and get candidate match scores for a job. Use when the user mentions Hireko, recruiter workflows, interview links, job search, candidate scores, or screening results.
---

# Hireko recruiting

Hireko tools come from the plugin's remote MCP server (`HirekoOpenPlugin`). Use them for a recruiter's own Hireko company (tenant).

## Sign-in

Sign-in is handled by Claude, not by tools. There is no login, logout, or status tool.

- If the Hireko tools are missing or a call fails with an authentication error, tell the user to connect Hireko:
  - Claude Code: run `/mcp`, select **HirekoOpenPlugin**, choose **Authenticate**.
  - Claude apps: open the connector settings and select **Connect** for Hireko.
- A browser page asks for the **company name** (the `<company>` in `recruiter-<company>.hireko.ai`), then the normal Hireko recruiter login.
- To sign out or switch company, the user disconnects (or clears authentication) and connects again.
- Never ask for a password, token, or API key in chat, and never add Authorization headers yourself.

## Required arguments: `tenant` and `stage`

- `tenant` is the company the user signed in with (lowercase, e.g. `acme`). If you don't know it yet, ask the user once and reuse it for the rest of the conversation. Calls for another company are rejected.
- `stage`: this build of the plugin connects to **Hireko beta**. Always pass `stage: "beta"`, even where a tool description says the default is `prod`.

## Tools

| Tool | Use it to | Required |
|---|---|---|
| `health` | Check that the Hireko service is reachable | none |
| `search_jobs` | List the company's jobs matching skills | `tenant`, `skills` (at least one) |
| `get_search_score` | Get candidate scores, percentiles and statuses for a job | `tenant`, `job_id` |
| `create_interview_link` | Create a job and its AI screening interview link | `tenant`, `stage`, `title`, `description`, `company_name`, `location`, `start_date`, `end_date`, `interview_length`, `recruiter_email` |
| `get_interview_link` | Fetch the link of a job created earlier | `tenant`, `external_job_group_id` |

## Workflows

### Create an interview link
1. Collect from the user: job title, description, company name, location, date range, interview length in minutes, and the recruiter's email. Ask only for what is missing.
2. Convert the dates to epoch **milliseconds** (`start_date`, `end_date`). Pass `interview_length` as a string such as `"30"`.
3. Call `create_interview_link`. Forward only what the user gave you: do not invent `skills`, `custom_questions`, `company_culture` or `external_job_group_id`. Hireko generates skills and questions from the description.
4. Show the interview link. If the job is still being set up, keep the returned `external_job_group_id` and use `get_interview_link` to fetch the link a little later.

### Find jobs
Call `search_jobs` with the skills the user named (e.g. `["python", "aws"]`). Summarize title, job ID and status.

### Candidate scores for a job
1. Get the `job_id` (from the user or from `search_jobs`).
2. Call `get_search_score`.
3. Show a table: candidate, email, score, percentile, status. Include the dashboard link (`redirectUrl`) when present. Candidate details are personal data: show them only to the signed-in recruiter and don't repeat them elsewhere.
