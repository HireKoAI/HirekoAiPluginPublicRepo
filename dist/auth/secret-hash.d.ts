/**
 * Cognito SECRET_HASH (required when the app client has a secret):
 * Base64(HMAC-SHA256(clientSecret, username + clientId)).
 */
export declare function cognitoSecretHash(clientSecret: string, username: string, clientId: string): string;
