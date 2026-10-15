import type { ToolRecord } from "../registry/types.js";
import { type ToolScorer } from "./scorer.js";
/**
 * Discovery result shape (spec §5). Deliberately NOT the full JSON schema —
 * schemas stay out of model context until describe_tool asks for one.
 */
export interface DiscoveryResult {
    toolRef: string;
    server: string;
    name: string;
    description?: string;
    score: number;
    tags: string[];
    requiresAuth: boolean;
    inputSchema?: unknown;
}
export interface RelevantSearchOptions {
    context: string;
    limit?: number;
    server?: string;
    tags?: string[];
    includeSchemas?: boolean;
}
export interface AllOptions {
    limit: number;
    offset?: number;
    server?: string;
    tags?: string[];
}
export interface Page<T> {
    results: T[];
    total: number;
    offset: number;
    nextOffset?: number;
}
export interface ToolCatalog {
    /** Replace one server's tools (used at startup and per-server reload). */
    replaceServerTools(serverId: string, records: ToolRecord[], requiresAuth: boolean): void;
    removeServer(serverId: string): void;
    /** Rebuild derived index state. Call after a batch of mutations. */
    commit(): void;
    size(): number;
    serverIds(): string[];
    toolCountFor(serverId: string): number;
    get(ref: string): ToolRecord | undefined;
    searchRelevant(opts: RelevantSearchOptions): DiscoveryResult[];
    all(opts: AllOptions): Page<DiscoveryResult>;
    /** Sum of downstream schema sizes — for benchmarks/reporting. */
    approximateSchemaBytes(): number;
}
export declare class InMemoryToolCatalog implements ToolCatalog {
    private entries;
    private byRef;
    private df;
    private scorer;
    private dirty;
    constructor(scorer?: ToolScorer);
    replaceServerTools(serverId: string, records: ToolRecord[], requiresAuth: boolean): void;
    removeServer(serverId: string): void;
    commit(): void;
    private ensureCommitted;
    size(): number;
    serverIds(): string[];
    toolCountFor(serverId: string): number;
    get(ref: string): ToolRecord | undefined;
    searchRelevant(opts: RelevantSearchOptions): DiscoveryResult[];
    all(opts: AllOptions): Page<DiscoveryResult>;
    approximateSchemaBytes(): number;
    /** All catalog records (sorted by ref) — used for flat tools/list. */
    listRecords(): ToolRecord[];
    private toResult;
}
