import type { CognitoConfig } from "../config/schema.js";
import type { Logger } from "../logging/logger.js";
import type { CognitoApi } from "./cognito.js";
import type { CredentialStore } from "./credential-store.js";
import { type AuthSession, type AuthStatus, type ChallengeResolver, type LoginInput, type TokenProvider } from "./types.js";
export interface TokenManagerOptions {
    tenant: string;
    cognito: CognitoConfig;
    api: CognitoApi;
    store: CredentialStore;
    logger: Logger;
    /** Injectable clock for tests. */
    now?: () => number;
}
/**
 * Cognito-backed TokenProvider (spec §14).
 *
 * - Password flow: USER_PASSWORD_AUTH (NOT an OAuth authorization-code flow;
 *   see spec §12).
 * - Proactive refresh inside a configurable safety window.
 * - Single-flight refresh: N concurrent callers share one refresh request.
 * - Passwords exist only in memory for the duration of login() and are never
 *   persisted or logged.
 */
export declare class TokenManager implements TokenProvider {
    private readonly opts;
    private session;
    private refreshFlight;
    private loaded;
    private loadFlight;
    private readonly now;
    constructor(opts: TokenManagerOptions);
    private get cognito();
    /**
     * Lazily load a persisted session once. Single-flighted: concurrent first
     * callers (e.g. several downstream discoveries racing for a token) all
     * await the same load instead of observing a half-initialized session.
     */
    private ensureLoaded;
    private doLoad;
    login(input: LoginInput, resolver?: ChallengeResolver): Promise<AuthSession>;
    getAccessToken(): Promise<string>;
    /**
     * Like getAccessToken() but for a specific token kind, regardless of
     * tokenToForward. Used by header templates (${ACCESS_TOKEN}/${ID_TOKEN}).
     */
    getToken(kind: "access" | "id"): Promise<string>;
    refresh(): Promise<AuthSession>;
    /** Persist a session obtained outside USER_PASSWORD_AUTH (e.g. OAuth PKCE). */
    absorbSession(session: AuthSession): Promise<void>;
    logout(): Promise<void>;
    status(): Promise<AuthStatus>;
    private forwardedToken;
    private toSession;
}
