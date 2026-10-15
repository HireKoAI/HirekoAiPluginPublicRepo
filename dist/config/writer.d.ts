import { type AppConfig } from "./schema.js";
/**
 * Atomic, validated config mutation (same safety rule as reload, spec §25):
 * read → mutate → validate → only then rename over the file. A failing
 * validation never touches the on-disk config.
 */
export declare function updateConfigFile(path: string, mutate: (raw: Record<string, unknown>) => unknown): Promise<AppConfig>;
