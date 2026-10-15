import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { generateOAuthState, usernameFromIdToken } from "./pkce.js";
import { remoteDeviceLoginHint } from "../util/runtime-env.js";
import { resolveAuthStage } from "./tenant-config.js";
const execFileAsync = promisify(execFile);
/** Loopback ports for RecruiterDashboard CLI hand-off (87xx). */
export const LOOPBACK_PORT_MIN = 8700;
export const LOOPBACK_PORT_MAX = 8799;
export const LOOPBACK_CALLBACK_PATH = "/oauth/callback";
export const LOOPBACK_PING_PATH = "/oauth/ping";
/**
 * Existing Cognito SPA redirect — kept for helpers / compatibility messaging.
 */
export function tenantOAuthRedirectUri(tenant, stage) {
    const slug = tenant.trim().toLowerCase();
    const host = stage === "beta" ? `recruiter-${slug}.beta.hireko.ai` : `recruiter-${slug}.hireko.ai`;
    return `https://${host}/`;
}
/** Custom dashboard page: username/password → tokens → loopback (not Hosted UI). */
export function tenantDeviceLoginUrl(tenant, stage, state, originOverride) {
    const q = new URLSearchParams({ state });
    if (originOverride) {
        const origin = originOverride.replace(/\/$/, "");
        return `${origin}/devicelogin?${q.toString()}`;
    }
    const slug = tenant.trim().toLowerCase();
    const host = stage === "beta" ? `recruiter-${slug}.beta.hireko.ai` : `recruiter-${slug}.hireko.ai`;
    return `https://${host}/devicelogin?${q.toString()}`;
}
/** True only for plain http(s) URLs — guards the browser opener against
 * file:/javascript:/data: schemes and other non-URL inputs that could be
 * injected via model-controlled args (tenant / deviceLoginOrigin). */
function isSafeBrowserUrl(url) {
    try {
        const p = new URL(url);
        return p.protocol === "http:" || p.protocol === "https:";
    }
    catch {
        return false;
    }
}
/** Tenant dashboard origin for the given stage (no path). */
export function tenantDashboardOrigin(tenant, stage) {
    const slug = tenant.trim().toLowerCase();
    const host = stage === "beta" ? `recruiter-${slug}.beta.hireko.ai` : `recruiter-${slug}.hireko.ai`;
    return `https://${host}`;
}
/** @deprecated Use tenantOAuthRedirectUri */
export const deviceLoginRedirectUri = tenantOAuthRedirectUri;
export function encodeOAuthState(port, nonce = generateOAuthState()) {
    return `hkdev.${port}.${nonce}`;
}
export function parsePortFromOAuthState(state) {
    const m = /^hkdev\.(\d+)\./.exec(state);
    if (!m)
        return undefined;
    const port = Number(m[1]);
    if (port < LOOPBACK_PORT_MIN || port > LOOPBACK_PORT_MAX)
        return undefined;
    return port;
}
async function defaultOpenBrowser(url) {
    const platform = process.platform;
    if (platform === "darwin") {
        await execFileAsync("open", [url]);
        return;
    }
    if (platform === "win32") {
        // Never use `powershell -Command "<url>"`: PowerShell evaluates `$(...)`
        // subexpressions inside the command string, so a crafted deviceLoginOrigin
        // or tenant (model-controlled args that flow into `url`) would execute
        // arbitrary commands on the host (RCE). `cmd /c start` passes the URL as a
        // literal, Node-escaped argument to ShellExecute instead — `$(...)` is
        // inert cmd syntax and `&`/`"` are handled by Node's arg escaping.
        await execFileAsync("cmd.exe", ["/c", "start", "", url]);
        return;
    }
    await execFileAsync("xdg-open", [url]);
}
function listen(server, port) {
    return new Promise((resolve, reject) => {
        const onError = (err) => {
            server.off("listening", onListening);
            reject(err);
        };
        const onListening = () => {
            server.off("error", onError);
            resolve();
        };
        server.once("error", onError);
        server.once("listening", onListening);
        server.listen(port, "127.0.0.1");
    });
}
async function bindLoopbackPort(server, preferred) {
    const ports = [];
    if (preferred !== undefined)
        ports.push(preferred);
    for (let p = LOOPBACK_PORT_MIN; p <= LOOPBACK_PORT_MAX; p++) {
        if (p !== preferred)
            ports.push(p);
    }
    let lastErr;
    for (const port of ports) {
        try {
            await listen(server, port);
            return port;
        }
        catch (err) {
            lastErr = err;
        }
    }
    throw lastErr instanceof Error
        ? lastErr
        : new Error(`No free loopback port in ${LOOPBACK_PORT_MIN}-${LOOPBACK_PORT_MAX}`);
}
const SUCCESS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Signed in</title>
    <style>
      body {
        margin: 0;
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
          "Apple Color Emoji", "Segoe UI Emoji";
        background: radial-gradient(120% 80% at 50% 0%, #1f2937 0%, #0b1220 60%, #05070f 100%);
        color: #e5e7eb;
      }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem 1rem; }
      .card {
        width: min(42rem, 100%);
        border-radius: 1rem;
        background: rgba(17, 24, 39, 0.72);
        border: 1px solid rgba(148, 163, 184, 0.25);
        box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.35);
        padding: 1.5rem;
      }
      h1 { margin: 0 0 0.5rem 0; font-size: 1.25rem; }
      p { margin: 0; color: rgba(229, 231, 235, 0.9); line-height: 1.45; }
      .hint { margin-top: 1rem; font-size: 0.95rem; color: rgba(229, 231, 235, 0.75); }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>Signed in</h1>
        <p>Your command-line session has been authenticated successfully.</p>
        <div class="hint">This tab will close automatically.</div>
      </div>
    </div>
    <script>setTimeout(() => window.close(), 1400);</script>
  </body>
