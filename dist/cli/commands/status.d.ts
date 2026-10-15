/**
 * `hireko status` — fleet overview (spec §22).
 *
 * Preference: the LIVE serve process via the control endpoint (fast, shows
 * reality). Fallback: one-shot bootstrap with discovery.
 */
export declare function statusCommand(opts: {
    config?: string;
    json?: boolean;
}): Promise<void>;
