import { CognitoIdentityProviderClient, InitiateAuthCommand, RespondToAuthChallengeCommand, RevokeTokenCommand, GlobalSignOutCommand, } from "@aws-sdk/client-cognito-identity-provider";
/** Real AWS SDK v3 adapter (spec §13). */
export class SdkCognitoApi {
    config;
    client;
    constructor(config) {
        this.config = config;
        this.client = new CognitoIdentityProviderClient({ region: config.region });
    }
    async initiateAuth(params) {
        const out = await this.client.send(new InitiateAuthCommand({
            AuthFlow: params.authFlow,
            ClientId: params.clientId,
            AuthParameters: params.authParameters,
        }));
        return toResult(out.ChallengeName, out.Session, out.ChallengeParameters, out.AuthenticationResult);
    }
    async respondToAuthChallenge(params) {
        const out = await this.client.send(new RespondToAuthChallengeCommand({
            ClientId: params.clientId,
            ChallengeName: params.challengeName,
            Session: params.session,
            ChallengeResponses: params.challengeResponses,
        }));
        return toResult(out.ChallengeName, out.Session, out.ChallengeParameters, out.AuthenticationResult);
    }
    async revokeToken(params) {
        await this.client.send(new RevokeTokenCommand({
            ClientId: params.clientId,
            ClientSecret: params.clientSecret,
            Token: params.refreshToken,
        }));
    }
    async globalSignOut(params) {
        await this.client.send(new GlobalSignOutCommand({ AccessToken: params.accessToken }));
    }
}
function toResult(challengeName, session, challengeParameters, authResult) {
    if (challengeName) {
        return {
            kind: "challenge",
            challenge: { challengeName, session, parameters: challengeParameters },
        };
    }
    return {
        kind: "tokens",
        tokens: {
            accessToken: authResult?.AccessToken,
            idToken: authResult?.IdToken,
            refreshToken: authResult?.RefreshToken,
            expiresInSec: authResult?.ExpiresIn,
            tokenType: authResult?.TokenType,
        },
    };
}
//# sourceMappingURL=cognito.js.map