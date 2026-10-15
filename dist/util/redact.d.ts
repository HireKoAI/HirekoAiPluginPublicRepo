/**
 * Redaction helpers (spec §28). Logs may show token fingerprints but never
 * enough material to reconstruct a credential.
 */
/** `eyJhbGciOi...7ac2` — short fingerprint, safe for logs. */
export declare function tokenFingerprint(token: string): string;
/**
 * Deep-mask any value whose key looks sensitive. Used before any config is
 * rendered into logs, `doctor` output, or error messages.
 */
export declare function maskSensitive(value: unknown, depth?: number): unknown;
