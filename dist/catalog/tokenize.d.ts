/**
 * Deterministic tokenization shared by indexing and querying.
 * Handles snake_case, camelCase, kebab-case, and punctuation.
 */
export declare function tokenize(text: string): string[];
/** Normalized phrase form — camelCase-aware, matching tokenize(). */
export declare function normalizePhrase(text: string): string;
export declare function isStopword(token: string): boolean;
/** Distinct tokens preserving first-seen order. */
export declare function uniqueTokens(tokens: string[]): string[];
