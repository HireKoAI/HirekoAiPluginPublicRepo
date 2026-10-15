import { TokenManager } from "./token-manager.js";
import { browserOAuthLogin, tenantOAuthRedirectUri } from "./oauth-browser-login.js";
import { resolveDeviceLoginOrigin } from "./parse-login-intent.js";
import { fetchTenantConfiguration, resolveAuthStage } from "./tenant-config.js";
import { resolveTenantCognito, TenantAuthUnresolvedError } from "./tenant-cognito-resolver.js";
const INERT_COGNITO = {
    region: "unresolved",
    userPoolId: "unresolved",
    clientId: "unresolved",
    authMode: "password",
    tokenToForward: "access",
    refreshSafetyWindowSec: 60,
};
export class AuthScopeProvider {
    opts;
    managers = new Map();
    constructor(opts) {
        this.opts = opts;
    }
    resolveCognito(tenant, stage) {
        if (this.opts.resolveTenantCognito) {
            return this.opts.resolveTenantCognito(tenant);
        }
        return resolveTenantCognito(tenant, { stage, store: this.opts.store });
    }
    /**
     * Resolve Cognito for a user-entered tenant name. Never lists tenants.
     * (Deliberately never returns the client secret itself.)
     */
    async get_auth_server_details(tenant) {
        const c = await this.resolveCognito(tenant);
        return {
            tenant,
            region: c.region,
            userPoolId: c.userPoolId,
            clientId: c.clientId,
            hasClientSecret: c.clientSecret !== undefined,
            authMode: c.authMode,
            tokenToForward: c.tokenToForward,
            refreshSafetyWindowSec: c.refreshSafetyWindowSec,
        };
    }
    /**
     * Authenticate one user against ONE tenant's Cognito. Tenant is the string
     * they typed. Password exists only in memory for this call.
     */
    async login_tenant_user(username, password, tenant, challengeResolver) {
        await this.get_auth_server_details(tenant);
        const manager = await this.tokenProviderFor(tenant);
        const session = await manager.login({ username, password }, challengeResolver);
        if (!session.authStage) {
            session.authStage = resolveAuthStage();
            await manager.absorbSession(session);
        }
        return session;
    }
    /**
     * Browser device login: opens RecruiterDashboard /devicelogin.
     * User signs in with username/password; dashboard forwards tokens to local 87xx
     * without creating an SPA session.
     */
    async login_tenant_oauth(tenant, opts) {
        const requestedStage = opts?.stage ?? resolveAuthStage();
        const { cognito, stage } = await fetchTenantConfiguration(tenant, requestedStage);
        this.managers.delete(tenant);
        const manager = await this.tokenProviderForResolved(tenant, cognito);
        const redirectUri = opts?.redirectUri ?? tenantOAuthRedirectUri(tenant, stage);
        const deviceLoginOrigin = resolveDeviceLoginOrigin({
            deviceLoginOrigin: opts?.deviceLoginOrigin,
            localPort: opts?.localPort,
        });
        const session = await browserOAuthLogin({
            tenant,
            cognito,
            stage,
            redirectUri,
            deviceLoginOrigin,
            openBrowser: opts?.openBrowser,
            timeoutMs: opts?.timeoutMs,
        });
        session.authStage = stage;
        await manager.absorbSession(session);
        return session;
    }
    /** Per-tenant TokenProvider, cached. One tenant's refresh never touches another's. */
    async tokenProviderFor(tenant) {
        const cached = this.managers.get(tenant);
        if (cached)
            return cached;
        let cognito;
        let resolved = true;
        try {
            cognito = await this.resolveCognito(tenant);
        }
        catch (err) {
            if (!(err instanceof TenantAuthUnresolvedError))
                throw err;
            cognito = INERT_COGNITO;
            resolved = false;
        }
        const manager = await this.tokenProviderForResolved(tenant, cognito, resolved);
        return manager;
    }
    async tokenProviderForResolved(tenant, cognito, cache = true) {
        const cached = this.managers.get(tenant);
        if (cached)
            return cached;
        const { SdkCognitoApi } = await import("./cognito.js");
        const api = this.opts.cognitoApiFactory
            ? this.opts.cognitoApiFactory(cognito)
            : new SdkCognitoApi(cognito);
        const manager = new TokenManager({
            tenant,
            cognito,
            api,
            store: this.opts.store,
            logger: this.opts.logger.child({ tenant }),
        });
        if (cache)
            this.managers.set(tenant, manager);
        return manager;
    }
    reset() {
        this.managers.clear();
    }
}
//# sourceMappingURL=auth-scope-provider.js.map