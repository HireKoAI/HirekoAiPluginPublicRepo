import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import { ENV_CREDENTIAL_STORE, ENV_IN_CONTAINER, ENV_INTERNAL_API_KEY, } from "../auth/constants.js";
import { isHeadlessEnv } from "../auth/credentials-factory.js";
export { isHeadlessEnv };
/**
 * True when running inside Docker / common container runtimes
 * (Lightsail container service, ECS, local Docker, etc.).
 */
export function isContainerRuntime() {
    if (process.env[ENV_IN_CONTAINER] === "1" || process.env[ENV_IN_CONTAINER] === "true") {
        return true;
    }
    if (existsSync("/.dockerenv"))
        return true;
    try {
        const cgroup = readFileSync("/proc/1/cgroup", "utf8");
        if (/docker|containerd|kubepods|libpod|lxc/i.test(cgroup))
            return true;
    }
    catch {
        /* not Linux or unreadable */
    }
    // Amazon Linux / systemd-nspawn sometimes expose this.
    if (existsSync("/run/.containerenv"))
        return true;
    return false;
}
/** No GUI session — typical for Lightsail / Hermes server containers. */
export function isHeadlessLinux() {
    if (platform() !== "linux")
        return false;
    if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY)
        return false;
    return true;
}
/**
 * Prefer the file credential store: containers rarely have a working
 * libsecret/D-Bus session; Keychain does not exist on Linux.
 */
export function preferFileCredentialStore() {
    const forced = process.env[ENV_CREDENTIAL_STORE]?.trim();
    if (forced === "file")
        return true;
    if (forced === "keychain" || forced === "secret-service")
        return false;
    return isContainerRuntime() || isHeadlessLinux();
}
/** Remote/container note for device-login (loopback is on the MCP host). */
export function remoteDeviceLoginHint() {
    if (!isContainerRuntime() && !isHeadlessLinux())
        return undefined;
    return [
        "This host looks like a container/headless Linux (e.g. Amazon Linux Lightsail Docker).",
        "Device login posts tokens to 127.0.0.1 on THIS machine — a browser on your laptop cannot reach it unless you SSH-tunnel ports 8700-8799.",
        `Prefer MCP/CLI password login here: login { tenant, username, password }, or headless login --apikey / ${ENV_INTERNAL_API_KEY}.`,
        "Or from your laptop: ssh -L 8712:127.0.0.1:8712 <host> then open the printed device-login URL locally.",
    ].join(" ");
}
//# sourceMappingURL=runtime-env.js.map