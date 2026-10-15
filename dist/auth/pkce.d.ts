/** RFC 7636 PKCE helpers for Cognito Hosted UI (authorization code + S256). */
export declare function generateCodeVerifier(): string;
export declare function codeChallengeS256(verifier: string): string;
export declare function generateOAuthState(): string;
export interface CognitoOAuthEndpoints {
    authorizeUrl: string;
    tokenUrl: string;
}
/** `domain` is the Hosted UI hostname without scheme. */
export declare function cognitoOAuthEndpoints(domain: string): CognitoOAuthEndpoints;
export declare function buildAuthorizeUrl(params: {
    domain: string;
    clientId: string;
    redirectUri: string;
    scopes: string[];
    state: string;
    codeChallenge: string;
}): string;
export interface OAuthTokenResponse {
    access_token: string;
    id_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
}
export declare function exchangeAuthorizationCode(params: {
    domain: string;
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
    clientSecret?: string;
}): Promise<OAuthTokenResponse>;
/** Best-effort username from Cognito id_token (no signature verify — display only). */
export declare function usernameFromIdToken(idToken: string | undefined): string | undefined;
