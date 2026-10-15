import { signInHint } from "../product-name.js";
import { SingleFlight } from "../util/async.js";
import { tokenFingerprint } from "../util/redact.js";
import { runChallengeLoop } from "./challenge.js";
import { cognitoSecretHash } from "./secret-hash.js";
import { NotAuthenticatedError, } from "./types.js";
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
export class TokenManager {
    opts;
    session;
    refreshFlight = new SingleFlight();
    loaded = false;
    loadFlight;
    now;
    constructor(opts) {
        this.opts = opts;
        this.now = opts.now ?? Date.now;
    }
    get cognito() {
        return this.opts.cognito;
    }
    /**
     * Lazily load a persisted session once. Single-flighted: concurrent first
     * callers (e.g. several downstream discoveries racing for a token) all
     * await the same load instead of observing a half-initialized session.
     */
    async ensureLoaded() {
        if (this.loaded)
            return;
        if (!this.loadFlight)
            this.loadFlight = this.doLoad();
        return this.loadFlight;
    }
    async doLoad() {
        try {
            const stored = await this.opts.store.load(this.opts.tenant);
            if (stored)
                this.session = { ...stored, tenant: this.opts.tenant };
        }
        finally {
            this.loaded = true;
            this.loadFlight = undefined;
        }
    }
    async login(input, resolver) {
        const { cognito } = this;
        const authParameters = {
            USERNAME: input.username,
            PASSWORD: input.password,
        };
        if (cognito.clientSecret) {
            authParameters.SECRET_HASH = cognitoSecretHash(cognito.clientSecret, input.username, cognito.clientId);
        }
        let result = await this.opts.api.initiateAuth({
            authFlow: "USER_PASSWORD_AUTH",
            clientId: cognito.clientId,
            authParameters,
        });
        if (result.kind === "challenge") {
            if (!resolver) {
                throw new NotAuthenticatedError(`Cognito returned challenge ${result.challenge.challengeName}; ${signInHint()}`);
            }
            result = await runChallengeLoop({
                api: this.opts.api,
                clientId: cognito.clientId,
                username: input.username,
                resolver,
                initialChallenge: result.challenge,
                extraResponses: cognito.clientSecret
                    ? { SECRET_HASH: cognitoSecretHash(cognito.clientSecret, input.username, cognito.clientId) }
                    : undefined,
            });
        }
        if (result.kind !== "tokens" || !result.tokens.accessToken) {
            throw new Error("Cognito login succeeded but returned no access token");
        }
        // The password has served its purpose; drop every reference we control.
        const session = this.toSession(result.tokens, input.username);
        this.session = session;
        await this.opts.store.save(this.opts.tenant, session);
        this.opts.logger.info("login successful", {
            tenant: this.opts.tenant,
            username: input.username,
            token: session.accessToken ? tokenFingerprint(session.accessToken) : undefined,
        });
        return session;
    }
    async getAccessToken() {
        await this.ensureLoaded();
        const session = this.session;
        if (!session)
            throw new NotAuthenticatedError();
        const token = this.forwardedToken(session);
        if (!token)
            throw new NotAuthenticatedError(`session has no usable token; ${signInHint()}`);
        const expiresIn = session.expiresAt !== undefined ? session.expiresAt - this.now() : Number.POSITIVE_INFINITY;
        const windowMs = this.cognito.refreshSafetyWindowSec * 1000;
        if (expiresIn > windowMs)
            return token;
        if (!session.refreshToken) {
            throw new NotAuthenticatedError(`token expired and no refresh token is available; ${signInHint()}`);
        }
        const refreshed = await this.refresh();
        const next = this.forwardedToken(refreshed);
        if (!next)
            throw new NotAuthenticatedError(`refresh produced no usable token; ${signInHint()}`);
        return next;
    }
    /**
     * Like getAccessToken() but for a specific token kind, regardless of
     * tokenToForward. Used by header templates (${ACCESS_TOKEN}/${ID_TOKEN}).
     */
    async getToken(kind) {
        await this.ensureLoaded();
        const session = this.session;
        if (!session)
            throw new NotAuthenticatedError();
        const pick = (s) => (kind === "id" ? s.idToken : s.accessToken);
        const token = pick(session);
        if (!token)
            throw new NotAuthenticatedError(`session has no ${kind} token; ${signInHint()}`);
        const expiresIn = session.expiresAt !== undefined ? session.expiresAt - this.now() : Number.POSITIVE_INFINITY;
        if (expiresIn > this.cognito.refreshSafetyWindowSec * 1000)
            return token;
        if (!session.refreshToken) {
            throw new NotAuthenticatedError(`token expired and no refresh token is available; ${signInHint()}`);
        }
        const refreshed = await this.refresh();
        const next = pick(refreshed);
        if (!next)
            throw new NotAuthenticatedError(`refresh produced no ${kind} token; ${signInHint()}`);
        return next;
    }
    async refresh() {
        await this.ensureLoaded();
        return this.refreshFlight.run(async () => {
            const current = this.session;
            if (!current?.refreshToken) {
                throw new NotAuthenticatedError(`no refresh token; ${signInHint()}`);
            }
            const { cognito } = this;
            const authParameters = {
                REFRESH_TOKEN: current.refreshToken,
            };
            if (cognito.clientSecret) {
                authParameters.SECRET_HASH = cognitoSecretHash(cognito.clientSecret, current.username, cognito.clientId);
            }
            let result;
            try {
                result = await this.opts.api.initiateAuth({
                    authFlow: "REFRESH_TOKEN_AUTH",
                    clientId: cognito.clientId,
                    authParameters,
                });
            }
            catch (err) {
                // Revoked/invalid refresh tokens must surface as "log in again",
                // never as a raw AWS SDK stack.
                const awsName = err?.name;
                const awsMsg = err instanceof Error ? err.message : String(err);
                this.opts.logger.warn("token refresh rejected", {
                    tenant: this.opts.tenant,
                    errorCode: awsName,
                    error: awsMsg,
                });
                // Only wipe the session for definitive auth failures — keep tokens on
                // transient/misconfig errors so the user can recover without re-login.
                const wipe = awsName === "NotAuthorizedException" ||
                    awsName === "UserNotFoundException" ||
                    /refresh token has been revoked|Invalid Refresh Token|NotAuthorized/i.test(awsMsg);
                if (wipe) {
                    this.session = undefined;
                    await this.opts.store.clear(this.opts.tenant).catch(() => { });
                }
                throw new NotAuthenticatedError(`token refresh failed; ${signInHint()}`);
            }
            if (result.kind !== "tokens" || !result.tokens.accessToken) {
                this.session = undefined;
                await this.opts.store.clear(this.opts.tenant).catch(() => { });
                throw new NotAuthenticatedError(`token refresh failed; ${signInHint()}`);
            }
            // Refresh-token rotation: when Cognito returns a new refresh token we
            // must persist and use it from now on; otherwise keep the existing one.
            const session = this.toSession({
                ...result.tokens,
                refreshToken: result.tokens.refreshToken ?? current.refreshToken,
            }, current.username, current.authStage);
            this.session = session;
            await this.opts.store.save(this.opts.tenant, session);
            this.opts.logger.info("token refreshed", {
                tenant: this.opts.tenant,
                authRefresh: true,
                rotated: Boolean(result.tokens.refreshToken),
                token: session.accessToken ? tokenFingerprint(session.accessToken) : undefined,
            });
            return session;
        });
    }
    /** Persist a session obtained outside USER_PASSWORD_AUTH (e.g. OAuth PKCE). */
    async absorbSession(session) {
        this.session = { ...session, tenant: this.opts.tenant };
        await this.opts.store.save(this.opts.tenant, this.session);
        this.loaded = true;
        this.opts.logger.info("session stored", {
            tenant: this.opts.tenant,
            username: session.username,
            hasRefresh: Boolean(session.refreshToken),
            token: session.accessToken ? tokenFingerprint(session.accessToken) : undefined,
        });
    }
    async logout() {
        await this.ensureLoaded();
        const current = this.session;
        // Best practice: invalidate at Cognito before dropping local material so a
        // stolen refresh/access copy cannot keep minting tokens after sign-out.
        // GlobalSignOut first (needs a live access token), then RevokeToken on the
        // refresh (covers refresh-token family when Cognito rotation is enabled).
        if (current?.accessToken) {
            try {
                await this.opts.api.globalSignOut({ accessToken: current.accessToken });
                this.opts.logger.info("global sign-out at Cognito", { tenant: this.opts.tenant });
            }
            catch (err) {
                this.opts.logger.warn("Cognito GlobalSignOut failed; will still try RevokeToken / clear local", {
                    tenant: this.opts.tenant,
                    errorCode: err?.name,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        if (current?.refreshToken) {
            try {
                await this.opts.api.revokeToken({
                    clientId: this.cognito.clientId,
                    clientSecret: this.cognito.clientSecret,
                    refreshToken: current.refreshToken,
                });
                this.opts.logger.info("refresh token revoked at Cognito", { tenant: this.opts.tenant });
            }
            catch (err) {
                // May already be dead after GlobalSignOut — non-fatal.
                this.opts.logger.warn("Cognito RevokeToken failed; clearing local session anyway", {
                    tenant: this.opts.tenant,
                    errorCode: err?.name,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        this.session = undefined;
        await this.opts.store.clear(this.opts.tenant);
        this.opts.logger.info("logged out", { tenant: this.opts.tenant });
    }
    async status() {
        await this.ensureLoaded();
        const s = this.session;
        const base = {
            authenticated: false,
            storage: this.opts.store.describe(),
            tokenToForward: this.cognito.tokenToForward,
        };
        if (!s || !this.forwardedToken(s))
            return base;
        return {
            ...base,
            authenticated: true,
            tenant: s.tenant,
            username: s.username,
            expiresAt: s.expiresAt,
            expiresInSec: s.expiresAt !== undefined ? Math.round((s.expiresAt - this.now()) / 1000) : undefined,
        };
    }
    forwardedToken(session) {
        return this.cognito.tokenToForward === "id" ? session.idToken : session.accessToken;
    }
    toSession(tokens, username, authStage) {
        return {
            tenant: this.opts.tenant,
            username,
            accessToken: tokens.accessToken,
            idToken: tokens.idToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresInSec !== undefined ? this.now() + tokens.expiresInSec * 1000 : undefined,
            tokenType: tokens.tokenType,
            authStage,
        };
    }
}
//# sourceMappingURL=token-manager.js.map