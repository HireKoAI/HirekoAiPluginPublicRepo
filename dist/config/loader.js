import { readFile } from "node:fs/promises";
import { ConfigSchema } from "./schema.js";
import { withDefaultExtensionServers } from "./default-servers.js";
import { defaultConfigCandidates } from "./paths.js";
import { productName } from "../product-name.js";
export class ConfigError extends Error {
    path;
    issues;
    constructor(message, path, issues = []) {
        super(message);
        this.path = path;
        this.issues = issues;
        this.name = "ConfigError";
    }
}
export class JsonRegistryLoader {
    async load(path) {
        let raw;
        try {
            raw = await readFile(path, "utf8");
        }
        catch (err) {
            throw new ConfigError(`cannot read config file: ${err.message}`, path);
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (err) {
            throw new ConfigError(`invalid JSON: ${err.message}`, path);
        }
        const result = ConfigSchema.safeParse(parsed);
        if (!result.success) {
            const issues = result.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`);
            throw new ConfigError(`config validation failed (${issues.length} issue${issues.length === 1 ? "" : "s"})`, path, issues);
        }
        // Always inject stage-default extension MCP servers.
        // Explicit config entries with the same id still win over defaults.
        return applyDefaultExtensionServers(result.data);
    }
}
/** Merge default extension servers into a validated config (Zod re-parse for defaults). */
export function applyDefaultExtensionServers(config) {
    const merged = ConfigSchema.safeParse({
        ...config,
        servers: withDefaultExtensionServers(config.servers),
    });
    if (!merged.success) {
        // Defaults should always validate; fall back to the already-valid config.
        return config;
    }
    return merged.data;
}
/**
 * Resolve which config file to use (spec §10): explicit path wins, else the
 * first existing default candidate.
 */
export async function loadConfig(loader, explicitPath) {
    if (explicitPath) {
        return { config: await loader.load(explicitPath), path: explicitPath };
    }
    const candidates = defaultConfigCandidates();
    for (const candidate of candidates) {
        try {
            const config = await loader.load(candidate);
            return { config, path: candidate };
        }
        catch (err) {
            if (err instanceof ConfigError && err.message.startsWith("cannot read config file")) {
                continue; // missing file — try next candidate
            }
            throw err; // present but broken: surface it
        }
    }
    throw new ConfigError(`no config found; looked in:\n${candidates.map((c) => `  - ${c}`).join("\n")}\nRun \`${productName()} init\` to create one.`);
}
//# sourceMappingURL=loader.js.map