/**
 * Per-session dynamic-activation state (spec §4 Mode B). Stdio hosts have one
 * session per process; the class is still instance-per-session so a future
 * multi-session transport works without redesign.
 */
export class ActivationSession {
    /** exposed (sanitized) tool name → record */
    activated = new Map();
    /** toolRef → exposed name */
    refToExposed = new Map();
    setActivated(records) {
        this.activated.clear();
        this.refToExposed.clear();
        const used = new Set();
        for (const record of records) {
            const exposed = uniqueExposedName(sanitizeToolName(`${record.serverId}__${record.name}`), used);
            used.add(exposed);
            this.activated.set(exposed, record);
            this.refToExposed.set(record.ref, exposed);
        }
    }
    clear() {
        this.activated.clear();
        this.refToExposed.clear();
    }
    get size() {
        return this.activated.size;
    }
    byExposedName(name) {
        return this.activated.get(name);
    }
    entries() {
        return [...this.activated.entries()].map(([exposedName, record]) => ({ exposedName, record }));
    }
}
/** MCP tool names must match [a-zA-Z0-9_-]{1,64}. */
export function sanitizeToolName(name) {
    const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    return cleaned.length > 0 ? cleaned : "tool";
}
function uniqueExposedName(name, used) {
    if (!used.has(name))
        return name;
    for (let i = 2;; i += 1) {
        const candidate = `${name.slice(0, 60)}_${i}`;
        if (!used.has(candidate))
            return candidate;
    }
}
//# sourceMappingURL=session.js.map