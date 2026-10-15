import { formatDuration, printFatal, runApp } from "../util.js";
import { productName } from "../../product-name.js";
export async function logoutCommand(opts) {
    try {
        await runApp({ configPath: opts.config, skipDiscovery: true, disableCache: true }, async (app) => {
            const tenant = opts.tenant ?? app.tenantName;
            const provider = await app.authScopeProvider.tokenProviderFor(tenant);
            await provider.logout();
            console.log(`✓ logged out of tenant "${tenant}"; Cognito tokens revoked (best-effort) and local store cleared`);
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
/** Multi-tenant aware: reports every configured tenant's session state. */
export async function authStatusCommand(opts) {
    try {
        await runApp({ configPath: opts.config, skipDiscovery: true, disableCache: true }, async (app) => {
            const tenants = Object.keys(app.getConfig().tenants);
            for (const tenant of tenants) {
                const details = await app.authScopeProvider.get_auth_server_details(tenant);
                const provider = await app.authScopeProvider.tokenProviderFor(tenant);
                const status = await provider.status();
                const active = tenant === app.tenantName ? " (active)" : "";
                console.log(`Tenant: ${tenant}${active}`);
                console.log(`  Cognito: ${details.userPoolId} in ${details.region}${details.hasClientSecret ? " (client secret)" : ""}`);
                if (!status.authenticated) {
                    console.log("  Authentication: none");
                }
                else {
                    console.log(`  Authentication: valid (${status.username})`);
                    if (status.expiresInSec !== undefined)
                        console.log(`  Token expires: ${formatDuration(status.expiresInSec)}`);
                }
                console.log(`  Credential storage: ${status.storage}`);
                console.log("");
            }
            console.log(`Type /${productName()} to sign in (tenant, then username, then password).`);
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
//# sourceMappingURL=auth.js.map