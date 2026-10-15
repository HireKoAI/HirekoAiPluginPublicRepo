export function makeRef(serverId, toolName) {
    return `${serverId}.${toolName}`;
}
export function parseRef(ref) {
    const dot = ref.indexOf(".");
    if (dot <= 0 || dot === ref.length - 1)
        return undefined;
    return { serverId: ref.slice(0, dot), name: ref.slice(dot + 1) };
}
//# sourceMappingURL=types.js.map