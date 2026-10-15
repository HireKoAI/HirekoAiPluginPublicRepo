/**
 * Parse free-form /HirekoOpenPlugin (or CLI) args into login_browser inputs.
 *
 * Examples:
 *   "test"                  → { tenant: "test" }  // stage from plugin deploy
 *   "prod test"             → { tenant: "test", stage: "prod" }
 *   "test beta"             → { tenant: "test", stage: "beta" }
 *   "test local 8080"       → { tenant: "test", localPort: 8080 }
 *   "test with local 4200"  → { tenant: "test", localPort: 4200 }
 *   "prod test local 8080"  → { tenant: "test", stage: "prod", localPort: 8080 }
 */
const FILLER = new Set(["with", "on", "at", "tenant", "for", "the", "a", "an"]);
function parseLocalPortToken(tok) {
    const m = /^(?:local[=:]?)?(\d{2,5})$/i.exec(tok);
    if (!m)
        return undefined;
    const port = Number(m[1]);
    if (!Number.isInteger(port) || port < 1 || port > 65535)
        return undefined;
    return port;
}
export function localDeviceLoginOrigin(port) {
    return `http://127.0.0.1:${port}`;
}
/** Resolve optional dashboard origin override from structured tool/CLI args. */
export function resolveDeviceLoginOrigin(opts) {
    const raw = opts.deviceLoginOrigin?.trim();
    if (raw)
        return raw.replace(/\/$/, "");
    if (opts.localPort !== undefined) {
        const port = Number(opts.localPort);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(`invalid localPort: ${opts.localPort}`);
        }
        return localDeviceLoginOrigin(port);
    }
    return undefined;
}
export function parseLoginIntent(raw) {
    const tokens = raw.trim().split(/\s+/).filter(Boolean);
    const out = {};
    const positional = [];
    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        const lower = tok.toLowerCase();
        if (lower === "beta" || lower === "prod") {
            out.stage = lower;
            continue;
        }
        if (FILLER.has(lower))
            continue;
        if (lower === "local" || lower.startsWith("local=") || lower.startsWith("local:")) {
            const inline = parseLocalPortToken(tok);
            if (inline !== undefined) {
                out.localPort = inline;
                continue;
            }
            const next = tokens[i + 1];
            if (next) {
                const port = parseLocalPortToken(next);
                if (port !== undefined) {
                    out.localPort = port;
                    i += 1;
                    continue;
                }
            }
            continue;
        }
        const asPortOnly = /^\d{2,5}$/.test(tok) ? Number(tok) : undefined;
        if (asPortOnly !== undefined &&
            out.localPort === undefined &&
            (out.tenant !== undefined || positional.length > 0)) {
            // Bare port after tenant (e.g. "test 8080") only if we already saw tenant-ish text.
            // Prefer treating first word as tenant; numeric alone after tenant → localPort.
            if (out.tenant || positional.length > 0) {
                out.localPort = asPortOnly;
                continue;
            }
        }
        positional.push(tok);
    }
    if (positional[0])
        out.tenant = positional[0];
    if (positional[1])
        out.username = positional[1];
    if (positional[2])
        out.password = positional.slice(2).join(" ");
    return out;
}
//# sourceMappingURL=parse-login-intent.js.map