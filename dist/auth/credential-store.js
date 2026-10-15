import { mkdir, readFile, writeFile, unlink, chmod } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { platform } from "node:os";
import { credentialsDir, legacyCredentialsDir, productHome } from "../config/paths.js";
import { productName } from "../product-name.js";
import { preferFileCredentialStore } from "../util/runtime-env.js";
import { ENV_CREDENTIAL_STORE } from "./constants.js";
const execFileAsync = promisify(execFile);
/* ------------------------------------------------------------------ */
/* File-backed fallback (documented local dev fallback, spec §15)      */
/* ------------------------------------------------------------------ */
export class FileCredentialStore {
    dir;
    constructor(dir) {
        this.dir = dir ?? credentialsDir();
    }
    fileFor(tenant, dir = this.dir) {
        const safe = tenant.replace(/[^a-zA-Z0-9._-]/g, "_");
        return join(dir, `${safe}.json`);
    }
    async load(tenant) {
        const primary = await this.readFile(this.fileFor(tenant));
        if (primary)
            return primary;
        // One-shot migrate from ~/.hireko/credentials when using the default product dir.
        if (this.dir !== credentialsDir())
            return undefined;
        const legacyDir = legacyCredentialsDir();
        if (legacyDir === this.dir)
            return undefined;
        const legacy = await this.readFile(this.fileFor(tenant, legacyDir));
        if (!legacy)
            return undefined;
        await this.save(tenant, legacy);
        await unlink(this.fileFor(tenant, legacyDir)).catch(() => { });
        return legacy;
    }
    async readFile(path) {
        try {
            const raw = await readFile(path, "utf8");
            return JSON.parse(raw);
        }
        catch {
            return undefined;
        }
    }
    async save(tenant, session) {
        await mkdir(this.dir, { recursive: true, mode: 0o700 });
        const file = this.fileFor(tenant);
        await writeFile(file, JSON.stringify(session), { mode: 0o600 });
        await chmod(file, 0o600).catch(() => { });
    }
    async clear(tenant) {
        await unlink(this.fileFor(tenant)).catch(() => { });
        if (this.dir === credentialsDir()) {
            const legacyDir = legacyCredentialsDir();
            if (legacyDir !== this.dir) {
                await unlink(this.fileFor(tenant, legacyDir)).catch(() => { });
            }
        }
    }
    describe() {
        return `file (${this.dir}, mode 0600, product=${productName()}, home=${productHome()})`;
    }
}
/* ------------------------------------------------------------------ */
/* OS-native secure storage (spec §15): Keychain / Secret Service      */
/* ------------------------------------------------------------------ */
/**
 * Keychain / Secret Service "service" id = plugin folder name
 * (e.g. HirekoOpenPlugin). Not a company-wide "hireko-*" string —
 * Hireko ships many MCP servers; each plugin must use its own identity.
 */
