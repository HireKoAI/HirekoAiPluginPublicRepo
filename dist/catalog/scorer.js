import { isStopword, normalizePhrase, tokenize, uniqueTokens } from "./tokenize.js";
/** Query-side tokenization: normal tokens minus stopwords. */
export function queryTokenize(context) {
    return tokenize(context).filter((t) => !isStopword(t));
}
/**
 * Generic action verbs carry little routing signal — "find X" is about X.
 * They still count (exact-name matches stay exact via symmetric weighting),
 * but at a strong discount so a verb alone never surfaces an unrelated tool.
 */
const GENERIC_TERMS = new Set([
    "find", "get", "list", "retrieve", "fetch", "show", "search", "look", "lookup",
    "check", "pull", "read", "grab", "give", "tell", "need", "want", "help",
]);
export function termWeight(term) {
    return GENERIC_TERMS.has(term) ? 0.15 : 1;
}
const WEIGHT_NAME = 4;
const WEIGHT_TAGS = 3;
const WEIGHT_SERVER = 2;
const WEIGHT_GROUP = 2;
const WEIGHT_DESC = 1;
const WEIGHT_SCHEMA = 1;
const WEIGHT_SUM = WEIGHT_NAME + WEIGHT_TAGS + WEIGHT_SERVER + WEIGHT_GROUP + WEIGHT_DESC + WEIGHT_SCHEMA;
/** Minimum score a tool needs to appear in `relevant` results. Overlap-based
 * scoring already yields 0 for unrelated tools, so this stays low. */
export const MIN_RELEVANT_SCORE = 0.05;
export class DeterministicToolScorer {
    /** Pre-tokenize a tool once at index time. */
    prepare(record) {
        const nameTokens = new Set(tokenize(`${record.name} ${record.title ?? ""}`));
        const tagTokens = new Set(record.tags.flatMap((t) => tokenize(t)));
        const serverTokens = new Set(tokenize(record.serverId));
        const groupTokens = new Set(tokenize(record.groupDescription ?? ""));
        const descTokens = new Set(tokenize(record.description ?? ""));
        const schemaTokens = new Set(tokenize(schemaPropertyNames(record.inputSchema).join(" ")));
        return {
            record,
            nameTokens,
            tagTokens,
            serverTokens,
            groupTokens,
            descTokens,
            schemaTokens,
            namePhrase: normalizePhrase(record.name),
            descPhrase: normalizePhrase(`${record.groupDescription ?? ""} ${record.description ?? ""}`),
            allTokens: uniqueTokens([
                ...nameTokens,
                ...tagTokens,
                ...serverTokens,
                ...groupTokens,
                ...descTokens,
                ...schemaTokens,
            ]),
        };
    }
    score(context, tool) {
        return this.scorePrepared(queryTokenize(context), this.prepare(tool), {
            docCount: 1,
            df: () => 1,
        });
    }
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
    scorePrepared(queryTokens, tool, stats) {
        if (queryTokens.length === 0)
            return 0;
        const exactName = tool.namePhrase.length > 0 && normalizePhraseFromTokens(queryTokens) === tool.namePhrase;
        if (exactName)
            return 1;
        const queryWeight = queryTokens.reduce((sum, t) => sum + termWeight(t), 0);
        // Weighted bidirectional coverage on short fields. Generic verbs count
        // at a discount on BOTH sides, so exact-name matches still score 1.0.
        const coverage = (set) => {
            if (set.size === 0)
                return 0;
            let hitWeight = 0;
            let fieldWeight = 0;
            for (const t of set)
                fieldWeight += termWeight(t);
            for (const t of queryTokens)
                if (set.has(t))
                    hitWeight += termWeight(t);
            if (hitWeight === 0)
                return 0;
            return Math.max(hitWeight / queryWeight, hitWeight / fieldWeight);
        };
        const idfOverlap = (set) => {
            let total = 0;
            let hit = 0;
            for (const t of queryTokens) {
                const w = idf(stats, t) * termWeight(t);
                total += w;
                if (set.has(t))
                    hit += w;
            }
            return total === 0 ? 0 : hit / total;
        };
        let score = (WEIGHT_NAME * coverage(tool.nameTokens) +
            WEIGHT_TAGS * coverage(tool.tagTokens) +
            WEIGHT_SERVER * coverage(tool.serverTokens) +
            WEIGHT_GROUP * coverage(tool.groupTokens) +
            WEIGHT_DESC * idfOverlap(tool.descTokens) +
            WEIGHT_SCHEMA * idfOverlap(tool.schemaTokens)) /
            WEIGHT_SUM;
        const queryPhrase = normalizePhraseFromTokens(queryTokens);
        // Phrase containment bonuses.
        if (queryPhrase.length >= 4 && tool.namePhrase.includes(queryPhrase))
            score += 0.25;
        else if (queryPhrase.length >= 6 && tool.descPhrase.includes(queryPhrase))
            score += 0.1;
        // Prefix bonus: every query token prefixes some name token.
        if (queryTokens.length > 0 && queryTokens.every((q) => [...tool.nameTokens].some((n) => n.startsWith(q)))) {
            score += 0.15;
        }
        // Tag phrase hit: exact tag equality with the whole query.
        if (tool.record.tags.some((t) => normalizePhrase(t) === queryPhrase))
            score += 0.2;
        return Math.min(1, Math.max(0, score));
    }
}
function idf(stats, term) {
    const df = stats.df(term);
    return Math.log(1 + (stats.docCount - df + 0.5) / (df + 0.5));
}
function normalizePhraseFromTokens(tokens) {
    return tokens.join(" ");
}
/** Pull property names (any depth) out of a JSON-schema-ish object. */
export function schemaPropertyNames(schema) {
    const names = [];
    const visit = (node, depth) => {
        if (depth > 6 || node === null || typeof node !== "object")
            return;
        if (Array.isArray(node)) {
            for (const item of node)
                visit(item, depth + 1);
            return;
        }
        const obj = node;
        if (obj.properties && typeof obj.properties === "object") {
            for (const key of Object.keys(obj.properties)) {
                names.push(key);
                visit(obj.properties[key], depth + 1);
            }
        }
        if (obj.items)
            visit(obj.items, depth + 1);
    };
    visit(schema, 0);
    return names;
}
//# sourceMappingURL=scorer.js.map