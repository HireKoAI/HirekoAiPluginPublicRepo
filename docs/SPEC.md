# Build Hireko Local MCP Meta-Proxy / Semantic Tool Router

You are a senior systems engineer building a production-quality local MCP gateway called **Hireko MCP Router**.

Implement the application completely. Do not stop at an architecture document. Create the source code, tests, example configuration, installer, CLI, README, and working local demo.

The goal is to let Claude Code, Codex, or another MCP-compatible coding agent connect to **one local MCP server** while that local server manages potentially hundreds of downstream MCP servers and 1,000+ tools.

The system must solve two problems simultaneously:

1. Authenticate the human once against AWS Cognito and automatically inject a valid JWT into every downstream MCP request.
2. Prevent 1,000+ downstream tool definitions from flooding the model context by exposing a tiny semantic routing layer and discovering tools only when needed.

Study these projects for implementation ideas, but do not blindly copy one project:

- `M8T-Jacob/mcp-lens` — PRIMARY inspiration for lazy tool discovery, meta-tools, tool catalog, semantic/text ranking, and proxying.
- `HarrisonCN/mcp-gateway` — inspiration for registry, routing, config reload, transport abstraction, tool namespacing, health handling.
- `stephaneberle9/authsome-mcp-proxy` — PRIMARY inspiration for local MCP authentication proxying, OIDC/Cognito, token handling, and outbound bearer injection.
- `kaichen/mcp-local-router` — inspiration for simple local aggregation of multiple MCP servers.
- Do NOT base the architecture on `IBM-Cloud/Bluemix-ContextPathRouting`; it is unrelated old Cloud Foundry path routing.

---

# 1. Technology

Use:

- TypeScript
- Node.js 20+
- official `@modelcontextprotocol/sdk`
- AWS SDK v3 for Cognito
- Zod for runtime configuration validation
- Vitest for tests
- npm package with a CLI binary
- strict TypeScript

Preferred package/binary names:

```text
Package: @hireko/mcp-router
CLI: hireko
MCP server name: hireko
```

The host-facing transport must primarily be **stdio**, because this is a local MCP plugin/process launched by Claude Code or Codex.

No browser application.
No dashboard.
No web UI.
No database.
No SQLite.
No Redis.
No DynamoDB.

Configuration and optional caches are files only.

Runtime catalog/search state should be held in memory.

---

# 2. High-Level Architecture

Implement this architecture:

```text
                         Claude Code / Codex
                                  |
                                  |
                         ONE local MCP server
                                  |
                         @hireko/mcp-router
                                  |
             +--------------------+--------------------+
             |                    |                    |
       Authentication       Tool Registry       Context Router
       AWS Cognito          1,000+ tools        search/rank
             |                    |                    |
             +--------------------+--------------------+
                                  |
                         Downstream MCP Proxy
                                  |
              +-------------------+-------------------+
              |                   |                   |
          MCP Server A        MCP Server B        MCP Server N
          50 tools            200 tools           300 tools
```

The Hireko process is simultaneously:

- an MCP **server** toward Claude/Codex
- an MCP **client** toward every downstream MCP server
- an authentication proxy
- an in-memory MCP registry
- a contextual tool router

It is NOT an autonomous LLM agent.

Do not call an LLM just to decide which MCP tool to use in the MVP.

---

# 3. Core Principle: Never Expose 1,000 Tool Definitions Up Front

This requirement is critical.

At initial MCP connection, `tools/list` MUST NOT flatten and return all downstream tools.

That would defeat the entire purpose of the project.

Initially expose only a very small set of Hireko meta-tools such as:

```text
discover_tools
describe_tool
call_tool
list_servers
reload_registry
auth_status
```

Keep the initial host-facing schema extremely small.

The downstream tool catalog can contain 1,000, 5,000, or more tools, but those schemas must stay outside the model context until needed.

---

# 4. MCP Protocol Correctness

Do NOT invent a nonstandard:

```text
tools/list(context="...")
```

Standard MCP `tools/list` is controlled by the MCP client and does not provide arbitrary task context.

Instead expose:

```text
discover_tools(context, options)
```

as a regular MCP tool.

Example:

```json
{
  "context": "I need to look up a candidate in the recruiting CRM and retrieve their interview history",
  "limit": 12
}
```

The router searches its internal catalog and returns only relevant tools.

Support two routing modes.

## Mode A — Meta Proxy Mode

This MUST be implemented and be the default because it is universally reliable.

Flow:

