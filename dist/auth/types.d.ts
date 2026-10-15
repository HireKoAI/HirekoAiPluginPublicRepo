/**
 * Authentication contracts (spec §14). Everything downstream of these
 * interfaces is swappable: Cognito today, another IdP later.
 */
export interface AuthSession {
    tenant: string;
    username: string;
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    /** Epoch ms when the access token expires (undefined = unknown). */
    expiresAt?: number;
    tokenType?: string;
    /** Which recruiter host/Cognito pool issued this session (beta vs prod). */
    authStage?: "beta" | "prod";
}
export interface AuthStatus {
    authenticated: boolean;
    tenant?: string;
    username?: string;
    /** Epoch ms, if known. */
    expiresAt?: number;
    /** Seconds until expiry, if known (can be negative when expired). */
    expiresInSec?: number;
    storage: string;
    /** Where the forwarded token would come from. */
    tokenToForward?: "access" | "id";
}
export interface LoginInput {
    username: string;
    password: string;
}
export interface TokenProvider {
    login(input: LoginInput): Promise<AuthSession>;
    /**
     * Returns a valid forwarded token, refreshing proactively when inside the
     * safety window. Throws NotAuthenticatedError when no session exists —
     * never returns a stale token.
     */
    getAccessToken(): Promise<string>;
    /** A specific token kind regardless of tokenToForward (header templates). */
    getToken(kind: "access" | "id"): Promise<string>;
    refresh(): Promise<AuthSession>;
    logout(): Promise<void>;
    status(): Promise<AuthStatus>;
}
export declare class NotAuthenticatedError extends Error {
    constructor(message?: string);
}
export declare class AuthChallengeError extends Error {
    readonly challengeName: string;
    constructor(challengeName: string, message: string);
}
/**
 * Challenge handling behind an interface (spec §13). The CLI supplies a
 * terminal-prompting resolver; tests supply scripted ones; a future GUI host
 * could supply its own.
 */
export interface ChallengeInfo {
    challengeName: string;
    session?: string;
    parameters?: Record<string, string>;
    username: string;
}
export interface ChallengeResolver {
    /**
     * Return challenge response key/values (e.g. { SMS_MFA_CODE: "123456" }),
     * or null to abort the login.
     */
    resolve(challenge: ChallengeInfo): Promise<Record<string, string> | null>;
}
