import { z } from "zod";
/**
 * Zod runtime validation for the registry file (spec §10).
 * The parsed type is the single source of truth for the rest of the codebase.
 */
export const CognitoConfigSchema = z.object({
    region: z.string().min(1),
    userPoolId: z.string().min(1),
    clientId: z.string().min(1),
    clientSecret: z.string().optional(),
    /** `password` = Cognito USER_PASSWORD_AUTH. `pkce` = Hosted UI authorization code + PKCE. */
    authMode: z.enum(["password", "pkce"]).default("password"),
    /** Hosted UI domain (no scheme), e.g. prod-foo.auth.us-east-1.amazoncognito.com */
    hostedUiDomain: z.string().min(1).optional(),
    /** OAuth scopes for pkce (default openid email profile). */
    oauthScopes: z.array(z.string()).optional(),
    /** Which Cognito token is forwarded downstream (spec §14). */
    tokenToForward: z.enum(["access", "id"]).default("access"),
    /** Refresh this many seconds before expiry (spec §14). */
    refreshSafetyWindowSec: z.number().int().min(0).default(60),
});
export const TenantConfigSchema = z.object({
    cognito: CognitoConfigSchema,
});
export const TransportKindSchema = z.enum(["streamable-http", "sse", "stdio"]);
export const ServerConfigSchema = z
    .object({
    transport: TransportKindSchema,
    /** HTTP/SSE endpoint. May include ${TENANT} (filled from Settings → active tenant). */
    url: z
        .string()
        .min(1)
        .refine((u) => {
        try {
            new URL(u.replaceAll("${TENANT}", "tenant"));
            return true;
        }
        catch {
            return false;
        }
    }, "http/sse servers require a valid url (may include ${TENANT})")
        .optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    /** Env for stdio servers; supports ${ACCESS_TOKEN}/${ID_TOKEN}/${TENANT} templates. */
    env: z.record(z.string()).optional(),
    /** Static extra headers for HTTP transports (not protected-header overrides). */
    headers: z.record(z.string()).optional(),
    tags: z.array(z.string()).default([]),
    /** Human blurb for this server group — used in filter ranking and flattened tool descriptions. */
    description: z.string().max(2000).optional(),
    enabled: z.boolean().default(true),
    /** Whether Hireko injects tenant auth into this server's requests (default true). */
    injectAuth: z.boolean().default(true),
    /** Per-request connect/list timeout in ms. */
    timeoutMs: z.number().int().positive().default(15_000),
})
    .refine((s) => (s.transport === "stdio" ? s.command !== undefined : s.url !== undefined), {
    message: "stdio servers require `command`; http/sse servers require `url`",
});
/** Extra forwarded headers (spec §16). Value may be `"<value>"` (key = header
 * name) or `{ name, value }`. Templates: ${ACCESS_TOKEN} ${ID_TOKEN} ${TENANT}. */
export const AuthHeaderValueSchema = z.union([
    z.string(),
    z.object({ name: z.string().min(1), value: z.string() }),
]);
export const RoutingConfigSchema = z.object({
    /**
     * `flat` (default): expose namespaced downstream tools on tools/list for direct calls.
     * `meta`: classic discover/call hop only (legacy).
     */
    mode: z.enum(["flat", "meta"]).default("flat"),
    defaultLimit: z.number().int().positive().default(12),
    maxResults: z.number().int().positive().default(50),
    /** Cap how many downstream tools appear on tools/list in flat mode. */
    flattenMaxTools: z.number().int().positive().default(500),
    /**
     * Soft-cap characters of each text part in proxied tool results (Headroom-style).
     * Oversized parts are truncated with a note; set very high to disable.
     */
    maxResultChars: z.number().int().positive().default(80_000),
    /** Mode B (spec §4): after filter, also activate subset — mainly for meta mode. */
    dynamicToolActivation: z.boolean().default(false),
});
export const DiscoveryConfigSchema = z.object({
    /** Bounded concurrency for downstream discovery (spec §26). */
    concurrency: z.number().int().positive().default(8),
});
/**
 * Localhost control endpoint (status/reload). Port acquisition tries the
 * inclusive range and settles on the first free port. Defaults to the 84xx
 * hundreds (1-1023 are privileged).
 */
export const ControlConfigSchema = z.object({
    enabled: z.boolean().default(true),
    portStart: z.number().int().min(1024).max(65535).default(8400),
    portEnd: z.number().int().min(1024).max(65535).default(8409),
});
export const ConfigSchema = z
    .object({
    version: z.literal(1),
    activeTenant: z.string().min(1),
    tenants: z.record(z.string(), TenantConfigSchema).default({}),
    servers: z.record(z.string(), ServerConfigSchema),
    authHeaders: z.record(z.string(), AuthHeaderValueSchema).optional(),
    routing: RoutingConfigSchema.default({}),
    discovery: DiscoveryConfigSchema.default({}),
    control: ControlConfigSchema.default({}),
    /** Watch the config file and hot-reload with debounce (spec §18). */
    watchConfig: z.boolean().default(false),
    watchDebounceMs: z.number().int().positive().default(300),
});
export function normalizeServers(config) {
    const map = new Map();
    for (const [id, s] of Object.entries(config.servers)) {
        map.set(id, { id, ...s });
    }
    return map;
}
//# sourceMappingURL=schema.js.map