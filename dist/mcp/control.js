import http from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { updateConfigFile } from "../config/writer.js";
import { tenantDeviceLoginUrl } from "../auth/oauth-browser-login.js";
import { resolveAuthStage } from "../auth/tenant-config.js";
import { withDefaultExtensionServers } from "../config/default-servers.js";
import { applyDefaultExtensionServers } from "../config/loader.js";
export async function startControlServer(opts) {
    const mcpTransports = new Map();
    for (const port of opts.ports) {
        const server = http.createServer((req, res) => void handle(req, res, opts, mcpTransports));
        const bound = await new Promise((resolve) => {
            server.once("error", () => resolve(false));
            server.listen(port, "127.0.0.1", () => resolve(true));
        });
        if (!bound)
            continue;
        opts.logger.info("control endpoint listening", { port, mcpHttp: Boolean(opts.createMcpServer) });
        return {
            port,
            close: () => new Promise((resolve) => {
                for (const t of mcpTransports.values())
                    void t.close().catch(() => { });
                mcpTransports.clear();
                server.close(() => resolve());
            }),
        };
    }
    opts.logger.warn("no free control port in range; control endpoint disabled", { tried: opts.ports });
    return undefined;
}
async function handle(req, res, opts, mcpTransports) {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const path = url.pathname;
    if (req.method === "GET" && (path === "/devicelogin" || path === "/devicelogin/")) {
        const tenant = opts.getConfig().activeTenant?.trim();
        if (!tenant) {
            res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
            res.end("not found");
            return;
        }
        const dest = tenantDeviceLoginUrl(tenant, resolveAuthStage(), url.searchParams.get("state") ?? "");
        res.writeHead(302, { Location: dest, "cache-control": "no-store" });
        res.end();
        return;
    }
    if (req.method === "GET" && (path === "/human" || path === "/human/"))
        return serveWeb(res, "index.html", "text/html; charset=utf-8");
    if (req.method === "GET" && (path === "/human/app.js" || path === "/app.js"))
        return serveWeb(res, "app.js", "text/javascript; charset=utf-8");
    if (req.method === "GET" && path === "/human/logo.png")
        return serveWeb(res, "logo.png", "image/png");
    if (req.method === "GET" && path === "/human/mark.png")
        return serveWeb(res, "mark.png", "image/png");
    if (req.method === "GET" && path === "/human/logo.svg")
        return serveWeb(res, "mark.png", "image/png");
    if (opts.createMcpServer && (path === "/mcp" || path === "/mcp/")) {
        // Same loopback origin gate as /api — browsers on non-localhost pages must not call tools.
        if (!allowedOrigin(req)) {
            res.writeHead(403, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: "origin not allowed" }));
            return;
        }
        return handleMcp(req, res, opts, mcpTransports);
    }
    if (!allowedOrigin(req)) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "origin not allowed" }));
        return;
    }
    try {
        if (req.method === "GET" && path === "/status")
            return json(res, await statusBody(opts));
        if (req.method === "POST" && path === "/reload") {
            const result = await opts.registry.reload();
            opts.onCatalogChanged?.();
            return json(res, result);
        }
        if (req.method === "GET" && path === "/api/state") {
            const config = applyDefaultExtensionServers(opts.getConfig());
            return json(res, {
                servers: Object.entries(config.servers).map(([id, s]) => ({
                    id,
                    transport: s.transport,
                    url: s.url,
                    command: s.command,
                    tags: s.tags,
                    description: s.description,
                    enabled: s.enabled,
                })),
                tenants: Object.keys(config.tenants),
                activeTenant: config.activeTenant,
            });
        }
        if (req.method === "POST" && path === "/api/servers") {
            const entry = (await body(req));
            if (!entry.id || !/^[a-zA-Z0-9_-]{1,64}$/.test(entry.id))
                throw new Error("server id required (a-z A-Z 0-9 _ -)");
            const id = entry.id;
            const description = typeof entry.description === "string" ? entry.description.trim() : "";
            const parsed = await updateConfigFile(opts.getConfigPath(), (raw) => {
                const servers = withDefaultExtensionServers((raw.servers ?? {}));
                servers[id] = {
                    transport: entry.transport ?? "streamable-http",
                    ...(entry.url ? { url: entry.url } : {}),
                    tags: entry.tags ?? [],
                    ...(description ? { description } : {}),
                    enabled: entry.enabled ?? true,
                };
                raw.servers = servers;
                return raw;
            });
            await opts.registry.reload({ config: parsed, path: opts.getConfigPath() });
            opts.onCatalogChanged?.();
            return json(res, { ok: true });
        }
        const delMatch = /^\/api\/servers\/([^/]+)$/.exec(path);
        if (req.method === "DELETE" && delMatch) {
            const id = decodeURIComponent(delMatch[1]);
            const parsed = await updateConfigFile(opts.getConfigPath(), (raw) => {
                const servers = (raw.servers ?? {});
                delete servers[id];
                raw.servers = servers;
                return raw;
            });
            await opts.registry.reload({ config: parsed, path: opts.getConfigPath() });
            opts.onCatalogChanged?.();
            return json(res, { ok: true });
        }
        if (req.method === "PUT" && path === "/api/activeTenant") {
            const { tenant } = (await body(req));
            const name = tenant?.trim();
            if (!name)
                throw new Error("tenant name is required");
            const parsed = await updateConfigFile(opts.getConfigPath(), (raw) => {
                raw.activeTenant = name;
                return raw;
            });
            await opts.registry.reload({ config: parsed, path: opts.getConfigPath() });
            opts.onCatalogChanged?.();
            return json(res, { ok: true, activeTenant: parsed.activeTenant });
        }
        res.writeHead(404, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "not found" }));
    }
    catch (err) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
    }
}
async function handleMcp(req, res, opts, transports) {
    try {
        const sessionId = req.headers["mcp-session-id"];
        let transport = sessionId ? transports.get(sessionId) : undefined;
        if (!transport) {
            if (req.method === "GET") {
                res.writeHead(405);
                res.end();
                return;
            }
            if (req.method !== "POST") {
                res.writeHead(400);
                res.end("bad request");
                return;
            }
            const mcpServer = opts.createMcpServer();
            let fresh;
            fresh = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (sid) => {
                    transports.set(sid, fresh);
                },
            });
            fresh.onclose = () => {
                if (fresh.sessionId)
                    transports.delete(fresh.sessionId);
            };
            transport = fresh;
            await mcpServer.connect(fresh);
        }
        let parsedBody;
        if (req.method === "POST") {
            const chunks = [];
            for await (const chunk of req)
                chunks.push(chunk);
            const raw = Buffer.concat(chunks).toString("utf8");
            parsedBody = raw ? JSON.parse(raw) : undefined;
        }
        await transport.handleRequest(req, res, parsedBody);
    }
    catch (err) {
        opts.logger.warn("mcp http error", { error: err.message });
        if (!res.headersSent) {
            res.writeHead(500, { "content-type": "application/json" });
            res.end(JSON.stringify({ error: err.message }));
        }
    }
}
function allowedOrigin(req) {
    const origin = req.headers.origin;
    if (!origin)
        return true;
    return /^http:\/\/(127\.0\.0\.1|\[::1\]|localhost):\d+$/.test(origin);
}
async function statusBody(opts) {
    const auth = await opts.resolveAuth();
    const status = await auth.tokenProvider.status();
    return {
        tenant: auth.tenantName,
        authenticated: status.authenticated,
        username: status.username ?? null,
        expiresInSec: status.expiresInSec ?? null,
        servers: opts.registry.listServerHealth(),
        toolsIndexed: opts.catalog.size(),
        routingMode: opts.getConfig().routing.mode,
    };
}
function webRoot() {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [join(here, "../web"), join(here, "../../dist/web"), join(process.cwd(), "dist/web")];
    return candidates.find((c) => existsSync(join(c, "index.html")));
}
function serveWeb(res, file, type) {
    const root = webRoot();
    if (!root) {
        res.writeHead(503, { "content-type": "text/plain" });
        res.end("web console not built — run: npm run build");
        return;
    }
    readFile(join(root, file))
        .then((buf) => {
        res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
        res.end(buf);
    })
        .catch(() => {
        res.writeHead(404);
        res.end();
    });
}
function json(res, value) {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(value));
}
async function body(req) {
    const chunks = [];
    for await (const c of req)
        chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}
//# sourceMappingURL=control.js.map