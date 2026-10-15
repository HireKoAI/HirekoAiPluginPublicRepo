import { writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import { hirekoHome } from "../../config/paths.js";
import { productName } from "../../product-name.js";
import { getDefaultExtensionServers } from "../../config/default-servers.js";
function getInitTemplate() {
    return {
        version: 1,
        activeTenant: "hireko",
        tenants: {
            hireko: {
                cognito: {
                    region: "us-west-2",
                    userPoolId: "us-west-2_EXAMPLE",
                    clientId: "EXAMPLE_CLIENT_ID",
                    authMode: "password",
                    tokenToForward: "access",
                },
            },
        },
        servers: getDefaultExtensionServers(),
        authHeaders: {
            authorization: "Bearer ${ACCESS_TOKEN}",
            AuthorizationTenant: "${TENANT}",
            AuthorizationRegion: "us-east-1",
            tenant: { name: "X-Tenant", value: "${TENANT}" },
        },
        routing: {
            mode: "flat",
            defaultLimit: 12,
            maxResults: 50,
            dynamicToolActivation: false,
        },
    };
}
export async function initCommand(opts) {
    const target = opts.config ?? (await firstMissing([join(process.cwd(), "hireko.mcp.json"), join(hirekoHome(), "config.json")]));
    if (!opts.force) {
        try {
            await access(target);
            console.error(`✗ ${target} already exists (use --force to overwrite)`);
            process.exitCode = 1;
            return;
        }
        catch {
            // Missing — good.
        }
    }
    await writeFile(target, JSON.stringify(getInitTemplate(), null, 2) + "\n");
    console.log(`✓ wrote ${target}`);
    console.log("");
    console.log("Next steps:");
    console.log("  1. Edit the file: fill in Cognito userPoolId/clientId and your MCP servers.");
    console.log(`  2. restart your harness and type /${productName()}`);
    console.log("  3. tabs: tenantname, username, password — Enter signs in");
}
async function firstMissing(candidates) {
    for (const candidate of candidates) {
        try {
            await access(candidate);
        }
        catch {
            return candidate;
        }
    }
    return candidates[0];
}
//# sourceMappingURL=init.js.map