```text
Model
  |
  | discover_tools(context)
  v
Hireko
  |
  | relevant tool descriptors
  v
Model
  |
  | call_tool(toolRef, arguments)
  v
Hireko
  |
  | authenticated tools/call
  v
Actual downstream MCP
```

## Mode B — Dynamic Tool Activation

Implement behind a feature flag.

Example config:

```json
{
  "routing": {
    "mode": "meta",
    "dynamicToolActivation": false
  }
}
```

When enabled:

1. `discover_tools(context)` determines the relevant subset.
2. Store the selected subset in that MCP session's in-memory state.
3. Send `notifications/tools/list_changed`.
4. A subsequent `tools/list` can return the Hireko meta-tools plus only the activated downstream tools.
5. Proxy calls to those activated tools directly.

Never expose the entire fleet unless explicitly requested.

If a particular MCP client does not reliably support dynamic tool-list changes, gracefully remain in Meta Proxy Mode.

---

# 5. Tool Discovery API

Implement:

```text
discover_tools
```

Input:

```json
{
  "context": "free text describing what capability is needed",
  "limit": 10,
  "mode": "relevant",
  "server": null,
  "tags": []
}
```

`mode` values:

```text
relevant
all
```

Behavior:

### relevant

Rank tools using the supplied context and return only the best matches.

### all

Explicitly return the flattened catalog.

This is the escape hatch for:

```text
show me every tool
```

Do NOT register every result as an MCP tool merely because `mode=all`.

Return them as structured data.

Support pagination for very large `all` results.

Each discovery result should look similar to:

```json
{
  "toolRef": "recruiting.search_candidate",
  "server": "recruiting",
  "name": "search_candidate",
  "description": "Search candidates by name, email, phone, or external identifier.",
  "score": 0.93,
  "tags": ["candidate", "crm", "search"],
  "requiresAuth": true
}
```

Do not return the full JSON schema for every result unless explicitly requested.

---

# 6. describe_tool

Implement:

```text
describe_tool(toolRef)
```

Example:

```json
{
  "toolRef": "recruiting.search_candidate"
}
```

Return:

- server
- original downstream tool name
- description
- full input schema
- annotations if supplied by downstream MCP
- tags
- transport
- health status

This lets the model inspect one schema only when it actually intends to use it.

---

# 7. call_tool

Implement:

```text
call_tool(toolRef, arguments)
```

Example:

```json
{
  "toolRef": "recruiting.search_candidate",
  "arguments": {
    "email": "person@example.com"
  }
}
```

The router must:

```text
resolve toolRef
      ↓
determine downstream MCP server
      ↓
obtain valid Cognito access token
      ↓
refresh token if required
      ↓
inject Authorization header
      ↓
invoke downstream MCP tools/call
      ↓
return downstream result unchanged where possible
```

Do not let the model supply or override authentication headers.

---

# 8. Tool Naming and Collision Handling

There may be 1,000 tools and many servers can contain tools with identical names.

Internally always identify tools using:

```text
<serverId>.<toolName>
```

For example:

```text
github.create_issue
recruiting.create_issue
jira.create_issue
```

Never rely on globally unique downstream tool names.

Store:

```ts
interface ToolRecord {
  ref: string;
  serverId: string;
  name: string;
  title?: string;
  description?: string;
  inputSchema: unknown;
  annotations?: unknown;
  tags: string[];
  searchableText: string;
}
```

---

# 9. Search / Context Routing

Do NOT use an LLM for routing in version 1.

Create:

```ts
interface ToolScorer {
  score(context: string, tool: ToolRecord): number;
}
```

Implement a deterministic scorer.

Consider:

- normalized exact name matches
- token matches
- server name
- tags
- description
- input-schema property names
- prefix matching
- phrase matching
- BM25 or TF-IDF-style relevance

Weight tool names and tags more strongly than long descriptions.

Example conceptual weighting:

```text
tool name        4x
tags             3x
server name      2x
description      1x
schema fields    1x
```

Keep the interface pluggable so a future implementation can add:

```text
EmbeddingToolScorer
ModelToolScorer
HybridToolScorer
```

without changing the registry or MCP protocol.

Search across 5,000 tools should feel effectively instantaneous on a developer laptop.

---

# 10. Registry

Configuration is file-driven.

Example:

