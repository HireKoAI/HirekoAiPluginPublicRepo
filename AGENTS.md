# HirekoOpenPlugin — agent notes

This plugin is a **local auth-injecting MCP router**. Plugin name: **HirekoOpenPlugin** (not `hireko`). The harness talks to one stdio MCP server; downstream tools are flattened onto `tools/list` as `server__tool`.

## Hard rules

1. **Never invent or pass `Authorization` headers, Bearer tokens, Cognito passwords, or API keys** to downstream tools. The proxy injects tenant auth on every outbound call.
2. Prefer **calling flattened tools directly** from `tools/list` when the name/description matches the task.
3. Use **`filter_tools_with_query`** only when the catalog is large or you need a ranked shortlist (deterministic text scoring — no LLM inside the proxy).
4. If unauthenticated, call **`login_browser`** or the `/HirekoOpenPlugin` slash skill. Do not ask the user to paste a password into chat.
5. To sign out, call MCP **`logout`** (optional `tenant`; defaults to active). Prefer this over inventing CLI steps when MCP is available.
6. After `/human` adds a server, call **`reload_registry`** so `tools/list_changed` refreshes the flattened surface.

## Routing

| Intent | Action |
|--------|--------|
| Status / “am I logged in?” / “hireko|recruiter status” | MCP `auth_status` |
| Browser / device login / “hireko|recruiter login” | `/HirekoOpenPlugin` → `login_browser` |
| Sign out / “hireko|recruiter logout” | MCP `logout` (optional `tenant`; default active) |
| Rank tools by English query | `filter_tools_with_query` |
| Create candidate interview link | Flattened `RecruiterFacade__create_interview_link` directly |
| Get job search / match score | Flattened `RecruiterFacade__get_search_score` directly |
| Recruiter Facade health check | Flattened `RecruiterFacade__health` directly |
| Call any business API | Flattened `server__tool` directly |

Only one tenant session may be active: if already logged in, logout before logging into a different tenant (same-tenant re-login is allowed).

## Recruiter Facade Tools & Workflows

The proxy auto-registers the downstream **Recruiter Facade** server (`RecruiterFacade`). Its tools are flattened onto `tools/list` as `RecruiterFacade__<tool>`:

### 1. `RecruiterFacade__create_interview_link`
Creates candidate interview links via Hireko Recruiter Facade API. Tenant auth is automatically injected.
- **Required parameters**:
  - `title` (string): Interview title (e.g. `"Senior Frontend Engineer - Screening"`)
  - `description` (string): Detailed interview description / expectations
  - `company_name` (string): Name of the hiring company
  - `location` (string): Job / interview location (e.g. `"Remote"`, `"Seattle, WA"`)
  - `start_date` (integer): Epoch timestamp in milliseconds (e.g. `1741737600000`)
  - `end_date` (integer): Epoch timestamp in milliseconds (e.g. `1744329600000`)
  - `interview_length` (string): Duration in minutes (e.g. `"30"`, `"45"`)
- **Optional parameters**:
  - `status` (string, default: `"active"`)
  - `employment_type` (string, default: `"Full Time"`)
  - `language` (string, default: `"en"`)
  - `stage` (string, default: `"prod"`)
  - `tenant` (string, default: active tenant)
  - `funnel` (string, default: `"AllFunnels"`)
  - `company_culture` (string): Company culture or candidate guidance notes

### 2. `RecruiterFacade__get_search_score`
Retrieves candidate match scores and search relevance for a specific job posting.
- **Required parameters**:
  - `job_id` (string): The ID of the job posting
- **Optional parameters**:
  - `stage` (string, default: `"prod"`)
  - `tenant` (string, default: active tenant)

### 3. `RecruiterFacade__health`
Health check endpoint for the downstream Recruiter Facade service.

### Agent Workflow Guidelines
- **Creating Interview Links**: When a recruiter asks to create or schedule an interview link:
  1. Confirm authentication status using `auth_status` if needed.
  2. Parse the interview details (convert dates/times into epoch milliseconds for `start_date` and `end_date`).
  3. Call `RecruiterFacade__create_interview_link`.
  4. Present the resulting link clearly to the user.
- **Candidate Match / Search Scores**: When a recruiter asks for candidate scores or job matching scores:
  1. Identify the target `job_id`.
  2. Call `RecruiterFacade__get_search_score({ job_id })`.
  3. Summarize and format the scoring results for the user.

## Process model

MCP is **stdio**, owned by the harness (Claude, Cursor, Hermes, Codex, …). When the harness exits, the proxy exits. `up` only clears orphan detached processes.

**Hermes (incl. Amazon Linux Lightsail Docker):** `./install.sh --only=hermes` copies the package to `~/.hermes/plugins/<Name>`, registers MCP via `hermes mcp add` (absolute `node` path + `HIREKO_CREDENTIAL_STORE=file`), and installs the skill under `~/.hermes/skills/<Name>`.

- Credentials on Linux containers: `~/.<Name>/credentials/<tenant>.json` (no Keychain).
- Auth in Docker / Headless: Both headless options inject the exact same **credential triplet** `(tenant, username, password)`:
  - **Format 1 — Plain-env triplet (recommended for CI/Docker — no base64):**
    ```bash
    export HirekoOpenPlugin_tenant="EXAMPLE_TENANT"
    export HirekoOpenPlugin_username="recruiter@example.com"
    export HirekoOpenPlugin_password="YOUR_PASSWORD"
    ```
  - **Format 2 — Base64 JSON bundle (`HIREKO_INTERNAL_API_KEY` or CLI `login --apikey`):**
    Plain JSON triplet:
    ```json
    {"tenant": "EXAMPLE_TENANT", "username": "recruiter@example.com", "password": "YOUR_PASSWORD"}
    ```
    Base64 encoded:
    ```bash
    export HIREKO_INTERNAL_API_KEY="YOUR_BASE64_BUNDLE_OR_API_KEY"
    ```
  - Priority: `HIREKO_INTERNAL_API_KEY` > plain-env triplet. The proxy auto-logs in at startup.
  - Device/`login_browser` posts to host loopback — use only with `ssh -L 87xx:127.0.0.1:87xx` from your laptop, or run Hermes on the same machine as the browser.
- Persist across container restarts: volume-mount `$HOME/.<Name>` (or set `HIREKO_HOME`).
- Hermes does **not** load Cursor-style `agents/` — skills + MCP only.
