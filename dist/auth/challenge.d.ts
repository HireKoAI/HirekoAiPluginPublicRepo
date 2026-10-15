import type { CognitoApi, CognitoAuthResult, CognitoChallengeResult } from "./cognito.js";
import { type ChallengeResolver } from "./types.js";
/**
 * Walk Cognito's challenge loop (spec §13). Each round asks the resolver for
 * challenge responses; stops when Cognito returns tokens or the resolver
 * aborts. Unsupported challenges throw a descriptive AuthChallengeError.
 */
export declare function runChallengeLoop(opts: {
    api: CognitoApi;
    clientId: string;
    username: string;
    resolver: ChallengeResolver;
    initialChallenge: CognitoChallengeResult;
    /** Extra responses merged into the first round (e.g. SECRET_HASH). */
    extraResponses?: Record<string, string>;
}): Promise<CognitoAuthResult>;
/** Resolver that rejects every challenge — used for non-interactive paths. */
export declare const noChallengeResolver: ChallengeResolver;
