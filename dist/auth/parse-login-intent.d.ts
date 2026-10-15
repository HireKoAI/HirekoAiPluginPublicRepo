/**
 * Parse free-form /HirekoOpenPlugin (or CLI) args into login_browser inputs.
 *
 * Examples:
 *   "test"                  → { tenant: "test" }  // stage from plugin deploy
 *   "prod test"             → { tenant: "test", stage: "prod" }
 *   "test beta"             → { tenant: "test", stage: "beta" }
 *   "test local 8080"       → { tenant: "test", localPort: 8080 }
 *   "test with local 4200"  → { tenant: "test", localPort: 4200 }
 *   "prod test local 8080"  → { tenant: "test", stage: "prod", localPort: 8080 }
 */
export type AuthStage = "beta" | "prod";
export interface LoginIntent {
    tenant?: string;
    stage?: AuthStage;
    /** Local Vite / dashboard port → http://127.0.0.1:<port> */
    localPort?: number;
    username?: string;
    password?: string;
}
export declare function localDeviceLoginOrigin(port: number): string;
/** Resolve optional dashboard origin override from structured tool/CLI args. */
export declare function resolveDeviceLoginOrigin(opts: {
    deviceLoginOrigin?: string;
    localPort?: number;
}): string | undefined;
export declare function parseLoginIntent(raw: string): LoginIntent;
