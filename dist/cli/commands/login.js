import { assertCanLoginTenant } from "../../auth/single-tenant.js";
import { decodeInternalApiKey, readInternalApiKeyFromEnv, resolveLoginTenant } from "../../auth/internal-api-key.js";
import { ENV_INTERNAL_API_KEY } from "../../auth/constants.js";
import { promptHidden, promptLine } from "../prompt.js";
import { printFatal, runApp } from "../util.js";
/**
 * CLI `login` (optional). Primary path is the MCP `login` tool from the
 * slash command: tenant → username → password. Password exists in
 * process memory only long enough to reach Cognito.
 *
 * Only one tenant may be logged in. Switching requires an explicit logout.
 */
export async function loginCommand(opts) {
    try {
        await runApp({ configPath: opts.config, skipDiscovery: true, disableCache: true }, async (app) => {
            const apiKeyFlag = opts.apikey;
            const wantsApiKey = apiKeyFlag === true || apiKeyFlag === "" || typeof apiKeyFlag === "string";
            const apiKeyRaw = apiKeyFlag === true || apiKeyFlag === ""
                ? readInternalApiKeyFromEnv()
                : typeof apiKeyFlag === "string"
                    ? apiKeyFlag.trim()
                    : undefined;
            if (opts.browser && wantsApiKey) {
                let tenant;
                try {
                    tenant = resolveLoginTenant({
                        tenant: opts.tenant,
                        apiKey: apiKeyRaw,
                    }).tenant;
                }
                catch (err) {
                    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
                    process.exitCode = 1;
                    return;
                }
                await assertCanLoginTenant({
                    activeTenant: app.tenantName,
                    nextTenant: tenant,
                    statusFor: async (t) => (await app.authScopeProvider.tokenProviderFor(t)).status(),
                });
                const stage = opts.stage === "beta" || opts.stage === "prod" ? opts.stage : undefined;
                const shouldOpenBrowser = opts.openBrowser !== false;
                const localPort = opts.localPort !== undefined ? Number(opts.localPort) : undefined;
                const deviceLoginOrigin = opts.deviceLoginOrigin?.trim() || undefined;
                console.log(`Device login for tenant "${tenant}" (${stage ?? "plugin default stage"}, from api key)`);
                if (deviceLoginOrigin || localPort) {
                    console.log(`  Local dashboard: ${deviceLoginOrigin ?? `http://127.0.0.1:${localPort}`}/devicelogin`);
                }
                else {
                    console.log("  Host pattern: https://recruiter-<tenant>[.beta].hireko.ai/devicelogin");
                }
                console.log("  Does not sign you into the recruiter website — only the local CLI session.");
                if (!shouldOpenBrowser) {
                    console.log("  Browser auto-open disabled — copy the URL printed next.");
                }
                const session = await app.authScopeProvider.login_tenant_oauth(tenant, {
                    stage,
                    redirectUri: opts.redirectUri,
                    openBrowser: shouldOpenBrowser,
                    deviceLoginOrigin,
                    localPort: Number.isFinite(localPort) ? localPort : undefined,
                });
                await app.setActiveTenant(tenant);
                const expiresIn = session.expiresAt
                    ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000))
                    : undefined;
                console.log(`✓ authenticated as ${session.username} (tenant ${tenant}, device login)`);
                console.log(`  activeTenant set to "${tenant}"`);
                if (expiresIn !== undefined)
                    console.log(`  token expires in ${Math.floor(expiresIn / 60)}m`);
                console.log(`  hasRefresh: ${Boolean(session.refreshToken)}`);
                if (!session.refreshToken) {
                    console.warn("  warning: no refresh token — session will die when the access token expires");
                }
                console.log(`  human: http://127.0.0.1:8400/human`);
                console.log(`  mcp:   http://127.0.0.1:8400/mcp`);
                return;
            }
            if (wantsApiKey) {
                if (!apiKeyRaw) {
                    console.error(`✗ --apikey set but ${ENV_INTERNAL_API_KEY} is empty`);
                    process.exitCode = 1;
                    return;
                }
                const creds = decodeInternalApiKey(apiKeyRaw);
                await assertCanLoginTenant({
                    activeTenant: app.tenantName,
                    nextTenant: creds.tenant,
                    statusFor: async (t) => (await app.authScopeProvider.tokenProviderFor(t)).status(),
                });
                const session = await app.authScopeProvider.login_tenant_user(creds.username, creds.password, creds.tenant);
                await app.setActiveTenant(creds.tenant);
                const expiresIn = session.expiresAt
                    ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000))
                    : undefined;
                console.log(`✓ authenticated as ${session.username} (tenant ${creds.tenant}, api key)`);
                console.log(`  activeTenant set to "${creds.tenant}"`);
                if (expiresIn !== undefined)
                    console.log(`  token expires in ${Math.floor(expiresIn / 60)}m`);
                return;
            }
            const tenant = (opts.tenant ?? (await promptLine("Tenant: "))).trim();
            if (!tenant) {
                console.error("✗ tenant name is required");
                process.exitCode = 1;
                return;
            }
            await assertCanLoginTenant({
                activeTenant: app.tenantName,
                nextTenant: tenant,
                statusFor: async (t) => (await app.authScopeProvider.tokenProviderFor(t)).status(),
            });
            if (opts.browser) {
                const stage = opts.stage === "beta" || opts.stage === "prod" ? opts.stage : undefined;
                const shouldOpenBrowser = opts.openBrowser !== false;
                const localPort = opts.localPort !== undefined ? Number(opts.localPort) : undefined;
                const deviceLoginOrigin = opts.deviceLoginOrigin?.trim() || undefined;
                console.log(`Device login for tenant "${tenant}" (${stage ?? "plugin default stage"})`);
                if (deviceLoginOrigin || localPort) {
                    console.log(`  Local dashboard: ${deviceLoginOrigin ?? `http://127.0.0.1:${localPort}`}/devicelogin`);
                }
                else {
                    console.log("  Host pattern: https://recruiter-<tenant>[.beta].hireko.ai/devicelogin");
                }
                console.log("  Does not sign you into the recruiter website — only the local CLI session.");
                if (!shouldOpenBrowser) {
                    console.log("  Browser auto-open disabled — copy the URL printed next.");
                }
                const session = await app.authScopeProvider.login_tenant_oauth(tenant, {
                    stage,
                    redirectUri: opts.redirectUri,
                    openBrowser: shouldOpenBrowser,
                    deviceLoginOrigin,
                    localPort: Number.isFinite(localPort) ? localPort : undefined,
                });
                await app.setActiveTenant(tenant);
                const expiresIn = session.expiresAt ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : undefined;
                console.log(`✓ authenticated as ${session.username} (tenant ${tenant}, device login)`);
                console.log(`  activeTenant set to "${tenant}"`);
                if (expiresIn !== undefined)
                    console.log(`  token expires in ${Math.floor(expiresIn / 60)}m`);
                console.log(`  hasRefresh: ${Boolean(session.refreshToken)}`);
                if (!session.refreshToken) {
                    console.warn("  warning: no refresh token — session will die when the access token expires");
                }
                // Fixed control port for harness-owned `serve` (/human). Always print —
                // CLI login is a separate process from the MCP child, so it won't be in banners.
                console.log(`  human: http://127.0.0.1:8400/human`);
                console.log(`  mcp:   http://127.0.0.1:8400/mcp`);
                return;
            }
            const details = await app.authScopeProvider.get_auth_server_details(tenant);
            console.log(`Tenant: ${details.tenant} (pool ${details.userPoolId}, ${details.region})`);
            const username = opts.username ?? (await promptLine("Username: "));
            if (!username.trim()) {
                console.error("✗ username is required");
                process.exitCode = 1;
                return;
            }
            const password = opts.passwordStdin
                ? await promptHidden("") // reads piped stdin
                : await promptHidden("Password: ");
            if (!password) {
                console.error("✗ password is required");
                process.exitCode = 1;
                return;
            }
            const session = await app.authScopeProvider.login_tenant_user(username.trim(), password, tenant, interactiveResolver);
            const expiresIn = session.expiresAt ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : undefined;
            console.log(`✓ authenticated as ${session.username} (tenant ${tenant})`);
            if (expiresIn !== undefined)
                console.log(`  token expires in ${Math.floor(expiresIn / 60)}m`);
            if (tenant !== app.tenantName) {
                console.log(`  note: this config serves tenant "${app.tenantName}"; set activeTenant="${tenant}" to route tools through it`);
            }
        });
    }
    catch (err) {
        printFatal(err);
        process.exitCode = 1;
    }
}
/** Terminal-driven challenge resolution (spec §13). */
const interactiveResolver = {
    resolve: async (challenge) => {
        switch (challenge.challengeName) {
            case "NEW_PASSWORD_REQUIRED": {
                const newPassword = await promptHidden("New password (required by policy): ");
                return newPassword ? { NEW_PASSWORD: newPassword } : null;
            }
            case "SMS_MFA": {
                const code = await promptLine("SMS MFA code: ");
                return code.trim() ? { SMS_MFA_CODE: code.trim() } : null;
            }
            case "SOFTWARE_TOKEN_MFA": {
                const code = await promptLine("Authenticator (TOTP) code: ");
                return code.trim() ? { SOFTWARE_TOKEN_MFA_CODE: code.trim() } : null;
            }
            case "SELECT_MFA_TYPE": {
                const smsAvailable = challenge.parameters?.AVAILABLE_MFA_TYPES?.includes("SMS_MFA") ?? true;
                return { SELECT_MFA_TYPE: smsAvailable ? "SMS_MFA" : "SOFTWARE_TOKEN_MFA" };
            }
            case "MFA_SETUP": {
                console.error("✗ this account requires MFA setup; complete it in the Cognito console or hosted UI, then retry.");
                return null;
            }
            default: {
                console.error(`✗ unsupported auth challenge: ${challenge.challengeName}`);
                return null;
            }
        }
    },
};
//# sourceMappingURL=login.js.map