```json
{
  "version": 1,

  "activeTenant": "hireko",

  "tenants": {
    "hireko": {
      "cognito": {
        "region": "us-west-2",
        "userPoolId": "us-west-2_EXAMPLE",
        "clientId": "EXAMPLE_CLIENT_ID",
        "authMode": "password",
        "tokenToForward": "access"
      }
    }
  },

  "servers": {
    "recruiting": {
      "transport": "streamable-http",
      "url": "https://example.com/recruiting/mcp",
      "tags": ["recruiting", "candidate", "crm"],
      "enabled": true
    },

    "calendar": {
      "transport": "streamable-http",
      "url": "https://example.com/calendar/mcp",
      "tags": ["calendar", "meeting", "scheduling"],
      "enabled": true
    },

    "internal-search": {
      "transport": "streamable-http",
      "url": "https://example.com/search/mcp",
      "tags": ["search", "company-data"],
      "enabled": true
    }
  },

  "authHeaders": {
    "authorization": "Bearer ${ACCESS_TOKEN}",
    "tenant": {
      "name": "X-Tenant",
      "value": "${TENANT}"
    }
  },

  "routing": {
    "mode": "meta",
    "defaultLimit": 12,
    "maxResults": 50,
    "dynamicToolActivation": false
  }
}
```

Support JSON initially.

Design configuration loading behind an interface so YAML can be added later.

Default config locations:

```text
./hireko.mcp.json
~/.hireko/config.json
```

Explicit CLI `--config` wins.

---

# 11. Registry Startup Behavior

Do not eagerly open 100 simultaneous permanent connections unless necessary.

At startup:

1. Load configuration.
2. Validate it.
3. Initialize authentication manager.
4. Initialize server registry.
5. Discover downstream tool metadata with bounded concurrency.
6. Build the in-memory searchable catalog.
7. Start serving the local stdio MCP endpoint.

Connections should be lazy/reusable where practical.

One unavailable MCP server must not prevent the remaining fleet from working.

Record failure status such as:

```json
{
  "server": "calendar",
  "status": "unavailable",
  "lastError": "connection timeout"
}
```

Do not crash the entire router because one MCP is down.

---

# 12. AWS Cognito Authentication

Authentication is shared by all downstream MCP endpoints unless a future per-server override is configured.

The user experience should conceptually be:

```text
hireko login

Tenant: hireko
Username: user@example.com
Password: ********
```

Never echo passwords.

Never log passwords.

Never put passwords in the MCP conversation.

Never put passwords in Claude/Codex context.

Never persist passwords.

Important distinction:

When `authMode=password`, use the Cognito API authentication flow such as `USER_PASSWORD_AUTH`.

Do not incorrectly describe that password flow internally as an OAuth authorization-code flow.

It still produces Cognito ID/access/refresh tokens.

Also architect an optional:

```text
authMode=pkce
```

for Cognito OAuth Authorization Code + PKCE later.

Implement password mode first.

---

# 13. Cognito Password Authentication

Use AWS SDK v3 Cognito Identity Provider.

Support:

```text
USER_PASSWORD_AUTH
```

using:

```text
USERNAME
PASSWORD
```

If the Cognito app client has a client secret, correctly support the required secret-hash behavior.

Handle Cognito challenges cleanly, including where feasible:

```text
NEW_PASSWORD_REQUIRED
SMS_MFA
SOFTWARE_TOKEN_MFA
SELECT_MFA_TYPE
MFA_SETUP
```

Design challenge handling behind an interface.

For the first implementation, username/password with no challenge must work end-to-end, but the code must not paint us into a corner.

---

# 14. Token Manager

Create something similar to:

```ts
interface TokenProvider {
  login(input: LoginInput): Promise<AuthSession>;
  getAccessToken(): Promise<string>;
  refresh(): Promise<AuthSession>;
  logout(): Promise<void>;
  status(): AuthStatus;
}
```

Track:

```text
access token
ID token
refresh token
expiration
tenant
username
```

Do not persist the password.

Use the Cognito **access token** by default for downstream:

```http
Authorization: Bearer <access-token>
```

Allow configuration:

```json
{
  "tokenToForward": "access"
}
```

or:

```json
{
  "tokenToForward": "id"
}
```

but access token is the default.

Refresh proactively before expiration, for example with a configurable safety window around 60 seconds.

Support Cognito refresh-token behavior correctly, including app clients where refresh-token rotation changes which Cognito API should be used.

Only one token refresh may execute concurrently.

If 20 tools discover the token is expiring simultaneously, all 20 calls should await the same refresh promise instead of making 20 refresh requests.

---

# 15. Credential Storage

"No database" refers to application state and tool registry state.

Do not store credentials in the regular JSON registry.

