/**
 * Structured stderr logger.
 *
 * STDIO constraint (spec §20): when running as an MCP stdio server, stdout is
 * reserved exclusively for JSON-RPC. Every log line therefore goes to stderr.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogFields {
    requestId?: string;
    serverId?: string;
    toolRef?: string;
    durationMs?: number;
    authRefresh?: boolean;
    status?: string;
    errorCode?: string;
    [key: string]: unknown;
}
export interface Logger {
    debug(msg: string, fields?: LogFields): void;
    info(msg: string, fields?: LogFields): void;
    warn(msg: string, fields?: LogFields): void;
    error(msg: string, fields?: LogFields): void;
    child(bindings: LogFields): Logger;
}
/** Shared root logger. */
export declare const rootLogger: Logger;
/** Test helper: capture log lines instead of writing to stderr. */
export declare function createCapturingLogger(): {
    logger: Logger;
    lines: Array<{
        level: LogLevel;
        msg: string;
        fields?: LogFields;
    }>;
};
