import { productName } from "../product-name.js";
/**
 * Soft-cap text parts in a tool result so huge downstream payloads do not
 * blow the harness context (Headroom-inspired; no compression model — just trim).
 */
export function softTruncateToolResult(result, maxChars) {
    if (!Number.isFinite(maxChars) || maxChars <= 0)
        return result;
    if (!Array.isArray(result.content) || result.content.length === 0)
        return result;
    let truncated = false;
    const content = result.content.map((part) => {
        if (!part || typeof part !== "object")
            return part;
        if (part.type !== "text")
            return part;
        const text = part.text;
        if (typeof text !== "string" || text.length <= maxChars)
            return part;
        truncated = true;
        const kept = text.slice(0, maxChars);
        return {
            ...part,
            text: `${kept}\n\n…[${productName()} truncated ${text.length - maxChars} chars; maxResultChars=${maxChars}]`,
        };
    });
    return truncated ? { ...result, content } : result;
}
//# sourceMappingURL=truncate-result.js.map