</html>`;
function parseTokenParams(params, expectedState) {
    const err = params.get("error");
    if (err) {
        const desc = params.get("error_description") ?? err;
        throw new Error(`Device login error: ${desc}`);
    }
    const gotState = params.get("state");
    if (gotState !== expectedState) {
        throw new Error("OAuth callback state mismatch");
    }
    const accessToken = params.get("access_token");
    if (!accessToken) {
        throw new Error("OAuth callback missing access_token (use /devicelogin username/password)");
    }
    const expiresRaw = params.get("expires_in");
    const expiresIn = expiresRaw ? Number(expiresRaw) : undefined;
    return {
        accessToken,
        idToken: params.get("id_token") ?? undefined,
        refreshToken: params.get("refresh_token") ?? undefined,
        expiresIn: expiresIn !== undefined && Number.isFinite(expiresIn) ? expiresIn : undefined,
        tokenType: params.get("token_type") ?? undefined,
    };
}
function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        req.on("error", reject);
    });
}
async function parseCallbackRequest(req, url, expectedState) {
    if (req.method === "POST") {
        const raw = await readRequestBody(req);
        const ctype = String(req.headers["content-type"] ?? "");
        if (ctype.includes("application/json")) {
            const json = JSON.parse(raw || "{}");
            const params = new URLSearchParams();
            for (const [k, v] of Object.entries(json)) {
                if (v !== undefined && v !== null)
                    params.set(k, String(v));
            }
            return parseTokenParams(params, expectedState);
        }
        return parseTokenParams(new URLSearchParams(raw), expectedState);
    }
    return parseTokenParams(url.searchParams, expectedState);
}
/**
 * Opens RecruiterDashboard /devicelogin (username/password).
 * Dashboard forwards tokens to local 87xx — does not log into the SPA.
 */
export async function browserOAuthLogin(opts, deps = {}) {
    const stage = opts.stage ?? resolveAuthStage();
    let boundPort = 0;
    let expectedState = "";
    const tokens = await new Promise((resolve, reject) => {
        const timeoutMs = opts.timeoutMs ?? 300_000;
        const server = http.createServer((req, res) => {
            void (async () => {
                try {
                    const url = new URL(req.url ?? "/", `http://127.0.0.1:${boundPort}`);
                    const origin = req.headers.origin ?? "*";
                    res.setHeader("Access-Control-Allow-Origin", origin);
                    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                    res.setHeader("Access-Control-Allow-Private-Network", "true");
                    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
                    if (req.method === "OPTIONS") {
                        res.writeHead(204);
                        res.end();
                        return;
                    }
                    if (url.pathname === LOOPBACK_PING_PATH) {
                        res.writeHead(204);
                        res.end();
                        return;
                    }
                    // Agents/users sometimes open 127.0.0.1:<87xx>/devicelogin (the CLI
                    // port from state) instead of the RecruiterDashboard host — that used
                    // to be a raw 404. Send them to the real SPA route.
                    if (url.pathname === "/devicelogin" || url.pathname === "/devicelogin/") {
                        const dest = tenantDeviceLoginUrl(opts.tenant, stage, expectedState || url.searchParams.get("state") || encodeOAuthState(boundPort || LOOPBACK_PORT_MIN), opts.deviceLoginOrigin);
                        res.writeHead(302, { Location: dest, "cache-control": "no-store" });
                        res.end();
                        return;
                    }
                    if (url.pathname !== LOOPBACK_CALLBACK_PATH) {
                        res.writeHead(404);
                        res.end("not found");
                        return;
                    }
                    let parsed;
                    try {
                        parsed = await parseCallbackRequest(req, url, expectedState);
                    }
                    catch (e) {
                        const msg = e instanceof Error ? e.message : "Invalid callback";
                        // Stale tabs from prior logins often hit this port with an old state.
                        // Reject the request but keep listening for the matching callback.
                        // eslint-disable-next-line no-console
                        console.warn(`Ignoring callback (${msg}); still waiting for state=${expectedState}`);
                        res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
                        res.end(JSON.stringify({ ok: false, error: msg }));
                        return;
                    }
                    if (req.method === "POST") {
                        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                        res.end(SUCCESS_HTML);
                    }
                    else {
                        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
                        res.end(SUCCESS_HTML);
                    }
                    resolve(parsed);
                    server.close();
                }
                catch (e) {
                    reject(e);
                    server.close();
                }
            })();
        });
        const timer = setTimeout(() => {
            server.close();
            reject(new Error(`Device login timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);
        server.on("close", () => clearTimeout(timer));
        void (async () => {
            try {
                boundPort = await bindLoopbackPort(server, deps.listenPort);
                expectedState = encodeOAuthState(boundPort);
                const origin = opts.deviceLoginOrigin?.replace(/\/$/, "") ?? tenantDashboardOrigin(opts.tenant, stage);
                const loginUrl = tenantDeviceLoginUrl(opts.tenant, stage, expectedState, opts.deviceLoginOrigin);
                if (!isSafeBrowserUrl(loginUrl)) {
                    throw new Error("refusing to open an unsafe login URL (expected http/https)");
                }
                const opener = deps.openBrowser ?? (opts.openBrowser === false ? undefined : defaultOpenBrowser);
                // eslint-disable-next-line no-console
                console.log([
                    "",
                    "Device login",
                    `  tenant:   ${opts.tenant}`,
                    `  stage:    ${stage}`,
                    `  origin:   ${origin}`,
                    `  loopback: http://127.0.0.1:${boundPort}/oauth/callback`,
                    `  open this URL:`,
                    `  ${loginUrl}`,
                    "",
                    "Waiting for /devicelogin to hand tokens to the local CLI…",
                    "",
                ].join("\n"));
                const remoteHint = remoteDeviceLoginHint();
                if (remoteHint) {
                    // eslint-disable-next-line no-console
                    console.warn(`\n⚠ ${remoteHint}\n`);
                }
                if (opener) {
                    await opener(loginUrl).catch((e) => {
                        // eslint-disable-next-line no-console
                        console.error(`Could not open the default browser (${e.message}). Paste the URL above into a browser that can reach this host's loopback (same machine or SSH -L ${boundPort}:127.0.0.1:${boundPort}).`);
                    });
                }
            }
            catch (e) {
                server.close();
                reject(e);
            }
        })();
    });
    const now = deps.now ?? Date.now;
    const session = {
        tenant: opts.tenant,
        username: usernameFromIdToken(tokens.idToken) ?? "oauth-user",
        accessToken: tokens.accessToken,
        idToken: tokens.idToken,
        refreshToken: tokens.refreshToken,
        expiresAt: tokens.expiresIn !== undefined && Number.isFinite(tokens.expiresIn)
            ? now() + tokens.expiresIn * 1000
            : undefined,
        tokenType: tokens.tokenType,
    };
    // eslint-disable-next-line no-console
    console.log(`Loopback received tokens for ${session.username} (refresh=${Boolean(session.refreshToken)}).`);
    return session;
}
/** @deprecated alias */
export const browserPkceLogin = browserOAuthLogin;
//# sourceMappingURL=oauth-browser-login.js.map