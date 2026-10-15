import type { AppConfig } from "./schema.js";
/** Human-safe view of the config for `doctor`/`status` output (spec §28). */
export declare function maskConfigForDisplay(config: AppConfig): Record<string, unknown>;