Password must only exist in process memory during authentication.

Prefer OS-native secure credential storage for refresh tokens where practical:

```text
macOS Keychain
Windows Credential Manager
Linux Secret Service
```

If secure storage is unavailable, allow a documented local development fallback using a user-only file with restrictive permissions.

Never silently store raw passwords.

Provide:

```text
hireko login
hireko logout
hireko auth status
```

---

# 16. Authentication Injection

All HTTP-based downstream MCP requests should go through one request/auth layer.

Create an abstraction similar to:

```ts
interface AuthenticatedTransportFactory {
  create(server: ServerConfig): Promise<McpTransport>;
}
```

Before each authenticated HTTP MCP request:

```text
token = await tokenProvider.getAccessToken()

Authorization: Bearer <token>
X-Tenant: <tenant>
```

Make custom forwarded headers configurable.

The model cannot override protected headers such as:

```text
Authorization
X-Tenant
Cookie
```

unless explicitly permitted by configuration.

---

# 17. Downstream Transports

Primary supported downstream transport:

```text
Streamable HTTP
```

Also support:

```text
stdio
SSE
```

where practical using the official MCP SDK abstractions.

For HTTP transports, JWT injection occurs per request.

For local stdio downstream servers, authentication must be handled separately because HTTP headers don't exist. If configured, token/tenant values may be injected into environment variables at process creation.

Document the limitation that rotating a token passed only through child-process environment variables can require that child connection to be restarted.

Do not compromise the clean HTTP implementation to work around this edge case.

---

# 18. File Reload

Users will edit the registry file frequently.

Implement:

```text
hireko reload
```

and MCP tool:

```text
reload_registry
```

Reload must:

```text
re-read config
diff server registry
disconnect removed servers
add new servers
refresh changed server metadata
rebuild search catalog
preserve valid authentication session
not restart unaffected downstream connections unnecessarily
```

Also optionally support file watching:

```json
{
  "watchConfig": true
}
```

with debounce.

A malformed updated config must not destroy the currently working configuration.

Validate new configuration first and swap it atomically.

---

# 19. /hireko Experience

The desired human experience is:

```text
/hireko
```

Treat `/hireko` as a **client integration adapter**, not as part of the core MCP protocol.

The core must always work independently through:

```text
hireko login
hireko reload
hireko status
```

and the MCP meta-tools.

For Claude Code, provide the most natural supported local command/skill/prompt integration that can produce a Hireko command experience.

For Codex, use the currently supported Codex Skill/plugin mechanisms rather than depending on deprecated custom-prompt functionality.

If a client cannot support an exact `/hireko` alias, do not hack the MCP protocol.

Instead provide the nearest native invocation and document it.

The integration should perform/check:

```text
authentication status
registry status
number of configured MCP servers
number of discovered tools
failed servers
last config reload
```

If unauthenticated, it should direct the user into the local secure authentication flow without asking the model itself to collect the user's password.

Passwords must never appear in model conversation history.

---

# 20. Important STDIO Constraint

The local MCP server uses stdin/stdout for JSON-RPC.

Therefore:

**Never print prompts, logs, banners, or authentication text to stdout while operating as an MCP stdio server.**

That would corrupt the MCP protocol.

All logs must go to stderr.

Interactive credential collection belongs in the separate:

```text
hireko login
```

CLI mode, not inside JSON-RPC stdin/stdout.

If you create any interactive MCP-host integration, it must not interfere with the MCP protocol stream.

---

# 21. Host Configuration

Generate examples for Claude Code and Codex.

For Claude-style `.mcp.json`, create an example roughly equivalent to:

```json
{
  "mcpServers": {
    "hireko": {
      "command": "npx",
      "args": [
        "-y",
        "@hireko/mcp-router",
        "serve"
      ]
    }
  }
}
```

Also support a globally installed binary:

```json
{
  "mcpServers": {
    "hireko": {
      "command": "hireko",
      "args": ["serve"]
    }
  }
}
```

Create the corresponding currently supported Codex MCP configuration or installation command.

The user should configure ONE host MCP server only:

```text
hireko
```

All other MCPs live inside Hireko's registry file.

---

# 22. CLI

Implement:

```text
hireko init
hireko login
hireko logout
hireko auth status
hireko serve
hireko reload
hireko status
hireko servers
hireko tools
hireko tools search "<context>"
hireko doctor
```

Example:

```text
$ hireko status

Hireko MCP Router
Tenant: hireko
Authentication: valid
Token expires: 43m
Servers: 27
Healthy: 26
Unavailable: 1
Tools indexed: 1,143
Routing mode: meta
Config: ~/.hireko/config.json
```

