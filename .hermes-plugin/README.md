# Hireko for Hermes

This package launches the local Hireko authentication router over stdio. It provides auth_status, login_browser, and logout before sign-in, then injects tenant credentials into downstream recruiting calls. The Lambda endpoint alone does not provide browser sign-in tools.

## Build and validate

Requires Node.js 20 or newer on PATH on the machine running Hermes.

    npm ci
    npm run build
    node scripts/package-hermes.mjs
    node scripts/validate-hermes-package.mjs
    node scripts/test-hermes-package.mjs
    hermes plugins validate .hermes-plugin --install-deps

The release pipeline builds and includes the bundled CLI and browser assets inside this package; users do not need npm install. Do not publish just the manifests.

## Install and sign in

    hermes plugins install HireKoAI/HirekoAiPluginPublicRepo/.hermes-plugin --ref <FULL_RELEASE_SHA> --no-enable
    hermes plugins enable hireko

Restart Hermes after installing the new release. Ask it to call auth_status, then login_browser for the intended tenant and stage (beta or prod). Complete sign-in in the browser and confirm auth_status reports the correct tenant. Never paste passwords or tokens into chat. If auth_status is absent, check plugin enablement, Node on PATH, package runtime assets, and Hermes MCP logs. Remove a separately configured stale remote-only Hireko MCP entry if it conflicts with this plugin.

The router and browser must run on the same machine; remote SSH/Docker installations need callback port forwarding. Successful discovery does not verify Cognito login or downstream authorization: complete a real test-tenant login before release.

## Data and permissions

Enabling this package runs a local Node process with the user's permissions. It opens loopback control and browser callback endpoints, fetches public tenant configuration, and authenticates with Cognito. Credentials are stored in restricted local files under Hermes PLUGIN_DATA (or HIREKO_HOME when explicitly set), outside the installed package. Recruiting tool arguments go to the configured Hireko downstream services. No credentials belong in mcp.json. Use logout to clear the active session.

The default downstream URL is configured by the router for beta; production requires MCP_EXTENSION_RECRUITER_FACADE and the correct HIREKO_STAGE. The hosted downstream service is not pinned by the plugin Git SHA.

## Publishing

SyncHermes follows SyncPublicRepoBeta and publishes the built package to the public hermes branch. It stamps hireko.yaml with a public release commit. Install that exact commit and validate tool discovery, browser sign-in, tenant isolation, recruiting calls, and logout before submitting to a catalog. Catalog submission and acceptance are separate from publishing.
