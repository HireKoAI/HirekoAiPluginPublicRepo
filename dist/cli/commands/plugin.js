import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createHash } from "node:crypto";
import { pluginsDir } from "../../config/paths.js";
import { productName } from "../../product-name.js";
export async function pluginInstallCommand(s3Uri, opts) {
    const match = /^s3:\/\/([^/]+)\/(.+)$/.exec(s3Uri);
    if (!match) {
        console.error("✗ expected an s3://bucket/key URI");
        process.exitCode = 1;
        return;
    }
    const bucket = match[1];
    const key = match[2];
    const profile = opts.profile ?? process.env.AWS_PROFILE ?? resolveProfile();
    const tmp = mkdtempSync(join(homedir(), ".hireko-plugin-dl-"));
    const zipPath = join(tmp, basename(key));
    const shaPath = join(tmp, `${basename(key)}.sha256`);
    console.log(`==> Fetching ${s3Uri} (SigV4, profile: ${profile})`);
    aws(["s3", "cp", s3Uri, zipPath, "--profile", profile]);
    try {
        aws(["s3", "cp", `${s3Uri}.sha256`, shaPath, "--profile", profile]);
        const expected = readFileSync(shaPath, "utf8").trim().split(/\s+/)[0];
        const actual = createHash("sha256").update(readFileSync(zipPath)).digest("hex");
        if (expected && expected !== actual) {
            throw new Error(`checksum mismatch:\n  expected ${expected}\n  actual   ${actual}`);
        }
        console.log("  ✓ checksum verified");
    }
    catch (err) {
        if (err.message.includes("checksum mismatch"))
            throw err;
        console.log("  (no sha256 sidecar found — skipping verification)");
    }
    const destName = basename(key).replace(/-\d+\.\d+\.\d+\.zip$/i, "").replace(/\.zip$/i, "");
    const dest = join(pluginsDir(), destName);
    console.log(`==> Unpacking to ${dest}`);
    rmSync(dest, { recursive: true, force: true });
    const unz = spawnSync("unzip", ["-q", zipPath, "-d", dest]);
    if (unz.status !== 0) {
        const ditto = spawnSync("ditto", ["-x", "-k", zipPath, dest]);
        if (ditto.status !== 0)
            throw new Error("could not unpack the plugin zip (need unzip or ditto)");
    }
    const pluginRoot = findPluginRoot(dest);
    if (!pluginRoot)
        throw new Error("zip does not contain a plugin.json — not an agent plugin");
    const manifest = JSON.parse(readFileSync(join(pluginRoot, "plugin.json"), "utf8"));
    console.log(`  ✓ plugin "${manifest.name}" v${manifest.version}`);
    // The zip ships a prebuilt dist/ (see package.json "files"), so the end user
    // never needs the devDeps that `prepare`/`build` (tsc) require. npm runs
    // `prepare` even for a local-folder global install and ignores
    // --ignore-scripts for it, so strip those scripts from the unpacked manifest
    // before installing. dist/ is already what a build would produce.
    stripBuildScripts(join(pluginRoot, "package.json"));
    // Populate runtime deps IN the unpacked dir first. `npm install -g <folder>`
    // symlinks the package, so Node resolves imports (commander, zod, the MCP
    // SDK, …) from <pluginRoot>/node_modules — which must exist. --omit=dev keeps
    // it to runtime deps (all pure-JS here); --ignore-scripts because there is
    // nothing to build. Then the global install just links the bin.
    console.log("==> Fetching runtime dependencies (npm install --omit=dev)");
    run("npm", ["install", "--omit=dev", "--ignore-scripts", "--prefix", pluginRoot]);
    console.log("==> Installing (npm install -g; dist/ ships prebuilt, build skipped)");
    run("npm", ["install", "-g", pluginRoot]);
    if (!opts.noRegister)
        registerWithHosts();
    rmSync(tmp, { recursive: true, force: true });
    console.log(`\n✓ ${selfName()} installed. Restart the harness, type /${selfName()}`);
    console.log("    tabs: tenantname, username, password — Enter signs in.");
}
/* ------------------------------ internals ------------------------------ */
/**
 * Remove the build-time lifecycle scripts from the unpacked package.json.
 * The distributed zip carries a prebuilt dist/; `prepare`/`build` only exist
 * for the dev checkout and need devDeps (tsc, esbuild) the end user lacks.
 */
function stripBuildScripts(pkgPath) {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
    if (!pkg.scripts)
        return;
    delete pkg.scripts.prepare;
    delete pkg.scripts.build;
    writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}
