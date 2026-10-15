/** Sentinel in source identity files; replaced from z_* PLUGIN_NAME at stamp. */
export declare const PLUGIN_NAME_PLACEHOLDER = "__PLUGIN_NAME__";
/**
 * Product identity. Source of truth: PLUGIN_NAME env, else package manifests
 * (plugin.json / deploy.json / package.json bin), else install-folder basename
 * (never a bare semver dir like `0.1.0`), else z_* defaults.
 * Never a hardcoded "hireko" product string.
 */
export declare function productName(): string;
export declare function isPlaceholder(name: string): boolean;
/** User-facing hint: sign in via the slash command, not a terminal CLI. */
export declare function signInHint(): string;
