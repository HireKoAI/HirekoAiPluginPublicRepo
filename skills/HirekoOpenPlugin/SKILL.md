---
name: HirekoOpenPlugin
description: Sign in / out and check Hireko / Recruiter (HirekoOpenPlugin) auth via browser device login. Free-form args set tenant, optional stage (beta|prod), and optional local Vite port. Use when the user types /HirekoOpenPlugin, hireko or recruiter login/logout/status.
argument-hint: "[stage] <tenant> [local <port>]"
user-invocable: true
disable-model-invocation: true
---

# HirekoOpenPlugin

The user invoked this slash command with free-form text after the command name. Do not ask questions. Do not list tenants. Do not invent URLs.

## Process model

The plugin MCP server is **stdio**, a child of the harness (Claude, Cursor, Hermes, …). When the harness quits, the OS stops that child. `up` only clears orphan detached proxies — it does not start a long-lived daemon.

## Parse args

1. **stage** — whole-word `beta` or `prod` (else omit; local installs → beta).
2. **localPort** — `local` + port / `local:8080` / `local=8080` (Vite). Not deploy stage `local`.
3. **tenant** — first remaining non-keyword word.

| User typed | Call |
|---|---|
| `test` | `{ tenant: "test" }` |
| `prod test` | `{ tenant: "test", stage: "prod" }` |
| `test local 8080` | `{ tenant: "test", localPort: 8080 }` |

**Always print the device-login URL** from tool/CLI output.

## Empty tenant

Call `auth_status` once if available. Print usage + stage/human when known. Stop.

## Login

1. Call `auth_status` once.
2. If already authenticated for that tenant, report and stop.
3. Else call **`login_browser` once** with `{ tenant, stage?, localPort? }`. The user signs in on the HireKo login page in their browser.
4. Fallback CLI if the tool is missing:

```bash
HirekoOpenPlugin login --browser --tenant <tenant> [--stage beta|prod] [--local-port <port>]
```

Print: auth/error, stage, localPort if any, human URL, hasRefresh.

Never ask the user for their password in chat, never echo a password or token, and never read credentials from environment variables or files.

After login, business APIs are flattened as `server__tool` on `tools/list` — call them directly; auth is injected by the proxy.

## Recruiter Facade Tools & Workflows

Once authenticated, Recruiter Facade tools are exposed directly as flattened tools:

### Available Tools

- **`RecruiterFacade__create_interview_link`**: Generate an interview link for candidates.
  - **Required**: `title`, `description`, `company_name`, `location`, `start_date` (epoch ms, e.g. `1741737600000`), `end_date` (epoch ms), `interview_length` (minutes as string, e.g. `"30"`).
  - **Optional**: `company_culture`, `status` (default: `"active"`), `employment_type` (default: `"Full Time"`), `language` (default: `"en"`), `stage` (default: `"prod"`), `tenant` (default: active tenant), `funnel` (default: `"AllFunnels"`).
- **`RecruiterFacade__get_search_score`**: Retrieve candidate match / search score for a job posting.
  - **Required**: `job_id` (string).
  - **Optional**: `stage` (default: `"prod"`), `tenant` (default: active tenant).
- **`RecruiterFacade__health`**: Check health of the Recruiter Facade MCP endpoint.

### Common Workflows

1. **Creating an Interview Link**:
   - Collect or extract job/interview details: title, description, company, location, date range, duration.
   - Convert date range to epoch milliseconds (e.g. `Date.parse(...)`).
   - Call `RecruiterFacade__create_interview_link`.
   - Present the returned interview link and details to the user.

2. **Fetching Search Scores**:
   - Extract the `job_id`.
   - Call `RecruiterFacade__get_search_score({ job_id })`.
   - Display matching scores and relevant candidate ranking criteria.

## Status

Call `auth_status` once. Summarize authenticated/tenant/stage/`proxy.human`/`toolsIndexed`. Never invent URLs or echo tokens.

## Logout (user says hireko/recruiter logout / sign out / end session)

Call MCP `logout` once with `{}` or `{ tenant }` if specified. Prefer this over inventing CLI steps when MCP is available.