import { type App, type BootstrapOptions } from "../bootstrap.js";
/** Bootstrap → run → always close. Fatal errors exit with code 1. */
export declare function runApp<T>(opts: BootstrapOptions, fn: (app: App) => Promise<T>): Promise<T>;
export declare function printFatal(err: unknown): void;
export declare function formatDuration(seconds: number): string;
