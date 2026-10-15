/**
 * `hireko tools` / `hireko tools search "<context>"` (spec §23).
 * Search uses exactly the same scorer as the MCP filter_tools_with_query meta-tool.
 */
export declare function toolsCommand(context: string | undefined, opts: {
    config?: string;
    limit?: string;
    server?: string;
    json?: boolean;
}): Promise<void>;