Output CLI text to normal terminal stdout only when operating as CLI.

In `serve`/stdio MCP mode, stdout is reserved exclusively for MCP.

---

# 23. Tool Search CLI

For debugging, support:

```bash
hireko tools search "schedule an interview with a candidate"
```

Example output:

```text
0.96 calendar.create_event
0.93 recruiting.get_candidate
0.87 calendar.find_availability
0.81 recruiting.get_interviewer
```

This uses exactly the same scorer as the MCP `discover_tools` meta-tool.

---

# 24. Tool Catalog Caching

The authoritative configuration remains files.

The authoritative tool schemas remain the downstream MCP servers.

No database.

An optional JSON catalog snapshot may be used only as a startup optimization:

```text
~/.hireko/cache/catalog.json
```

It must be disposable.

Deleting the cache must never break the system.

Store enough metadata to determine whether the cache is stale.

Do not store authentication tokens in the catalog cache.

---

# 25. Hot Reload Safety

Config reload must use:

```text
load
   ↓
parse
   ↓
validate
   ↓
build candidate registry
   ↓
only then atomically swap active registry
```

Never destroy the active working registry before the replacement configuration has been validated.

---

# 26. Concurrency

There may be dozens or hundreds of downstream MCP servers.

Implement bounded concurrency for discovery.

For example:

```text
max 8 concurrent downstream initializations
```

Configurable.

Tool calls to unrelated downstream MCPs should run concurrently.

Protect:

```text
token refresh
registry reload
individual downstream reconnect
catalog rebuild
```

from races.

---

# 27. Connection Lifecycle

Downstream MCP connections should be lazy and reusable.

Behavior:

```text
first request
   ↓
connect
   ↓
reuse connection
   ↓
connection fails
   ↓
mark broken
   ↓
drop connection
   ↓
next request reconnects
```

Do not hammer failed MCP servers in a tight reconnect loop.

Use bounded exponential backoff.

---

# 28. Security Requirements

Never:

```text
log passwords
log complete JWTs
return JWTs to the model
put refresh tokens in MCP responses
allow tools to override Authorization
store passwords in config
execute arbitrary commands from untrusted remote metadata
```

Logs may display token fingerprints such as:

```text
token=eyJ...7ac2
```

but avoid enough material to reconstruct credentials.

Mask sensitive config values automatically.

Treat MCP tool descriptions and schemas as untrusted metadata.

Do not execute content found inside descriptions.

---

# 29. Observability

No dashboard.

Use structured stderr logging.

Include fields similar to:

```text
requestId
serverId
toolRef
durationMs
authRefresh
status
errorCode
```

Do not log full tool arguments by default because they may contain sensitive information.

Allow:

```text
HIREKO_LOG_LEVEL=debug
```

---

# 30. Code Organization

Keep components loosely coupled.

Suggested structure:

```text
src/
  cli/
  config/
  auth/
  registry/
  catalog/
  routing/
  proxy/
  transports/
  mcp/
  logging/
  security/
```

Interfaces should make replacement easy.

Examples:

```text
TokenProvider
ToolScorer
RegistryLoader
ToolCatalog
McpConnection
TransportFactory
CredentialStore
```

Avoid giant files.

Prefer small focused modules.

No file should become an uncontrolled god object.

---

# 31. Tests

Create unit and integration tests covering at least:

```text
config parsing
invalid config rejection
1 server / multiple tools
multiple servers
duplicate tool names
1,000+ tool catalog
context ranking
mode=all
tool description lookup
tool proxying
JWT injection
expired access token
single-flight token refresh
authentication failure
unavailable downstream MCP
server reconnect
registry reload
bad registry reload rollback
removed MCP
new MCP
changed MCP
tool-list-changed dynamic mode
stdio output purity
no password logging
no JWT returned through MCP
```

Create fake/in-memory downstream MCP servers so tests do not depend on real external services.

Provide a separate optional Cognito integration test controlled by environment variables.

---

# 32. Performance Test

Generate at least:

```text
100 MCP servers
2,000 tools
```

in memory.

Verify:

```text
initial Hireko host-facing tool definitions remain tiny
search does not expose all schemas
search latency is reasonable
catalog memory consumption is reported
```

Add a benchmark command:

```bash
npm run benchmark
```

Print:

```text
Number of downstream servers
Number of downstream tools
Combined downstream schema bytes
Hireko initial schema bytes
Context reduction percentage
Average search latency
P95 search latency
```

