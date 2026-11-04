---
name: hireko
description: Use Hireko MCP tools to check authentication, create candidate interview links, and retrieve candidate match scores.
---

# Hireko recruiting workflows

Use the tools discovered from the package's `hireko` MCP server. Match the operation by its name and description; use its live input schema for required fields and supported options. Do not invent tool names or assume the hosted gateway exposes every tool in the local router.

## Authentication

Call `auth_status` first. When signed out, call `login_browser` with the requested tenant and deployment stage. The local router opens the secure browser sign-in flow. Never ask for passwords, tokens, or API keys in chat, and never construct authentication headers. If a different tenant is active, sign out before signing into another tenant.

The authentication router runs locally under Hermes, so the browser callback reaches the same machine. For SSH or Docker, forward the callback port to the browser machine before signing in; do not claim sign-in succeeded without a successful tool result. Unattended runs must return a clear sign-in requirement instead of waiting for a browser.

## Interview links

Find the interview-creation tool, such as `RecruiterFacade__create_interview_link`. Gather its required interview details. Convert dates to epoch milliseconds only when the schema requires that format, resolving the user's timezone first. Pass the requested tenant and stage only when supported; do not silently choose an environment.

Present the URL returned by the service. If processing is pending, report that state and use a discovered retrieval tool with the returned identifier. Never fabricate a candidate URL or report an upstream error as success.

## Candidate scores

Find the search-score tool, such as `RecruiterFacade__get_search_score`. Obtain the job ID, call the tool, and summarize its returned scores without inventing values.

## Sign out

Call the discovered logout tool. Report its result and check authentication status when available to confirm sign-out.
