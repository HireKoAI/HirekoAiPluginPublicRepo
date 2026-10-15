/**
 * Terminal prompts for `login` (spec §12, §15). Passwords are never
 * echoed, never logged, and never written anywhere but Cognito's request.
 */
export declare function promptLine(query: string): Promise<string>;
/** Read a secret without echoing. Falls back to piped stdin when not a TTY. */
export declare function promptHidden(query: string): Promise<string>;
