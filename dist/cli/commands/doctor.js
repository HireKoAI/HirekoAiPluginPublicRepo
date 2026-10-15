import { access } from "node:fs/promises";
import { createDefaultCredentialStore } from "../../auth/credential-store.js";
import { JsonRegistryLoader, loadConfig, ConfigError } from "../../config/loader.js";
import { catalogCachePath, productHome } from "../../config/paths.js";
import { runApp, printFatal } from "../util.js";
import { productName } from "../../product-name.js";
import { isContainerRuntime, isHeadlessLinux, remoteDeviceLoginHint } from "../../util/runtime-env.js";
/** `hireko doctor` — diagnose environment, config, auth, and fleet health. */
export async function doctorCommand(opts) {
    const nodeMajor = Number(process.versions.node.split(".")[0]);
    line(nodeMajor >= 20, `Node.js ${process.versions.node} (>= 20 required)`);
    if (isContainerRuntime() || isHeadlessLinux()) {
        line(true, `runtime: ${isContainerRuntime() ? "container" : "headless-linux"} (product home ${productHome()})`);
        const hint = remoteDeviceLoginHint();
        if (hint)
            console.log(`      note: ${hint}`);
    }
    const loader = new JsonRegistryLoader();
    let configPath;
    try {
        const resolved = await loadConfig(loader, opts.config);
        configPath = resolved.path;
        line(true, `config valid: ${resolved.path}`);
        line(Object.keys(resolved.config.servers).length > 0, `${Object.keys(resolved.config.servers).length} downstream server(s) configured`);
    }
    catch (err) {
        if (err instanceof ConfigError) {
            line(false, `config problem: ${err.message}`);
            for (const issue of err.issues)
                console.log(`      - ${issue}`);
        }
        else {
            line(false, `config problem: ${err.message}`);
        }
    }
    const store = await createDefaultCredentialStore();
    line(true, `credential storage: ${store.describe()}`);
    try {
        const cachePath = catalogCachePath();
        await access(cachePath);
        line(true, `catalog cache present: ${cachePath} (disposable)`);
    }
    catch {
        line(true, "no catalog cache (fine — it is only a startup optimization)");
    }
    if (configPath) {
        try {
            await runApp({ configPath }, async (app) => {
                const auth = await app.tokenProvider.status();
                line(auth.authenticated, auth.authenticated
                    ? `authenticated as ${auth.username} (${app.tenantName})`
                    : `not authenticated — type /${productName()} to sign in`);
                for (const h of app.registry.listServerHealth()) {
                    line(h.status === "healthy", h.status === "healthy"
                        ? `server ${h.serverId}: healthy, ${h.toolCount} tools`
                        : `server ${h.serverId}: ${h.status}${h.lastError ? ` — ${h.lastError}` : ""}`);
                }
            });
        }
        catch (err) {
            printFatal(err);
            process.exitCode = 1;
        }
    }
}
function line(ok, text) {
    console.log(`${ok ? "✓" : "✗"} ${text}`);
}
//# sourceMappingURL=doctor.js.map