/**
 * Which account does the terminal talk to? Not discovered — DECLARED.
 * `infra/provider_login.sh` (same taxonomy as MultiTenantClientAuthLib)
 * self-configures a folder-named SSO profile with the repo's EXPECTED_ACCOUNT
 * constant, discovers+caches the granted role once, logs in, and ASSERTS the
 * resolved account matches. We just take the profile name it prints.
 */
function resolveProfile() {
    const lib = findSsoLib();
    if (!lib) {
        throw new Error("no AWS profile given and infra/provider_login.sh not found; pass --profile or install from the plugin checkout");
    }
    // Operational values live ONLY in z_* files. The installer reads the
    // account default out of the shipped z_setup_deploy_beta.sh (env wins);
    // nothing is re-declared here.
    const pluginRoot = dirname(dirname(lib));
    const account = process.env.EXPECTED_ACCOUNT ??
        stageDefault(join(pluginRoot, "z_setup_deploy_beta.sh"), "BETA_AWS_ACCOUNT_ID") ??
        stageDefault(join(process.cwd(), "z_setup_deploy_beta.sh"), "BETA_AWS_ACCOUNT_ID");
    if (!account) {
        throw new Error("EXPECTED_ACCOUNT not set and no z_setup_deploy_beta.sh found to read it from");
    }
    const out = execFileSync("bash", ["-c", `export EXPECTED_ACCOUNT="${account}"; source "${lib}" && sso_ensure`], { encoding: "utf8", stdio: ["inherit", "pipe", "inherit"] });
    const profile = out.trim().split("\n").at(-1)?.trim();
    if (!profile)
        throw new Error("provider_login.sh did not return a profile name");
    return profile;
}
/** Parse `KEY="${KEY:-default}"` out of a z_* values file without running it. */
function stageDefault(file, key) {
    try {
        const m = new RegExp(`\\$\\{${key}:-([0-9A-Za-z._-]+)\\}`).exec(readFileSync(file, "utf8"));
        return m?.[1];
    }
    catch {
        return undefined;
    }
}
function findSsoLib() {
    const candidates = [
        process.env.HIREKO_PLUGIN_LIB,
        join(process.cwd(), "infra", "provider_login.sh"),
        join(pluginsDir(), selfName(), "infra", "provider_login.sh"),
    ];
    try {
        for (const entry of readdirSync(pluginsDir(), { withFileTypes: true })) {
            if (entry.isDirectory()) {
                candidates.push(join(pluginsDir(), entry.name, "infra", "provider_login.sh"));
            }
        }
    }
    catch {
        /* no plugins dir yet */
    }
    // Global npm install location, when present.
    const npmRoot = spawnSync("npm", ["root", "-g"], { encoding: "utf8" }).stdout.trim();
    if (npmRoot)
        candidates.push(join(npmRoot, "@hireko", "mcp-router", "infra", "provider_login.sh"));
    return candidates.find((c) => c !== undefined && c !== "" && existsSync(c));
}
function findPluginRoot(from) {
    if (existsSync(join(from, "plugin.json")))
        return from;
    for (const entry of readdirSync(from, { withFileTypes: true })) {
        if (entry.isDirectory() && existsSync(join(from, entry.name, "plugin.json")))
            return join(from, entry.name);
    }
    return undefined;
}
function selfName() {
    return productName();
}
function registerWithHosts() {
    const name = selfName();
    // Claude: native plugin install owns MCP (.mcp.json in the plugin). Do not
    // also `claude mcp add` — that duplicates the server and confuses Claude.
    if (commandExists("claude")) {
        console.log(`  Claude Code: use plugin ${name}@${name} (MCP comes with the plugin)`);
    }
    registerCodex(name);
}
function registerCodex(name) {
    const codexHome = join(homedir(), ".codex");
    if (!existsSync(codexHome)) {
        console.log(`  Codex not installed; when it is, add:\n    [mcp_servers.${name}]\n    command = "${name}"\n    args = ["serve"]`);
        return;
    }
    const configPath = join(codexHome, "config.toml");
    const existing = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    if (existing.includes(`[mcp_servers.${name}]`)) {
        console.log(`  ✓ Codex already has the ${name} MCP server`);
        return;
    }
    const block = `${existing && !existing.endsWith("\n") ? "\n" : ""}\n[mcp_servers.${name}]\ncommand = "${name}"\nargs = ["serve"]\n`;
    writeFileSync(configPath, existing + block);
    console.log(`  ✓ registered with Codex (${configPath})`);
}
function aws(args) {
    run("aws", args);
}
function run(cmd, args) {
    const res = spawnSync(cmd, args, { stdio: "inherit" });
    if (res.status !== 0)
        throw new Error(`${cmd} ${args[0]} failed (exit ${res.status})`);
}
function commandExists(cmd) {
    return spawnSync("which", [cmd], { stdio: "ignore" }).status === 0;
}
//# sourceMappingURL=plugin.js.map