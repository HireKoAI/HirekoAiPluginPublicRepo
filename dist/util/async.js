/** Concurrency primitives. Small, dependency-free, race-safe. */
/**
 * Single-flight gate: concurrent callers of `run()` while one execution is in
 * flight all await the same promise. Used for token refresh (spec §14) and
 * registry reload (spec §26).
 */
export class SingleFlight {
    inflight;
    async run(fn) {
        if (this.inflight)
            return this.inflight;
        const p = fn().finally(() => {
            this.inflight = undefined;
        });
        this.inflight = p;
        return p;
    }
    get pending() {
        return this.inflight !== undefined;
    }
}
/** Mutual exclusion across async sections. */
export class Mutex {
    chain = Promise.resolve();
    async runExclusive(fn) {
        const prev = this.chain;
        let release;
        this.chain = new Promise((resolve) => {
            release = resolve;
        });
        await prev;
        try {
            return await fn();
        }
        finally {
            release();
        }
    }
}
/**
 * Map over items with bounded concurrency (spec §26: max N concurrent
 * downstream initializations). Returns results in input order; a failing item
 * yields its error via `onError` and does not cancel siblings.
 */
export async function poolMap(items, fn, opts) {
    const results = new Array(items.length);
    let next = 0;
    const workers = Math.max(1, Math.min(opts.concurrency, items.length));
    async function worker() {
        for (;;) {
            const i = next++;
            if (i >= items.length)
                return;
            const item = items[i];
            try {
                results[i] = { ok: true, value: await fn(item, i) };
            }
            catch (error) {
                results[i] = { ok: false, error };
            }
        }
    }
    await Promise.all(Array.from({ length: workers }, () => worker()));
    return results;
}
export function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/** Bounded exponential backoff: base * factor^attempt, capped. */
export function backoffDelay(attempt, baseMs = 500, factor = 2, capMs = 30_000) {
    return Math.min(capMs, baseMs * Math.pow(factor, attempt));
}
/** Reject with a TimeoutError if `fn` does not settle within `ms`. */
export async function withTimeout(fn, ms, what) {
    let timer;
    try {
        return await Promise.race([
            fn(),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new TimeoutError(`${what} timed out after ${ms}ms`)), ms);
            }),
        ]);
    }
    finally {
        clearTimeout(timer);
    }
}
export class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = "TimeoutError";
    }
}
//# sourceMappingURL=async.js.map