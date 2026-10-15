import { AuthChallengeError } from "./types.js";
import { signInHint } from "../product-name.js";
const MAX_CHALLENGE_ROUNDS = 5;
/**
 * Walk Cognito's challenge loop (spec §13). Each round asks the resolver for
 * challenge responses; stops when Cognito returns tokens or the resolver
 * aborts. Unsupported challenges throw a descriptive AuthChallengeError.
 */
export async function runChallengeLoop(opts) {
    let challenge = opts.initialChallenge;
    let round = 0;
    for (;;) {
        round += 1;
        if (round > MAX_CHALLENGE_ROUNDS) {
            throw new AuthChallengeError(challenge.challengeName, "too many auth challenge rounds");
        }
        const responses = await opts.resolver.resolve({
            challengeName: challenge.challengeName,
            session: challenge.session,
            parameters: challenge.parameters,
            username: opts.username,
        });
        if (responses === null) {
            throw new AuthChallengeError(challenge.challengeName, `login aborted at challenge ${challenge.challengeName}`);
        }
        // Cognito requires USERNAME in most challenge responses.
        const merged = {
            USERNAME: opts.username,
            ...(round === 1 ? opts.extraResponses ?? {} : {}),
            ...responses,
        };
        const result = await opts.api.respondToAuthChallenge({
            clientId: opts.clientId,
            challengeName: challenge.challengeName,
            session: challenge.session,
            challengeResponses: merged,
        });
        if (result.kind === "tokens")
            return result;
        challenge = result.challenge;
    }
}
/** Resolver that rejects every challenge — used for non-interactive paths. */
export const noChallengeResolver = {
    resolve: async (c) => {
        throw new AuthChallengeError(c.challengeName, `Cognito returned challenge ${c.challengeName}; interactive resolution is not available in this context. ${signInHint()}.`);
    },
};
//# sourceMappingURL=challenge.js.map