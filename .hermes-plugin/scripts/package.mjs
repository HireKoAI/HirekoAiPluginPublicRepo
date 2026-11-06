import { readFileSync, writeFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

// Sync version in .hermes-plugin/plugin.json
const pluginPath = '.hermes-plugin/plugin.json';
const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
plugin.version = version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + '\n');

// Sync version in .hermes-plugin/hireko.yaml
const yamlPath = '.hermes-plugin/hireko.yaml';
let yaml = readFileSync(yamlPath, 'utf8');
yaml = yaml.replace(/^version:\s*".*"/m, `version: "${version}"`);
writeFileSync(yamlPath, yaml);

console.log(`Hermes plugin package version synchronized to ${version}.`);

