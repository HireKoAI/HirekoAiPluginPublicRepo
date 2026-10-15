import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type { ServerConfig } from "../config/schema.js";
import type { Logger } from "../logging/logger.js";
import type { AuthenticatedTransportFactory } from "../transports/factory.js";
/**
 * One lazily-created, reusable connection to a downstream MCP server
 * (spec §27): connect on first use, reuse afterwards, drop when broken,
 * reconnect on next use — with bounded exponential backoff so failed servers
 * are never hammered.
 */
export declare class ManagedConnection {
    readonly server: ServerConfig;
    private readonly factory;
    private readonly logger;
    private readonly now;
    private client;
    private connecting;
    private consecutiveFailures;
    private nextAttemptAt;
    constructor(server: ServerConfig, factory: AuthenticatedTransportFactory, logger: Logger, now?: () => number);
    get connected(): boolean;
    ensureConnected(): Promise<Client>;
    private connect;
    /** Paginated tools/list — downstream servers may page large fleets. */
    listTools(): Promise<Tool[]>;
    callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
    /** Drop a broken connection without waiting for close. */
    drop(): void;
    close(): Promise<void>;
}
