export interface DeployInfo {
    /** Deploy stage stamped at publish time: beta | prod | … */
    stage: string | null;
    pluginName: string | null;
    version: string | null;
    deployedAt: string | null;
}
/**
 * Read deploy.json written by infra/deploy_to_aws/deploy_aws.sh into the
 * artifact. Source checkouts / local builds have no file → stage null.
 */
export declare function readDeployInfo(): DeployInfo;
