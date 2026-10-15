import { fetchTenantConfiguration, resolveAuthStage } from "./tenant-config.js";
/**
 * Map a user-entered tenant name to that tenant's Cognito via public
 * tenant_configuration.json (recruiter-{tenant}[.beta].hireko.ai).
 *
 * Prefers the stage stored on an existing session (so beta logins keep
 * refreshing against the beta pool), then explicit stage, then env/deploy.
 */
export async function resolveTenantCognito(tenant, opts) {
    const name = tenant.trim();
    if (!name)
        throw new TenantAuthUnresolvedError("tenant name is required");
    let stage = opts?.stage ?? resolveAuthStage();
    if (!opts?.stage && opts?.store) {
        try {
            const stored = await opts.store.load(name);
            if (stored?.authStage === "beta" || stored?.authStage === "prod") {
                stage = stored.authStage;
            }
        }
        catch {
            /* ignore store errors; fall back to resolveAuthStage */
        }
    }
    const { cognito } = await fetchTenantConfiguration(name, stage);
    return cognito;
}
export class TenantAuthUnresolvedError extends Error {
    constructor(message = "tenant Cognito resolution failed") {
        super(message);
        this.name = "TenantAuthUnresolvedError";
    }
}
//# sourceMappingURL=tenant-cognito-resolver.js.map