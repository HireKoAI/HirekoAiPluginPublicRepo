import { readFile } from "node:fs/promises";
import { JsonRegistryLoader, loadConfig } from "../../config/loader.js";
import { pidFilePath, serveInfoPath } from "../../config/paths.js";
import { printFatal } from "../util.js";
/**
 * `hireko reload`.
 *
 * Preference order:
 *   1. Live control endpoint (serve.json: pid+port+secret) — HTTP POST /reload.
 *   2. SIGUSR2 to the pid-file process.
 *   3. No running serve: validate config only; applies on next start.
 * The MCP-side equivalent is the `reload_registry` meta-tool.
 */
export async function reloadCommand(opts) {
    const loader = new JsonRegistryLoader();
    try {
        const { path } = await loadConfig(loader, opts.config);
        console.log(`✓ config valid: ${path}`);
        if (await reloadViaControl())
            return;
        const pid = await readPid();
        if (pid !== undefined && processAlive(pid)) {
            process.kill(pid, "SIGUSR2");
            console.log(`✓ reload signal sent to hireko serve (pid ${pid})`);
        }
        else {
            console.log("  no running hireko serve found; config will apply on next start");
            console.log("  (inside an MCP session, call the reload_registry tool instead)");
        }
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
async function reloadViaControl() {
    try {
        const info = JSON.parse(await readFile(serveInfoPath(), "utf8"));
        if (!processAlive(info.pid))
            return false;
        const res = await fetch(`http://127.0.0.1:${info.port}/reload`, {
            method: "POST",
        });
        if (!res.ok)
            return false;
        const body = (await res.json());
        console.log(`✓ reloaded via control endpoint (port ${info.port})`);
        console.log(`  added ${body.added?.length ?? 0}, removed ${body.removed?.length ?? 0}, changed ${body.changed?.length ?? 0}, kept ${body.kept?.length ?? 0}; tools ${body.toolCount ?? 0}`);
        return true;
    }
    catch {
        return false;
    }
}
async function readPid() {
    try {
        const raw = await readFile(pidFilePath(), "utf8");
        const pid = Number.parseInt(raw.trim(), 10);
        return Number.isInteger(pid) && pid > 0 ? pid : undefined;
    }
    catch {
        return undefined;
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
//# sourceMappingURL=reload.js.map