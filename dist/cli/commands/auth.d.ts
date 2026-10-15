export declare function logoutCommand(opts: {
    config?: string;
    tenant?: string;
}): Promise<void>;
/** Multi-tenant aware: reports every configured tenant's session state. */
export declare function authStatusCommand(opts: {
    config?: string;
}): Promise<void>;
