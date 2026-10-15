import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { packageRoot } from "./util/pkg-root.js";
/**
 * Read deploy.json written by infra/deploy_to_aws/deploy_aws.sh into the
 * artifact. Source checkouts / local builds have no file → stage null.
 */
export function readDeployInfo() {
    const empty = { stage: null, pluginName: null, version: null, deployedAt: null };
    try {
        const root = packageRoot();
        const path = join(root, "deploy.json");
        if (!existsSync(path))
            return empty;
        const raw = JSON.parse(readFileSync(path, "utf8"));
        return {
            stage: typeof raw.stage === "string" ? raw.stage : null,
            pluginName: typeof raw.pluginName === "string" ? raw.pluginName : null,
            version: typeof raw.version === "string" ? raw.version : null,
            deployedAt: typeof raw.deployedAt === "string" ? raw.deployedAt : null,
        };
    }
    catch {
        return empty;
    }
}
//# sourceMappingURL=deploy-info.js.map