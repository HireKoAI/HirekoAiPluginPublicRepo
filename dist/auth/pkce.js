import { createHash, randomBytes } from "node:crypto";
/** RFC 7636 PKCE helpers for Cognito Hosted UI (authorization code + S256). */
export function generateCodeVerifier() {
    return randomBytes(32).toString("base64url");
}
export function codeChallengeS256(verifier) {
    return createHash("sha256").update(verifier).digest("base64url");
}
export function generateOAuthState() {
    return randomBytes(16).toString("base64url");
}
/** `domain` is the Hosted UI hostname without scheme. */
export function cognitoOAuthEndpoints(domain) {
    const host = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
    return {
        authorizeUrl: `https://${host}/oauth2/authorize`,
        tokenUrl: `https://${host}/oauth2/token`,
    };
}
export function buildAuthorizeUrl(params) {
    const { authorizeUrl } = cognitoOAuthEndpoints(params.domain);
    const q = new URLSearchParams({
        response_type: "code",
        client_id: params.clientId,
        redirect_uri: params.redirectUri,
        scope: params.scopes.join(" "),
        state: params.state,
        code_challenge: params.codeChallenge,
        code_challenge_method: "S256",
    });
    return `${authorizeUrl}?${q.toString()}`;
}
export async function exchangeAuthorizationCode(params) {
    const { tokenUrl } = cognitoOAuthEndpoints(params.domain);
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: params.clientId,
        code: params.code,
        redirect_uri: params.redirectUri,
        code_verifier: params.codeVerifier,
    });
    if (params.clientSecret)
        body.set("client_secret", params.clientSecret);
    const res = await fetch(tokenUrl, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Cognito token exchange failed (${res.status}): ${text}`);
    }
    return JSON.parse(text);
}
/** Best-effort username from Cognito id_token (no signature verify — display only). */
export function usernameFromIdToken(idToken) {
    if (!idToken)
        return undefined;
    try {
        const payload = idToken.split(".")[1];
        if (!payload)
            return undefined;
        const json = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
        const email = typeof json.email === "string" ? json.email : undefined;
        const sub = typeof json.sub === "string" ? json.sub : undefined;
        const cognitoUsername = typeof json["cognito:username"] === "string" ? json["cognito:username"] : undefined;
        return email ?? cognitoUsername ?? sub;
    }
    catch {
        return undefined;
    }
}
//# sourceMappingURL=pkce.js.map