---

# 33. Acceptance Scenario

Create an integration demonstration for this exact scenario.

Configuration contains:

```text
CRM MCP       300 tools
Recruiting    250 tools
Calendar      100 tools
Email         150 tools
Analytics     200 tools
```

Total:

```text
1,000 tools
```

Claude/Codex initially sees approximately:

```text
6 Hireko meta-tools
```

User asks:

```text
Find Lohith's candidate profile and tell me his last interview status.
```

Model calls:

```json
{
  "context": "Find a candidate profile and retrieve latest interview status",
  "limit": 8
}
```

Hireko should return relevant tools such as:

```text
recruiting.search_candidate
recruiting.get_interview_history
crm.search_person
crm.get_profile
```

It must NOT return calendar/email/analytics tools simply because they exist.

Then model calls:

```text
call_tool
```

Hireko:

```text
gets current Cognito token
injects Authorization header
routes call to recruiting MCP
returns result
```

The model never receives the JWT.

---

# 34. Explicit All-Tools Scenario

If the model asks:

```text
Show me every MCP tool currently registered.
```

it may call:

```json
{
  "mode": "all",
  "limit": 100
}
```

Hireko returns paginated flattened metadata.

This operation is intentionally explicit.

It must never happen automatically during MCP initialization.

---

# 35. Reload Scenario

Suppose the user edits:

```text
~/.hireko/config.json
```

and adds:

```text
salesforce
```

Then runs:

```text
hireko reload
```

or invokes the Hireko reload integration.

Expected:

```text
existing 1,000 tools remain available
new Salesforce server is connected
its tool metadata is indexed
search catalog updates
no user re-login if current Cognito session is still valid
```

The host should not need all 1,000+ schemas shoved back into its prompt.

---

# 36. Documentation

README must clearly explain:

```text
What problem Hireko solves
Architecture
Installation
Cognito setup
Login
Registering downstream MCPs
Claude Code setup
Codex setup
Tool discovery
Why all downstream tools are not exposed initially
How reload works
Token handling
Security model
Troubleshooting
```

Include Mermaid architecture diagrams.

---

# 37. Installation Experience

Target an experience roughly like:

```bash
npm install -g @hireko/mcp-router

hireko init

hireko login

claude mcp add hireko -- hireko serve
```

and equivalent supported Codex setup.

After setup, normal users should not manually launch the proxy.

Claude Code/Codex launches it automatically as the configured local stdio MCP process.

---

# 38. Do Not Overengineer the MVP

Do NOT add:

```text
Postgres
SQLite
Redis
DynamoDB
Kafka
SQS
vector database
web dashboard
React
Next.js
Kubernetes
LLM routing
multi-machine clustering
```

The whole point is that this is a lightweight local process.

Files + memory + MCP + Cognito.

---

# 39. Future Extension Points

Architect, but do not fully implement:

```text
embedding-based routing
LLM-based routing
per-server authentication
RBAC
per-tool permissions
remote registry
enterprise policy
multiple simultaneous tenant sessions
OpenTelemetry
remote shared Hireko gateway
```

Interfaces should make these additions possible later.

---

# 40. Implementation Order

Implement in this order:

```text
Phase 1
Local stdio MCP server with meta-tools

Phase 2
File-based downstream MCP registry

Phase 3
Downstream tool discovery and flattening into in-memory catalog

Phase 4
Deterministic contextual tool search

Phase 5
Generic call_tool proxy

Phase 6
AWS Cognito login/token provider

Phase 7
Automatic Authorization injection and refresh

Phase 8
Hot reload

Phase 9
Claude Code/Codex installation adapters

Phase 10
Dynamic tool activation experiment

Phase 11
Benchmarks, documentation, packaging
```

Do not attempt Phase 10 before the reliable Meta Proxy Mode works.

---

# 41. Definition of Done

The project is complete only when I can:

```bash
npm install
npm run build
npm test
npm run benchmark
```

and then:

```bash
hireko init
hireko login
hireko serve
```

configure Claude Code or Codex with exactly one Hireko MCP entry, connect several fake or real downstream MCP servers, index 1,000+ tools, search those tools from natural-language context without injecting all schemas into model context, and successfully call an authenticated downstream tool using a Cognito JWT that the model itself never sees.

Do not merely tell me how to build this.

Build it.

When you encounter an ambiguous implementation detail, choose the simplest standards-compliant solution, document the decision, and continue without waiting for clarification.