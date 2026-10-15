import * as readline from "node:readline";
/**
 * Terminal prompts for `login` (spec §12, §15). Passwords are never
 * echoed, never logged, and never written anywhere but Cognito's request.
 */
export async function promptLine(query) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return await new Promise((resolve) => rl.question(query, resolve));
    }
    finally {
        rl.close();
    }
}
/** Read a secret without echoing. Falls back to piped stdin when not a TTY. */
export async function promptHidden(query) {
    const stdin = process.stdin;
    const stdout = process.stdout;
    if (!stdin.isTTY) {
        // Piped input (e.g. `echo "$PASS" | <plugin> login --password-stdin`).
        const chunks = [];
        for await (const chunk of stdin)
            chunks.push(chunk);
        return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
    }
    stdout.write(query);
    const wasRaw = stdin.isRaw;
    let value = "";
    try {
        stdin.setRawMode(true);
        stdin.resume();
        await new Promise((resolve, reject) => {
            const onData = (buf) => {
                for (const byte of buf) {
                    if (byte === 3) {
                        // Ctrl-C
                        stdin.removeListener("data", onData);
                        reject(new Error("interrupted"));
                        return;
                    }
                    if (byte === 13 || byte === 10) {
                        stdin.removeListener("data", onData);
                        resolve();
                        return;
                    }
                    if (byte === 127 || byte === 8) {
                        value = value.slice(0, -1);
                        continue;
                    }
                    value += String.fromCharCode(byte);
                }
            };
            stdin.on("data", onData);
        });
    }
    finally {
        stdin.setRawMode(wasRaw ?? false);
        stdin.pause();
        stdout.write("\n");
    }
    return value;
}
//# sourceMappingURL=prompt.js.map