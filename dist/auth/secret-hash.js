import { createHmac } from "node:crypto";
/**
 * Cognito SECRET_HASH (required when the app client has a secret):
 * Base64(HMAC-SHA256(clientSecret, username + clientId)).
 */
export function cognitoSecretHash(clientSecret, username, clientId) {
    return createHmac("sha256", clientSecret).update(username + clientId).digest("base64");
}
//# sourceMappingURL=secret-hash.js.map