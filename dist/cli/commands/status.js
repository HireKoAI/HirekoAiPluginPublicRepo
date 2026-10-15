import { readFile } from "node:fs/promises";
import { JsonRegistryLoader, loadConfig } from "../../config/loader.js";
import { serveInfoPath } from "../../config/paths.js";
import { formatDuration, printFatal, runApp } from "../util.js";
import { productName } from "../../product-name.js";
import { readDeployInfo } from "../../deploy-info.js";
/**
 * `hireko status` — fleet overview (spec §22).
 *
 * Preference: the LIVE serve process via the control endpoint (fast, shows
 * reality). Fallback: one-shot bootstrap with discovery.
 */
export async function statusCommand(opts) {
    if (await statusViaControl(opts))
        return;
    try {
        await runApp({ configPath: opts.config }, async (app) => {
            const config = app.getConfig();
            const health = app.registry.listServerHealth();
            const auth = await app.tokenProvider.status();
            const healthy = health.filter((h) => h.status === "healthy").length;
            const unavailable = health.filter((h) => h.status === "unavailable").length;
            if (opts.json) {
                console.log(JSON.stringify({
                    tenant: config.activeTenant,
                    authenticated: auth.authenticated,
                    tokenExpiresInSec: auth.expiresInSec ?? null,
                    servers: health.length,
                    healthy,
                    unavailable,
                    toolsIndexed: app.catalog.size(),
                    routingMode: config.routing.mode,
                    dynamicToolActivation: config.routing.dynamicToolActivation,
                    config: app.configPath,
                }, null, 2));
                return;
            }
            console.log(productName());
            const deploy = readDeployInfo();
            console.log(`Stage: ${deploy.stage ?? "local"}`);
            console.log(`Proxy: up (pid ${process.pid})`);
            console.log(`Tenant: ${config.activeTenant}`);
            console.log(`Authentication: ${auth.authenticated ? "valid" : `none (type /${productName()} to sign in)`}`);
            if (auth.authenticated && auth.expiresInSec !== undefined) {
                console.log(`Token expires: ${formatDuration(auth.expiresInSec)}`);
            }
            console.log(`Servers: ${health.length}`);
            console.log(`Healthy: ${healthy}`);
            console.log(`Unavailable: ${unavailable}`);
            console.log(`Tools indexed: ${app.catalog.size().toLocaleString("en-US")}`);
            console.log(`Routing mode: ${config.routing.mode}${config.routing.dynamicToolActivation ? " + dynamic activation" : ""}`);
            console.log(`Config: ${app.configPath}`);
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
async function statusViaControl(opts) {
    try {
        const info = JSON.parse(await readFile(serveInfoPath(), "utf8"));
        if (!processAlive(info.pid))
            return false;
        const res = await fetch(`http://127.0.0.1:${info.port}/status`, {});
        if (!res.ok)
            return false;
        const live = (await res.json());
        const healthy = live.servers.filter((s) => s.status === "healthy").length;
        const unavailable = live.servers.filter((s) => s.status === "unavailable").length;
        let configPath;
        try {
            configPath = (await loadConfig(new JsonRegistryLoader(), opts.config)).path;
        }
        catch {
            configPath = undefined;
        }
        if (opts.json) {
            console.log(JSON.stringify({
                live: true,
                tenant: live.tenant,
                authenticated: live.authenticated,
                tokenExpiresInSec: live.expiresInSec ?? null,
                servers: live.servers.length,
                healthy,
                unavailable,
                toolsIndexed: live.toolsIndexed,
                routingMode: live.routingMode,
                config: configPath ?? null,
            }, null, 2));
            return true;
        }
        console.log(`${productName()} (live serve)`);
        const deploy = readDeployInfo();
        console.log(`Stage: ${deploy.stage ?? "local"}`);
        console.log(`Proxy: up  http://127.0.0.1:${info.port}`);
        console.log(`Human: http://127.0.0.1:${info.port}/human`);
        console.log(`Tenant: ${live.tenant}`);
        console.log(`Authentication: ${live.authenticated ? `valid${live.username ? ` (${live.username})` : ""}` : `none (type /${productName()} to sign in)`}`);
        if (live.authenticated && live.expiresInSec != null) {
            console.log(`Token expires: ${formatDuration(live.expiresInSec)}`);
        }
        console.log(`Servers: ${live.servers.length}`);
        console.log(`Healthy: ${healthy}`);
        console.log(`Unavailable: ${unavailable}`);
        console.log(`Tools indexed: ${live.toolsIndexed.toLocaleString("en-US")}`);
        console.log(`Routing mode: ${live.routingMode}`);
        if (configPath)
            console.log(`Config: ${configPath}`);
        return true;
    }
    catch {
        return false;
    }
}
function processAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=status.js.map