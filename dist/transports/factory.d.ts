import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { TokenProvider } from "../auth/types.js";
import type { ServerConfig } from "../config/schema.js";
import type { Logger } from "../logging/logger.js";
import { type HeaderSpec } from "../proxy/headers.js";
/**
 * Transport creation behind an interface (spec §16/§30). All HTTP auth
 * injection happens in one place: the wrapped fetch.
 *
 * Auth is resolved LIVE per request (resolveAuth) so switching the default
 * tenant in the /human console applies to the very next downstream call —
 * no restart, no reconnect (HTTP transports refresh headers per request).
 */
export interface AuthenticatedTransportFactory {
    create(server: ServerConfig): Promise<Transport>;
}
export interface ResolvedAuth {
    tokenProvider: TokenProvider;
    tenantName: string;
    headerSpecs: HeaderSpec[];
}
export type AuthResolver = () => Promise<ResolvedAuth>;
export interface TransportFactoryOptions {
    resolveAuth: AuthResolver;
    logger: Logger;
}
export declare class HirekoTransportFactory implements AuthenticatedTransportFactory {
    private readonly opts;
    constructor(opts: TransportFactoryOptions);
    create(server: ServerConfig): Promise<Transport>;
    /**
     * One fetch wrapper per server: per-request header injection (spec §16/§17).
     * Fresh token on EVERY request — token rotation never needs a reconnect for
     * HTTP transports, and tenant switches apply immediately.
     */
    private authenticatedFetch;
    private resolveServerUrl;
}
