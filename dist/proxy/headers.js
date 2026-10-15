/** Headers the model (and static per-server config) may never override. */
export const PROTECTED_HEADERS = new Set(["authorization", "cookie", "x-tenant"]);
export function parseHeaderSpecs(config) {
    if (!config.authHeaders || Object.keys(config.authHeaders).length === 0) {
        return [{ name: "authorization", valueTemplate: "Bearer ${TOKEN}" }];
    }
    const specs = [];
    for (const [key, value] of Object.entries(config.authHeaders)) {
        if (typeof value === "string") {
            specs.push({ name: key, valueTemplate: value });
        }
        else {
            specs.push({ name: value.name, valueTemplate: value.value });
        }
    }
    return specs;
}
export async function resolveTemplate(template, ctx) {
    const vars = {
        TOKEN: () => ctx.tokenProvider.getAccessToken(),
        ACCESS_TOKEN: () => ctx.tokenProvider.getToken("access"),
        ID_TOKEN: () => ctx.tokenProvider.getToken("id"),
        TENANT: async () => ctx.tenantName,
    };
    let out = template;
    for (const [name, resolve] of Object.entries(vars)) {
        if (out.includes(`\${${name}}`)) {
            out = out.split(`\${${name}}`).join(await resolve());
        }
    }
    return out;
}
/** True when a server URL or stdio env interpolates the active tenant. */
export function usesTenantPlaceholder(server) {
    if (server.url?.includes("${TENANT}"))
        return true;
    if (server.env && Object.values(server.env).some((v) => v.includes("${TENANT}")))
        return true;
    return false;
}
/** Substitute ${TENANT} in a downstream URL. Tenant is encoded as a path/query segment. */
export function expandUrlTemplates(url, tenantName) {
    if (!url.includes("${TENANT}"))
        return url;
    return url.split("${TENANT}").join(encodeURIComponent(tenantName));
}
export async function resolveHeaders(specs, ctx) {
    const headers = {};
    for (const spec of specs) {
        headers[spec.name] = await resolveTemplate(spec.valueTemplate, ctx);
    }
    return headers;
}
//# sourceMappingURL=headers.js.map