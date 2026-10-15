import { printFatal, runApp } from "../util.js";
/** `hireko servers` — per-server health table. */
export async function serversCommand(opts) {
    try {
        await runApp({ configPath: opts.config }, async (app) => {
            const config = app.getConfig();
            const rows = app.registry.listServerHealth().map((h) => ({
                server: h.serverId,
                transport: config.servers[h.serverId]?.transport ?? "?",
                status: h.status,
                tools: h.toolCount,
                enabled: config.servers[h.serverId]?.enabled ?? false,
                lastError: h.lastError ?? "",
            }));
            if (opts.json) {
                console.log(JSON.stringify(rows, null, 2));
                return;
            }
            const nameWidth = Math.max(6, ...rows.map((r) => r.server.length));
            console.log(`${"SERVER".padEnd(nameWidth)}  TRANSPORT        STATUS       TOOLS  ERROR`);
            for (const r of rows) {
                const line = `${r.server.padEnd(nameWidth)}  ${r.transport.padEnd(16)} ${r.status.padEnd(12)} ${String(r.tools).padStart(5)}` +
                    (r.lastError ? `  ${r.lastError}` : "");
                console.log(line);
            }
            console.log("");
            console.log(`${rows.length} server(s), ${app.catalog.size().toLocaleString("en-US")} tools indexed`);
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=servers.js.map