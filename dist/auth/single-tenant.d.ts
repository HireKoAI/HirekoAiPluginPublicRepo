/**
 * Product rule: only one tenant session may be active. Switching requires an
 * explicit logout — login must not silently replace another tenant's session.
 */
export declare class TenantSwitchBlockedError extends Error {
    readonly activeTenant: string;
    readonly requestedTenant: string;
    constructor(activeTenant: string, requestedTenant: string);
}
export declare function assertCanLoginTenant(opts: {
    activeTenant: string | undefined;
    nextTenant: string;
    statusFor: (tenant: string) => Promise<{
        authenticated: boolean;
    }>;
}): Promise<void>;
