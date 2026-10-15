import type { ToolRecord } from "../registry/types.js";
/**
 * Pluggable ranking contract (spec §9). v1 ships DeterministicToolScorer;
 * EmbeddingToolScorer / ModelToolScorer / HybridToolScorer can replace it
 * later without touching the registry or MCP protocol.
 */
export interface ToolScorer {
    /** Deterministic relevance in [0, 1]. */
    score(context: string, tool: ToolRecord): number;
}
export interface PreparedTool {
    record: ToolRecord;
    nameTokens: Set<string>;
    tagTokens: Set<string>;
    serverTokens: Set<string>;
    groupTokens: Set<string>;
    descTokens: Set<string>;
    schemaTokens: Set<string>;
    namePhrase: string;
    descPhrase: string;
    /** Every field's tokens, for document frequency. */
    allTokens: string[];
}
export interface TermStats {
    /** Number of tools in the catalog. */
    docCount: number;
    /** doc frequency: tools containing the term anywhere. */
    df(term: string): number;
}
/** Query-side tokenization: normal tokens minus stopwords. */
export declare function queryTokenize(context: string): string[];
export declare function termWeight(term: string): number;
/** Minimum score a tool needs to appear in `relevant` results. Overlap-based
 * scoring already yields 0 for unrelated tools, so this stays low. */
export declare const MIN_RELEVANT_SCORE = 0.05;
export declare class DeterministicToolScorer implements ToolScorer {
    /** Pre-tokenize a tool once at index time. */
    prepare(record: ToolRecord): PreparedTool;
    score(context: string, tool: ToolRecord): number;
    /**
     * Weighted field-overlap score with IDF on free-text fields, plus
     * exact/phrase/prefix bonuses (spec §9). Name 4x, tags 3x, server 2x,
     * description 1x, schema fields 1x.
     *
     * Short fields (name/tags/server) use BIDIRECTIONAL coverage — a tool whose
     * whole name appears in a long context scores as well as a long context
     * fully covering a name. Long fields (description/schema) use IDF-weighted
     * query coverage.
     */
    scorePrepared(queryTokens: string[], tool: PreparedTool, stats: TermStats): number;
}
/** Pull property names (any depth) out of a JSON-schema-ish object. */
export declare function schemaPropertyNames(schema: unknown): string[];
