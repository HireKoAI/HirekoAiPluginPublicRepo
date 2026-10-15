import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
export function serverFingerprint(server) {
    const material = JSON.stringify({
        transport: server.transport,
        url: server.url,
        command: server.command,
        args: server.args,
        enabled: server.enabled,
        tags: server.tags,
    });
    return createHash("sha256").update(material).digest("hex").slice(0, 16);
}
export class CatalogCache {
    path;
    logger;
    constructor(path, logger) {
        this.path = path;
        this.logger = logger;
    }
    async load() {
        try {
            const raw = await readFile(this.path, "utf8");
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 || !Array.isArray(parsed.tools))
                return undefined;
            return parsed;
        }
        catch {
            return undefined;
        }
    }
    /** Tools for servers whose fingerprint still matches; stale ones skipped. */
    freshTools(snapshot, servers) {
        return snapshot.tools.filter((t) => {
            const server = servers.get(t.serverId);
            const recorded = snapshot.servers[t.serverId];
            return Boolean(server && server.enabled && recorded && recorded.fingerprint === serverFingerprint(server));
        });
    }
    async save(snapshot) {
        try {
            await mkdir(dirname(this.path), { recursive: true });
            await writeFile(this.path, JSON.stringify(snapshot));
        }
        catch (err) {
            this.logger.debug("catalog cache write failed", { error: err.message });
        }
    }
    async clear() {
        await unlink(this.path).catch(() => { });
    }
}
//# sourceMappingURL=cache.js.map