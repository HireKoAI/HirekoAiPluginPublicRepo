import { assertCanLoginTenant } from "./single-tenant.js";
import { ENV_INTERNAL_API_KEY, getPlainEnvPrefix, getPlainEnvVarNames, } from "./constants.js";
function asNonEmptyString(value) {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
/** Standard base64 of `{"username","password","tenant"}` (field order not required). */
export function encodeInternalApiKey(payload) {
    const username = payload.username.trim();
    const password = payload.password;
    const tenant = payload.tenant.trim();
    if (!username || !password || !tenant) {
        throw new Error("internal API key requires username, password, and tenant");
    }
    return Buffer.from(JSON.stringify({ username, password, tenant }), "utf8").toString("base64");
}
export function decodeInternalApiKey(raw) {
    const trimmed = raw.trim();
    if (!trimmed) {
        throw new Error("internal API key is empty");
    }
    let json;
    try {
        const decoded = Buffer.from(trimmed, "base64").toString("utf8");
        json = JSON.parse(decoded);
    }
    catch {
        throw new Error("internal API key must be base64-encoded JSON with username, password, and tenant");
    }
    if (!json || typeof json !== "object" || Array.isArray(json)) {
        throw new Error("internal API key JSON must be an object with username, password, and tenant");
    }
    const rec = json;
    const username = asNonEmptyString(rec.username);
    const password = typeof rec.password === "string" && rec.password.length > 0 ? rec.password : undefined;
    const tenant = asNonEmptyString(rec.tenant);
    if (!username || !password || !tenant) {
        throw new Error("internal API key JSON must include username, password, and tenant");
    }
    return { username, password, tenant };
}
export function readInternalApiKeyFromEnv(env = process.env) {
    return asNonEmptyString(env[ENV_INTERNAL_API_KEY]);
}
/**
 * Read the plain-env CI triplet:
 *   <productName>_tenant / <productName>_username / <productName>_password
 * Returns undefined when any of the three values is missing or empty.
 */
export function readPlainEnvCredentials(env = process.env) {
    const keys = getPlainEnvVarNames();
    const tenant = asNonEmptyString(env[keys.tenant]);
    const username = asNonEmptyString(env[keys.username]);
    const password = typeof env[keys.password] === "string" && env[keys.password].length > 0
        ? env[keys.password]
        : undefined;
    if (!tenant || !username || !password)
        return undefined;
    return { tenant, username, password };
}
/**
 * Headless credentials resolver chain.
 * Step 1: HIREKO_INTERNAL_API_KEY (base64 JSON bundle)
 * Step 2: Plain env triplet (<productName>_tenant/username/password)
 * Step 3: Returns undefined if no headless credentials are set.
 */
export function readHeadlessCredentials(env = process.env) {
    const envKey = readInternalApiKeyFromEnv(env);
    if (envKey) {
        try {
            return { ...decodeInternalApiKey(envKey), source: "env" };
        }
        catch {
            return undefined;
        }
    }
    const plainEnv = readPlainEnvCredentials(env);
    if (plainEnv) {
        return { ...plainEnv, source: "plainEnv" };
    }
    return undefined;
}
/**
 * Checks whether headless credential environment variables are configured.
 */
export function isHeadlessEnv(env = process.env) {
    return readHeadlessCredentials(env) !== undefined;
}
/**
 * Chain of Responsibility for password login credential resolution:
 * 1. Explicit fields (tenant, username, password) -> source: "fields"
 * 2. Explicit apiKey argument -> source: "apiKey"
 * 3. Headless env sources via readHeadlessCredentials (INTERNAL_API_KEY or plain-env triplet)
 * 4. Throws if no credentials can be resolved.
 */
export function resolvePasswordLogin(args) {
    const env = args.env ?? process.env;
    const tenant = asNonEmptyString(args.tenant);
    const username = asNonEmptyString(args.username);
    const password = typeof args.password === "string" && args.password.length > 0 ? args.password : undefined;
    if (tenant && username && password) {
        return { tenant, username, password, source: "fields" };
    }
    const explicitKey = asNonEmptyString(args.apiKey);
    if (explicitKey) {
        return { ...decodeInternalApiKey(explicitKey), source: "apiKey" };
    }
    const headless = readHeadlessCredentials(env);
    if (headless) {
        return headless;
    }
    const prefix = getPlainEnvPrefix();
    throw new Error(`login requires tenant, username, and password — or apiKey / ${ENV_INTERNAL_API_KEY} (base64 JSON {"username","password","tenant"}) / ${prefix}tenant + _username + _password env vars`);
}
/**
 * Tenant resolution chain for login_browser / device login:
 * 1. Explicit tenant argument
 * 2. Explicit apiKey argument (decodes tenant)
 * 3. Headless credentials in env (extracts tenant)
 * 4. Throws if no tenant can be resolved.
 */
export function resolveLoginTenant(args) {
    const env = args.env ?? process.env;
    const explicit = asNonEmptyString(args.tenant);
    if (explicit)
        return { tenant: explicit, source: "tenant" };
    const explicitKey = asNonEmptyString(args.apiKey);
    if (explicitKey) {
        return { tenant: decodeInternalApiKey(explicitKey).tenant, source: "apiKey" };
    }
    const headless = readHeadlessCredentials(env);
    if (headless) {
        return { tenant: headless.tenant, source: headless.source };
    }
    throw new Error(`tenant is required — or pass apiKey / set ${ENV_INTERNAL_API_KEY} / set ${getPlainEnvPrefix()}tenant`);
}
/**
 * Unified headless login execution chain:
 * 1. Resolves headless credentials (API key or plain-env triplet).
 * 2. If absent -> returns false (interactive mode).
 * 3. If present -> performs single-tenant login assertion, Cognito user auth, and updates activeTenant.
 */
export async function applyHeadlessLogin(opts) {
    const env = opts.env ?? process.env;
    const creds = readHeadlessCredentials(env);
    if (!creds)
        return false;
    const logLabel = creds.source === "env" ? ENV_INTERNAL_API_KEY : `${getPlainEnvPrefix()}*`;
    const active = opts.getConfig().activeTenant;
    let activeAuthenticated = false;
    try {
        const activeStatus = await (await opts.authScopeProvider.tokenProviderFor(active)).status();
        activeAuthenticated = activeStatus.authenticated;
    }
    catch {
        activeAuthenticated = false;
    }
    if (activeAuthenticated && active !== creds.tenant) {
        opts.logger.warn(`${logLabel} skipped: another tenant is already logged in`, {
            activeTenant: active,
            keyTenant: creds.tenant,
        });
        return false;
    }
    const keyStatus = await (await opts.authScopeProvider.tokenProviderFor(creds.tenant)).status();
    if (keyStatus.authenticated) {
        if (active !== creds.tenant)
            await opts.setActiveTenant(creds.tenant);
        opts.logger.info(`${logLabel} skipped: already authenticated`, {
            tenant: creds.tenant,
            username: keyStatus.username,
        });
        return true;
    }
    try {
        await assertCanLoginTenant({
            activeTenant: opts.getConfig().activeTenant,
            nextTenant: creds.tenant,
            statusFor: async (t) => {
                try {
                    return await (await opts.authScopeProvider.tokenProviderFor(t)).status();
                }
                catch {
                    return { authenticated: false };
                }
            },
        });
        const session = await opts.authScopeProvider.login_tenant_user(creds.username, creds.password, creds.tenant);
        await opts.setActiveTenant(creds.tenant);
        opts.logger.info(`${logLabel} login successful`, {
            tenant: creds.tenant,
            username: session.username,
            source: creds.source,
        });
        return true;
    }
    catch (err) {
        opts.logger.warn(`${logLabel} login failed`, {
            tenant: creds.tenant,
            error: err instanceof Error ? err.message : String(err),
            source: creds.source,
        });
        return false;
    }
}
/** Backwards-compatible alias for applyHeadlessLogin. */
export async function applyInternalApiKeyLogin(opts) {
    return applyHeadlessLogin(opts);
}
/** Backwards-compatible alias for applyHeadlessLogin. */
export async function applyPlainEnvLogin(opts) {
    return applyHeadlessLogin(opts);
}
//# sourceMappingURL=credentials-factory.js.map