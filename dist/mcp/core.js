import { ServerUnavailableError, UnknownToolError } from "../proxy/errors.js";
import { exposedNameFor } from "./exposed-tools.js";
import { productName, signInHint } from "../product-name.js";
import { readDeployInfo } from "../deploy-info.js";
import { readServePort } from "../config/paths.js";
import { assertCanLoginTenant, TenantSwitchBlockedError } from "../auth/single-tenant.js";
import { ENV_INTERNAL_API_KEY, ENV_STAGE, getPlainEnvPrefix } from "../auth/constants.js";
import { resolveLoginTenant, resolvePasswordLogin, isHeadlessEnv } from "../auth/credentials-factory.js";
/**
 * Always-exposed meta surface. Descriptions include natural-language triggers
 * (product name, hireko, recruiter, sign out / status / login wording) so
 * harness ToolSearch picks the right tool from casual prompts.
 */
export function buildCoreMetaTools() {
    const name = productName();
    /** Colloquial product aliases users say aloud (not the plugin display name). */
    const aka = "Hireko / Recruiter / hireko / recruiter";
    return [
        {
            name: "filter_tools_with_query",
            description: `OPTIONAL ${name} (${aka}) helper: search, filter, find, or discover which downstream MCP tools match a free-text query (deterministic ranking — no LLM in this proxy). Use when the user asks which hireko, recruiter, or ${name} tools exist for a task, or how to find an API among many server__tool entries. Prefer calling flattened tools directly when the name is already known. Omit context or use mode='all' to page the catalog. Returns toolRef + exposedName. Never pass auth headers.`,
            inputSchema: {
                type: "object",
                properties: {
                    context: {
                        type: "string",
                        description: "Free text describing the capability needed (optional for mode='all')",
                    },
                    limit: { type: "integer", minimum: 1, description: "Max results (default from config)" },
                    mode: { type: "string", enum: ["relevant", "all"], default: "relevant" },
                    server: { type: "string", description: "Restrict to one downstream server id" },
                    tags: { type: "array", items: { type: "string" } },
                    offset: { type: "integer", minimum: 0, description: "Pagination offset for mode='all'" },
                    includeSchemas: { type: "boolean", default: false, description: "Include full input schemas (verbose)" },
                },
                required: [],
            },
        },
        {
            name: "describe_tool",
            description: `Get the full input schema for one ${name} (${aka}) downstream tool by toolRef when tools/list is not enough. Use for "describe tool", "what args does X take", schema lookup. Prefer tools/list schemas first. Never add tokens.`,
            inputSchema: {
                type: "object",
                properties: { toolRef: { type: "string", description: "e.g. 'recruiting.search_candidate'" } },
                required: ["toolRef"],
            },
        },
        {
            name: "reload_registry",
            description: `Reload ${name} (${aka}) registry config and refresh flattened tools (tools/list_changed). Retries kept servers that were unavailable. Use after /human adds a server, after login if tools are still empty, or when the user says reload registry, refresh MCP tools, or pick up new servers. Does not clear auth.`,
            inputSchema: { type: "object", properties: {}, required: [] },
        },
        {
            name: "auth_status",
            description: `Check ${name} (${aka}) auth and proxy status: am I logged in, which tenant, expires, stage, human console URL, healthy servers, toolsIndexed. Use for "hireko status", "recruiter status", "${name} status", "auth status", "are we authenticated". Never returns tokens.`,
            inputSchema: { type: "object", properties: {}, required: [] },
        },
        {
            name: "logout",
            description: `Log out / sign out / logout of ${name} (${aka} MCP tenant proxy): revoke Cognito tokens and clear Keychain/local store. Use when the user says "hireko logout", "recruiter logout", "${name} logout", "log out of hireko", "sign out of recruiter", "end session", "clear hireko auth", or switch-tenant cleanup. Optional tenant (default active). Only one tenant session should be active.`,
            inputSchema: {
                type: "object",
                properties: {
                    tenant: {
                        type: "string",
                        description: "Tenant to log out (default: activeTenant from config)",
                    },
                },
                required: [],
            },
        },
        {
            name: "login",
            description: `Password sign-in to ${name} (${aka}) for a tenant. Headful: tenant + username + password. Headless: apiKey (base64 JSON of username, password, tenant) or env ${ENV_INTERNAL_API_KEY}, or set ${getPlainEnvPrefix()}tenant + ${getPlainEnvPrefix()}username + ${getPlainEnvPrefix()}password. Prefer login_browser for interactive use. Use for "hireko login with password", "recruiter login with password", "${name} login" when credentials are supplied. Only one tenant may be logged in — if another tenant is active, logout first (re-login to the same tenant is allowed). Password and apiKey never logged or returned.`,
            inputSchema: {
                type: "object",
                properties: {
                    tenant: { type: "string", description: "Tenant name as the user typed it (free string, not a catalog id)" },
                    username: { type: "string", description: "Cognito username for this tenant" },
                    password: { type: "string", description: "Cognito password for this tenant (never echoed back)" },
                    apiKey: {
                        type: "string",
                        description: `Headless: base64 of {"username","password","tenant"}. Optional when ${ENV_INTERNAL_API_KEY} is set. Never echoed back.`,
                    },
                },
                required: [],
            },
        },
        {
            name: "login_browser",
            description: `Preferred ${name} (${aka}) browser device login: open RecruiterDashboard /devicelogin, print and open the URL. Use for "hireko login", "recruiter login", "${name} login", "sign in", "device login", "browser login". Pass tenant, or apiKey (base64 JSON with tenant) / env ${ENV_INTERNAL_API_KEY} for headless tenant resolution. Optional stage beta|prod and localPort for Vite. No password in the tool call. Only one tenant may be logged in — if another tenant is active, logout first (re-login to the same tenant is allowed).`,
            inputSchema: {
                type: "object",
                properties: {
                    tenant: { type: "string", description: "Tenant name as the user typed it (free string, not a catalog id)" },
                    apiKey: {
                        type: "string",
                        description: `Optional: base64 of {"username","password","tenant"} — tenant is used for device login (username/password ignored). Optional when ${ENV_INTERNAL_API_KEY} is set. Never echoed back.`,
                    },
                    stage: {
                        type: "string",
                        description: `Cognito/dashboard stage override: beta | prod (default: plugin ${ENV_STAGE} / deploy.json)`,
                    },
                    localPort: {
                        type: "integer",
                        description: "Local dashboard port → http://127.0.0.1:<port>/devicelogin (Vite). Cognito still from stage.",
                    },
                    deviceLoginOrigin: {
                        type: "string",
                        description: "Full dashboard origin override (e.g. http://127.0.0.1:8080). Takes precedence over localPort.",
                    },
                    redirectUri: { type: "string", description: "Unused for device login (kept for compatibility)" },
                },
                required: [],
            },
        },
    ];
}
/** Snapshot for tests/perf; prefer buildCoreMetaTools() / metaToolsForMode() at runtime. */
export const CORE_META_TOOLS = buildCoreMetaTools();
/** Extra meta-tools only when routing.mode === "meta" (legacy discover/call hop). */
export const META_MODE_EXTRA_TOOLS = [
    {
        name: "call_tool",
        description: "Invoke a downstream MCP tool by toolRef (meta mode only). Authentication is injected automatically; never supply auth headers or tokens. Prefer flattened server__tool calls when routing.mode is flat.",
        inputSchema: {
            type: "object",
            properties: {
                toolRef: { type: "string", description: "e.g. 'recruiting.search_candidate'" },
                arguments: { type: "object", description: "Arguments matching the tool's input schema" },
            },
            required: ["toolRef"],
        },
    },
    {
        name: "list_servers",
        description: "List configured downstream MCP servers with health and indexed tool counts (meta mode). Prefer /human or auth_status proxy banner in flat mode. Use for 'hireko servers' / 'recruiter servers' / list servers.",
        inputSchema: { type: "object", properties: {}, required: [] },
    },
];
/** Default export for tests/perf: flat-mode surface (no call_tool / list_servers). */
export const META_TOOLS = [...CORE_META_TOOLS];
export function metaToolsForMode(mode) {
    const core = buildCoreMetaTools();
    return mode === "meta" ? [...core, ...META_MODE_EXTRA_TOOLS] : core;
}
export const META_TOOL_NAMES = new Set([...buildCoreMetaTools(), ...META_MODE_EXTRA_TOOLS, { name: "discover_tools" }].map((t) => t.name));
/**
 * Meta-tool logic, transport-agnostic. Flat mode exposes downstream tools on
 * tools/list; meta mode keeps the classic filter/call hop (spec §4).
 */
