/** Environment variable for base64 JSON auth bundle (username, password, tenant). */
export declare const ENV_INTERNAL_API_KEY = "HIREKO_INTERNAL_API_KEY";
/** Legacy alias for ENV_INTERNAL_API_KEY. */
export declare const INTERNAL_API_KEY_ENV = "HIREKO_INTERNAL_API_KEY";
/** Environment variable for credential storage backend selection. */
export declare const ENV_CREDENTIAL_STORE = "HIREKO_CREDENTIAL_STORE";
/** Environment variable for container runtime detection override. */
export declare const ENV_IN_CONTAINER = "HIREKO_IN_CONTAINER";
/** Environment variable for stage override (beta | prod). */
export declare const ENV_STAGE = "HIREKO_STAGE";
/** Environment variable for product home directory override. */
export declare const ENV_HOME = "HIREKO_HOME";
/** Environment variable for default RecruiterFacade MCP extension endpoint. */
export declare const ENV_EXTENSION_RECRUITER_FACADE = "MCP_EXTENSION_RECRUITER_FACADE";
/** Plain-env credential field suffixes for headless mode. */
export declare const PLAIN_ENV_SUFFIX: {
    readonly TENANT: "tenant";
    readonly USERNAME: "username";
    readonly PASSWORD: "password";
};
/**
 * Prefix for plain environment variables, derived dynamically from the product name.
 * e.g. "HirekoOpenPlugin_"
 */
export declare function getPlainEnvPrefix(): string;
/**
 * Full variable names for the plain environment credential triplet.
 */
export declare function getPlainEnvVarNames(): {
    tenant: string;
    username: string;
    password: string;
};
