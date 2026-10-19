---
name: HirekoOpenPlugin
description: Sign in / out and check Hireko / Recruiter (HirekoOpenPlugin) auth via browser device login. Free-form args set tenant, optional stage (beta|prod), and optional local Vite port. Use when the user types /HirekoOpenPlugin, hireko or recruiter login/logout/status.
argument-hint: "[stage] <tenant> [local <port>] [username] [password]"
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
4. Optional trailing `username` `password` only for password-login fallback.

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
3. Else call **`login_browser` once** with `{ tenant, stage?, localPort? }` when the MCP host is the same machine as the browser (local Claude/Cursor/Hermes).
4. On **remote/container Hermes** (Amazon Linux Lightsail Docker): prefer MCP **`login`** with `{ tenant, username, password }` — device login needs an SSH tunnel to ports 8700–8799. Do not ask the user to paste a password into chat if browser login on the same host works; for remote hosts, password login via the tool is expected.
5. Fallback CLI if the tool is missing:

```bash
HirekoOpenPlugin login --browser --tenant <tenant> [--stage beta|prod] [--local-port <port>]
```

6. Password `login` tool only if browser path is impossible and username/password were provided.

Print: auth/error, stage, localPort if any, human URL, hasRefresh. Never echo a password.

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

Call `auth_status` once. Summarize authenticated/tenant/stage/`proxy.human`/`toolsIndexed`. Never invent URLs or echo tokens.

## Logout (user says hireko/recruiter logout / sign out / end session)

Call MCP `logout` once with `{}` or `{ tenant }` if specified. Prefer this over inventing CLI steps when MCP is available.

## CI / Headless mode (no browser, no prompt)

Headless authentication uses a **credential triplet**: `(tenant, username, password)`. Both headless formats supply this exact triplet to the unified authentication factory, automatically logging in at startup.

Priority: explicit tool args > `apiKey` > `HIREKO_INTERNAL_API_KEY` > plain-env triplet.

### Format 1 — Plain-env triplet (recommended for CI & Docker)

Separate environment variables prefixed with the plugin name `<PLUGIN_NAME>_` (e.g. `HirekoOpenPlugin_`):

```bash
export HirekoOpenPlugin_tenant="EXAMPLE_TENANT"
export HirekoOpenPlugin_username="ci-user@example.com"
export HirekoOpenPlugin_password="YOUR_PASSWORD"
```

Set all three as `<PLUGIN_NAME>_tenant`, `<PLUGIN_NAME>_username`, `<PLUGIN_NAME>_password`. The proxy auto-logs in at serve startup — no MCP `login` call needed.

### Format 2 — Bundled Base64 `HIREKO_INTERNAL_API_KEY`

A single environment variable containing the base64-encoded JSON representation of the exact same triplet:

1. **Plain JSON triplet:**
   ```json
   {
     "tenant": "EXAMPLE_TENANT",
     "username": "ci-user@example.com",
     "password": "YOUR_PASSWORD"
   }
   ```

2. **Base64 encoded string:**
   ```bash
   export HIREKO_INTERNAL_API_KEY="YOUR_BASE64_BUNDLE_OR_API_KEY"
   ```

3. **Or generated dynamically in bash:**
   ```bash
   export HIREKO_INTERNAL_API_KEY=$(echo -n '{"tenant":"EXAMPLE_TENANT","username":"ci-user@example.com","password":"YOUR_PASSWORD"}' | base64)
   ```

### Docker / GitHub Actions example

```yaml
env:
  # Format 1 (Plain-env triplet):
  HirekoOpenPlugin_tenant: ${{ secrets.HIREKO_TENANT }}
  HirekoOpenPlugin_username: ${{ secrets.HIREKO_USERNAME }}
  HirekoOpenPlugin_password: ${{ secrets.HIREKO_PASSWORD }}

  # Or Format 2 (Base64 bundle):
  # HIREKO_INTERNAL_API_KEY: ${{ secrets.HIREKO_INTERNAL_API_KEY }}
```

The `auth_status` tool returns `headlessMode: true` when either source is detected, and a specific error message if credentials were set but login failed (e.g. wrong password).

Interactive users ignore these env vars entirely — they use `login_browser` / `login` as normal.
