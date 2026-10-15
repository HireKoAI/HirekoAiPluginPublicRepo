import type { ServerConfig } from "../config/schema.js";
import type { ToolRecord } from "../registry/types.js";
import type { Logger } from "../logging/logger.js";
/**
 * Optional startup-only catalog snapshot (spec §24). Disposable: deleting it
 * must never break the system, and it never contains auth tokens.
 */
export interface CatalogSnapshot {
    version: 1;
    savedAt: string;
    servers: Record<string, {
        fingerprint: string;
        toolCount: number;
    }>;
    tools: Array<ToolRecord & {
        requiresAuth: boolean;
    }>;
}
export declare function serverFingerprint(server: ServerConfig): string;
export declare class CatalogCache {
    private readonly path;
    private readonly logger;
    constructor(path: string, logger: Logger);
    load(): Promise<CatalogSnapshot | undefined>;
    /** Tools for servers whose fingerprint still matches; stale ones skipped. */
    freshTools(snapshot: CatalogSnapshot, servers: Map<string, ServerConfig>): Array<ToolRecord & {
        requiresAuth: boolean;
    }>;
    save(snapshot: CatalogSnapshot): Promise<void>;
    clear(): Promise<void>;
}
