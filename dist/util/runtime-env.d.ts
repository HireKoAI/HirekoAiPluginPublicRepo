import { isHeadlessEnv } from "../auth/credentials-factory.js";
export { isHeadlessEnv };
/**
 * True when running inside Docker / common container runtimes
 * (Lightsail container service, ECS, local Docker, etc.).
 */
export declare function isContainerRuntime(): boolean;
/** No GUI session — typical for Lightsail / Hermes server containers. */
export declare function isHeadlessLinux(): boolean;
/**
 * Prefer the file credential store: containers rarely have a working
 * libsecret/D-Bus session; Keychain does not exist on Linux.
 */
export declare function preferFileCredentialStore(): boolean;
/** Remote/container note for device-login (loopback is on the MCP host). */
export declare function remoteDeviceLoginHint(): string | undefined;
