export declare class ServerUnavailableError extends Error {
    readonly serverId: string;
    constructor(serverId: string, message: string);
}
export declare class UnknownToolError extends Error {
    readonly toolRef: string;
    constructor(toolRef: string);
}