export class RouterCore {
    opts;
    toolsChangedListeners = new Set();
    constructor(opts) {
        this.opts = opts;
    }
    /** Wired by each host server after construction (stdio + HTTP sessions). */
    setOnToolsChanged(fn) {
        this.toolsChangedListeners.add(fn);
    }
    emitToolsListChanged() {
        for (const fn of this.toolsChangedListeners) {
            try {
                fn();
            }
            catch {
                /* ignore listener errors */
            }
        }
        this.opts.onToolsChanged?.();
    }
    async dispatch(toolName, args) {
        switch (toolName) {
            case "filter_tools_with_query":
            case "discover_tools": // legacy alias
                return this.filterToolsWithQuery(args);
            case "describe_tool":
                return this.describeTool(args);
            case "call_tool":
                return this.callTool(args);
            case "list_servers":
                return this.listServers();
            case "reload_registry":
                return this.reloadRegistry();
            case "auth_status":
                return this.authStatus();
            case "logout":
                return this.logout(args);
            case "login":
                return this.login(args);
            case "login_browser":
                return this.loginBrowser(args);
            default:
                throw new Error(`unknown meta-tool: ${toolName}`);
        }
    }
    /* ----------------------- filter_tools_with_query ----------------------- */
    async filterToolsWithQuery(args) {
        const config = this.opts.getConfig();
        const routing = config.routing;
        const mode = args.mode === "all" ? "all" : "relevant";
        const limit = clampInt(args.limit, 1, routing.maxResults, routing.defaultLimit);
        const server = typeof args.server === "string" ? args.server : undefined;
        const tags = Array.isArray(args.tags) ? args.tags.filter((t) => typeof t === "string") : undefined;
        const includeSchemas = args.includeSchemas === true;
        if (mode === "all") {
            const offset = clampInt(args.offset, 0, Number.MAX_SAFE_INTEGER, 0);
            const page = this.opts.catalog.all({ limit, offset, server, tags });
            return {
                mode: "all",
                total: page.total,
                offset: page.offset,
                nextOffset: page.nextOffset ?? null,
                count: page.results.length,
                tools: page.results.map((r) => ({
                    ...r,
                    exposedName: exposedNameFor({ serverId: r.server, name: r.name }),
                })),
            };
        }
        const context = typeof args.context === "string" ? args.context.trim() : "";
        if (!context) {
            return {
                mode: "relevant",
                count: 0,
                tools: [],
                hint: "provide a 'context' describing the capability you need, or use mode='all'",
            };
        }
        const results = this.opts.catalog.searchRelevant({ context, limit, server, tags, includeSchemas });
        if (routing.dynamicToolActivation && routing.mode === "meta") {
            const records = results
                .map((r) => this.opts.catalog.get(r.toolRef))
                .filter((r) => r !== undefined);
            this.opts.session.setActivated(records);
            this.emitToolsListChanged();
            this.opts.logger.info("dynamic activation updated", { activated: records.length });
        }
        const tools = results.map((r) => ({
            ...r,
            exposedName: exposedNameFor({ serverId: r.server, name: r.name }),
        }));
        return {
            mode: "relevant",
            count: tools.length,
            tools,
            ...(routing.dynamicToolActivation && routing.mode === "meta"
                ? { note: "these tools are now directly callable by their exposed names" }
                : routing.mode === "flat"
                    ? { note: "prefer calling flattened tools directly (server__tool); auth is injected by the proxy" }
                    : { note: "call via call_tool with the toolRef" }),
        };
    }
    /** @deprecated Use filterToolsWithQuery */
    async discoverTools(args) {
        return this.filterToolsWithQuery(args);
    }
    /* ---------------------------- describe_tool ---------------------------- */
    async describeTool(args) {
        const ref = requireString(args, "toolRef");
        const record = this.opts.catalog.get(ref);
        if (!record)
            throw new UnknownToolError(ref);
        const config = this.opts.getConfig();
        const server = config.servers[record.serverId];
        const health = this.opts.registry.healthFor(record.serverId);
        return {
            toolRef: record.ref,
            exposedName: exposedNameFor(record),
            server: record.serverId,
            name: record.name,
            title: record.title,
            description: record.description,
            groupDescription: record.groupDescription ?? null,
            inputSchema: record.inputSchema,
            annotations: record.annotations ?? null,
            tags: record.tags,
            transport: server?.transport ?? "unknown",
            health: health?.status ?? "unknown",
            requiresAuth: server ? server.injectAuth : true,
        };
    }
    /* ------------------------------ call_tool ------------------------------ */
    async callTool(args) {
        const ref = requireString(args, "toolRef");
        const record = this.opts.catalog.get(ref);
        if (!record)
            throw new UnknownToolError(ref);
        const config = this.opts.getConfig();
        const serverConfig = config.servers[record.serverId];
        if (!serverConfig)
            throw new ServerUnavailableError(record.serverId, "server not in config");
        const conn = this.opts.registry.connectionFor({ id: record.serverId, ...serverConfig });
        const started = Date.now();
        try {
            // Auth token is fetched and injected inside the transport layer —
            // it never passes through this result, so the model never sees it.
            const result = await conn.callTool(record.name, args.arguments ?? {});
            this.opts.logger.info("tool call proxied", {
                toolRef: ref,
                serverId: record.serverId,
                durationMs: Date.now() - started,
                status: result.isError ? "tool-error" : "ok",
            });
            return result;
        }
        catch (err) {
            this.opts.logger.warn("tool call failed", {
                toolRef: ref,
                serverId: record.serverId,
                durationMs: Date.now() - started,
                errorCode: err?.name,
                error: err?.message,
            });
            throw err;
        }
    }
    /* ----------------------------- list_servers ---------------------------- */
    async listServers() {
        const config = this.opts.getConfig();
        return {
            tenant: config.activeTenant,
            servers: this.opts.registry.listServerHealth().map((h) => ({
                server: h.serverId,
                status: h.status,
                tools: h.toolCount,
                enabled: config.servers[h.serverId]?.enabled ?? false,
                transport: config.servers[h.serverId]?.transport,
                description: config.servers[h.serverId]?.description ?? null,
                lastError: h.lastError ?? null,
            })),
        };
    }
    /* --------------------------- reload_registry --------------------------- */
    async reloadRegistry() {
        const result = await this.opts.registry.reload();
        // Reload never touches the auth session (spec §18).
        this.emitToolsListChanged();
        return result;
    }
    /* ----------------------------- auth_status ----------------------------- */
    async authStatus() {
        const status = await (await this.opts.getTokenProvider()).status();
        // Deliberately excludes every token value (spec §28).
        const headless = isHeadlessEnv();
        const hint = status.authenticated
            ? undefined
            : headless
                ? `Headless credentials are set but login has not succeeded. Check ${getPlainEnvPrefix()}tenant/_username/_password or ${ENV_INTERNAL_API_KEY}. If the proxy just started, login may be in progress.`
                : signInHint();
        return {
            authenticated: status.authenticated,
            tenant: status.tenant ?? null,
            username: status.username ?? null,
            expiresInSec: status.expiresInSec ?? null,
            tokenToForward: status.tokenToForward ?? "access",
            storage: status.storage,
            headlessMode: headless,
            ...this.runtimeBanner(),
            ...(hint ? { hint } : {}),
        };
    }
    /* -------------------------------- logout -------------------------------- */
    async logout(args = {}) {
        const config = this.opts.getConfig();
        const tenant = typeof args.tenant === "string" && args.tenant.trim().length > 0
            ? args.tenant.trim()
            : config.activeTenant;
        try {
            const provider = await this.opts.authScopeProvider.tokenProviderFor(tenant);
            await provider.logout();
            this.opts.logger.info("mcp logout", { tenant });
            return {
                authenticated: false,
                tenant,
                revoked: true,
                ...this.runtimeBanner(),
                hint: signInHint(),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.opts.logger.warn("mcp logout failed", { tenant, error: message });
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ authenticated: false, tenant, revoked: false, error: message, ...this.runtimeBanner() }, null, 2),
                    },
                ],
                isError: true,
            };
        }
    }
    /**
     * Product rule: only one tenant session. Refuse login to a different tenant
     * while the active tenant still has a valid session — caller must logout first.
     */
    async assertCanLogin(nextTenant) {
        const active = this.opts.getConfig().activeTenant;
        await assertCanLoginTenant({
            activeTenant: active,
            nextTenant,
            statusFor: async (tenant) => (await this.opts.authScopeProvider.tokenProviderFor(tenant)).status(),
        });
    }
    /* -------------------------------- login -------------------------------- */
    async login(args) {
        let tenant = typeof args.tenant === "string" ? args.tenant : "";
        let username = typeof args.username === "string" ? args.username : "";
        try {
            const creds = resolvePasswordLogin({
                tenant: args.tenant,
                username: args.username,
                password: args.password,
                apiKey: args.apiKey,
            });
            tenant = creds.tenant;
            username = creds.username;
            await this.assertCanLogin(creds.tenant);
            const session = await this.opts.authScopeProvider.login_tenant_user(creds.username, creds.password, creds.tenant);
            await this.opts.setActiveTenant(creds.tenant);
            await this.refreshToolsAfterAuth();
            const expiresInSec = session.expiresAt !== undefined ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : null;
            this.opts.logger.info("mcp login successful", {
                tenant: creds.tenant,
                username: session.username,
                source: creds.source,
            });
            return {
                authenticated: true,
                tenant: creds.tenant,
                username: session.username,
                expiresInSec,
                ...this.runtimeBanner(),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.opts.logger.warn("mcp login failed", { tenant, username, error: message });
            const body = {
                authenticated: false,
                tenant,
                username,
                error: message,
                ...(err instanceof TenantSwitchBlockedError
                    ? { activeTenant: err.activeTenant, hint: "Call logout, then login with the new tenant." }
                    : {}),
                ...this.runtimeBanner(),
            };
            return {
                content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
                isError: true,
            };
        }
    }
    /* -------------------------------- login_browser -------------------------------- */
    async loginBrowser(args) {
        let tenant;
        try {
            tenant = resolveLoginTenant({ tenant: args.tenant, apiKey: args.apiKey }).tenant;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return {
                content: [{ type: "text", text: JSON.stringify({ authenticated: false, error: message, ...this.runtimeBanner() }, null, 2) }],
                isError: true,
            };
        }
        const stageRaw = typeof args.stage === "string" ? args.stage.toLowerCase() : undefined;
        const stage = stageRaw === "beta" || stageRaw === "prod" ? stageRaw : undefined;
        const redirectUri = typeof args.redirectUri === "string" ? args.redirectUri : undefined;
        const deviceLoginOrigin = typeof args.deviceLoginOrigin === "string" ? args.deviceLoginOrigin : undefined;
        const localPort = typeof args.localPort === "number"
            ? args.localPort
            : typeof args.localPort === "string" && /^\d+$/.test(args.localPort)
                ? Number(args.localPort)
                : undefined;
        try {
            await this.assertCanLogin(tenant);
            const session = await this.opts.authScopeProvider.login_tenant_oauth(tenant, {
                stage,
                redirectUri,
                deviceLoginOrigin,
                localPort,
                openBrowser: true,
            });
            await this.opts.setActiveTenant(tenant);
            await this.refreshToolsAfterAuth();
            const expiresInSec = session.expiresAt !== undefined ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : null;
            this.opts.logger.info("mcp login_browser successful", { tenant, username: session.username });
            return {
                authenticated: true,
                tenant,
                username: session.username,
                stage: session.authStage ?? stage ?? null,
                localPort: localPort ?? null,
                expiresInSec,
                hasRefresh: Boolean(session.refreshToken),
                ...this.runtimeBanner(),
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.opts.logger.warn("mcp login_browser failed", { tenant, error: message });
            const body = {
                authenticated: false,
                tenant,
                error: message,
                ...(err instanceof TenantSwitchBlockedError
                    ? { activeTenant: err.activeTenant, hint: "Call logout, then login with the new tenant." }
                    : {}),
                ...this.runtimeBanner(),
            };
            return {
                content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
                isError: true,
            };
        }
    }
    /**
     * After Cognito login, retry downstream discovery for servers that failed while
     * unauthenticated, then notify the harness the flattened tool list changed.
     */
    async refreshToolsAfterAuth() {
        try {
            const retried = await this.opts.registry.rediscoverUnhealthy();
            if (retried.length > 0) {
                this.opts.logger.info("post-login rediscovery", { servers: retried });
            }
        }
        catch (err) {
            this.opts.logger.warn("post-login rediscovery failed", {
                error: err instanceof Error ? err.message : String(err),
            });
        }
        this.emitToolsListChanged();
    }
    /** Stage + local proxy liveness + /human console URL (this process is the proxy). */
    runtimeBanner() {
        const deploy = readDeployInfo();
        const health = this.opts.registry.listServerHealth();
        const healthy = health.filter((h) => h.status === "healthy").length;
        const port = readServePort() ?? 8400;
        const human = `http://127.0.0.1:${port}/human`;
        const mcpHttp = `http://127.0.0.1:${port}/mcp`;
        return {
            stage: deploy.stage ?? "local",
            version: deploy.version,
            proxy: {
                up: true,
                pid: process.pid,
                port,
                human,
                mcp: mcpHttp,
                servers: health.length,
                healthy,
                unavailable: health.length - healthy,
                toolsIndexed: this.opts.catalog.size(),
            },
        };
    }
}
function requireString(args, key) {
    const value = args[key];
    if (typeof value !== "string" || value.length === 0) {
        throw new Error(`missing required string argument "${key}"`);
    }
    return value;
}
function clampInt(value, min, max, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return fallback;
    return Math.min(max, Math.max(min, Math.floor(value)));
}
//# sourceMappingURL=core.js.map