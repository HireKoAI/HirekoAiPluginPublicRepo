import type { AppConfig, CognitoConfig } from "../config/schema.js";
import type { Logger } from "../logging/logger.js";
import type { CognitoApi } from "./cognito.js";
import type { CredentialStore } from "./credential-store.js";
import { TokenManager } from "./token-manager.js";
import type { AuthSession, ChallengeResolver } from "./types.js";
/**
 * Multi-tenant auth. Tenant name is a string the user types. Cognito comes
 * from resolveTenantCognito (public tenant_configuration.json) — never from a
 * tenant catalog.
 */
export interface AuthServerDetails {
    tenant: string;
    region: string;
    userPoolId: string;
    clientId: string;
    /** True when SECRET_HASH must be computed on every auth request. */
    hasClientSecret: boolean;
    authMode: "password" | "pkce";
    tokenToForward: "access" | "id";
    refreshSafetyWindowSec: number;
}
export type TenantCognitoResolver = (tenant: string) => Promise<CognitoConfig>;
export interface AuthScopeProviderOptions {
    getConfig: () => AppConfig;
    store: CredentialStore;
    logger: Logger;
    cognitoApiFactory?: (cognito: CognitoConfig) => CognitoApi;
    /** Test seam / override. Default: resolveTenantCognito. */
    resolveTenantCognito?: TenantCognitoResolver;
}
export declare class AuthScopeProvider {
    private readonly opts;
    private managers;
    constructor(opts: AuthScopeProviderOptions);
    private resolveCognito;
    /**
     * Resolve Cognito for a user-entered tenant name. Never lists tenants.
     * (Deliberately never returns the client secret itself.)
     */
    get_auth_server_details(tenant: string): Promise<AuthServerDetails>;
    /**
     * Authenticate one user against ONE tenant's Cognito. Tenant is the string
     * they typed. Password exists only in memory for this call.
     */
    login_tenant_user(username: string, password: string, tenant: string, challengeResolver?: ChallengeResolver): Promise<AuthSession>;
    /**
     * Browser device login: opens RecruiterDashboard /devicelogin.
     * User signs in with username/password; dashboard forwards tokens to local 87xx
     * without creating an SPA session.
     */
    login_tenant_oauth(tenant: string, opts?: {
        redirectUri?: string;
        openBrowser?: boolean;
        stage?: "beta" | "prod";
        timeoutMs?: number;
        deviceLoginOrigin?: string;
        localPort?: number;
    }): Promise<AuthSession>;
    /** Per-tenant TokenProvider, cached. One tenant's refresh never touches another's. */
    tokenProviderFor(tenant: string): Promise<TokenManager>;
    private tokenProviderForResolved;
    reset(): void;
}
