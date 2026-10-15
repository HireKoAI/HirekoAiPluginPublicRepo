import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { productName } from "../product-name.js";
import { ENV_HOME } from "../auth/constants.js";
/** Env override for tests / CI — when set, product runtime data lives under this root. */
function homeOverride() {
    const v = process.env[ENV_HOME]?.trim();
    return v && v.length > 0 ? v : undefined;
}
/**
 * Per-plugin runtime home: credentials, cache, run, config.
 * Default: `~/.<productName>` (folder/plugin name — not a company-generic `.hireko`).
 * `HIREKO_HOME` forces a root (tests use a temp dir).
 */
export function productHome() {
    const override = homeOverride();
    if (override)
        return override;
    return join(homedir(), `.${productName()}`);
}
/**
 * @deprecated Prefer {@link productHome} for runtime state. Alias kept for callers.
 */
export function hirekoHome() {
    return productHome();
}
/**
 * Shared company install root for plugin unpack (`plugins/<Name>`).
 * Stays `~/.hireko` so many Hireko MCP plugins can coexist; not used for credentials.
 */
export function companyHome() {
    return homeOverride() ?? join(homedir(), ".hireko");
}
/** Legacy pre-rename runtime root (`~/.hireko`) — used for one-shot migration. */
export function legacyCompanyRuntimeHome() {
    return join(homedir(), ".hireko");
}
/** Default config lookup order (spec §10). Explicit `--config` wins over both. */
export function defaultConfigCandidates() {
    const candidates = [];
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT?.trim() || process.env.PLUGIN_ROOT?.trim();
    if (pluginRoot) {
        candidates.push(join(pluginRoot, "hireko.mcp.json"));
    }
    candidates.push(join(process.cwd(), "hireko.mcp.json"), join(productHome(), "config.json"));
    // Prefer product home; still find older installs that kept config under ~/.hireko.
    const legacy = join(legacyCompanyRuntimeHome(), "config.json");
    if (!homeOverride() && legacy !== candidates[candidates.length - 1])
        candidates.push(legacy);
    return candidates;
}
export function credentialsDir() {
    return join(productHome(), "credentials");
}
/** Pre-rename credentials dir (`~/.hireko/credentials`). */
export function legacyCredentialsDir() {
    return join(legacyCompanyRuntimeHome(), "credentials");
}
export function cacheDir() {
    return join(productHome(), "cache");
}
export function catalogCachePath() {
    return join(cacheDir(), "catalog.json");
}
export function runDir() {
    return join(productHome(), "run");
}
export function pluginsDir() {
    return join(companyHome(), "plugins");
}
export function pidFilePath() {
    return join(runDir(), "serve.pid");
}
/** Live-serve descriptor: { pid, port, secret } — mode 0600, localhost control. */
export function serveInfoPath() {
    return join(runDir(), "serve.json");
}
/**
 * Port of this process's control /human console (serve.json written by serve).
 * Ignores stale files from other PIDs.
 */
export function readServePort() {
    try {
        const path = serveInfoPath();
        if (!existsSync(path))
            return null;
        const raw = JSON.parse(readFileSync(path, "utf8"));
        if (typeof raw.pid === "number" && raw.pid !== process.pid)
            return null;
        return typeof raw.port === "number" && raw.port > 0 ? raw.port : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=paths.js.map