/**
 * `<plugin> plugin install s3://<bucket>/<plugin>-x.y.z.zip`
 *
 * The whole end-user experience, internally:
 *   1. SSO bootstrap (browser login, SigV4 after) — reuses an existing
 *      session when present; only logs in when nothing usable exists.
 *   2. Ephemeral profile named after the current directory (same convention
 *      as infra/deploy_to_aws/deploy_aws.sh) holding access/secret/session.
 *   3. Fetch zip + sha256 sidecar over SigV4.
 *   4. Verify checksum, unpack to ~/.hireko/plugins/.
 *   5. `npm install -g` the unpacked plugin (prepare builds it).
 *   6. Register the MCP server with the host when the host CLI is present.
 *
 * No step requires the user to copy-paste AWS commands.
 */
export interface PluginInstallOptions {
    profile?: string;
    noRegister?: boolean;
}
export declare function pluginInstallCommand(s3Uri: string, opts: PluginInstallOptions): Promise<void>;
