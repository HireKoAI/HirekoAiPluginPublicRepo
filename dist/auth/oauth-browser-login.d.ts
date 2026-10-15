import type { CognitoConfig } from "../config/schema.js";
import type { AuthSession } from "./types.js";
/** Loopback ports for RecruiterDashboard CLI hand-off (87xx). */
export declare const LOOPBACK_PORT_MIN = 8700;
export declare const LOOPBACK_PORT_MAX = 8799;
export declare const LOOPBACK_CALLBACK_PATH = "/oauth/callback";
export declare const LOOPBACK_PING_PATH = "/oauth/ping";
/**
 * Existing Cognito SPA redirect — kept for helpers / compatibility messaging.
 */
export declare function tenantOAuthRedirectUri(tenant: string, stage: "beta" | "prod"): string;
/** Custom dashboard page: username/password → tokens → loopback (not Hosted UI). */
export declare function tenantDeviceLoginUrl(tenant: string, stage: "beta" | "prod", state: string, originOverride?: string): string;
/** Tenant dashboard origin for the given stage (no path). */
export declare function tenantDashboardOrigin(tenant: string, stage: "beta" | "prod"): string;
/** @deprecated Use tenantOAuthRedirectUri */
export declare const deviceLoginRedirectUri: typeof tenantOAuthRedirectUri;
export declare function encodeOAuthState(port: number, nonce?: string): string;
export declare function parsePortFromOAuthState(state: string): number | undefined;
export interface BrowserOAuthLoginOptions {
    tenant: string;
    /** Reserved for absorbSession / tenant resolution; device login uses dashboard Cognito. */
    cognito: CognitoConfig;
    redirectUri?: string;
    stage?: "beta" | "prod";
    /** Override dashboard origin (e.g. http://127.0.0.1:8080 for local Vite). */
    deviceLoginOrigin?: string;
    openBrowser?: boolean;
    timeoutMs?: number;
}
export interface BrowserOAuthLoginDeps {
    openBrowser?: (url: string) => Promise<void>;
    now?: () => number;
    listenPort?: number;
}
/**
 * Opens RecruiterDashboard /devicelogin (username/password).
 * Dashboard forwards tokens to local 87xx — does not log into the SPA.
 */
export declare function browserOAuthLogin(opts: BrowserOAuthLoginOptions, deps?: BrowserOAuthLoginDeps): Promise<AuthSession>;
/** @deprecated alias */
export declare const browserPkceLogin: typeof browserOAuthLogin;
