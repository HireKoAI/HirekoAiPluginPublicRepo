/**
 * `hireko reload`.
 *
 * Preference order:
 *   1. Live control endpoint (serve.json: pid+port+secret) — HTTP POST /reload.
 *   2. SIGUSR2 to the pid-file process.
 *   3. No running serve: validate config only; applies on next start.
 * The MCP-side equivalent is the `reload_registry` meta-tool.
 */
export declare function reloadCommand(opts: {
    config?: string;
}): Promise<void>;
