# HirekoOpenPlugin — Install Guide

Install **HirekoOpenPlugin as a plugin** in your agent harness. Do **not** manually add Recruiter Facade as a separate MCP entry.

## Supported harnesses

`./install.sh` auto-detects what is installed on your machine and can register any of:

| Harness | Detected when | What `install.sh` does |
|---------|---------------|------------------------|
| **Claude Code** | `claude` on PATH | `claude plugin marketplace add` + `claude plugin install hireko-open-plugin@hireko-open-plugin` |
| **Codex** | `codex` on PATH | Stages Codex-safe copy; rewrites `.mcp.json` to `$NAME serve` (global CLI on PATH); marketplace/plugin add + `codex mcp add` (Codex does not expand `${CLAUDE_PLUGIN_ROOT}`) |
| **Cursor** | `~/.cursor` exists | Copies plugin → `~/.cursor/plugins/local/$NAME`. Unix: `$(command -v node)` + `${PLUGIN_ROOT}`. Windows: install resolves `node` + plugin path on *this* machine (fwd-slash abs), writes plugin `mcp.json` and merges `~/.cursor/mcp.json` — no hardcoded user paths in the repo |
| **Hermes** | `hermes` on PATH or `~/.hermes` | Copies to `~/.hermes/plugins/`, `hermes mcp add` when CLI present, skill under `~/.hermes/skills/` |
| **Gemini CLI** | `gemini` on PATH | Reminds you to restart `gemini` |
| **Antigravity** | `agy` on PATH or `~/.antigravity` | `agy plugin install` when CLI present |
| **VS Code** | `code` on PATH or Code User dir | Copies to `~/.hireko/plugins/` and registers stdio MCP in `Code/User/mcp.json` |

Pick harnesses explicitly:

```bash
./install.sh --only=claude,cursor,codex,hermes
./install.sh --all          # every detected harness
./install.sh                # interactive prompt
```

See [Hermes on Docker / Lightsail](hermes/README.md) for container-specific auth and volume mounts.

---

## What you get (both paths)

- **One plugin MCP** registered with the harness: `HirekoOpenPlugin`
- On startup, the proxy **auto-registers** downstream servers:
  - **Recruiter Facade** (`RecruiterFacade`) — preconfigured for Beta (or via `MCP_EXTENSION_RECRUITER_FACADE` override)
- **No Human console** (`/human`) required to add servers
- After login, tools flatten to `RecruiterFacade__...`

The harness talks to the router only. The router discovers Recruiter Facade internally and injects tenant auth on every outbound call.

---

## Prerequisites (both paths)

| Requirement | Notes |
|-------------|--------|
| **Node.js 20+** | `node -v` |
| **npm** | `npm -v` |
| **Git Bash** (Windows) | Required to run `./install.sh` |
| **Harness CLI** | e.g. `claude`, `codex`, `hermes` on PATH for that harness to be detected |

Harness-specific (after install):

| Harness | Extra step |
|---------|------------|
| **Cursor** | Settings → enable **Include third-party Plugins, Skills, and other configs** → Reload Window |
| **Claude Code** | Restart Claude Code (or use `claude --plugin-dir` for one session) |
| **Codex** | Restart Codex |
| **Hermes** | Restart Hermes; verify with `hermes mcp list` |
| **VS Code** | Restart VS Code / Copilot Chat; check MCP in `Code/User/mcp.json` |
| **Gemini / Antigravity** | Restart the CLI or IDE |

---

# Path A — Local repo (developers)

Use when you already have the git checkout (e.g. `HirekoOpenPlugin` cloned locally).

### 1. Open Git Bash in the repo

```bash
cd /path/to/HirekoOpenPlugin
```

Windows example:

```bash
cd /d/MetricDust/Hireko/HirekoOpenPlugin
```

### 2. Install dependencies and build

`dist/` is not committed; you must build before install.

```bash
npm install
npm run build
```

### 3. Install as a plugin

Install the harnesses you use (examples):

```bash
./install.sh --only=claude,hermes
./install.sh --only=cursor,codex
./install.sh --all
```

### 4. Restore `package.json` if you keep developing

`install.sh` strips `prepare` and `build` from the folder it runs in (so end-user zips do not require `tsc`). If you continue working in the repo:

```bash
git restore package.json
```

### 5. Restart your harness(es)

See the harness table above (reload Cursor, restart Claude/Codex/Hermes, etc.).

### 6. Sign in

In the agent:

```text
/HirekoOpenPlugin
```

Tabs: **tenant name** → **username** → **password** → Enter.

For **prod** tenants:

```text
/HirekoOpenPlugin prod yourtenant
```

Local installs default to **beta** extension URLs unless you specify `prod` or set `HIREKO_STAGE=prod`.

### What Path A does

| Step | Result |
|------|--------|
| `npm run build` | Produces `dist/cli/index.js` and web console |
| `./install.sh` | `npm install -g` → `HirekoOpenPlugin` on PATH |
| `./install.sh` | Registers plugin with each selected harness (see table above) |
| `./install.sh` | Creates `~/.HirekoOpenPlugin/config.json` if missing |

