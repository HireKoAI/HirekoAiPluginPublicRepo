import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { backoffDelay, withTimeout } from "../util/async.js";
import { ServerUnavailableError } from "./errors.js";
import { productName } from "../product-name.js";
const VERSION = "0.1.0";
/** Tool calls can legitimately take longer than connect/list. */
const CALL_TIMEOUT_MS = 120_000;
/**
 * One lazily-created, reusable connection to a downstream MCP server
 * (spec §27): connect on first use, reuse afterwards, drop when broken,
 * reconnect on next use — with bounded exponential backoff so failed servers
 * are never hammered.
 */
export class ManagedConnection {
    server;
    factory;
    logger;
    now;
    client;
    connecting;
    consecutiveFailures = 0;
    nextAttemptAt = 0;
    constructor(server, factory, logger, now = Date.now) {
        this.server = server;
        this.factory = factory;
        this.logger = logger;
        this.now = now;
    }
    get connected() {
        return this.client !== undefined;
    }
    async ensureConnected() {
        if (this.client)
            return this.client;
        const t = this.now();
        if (t < this.nextAttemptAt) {
            throw new ServerUnavailableError(this.server.id, `in backoff after ${this.consecutiveFailures} failure(s); retry in ${Math.ceil((this.nextAttemptAt - t) / 1000)}s`);
        }
        if (!this.connecting) {
            this.connecting = this.connect().finally(() => {
                this.connecting = undefined;
            });
        }
        return this.connecting;
    }
    async connect() {
        try {
            const transport = await this.factory.create(this.server);
            const client = new Client({ name: `${productName()}-router:${this.server.id}`, version: VERSION }, {});
            client.onerror = (err) => {
                this.logger.debug("downstream transport error", { serverId: this.server.id, error: String(err) });
            };
            client.onclose = () => {
                // Mark broken; the next request reconnects (spec §27).
                if (this.client === client)
                    this.client = undefined;
            };
            await withTimeout(() => client.connect(transport), this.server.timeoutMs, `connect ${this.server.id}`);
            this.client = client;
            this.consecutiveFailures = 0;
            this.nextAttemptAt = 0;
            return client;
        }
        catch (err) {
            this.consecutiveFailures += 1;
            this.nextAttemptAt = this.now() + backoffDelay(this.consecutiveFailures - 1);
            const message = err instanceof Error ? err.message : String(err);
            this.logger.warn("downstream connect failed", {
                serverId: this.server.id,
                errorCode: err instanceof Error ? err.name : "unknown",
                error: message,
                backoffMs: backoffDelay(this.consecutiveFailures - 1),
            });
            throw new ServerUnavailableError(this.server.id, message);
        }
    }
    /** Paginated tools/list — downstream servers may page large fleets. */
    async listTools() {
        const client = await this.ensureConnected();
        const tools = [];
        let cursor;
        do {
            const page = await withTimeout(() => client.listTools(cursor ? { cursor } : {}), this.server.timeoutMs, `tools/list ${this.server.id}`);
            tools.push(...page.tools);
            cursor = page.nextCursor;
        } while (cursor);
        return tools;
    }
    async callTool(name, args) {
        const client = await this.ensureConnected();
        try {
            return (await withTimeout(() => client.callTool({ name, arguments: args }), CALL_TIMEOUT_MS, `tools/call ${this.server.id}/${name}`));
        }
        catch (err) {
            // Transport-level failures drop the connection so the next call
            // reconnects cleanly; tool-level errors (McpError) keep it.
            if (isTransportLikeError(err)) {
                this.drop();
            }
            throw err;
        }
    }
    /** Drop a broken connection without waiting for close. */
    drop() {
        const client = this.client;
        this.client = undefined;
        client?.close().catch(() => { });
    }
    async close() {
        const client = this.client;
        this.client = undefined;
        await client?.close().catch(() => { });
    }
}
function isTransportLikeError(err) {
    if (!(err instanceof Error))
        return false;
    const msg = `${err.name} ${err.message}`.toLowerCase();
    return (msg.includes("fetch") ||
        msg.includes("network") ||
        msg.includes("econn") ||
        msg.includes("socket") ||
        msg.includes("transport") ||
        msg.includes("session") ||
        msg.includes("timed out") ||
        msg.includes("aborted") ||
        msg.includes("not connected"));
}
//# sourceMappingURL=connection.js.map