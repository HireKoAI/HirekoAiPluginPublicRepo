---
description: HirekoOpenPlugin — browser sign-in or status (plugin name is HirekoOpenPlugin)
argument-hint: "[stage] <tenant> [local <port>] | status"
---

Plugin name: **HirekoOpenPlugin** (not hireko).

If $ARGUMENTS is empty or is exactly `status` / `auth` / `whoami`:
1. Call `auth_status` once.
2. Print authenticated, tenant, username, stage, proxy.human, healthy/total, toolsIndexed.
3. If unauthenticated: print usage `/HirekoOpenPlugin <tenant>`. Stop.
4. Never invent URLs or echo tokens.

Otherwise treat $ARGUMENTS as login args:

1. Whole-word `beta` or `prod` → stage (else omit; local installs → beta).
2. `local <port>` / `local:PORT` / `local=PORT` → localPort.
3. First remaining non-keyword word → tenant.
4. Optional trailing username password only for password-login fallback.

If no tenant after parse: call `auth_status`; print usage; stop.

Else:
1. Call `auth_status` once.
2. If already authenticated for that tenant, report and stop.
3. Else call `login_browser` once with `{ tenant, stage?, localPort? }`.
4. Print auth/error, stage, localPort if any, human URL, hasRefresh. Always print the device-login URL when present. Never echo a password.
