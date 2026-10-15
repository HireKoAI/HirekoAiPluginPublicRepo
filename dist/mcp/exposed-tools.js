import { sanitizeToolName } from "./session.js";
/** Build the MCP-facing tool name for a catalog record (`server__tool`). */
export function exposedNameFor(record) {
    return sanitizeToolName(`${record.serverId}__${record.name}`);
}
/**
 * Description shown to the harness: optional group blurb + tool description.
 * Keeps auth note so models don't invent Authorization headers.
 */
export function hostToolDescription(record, groupDescription) {
    const parts = [];
    const group = groupDescription?.trim() || record.groupDescription?.trim();
    if (group)
        parts.push(`[${record.serverId}] ${group}`);
    else
        parts.push(`[${record.serverId}]`);
    const desc = record.description?.trim();
    if (desc)
        parts.push(desc);
    else if (record.title?.trim())
        parts.push(record.title.trim());
    parts.push("Auth is injected by the proxy — do not pass tokens or Authorization headers.");
    return parts.join(" — ");
}
/** Map exposed MCP names → catalog records (unique within the cap). */
export function buildExposedToolMap(records, maxTools) {
    const used = new Set();
    const map = new Map();
    for (const record of records) {
        if (map.size >= maxTools)
            break;
        let name = exposedNameFor(record);
        if (used.has(name)) {
            for (let i = 2;; i += 1) {
                const candidate = `${name.slice(0, 60)}_${i}`;
                if (!used.has(candidate)) {
                    name = candidate;
                    break;
                }
            }
        }
        used.add(name);
        map.set(name, record);
    }
    return map;
}
//# sourceMappingURL=exposed-tools.js.map