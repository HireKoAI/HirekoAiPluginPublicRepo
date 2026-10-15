import { AuthScopeProvider } from "./auth/auth-scope-provider.js";
import { InMemoryToolCatalog } from "./catalog/catalog.js";
import { type CognitoApi } from "./auth/cognito.js";
import { type CredentialStore } from "./auth/credential-store.js";
import type { TokenManager } from "./auth/token-manager.js";
import { type RegistryLoader } from "./config/loader.js";
import type { AppConfig, CognitoConfig } from "./config/schema.js";
import { type Logger } from "./logging/logger.js";
import { RouterCore } from "./mcp/core.js";
import { ActivationSession } from "./mcp/session.js";
import { ServerRegistry } from "./registry/registry.js";
import { type ResolvedAuth } from "./transports/factory.js";
/**
 * One place where the whole app is assembled. `hireko serve`, one-shot CLI
 * commands, tests, and the demo all go through this.
 *
 * Multi-tenancy: auth resolution is runtime and per-tenant via
 * AuthScopeProvider — each tenant carries its own Cognito configuration.
 * The serve process routes tools for the config's `activeTenant`; sessions
 * for other tenants can still be established (login/status/logout).
 */
export interface App {
    configPath: string;
    getConfig(): AppConfig;
    tenantName: string;
    /** Runtime multi-tenant auth resolution. */
    authScopeProvider: AuthScopeProvider;
    /** Token provider for the active (served) tenant at boot. */
    tokenProvider: TokenManager;
    /** Live per-request auth resolution (current activeTenant). */
    resolveAuth: () => Promise<ResolvedAuth>;
    registry: ServerRegistry;
    catalog: InMemoryToolCatalog;
    core: RouterCore;
    session: ActivationSession;
    logger: Logger;
    /** Persist config activeTenant (file when possible; in-memory fallback). */
    setActiveTenant(tenant: string): Promise<void>;
    close(): Promise<void>;
}
export interface BootstrapOptions {
    configPath?: string;
    logger?: Logger;
    /** Test seams. */
    loader?: RegistryLoader;
    credentialStore?: CredentialStore;
    cognitoApiFactory?: (cognito: CognitoConfig) => CognitoApi;
    /** Test seam: override tenant→Cognito resolution. */
    resolveTenantCognito?: (tenant: string) => Promise<CognitoConfig>;
    /** Skip the optional catalog cache (tests/benchmarks). */
    disableCache?: boolean;
    /** Skip downstream discovery (used when caller drives it). */
    skipDiscovery?: boolean;
}
export declare function bootstrap(opts?: BootstrapOptions): Promise<App>;
