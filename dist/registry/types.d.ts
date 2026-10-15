/**
 * Canonical tool identity (spec §8): `<serverId>.<toolName>`. Downstream tool
 * names are NEVER assumed globally unique.
 */
export interface ToolRecord {
    ref: string;
    serverId: string;
    name: string;
    title?: string;
    description?: string;
    /** Optional group/server blurb from config (used in filter + host description). */
    groupDescription?: string;
    inputSchema: unknown;
    annotations?: unknown;
    tags: string[];
    /** Pre-joined lowercase text for search. */
    searchableText: string;
}
export declare function makeRef(serverId: string, toolName: string): string;
export declare function parseRef(ref: string): {
    serverId: string;
    name: string;
} | undefined;
export type ServerStatus = "unknown" | "connecting" | "healthy" | "unavailable";
export interface ServerHealth {
    serverId: string;
    status: ServerStatus;
    toolCount: number;
    lastError?: string;
    lastCheckedAt?: number;
}
