import type { AuthScopeProvider } from "./auth-scope-provider.js";
import type { Logger } from "../logging/logger.js";
import type { AppConfig } from "../config/schema.js";
export interface InternalApiKeyPayload {
    username: string;
    password: string;
    tenant: string;
}
export type PasswordLoginSource = "fields" | "apiKey" | "env" | "plainEnv";
export interface ResolvedPasswordLogin extends InternalApiKeyPayload {
    source: PasswordLoginSource;
}
/** Standard base64 of `{"username","password","tenant"}` (field order not required). */
export declare function encodeInternalApiKey(payload: InternalApiKeyPayload): string;
export declare function decodeInternalApiKey(raw: string): InternalApiKeyPayload;
export declare function readInternalApiKeyFromEnv(env?: NodeJS.ProcessEnv): string | undefined;
/**
 * Read the plain-env CI triplet:
 *   <productName>_tenant / <productName>_username / <productName>_password
 * Returns undefined when any of the three values is missing or empty.
 */
export declare function readPlainEnvCredentials(env?: NodeJS.ProcessEnv): InternalApiKeyPayload | undefined;
export interface HeadlessCredentials extends InternalApiKeyPayload {
    source: "env" | "plainEnv";
}
/**
 * Headless credentials resolver chain.
 * Step 1: HIREKO_INTERNAL_API_KEY (base64 JSON bundle)
 * Step 2: Plain env triplet (<productName>_tenant/username/password)
 * Step 3: Returns undefined if no headless credentials are set.
 */
export declare function readHeadlessCredentials(env?: NodeJS.ProcessEnv): HeadlessCredentials | undefined;
/**
 * Checks whether headless credential environment variables are configured.
 */
export declare function isHeadlessEnv(env?: NodeJS.ProcessEnv): boolean;
/**
 * Chain of Responsibility for password login credential resolution:
 * 1. Explicit fields (tenant, username, password) -> source: "fields"
 * 2. Explicit apiKey argument -> source: "apiKey"
 * 3. Headless env sources via readHeadlessCredentials (INTERNAL_API_KEY or plain-env triplet)
 * 4. Throws if no credentials can be resolved.
 */
export declare function resolvePasswordLogin(args: {
    tenant?: unknown;
    username?: unknown;
    password?: unknown;
    apiKey?: unknown;
    env?: NodeJS.ProcessEnv;
}): ResolvedPasswordLogin;
/**
 * Tenant resolution chain for login_browser / device login:
 * 1. Explicit tenant argument
 * 2. Explicit apiKey argument (decodes tenant)
 * 3. Headless credentials in env (extracts tenant)
 * 4. Throws if no tenant can be resolved.
 */
export declare function resolveLoginTenant(args: {
    tenant?: unknown;
    apiKey?: unknown;
    env?: NodeJS.ProcessEnv;
}): {
    tenant: string;
    source: "tenant" | "apiKey" | "env" | "plainEnv";
};
export interface HeadlessLoginOptions {
    logger: Logger;
    getConfig: () => AppConfig;
    authScopeProvider: AuthScopeProvider;
    setActiveTenant: (tenant: string) => Promise<void>;
    env?: NodeJS.ProcessEnv;
}
/**
 * Unified headless login execution chain:
 * 1. Resolves headless credentials (API key or plain-env triplet).
 * 2. If absent -> returns false (interactive mode).
 * 3. If present -> performs single-tenant login assertion, Cognito user auth, and updates activeTenant.
 */
export declare function applyHeadlessLogin(opts: HeadlessLoginOptions): Promise<boolean>;
/** Backwards-compatible alias for applyHeadlessLogin. */
export declare function applyInternalApiKeyLogin(opts: HeadlessLoginOptions): Promise<boolean>;
/** Backwards-compatible alias for applyHeadlessLogin. */
export declare function applyPlainEnvLogin(opts: HeadlessLoginOptions): Promise<boolean>;
