import { createHash } from "node:crypto";
import { normalizeServers } from "../config/schema.js";
import { applyDefaultExtensionServers } from "../config/loader.js";
import { serverFingerprint } from "../catalog/cache.js";
import { Mutex, poolMap } from "../util/async.js";
import { usesTenantPlaceholder } from "../proxy/headers.js";
import { ManagedConnection } from "../proxy/connection.js";
import { makeRef } from "./types.js";
/**
 * The in-memory MCP registry (spec §2, §11, §18, §25). File-driven config,
 * lazy connections, bounded discovery concurrency, atomic reload.
 */
export class ServerRegistry {
    opts;
    connections = new Map();
    health = new Map();
    config;
    configPath;
    reloadMutex = new Mutex();
    discoveryMutex = new Mutex();
    constructor(opts) {
        this.opts = opts;
        this.config = applyDefaultExtensionServers(opts.config);
        this.configPath = opts.configPath;
    }
    get currentConfig() {
        return this.config;
    }
    get currentConfigPath() {
        return this.configPath;
    }
    /* ------------------------------ startup ------------------------------ */
    async startup() {
        await this.seedFromCache();
        await this.discoverAll();
    }
    /** Optional snapshot for instant search while live discovery runs (spec §24). */
    async seedFromCache() {
        const cache = this.opts.cache;
        if (!cache)
            return;
        const snapshot = await cache.load();
        if (!snapshot)
            return;
        const servers = normalizeServers(this.config);
        const fresh = cache.freshTools(snapshot, servers);
        if (fresh.length === 0)
            return;
        const byServer = new Map();
        for (const t of fresh) {
            const list = byServer.get(t.serverId) ?? [];
            list.push(t);
            byServer.set(t.serverId, list);
        }
        for (const [serverId, tools] of byServer) {
            this.opts.catalog.replaceServerTools(serverId, tools.map(({ requiresAuth: _ra, ...record }) => record), tools[0].requiresAuth);
            this.health.set(serverId, {
                serverId,
                status: "unknown",
                toolCount: tools.length,
                lastCheckedAt: Date.now(),
            });
        }
        this.opts.catalog.commit();
        this.opts.logger.info("catalog seeded from cache", { toolCount: fresh.length });
    }
    /** Discover every enabled server with bounded concurrency (spec §26). */
    async discoverAll() {
        await this.discoveryMutex.runExclusive(async () => {
            const servers = [...normalizeServers(this.config).values()].filter((s) => s.enabled);
            const results = await poolMap(servers, (server) => this.discoverOne(server.id), { concurrency: this.config.discovery.concurrency });
            const failed = results.filter((r) => !r.ok).length;
            this.opts.logger.info("discovery complete", {
                servers: servers.length,
                failed,
                toolCount: this.opts.catalog.size(),
            });
            await this.writeCache();
        });
    }
    /**
     * Drop connections for enabled servers that are not healthy and rediscover them.
     * Used after login (tokens now available) so a failed pre-auth discovery can recover
     * without waiting out ManagedConnection backoff.
     */
    async rediscoverUnhealthy() {
        return this.discoveryMutex.runExclusive(async () => {
            const servers = normalizeServers(this.config);
            const ids = [];
            for (const [id, server] of servers) {
                if (!server.enabled)
                    continue;
                if (this.health.get(id)?.status === "healthy")
                    continue;
                ids.push(id);
                await this.dropConnection(id);
            }
            if (ids.length === 0)
                return ids;
            await poolMap(ids, (id) => this.discoverOne(id), {
                concurrency: this.config.discovery.concurrency,
            });
            this.opts.logger.info("rediscovered unhealthy servers", {
                servers: ids,
                toolCount: this.opts.catalog.size(),
            });
            await this.writeCache();
            return ids;
        });
    }
    /** Close and forget a managed connection so the next discover gets a fresh backoff state. */
    async dropConnection(serverId) {
        const conn = this.connections.get(serverId);
        if (!conn)
            return;
        await conn.close();
        this.connections.delete(serverId);
    }
    /**
     * Connect + tools/list + index for one server. One unavailable server never
     * blocks the fleet (spec §11): failures are recorded as health status.
     */
    async discoverOne(serverId) {
        const server = normalizeServers(this.config).get(serverId);
        if (!server || !server.enabled)
            return 0;
        const conn = this.connectionFor(server);
        this.health.set(serverId, { serverId, status: "connecting", toolCount: 0, lastCheckedAt: Date.now() });
        try {
            const tools = await conn.listTools();
            const records = tools.map((t) => toToolRecord(serverId, server.tags, t, server.description));
            this.opts.catalog.replaceServerTools(serverId, records, server.injectAuth);
            this.opts.catalog.commit();
            this.health.set(serverId, { serverId, status: "healthy", toolCount: records.length, lastCheckedAt: Date.now() });
            this.opts.logger.info("server indexed", { serverId, toolCount: records.length });
            return records.length;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.opts.catalog.removeServer(serverId);
            this.opts.catalog.commit();
            this.health.set(serverId, {
                serverId,
                status: "unavailable",
                toolCount: 0,
                lastError: message,
                lastCheckedAt: Date.now(),
            });
            this.opts.logger.warn("server unavailable", { serverId, errorCode: err?.name, error: message });
            return 0;
        }
    }
    /* ------------------------------- reload ------------------------------ */
    /**
     * Hot reload (spec §18, §25): load → parse → validate → diff → only then
     * swap. A malformed new config never destroys the working registry: the
     * loader throws before any mutation happens.
     */
    async reload(explicitConfig) {
        return this.reloadMutex.runExclusive(async () => {
            const loaded = explicitConfig ?? { config: await this.opts.loader.load(this.configPath), path: this.configPath };
            const next = {
                config: applyDefaultExtensionServers(loaded.config),
                path: loaded.path,
            };
            const oldServers = normalizeServers(this.config);
            const newServers = normalizeServers(next.config);
            const tenantChanged = this.config.activeTenant !== next.config.activeTenant;
            const added = [];
            const removed = [];
            const changed = [];
            const kept = [];
            for (const [id, conn] of [...this.connections]) {
                if (!newServers.has(id)) {
                    removed.push(id);
                    await conn.close();
                    this.connections.delete(id);
                    this.opts.catalog.removeServer(id);
                    this.health.delete(id);
                }
            }
            const toDiscover = [];
            const retried = [];
            for (const [id, server] of newServers) {
                const old = oldServers.get(id);
                if (!old) {
                    added.push(id);
                    toDiscover.push(id);
                }
                else if (fingerprintOf(old) !== fingerprintOf(server) ||
                    (tenantChanged && (usesTenantPlaceholder(old) || usesTenantPlaceholder(server)))) {
                    changed.push(id);
                    await this.dropConnection(id);
                    toDiscover.push(id);
                }
                else {
                    kept.push(id);
                    // Kept but previously failed (e.g. pre-auth discovery): retry without waiting for backoff.
                    const status = this.health.get(id)?.status;
                    if (server.enabled && status !== "healthy") {
                        retried.push(id);
                        await this.dropConnection(id);
                        toDiscover.push(id);
                    }
                }
            }
            // Discovery failures are recorded per-server, not fatal to the swap.
            const results = await poolMap(toDiscover, (id) => this.discoverOneWith(next.config, id), {
                concurrency: next.config.discovery.concurrency,
            });
            const failedAdds = results.filter((r) => !r.ok).length;
            // Atomic swap of the active config only after the candidate is built.
            this.config = next.config;
            this.configPath = next.path;
            this.opts.catalog.commit();
            await this.writeCache();
            this.opts.logger.info("registry reloaded", {
                added: added.length,
                removed: removed.length,
                changed: changed.length,
                kept: kept.length,
                retried: retried.length,
                failedAdds,
                toolCount: this.opts.catalog.size(),
            });
            return {
                added,
                removed,
                changed,
                kept,
                retried,
                toolCount: this.opts.catalog.size(),
                configPath: next.path,
            };
        });
    }
    async discoverOneWith(config, serverId) {
        const server = normalizeServers(config).get(serverId);
        if (!server || !server.enabled)
            return 0;
        const conn = this.connectionFor(server);
        this.health.set(serverId, { serverId, status: "connecting", toolCount: 0, lastCheckedAt: Date.now() });
        try {
            const tools = await conn.listTools();
            const records = tools.map((t) => toToolRecord(serverId, server.tags, t, server.description));
            this.opts.catalog.replaceServerTools(serverId, records, server.injectAuth);
            this.health.set(serverId, { serverId, status: "healthy", toolCount: records.length, lastCheckedAt: Date.now() });
            return records.length;
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.opts.catalog.removeServer(serverId);
            this.health.set(serverId, {
                serverId,
                status: "unavailable",
                toolCount: 0,
                lastError: message,
                lastCheckedAt: Date.now(),
            });
            return 0;
        }
    }
    /* ------------------------------ accessors ---------------------------- */
    connectionFor(server) {
        let conn = this.connections.get(server.id);
        if (!conn) {
            conn = new ManagedConnection(server, this.opts.transportFactory, this.opts.logger.child({ serverId: server.id }));
            this.connections.set(server.id, conn);
        }
        return conn;
    }
    getConnection(serverId) {
        return this.connections.get(serverId);
    }
    healthFor(serverId) {
        return this.health.get(serverId);
    }
    listServerHealth() {
        const servers = normalizeServers(this.config);
        return [...servers.values()].map((s) => {
            const h = this.health.get(s.id);
            return (h ?? {
                serverId: s.id,
                status: s.enabled ? "unknown" : "unavailable",
                toolCount: 0,
                lastError: s.enabled ? undefined : "disabled",
            });
        });
    }
    async shutdown() {
        await Promise.allSettled([...this.connections.values()].map((c) => c.close()));
        this.connections.clear();
    }
    async writeCache() {
        const cache = this.opts.cache;
        if (!cache)
            return;
        const servers = {};
        for (const [id, s] of normalizeServers(this.config)) {
            servers[id] = { fingerprint: serverFingerprint(s), toolCount: this.opts.catalog.toolCountFor(id) };
        }
        const tools = [];
        for (const serverId of this.opts.catalog.serverIds()) {
            const entries = this.opts.catalog.all({ limit: Number.MAX_SAFE_INTEGER, offset: 0, server: serverId });
            for (const r of entries.results) {
                const record = this.opts.catalog.get(r.toolRef);
                if (!record)
                    continue;
                tools.push({ ...record, requiresAuth: r.requiresAuth });
            }
        }
        await cache.save({ version: 1, savedAt: new Date().toISOString(), servers, tools });
    }
}
function fingerprintOf(server) {
    return createHash("sha256")
        .update(JSON.stringify({
        transport: server.transport,
        url: server.url,
        command: server.command,
        args: server.args,
        env: server.env,
        headers: server.headers,
        tags: server.tags,
        enabled: server.enabled,
        injectAuth: server.injectAuth,
    }))
        .digest("hex");
}
/**
 * Convert a downstream MCP tool into the canonical record (spec §8).
 * Downstream descriptions/schemas are UNTRUSTED METADATA (spec §28): they are
 * stored and displayed, never interpreted or executed.
 */
export function toToolRecord(serverId, serverTags, tool, groupDescription) {
    const description = typeof tool.description === "string" ? tool.description : undefined;
    const group = groupDescription?.trim() || undefined;
    return {
        ref: makeRef(serverId, tool.name),
        serverId,
        name: tool.name,
        title: tool.title,
        description,
        groupDescription: group,
        inputSchema: tool.inputSchema ?? {},
        annotations: tool.annotations,
        tags: [...serverTags],
        searchableText: [
            tool.name,
            tool.title ?? "",
            description ?? "",
            group ?? "",
            serverId,
            serverTags.join(" "),
        ]
            .join(" ")
            .toLowerCase(),
    };
}
//# sourceMappingURL=registry.js.map