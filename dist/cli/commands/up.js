import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { serveInfoPath, pidFilePath } from "../../config/paths.js";
import { readDeployInfo } from "../../deploy-info.js";
import { productName } from "../../product-name.js";
/** Preferred /human control port when the harness-owned `serve` binds HTTP. */
export const PREFERRED_CONTROL_PORT = 8400;
function readServeInfo() {
    try {
        const path = serveInfoPath();
        if (!existsSync(path))
            return null;
        const raw = JSON.parse(readFileSync(path, "utf8"));
        if (typeof raw.pid !== "number" || typeof raw.port !== "number")
            return null;
        return raw;
    }
    catch {
        return null;
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
function clearRunFiles() {
    for (const p of [serveInfoPath(), pidFilePath()]) {
        try {
            unlinkSync(p);
        }
        catch {
            /* ignore */
        }
    }
}
function stopStale(info) {
    let stopped = false;
    if (info && processAlive(info.pid)) {
        try {
            process.kill(info.pid, "SIGTERM");
            stopped = true;
        }
        catch {
            /* ignore */
        }
    }
    clearRunFiles();
    return stopped;
}
/**
 * Clear orphaned `--detach` proxies. Do not start a new daemon.
 *
 * Claude/Cursor own MCP via stdio (`mcp.json` → `serve`). That child receives
 * OS teardown when the harness exits. A detached HTTP daemon would survive the
 * harness and is intentionally not started here.
 */
export async function upCommand(opts) {
    const existing = readServeInfo();
    const wasAlive = Boolean(existing && processAlive(existing.pid));
    const stopped = stopStale(existing);
    const deploy = readDeployInfo();
    const body = {
        ok: true,
        clearedOrphan: stopped || wasAlive,
        product: productName(),
        stage: deploy.stage ?? "local",
        mode: "stdio-owned-by-harness",
        note: "MCP runs as the harness child (stdio). Kill/quit the harness and the OS stops the proxy. /human appears on :8400 after the harness connects.",
        proxy: {
            human: `http://127.0.0.1:${PREFERRED_CONTROL_PORT}/human`,
            mcp: "stdio (harness-owned)",
        },
    };
    if (opts.json) {
        console.log(JSON.stringify(body, null, 2));
        return;
    }
    console.log(`${productName()} ready (stdio MCP — dies with the harness)`);
    console.log(`stage: ${body.stage}`);
    if (stopped || wasAlive)
        console.log("cleared: orphan detached proxy (if any)");
    console.log(`human: ${body.proxy.human} (after harness connects)`);
    console.log(`mcp:   http://127.0.0.1:${PREFERRED_CONTROL_PORT}/mcp (HTTP; primary MCP is still stdio)`);
}
//# sourceMappingURL=up.js.map