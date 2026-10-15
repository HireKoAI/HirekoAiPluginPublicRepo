export class ServerUnavailableError extends Error {
    serverId;
    constructor(serverId, message) {
        super(`downstream server "${serverId}" unavailable: ${message}`);
        this.serverId = serverId;
        this.name = "ServerUnavailableError";
    }
}
export class UnknownToolError extends Error {
    toolRef;
    constructor(toolRef) {
        super(`unknown toolRef "${toolRef}"; use filter_tools_with_query or tools/list to find valid tools`);
        this.toolRef = toolRef;
        this.name = "UnknownToolError";
    }
}
//# sourceMappingURL=errors.js.map