import { bootstrap } from "../bootstrap.js";
import { ConfigError } from "../config/loader.js";
/** Bootstrap → run → always close. Fatal errors exit with code 1. */
export async function runApp(opts, fn) {
    let app;
    try {
        app = await bootstrap(opts);
        return await fn(app);
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
        throw err;
    }
    finally {
        await app?.close().catch(() => { });
    }
}
export function printFatal(err) {
    if (err instanceof ConfigError) {
        console.error(`✗ ${err.message}`);
        for (const issue of err.issues)
            console.error(`    - ${issue}`);
        return;
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${message}`);
}
export function formatDuration(seconds) {
    if (seconds < 0)
        return "expired";
    if (seconds < 60)
        return `${seconds}s`;
    if (seconds < 3600)
        return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
}
//# sourceMappingURL=util.js.map