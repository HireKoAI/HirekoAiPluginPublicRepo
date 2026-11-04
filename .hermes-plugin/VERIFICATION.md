# Hermes MCP verification

The original package connected directly to the remote Lambda and did not launch the local router that provides auth_status and login_browser. The package now launches the router over stdio; release builds include its bundled CLI and web assets.

Passed locally:
- npm run build
- node scripts/package-hermes.mjs
- node scripts/validate-hermes-package.mjs
- node scripts/test-hermes-package.mjs (isolated copy, no credentials/network; auth_status, login_browser, logout, reload_registry discovered)
- npm test -- tests/stdio.e2e.test.ts (authenticated forwarding and JSON-RPC stdout)
- git diff --check

Remaining release blocker:
hermes plugins validate .hermes-plugin --install-deps exits 1. Portable manifest and fields pass, but its security scan reports dump_all_env, hardcoded_secret, read_secrets_file, and sudo_usage in runtime/dist/cli/index.js. Inspected matches include Commander option-source comments, Smithy AWS metadata header constants, an AWS credential-file reference, and an MCP SDK environment-inheritance comment. This is not evidence of a leaked Hireko credential, but the validator currently rejects the artifact. Do not disable scanning or claim the plugin is install-ready. Review the dependency paths and resolve the findings with the Hermes scanner maintainers or reduce actual runtime dependency capabilities, then rerun native validation.

Interactive browser sign-in, tenant isolation against live services, and the published public release have not been verified. Do not publish this package as verified until native validation and a real test-tenant login pass. The runtime directory is generated and ignored in the private source checkout; SyncHermes explicitly includes it in the public release commit.