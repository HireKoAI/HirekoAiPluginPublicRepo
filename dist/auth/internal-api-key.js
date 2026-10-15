/**
 * Headless & API-key authentication modules.
 * Centralized in credentials-factory.ts and constants.ts.
 */
export { ENV_INTERNAL_API_KEY, INTERNAL_API_KEY_ENV, PLAIN_ENV_SUFFIX, getPlainEnvPrefix, getPlainEnvPrefix as plainEnvPrefix, getPlainEnvVarNames, } from "./constants.js";
export { encodeInternalApiKey, decodeInternalApiKey, readInternalApiKeyFromEnv, readPlainEnvCredentials, readHeadlessCredentials, isHeadlessEnv, resolvePasswordLogin, resolveLoginTenant, applyHeadlessLogin, } from "./credentials-factory.js";
import { applyHeadlessLogin } from "./credentials-factory.js";
/** Backwards-compatible alias for applyHeadlessLogin. */
export async function applyInternalApiKeyLogin(opts) {
    return applyHeadlessLogin(opts);
}
/** Backwards-compatible alias for applyHeadlessLogin. */
export async function applyPlainEnvLogin(opts) {
    return applyHeadlessLogin(opts);
}
//# sourceMappingURL=internal-api-key.js.map