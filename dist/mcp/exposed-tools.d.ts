import type { ToolRecord } from "../registry/types.js";
/** Build the MCP-facing tool name for a catalog record (`server__tool`). */
export declare function exposedNameFor(record: Pick<ToolRecord, "serverId" | "name">): string;
/**
 * Description shown to the harness: optional group blurb + tool description.
 * Keeps auth note so models don't invent Authorization headers.
 */
export declare function hostToolDescription(record: ToolRecord, groupDescription?: string): string;
/** Map exposed MCP names → catalog records (unique within the cap). */
export declare function buildExposedToolMap(records: ToolRecord[], maxTools: number): Map<string, ToolRecord>;
