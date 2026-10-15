import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { packageRoot as resolvePackageRoot } from "./util/pkg-root.js";
/** Sentinel in source identity files; replaced from z_* PLUGIN_NAME at stamp. */
export const PLUGIN_NAME_PLACEHOLDER = "__PLUGIN_NAME__";
/** Claude/Codex/Cursor marketplace cache nests the plugin under a version folder (e.g. `0.1.0`). */
const SEMVER_DIR = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
/**
 * Product identity. Source of truth: PLUGIN_NAME env, else package manifests
 * (plugin.json / deploy.json / package.json bin), else install-folder basename
 * (never a bare semver dir like `0.1.0`), else z_* defaults.
 * Never a hardcoded "hireko" product string.
 */
export function productName() {
    const fromEnv = process.env.PLUGIN_NAME?.trim();
    if (fromEnv && !isPlaceholder(fromEnv))
        return fromEnv;
    const root = packageRoot();
    // Manifests first — versioned marketplace caches are named `0.1.0`, not the product.
    const fromManifest = readManifestPluginName(root);
    if (fromManifest && !isPlaceholder(fromManifest))
        return fromManifest;
    const fromDir = usableDirName(root);
    if (fromDir)
        return fromDir;
    const fromZ = readZSetupPluginName(root);
    if (fromZ && !isPlaceholder(fromZ))
        return fromZ;
    const argv = basename(process.argv[1] ?? "");
    if (argv && argv !== "index.js" && !isPlaceholder(argv))
        return argv;
    return "plugin";
}
export function isPlaceholder(name) {
    return name === PLUGIN_NAME_PLACEHOLDER || name.length === 0;
}
/** User-facing hint: sign in via the slash command, not a terminal CLI. */
export function signInHint() {
    return `type /${productName()} (tabs: tenantname, username, password)`;
}
function packageRoot() {
    try {
        return resolvePackageRoot();
    }
    catch {
        return process.cwd();
    }
}
function usableDirName(root) {
    const base = basename(root);
    if (!base || base === "plugin" || isPlaceholder(base) || SEMVER_DIR.test(base)) {
        // `.../<PluginName>/0.1.0` → try parent folder name.
        const parent = dirname(root);
        const parentBase = basename(parent);
        if (parentBase &&
            parentBase !== "plugin" &&
            !isPlaceholder(parentBase) &&
            !SEMVER_DIR.test(parentBase) &&
            (existsSync(join(root, "plugin.json")) || existsSync(join(parent, "plugin.json")))) {
            return parentBase;
        }
        return undefined;
    }
    if (!existsSync(join(root, "plugin.json")))
        return undefined;
    return base;
}
function readManifestPluginName(root) {
    for (const rel of ["plugin.json", ".cursor-plugin/plugin.json", ".codex-plugin/plugin.json", ".claude-plugin/plugin.json"]) {
        try {
            const path = join(root, rel);
            if (!existsSync(path))
                continue;
            const name = JSON.parse(readFileSync(path, "utf8")).name?.trim();
            if (name && !isPlaceholder(name) && !SEMVER_DIR.test(name))
                return name;
        }
        catch {
            /* unreadable */
        }
    }
    try {
        const deployPath = join(root, "deploy.json");
        if (existsSync(deployPath)) {
            const name = JSON.parse(readFileSync(deployPath, "utf8")).pluginName?.trim();
            if (name && !isPlaceholder(name) && !SEMVER_DIR.test(name))
                return name;
        }
    }
    catch {
        /* unreadable */
    }
    return readBinKey(root);
}
function readBinKey(root) {
    try {
        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
        if (pkg.bin && typeof pkg.bin === "object") {
            const key = Object.keys(pkg.bin)[0];
            if (key && !SEMVER_DIR.test(key))
                return key;
        }
        if (typeof pkg.bin === "string" && pkg.name) {
            const short = pkg.name.replace(/^@[^/]+\//, "");
            if (short && !SEMVER_DIR.test(short))
                return short;
        }
    }
    catch {
        /* missing package.json */
    }
    return undefined;
}
/** Read `PLUGIN_NAME="${PLUGIN_NAME:-...}"` from z_setup_deploy_{beta,prod}.sh. */
function readZSetupPluginName(root) {
    for (const file of ["z_setup_deploy_beta.sh", "z_setup_deploy_prod.sh"]) {
        const path = join(root, file);
        if (!existsSync(path))
            continue;
        try {
            const text = readFileSync(path, "utf8");
            const m = /^PLUGIN_NAME="\$\{PLUGIN_NAME:-([^}]+)\}"/m.exec(text);
            if (m?.[1] && !SEMVER_DIR.test(m[1]))
                return m[1];
        }
        catch {
            /* unreadable */
        }
    }
    return undefined;
}
//# sourceMappingURL=product-name.js.map