// Keep mutable configuration and credentials outside the installed package.
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 20) {
  throw new Error('Hireko requires Node.js 20 or newer on PATH.');
}
const home = process.env.HIREKO_HOME || process.env.PLUGIN_DATA || join(homedir(), '.HirekoOpenPlugin');
await mkdir(home, { recursive: true, mode: 0o700 });
const config = join(home, 'config.json');
try {
  await writeFile(config, JSON.stringify({
    version: 1, activeTenant: 'test', tenants: {}, servers: {},
    routing: { mode: 'flat', dynamicToolActivation: false }
  }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
process.env.HIREKO_HOME = home;
process.env.PLUGIN_NAME = 'HirekoOpenPlugin';
process.env.HIREKO_CREDENTIAL_STORE = 'file';
process.argv = [process.execPath, fileURLToPath(new URL('./runtime/dist/cli/index.js', import.meta.url)),
  'serve', '--config', config];
await import('./runtime/dist/cli/index.js');
