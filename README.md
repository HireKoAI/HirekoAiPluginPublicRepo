# HirekoOpenPlugin

You downloaded this zip. It is an [Agent Plugin](https://agent-plugins.org/).

Requires **Node.js 20+**.

**Full install guide** (local repo vs S3 zip; Claude Code, Cursor, Codex, Hermes, …): [docs/integrations/INSTALL.md](docs/integrations/INSTALL.md)

---

## 1. Unzip and install

Do **not** unzip into `/tmp` or Downloads and delete it. `./install.sh` links that folder, **lists detected harnesses**, and asks whether to install on all of them or let you pick.

```bash
mkdir -p ~/.hireko/plugins
unzip -q "<your local machine disk path>/HirekoOpenPlugin-0.1.0.zip" \
  -d ~/.hireko/plugins/HirekoOpenPlugin
cd ~/.hireko/plugins/HirekoOpenPlugin
./install.sh
# prompt: Install on all N detected harness(es)? [Y/n/c]
# non-interactive: ./install.sh --all   or   ./install.sh --only=claude
```

Then restart the harness(es) you chose. Type `/HirekoOpenPlugin` — tabs: tenant name, username, password. Enter calls login.

---

## 2. Log in to Hireko (in the agent)

HirekoOpenPlugin is **auth-gated**: the Recruiter Facade tools (`create_interview_link`, `get_interview_link`, `get_search_score`) only respond after a Cognito login. The proxy injects the auth token in the transport layer — it never reaches the model or the chat.

### Prerequisite: point config at your tenant

`install.sh` copies `hireko.mcp.json` to `~/.hireko/config.json` (creating it if missing). The shipped file holds **placeholders** — Cognito `userPoolId: us-west-2_EXAMPLE`, `clientId: EXAMPLE_CLIENT_ID`, `activeTenant: "test"` — so a fresh install boots against a non-existent tenant until you put your own values in. Edit `~/.hireko/config.json`:

```jsonc
{
  "userPoolId": "us-west-2_<your-pool>",
  "clientId": "<your-app-client-id>",
  "activeTenant": "<your-tenant>",
  "servers": { "recruiterFacade": { "url": "<your-recruiter-facade-mcp-url>" } }
}
```

(`HirekoOpenPlugin init` writes a fresh `hireko.mcp.json` template in the current directory to copy values from.) Restart the harness after editing.

### Interactive — local agent (preferred)

In the agent, type the slash command with your tenant:

```text
/HirekoOpenPlugin <your-tenant>
```

Tabs: **tenant**, **username**, **password**. Enter calls `login_browser` — it opens the Hireko device-login page (PKCE + refresh-token rotation) in your browser; the password tabs are the fallback when the browser flow isn't available. No chat Q&A.

Or from a terminal on the same machine:

```bash
HirekoOpenPlugin login --browser --tenant <your-tenant>
# tree-only (no global bin):
node dist/cli/index.js login --browser --tenant <your-tenant>
```

### Password — remote / container / CI (no browser)

Where a browser can't open, use the password flow with the credential triplet `(tenant, username, password)`:

```bash
HirekoOpenPlugin login --tenant <your-tenant> --username <user> --password <pass>
```

Or set the triplet as environment variables and the proxy logs in at startup — no `login` call:

```bash
export HirekoOpenPlugin_tenant="<your-tenant>"
export HirekoOpenPlugin_username="<user@example.com>"
export HirekoOpenPlugin_password="<secret>"
```

…or a single base64 bundle:

```bash
export HIREKO_INTERNAL_API_KEY="$(printf '{"tenant":"<your-tenant>","username":"<user>","password":"<secret>"}' | base64)"
```

### After login

Run `auth_status` (or type `/HirekoOpenPlugin` with no tenant) to confirm. The Recruiter Facade tools then become callable directly — `RecruiterFacade__create_interview_link`, `RecruiterFacade__get_interview_link`, `RecruiterFacade__get_search_score`. A stale/expired session returns not-authenticated until you re-run the login flow above.

---

## 3. Your harness (only if you skipped the prompt / used `--none`)

### Claude Code

From GitHub Marketplace:
```bash
claude plugin marketplace add HireKoAI/HirekoAiPluginPublicRepo
claude plugin install hireko-open-plugin@hireko-open-plugin
```

From local directory:
```bash
claude plugin marketplace add --scope user ~/.hireko/plugins/HirekoOpenPlugin
claude plugin install hireko-open-plugin@hireko-open-plugin --scope user
```

Or for a single session: `claude --plugin-dir ~/.hireko/plugins/HirekoOpenPlugin`

Restart Claude Code. Type `/HirekoOpenPlugin` (tabs: tenant, username, password).

### Cursor

```bash
mkdir -p ~/.cursor/plugins/local
cp -R ~/.hireko/plugins/HirekoOpenPlugin ~/.cursor/plugins/local/HirekoOpenPlugin
```

Settings → enable **Include third-party Plugins, Skills, and other configs** → `Cmd+Shift+P` → **Developer: Reload Window**.

### Codex

```bash
codex plugin marketplace add ~/.hireko/plugins/HirekoOpenPlugin
codex plugin add HirekoOpenPlugin@HirekoOpenPlugin
```

### Gemini CLI

```bash
./install.sh
```

Then restart `gemini`. (No extra install command.)

### Antigravity (`agy` / IDE)

```bash
./install.sh
```

Then restart Antigravity or `agy`. (No extra install command.)

---

## 4. Useful Commands for Local Development

### Initialize Configuration
Create a default configuration template (`hireko.mcp.json`) in the current directory:
```bash
node dist/cli/index.js init
```

### Build the Proxy
Compile TypeScript and build the web console frontend:
```bash
npm run build
```

### Sign In / Authenticate
Establish a local session for the active tenant:
```bash
node dist/cli/index.js login --config hireko.mcp.json
```

### Run Diagnostics (Doctor check)
Verify configurations, credentials, and downstream server health:
```bash
node dist/cli/index.js doctor --config hireko.mcp.json
```

### Start the Local Proxy Server
Start the daemon listening on stdio and serving the browser console:
```bash
node dist/cli/index.js serve --config hireko.mcp.json
```

---

Operators (publish to S3): `infra/deploy_to_aws/README.md`  
Developers (architecture): `docs/SPEC.md`
