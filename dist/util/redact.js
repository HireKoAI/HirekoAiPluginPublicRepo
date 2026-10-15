/**
 * Redaction helpers (spec §28). Logs may show token fingerprints but never
 * enough material to reconstruct a credential.
 */
/** `eyJhbGciOi...7ac2` — short fingerprint, safe for logs. */
export function tokenFingerprint(token) {
    if (token.length <= 12)
        return "***";
    return `${token.slice(0, 3)}...${token.slice(-4)}`;
}
const SENSITIVE_KEY_PATTERN = /(password|secret|token|authorization|cookie|apikey|api_key)/i;
/**
 * Deep-mask any value whose key looks sensitive. Used before any config is
 * rendered into logs, `doctor` output, or error messages.
 */
export function maskSensitive(value, depth = 0) {
    if (depth > 8 || value === null || value === undefined)
        return value;
    if (Array.isArray(value))
        return value.map((v) => maskSensitive(v, depth + 1));
    if (typeof value === "object") {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (SENSITIVE_KEY_PATTERN.test(k) && typeof v === "string") {
                out[k] = v.length > 0 ? "***" : "";
            }
            else {
                out[k] = maskSensitive(v, depth + 1);
            }
        }
        return out;
    }
    return value;
}
//# sourceMappingURL=redact.js.map