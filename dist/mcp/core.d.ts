import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { TokenProvider } from "../auth/types.js";
import type { AuthScopeProvider } from "../auth/auth-scope-provider.js";
import type { AppConfig } from "../config/schema.js";
import type { InMemoryToolCatalog } from "../catalog/catalog.js";
import type { Logger } from "../logging/logger.js";
import type { ServerRegistry } from "../registry/registry.js";
import type { ActivationSession } from "./session.js";
/**
 * Always-exposed meta surface. Descriptions include natural-language triggers
 * (product name, hireko, recruiter, sign out / status / login wording) so
 * harness ToolSearch picks the right tool from casual prompts.
 */
export declare function buildCoreMetaTools(): Tool[];
/** Snapshot for tests/perf; prefer buildCoreMetaTools() / metaToolsForMode() at runtime. */
export declare const CORE_META_TOOLS: Tool[];
/** Extra meta-tools only when routing.mode === "meta" (legacy discover/call hop). */
export declare const META_MODE_EXTRA_TOOLS: Tool[];
/** Default export for tests/perf: flat-mode surface (no call_tool / list_servers). */
export declare const META_TOOLS: Tool[];
export declare function metaToolsForMode(mode: "flat" | "meta"): Tool[];
export declare const META_TOOL_NAMES: Set<string>;
export interface RouterCoreOptions {
    getConfig: () => AppConfig;
    registry: ServerRegistry;
    catalog: InMemoryToolCatalog;
    /** Resolved live so tenant switches (e.g. via /human) apply immediately. */
    getTokenProvider: () => Promise<TokenProvider>;
    authScopeProvider: AuthScopeProvider;
    /** Persist + apply activeTenant (config file when present; in-memory otherwise). */
    setActiveTenant: (tenant: string) => Promise<void>;
    session: ActivationSession;
    logger: Logger;
    /** Called after filter activation / reload when the flattened tool list changes. */
    onToolsChanged?: () => void;
}
/**
 * Meta-tool logic, transport-agnostic. Flat mode exposes downstream tools on
 * tools/list; meta mode keeps the classic filter/call hop (spec §4).
 */
export declare class RouterCore {
    private readonly opts;
    private readonly toolsChangedListeners;
    constructor(opts: RouterCoreOptions);
    /** Wired by each host server after construction (stdio + HTTP sessions). */
    setOnToolsChanged(fn: () => void): void;
    emitToolsListChanged(): void;
    dispatch(toolName: string, args: Record<string, unknown>): Promise<unknown>;
    filterToolsWithQuery(args: Record<string, unknown>): Promise<unknown>;
    /** @deprecated Use filterToolsWithQuery */
    discoverTools(args: Record<string, unknown>): Promise<unknown>;
    describeTool(args: Record<string, unknown>): Promise<unknown>;
    callTool(args: Record<string, unknown>): Promise<unknown>;
    listServers(): Promise<unknown>;
    reloadRegistry(): Promise<unknown>;
    authStatus(): Promise<unknown>;
    logout(args?: Record<string, unknown>): Promise<unknown>;
    /**
     * Product rule: only one tenant session. Refuse login to a different tenant
     * while the active tenant still has a valid session — caller must logout first.
     */
    private assertCanLogin;
    login(args: Record<string, unknown>): Promise<unknown>;
    loginBrowser(args: Record<string, unknown>): Promise<unknown>;
    /**
     * After Cognito login, retry downstream discovery for servers that failed while
     * unauthenticated, then notify the harness the flattened tool list changed.
     */
    private refreshToolsAfterAuth;
    /** Stage + local proxy liveness + /human console URL (this process is the proxy). */
    private runtimeBanner;
}
