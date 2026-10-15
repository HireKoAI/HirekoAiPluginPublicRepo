/** Preferred /human control port when the harness-owned `serve` binds HTTP. */
export declare const PREFERRED_CONTROL_PORT = 8400;
/**
 * Clear orphaned `--detach` proxies. Do not start a new daemon.
 *
 * Claude/Cursor own MCP via stdio (`mcp.json` → `serve`). That child receives
 * OS teardown when the harness exits. A detached HTTP daemon would survive the
 * harness and is intentionally not started here.
 */
export declare function upCommand(opts: {
    config?: string;
    restart?: boolean;
    json?: boolean;
}): Promise<void>;
