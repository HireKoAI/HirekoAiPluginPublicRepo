import { printFatal, runApp } from "../util.js";
/**
 * `hireko tools` / `hireko tools search "<context>"` (spec §23).
 * Search uses exactly the same scorer as the MCP filter_tools_with_query meta-tool.
 */
export async function toolsCommand(context, opts) {
    try {
        await runApp({ configPath: opts.config }, async (app) => {
            if (!context) {
                const servers = app.catalog.serverIds();
                if (opts.json) {
                    console.log(JSON.stringify({ total: app.catalog.size(), servers: servers.map((s) => ({ server: s, tools: app.catalog.toolCountFor(s) })) }, null, 2));
                    return;
                }
                console.log(`Tools indexed: ${app.catalog.size().toLocaleString("en-US")}`);
                for (const s of servers.sort()) {
                    console.log(`  ${s}: ${app.catalog.toolCountFor(s)}`);
                }
                return;
            }
            const limit = Math.max(1, Number.parseInt(opts.limit ?? "10", 10) || 10);
            const results = app.catalog.searchRelevant({ context, limit, server: opts.server });
            if (opts.json) {
                console.log(JSON.stringify(results, null, 2));
                return;
            }
            if (results.length === 0) {
                console.log("no matching tools");
                return;
            }
            for (const r of results) {
                console.log(`${r.score.toFixed(2).padStart(4)}  ${r.toolRef}`);
            }
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=tools.js.map