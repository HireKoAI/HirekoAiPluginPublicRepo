import { readFile, rename, writeFile } from "node:fs/promises";
import { ConfigSchema } from "./schema.js";
/**
 * Atomic, validated config mutation (same safety rule as reload, spec §25):
 * read → mutate → validate → only then rename over the file. A failing
 * validation never touches the on-disk config.
 */
export async function updateConfigFile(path, mutate) {
    const current = JSON.parse(await readFile(path, "utf8"));
    const next = mutate(structuredClone(current));
    const parsed = ConfigSchema.parse(next); // throws ⇒ file stays untouched
    const tmp = `${path}.tmp`;
    await writeFile(tmp, JSON.stringify(next, null, 2) + "\n");
    await rename(tmp, path);
    return parsed;
}
//# sourceMappingURL=writer.js.map