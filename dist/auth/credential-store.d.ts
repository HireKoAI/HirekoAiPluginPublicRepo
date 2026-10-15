import type { AuthSession } from "./types.js";
/**
 * Persisted session material (tokens only — never passwords, spec §15).
 */
export type StoredSession = AuthSession;
export interface CredentialStore {
    load(tenant: string): Promise<StoredSession | undefined>;
    save(tenant: string, session: StoredSession): Promise<void>;
    clear(tenant: string): Promise<void>;
    /** Human-readable backend name for status output. */
    describe(): string;
}
export declare class FileCredentialStore implements CredentialStore {
    private dir;
    constructor(dir?: string);
    private fileFor;
    load(tenant: string): Promise<StoredSession | undefined>;
    private readFile;
    save(tenant: string, session: StoredSession): Promise<void>;
    clear(tenant: string): Promise<void>;
    describe(): string;
}
export declare class SecretServiceCredentialStore implements CredentialStore {
    private readonly backend;
    constructor(backend: "macos-keychain" | "linux-secret-service");
    private account;
    private service;
    load(tenant: string): Promise<StoredSession | undefined>;
    private loadFromService;
    save(tenant: string, session: StoredSession): Promise<void>;
    clear(tenant: string): Promise<void>;
    private clearFromService;
    describe(): string;
}
/**
 * Prefer OS-native secure storage, fall back to the user-only file store
 * (spec §15). HIREKO_CREDENTIAL_STORE forces a backend:
 * `keychain` | `secret-service` | `file`.
 *
 * Containers / headless Linux (Lightsail Docker, Hermes servers) default to
 * file — libsecret usually has no D-Bus session there.
 */
export declare function createDefaultCredentialStore(): Promise<CredentialStore>;
