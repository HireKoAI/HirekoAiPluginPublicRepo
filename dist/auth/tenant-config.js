import { readDeployInfo } from "../deploy-info.js";
import { ENV_STAGE } from "./constants.js";
export class TenantConfigFetchError extends Error {
    url;
    status;
    constructor(message, url, status) {
        super(message);
        this.url = url;
        this.status = status;
        this.name = "TenantConfigFetchError";
    }
}
export function tenantConfigurationUrl(tenant, stage) {
    const slug = tenant.trim().toLowerCase();
    const host = stage === "beta" ? `recruiter-${slug}.beta.hireko.ai` : `recruiter-${slug}.hireko.ai`;
    return `https://${host}/assets/Json/tenant_configuration.json`;
}
export function resolveAuthStage() {
    const fromEnv = process.env[ENV_STAGE]?.toLowerCase();
    if (fromEnv === "beta" || fromEnv === "prod")
        return fromEnv;
    const deploy = readDeployInfo().stage?.toLowerCase();
    // Local installs stamp deploy.json stage=local — treat as beta (dev/test hosts).
    // Explicit "prod" (or unknown) → prod. S3 beta publishes use stage=beta.
    if (deploy === "beta" || deploy === "local" || !deploy)
        return "beta";
    return "prod";
}
function regionFromUserPoolId(userPoolId) {
    const idx = userPoolId.indexOf("_");
    if (idx <= 0)
        throw new Error(`invalid Cognito user pool id: ${userPoolId}`);
    return userPoolId.slice(0, idx);
}
function normalizeHostedUiDomain(raw) {
    return raw.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
export function cognitoFromTenantJson(tenant, json) {
    const c = json.cognito;
    if (!c?.cognito_user_pool_id || !c.cognito_client_id || !c.cognito_domain_url) {
        throw new Error("tenant_configuration.json is missing required cognito fields");
    }
    const scopes = c.Google?.scope?.length ? [...c.Google.scope] : ["openid", "email", "profile"];
    return {
        region: regionFromUserPoolId(c.cognito_user_pool_id),
        userPoolId: c.cognito_user_pool_id,
        clientId: c.cognito_client_id,
        authMode: "pkce",
        tokenToForward: "access",
        refreshSafetyWindowSec: 60,
        hostedUiDomain: normalizeHostedUiDomain(c.cognito_domain_url),
        oauthScopes: scopes,
    };
}
/** Prefer explicit/deploy stage, then the other stage if that host 404s or is down. */
export function tenantConfigStagesToTry(explicit) {
    if (explicit === "beta" || explicit === "prod")
        return [explicit];
    const preferred = resolveAuthStage();
    return preferred === "prod" ? ["prod", "beta"] : ["beta", "prod"];
}
export async function fetchTenantConfiguration(tenant, stage) {
    const stages = tenantConfigStagesToTry(stage);
    let last;
    for (const resolvedStage of stages) {
        const url = tenantConfigurationUrl(tenant, resolvedStage);
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) {
                last = new TenantConfigFetchError(`HTTP ${res.status} fetching tenant config`, url, res.status);
                continue;
            }
            const json = (await res.json());
            const cognito = cognitoFromTenantJson(tenant, json);
            return { url, json, cognito, stage: resolvedStage };
        }
        catch (err) {
            if (err instanceof TenantConfigFetchError) {
                last = err;
                continue;
            }
            last = new TenantConfigFetchError(err instanceof Error ? err.message : "tenant config fetch failed", url);
        }
    }
    throw last ?? new TenantConfigFetchError("tenant config fetch failed", tenantConfigurationUrl(tenant, stages[0]));
}
//# sourceMappingURL=tenant-config.js.map