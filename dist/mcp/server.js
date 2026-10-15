import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { NotAuthenticatedError } from "../auth/types.js";
import { ServerUnavailableError, UnknownToolError } from "../proxy/errors.js";
import { META_TOOL_NAMES, metaToolsForMode } from "./core.js";
import { buildExposedToolMap, hostToolDescription } from "./exposed-tools.js";
import { softTruncateToolResult } from "./truncate-result.js";
import { productName } from "../product-name.js";
const SERVER_VERSION = "0.1.0";
/**
 * The MCP server Claude Code / Cursor talks to.
 *
 * Flat mode (default): meta helpers + namespaced downstream tools on tools/list.
 * Meta mode: classic meta-only surface (+ Mode B activation when enabled).
 * Auth is always injected by the proxy on downstream calls — never by the model.
 */
export function createHostServer(opts) {
    const server = new Server({ name: productName(), version: SERVER_VERSION }, { capabilities: { tools: { listChanged: true } } });
    const flattenedMap = () => {
        const routing = opts.getConfig().routing;
        return buildExposedToolMap(opts.catalog.listRecords(), routing.flattenMaxTools);
    };
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        const config = opts.getConfig();
        const mode = config.routing.mode;
        const tools = [...metaToolsForMode(mode)];
        if (mode === "flat") {
            for (const [exposedName, record] of flattenedMap()) {
                tools.push({
                    name: exposedName,
                    description: hostToolDescription(record),
                    inputSchema: record.inputSchema ?? { type: "object", properties: {} },
                    annotations: record.annotations,
                });
            }
        }
        else if (opts.dynamicToolActivation) {
            for (const { exposedName, record } of opts.session.entries()) {
                tools.push({
                    name: exposedName,
                    description: hostToolDescription(record),
                    inputSchema: record.inputSchema ?? { type: "object", properties: {} },
                    annotations: record.annotations,
                });
            }
        }
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        const started = Date.now();
        const mode = opts.getConfig().routing.mode;
        // Flattened or Mode-B activated downstream tools — auth injected in core.callTool → transport.
        if (!META_TOOL_NAMES.has(name)) {
            if (mode === "flat") {
                const record = flattenedMap().get(name);
                if (record) {
                    const result = await opts.core.callTool({ toolRef: record.ref, arguments: args });
                    return softTruncateToolResult(normalizeResult(result), opts.getConfig().routing.maxResultChars);
                }
            }
            if (opts.dynamicToolActivation) {
                const record = opts.session.byExposedName(name);
                if (record) {
                    const result = await opts.core.callTool({ toolRef: record.ref, arguments: args });
                    return softTruncateToolResult(normalizeResult(result), opts.getConfig().routing.maxResultChars);
                }
            }
            throw new UnknownToolError(name);
        }
        // Legacy discover_tools alias is in META_TOOL_NAMES but not always listed.
        try {
            const result = await opts.core.dispatch(name, args);
            opts.logger.debug("meta-tool ok", { tool: name, durationMs: Date.now() - started });
            // call_tool (meta mode) also returns downstream payloads — soft-cap those too.
            const normalized = normalizeResult(result);
            if (name === "call_tool") {
                return softTruncateToolResult(normalized, opts.getConfig().routing.maxResultChars);
            }
            return normalized;
        }
        catch (err) {
            opts.logger.warn("meta-tool error", {
                tool: name,
                durationMs: Date.now() - started,
                errorCode: err?.name,
                error: err?.message,
            });
            return errorResult(err);
        }
    });
    opts.core.setOnToolsChanged(() => {
        server.sendToolListChanged().catch((err) => {
            opts.logger.warn("tools/list_changed notification failed", { error: String(err) });
        });
    });
    return server;
}
/** Serve over stdio. stdout from here on is JSON-RPC only (spec §20). */
export async function serveStdio(server, logger) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    logger.info(`${productName()} MCP server listening on stdio`);
}
function normalizeResult(result) {
    // Downstream results pass through unchanged where possible (spec §7).
    if (result !== null &&
        typeof result === "object" &&
        "content" in result &&
        Array.isArray(result.content)) {
        return result;
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
}
/** Tool-level errors become isError results so the model can react. */
function errorResult(err) {
    // Known domain errors are safe to surface verbatim; unexpected errors (e.g.
    // AWS SDK rejects) carry account IDs/regions/request IDs in their message,
    // so those get a generic label — raw internals never reach the model.
    if (err instanceof UnknownToolError ||
        err instanceof ServerUnavailableError ||
        err instanceof NotAuthenticatedError) {
        return { content: [{ type: "text", text: err.message }], isError: true };
    }
    const name = err instanceof Error ? err.name : "Error";
    return { content: [{ type: "text", text: `${name}: operation failed (see proxy logs)` }], isError: true };
}
//# sourceMappingURL=server.js.map