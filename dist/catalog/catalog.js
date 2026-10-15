import { DeterministicToolScorer, MIN_RELEVANT_SCORE, queryTokenize } from "./scorer.js";
import { uniqueTokens } from "./tokenize.js";
export class InMemoryToolCatalog {
    entries = new Map();
    byRef = new Map();
    df = new Map();
    scorer;
    dirty = true;
    constructor(scorer) {
        // The catalog fast-path needs the deterministic scorer's prepared docs;
        // alternate scorers plug in through searchRelevant's fallback below.
        this.scorer = scorer ?? new DeterministicToolScorer();
    }
    replaceServerTools(serverId, records, requiresAuth) {
        this.removeServer(serverId);
        for (const record of records) {
            this.entries.set(record.ref, {
                record,
                prepared: this.scorer.prepare(record),
                requiresAuth,
            });
        }
        this.dirty = true;
    }
    removeServer(serverId) {
        for (const [ref, entry] of this.entries) {
            if (entry.record.serverId === serverId)
                this.entries.delete(ref);
        }
        this.dirty = true;
    }
    commit() {
        this.byRef = new Map(this.entries);
        this.df = new Map();
        for (const entry of this.entries.values()) {
            for (const token of uniqueTokens(entry.prepared.allTokens)) {
                this.df.set(token, (this.df.get(token) ?? 0) + 1);
            }
        }
        this.dirty = false;
    }
    ensureCommitted() {
        if (this.dirty)
            this.commit();
    }
    size() {
        return this.entries.size;
    }
    serverIds() {
        return [...new Set([...this.entries.values()].map((e) => e.record.serverId))];
    }
    toolCountFor(serverId) {
        let n = 0;
        for (const e of this.entries.values())
            if (e.record.serverId === serverId)
                n += 1;
        return n;
    }
    get(ref) {
        this.ensureCommitted();
        return this.byRef.get(ref)?.record;
    }
    searchRelevant(opts) {
        this.ensureCommitted();
        const queryTokens = queryTokenize(opts.context);
        if (queryTokens.length === 0)
            return [];
        const stats = {
            docCount: this.entries.size,
            df: (term) => this.df.get(term) ?? 0,
        };
        const scored = [];
        for (const entry of this.entries.values()) {
            if (opts.server && entry.record.serverId !== opts.server)
                continue;
            if (opts.tags?.length && !opts.tags.some((t) => entry.record.tags.includes(t)))
                continue;
            const score = this.scorer.scorePrepared(queryTokens, entry.prepared, stats);
            if (score >= MIN_RELEVANT_SCORE)
                scored.push({ entry, score });
        }
        scored.sort((a, b) => (b.score - a.score) || a.entry.record.ref.localeCompare(b.entry.record.ref));
        const limit = Math.max(1, opts.limit ?? 10);
        return scored.slice(0, limit).map(({ entry, score }) => this.toResult(entry, score, opts.includeSchemas));
    }
    all(opts) {
        this.ensureCommitted();
        const filtered = [...this.entries.values()]
            .filter((e) => (opts.server ? e.record.serverId === opts.server : true))
            .filter((e) => (opts.tags?.length ? opts.tags.some((t) => e.record.tags.includes(t)) : true))
            .sort((a, b) => a.record.ref.localeCompare(b.record.ref));
        const offset = Math.max(0, opts.offset ?? 0);
        const limit = Math.max(1, opts.limit);
        const slice = filtered.slice(offset, offset + limit);
        const nextOffset = offset + slice.length < filtered.length ? offset + slice.length : undefined;
        return {
            results: slice.map((e) => this.toResult(e, 0, false)),
            total: filtered.length,
            offset,
            nextOffset,
        };
    }
    approximateSchemaBytes() {
        let bytes = 0;
        for (const e of this.entries.values()) {
            bytes += JSON.stringify(e.record.inputSchema ?? {}).length;
        }
        return bytes;
    }
    /** All catalog records (sorted by ref) — used for flat tools/list. */
    listRecords() {
        this.ensureCommitted();
        return [...this.entries.values()]
            .map((e) => e.record)
            .sort((a, b) => a.ref.localeCompare(b.ref));
    }
    toResult(entry, score, includeSchemas) {
        const r = entry.record;
        return {
            toolRef: r.ref,
            server: r.serverId,
            name: r.name,
            description: r.description,
            score: Math.round(score * 1000) / 1000,
            tags: r.tags,
            requiresAuth: entry.requiresAuth,
            ...(includeSchemas ? { inputSchema: r.inputSchema } : {}),
        };
    }
}
//# sourceMappingURL=catalog.js.map