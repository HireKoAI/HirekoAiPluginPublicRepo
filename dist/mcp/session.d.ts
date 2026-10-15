import type { ToolRecord } from "../registry/types.js";
/**
 * Per-session dynamic-activation state (spec §4 Mode B). Stdio hosts have one
 * session per process; the class is still instance-per-session so a future
 * multi-session transport works without redesign.
 */
export declare class ActivationSession {
    /** exposed (sanitized) tool name → record */
    private activated;
    /** toolRef → exposed name */
    private refToExposed;
    setActivated(records: ToolRecord[]): void;
    clear(): void;
    get size(): number;
    byExposedName(name: string): ToolRecord | undefined;
    entries(): Array<{
        exposedName: string;
        record: ToolRecord;
    }>;
}
/** MCP tool names must match [a-zA-Z0-9_-]{1,64}. */
export declare function sanitizeToolName(name: string): string;