---

# Path B — S3 zip (team / production users)

Use when you only have an **S3 link** — no repo clone.

### S3 URI format

```text
s3://<bucket>/<plugin>-<version>.zip
```

Examples (bucket slug follows `<company>-<folder>-<stage>`):

```text
s3://hireko-hirekoopenplugin-prod/HirekoOpenPlugin-0.1.0.zip
s3://hireko-hirekoopenplugin-beta/HirekoOpenPlugin-0.1.0.zip
```

Ask your team for the current version and stage (beta vs prod).

### 1. Download and install from S3

If `HirekoOpenPlugin` is already on PATH:

```bash
HirekoOpenPlugin plugin install s3://hireko-hirekoopenplugin-prod/HirekoOpenPlugin-0.1.0.zip
```

**First time** (CLI not installed yet) — bootstrap from a built checkout:

```bash
node dist/cli/index.js plugin install s3://hireko-hirekoopenplugin-prod/HirekoOpenPlugin-0.1.0.zip
```

Or in **Claude Code**:

```text
/plugin s3://hireko-hirekoopenplugin-prod/HirekoOpenPlugin-0.1.0.zip
```

This command (internally):

- AWS SSO login when needed (browser)
- Downloads the zip + verifies `.sha256` sidecar when present
- Unpacks to `~/.hireko/plugins/HirekoOpenPlugin`
- Runs `npm install -g` (zip ships prebuilt `dist/`)

Requires AWS SSO access to the Hireko deployment account. See [infra/deploy_to_aws/README.md](../../infra/deploy_to_aws/README.md) for distribution details.

### 2. Register with your harness(es)

`plugin install` unpacks and links the CLI but does **not** register Cursor, Claude, Hermes, etc. Run `install.sh` from the unpacked plugin:

```bash
cd ~/.hireko/plugins/HirekoOpenPlugin
./install.sh --only=claude,hermes
# or: ./install.sh --only=cursor,codex
# or: ./install.sh --all
```

### 3. Restart your harness(es)

Reload Cursor, restart Claude Code / Codex / Hermes — see harness table above.

### 4. Sign in

```text
/HirekoOpenPlugin
```

Prod tenants:

```text
/HirekoOpenPlugin prod yourtenant
```

### Path B checklist (share with team)

```
[ ] AWS SSO access (Hireko deployment account)
[ ] S3 link from team (prod or beta bucket + version)
[ ] HirekoOpenPlugin plugin install s3://...
[ ] cd ~/.hireko/plugins/HirekoOpenPlugin && ./install.sh --only=<your harnesses>
[ ] Restart harness(es) you installed for
[ ] /HirekoOpenPlugin → login
[ ] list_servers shows RecruiterFacade (preconfigured for Beta or via MCP_EXTENSION_RECRUITER_FACADE)
```

Example for a team on Claude + Hermes:

```bash
HirekoOpenPlugin plugin install s3://hireko-hirekoopenplugin-prod/HirekoOpenPlugin-0.1.0.zip
cd ~/.hireko/plugins/HirekoOpenPlugin && ./install.sh --only=claude,hermes
```

---

# Verify (both paths)

Ask the agent:

1. **`auth_status`** — confirms login + tenant
2. **`list_servers`** — should include `RecruiterFacade` (when configured)
3. After login — flattened tools such as `RecruiterFacade__...`

Hermes CLI:

```bash
hermes mcp list
hermes mcp test HirekoOpenPlugin
```

You do **not** need to visit the Human console or POST server entries manually.

---

# Do not do this

| Wrong | Right |
|-------|-------|
| Add Recruiter Facade as a separate MCP server in harness settings | Install the plugin only; downstream servers are internal |
| Manually edit Cursor MCP JSON for this plugin | Use `./install.sh` so the harness loads the plugin's `mcp.json` |
| Point Codex/Cursor MCP at `${CLAUDE_PLUGIN_ROOT}/…` (handshake fails) | Re-run `./install.sh --only=codex,cursor` (Cursor: install-time resolved paths / `${PLUGIN_ROOT}`; Codex → `$NAME serve` on PATH) |
| Use Human console to add servers | Auto-registered when the proxy starts |
| Unzip to Downloads/temp and delete the folder | Keep `~/.hireko/plugins/HirekoOpenPlugin` permanently |

---

# Path comparison

| | **Path A — Local repo** | **Path B — S3 zip** |
|--|-------------------------|---------------------|
| **Who** | Developers with git clone | Team / prod users |
| **Input** | Repo folder | S3 link only |
| **Build** | `npm run build` required | Pre-built in zip |
| **Main install** | `./install.sh --only=…` or `--all` | `plugin install s3://...` then `./install.sh` |
| **AWS SSO** | Not needed | Required for S3 download |

---

# See also

- [README.md](../../README.md) — quick start from zip
- [hermes/README.md](hermes/README.md) — Hermes / Docker / headless auth
- [infra/deploy_to_aws/README.md](../../infra/deploy_to_aws/README.md) — publish and S3 distribution
- [AGENTS.md](../../AGENTS.md) — agent routing and auth rules
