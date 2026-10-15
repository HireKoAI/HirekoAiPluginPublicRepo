import { mkdir, writeFile, unlink } from "node:fs/promises";
import { watch } from "node:fs";
import { dirname } from "node:path";
import { applyHeadlessLogin } from "../../auth/credentials-factory.js";
import { bootstrap } from "../../bootstrap.js";
import { ConfigError } from "../../config/loader.js";
import { pidFilePath, serveInfoPath } from "../../config/paths.js";
import { startControlServer } from "../../mcp/control.js";
import { createHostServer, serveStdio } from "../../mcp/server.js";
import { readDeployInfo } from "../../deploy-info.js";
import { productName } from "../../product-name.js";
import { PREFERRED_CONTROL_PORT } from "./up.js";
/**
 * `serve` — local MCP + /human control plane.
 *
 * Default: stdio MCP (Claude/Cursor child). stdout is JSON-RPC only.
 * When the harness exits, the OS tears this process down with it.
 * `--detach`: optional orphan daemon (HTTP MCP); prefer stdio for harness use.
 */
export async function serveCommand(opts) {
    console.log = console.error;
    console.info = console.error;
    console.warn = console.error;
    const app = await bootstrap({ configPath: opts.config });
    const logger = app.logger;
    const headlessOk = await applyHeadlessLogin({
        logger,
        getConfig: app.getConfig,
        authScopeProvider: app.authScopeProvider,
        setActiveTenant: app.setActiveTenant,
    });
    if (headlessOk) {
        try {
            const retried = await app.registry.rediscoverUnhealthy();
            if (retried.length > 0) {
                logger.info("post-headless rediscovery", { servers: retried });
                app.core.emitToolsListChanged();
            }
        }
        catch (err) {
            logger.warn("post-headless rediscovery failed", {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    }
    const deploy = readDeployInfo();
    const detach = opts.detach === true || process.env.HIREKO_DETACH === "1";
    logger.info(`${productName()} proxy up`, {
        stage: deploy.stage ?? "local",
        version: deploy.version ?? "0.1.0",
        pid: process.pid,
        mode: detach ? "detach" : "stdio",
        config: app.configPath,
    });
    const hostOpts = {
        core: app.core,
        session: app.session,
        catalog: app.catalog,
        getConfig: app.getConfig,
        dynamicToolActivation: app.getConfig().routing.dynamicToolActivation,
        logger,
    };
    const stdioServer = createHostServer(hostOpts);
    const controlCfg = app.getConfig().control;
    const forcedPort = Number(process.env.HIREKO_CONTROL_PORT || "");
    // Prefer :8400 for /human whether stdio (harness child) or detach.
    const ports = Number.isFinite(forcedPort) && forcedPort > 0
        ? [forcedPort]
        : [PREFERRED_CONTROL_PORT, ...range(controlCfg.portStart, controlCfg.portEnd).filter((p) => p !== PREFERRED_CONTROL_PORT)];
    let control;
    if (controlCfg.enabled) {
        control = await startControlServer({
            getConfig: app.getConfig,
            getConfigPath: () => app.configPath,
            registry: app.registry,
            catalog: app.catalog,
            resolveAuth: app.resolveAuth,
            logger,
            ports,
            createMcpServer: () => createHostServer(hostOpts),
            onCatalogChanged: () => app.core.emitToolsListChanged(),
        });
        if (control) {
            await writeServeInfo(control.port, logger);
            logger.info("human console", {
                url: `http://127.0.0.1:${control.port}/human`,
                mcp: `http://127.0.0.1:${control.port}/mcp`,
                port: control.port,
                stage: deploy.stage ?? "local",
            });
        }
        else if (detach) {
            logger.error("detach mode requires a free control port", { tried: ports });
            process.exit(1);
        }
    }
    await writePidFile(logger);
    let watcher;
    let watchTimer;
    const doReload = async (source) => {
        try {
            const result = await app.registry.reload();
            app.core.emitToolsListChanged();
            logger.info("reload ok", {
                source,
                added: result.added.length,
                removed: result.removed.length,
                changed: result.changed.length,
                toolCount: result.toolCount,
            });
        }
        catch (err) {
            if (err instanceof ConfigError) {
                logger.error("reload rejected; keeping previous config", {
                    source,
                    error: err.message,
                    issues: err.issues,
                });
            }
            else {
                logger.error("reload failed", { source, error: err.message });
            }
        }
    };
    process.on("SIGUSR2", () => void doReload("SIGUSR2"));
    process.on("SIGHUP", () => void doReload("SIGHUP"));
    if (app.getConfig().watchConfig) {
        try {
            watcher = watch(app.configPath, () => {
                clearTimeout(watchTimer);
                watchTimer = setTimeout(() => void doReload("file-watch"), app.getConfig().watchDebounceMs);
            });
            logger.info("config watch enabled", { path: app.configPath });
        }
        catch (err) {
            logger.warn("config watch unavailable", { error: err.message });
        }
    }
    const shutdown = async (signal) => {
        logger.info("shutting down", { signal });
        clearTimeout(watchTimer);
        watcher?.close();
        await control?.close().catch(() => { });
        await removeRunFiles();
        await app.close().catch(() => { });
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    if (detach) {
        // Daemon: stay alive for /human + HTTP MCP. No stdio session.
        await new Promise(() => {
            /* run until signal */
        });
        return;
    }
    await serveStdio(stdioServer, logger);
    await new Promise((resolve) => {
        stdioServer.onclose = () => resolve();
    });
    await shutdown("stdio-closed");
}
async function writePidFile(logger) {
    try {
        const path = pidFilePath();
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, String(process.pid));
    }
    catch (err) {
        logger.warn("could not write pid file", { error: err.message });
    }
}
async function writeServeInfo(port, logger) {
    try {
        const path = serveInfoPath();
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, JSON.stringify({ pid: process.pid, port }), { mode: 0o600 });
    }
    catch (err) {
        logger.warn("could not write serve info", { error: err.message });
    }
}
async function removeRunFiles() {
    await unlink(pidFilePath()).catch(() => { });
    await unlink(serveInfoPath()).catch(() => { });
}
function range(start, end) {
    const ports = [];
    for (let p = Math.min(start, end); p <= Math.max(start, end); p++)
        ports.push(p);
    return ports;
}
//# sourceMappingURL=serve.js.map