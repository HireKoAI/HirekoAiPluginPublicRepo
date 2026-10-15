import type { AppConfig } from "../config/schema.js";
import type { TokenProvider } from "../auth/types.js";
/**
 * Forwarded-header templates (spec §16). All HTTP auth injection flows
 * through this one layer.
 *
 * Template variables:
 *   ${TOKEN}        — the tenant's forwarded token (per tokenToForward)
 *   ${ACCESS_TOKEN} — the Cognito access token
 *   ${ID_TOKEN}     — the Cognito ID token
 *   ${TENANT}       — the active tenant name
 *
 * When `authHeaders` is not configured, the default is
 * `Authorization: Bearer ${TOKEN}`.
 */
export interface HeaderSpec {
    name: string;
    valueTemplate: string;
}
/** Headers the model (and static per-server config) may never override. */
export declare const PROTECTED_HEADERS: Set<string>;
export declare function parseHeaderSpecs(config: AppConfig): HeaderSpec[];
export interface TemplateContext {
    tokenProvider: TokenProvider;
    tenantName: string;
}
export declare function resolveTemplate(template: string, ctx: TemplateContext): Promise<string>;
/** True when a server URL or stdio env interpolates the active tenant. */
export declare function usesTenantPlaceholder(server: {
    url?: string;
    env?: Record<string, string>;
}): boolean;
/** Substitute ${TENANT} in a downstream URL. Tenant is encoded as a path/query segment. */
export declare function expandUrlTemplates(url: string, tenantName: string): string;
export declare function resolveHeaders(specs: HeaderSpec[], ctx: TemplateContext): Promise<Record<string, string>>;
