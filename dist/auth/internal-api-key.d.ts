/**
 * Headless & API-key authentication modules.
 * Centralized in credentials-factory.ts and constants.ts.
 */
export { ENV_INTERNAL_API_KEY, INTERNAL_API_KEY_ENV, PLAIN_ENV_SUFFIX, getPlainEnvPrefix, getPlainEnvPrefix as plainEnvPrefix, getPlainEnvVarNames, } from "./constants.js";
export { type InternalApiKeyPayload, type PasswordLoginSource, type ResolvedPasswordLogin, type HeadlessLoginOptions, encodeInternalApiKey, decodeInternalApiKey, readInternalApiKeyFromEnv, readPlainEnvCredentials, readHeadlessCredentials, isHeadlessEnv, resolvePasswordLogin, resolveLoginTenant, applyHeadlessLogin, } from "./credentials-factory.js";
import { type HeadlessLoginOptions } from "./credentials-factory.js";
/** Backwards-compatible alias for applyHeadlessLogin. */
export declare function applyInternalApiKeyLogin(opts: HeadlessLoginOptions): Promise<boolean>;
/** Backwards-compatible alias for applyHeadlessLogin. */
export declare function applyPlainEnvLogin(opts: HeadlessLoginOptions): Promise<boolean>;
