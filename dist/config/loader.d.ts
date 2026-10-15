import { type AppConfig } from "./schema.js";
/**
 * Configuration loading behind an interface (spec §10) so YAML can be added
 * later without touching consumers.
 */
export interface RegistryLoader {
    /** Read + parse + validate. Throws ConfigError on any failure. */
    load(path: string): Promise<AppConfig>;
}
export declare class ConfigError extends Error {
    readonly path?: string | undefined;
    readonly issues: string[];
    constructor(message: string, path?: string | undefined, issues?: string[]);
}
export declare class JsonRegistryLoader implements RegistryLoader {
    load(path: string): Promise<AppConfig>;
}
/** Merge default extension servers into a validated config (Zod re-parse for defaults). */
export declare function applyDefaultExtensionServers(config: AppConfig): AppConfig;
export interface ResolvedConfig {
    config: AppConfig;
    path: string;
}
/**
 * Resolve which config file to use (spec §10): explicit path wins, else the
 * first existing default candidate.
 */
export declare function loadConfig(loader: RegistryLoader, explicitPath?: string): Promise<ResolvedConfig>;