function credentialServiceName() {
    return productName();
}
/** Pre-rename service id; load migrates into productName() then clears. */
const LEGACY_CREDENTIAL_SERVICE = "hireko-mcp-router";
export class SecretServiceCredentialStore {
    backend;
    constructor(backend) {
        this.backend = backend;
    }
    account(tenant) {
        return `tenant:${tenant}`;
    }
    service() {
        return credentialServiceName();
    }
    async load(tenant) {
        const current = await this.loadFromService(this.service(), tenant);
        if (current)
            return current;
        // One-shot migration from the old company-generic service name.
        if (this.service() === LEGACY_CREDENTIAL_SERVICE)
            return undefined;
        const legacy = await this.loadFromService(LEGACY_CREDENTIAL_SERVICE, tenant);
        if (!legacy)
            return undefined;
        await this.save(tenant, legacy);
        await this.clearFromService(LEGACY_CREDENTIAL_SERVICE, tenant);
        return legacy;
    }
    async loadFromService(service, tenant) {
        try {
            if (this.backend === "macos-keychain") {
                const { stdout } = await execFileAsync("security", [
                    "find-generic-password",
                    "-a",
                    this.account(tenant),
                    "-s",
                    service,
                    "-w",
                ]);
                return JSON.parse(stdout.trim());
            }
            const { stdout } = await execFileAsync("secret-tool", [
                "lookup",
                "service",
                service,
                "tenant",
                tenant,
            ]);
            if (!stdout.trim())
                return undefined;
            return JSON.parse(stdout.trim());
        }
        catch {
            return undefined;
        }
    }
    async save(tenant, session) {
        const service = this.service();
        const payload = JSON.stringify(session);
        if (this.backend === "macos-keychain") {
            await execFileAsync("security", [
                "add-generic-password",
                "-U",
                "-a",
                this.account(tenant),
                "-s",
                service,
                "-w",
                payload,
            ]);
            return;
        }
        // secret-tool reads the secret from stdin.
        const child = execFileAsync("secret-tool", [
            "store",
            "--label",
            `${service} ${tenant}`,
            "service",
            service,
            "tenant",
            tenant,
        ]);
        child.child.stdin?.write(payload);
        child.child.stdin?.end();
        await child;
    }
    async clear(tenant) {
        await this.clearFromService(this.service(), tenant);
        // Also drop any leftover legacy entry so logout is complete.
        if (this.service() !== LEGACY_CREDENTIAL_SERVICE) {
            await this.clearFromService(LEGACY_CREDENTIAL_SERVICE, tenant);
        }
    }
    async clearFromService(service, tenant) {
        try {
            if (this.backend === "macos-keychain") {
                await execFileAsync("security", [
                    "delete-generic-password",
                    "-a",
                    this.account(tenant),
                    "-s",
                    service,
                ]);
            }
            else {
                await execFileAsync("secret-tool", ["clear", "service", service, "tenant", tenant]);
            }
        }
        catch {
            // Already gone — fine.
        }
    }
    describe() {
        const svc = this.service();
        return this.backend === "macos-keychain"
            ? `macOS Keychain (service=${svc})`
            : `Secret Service (libsecret, service=${svc})`;
    }
}
/* ------------------------------------------------------------------ */
/* Selection                                                           */
/* ------------------------------------------------------------------ */
async function commandExists(cmd) {
    // Minimal Amazon Linux / Alpine images may lack `which`; try both.
    const probes = process.platform === "win32"
        ? [{ bin: "where", args: [cmd] }]
        : [
            { bin: "which", args: [cmd] },
            { bin: "sh", args: ["-c", `command -v ${shellQuote(cmd)} >/dev/null 2>&1`] },
        ];
    for (const { bin, args } of probes) {
        try {
            await execFileAsync(bin, args);
            return true;
        }
        catch {
            /* try next */
        }
    }
    return false;
}
function shellQuote(s) {
    return `'${s.replace(/'/g, `'\\''`)}'`;
}
/**
 * Prefer OS-native secure storage, fall back to the user-only file store
 * (spec §15). HIREKO_CREDENTIAL_STORE forces a backend:
 * `keychain` | `secret-service` | `file`.
 *
 * Containers / headless Linux (Lightsail Docker, Hermes servers) default to
 * file — libsecret usually has no D-Bus session there.
 */
export async function createDefaultCredentialStore() {
    const forced = process.env[ENV_CREDENTIAL_STORE];
    if (forced === "file")
        return new FileCredentialStore();
    if (forced === "keychain")
        return new SecretServiceCredentialStore("macos-keychain");
    if (forced === "secret-service")
        return new SecretServiceCredentialStore("linux-secret-service");
    if (preferFileCredentialStore()) {
        return new FileCredentialStore();
    }
    if (platform() === "darwin" && (await commandExists("security"))) {
        return new SecretServiceCredentialStore("macos-keychain");
    }
    if (platform() === "linux" && (await commandExists("secret-tool"))) {
        return new SecretServiceCredentialStore("linux-secret-service");
    }
    return new FileCredentialStore();
}
//# sourceMappingURL=credential-store.js.map