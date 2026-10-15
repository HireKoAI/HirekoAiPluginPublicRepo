/**
 * Structured stderr logger.
 *
 * STDIO constraint (spec §20): when running as an MCP stdio server, stdout is
 * reserved exclusively for JSON-RPC. Every log line therefore goes to stderr.
 */
const LEVEL_ORDER = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
};
function levelFromEnv() {
    const raw = (process.env.HIREKO_LOG_LEVEL ?? "info").toLowerCase();
    if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
        return raw;
    }
    return "info";
}
class StructuredLogger {
    minLevel;
    bindings;
    constructor(minLevel, bindings = {}) {
        this.minLevel = minLevel ?? LEVEL_ORDER[levelFromEnv()];
        this.bindings = bindings;
    }
    emit(level, msg, fields) {
        if (LEVEL_ORDER[level] < this.minLevel)
            return;
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            level,
            msg,
            ...this.bindings,
            ...fields,
        });
        // stderr only, always. Never stdout.
        process.stderr.write(line + "\n");
    }
    debug(msg, fields) {
        this.emit("debug", msg, fields);
    }
    info(msg, fields) {
        this.emit("info", msg, fields);
    }
    warn(msg, fields) {
        this.emit("warn", msg, fields);
    }
    error(msg, fields) {
        this.emit("error", msg, fields);
    }
    child(bindings) {
        return new StructuredLogger(this.minLevel, { ...this.bindings, ...bindings });
    }
}
/** Shared root logger. */
export const rootLogger = new StructuredLogger();
/** Test helper: capture log lines instead of writing to stderr. */
export function createCapturingLogger() {
    const lines = [];
    const make = (bindings = {}) => ({
        debug: (msg, fields) => lines.push({ level: "debug", msg, fields: { ...bindings, ...fields } }),
        info: (msg, fields) => lines.push({ level: "info", msg, fields: { ...bindings, ...fields } }),
        warn: (msg, fields) => lines.push({ level: "warn", msg, fields: { ...bindings, ...fields } }),
        error: (msg, fields) => lines.push({ level: "error", msg, fields: { ...bindings, ...fields } }),
        child: (b) => make({ ...bindings, ...b }),
    });
    return { logger: make(), lines };
}
//# sourceMappingURL=logger.js.map