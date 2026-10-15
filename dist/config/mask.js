/** Human-safe view of the config for `doctor`/`status` output (spec §28). */
export function maskConfigForDisplay(config) {
    const tenants = {};
    for (const [name, t] of Object.entries(config.tenants)) {
        tenants[name] = {
            cognito: {
                region: t.cognito.region,
                userPoolId: t.cognito.userPoolId,
                clientId: maskMiddle(t.cognito.clientId),
                clientSecret: t.cognito.clientSecret ? "***" : undefined,
                authMode: t.cognito.authMode,
                tokenToForward: t.cognito.tokenToForward,
            },
        };
    }
    return {
        version: config.version,
        activeTenant: config.activeTenant,
        tenants,
        servers: Object.fromEntries(Object.entries(config.servers).map(([id, s]) => [
            id,
            { transport: s.transport, url: s.url, enabled: s.enabled, tags: s.tags },
        ])),
        routing: config.routing,
    };
}
function maskMiddle(value) {
    if (value.length <= 8)
        return "***";
    return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
//# sourceMappingURL=mask.js.map