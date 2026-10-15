/** Concurrency primitives. Small, dependency-free, race-safe. */
/**
 * Single-flight gate: concurrent callers of `run()` while one execution is in
 * flight all await the same promise. Used for token refresh (spec §14) and
 * registry reload (spec §26).
 */
export declare class SingleFlight<T> {
    private inflight;
    run(fn: () => Promise<T>): Promise<T>;
    get pending(): boolean;
}
/** Mutual exclusion across async sections. */
export declare class Mutex {
    private chain;
    runExclusive<T>(fn: () => Promise<T>): Promise<T>;
}
export interface PoolOptions {
    concurrency: number;
}
/**
 * Map over items with bounded concurrency (spec §26: max N concurrent
 * downstream initializations). Returns results in input order; a failing item
 * yields its error via `onError` and does not cancel siblings.
 */
export declare function poolMap<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>, opts: PoolOptions): Promise<Array<{
    ok: true;
    value: R;
} | {
    ok: false;
    error: unknown;
}>>;
export declare function delay(ms: number): Promise<void>;
/** Bounded exponential backoff: base * factor^attempt, capped. */
export declare function backoffDelay(attempt: number, baseMs?: number, factor?: number, capMs?: number): number;
export interface TimeoutHandle<T> {
    result: Promise<T>;
}
/** Reject with a TimeoutError if `fn` does not settle within `ms`. */
export declare function withTimeout<T>(fn: () => Promise<T>, ms: number, what: string): Promise<T>;
export declare class TimeoutError extends Error {
    constructor(message: string);
}
