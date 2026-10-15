import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { InMemoryToolCatalog } from "../catalog/catalog.js";
import type { AppConfig } from "../config/schema.js";
import type { Logger } from "../logging/logger.js";
import type { ServerRegistry } from "../registry/registry.js";
import type { ResolvedAuth } from "../transports/factory.js";
/**
 * Localhost-only: /human console + maintenance API + optional Streamable HTTP MCP.
 */
export interface ControlServerOptions {
    getConfig: () => AppConfig;
    getConfigPath: () => string;
    registry: ServerRegistry;
    catalog: InMemoryToolCatalog;
    resolveAuth: () => Promise<ResolvedAuth>;
    logger: Logger;
    ports: number[];
    /** Factory for a host MCP server (one per HTTP session). */
    createMcpServer?: () => Server;
    /** After config/catalog mutations (reload, add/remove server) — notify MCP clients. */
    onCatalogChanged?: () => void;
}
export interface ControlServer {
    port: number;
    close(): Promise<void>;
}
export declare function startControlServer(opts: ControlServerOptions): Promise<ControlServer | undefined>;
