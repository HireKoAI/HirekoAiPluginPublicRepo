import type { ServerConfigInput } from "./schema.js";
export declare const DEFAULT_EXTENSION_SERVER_IDS: {
    readonly RECRUITER_FACADE: "RecruiterFacade";
};
export declare const DEFAULT_EXTENSION_URLS: {
    readonly beta: {
        readonly recruiterFacade: "https://sm3m7mrvpfdovsnjoza4xkil5u0gqnke.lambda-url.us-west-2.on.aws/mcp";
    };
    readonly prod: {
        readonly recruiterFacade: "";
    };
};
/**
 * Returns default MCP extension servers configured for the active deployment stage.
 * Reads MCP_EXTENSION_RECRUITER_FACADE environment variable if set, otherwise falls back
 * to the stage default URL (beta defaults to Lambda URL; prod requires env var).
 */
export declare function getDefaultExtensionServers(stage?: "beta" | "prod", env?: NodeJS.ProcessEnv): Record<string, ServerConfigInput>;
/**
 * Merges default extension servers with user-configured servers.
 * Explicit user entries in `servers` override defaults.
 */
export declare function withDefaultExtensionServers(servers?: Record<string, ServerConfigInput>, stage?: "beta" | "prod", env?: NodeJS.ProcessEnv): Record<string, ServerConfigInput>;
