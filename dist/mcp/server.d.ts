import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { AppConfig } from "../config/schema.js";
import type { InMemoryToolCatalog } from "../catalog/catalog.js";
import type { Logger } from "../logging/logger.js";
import { type RouterCore } from "./core.js";
import type { ActivationSession } from "./session.js";
export interface HostServerOptions {
    core: RouterCore;
    session: ActivationSession;
    catalog: InMemoryToolCatalog;
    getConfig: () => AppConfig;
    dynamicToolActivation: boolean;
    logger: Logger;
}
/**
 * The MCP server Claude Code / Cursor talks to.
 *
 * Flat mode (default): meta helpers + namespaced downstream tools on tools/list.
 * Meta mode: classic meta-only surface (+ Mode B activation when enabled).
 * Auth is always injected by the proxy on downstream calls — never by the model.
 */
export declare function createHostServer(opts: HostServerOptions): Server;
/** Serve over stdio. stdout from here on is JSON-RPC only (spec §20). */
export declare function serveStdio(server: Server, logger: Logger): Promise<void>;
