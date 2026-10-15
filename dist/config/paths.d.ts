/**
 * Per-plugin runtime home: credentials, cache, run, config.
 * Default: `~/.<productName>` (folder/plugin name — not a company-generic `.hireko`).
 * `HIREKO_HOME` forces a root (tests use a temp dir).
 */
export declare function productHome(): string;
/**
 * @deprecated Prefer {@link productHome} for runtime state. Alias kept for callers.
 */
export declare function hirekoHome(): string;
/**
 * Shared company install root for plugin unpack (`plugins/<Name>`).
 * Stays `~/.hireko` so many Hireko MCP plugins can coexist; not used for credentials.
 */
export declare function companyHome(): string;
/** Legacy pre-rename runtime root (`~/.hireko`) — used for one-shot migration. */
export declare function legacyCompanyRuntimeHome(): string;
/** Default config lookup order (spec §10). Explicit `--config` wins over both. */
export declare function defaultConfigCandidates(): string[];
export declare function credentialsDir(): string;
/** Pre-rename credentials dir (`~/.hireko/credentials`). */
export declare function legacyCredentialsDir(): string;
export declare function cacheDir(): string;
export declare function catalogCachePath(): string;
export declare function runDir(): string;
export declare function pluginsDir(): string;
export declare function pidFilePath(): string;
/** Live-serve descriptor: { pid, port, secret } — mode 0600, localhost control. */
export declare function serveInfoPath(): string;
/**
 * Port of this process's control /human console (serve.json written by serve).
 * Ignores stale files from other PIDs.
 */
export declare function readServePort(): number | null;
