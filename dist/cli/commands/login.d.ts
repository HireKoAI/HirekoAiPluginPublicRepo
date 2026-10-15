/**
 * CLI `login` (optional). Primary path is the MCP `login` tool from the
 * slash command: tenant → username → password. Password exists in
 * process memory only long enough to reach Cognito.
 *
 * Only one tenant may be logged in. Switching requires an explicit logout.
 */
export declare function loginCommand(opts: {
    config?: string;
    tenant?: string;
    username?: string;
    passwordStdin?: boolean;
    /** Commander `--apikey [key]`: string, or true when the flag is present with no value. */
    apikey?: string | true;
    browser?: boolean;
    stage?: "beta" | "prod";
    redirectUri?: string;
    /** e.g. http://127.0.0.1:8080 for local RecruiterDashboard Vite. */
    deviceLoginOrigin?: string;
    localPort?: string;
    /** Commander `--no-open-browser` sets this to false. */
    openBrowser?: boolean;
}): Promise<void>;
