/**
 * `serve` — local MCP + /human control plane.
 *
 * Default: stdio MCP (Claude/Cursor child). stdout is JSON-RPC only.
 * When the harness exits, the OS tears this process down with it.
 * `--detach`: optional orphan daemon (HTTP MCP); prefer stdio for harness use.
 */
export declare function serveCommand(opts: {
    config?: string;
    detach?: boolean;
}): Promise<void>;
