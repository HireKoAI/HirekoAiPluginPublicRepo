import type { CognitoConfig } from "../config/schema.js";
/** Public tenant JSON (recruiter UI). Cognito block drives auth. */
export interface TenantConfigurationJson {
    tenant_company_name?: string;
    cognito?: {
        cognito_domain_url?: string;
        cognito_user_pool_id?: string;
        cognito_client_id?: string;
        Google?: {
            scope?: string[];
        };
    };
}
export declare class TenantConfigFetchError extends Error {
    readonly url: string;
    readonly status?: number | undefined;
    constructor(message: string, url: string, status?: number | undefined);
}
export declare function tenantConfigurationUrl(tenant: string, stage: "beta" | "prod"): string;
export declare function resolveAuthStage(): "beta" | "prod";
export declare function cognitoFromTenantJson(tenant: string, json: TenantConfigurationJson): CognitoConfig;
/** Prefer explicit/deploy stage, then the other stage if that host 404s or is down. */
export declare function tenantConfigStagesToTry(explicit?: "beta" | "prod"): Array<"beta" | "prod">;
export declare function fetchTenantConfiguration(tenant: string, stage?: "beta" | "prod"): Promise<{
    url: string;
    json: TenantConfigurationJson;
    cognito: CognitoConfig;
    stage: "beta" | "prod";
}>;
