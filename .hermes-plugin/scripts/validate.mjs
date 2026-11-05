import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.hermes-plugin');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

const manifest = JSON.parse(read('plugin.json'));
assert.equal(manifest.name, 'hireko');
assert.ok(manifest.version);
assert.ok(manifest.extensions?.['com.nousresearch.hermes']);

const config = JSON.parse(read('mcp.json'));
const server = config.mcpServers?.hireko;
assert.equal(server?.type, 'stdio', 'Hermes must launch the local authentication router');
assert.equal(server.command, 'node');
assert.deepEqual(server.args, ['${PLUGIN_ROOT}/index.mjs']);
assert.equal(server.cwd, '${PLUGIN_ROOT}');
assert.ok(fs.existsSync(path.join(root, 'index.mjs')), 'index.mjs entry point must exist');

const skill = read('skills/hireko/SKILL.md');
assert.match(skill, /^---\r?\nname: hireko\r?\ndescription: .+\r?\n[\s\S]*?^---/m);
assert.match(skill, /create_interview_link/);
assert.match(skill, /get_interview_link/);

const catalog = read('hireko.yaml');
assert.match(catalog, /^subdir: \.hermes-plugin\r?$/m);
assert.match(catalog, /^sha: [0-9a-f]{40}\r?$/m);
assert.ok(read('README.md').trim());
assert.ok(read('LICENSE').trim());

console.log('Hermes package layout, manifest, index.mjs, and skill checks passed.');

