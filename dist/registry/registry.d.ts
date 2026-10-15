import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { AppConfig, ServerConfig } from "../config/schema.js";
import { type RegistryLoader } from "../config/loader.js";
import { CatalogCache } from "../catalog/cache.js";
import type { InMemoryToolCatalog } from "../catalog/catalog.js";
import type { Logger } from "../logging/logger.js";
import type { AuthenticatedTransportFactory } from "../transports/factory.js";
import { ManagedConnection } from "../proxy/connection.js";
import { type ServerHealth, type ToolRecord } from "./types.js";
export interface ReloadResult {
    added: string[];
    removed: string[];
    changed: string[];
    kept: string[];
    /** Kept servers that were not healthy and were rediscovered during reload. */
    retried: string[];
    toolCount: number;
    configPath: string;
}
export interface RegistryOptions {
    config: AppConfig;
    configPath: string;
    loader: RegistryLoader;
    transportFactory: AuthenticatedTransportFactory;
    catalog: InMemoryToolCatalog;
    cache?: CatalogCache;
    logger: Logger;
}
/**
 * The in-memory MCP registry (spec §2, §11, §18, §25). File-driven config,
 * lazy connections, bounded discovery concurrency, atomic reload.
 */
export declare class ServerRegistry {
    private readonly opts;
    private connections;
    private health;
    private config;
    private configPath;
    private readonly reloadMutex;
    private readonly discoveryMutex;
    constructor(opts: RegistryOptions);
    get currentConfig(): AppConfig;
    get currentConfigPath(): string;
    startup(): Promise<void>;
    /** Optional snapshot for instant search while live discovery runs (spec §24). */
    private seedFromCache;
    /** Discover every enabled server with bounded concurrency (spec §26). */
    discoverAll(): Promise<void>;
    /**
     * Drop connections for enabled servers that are not healthy and rediscover them.
     * Used after login (tokens now available) so a failed pre-auth discovery can recover
     * without waiting out ManagedConnection backoff.
     */
    rediscoverUnhealthy(): Promise<string[]>;
    /** Close and forget a managed connection so the next discover gets a fresh backoff state. */
    private dropConnection;
    /**
     * Connect + tools/list + index for one server. One unavailable server never
     * blocks the fleet (spec §11): failures are recorded as health status.
     */
    discoverOne(serverId: string): Promise<number>;
    /**
     * Hot reload (spec §18, §25): load → parse → validate → diff → only then
     * swap. A malformed new config never destroys the working registry: the
     * loader throws before any mutation happens.
     */
    reload(explicitConfig?: {
        config: AppConfig;
        path: string;
    }): Promise<ReloadResult>;
    private discoverOneWith;
    connectionFor(server: ServerConfig): ManagedConnection;
    getConnection(serverId: string): ManagedConnection | undefined;
    healthFor(serverId: string): ServerHealth | undefined;
    listServerHealth(): ServerHealth[];
    shutdown(): Promise<void>;
    private writeCache;
}
/**
 * Convert a downstream MCP tool into the canonical record (spec §8).
 * Downstream descriptions/schemas are UNTRUSTED METADATA (spec §28): they are
 * stored and displayed, never interpreted or executed.
 */
export declare function toToolRecord(serverId: string, serverTags: string[], tool: Tool, groupDescription?: string): ToolRecord;
