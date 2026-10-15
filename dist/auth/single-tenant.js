/**
 * Product rule: only one tenant session may be active. Switching requires an
 * explicit logout — login must not silently replace another tenant's session.
 */
export class TenantSwitchBlockedError extends Error {
    activeTenant;
    requestedTenant;
    constructor(activeTenant, requestedTenant) {
        super(`Already logged in as tenant "${activeTenant}". Call logout first, then login as "${requestedTenant}".`);
        this.activeTenant = activeTenant;
        this.requestedTenant = requestedTenant;
        this.name = "TenantSwitchBlockedError";
    }
}
export async function assertCanLoginTenant(opts) {
    const active = opts.activeTenant?.trim();
    const next = opts.nextTenant.trim();
    if (!active || active === next)
        return;
    const status = await opts.statusFor(active);
    if (status.authenticated) {
        throw new TenantSwitchBlockedError(active, next);
    }
}
//# sourceMappingURL=single-tenant.js.map