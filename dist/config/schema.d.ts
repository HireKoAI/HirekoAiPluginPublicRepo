import { z } from "zod";
/**
 * Zod runtime validation for the registry file (spec §10).
 * The parsed type is the single source of truth for the rest of the codebase.
 */
export declare const CognitoConfigSchema: z.ZodObject<{
    region: z.ZodString;
    userPoolId: z.ZodString;
    clientId: z.ZodString;
    clientSecret: z.ZodOptional<z.ZodString>;
    /** `password` = Cognito USER_PASSWORD_AUTH. `pkce` = Hosted UI authorization code + PKCE. */
    authMode: z.ZodDefault<z.ZodEnum<["password", "pkce"]>>;
    /** Hosted UI domain (no scheme), e.g. prod-foo.auth.us-east-1.amazoncognito.com */
    hostedUiDomain: z.ZodOptional<z.ZodString>;
    /** OAuth scopes for pkce (default openid email profile). */
    oauthScopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Which Cognito token is forwarded downstream (spec §14). */
    tokenToForward: z.ZodDefault<z.ZodEnum<["access", "id"]>>;
    /** Refresh this many seconds before expiry (spec §14). */
    refreshSafetyWindowSec: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    region: string;
    userPoolId: string;
    clientId: string;
    authMode: "password" | "pkce";
    tokenToForward: "access" | "id";
    refreshSafetyWindowSec: number;
    clientSecret?: string | undefined;
    hostedUiDomain?: string | undefined;
    oauthScopes?: string[] | undefined;
}, {
    region: string;
    userPoolId: string;
    clientId: string;
    clientSecret?: string | undefined;
    authMode?: "password" | "pkce" | undefined;
    hostedUiDomain?: string | undefined;
    oauthScopes?: string[] | undefined;
    tokenToForward?: "access" | "id" | undefined;
    refreshSafetyWindowSec?: number | undefined;
}>;
export type CognitoConfig = z.infer<typeof CognitoConfigSchema>;
export declare const TenantConfigSchema: z.ZodObject<{
    cognito: z.ZodObject<{
        region: z.ZodString;
        userPoolId: z.ZodString;
        clientId: z.ZodString;
        clientSecret: z.ZodOptional<z.ZodString>;
        /** `password` = Cognito USER_PASSWORD_AUTH. `pkce` = Hosted UI authorization code + PKCE. */
        authMode: z.ZodDefault<z.ZodEnum<["password", "pkce"]>>;
        /** Hosted UI domain (no scheme), e.g. prod-foo.auth.us-east-1.amazoncognito.com */
        hostedUiDomain: z.ZodOptional<z.ZodString>;
        /** OAuth scopes for pkce (default openid email profile). */
        oauthScopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Which Cognito token is forwarded downstream (spec §14). */
        tokenToForward: z.ZodDefault<z.ZodEnum<["access", "id"]>>;
        /** Refresh this many seconds before expiry (spec §14). */
        refreshSafetyWindowSec: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        region: string;
        userPoolId: string;
        clientId: string;
        authMode: "password" | "pkce";
        tokenToForward: "access" | "id";
        refreshSafetyWindowSec: number;
        clientSecret?: string | undefined;
        hostedUiDomain?: string | undefined;
        oauthScopes?: string[] | undefined;
    }, {
        region: string;
        userPoolId: string;
        clientId: string;
        clientSecret?: string | undefined;
        authMode?: "password" | "pkce" | undefined;
        hostedUiDomain?: string | undefined;
        oauthScopes?: string[] | undefined;
        tokenToForward?: "access" | "id" | undefined;
        refreshSafetyWindowSec?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    cognito: {
        region: string;
        userPoolId: string;
        clientId: string;
        authMode: "password" | "pkce";
        tokenToForward: "access" | "id";
        refreshSafetyWindowSec: number;
        clientSecret?: string | undefined;
        hostedUiDomain?: string | undefined;
        oauthScopes?: string[] | undefined;
    };
}, {
    cognito: {
        region: string;
        userPoolId: string;
        clientId: string;
        clientSecret?: string | undefined;
        authMode?: "password" | "pkce" | undefined;
        hostedUiDomain?: string | undefined;
        oauthScopes?: string[] | undefined;
        tokenToForward?: "access" | "id" | undefined;
        refreshSafetyWindowSec?: number | undefined;
    };
}>;
export type TenantConfig = z.infer<typeof TenantConfigSchema>;
export declare const TransportKindSchema: z.ZodEnum<["streamable-http", "sse", "stdio"]>;
export type TransportKind = z.infer<typeof TransportKindSchema>;
export declare const ServerConfigSchema: z.ZodEffects<z.ZodObject<{
    transport: z.ZodEnum<["streamable-http", "sse", "stdio"]>;
    /** HTTP/SSE endpoint. May include ${TENANT} (filled from Settings → active tenant). */
    url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
    command: z.ZodOptional<z.ZodString>;
    args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    /** Env for stdio servers; supports ${ACCESS_TOKEN}/${ID_TOKEN}/${TENANT} templates. */
    env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    /** Static extra headers for HTTP transports (not protected-header overrides). */
    headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    /** Human blurb for this server group — used in filter ranking and flattened tool descriptions. */
    description: z.ZodOptional<z.ZodString>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    /** Whether Hireko injects tenant auth into this server's requests (default true). */
    injectAuth: z.ZodDefault<z.ZodBoolean>;
    /** Per-request connect/list timeout in ms. */
    timeoutMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    transport: "streamable-http" | "sse" | "stdio";
    tags: string[];
    enabled: boolean;
    injectAuth: boolean;
    timeoutMs: number;
    url?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    description?: string | undefined;
}, {
    transport: "streamable-http" | "sse" | "stdio";
    url?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    enabled?: boolean | undefined;
    injectAuth?: boolean | undefined;
    timeoutMs?: number | undefined;
}>, {
    transport: "streamable-http" | "sse" | "stdio";
    tags: string[];
    enabled: boolean;
    injectAuth: boolean;
    timeoutMs: number;
    url?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    description?: string | undefined;
}, {
    transport: "streamable-http" | "sse" | "stdio";
    url?: string | undefined;
    command?: string | undefined;
    args?: string[] | undefined;
    env?: Record<string, string> | undefined;
    headers?: Record<string, string> | undefined;
    tags?: string[] | undefined;
    description?: string | undefined;
    enabled?: boolean | undefined;
    injectAuth?: boolean | undefined;
    timeoutMs?: number | undefined;
}>;
export type ServerConfigInput = z.input<typeof ServerConfigSchema>;
/** Extra forwarded headers (spec §16). Value may be `"<value>"` (key = header
 * name) or `{ name, value }`. Templates: ${ACCESS_TOKEN} ${ID_TOKEN} ${TENANT}. */
export declare const AuthHeaderValueSchema: z.ZodUnion<[z.ZodString, z.ZodObject<{
    name: z.ZodString;
    value: z.ZodString;
}, "strip", z.ZodTypeAny, {
    value: string;
    name: string;
}, {
    value: string;
    name: string;
}>]>;
export declare const RoutingConfigSchema: z.ZodObject<{
    /**
     * `flat` (default): expose namespaced downstream tools on tools/list for direct calls.
     * `meta`: classic discover/call hop only (legacy).
     */
    mode: z.ZodDefault<z.ZodEnum<["flat", "meta"]>>;
    defaultLimit: z.ZodDefault<z.ZodNumber>;
    maxResults: z.ZodDefault<z.ZodNumber>;
    /** Cap how many downstream tools appear on tools/list in flat mode. */
    flattenMaxTools: z.ZodDefault<z.ZodNumber>;
    /**
     * Soft-cap characters of each text part in proxied tool results (Headroom-style).
     * Oversized parts are truncated with a note; set very high to disable.
     */
    maxResultChars: z.ZodDefault<z.ZodNumber>;
    /** Mode B (spec §4): after filter, also activate subset — mainly for meta mode. */
    dynamicToolActivation: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    mode: "flat" | "meta";
    defaultLimit: number;
    maxResults: number;
    flattenMaxTools: number;
    maxResultChars: number;
    dynamicToolActivation: boolean;
}, {
    mode?: "flat" | "meta" | undefined;
    defaultLimit?: number | undefined;
    maxResults?: number | undefined;
    flattenMaxTools?: number | undefined;
    maxResultChars?: number | undefined;
    dynamicToolActivation?: boolean | undefined;
}>;
export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;
export declare const DiscoveryConfigSchema: z.ZodObject<{
    /** Bounded concurrency for downstream discovery (spec §26). */
    concurrency: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    concurrency: number;
}, {
    concurrency?: number | undefined;
}>;
/**
 * Localhost control endpoint (status/reload). Port acquisition tries the
 * inclusive range and settles on the first free port. Defaults to the 84xx
 * hundreds (1-1023 are privileged).
 */
export declare const ControlConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    portStart: z.ZodDefault<z.ZodNumber>;
    portEnd: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    portStart: number;
    portEnd: number;
}, {
    enabled?: boolean | undefined;
    portStart?: number | undefined;
    portEnd?: number | undefined;
}>;
export type ControlConfig = z.infer<typeof ControlConfigSchema>;
export declare const ConfigSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    activeTenant: z.ZodString;
    tenants: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        cognito: z.ZodObject<{
            region: z.ZodString;
            userPoolId: z.ZodString;
            clientId: z.ZodString;
            clientSecret: z.ZodOptional<z.ZodString>;
            /** `password` = Cognito USER_PASSWORD_AUTH. `pkce` = Hosted UI authorization code + PKCE. */
            authMode: z.ZodDefault<z.ZodEnum<["password", "pkce"]>>;
            /** Hosted UI domain (no scheme), e.g. prod-foo.auth.us-east-1.amazoncognito.com */
            hostedUiDomain: z.ZodOptional<z.ZodString>;
            /** OAuth scopes for pkce (default openid email profile). */
            oauthScopes: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
            /** Which Cognito token is forwarded downstream (spec §14). */
            tokenToForward: z.ZodDefault<z.ZodEnum<["access", "id"]>>;
            /** Refresh this many seconds before expiry (spec §14). */
            refreshSafetyWindowSec: z.ZodDefault<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            region: string;
            userPoolId: string;
            clientId: string;
            authMode: "password" | "pkce";
            tokenToForward: "access" | "id";
            refreshSafetyWindowSec: number;
            clientSecret?: string | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
        }, {
            region: string;
            userPoolId: string;
            clientId: string;
            clientSecret?: string | undefined;
            authMode?: "password" | "pkce" | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
            tokenToForward?: "access" | "id" | undefined;
            refreshSafetyWindowSec?: number | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        cognito: {
            region: string;
            userPoolId: string;
            clientId: string;
            authMode: "password" | "pkce";
            tokenToForward: "access" | "id";
            refreshSafetyWindowSec: number;
            clientSecret?: string | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
        };
    }, {
        cognito: {
            region: string;
            userPoolId: string;
            clientId: string;
            clientSecret?: string | undefined;
            authMode?: "password" | "pkce" | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
            tokenToForward?: "access" | "id" | undefined;
            refreshSafetyWindowSec?: number | undefined;
        };
    }>>>;
    servers: z.ZodRecord<z.ZodString, z.ZodEffects<z.ZodObject<{
        transport: z.ZodEnum<["streamable-http", "sse", "stdio"]>;
        /** HTTP/SSE endpoint. May include ${TENANT} (filled from Settings → active tenant). */
        url: z.ZodOptional<z.ZodEffects<z.ZodString, string, string>>;
        command: z.ZodOptional<z.ZodString>;
        args: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        /** Env for stdio servers; supports ${ACCESS_TOKEN}/${ID_TOKEN}/${TENANT} templates. */
        env: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        /** Static extra headers for HTTP transports (not protected-header overrides). */
        headers: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
        tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        /** Human blurb for this server group — used in filter ranking and flattened tool descriptions. */
        description: z.ZodOptional<z.ZodString>;
        enabled: z.ZodDefault<z.ZodBoolean>;
        /** Whether Hireko injects tenant auth into this server's requests (default true). */
        injectAuth: z.ZodDefault<z.ZodBoolean>;
        /** Per-request connect/list timeout in ms. */
        timeoutMs: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        transport: "streamable-http" | "sse" | "stdio";
        tags: string[];
        enabled: boolean;
        injectAuth: boolean;
        timeoutMs: number;
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        description?: string | undefined;
    }, {
        transport: "streamable-http" | "sse" | "stdio";
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        description?: string | undefined;
        enabled?: boolean | undefined;
        injectAuth?: boolean | undefined;
        timeoutMs?: number | undefined;
    }>, {
        transport: "streamable-http" | "sse" | "stdio";
        tags: string[];
        enabled: boolean;
        injectAuth: boolean;
        timeoutMs: number;
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        description?: string | undefined;
    }, {
        transport: "streamable-http" | "sse" | "stdio";
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        description?: string | undefined;
        enabled?: boolean | undefined;
        injectAuth?: boolean | undefined;
        timeoutMs?: number | undefined;
    }>>;
    authHeaders: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodObject<{
        name: z.ZodString;
        value: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        value: string;
        name: string;
    }, {
        value: string;
        name: string;
    }>]>>>;
    routing: z.ZodDefault<z.ZodObject<{
        /**
         * `flat` (default): expose namespaced downstream tools on tools/list for direct calls.
         * `meta`: classic discover/call hop only (legacy).
         */
        mode: z.ZodDefault<z.ZodEnum<["flat", "meta"]>>;
        defaultLimit: z.ZodDefault<z.ZodNumber>;
        maxResults: z.ZodDefault<z.ZodNumber>;
        /** Cap how many downstream tools appear on tools/list in flat mode. */
        flattenMaxTools: z.ZodDefault<z.ZodNumber>;
        /**
         * Soft-cap characters of each text part in proxied tool results (Headroom-style).
         * Oversized parts are truncated with a note; set very high to disable.
         */
        maxResultChars: z.ZodDefault<z.ZodNumber>;
        /** Mode B (spec §4): after filter, also activate subset — mainly for meta mode. */
        dynamicToolActivation: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        mode: "flat" | "meta";
        defaultLimit: number;
        maxResults: number;
        flattenMaxTools: number;
        maxResultChars: number;
        dynamicToolActivation: boolean;
    }, {
        mode?: "flat" | "meta" | undefined;
        defaultLimit?: number | undefined;
        maxResults?: number | undefined;
        flattenMaxTools?: number | undefined;
        maxResultChars?: number | undefined;
        dynamicToolActivation?: boolean | undefined;
    }>>;
    discovery: z.ZodDefault<z.ZodObject<{
        /** Bounded concurrency for downstream discovery (spec §26). */
        concurrency: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        concurrency: number;
    }, {
        concurrency?: number | undefined;
    }>>;
    control: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        portStart: z.ZodDefault<z.ZodNumber>;
        portEnd: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        portStart: number;
        portEnd: number;
    }, {
        enabled?: boolean | undefined;
        portStart?: number | undefined;
        portEnd?: number | undefined;
    }>>;
    /** Watch the config file and hot-reload with debounce (spec §18). */
    watchConfig: z.ZodDefault<z.ZodBoolean>;
    watchDebounceMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    version: 1;
    activeTenant: string;
    tenants: Record<string, {
        cognito: {
            region: string;
            userPoolId: string;
            clientId: string;
            authMode: "password" | "pkce";
            tokenToForward: "access" | "id";
            refreshSafetyWindowSec: number;
            clientSecret?: string | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
        };
    }>;
    servers: Record<string, {
        transport: "streamable-http" | "sse" | "stdio";
        tags: string[];
        enabled: boolean;
        injectAuth: boolean;
        timeoutMs: number;
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        description?: string | undefined;
    }>;
    routing: {
        mode: "flat" | "meta";
        defaultLimit: number;
        maxResults: number;
        flattenMaxTools: number;
        maxResultChars: number;
        dynamicToolActivation: boolean;
    };
    discovery: {
        concurrency: number;
    };
    control: {
        enabled: boolean;
        portStart: number;
        portEnd: number;
    };
    watchConfig: boolean;
    watchDebounceMs: number;
    authHeaders?: Record<string, string | {
        value: string;
        name: string;
    }> | undefined;
}, {
    version: 1;
    activeTenant: string;
    servers: Record<string, {
        transport: "streamable-http" | "sse" | "stdio";
        url?: string | undefined;
        command?: string | undefined;
        args?: string[] | undefined;
        env?: Record<string, string> | undefined;
        headers?: Record<string, string> | undefined;
        tags?: string[] | undefined;
        description?: string | undefined;
        enabled?: boolean | undefined;
        injectAuth?: boolean | undefined;
        timeoutMs?: number | undefined;
    }>;
    tenants?: Record<string, {
        cognito: {
            region: string;
            userPoolId: string;
            clientId: string;
            clientSecret?: string | undefined;
            authMode?: "password" | "pkce" | undefined;
            hostedUiDomain?: string | undefined;
            oauthScopes?: string[] | undefined;
            tokenToForward?: "access" | "id" | undefined;
            refreshSafetyWindowSec?: number | undefined;
        };
    }> | undefined;
    authHeaders?: Record<string, string | {
        value: string;
        name: string;
    }> | undefined;
    routing?: {
        mode?: "flat" | "meta" | undefined;
        defaultLimit?: number | undefined;
        maxResults?: number | undefined;
        flattenMaxTools?: number | undefined;
        maxResultChars?: number | undefined;
        dynamicToolActivation?: boolean | undefined;
    } | undefined;
    discovery?: {
        concurrency?: number | undefined;
    } | undefined;
    control?: {
        enabled?: boolean | undefined;
        portStart?: number | undefined;
        portEnd?: number | undefined;
    } | undefined;
    watchConfig?: boolean | undefined;
    watchDebounceMs?: number | undefined;
}>;
export type RawConfig = z.input<typeof ConfigSchema>;
export type AppConfig = z.output<typeof ConfigSchema>;
/** Normalized server entry used everywhere after parsing. */
export interface ServerConfig {
    id: string;
    transport: TransportKind;
    url?: string;
    command?: string;
    args?: string[];
    env?: Record<string, string>;
    headers?: Record<string, string>;
    tags: string[];
    description?: string;
    enabled: boolean;
    injectAuth: boolean;
    timeoutMs: number;
}
export declare function normalizeServers(config: AppConfig): Map<string, ServerConfig>;
