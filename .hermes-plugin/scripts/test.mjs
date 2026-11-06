import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import readline from 'node:readline';

const proc = spawn('node', ['.hermes-plugin/index.mjs'], {
  stdio: ['pipe', 'pipe', 'inherit']
});

const rl = readline.createInterface({ input: proc.stdout });

function send(msg) {
  proc.stdin.write(JSON.stringify(msg) + '\n');
}

let toolsChecked = false;
let authChecked = false;

rl.on('line', (line) => {
  const res = JSON.parse(line);

  if (res.id === 1) {
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  } else if (res.id === 2) {
    const tools = res.result?.tools?.map((t) => t.name) || [];
    const expected = [
      'auth_status',
      'login_browser',
      'logout',
      'create_interview_link',
      'get_interview_link',
      'get_search_score',
      'health'
    ];
    for (const name of expected) {
      assert.ok(tools.includes(name), `Missing tool: ${name}`);
    }
    toolsChecked = true;
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'auth_status', arguments: { tenant: 'nonexistent-test' } } });
  } else if (res.id === 3) {
    const text = res.result?.content?.[0]?.text;
    assert.ok(text, 'Expected text in auth_status result');
    authChecked = true;
    proc.kill();

    if (toolsChecked && authChecked) {
      console.log('Hermes package smoke passed: isolated stdio startup, all 7 tools discovered, signed-out status verified.');
      process.exit(0);
    }
  }
});

send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' }
  }
});

