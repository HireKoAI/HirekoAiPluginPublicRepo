#!/usr/bin/env node
/**
 * Hireko MCP Server for Hermes Desktop & CLI
 * Provides:
 *   - auth_status
 *   - login (email + password)
 *   - login_browser (OAuth browser redirect)
 *   - logout
 *   - create_interview_link (initiates Step Function & returns external_job_group_id)
 *   - get_interview_link (retrieves completed anonymousInterviewSession candidate URL)
 *   - get_search_score
 *   - health
 *
 * Runs over stdio JSON-RPC (MCP 2024-11-05). Zero external dependencies.
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { exec } from 'node:child_process';

const LOG_PREFIX = '[hireko-mcp]';
function logErr(...args) {
  process.stderr.write(`${LOG_PREFIX} ${args.join(' ')}\n`);
}

// Default endpoints
const DEFAULT_FACADE_URLS = {
  beta: 'https://sm3m7mrvpfdovsnjoza4xkil5u0gqnke.lambda-url.us-west-2.on.aws/mcp',
  prod: 'https://sm3m7mrvpfdovsnjoza4xkil5u0gqnke.lambda-url.us-west-2.on.aws/mcp'
};

const DEFAULT_COGNITO_CLIENT_ID = '7of3lvicphr935gjj4r74f9n87';
const DEFAULT_COGNITO_REGION = 'us-east-1';

// Session state
const session = {
  tenant: process.env.HirekoOpenPlugin_tenant || process.env.HIREKO_TENANT || 'test',
  username: process.env.HirekoOpenPlugin_username || process.env.HIREKO_USERNAME || '',
  password: process.env.HirekoOpenPlugin_password || process.env.HIREKO_PASSWORD || '',
  stage: process.env.HirekoOpenPlugin_stage || process.env.HIREKO_STAGE || 'beta',
  accessToken: null,
  idToken: null,
  refreshToken: null,
  expiresAt: 0
};

// ── Credential Storage ────────────────────────────────────────────────────────

function getCredentialsDir() {
  if (process.env.HIREKO_HOME) {
    return path.join(process.env.HIREKO_HOME, 'credentials');
  }
  if (process.env.PLUGIN_DATA) {
    return path.join(process.env.PLUGIN_DATA, 'credentials');
  }
  const defaultDir = path.join(os.homedir(), '.HirekoOpenPlugin', 'credentials');
  if (fs.existsSync(defaultDir)) {
    return defaultDir;
  }
  const altDir = path.join(os.homedir(), '.hireko', 'credentials');
  if (fs.existsSync(altDir)) {
    return altDir;
  }
  fs.mkdirSync(defaultDir, { recursive: true, mode: 0o700 });
  return defaultDir;
}

function loadSavedCredentials(tenant) {
  const t = tenant || session.tenant || 'test';
  try {
    const filePath = path.join(getCredentialsDir(), `${t}.json`);
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data.accessToken && data.expiresAt && data.expiresAt > Date.now() + 60000) {
        session.tenant = data.tenant || t;
        session.username = data.username || session.username;
        session.stage = data.stage || session.stage;
        session.accessToken = data.accessToken;
        session.idToken = data.idToken || null;
        session.refreshToken = data.refreshToken || null;
        session.expiresAt = data.expiresAt;

        // Extract email from idToken if username is missing or uuid
        if ((!session.username || !session.username.includes('@')) && session.idToken) {
          try {
            const parts = session.idToken.split('.');
            const claims = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (claims.email) session.username = claims.email;
          } catch {}
        }

        return true;
      }
    }
  } catch (err) {
    logErr('Failed reading saved credentials:', err.message);
  }
  return false;
}

function saveCredentials(tenant, data) {
  try {
    const t = tenant || session.tenant || 'test';
    const dir = getCredentialsDir();
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const filePath = path.join(dir, `${t}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      tenant: t,
      username: session.username,
      stage: session.stage,
      ...data,
      savedAt: Date.now()
    }, null, 2), { mode: 0o600 });
  } catch (err) {
    logErr('Failed saving credentials:', err.message);
  }
}

function clearSavedCredentials(tenant) {
  try {
    const t = tenant || session.tenant || 'test';
    const filePath = path.join(getCredentialsDir(), `${t}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    logErr('Failed clearing credentials:', err.message);
  }
  session.accessToken = null;
  session.idToken = null;
  session.refreshToken = null;
  session.expiresAt = 0;
}

// ── Cognito Authentication ────────────────────────────────────────────────────

async function fetchTenantConfig(tenant, stage) {
  const slug = (tenant || 'test').trim().toLowerCase();
  const host = stage === 'prod' ? `recruiter-${slug}.hireko.ai` : `recruiter-${slug}.beta.hireko.ai`;
  const url = `https://${host}/assets/Json/tenant_configuration.json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const json = await res.json();
      const clientId = json.cognito?.cognito_client_id || DEFAULT_COGNITO_CLIENT_ID;
      const userPoolId = json.cognito?.cognito_user_pool_id || '';
      const region = userPoolId.includes('_') ? userPoolId.split('_')[0] : DEFAULT_COGNITO_REGION;
      return { clientId, region };
    }
  } catch (err) {
    logErr('Failed to fetch tenant configuration, using defaults:', err.message);
  }
  return { clientId: DEFAULT_COGNITO_CLIENT_ID, region: DEFAULT_COGNITO_REGION };
}

async function loginWithPassword(tenant, username, password, stage = 'beta') {
  const { clientId, region } = await fetchTenantConfig(tenant, stage);
  const cognitoUrl = `https://cognito-idp.${region}.amazonaws.com/`;

  const body = {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: clientId,
    AuthParameters: {
      USERNAME: username,
      PASSWORD: password
    }
  };

  const res = await fetch(cognitoUrl, {
    method: 'POST',
    headers: {
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
      'Content-Type': 'application/x-amz-json-1.1'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });

  const data = await res.json();
  if (!res.ok || data.__type) {
    throw new Error(data.message || data.__type || 'Cognito authentication failed');
  }

  const result = data.AuthenticationResult;
  if (!result || !result.AccessToken) {
    throw new Error('No access token returned from Cognito');
  }

  const expiresInSec = result.ExpiresIn || 3600;
  const expiresAt = Date.now() + (expiresInSec - 60) * 1000;

  session.tenant = tenant;
  session.username = username;
  session.password = password;
  session.stage = stage;
  session.accessToken = result.AccessToken;
  session.idToken = result.IdToken || null;
  session.refreshToken = result.RefreshToken || null;
  session.expiresAt = expiresAt;

  saveCredentials(tenant, {
    accessToken: result.AccessToken,
    idToken: result.IdToken,
    refreshToken: result.RefreshToken,
    expiresAt
  });

  return {
    success: true,
    tenant,
    username,
    stage,
    expiresInSec
  };
}

async function ensureValidToken(tenant, stage) {
  const t = tenant || session.tenant || 'test';
  const s = stage || session.stage || 'beta';

  // Check in-memory token
  if (session.accessToken && session.expiresAt > Date.now() + 60000) {
    return session.accessToken;
  }

  // Try loading saved token
  if (loadSavedCredentials(t)) {
    return session.accessToken;
  }

  // Try auto-login if password is in env/session
  if (session.username && session.password) {
    logErr('Refreshing token via saved credentials...');
    const res = await loginWithPassword(t, session.username, session.password, s);
    return session.accessToken;
  }

  throw new Error(`Unauthenticated for tenant '${t}'. Please run login or login_browser first.`);
}

// ── Browser OAuth Login ───────────────────────────────────────────────────────

function openBrowserUrl(url) {
  const p = process.platform;
  if (p === 'win32') {
    exec(`start "" "${url}"`);
  } else if (p === 'darwin') {
    exec(`open "${url}"`);
  } else {
    exec(`xdg-open "${url}"`);
  }
}

async function startBrowserLogin(tenant, stage = 'beta') {
  const t = (tenant || session.tenant || 'test').trim().toLowerCase();
  const s = stage || session.stage || 'beta';

  return new Promise((resolve, reject) => {
    // Find free port between 8700 and 8790
    const port = 8722;
    const nonce = crypto.randomBytes(8).toString('hex');
    const state = `hkdev.${port}.${nonce}`;

    const host = s === 'prod' ? `recruiter-${t}.hireko.ai` : `recruiter-${t}.beta.hireko.ai`;
    const loginUrl = `https://${host}/devicelogin?state=${encodeURIComponent(state)}`;

    let timeoutId = null;

    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://127.0.0.1:${port}`);

      // Handle ping
      if (parsedUrl.pathname === '/oauth/ping') {
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ status: 'ok' }));
        return;
      }

      // Handle callback (POST or GET)
      if (parsedUrl.pathname === '/oauth/callback') {
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
          });
          res.end();
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          let payload = {};
          try {
            if (body) {
              payload = JSON.parse(body);
            } else {
              for (const [k, v] of parsedUrl.searchParams.entries()) {
                payload[k] = v;
              }
            }
          } catch (e) {
            logErr('Failed parsing callback body:', e.message);
          }

          const accessToken = payload.accessToken || payload.access_token;
          const idToken = payload.idToken || payload.id_token;
          const refreshToken = payload.refreshToken || payload.refresh_token;
          const expiresIn = Number(payload.expiresIn || payload.expires_in) || 3600;

          if (accessToken) {
            const expiresAt = Date.now() + (expiresIn - 60) * 1000;
            session.tenant = t;
            session.stage = s;
            session.accessToken = accessToken;
            session.idToken = idToken || null;
            session.refreshToken = refreshToken || null;
            session.expiresAt = expiresAt;

            saveCredentials(t, { accessToken, idToken, refreshToken, expiresAt });

            res.writeHead(200, {
              'Content-Type': 'text/html',
              'Access-Control-Allow-Origin': '*'
            });
            res.end(`<!DOCTYPE html><html><body style="font-family:sans-serif;text-align:center;padding:50px;">
              <h2>Login Successful!</h2>
              <p>You have signed into Hireko for tenant <b>${t}</b>.</p>
              <p>You can close this tab and return to Hermes Desktop.</p>
            </body></html>`);

            clearTimeout(timeoutId);
            server.close();

            resolve({
              success: true,
              tenant: t,
              stage: s,
              message: `Successfully authenticated for tenant '${t}' via browser login.`
            });
          } else {
            res.writeHead(400, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
            res.end('<html><body><h3>Login failed or missing access token.</h3></body></html>');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    server.listen(port, '127.0.0.1', () => {
      logErr(`Started local callback listener on http://127.0.0.1:${port}`);
      openBrowserUrl(loginUrl);

      timeoutId = setTimeout(() => {
        server.close();
        reject(new Error(`Browser login timed out after 120s. URL: ${loginUrl}`));
      }, 120000);
    });

    server.on('error', err => {
      reject(new Error(`Failed to start loopback server on port ${port}: ${err.message}`));
    });
  });
}

// ── Downstream RecruiterFacade Proxy ──────────────────────────────────────────

async function callDownstreamFacade(toolName, args, tenant, stage) {
  const t = tenant || session.tenant || 'test';
  const s = stage || session.stage || 'beta';
  const token = await ensureValidToken(t, s);

  const endpoint = DEFAULT_FACADE_URLS[s] || DEFAULT_FACADE_URLS.beta;

  const payload = {
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: {
        ...args,
        tenant: t,
        stage: s
      }
    }
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'AuthorizationTenant': t,
    'AuthorizationRegion': 'us-east-1',
    'x-tenant': t
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(60000)
  });

  const resData = await res.json();
  if (resData.error) {
    throw new Error(resData.error.message || JSON.stringify(resData.error));
  }
  if (resData.result && resData.result.isError) {
    const errorText = resData.result.content?.[0]?.text || JSON.stringify(resData.result);
    throw new Error(`Hireko API validation error: ${errorText}`);
  }
  return resData.result;
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'auth_status',
    description: 'Check active Hireko recruiter authentication status, current tenant, and deployment stage.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant: { type: 'string', description: 'Tenant slug to check (defaults to active tenant)' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' }
      }
    }
  },
  {
    name: 'login',
    description: 'Sign into Hireko recruiter account using email and password for a tenant.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant: { type: 'string', description: 'Organization / tenant slug (e.g. "test")' },
        username: { type: 'string', description: 'Recruiter account email' },
        password: { type: 'string', description: 'Recruiter account password' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' }
      },
      required: ['tenant', 'username', 'password']
    }
  },
  {
    name: 'login_browser',
    description: 'Sign into Hireko using an interactive browser window for Cognito authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant: { type: 'string', description: 'Organization / tenant slug (e.g. "test")' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' }
      },
      required: ['tenant']
    }
  },
  {
    name: 'logout',
    description: 'Sign out and clear stored Hireko session credentials.',
    inputSchema: {
      type: 'object',
      properties: {
        tenant: { type: 'string', description: 'Tenant slug to sign out of' }
      }
    }
  },
  {
    name: 'create_interview_link',
    description: 'Create candidate interview link via Hireko. Starts an asynchronous AI Step Function and polls up to 150 seconds for question generation to complete and return the final candidate interview URL.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Interview job title (e.g. "Senior Frontend Engineer")' },
        description: { type: 'string', description: 'Job description, responsibilities, and interview expectations' },
        company_name: { type: 'string', description: 'Name of hiring company' },
        location: { type: 'string', description: 'Job location (e.g. "Remote", "New York, NY")' },
        interview_length: { type: 'string', description: 'Duration in minutes (e.g. "15", "30", "45")' },
        start_date: { type: ['integer', 'string'], description: 'Start date in epoch milliseconds or ISO date string' },
        end_date: { type: ['integer', 'string'], description: 'End date in epoch milliseconds or ISO date string' },
        recruiter_email: { type: 'string', description: 'Recruiter email address' },
        company_culture: { type: 'string', description: 'Company culture notes or candidate guidance' },
        employment_type: { type: 'string', default: 'Full Time' },
        language: { type: 'string', default: 'en' },
        status: { type: 'string', default: 'active' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' },
        tenant: { type: 'string', description: 'Tenant slug (defaults to active tenant)' },
        wait_timeout_seconds: { type: 'integer', description: 'Maximum seconds to poll for question generation (default: 150)', default: 150 }
      },
      required: ['title']
    }
  },
  {
    name: 'get_interview_link',
    description: 'Retrieve candidate interview session link and processing status using the external_job_group_id generated by create_interview_link. Polls up to 150 seconds if generation is still in progress.',
    inputSchema: {
      type: 'object',
      properties: {
        external_job_group_id: { type: 'string', description: 'The external job group ID from create_interview_link' },
        tenant: { type: 'string', description: 'Tenant slug (defaults to active tenant)' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' },
        wait_timeout_seconds: { type: 'integer', description: 'Maximum seconds to poll for completion if still in progress (default: 150)', default: 150 }
      },
      required: ['external_job_group_id']
    }
  },
  {
    name: 'get_search_score',
    description: 'Retrieve candidate match scores and search relevance for a specific job posting.',
    inputSchema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', description: 'Job ID to check scores for' },
        tenant: { type: 'string', description: 'Tenant slug (defaults to active tenant)' },
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' }
      },
      required: ['job_id']
    }
  },
  {
    name: 'health',
    description: 'Check connectivity to Hireko downstream recruiter services.',
    inputSchema: {
      type: 'object',
      properties: {
        stage: { type: 'string', enum: ['beta', 'prod'], default: 'beta' }
      }
    }
  }
];

async function pollInterviewLink(externalJobGroupId, tenant, stage, timeoutSec = 150, intervalSec = 6) {
  const deadline = Date.now() + Math.max(5, timeoutSec) * 1000;
  let lastResult = null;

  while (Date.now() < deadline) {
    try {
      const res = await callDownstreamFacade('get_interview_link', { external_job_group_id: externalJobGroupId }, tenant, stage);
      let parsed = res.structuredContent || {};
      if ((!parsed || Object.keys(parsed).length === 0) && res && res.content && res.content[0] && res.content[0].text) {
        try {
          parsed = JSON.parse(res.content[0].text);
        } catch {
          parsed = { raw: res.content[0].text };
        }
      } else if (res && !parsed) {
        parsed = res;
      }
      lastResult = parsed;

      let jobId = parsed.jobId || parsed.job_id || res.structuredContent?.jobId || res.structuredContent?.job_id;
      let interviewLink = parsed.interview_link || res.structuredContent?.interview_link;

      if (!jobId && interviewLink) {
        const m = /anonymousInterviewSession\/(job_[^?]+)/.exec(interviewLink);
        if (m) jobId = m[1];
      }

      if (jobId || interviewLink) {
        const domain = stage === 'prod' ? 'interview-test.hireko.ai' : `interview-test.${stage}.hireko.ai`;
        const link = jobId
          ? `https://${domain}/anonymousInterviewSession/${jobId}?settings=eyJyZW5kZXJJRCI6ICJidWJibGUiLCAiaXNTY3JlZW5TaGFyZU1hbmRhdG9yeSI6IGZhbHNlfQ==`
          : interviewLink;

        return {
          status: 'COMPLETED',
          job_id: jobId,
          interview_link: link,
          external_job_group_id: externalJobGroupId,
          message: 'Interview session is ready! Share this candidate interview link.'
        };
      }
    } catch (err) {
      logErr('Poll error for', externalJobGroupId, err.message);
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise((r) => setTimeout(r, Math.min(intervalSec * 1000, remaining)));
  }

  return {
    status: 'STARTED',
    external_job_group_id: externalJobGroupId,
    message: `Interview questions are still generating after ${timeoutSec}s. The Step Function is running in the background. Call 'get_interview_link' with external_job_group_id: "${externalJobGroupId}" to retrieve once ready.`,
    data: lastResult
  };
}

// ── Tool Handlers ─────────────────────────────────────────────────────────────

async function handleToolCall(name, args) {
  const tenant = args.tenant || session.tenant || 'test';
  const stage = args.stage || session.stage || 'beta';

  switch (name) {
    case 'auth_status': {
      loadSavedCredentials(tenant);
      const isAuth = Boolean(session.accessToken && session.expiresAt > Date.now());
      return {
        authenticated: isAuth,
        tenant,
        stage,
        username: session.username || null,
        expiresInSec: isAuth ? Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000)) : 0,
        message: isAuth
          ? `Authenticated as recruiter for tenant '${tenant}' (${stage} stage).`
          : `Signed out. Please use login or login_browser to authenticate for tenant '${tenant}'.`
      };
    }

    case 'login': {
      const res = await loginWithPassword(args.tenant, args.username, args.password, stage);
      return {
        status: 'success',
        message: `Successfully authenticated as ${res.username} for tenant '${res.tenant}' (${res.stage} stage).`,
        tenant: res.tenant,
        stage: res.stage
      };
    }

    case 'login_browser': {
      const res = await startBrowserLogin(tenant, stage);
      return res;
    }

    case 'logout': {
      clearSavedCredentials(tenant);
      return {
        status: 'success',
        message: `Successfully signed out of tenant '${tenant}'.`
      };
    }

    case 'create_interview_link': {
      await ensureValidToken(tenant, stage);

      let recruiterEmail = args.recruiter_email || session.username || '';
      if ((!recruiterEmail || !recruiterEmail.includes('@')) && session.idToken) {
        try {
          const parts = session.idToken.split('.');
          const claims = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (claims.email) recruiterEmail = claims.email;
        } catch {}
      }
      if (!recruiterEmail || !recruiterEmail.includes('@')) {
        recruiterEmail = 'recruiter@hireko.ai';
      }

      let startMs = args.start_date;
      if (typeof startMs === 'string') {
        const parsed = Date.parse(startMs);
        if (!isNaN(parsed)) startMs = parsed;
      }
      if (!startMs || isNaN(Number(startMs))) {
        startMs = Date.now();
      }
      let endMs = args.end_date;
      if (typeof endMs === 'string') {
        const parsed = Date.parse(endMs);
        if (!isNaN(parsed)) endMs = parsed;
      }
      if (!endMs || isNaN(Number(endMs))) {
        endMs = Number(startMs) + 7 * 24 * 60 * 60 * 1000;
      }

      // Generate clean slug for external_job_group_id
      const slug = (args.title || 'interview')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      const externalJobGroupId = args.external_job_group_id || `${slug}-${tenant}-${Date.now()}`;

      const title = args.title || 'Candidate Screening Interview';
      const companyName = args.company_name || 'Hireko Partner';
      const location = args.location || 'Remote';
      const interviewLength = String(args.interview_length || '30');
      const description = args.description || `${title} technical screening and candidate interview assessment`;

      const facadeArgs = {
        title,
        description,
        company_name: companyName,
        location,
        interview_length: interviewLength,
        start_date: Number(startMs),
        end_date: Number(endMs),
        recruiter_email: recruiterEmail,
        company_culture: args.company_culture || '',
        employment_type: args.employment_type || 'Full Time',
        language: args.language || 'en',
        status: args.status || 'active',
        external_job_group_id: externalJobGroupId,
        funnel: args.funnel || 'AllFunnels'
      };

      const createRes = await callDownstreamFacade('create_interview_link', facadeArgs, tenant, stage);

      let actualExternalId = externalJobGroupId;
      if (createRes && createRes.content && createRes.content[0] && createRes.content[0].text) {
        try {
          const parsedCreate = JSON.parse(createRes.content[0].text);
          if (parsedCreate.data?.external_job_group_id) {
            actualExternalId = parsedCreate.data.external_job_group_id;
          }
        } catch {}
      }

      const waitSec = args.wait_timeout_seconds !== undefined ? Number(args.wait_timeout_seconds) : 150;
      if (waitSec > 0) {
        // Wait 4s before first poll to allow Step Function to initialize
        await new Promise((r) => setTimeout(r, 4000));
        return await pollInterviewLink(actualExternalId, tenant, stage, waitSec, 6);
      }

      return {
        status: 'STARTED',
        external_job_group_id: actualExternalId,
        title: args.title,
        company_name: args.company_name,
        interview_length: args.interview_length,
        message: `Interview link generation has been initiated. The AWS Step Function is creating the interview questions (takes up to 150 seconds). To retrieve the candidate link, call 'get_interview_link' with external_job_group_id: "${actualExternalId}".`
      };
    }

    case 'get_interview_link': {
      await ensureValidToken(tenant, stage);
      const externalJobGroupId = args.external_job_group_id;
      const waitSec = args.wait_timeout_seconds !== undefined ? Number(args.wait_timeout_seconds) : 150;
      return await pollInterviewLink(externalJobGroupId, tenant, stage, waitSec, 6);
    }

    case 'get_search_score': {
      const res = await callDownstreamFacade('get_search_score', { job_id: args.job_id }, tenant, stage);
      return res;
    }

    case 'health': {
      const res = await callDownstreamFacade('health', {}, tenant, stage);
      return res;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ── JSON-RPC stdio Transport ──────────────────────────────────────────────────

function sendResponse(response) {
  const json = JSON.stringify(response);
  process.stdout.write(json + '\n');
}

function handleRpcRequest(req) {
  if (!req || typeof req !== 'object') return;

  const { id, method, params } = req;

  // Notifications
  if (id === undefined || id === null) {
    if (method === 'notifications/initialized') {
      logErr('Client initialized');
    }
    return;
  }

  // Requests
  switch (method) {
    case 'initialize':
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'hireko',
            version: '0.1.0'
          }
        }
      });
      break;

    case 'ping':
      sendResponse({ jsonrpc: '2.0', id, result: {} });
      break;

    case 'tools/list':
      sendResponse({
        jsonrpc: '2.0',
        id,
        result: { tools: TOOLS }
      });
      break;

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      handleToolCall(toolName, toolArgs)
        .then(result => {
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
                }
              ]
            }
          });
        })
        .catch(err => {
          logErr(`Error in tool ${toolName}:`, err.message);
          sendResponse({
            jsonrpc: '2.0',
            id,
            result: {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error: ${err.message}`
                }
              ]
            }
          });
        });
      break;
    }

    default:
      sendResponse({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` }
      });
      break;
  }
}

// Start stdio interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', line => {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const parsed = JSON.parse(trimmed);
    handleRpcRequest(parsed);
  } catch (err) {
    logErr('Failed parsing JSON-RPC line:', err.message);
  }
});

logErr('Hireko MCP server started over stdio');

