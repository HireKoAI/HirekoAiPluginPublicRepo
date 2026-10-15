/**
 * Deterministic tokenization shared by indexing and querying.
 * Handles snake_case, camelCase, kebab-case, and punctuation.
 */
export function tokenize(text) {
    const out = [];
    // Split camelCase boundaries first, then non-alphanumerics.
    const expanded = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
    for (const piece of expanded.toLowerCase().split(/[^a-z0-9]+/)) {
        if (piece.length > 0)
            out.push(piece);
    }
    return out;
}
/** Normalized phrase form — camelCase-aware, matching tokenize(). */
export function normalizePhrase(text) {
    return tokenize(text).join(" ");
}
/** Common stopwords dropped from QUERIES (never from indexed docs). */
const STOPWORDS = new Set([
    "a", "an", "the", "and", "or", "to", "of", "in", "on", "for", "with", "at", "by",
    "is", "are", "was", "be", "i", "me", "my", "we", "our", "you", "your", "it", "its",
    "please", "can", "could", "would", "will", "do", "does", "need", "want", "get me",
]);
export function isStopword(token) {
    return STOPWORDS.has(token);
}
/** Distinct tokens preserving first-seen order. */
export function uniqueTokens(tokens) {
    return [...new Set(tokens)];
}
//# sourceMappingURL=tokenize.js.map