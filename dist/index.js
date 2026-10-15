/** Public API surface for programmatic use and tests. */
export { bootstrap } from "./bootstrap.js";
export { ConfigSchema } from "./config/schema.js";
export { JsonRegistryLoader, loadConfig, ConfigError } from "./config/loader.js";
export { TokenManager } from "./auth/token-manager.js";
export { AuthScopeProvider } from "./auth/auth-scope-provider.js";
export { NotAuthenticatedError } from "./auth/types.js";
export { TenantSwitchBlockedError, assertCanLoginTenant } from "./auth/single-tenant.js";
export { INTERNAL_API_KEY_ENV, encodeInternalApiKey, decodeInternalApiKey, resolvePasswordLogin, applyInternalApiKeyLogin, } from "./auth/internal-api-key.js";
export { FileCredentialStore, SecretServiceCredentialStore } from "./auth/credential-store.js";
export { InMemoryToolCatalog } from "./catalog/catalog.js";
export { DeterministicToolScorer } from "./catalog/scorer.js";
export { ServerRegistry, toToolRecord } from "./registry/registry.js";
export { makeRef, parseRef } from "./registry/types.js";
export { ManagedConnection } from "./proxy/connection.js";
export { HirekoTransportFactory } from "./transports/factory.js";
export { META_TOOLS, CORE_META_TOOLS, buildCoreMetaTools, metaToolsForMode, RouterCore } from "./mcp/core.js";
export { buildExposedToolMap, exposedNameFor, hostToolDescription } from "./mcp/exposed-tools.js";
export { createHostServer, serveStdio } from "./mcp/server.js";
export { ActivationSession, sanitizeToolName } from "./mcp/session.js";
//# sourceMappingURL=index.js.map