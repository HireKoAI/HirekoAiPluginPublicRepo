---
name: HirekoOpenPlugin
description: Sign in via browser device login for Hireko. Use when the user types /HirekoOpenPlugin or needs tenant auth before calling flattened MCP tools.
argument-hint: "[stage] <tenant> [local <port>]"
---

# HirekoOpenPlugin (Codex)

1. Prefer MCP `login_browser` with `{ tenant, stage?, localPort? }`.
2. If MCP is unavailable, run: `HirekoOpenPlugin login --browser --tenant <tenant> [--stage beta|prod] [--local-port <port>]`.
3. Print the device-login URL. Never echo passwords.
4. After auth, call flattened `server__tool` tools directly — do not invent Authorization headers. Optional: `filter_tools_with_query` to rank.
5. Status: call `auth_status` (includes proxy.human and toolsIndexed).
