/**
 * Resolve the package root (the directory containing `package.json`) by walking
 * up from this module's file. Robust to both the tsc layout
 * (`dist/util/pkg-root.js` → repo root) and the esbuild single-file CLI bundle
 * (`dist/cli/index.js` → repo root), and to versioned marketplace cache nesting
 * (`…/<PluginName>/<version>/dist/cli/index.js` → `…/<PluginName>/<version>`).
 *
 * The previous `new URL("../package.json", import.meta.url)` anchor assumed a
 * flat `dist/*.js` layout; bundling the CLI into `dist/cli/` shifts that
 * relative path to `dist/package.json` (absent), so walk up instead.
 */
export declare function packageRoot(): string;
