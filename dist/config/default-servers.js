import { resolveAuthStage } from "../auth/tenant-config.js";
import { ENV_EXTENSION_RECRUITER_FACADE, ENV_STAGE, } from "../auth/constants.js";
export const DEFAULT_EXTENSION_SERVER_IDS = {
    RECRUITER_FACADE: "RecruiterFacade",
};
export const DEFAULT_EXTENSION_URLS = {
    beta: {
        recruiterFacade: "https://sm3m7mrvpfdovsnjoza4xkil5u0gqnke.lambda-url.us-west-2.on.aws/mcp",
    },
    prod: {
        recruiterFacade: "",
    },
};
/**
 * Returns default MCP extension servers configured for the active deployment stage.
 * Reads MCP_EXTENSION_RECRUITER_FACADE environment variable if set, otherwise falls back
 * to the stage default URL (beta defaults to Lambda URL; prod requires env var).
 */
export function getDefaultExtensionServers(stage, env = process.env) {
    if (env.HIREKO_DISABLE_DEFAULT_SERVERS === "1") {
        return {};
    }
    const effectiveStage = stage ??
        (env[ENV_STAGE] === "prod"
            ? "prod"
            : env[ENV_STAGE] === "beta"
                ? "beta"
                : resolveAuthStage());
    const envUrl = env[ENV_EXTENSION_RECRUITER_FACADE]?.trim();
    const defaultUrl = DEFAULT_EXTENSION_URLS[effectiveStage]?.recruiterFacade || "";
    const recruiterFacadeUrl = envUrl || defaultUrl;
    return {
        ...(recruiterFacadeUrl
            ? {
                [DEFAULT_EXTENSION_SERVER_IDS.RECRUITER_FACADE]: {
                    transport: "streamable-http",
                    url: recruiterFacadeUrl,
                    tags: ["recruiter", "jobs", "interviews", "hireko"],
                    description: "Hireko Recruiter Facade extension service for creating interview links and retrieving search scores.",
                    enabled: true,
                },
            }
            : {}),
    };
}
/**
 * Merges default extension servers with user-configured servers.
 * Explicit user entries in `servers` override defaults.
 */
export function withDefaultExtensionServers(servers = {}, stage, env = process.env) {
    const defaults = getDefaultExtensionServers(stage, env);
    return {
        ...defaults,
        ...servers,
    };
}
//# sourceMappingURL=default-servers.js.map