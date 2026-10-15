import { type AuthFlowType } from "@aws-sdk/client-cognito-identity-provider";
import type { CognitoConfig } from "../config/schema.js";
/**
 * Minimal Cognito surface used by Hireko, behind an interface so tests can
 * inject fakes (spec §31) and a future IdP can replace Cognito entirely.
 */
export interface CognitoTokenResult {
    accessToken?: string;
    idToken?: string;
    refreshToken?: string;
    expiresInSec?: number;
    tokenType?: string;
}
export interface CognitoChallengeResult {
    challengeName: string;
    session?: string;
    parameters?: Record<string, string>;
}
export type CognitoAuthResult = {
    kind: "tokens";
    tokens: CognitoTokenResult;
} | {
    kind: "challenge";
    challenge: CognitoChallengeResult;
};
export interface CognitoApi {
    initiateAuth(params: {
        authFlow: AuthFlowType;
        clientId: string;
        authParameters: Record<string, string>;
    }): Promise<CognitoAuthResult>;
    respondToAuthChallenge(params: {
        clientId: string;
        challengeName: string;
        session?: string;
        challengeResponses: Record<string, string>;
    }): Promise<CognitoAuthResult>;
    /**
     * Revoke a refresh token (and its token family when Cognito rotation is on).
     * Best practice on logout so a stolen refresh cannot mint new access tokens.
     */
    revokeToken(params: {
        clientId: string;
        clientSecret?: string;
        refreshToken: string;
    }): Promise<void>;
    /** Invalidate all tokens issued to this user (requires a still-valid access token). */
    globalSignOut(params: {
        accessToken: string;
    }): Promise<void>;
}
/** Real AWS SDK v3 adapter (spec §13). */
export declare class SdkCognitoApi implements CognitoApi {
    private readonly config;
    private readonly client;
    constructor(config: CognitoConfig);
    initiateAuth(params: {
        authFlow: AuthFlowType;
        clientId: string;
        authParameters: Record<string, string>;
    }): Promise<CognitoAuthResult>;
    respondToAuthChallenge(params: {
        clientId: string;
        challengeName: string;
        session?: string;
        challengeResponses: Record<string, string>;
    }): Promise<CognitoAuthResult>;
    revokeToken(params: {
        clientId: string;
        clientSecret?: string;
        refreshToken: string;
    }): Promise<void>;
    globalSignOut(params: {
        accessToken: string;
    }): Promise<void>;
}
