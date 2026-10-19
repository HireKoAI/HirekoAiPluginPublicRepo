# Hireko Open Plugin for Claude

[![Claude Code](https://img.shields.io/badge/Claude-Compatible-6366f1.svg)](https://claude.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![MCP](https://img.shields.io/badge/MCP-Remote%20HTTPS-blue.svg)](https://modelcontextprotocol.io)

**Hireko Open Plugin** integrates Claude directly with **Hireko AI**, enabling recruiters and hiring teams to automate screening workflows, create candidate interview links, and retrieve candidate match scores directly within Claude.

---

## 🌟 Key Capabilities

Hireko Open Plugin connects Claude to Hireko's **Recruiter Facade** services:

| Tool | Description | Example Prompt |
|---|---|---|
| **`create_interview_link`** | Generates an AI-powered candidate screening and interview session link with custom duration, job description, and culture guidelines. | *"Create a 30-minute screening interview link for Senior Backend Engineer at Acme Corp starting tomorrow."* |
| **`get_search_score`** | Retrieves real-time candidate search relevance and match scores for specific job postings. | *"Check candidate match scores for job ID backend-dev-42."* |
| **`health`** | Verifies active connectivity with Hireko's upstream recruiter services. | *"Check Hireko service health."* |

---

## 🔐 Authentication & Sign-In Guide

Hireko Open Plugin is **multi-tenant and auth-gated**. Before creating interview links or retrieving candidate scores, you must authenticate your organization's tenant:

### 1. Sign In (Interactive)
In the Claude chat window, type the slash command with your tenant name:
```text
/HirekoOpenPlugin <your-tenant>
```
*(or tell Claude: **"Sign in to Hireko for tenant <your-company>"**).*

Claude will provide a secure browser login link. Open the link to sign in with your Hireko credentials (AWS Cognito). Once authenticated, session tokens are securely handled and you're ready to use all recruiting tools.

### 2. Check Authentication Status
To verify if you are actively signed in:
```text
/HirekoOpenPlugin status
```
*(or ask Claude: **"Am I logged into Hireko?"**).*

### 3. Sign Out / Switch Tenant
To end your session or switch to another company workspace:
```text
/HirekoOpenPlugin logout
```

---

## 🚀 How to Use in Claude

### On Claude.ai & Claude Desktop
Once installed from the Claude Directory and authenticated:
1. Ask Claude in plain English:
   > *"Schedule an interview link for a Full Stack Developer role at Acme, 45 minutes long, remote."*
   > *"What is the candidate search score for job ID frontend-101?"*
2. Or use the slash command for shortcuts:
   ```text
   /HirekoOpenPlugin
   ```

### On Claude Code (CLI)

Install directly from the GitHub marketplace:
```bash
claude plugin marketplace add HireKoAI/HirekoAiPluginPublicRepo
claude plugin install hireko-open-plugin@hireko-open-plugin
```

Or for a single session from a local checkout:
```bash
claude --plugin-dir /path/to/HirekoAiPluginPublicRepo
```

---

## 🔒 Security & Privacy

Hireko Open Plugin follows enterprise-grade security standards:
- **Zero Token Leakage:** Authentication headers and access tokens are managed at the protocol layer and never exposed in the LLM chat transcript.
- **Multi-Tenant Isolation:** Sessions are isolated per tenant ID with AWS Cognito authentication.
- **Encrypted Remote Transport:** All communication between Claude and Hireko runs over encrypted HTTPS.

---

## 💻 Other Supported Harnesses

In addition to Claude, this plugin supports:
- **Cursor:** In Settings $\rightarrow$ enable third-party plugins, or copy to `~/.cursor/plugins/local/`.
- **Codex:** `codex plugin marketplace add` $\rightarrow$ `codex plugin add`.
- **Hermes / Antigravity / Gemini CLI:** See [docs/integrations/INSTALL.md](docs/integrations/INSTALL.md) for complete harness setup.

---

## 📚 Resources & Support

- **Hireko Platform:** [hireko.ai](https://hireko.ai)
- **Technical Specification:** [docs/SPEC.md](docs/SPEC.md)
- **Developer Support:** `developer_hireko@hireko.ai`
- **License:** [MIT License](LICENSE)
