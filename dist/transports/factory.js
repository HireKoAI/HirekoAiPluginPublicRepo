import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport, getDefaultEnvironment } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { PROTECTED_HEADERS, expandUrlTemplates, resolveHeaders, resolveTemplate } from "../proxy/headers.js";
export class HirekoTransportFactory {
    opts;
    constructor(opts) {
        this.opts = opts;
    }
    async create(server) {
        switch (server.transport) {
            case "streamable-http": {
                const url = await this.resolveServerUrl(server.url);
                return new StreamableHTTPClientTransport(new URL(url), {
                    fetch: this.authenticatedFetch(server),
                });
            }
            case "sse": {
                const authedFetch = this.authenticatedFetch(server);
                const url = await this.resolveServerUrl(server.url);
                return new SSEClientTransport(new URL(url), {
                    fetch: authedFetch,
                    // The EventSource GET stream must carry the same auth headers.
                    eventSourceInit: { fetch: authedFetch },
                });
            }
            case "stdio": {
                // No HTTP headers exist on stdio; tokens are injected into the
                // child environment at process creation (spec §17). Rotating a token
                // later requires reconnecting this child — documented limitation.
                const auth = await this.opts.resolveAuth();
                const env = { ...getDefaultEnvironment() };
                for (const [key, template] of Object.entries(server.env ?? {})) {
                    env[key] = await resolveTemplate(template, {
                        tokenProvider: auth.tokenProvider,
                        tenantName: auth.tenantName,
                    });
                }
                return new StdioClientTransport({
                    command: server.command,
                    args: server.args ?? [],
                    env,
                    stderr: "inherit", // stderr is safe (stdout is the protocol stream)
                });
            }
            default: {
                const exhaustive = server.transport;
                throw new Error(`unsupported transport: ${exhaustive}`);
            }
        }
    }
    /**
     * One fetch wrapper per server: per-request header injection (spec §16/§17).
     * Fresh token on EVERY request — token rotation never needs a reconnect for
     * HTTP transports, and tenant switches apply immediately.
     */
    authenticatedFetch(server) {
        const warned = new Set();
        return async (url, init) => {
            const headers = new Headers(init?.headers ?? undefined);
            const auth = await this.opts.resolveAuth();
            // Static per-server headers first; protected names are rejected here
            // when auth injection is on, so nothing can spoof them.
            for (const [name, value] of Object.entries(server.headers ?? {})) {
                const lower = name.toLowerCase();
                if (server.injectAuth && PROTECTED_HEADERS.has(lower)) {
                    if (!warned.has(lower)) {
                        warned.add(lower);
                        this.opts.logger.warn("static header ignored (protected)", { serverId: server.id, header: name });
                    }
                    continue;
                }
                headers.set(name, value);
            }
            if (server.injectAuth) {
                const resolved = await resolveHeaders(auth.headerSpecs, {
                    tokenProvider: auth.tokenProvider,
                    tenantName: auth.tenantName,
                });
                for (const [name, value] of Object.entries(resolved)) {
                    headers.set(name, value);
                }
            }
            const target = expandUrlTemplates(String(url), auth.tenantName);
            return fetch(target, { ...init, headers });
        };
    }
    async resolveServerUrl(url) {
        const auth = await this.opts.resolveAuth();
        return expandUrlTemplates(url, auth.tenantName);
    }
}
//# sourceMappingURL=factory.js.map