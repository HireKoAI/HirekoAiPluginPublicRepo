# Hermes on Amazon Linux (Lightsail Docker)

## Requirements inside the container

- Node.js >= 20 on `PATH`
- `hermes` CLI on `PATH`
- Network egress to Cognito + your downstream MCP URLs
- Built plugin (`dist/cli/index.js` present) — zip artifacts already include `dist/`

## Install

### Option A: Shell installer (interactive / unpacked directory)

```bash
# unpack artifact, then:
cd ~/.hireko/plugins/HirekoOpenPlugin   # or your unpack dir
./install.sh --only=hermes
```

### Option B: Headless Dockerfile build (`install-hermes-plugins.py`)

```dockerfile
# In Dockerfile:
COPY . /tmp/HirekoOpenPlugin
COPY install-hermes-plugins.py /tmp/install-hermes-plugins.py
RUN chmod 0555 /tmp/install-hermes-plugins.py \
    && python3 /tmp/install-hermes-plugins.py
```

Both methods will:

1. Copy the package to `~/.hermes/plugins/HirekoOpenPlugin`
2. `hermes mcp add` with absolute `node` + `serve`, env `HIREKO_CREDENTIAL_STORE=file`
3. Install the skill under `~/.hermes/skills/HirekoOpenPlugin`

Verify:

```bash
hermes mcp list
hermes mcp test HirekoOpenPlugin
HirekoOpenPlugin doctor
```

## Auth (important for remote Docker)

Both headless options supply the exact same **credential triplet** `(tenant, username, password)`:

| Method | Works in Lightsail Docker? | Format & Example |
|--------|----------------------------|-------------------|
| **Plain-env triplet** (Recommended) | **Yes** | Individual env vars: `HirekoOpenPlugin_tenant="mycompany"`, `HirekoOpenPlugin_username="u@x.com"`, `HirekoOpenPlugin_password="pass"` |
| **`HIREKO_INTERNAL_API_KEY`** | **Yes** | Base64 JSON of triplet: `{"tenant":"mycompany","username":"u@x.com","password":"pass"}` |
| MCP/CLI **password** `login` | **Yes** | Password supplied directly to `login` tool |
| **Device / browser** `login_browser` | Only with SSH tunnel | Tunnel ports `8700-8799` to container |

Device login POSTs tokens to `http://127.0.0.1:87xx` on the MCP host. A laptop browser cannot reach a container’s loopback without a tunnel:

```bash
ssh -L 8712:127.0.0.1:8712 <lightsail-host>
# then open the printed /devicelogin URL on the laptop
```

## Persistence

Mount a volume for the product home so sessions survive restarts:

```text
-v hermes-hireko-data:/root/.HirekoOpenPlugin
```

(or set `HIREKO_HOME` to a mounted path). Config defaults to `~/.<pluginName>/config.json`.

## Optional env

| Env | Purpose |
|-----|---------|
| `<PLUGIN_NAME>_tenant`, `_username`, `_password` | Headless auto-login: Plain-env triplet (no base64 encoding needed) |
| `HIREKO_INTERNAL_API_KEY` | Headless auto-login: Base64 JSON of `{"tenant","username","password"}` |
| `HIREKO_CREDENTIAL_STORE=file` | Force file store (default in containers) |
| `HIREKO_IN_CONTAINER=1` | Force container detection / doctor hints |
| `HIREKO_HOME=/data` | Override product home (credentials, cache, run) |
| `PLUGIN_NAME=HirekoOpenPlugin` | Identity if folder rename is awkward |
