import { signInHint } from "../product-name.js";
export class NotAuthenticatedError extends Error {
    constructor(message = `not authenticated; ${signInHint()}`) {
        super(message);
        this.name = "NotAuthenticatedError";
    }
}
export class AuthChallengeError extends Error {
    challengeName;
    constructor(challengeName, message) {
        super(message);
        this.challengeName = challengeName;
        this.name = "AuthChallengeError";
    }
}
//# sourceMappingURL=types.js.map