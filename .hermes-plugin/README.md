# Hireko for Hermes

A portable Agent Plugins v1 package for Hermes Desktop and CLI. The package root is `.hermes-plugin/`, containing `plugin.json`, `mcp.json`, and `skills/hireko/SKILL.md`. The repository-root manifests serve the existing plugin and are separate.

## What runs and where data goes

Hermes connects to the HTTPS MCP endpoint declared in `mcp.json`, hosted on AWS Lambda in us-west-2. Recruiting tool arguments, including interview details and job identifiers, go to the Hireko gateway. Returned candidate links and scores enter the conversation. An account and a working gateway authentication flow are required.

This package ships configuration and instructions only: no local executable, dependencies, shell commands, background service, credential-file access, telemetry implementation, or self-updater. Gateway-side credential handling and data retention are outside this package; confirm and disclose those service policies before catalog submission. The remote endpoint is not pinned by the package's Git SHA and its tool surface may change.

## Validate and test

From the repository root:

```bash
node scripts/validate-hermes-package.mjs
hermes plugins validate .hermes-plugin --install-deps
```

The Node check verifies package layout and configuration only. Hermes validation, catalog review, and authenticated runtime tests are separate requirements.

After publishing, install the package subdirectory at the full public release SHA:

```bash
hermes plugins install HireKoAI/HirekoAiPluginPublicRepo/.hermes-plugin --ref <FULL_RELEASE_SHA> --no-enable
hermes plugins enable hireko
```

Test the same package and SHA in Desktop through Install from Git using the subdirectory source. Consult your installed client's supported fields if its dialog differs. Discover the bundled skill through the client's skill list.

Verify MCP tool discovery, secure authentication, tenant isolation, interview creation and retrieval, scoring, error handling, and logout in both clients. Interview creation changes service data; use a test tenant and test job. Never paste passwords into chat. A remote server's loopback browser callback cannot reach the user's machine; confirm a compatible authentication flow before release.

## Publish and submit

The pipeline runs beta deployment first, then production deployment and beta public sync in parallel. After both succeed, `SyncHermes` publishes this package to `hermes` in HireKoAI/HirekoAiPluginPublicRepo, alongside `SyncPublicRepoProd`, which publishes the regular package to `main`. The beta public sync targets `beta`. Production deployment remains restricted to the source branch `main` and uses Azure environment `prod` and its configured checks; the final syncs are skipped when production deployment is skipped. Hermes publishing is a single stage, without separate beta/prod package stages.

The pipeline stamps `hireko.yaml` with a public commit containing the package. Use that stamped release SHA for testing. The checked-in SHA is a draft and is not evidence that this package was tested.

Before submission, confirm catalog capability declarations against Hermes validation and the actual discovered tools. Empty capability lists are not a verified inventory of the hosted service. Confirm the minimum supported Hermes version against both clients and add truthful compatibility metadata if required.

Submit the stamped entry as `plugin-catalog/hireko.yaml` in a PR to NousResearch/hermes-agent. Disclose hosted network calls and authentication behavior in the PR, include validation output, and fix all failures. Pushing this repository does not create a catalog listing. Catalog acceptance requires maintainer review; it is not guaranteed by local checks.

Reference: https://hermes-agent.nousresearch.com/docs/developer-guide/plugins/catalog-submission
