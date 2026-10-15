import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
/**
 * Soft-cap text parts in a tool result so huge downstream payloads do not
 * blow the harness context (Headroom-inspired; no compression model — just trim).
 */
export declare function softTruncateToolResult(result: CallToolResult, maxChars: number): CallToolResult;
