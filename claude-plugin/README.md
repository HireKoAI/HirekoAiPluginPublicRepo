# Hireko for Claude

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Remote%20HTTPS-blue.svg)](https://modelcontextprotocol.io)

**Hireko for Claude** connects Claude to your company's [Hireko](https://hireko.ai) recruiting workspace. Recruiters can create AI screening interview links, look up their jobs, and review candidate match scores by asking Claude in plain English.

## What you can do

| Tool | What it does | Example prompt |
|---|---|---|
| `create_interview_link` | Creates a job and its AI screening interview link (title, description, company, location, dates, interview length) | *"Create a 30-minute screening interview link for a Senior Backend Engineer at Acme, remote, open for the next two weeks."* |
| `get_interview_link` | Fetches the interview link of a job created earlier | *"Is the interview link for that job ready yet?"* |
| `search_jobs` | Lists your company's jobs that match given skills | *"Show our open jobs that need Python and AWS."* |
| `get_search_score` | Returns candidate scores, percentiles and assessment status for a job | *"Give me the candidate scores for job job_123."* |
| `health` | Checks that the Hireko service is reachable | *"Is Hireko reachable?"* |

The plugin also adds the `hireko-recruiting` skill, which guides Claude through these workflows, and a `/HirekoOpenPlugin` command that checks your connection and shows how to get started.

## Sign in

You need a Hireko recruiter account. Sign-in uses Claude's built-in connector sign-in (OAuth); you never type your password into the chat.

1. **Connect:** in Claude Code run `/mcp`, select **HirekoOpenPlugin** and choose **Authenticate**. In the Claude apps, select **Connect** for Hireko.
2. **Choose your company:** a Hireko page asks for your company name: the `<company>` in your Hireko address `recruiter-<company>.hireko.ai`.
3. **Log in:** you are sent to your company's usual Hireko login page. Sign in and confirm.
4. You return to Claude, connected. Access renews automatically until you disconnect.

To sign out or switch company, disconnect Hireko (in Claude Code: `/mcp` → **Clear authentication**) and connect again.

## Data and privacy

The plugin contains no code that runs on your machine. It declares one remote MCP server, operated by Hireko over HTTPS. Here is what it sends and where:

- **Sign-in:** your company name goes to Hireko's sign-in service. You log in on your company's Hireko site (`recruiter-<company>.hireko.ai`) with Hireko's identity provider (Amazon Cognito). Claude receives a Hireko access token and a sealed refresh token, stores them in its own credential storage, and sends the access token to Hireko with each tool call. Your password is never sent to Claude or to the plugin.
- **Tool calls:** the arguments Claude passes to a tool (for example job details, skills, job IDs and your recruiter email) are sent to Hireko's servers to perform that action.
- **Results:** tool results come back from Hireko and can include candidate names, emails, phone numbers and scores from your own Hireko workspace. Each call is limited to the company you signed in with.
- **No other destinations:** the plugin sends nothing to any service other than Hireko.

Hireko's handling of this data is described in the [Hireko privacy policy](https://hireko.ai/privacy).

## Install

From the Claude directory, or in Claude Code from GitHub:

```bash
claude plugin marketplace add HireKoAI/HirekoAiPluginPublicRepo
claude plugin install hireko-open-plugin@hireko-open-plugin
```

Then sign in as described above.

## Support

- Hireko: [hireko.ai](https://hireko.ai)
- Support: `developer_hireko@hireko.ai`
- License: [MIT](LICENSE)
