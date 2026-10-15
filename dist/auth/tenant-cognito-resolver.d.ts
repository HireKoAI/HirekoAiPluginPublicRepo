import type { CognitoConfig } from "../config/schema.js";
import type { CredentialStore } from "./credential-store.js";
/**
 * Map a user-entered tenant name to that tenant's Cognito via public
 * tenant_configuration.json (recruiter-{tenant}[.beta].hireko.ai).
 *
 * Prefers the stage stored on an existing session (so beta logins keep
 * refreshing against the beta pool), then explicit stage, then env/deploy.
 */
export declare function resolveTenantCognito(tenant: string, opts?: {
    stage?: "beta" | "prod";
    store?: CredentialStore;
}): Promise<CognitoConfig>;
export declare class TenantAuthUnresolvedError extends Error {
    constructor(message?: string);
}
