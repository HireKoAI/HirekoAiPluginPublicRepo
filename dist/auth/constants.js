import { productName } from "../product-name.js";
/** Environment variable for base64 JSON auth bundle (username, password, tenant). */
export const ENV_INTERNAL_API_KEY = "HIREKO_INTERNAL_API_KEY";
/** Legacy alias for ENV_INTERNAL_API_KEY. */
export const INTERNAL_API_KEY_ENV = ENV_INTERNAL_API_KEY;
/** Environment variable for credential storage backend selection. */
export const ENV_CREDENTIAL_STORE = "HIREKO_CREDENTIAL_STORE";
/** Environment variable for container runtime detection override. */
export const ENV_IN_CONTAINER = "HIREKO_IN_CONTAINER";
/** Environment variable for stage override (beta | prod). */
export const ENV_STAGE = "HIREKO_STAGE";
/** Environment variable for product home directory override. */
export const ENV_HOME = "HIREKO_HOME";
/** Environment variable for default RecruiterFacade MCP extension endpoint. */
export const ENV_EXTENSION_RECRUITER_FACADE = "MCP_EXTENSION_RECRUITER_FACADE";
/** Plain-env credential field suffixes for headless mode. */
export const PLAIN_ENV_SUFFIX = {
    TENANT: "tenant",
    USERNAME: "username",
    PASSWORD: "password",
};
/**
 * Prefix for plain environment variables, derived dynamically from the product name.
 * e.g. "HirekoOpenPlugin_"
 */
export function getPlainEnvPrefix() {
    return `${productName()}_`;
}
/**
 * Full variable names for the plain environment credential triplet.
 */
export function getPlainEnvVarNames() {
    const prefix = getPlainEnvPrefix();
    return {
        tenant: `${prefix}${PLAIN_ENV_SUFFIX.TENANT}`,
        username: `${prefix}${PLAIN_ENV_SUFFIX.USERNAME}`,
        password: `${prefix}${PLAIN_ENV_SUFFIX.PASSWORD}`,
    };
}
//# sourceMappingURL=constants.js.map