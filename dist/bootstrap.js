import { AuthScopeProvider } from "./auth/auth-scope-provider.js";
import { resolveTenantCognito, TenantAuthUnresolvedError } from "./auth/tenant-cognito-resolver.js";
import { CatalogCache } from "./catalog/cache.js";
import { InMemoryToolCatalog } from "./catalog/catalog.js";
import { SdkCognitoApi } from "./auth/cognito.js";
import { createDefaultCredentialStore } from "./auth/credential-store.js";
import { JsonRegistryLoader, loadConfig } from "./config/loader.js";
import { updateConfigFile } from "./config/writer.js";
import { catalogCachePath } from "./config/paths.js";
import { rootLogger } from "./logging/logger.js";
import { RouterCore } from "./mcp/core.js";
import { ActivationSession } from "./mcp/session.js";
import { parseHeaderSpecs } from "./proxy/headers.js";
import { ServerRegistry } from "./registry/registry.js";
import { HirekoTransportFactory } from "./transports/factory.js";
export async function bootstrap(opts = {}) {
    const logger = opts.logger ?? rootLogger;
    const loader = opts.loader ?? new JsonRegistryLoader();
    const { config, path: configPath } = await loadConfig(loader, opts.configPath);
    const tenantName = config.activeTenant;
    const store = opts.credentialStore ?? (await createDefaultCredentialStore());
    // Registry reference is wired lazily so the provider always reads the
    // CURRENT config (reload-safe runtime resolution) without a cycle.
    let registryInstance;
    const authScopeProvider = new AuthScopeProvider({
        getConfig: () => registryInstance?.currentConfig ?? config,
        store,
        logger,
        cognitoApiFactory: opts.cognitoApiFactory ?? ((c) => new SdkCognitoApi(c)),
        resolveTenantCognito: opts.resolveTenantCognito ??
            (async (t) => {
                // Prefer public tenant_configuration.json (and session authStage via store).
                // Fall back to optional config.tenants catalog for offline/tests.
                try {
                    return await resolveTenantCognito(t, { store });
                }
                catch (err) {
                    const current = registryInstance?.currentConfig ?? config;
                    const tenantConfig = current.tenants?.[t];
                    if (tenantConfig?.cognito)
                        return tenantConfig.cognito;
                    if (err instanceof TenantAuthUnresolvedError)
                        throw err;
                    throw new TenantAuthUnresolvedError(err instanceof Error ? err.message : "tenant Cognito resolution failed");
                }
            }),
    });
    const tokenProvider = await authScopeProvider.tokenProviderFor(tenantName);
    // Live auth resolution: reads the CURRENT config's activeTenant on every
    // downstream request, so /human tenant switches apply without a restart.
    const resolveAuth = async () => {
        const current = registryInstance?.currentConfig ?? config;
        return {
            tokenProvider: await authScopeProvider.tokenProviderFor(current.activeTenant),
            tenantName: current.activeTenant,
            headerSpecs: parseHeaderSpecs(current),
        };
    };
    const transportFactory = new HirekoTransportFactory({ resolveAuth, logger });
    const catalog = new InMemoryToolCatalog();
    const cache = opts.disableCache ? undefined : new CatalogCache(catalogCachePath(), logger);
    const registry = new ServerRegistry({
        config,
        configPath,
        loader,
        transportFactory,
        catalog,
        cache,
        logger,
    });
    registryInstance = registry;
    const session = new ActivationSession();
    const setActiveTenant = async (tenant) => {
        const name = tenant.trim();
        if (!name)
            throw new Error("tenant name is required");
        const current = registry.currentConfig;
        if (current.activeTenant === name)
            return;
        try {
            const parsed = await updateConfigFile(configPath, (raw) => {
                raw.activeTenant = name;
                return raw;
            });
            await registry.reload({ config: parsed, path: configPath });
        }
        catch {
            await registry.reload({ config: { ...current, activeTenant: name }, path: configPath });
        }
    };
    const core = new RouterCore({
        getConfig: () => registry.currentConfig,
        registry,
        catalog,
        getTokenProvider: () => resolveAuth().then((a) => a.tokenProvider),
        authScopeProvider,
        setActiveTenant,
        session,
        logger,
    });
    if (!opts.skipDiscovery) {
        await registry.startup();
    }
    return {
        configPath,
        getConfig: () => registry.currentConfig,
        tenantName,
        authScopeProvider,
        tokenProvider,
        resolveAuth,
        registry,
        catalog,
        core,
        session,
        logger,
        setActiveTenant,
        close: async () => {
            await registry.shutdown();
        },
    };
}
//# sourceMappingURL=bootstrap.js.map