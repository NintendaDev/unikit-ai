import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInitCommand } from '../dist/cli/commands/init.js';
import { runUpdateCommand } from '../dist/cli/commands/update.js';
import { runWizard } from '../dist/cli/wizard/prompts.js';
import { OfficialRegistry, FsRegistry } from '../dist/core/registry/index.js';
import { loadConfig, saveConfig, emptyRulesInstallation } from '../dist/core/config.js';
import { computeContentHash } from '../dist/core/installer/shared.js';
import extra from 'fs-extra';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-flow-'));
const catalogEnv = { UNIKIT_MCP_DIR: process.env.UNIKIT_MCP_DIR, UNIKIT_BRIDGES_DIR: process.env.UNIKIT_BRIDGES_DIR };
process.env.UNIKIT_MCP_DIR = path.join(repo, 'mcp');
process.env.UNIKIT_BRIDGES_DIR = path.join(repo, 'engine-bridges');
const project = path.join(root, 'project');
const fixture = path.join(root, 'registry');
const biome = 'unity-biome-mcp';
const ids = ['context7', biome, 'unity-cli'];
const rulePath = (dir, id) => path.join(dir, '.unikit/memory/code/stack', `${id}.md`);
const read = file => fs.readFile(file, 'utf8');
const exists = file => fs.stat(file).then(() => true, () => false);
const entry = (config, id) => config.rules.installed.modules.code.stack.find(row => row.name === id);
const logs = [];
async function quiet(run) {
  const printer = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try { return await run(); } finally { console.log = printer; }
}

try {
  await fs.cp(path.join(repo, 'scripts/test-fixtures/bridge-rules'), fixture, { recursive: true });
  const manifestFile = path.join(fixture, 'manifest.json');
  const fixtureManifest = JSON.parse(await read(manifestFile));
  fixtureManifest.modules.code.engines.unity.stack = fixtureManifest.modules.code.engines.unity.stack.filter(row => row.id !== biome);
  await fs.writeFile(manifestFile, JSON.stringify(fixtureManifest));
  const registry = () => new OfficialRegistry(new FsRegistry(fixture), 'unity', new FsRegistry(path.join(repo, 'rules-registry')));
  let mode = 'all';
  let choicesSeen = [];
  const prompt = async rows => {
    const q = rows[0];
    if (q.name === 'selectedAgents') return { selectedAgents: ['claude'] };
    if (q.name === 'engine') return { engine: 'unity' };
    if (q.name === 'selectedSkills') return { selectedSkills: ['unikit-implement'] };
    if (q.name === 'useCustom') return { useCustom: false };
    if (q.name === 'selected') return { selected: q.message.startsWith('Configure') ? ['context7'] : [biome, 'unity-cli'] };
    if (q.name === 'providerRules') {
      choicesSeen = q.choices;
      if (mode === 'cancel') { const e = new Error('closed'); e.name = 'ExitPromptError'; throw e; }
      return { providerRules: mode === 'none' ? [] : q.choices.map(row => row.value) };
    }
    throw new Error(`Unexpected prompt ${q.name}`);
  };
  const init = () => quiet(() => runInitCommand(project, { runWizard: (...args) => runWizard(...args, { prompt, createRegistry: registry }) }));
  const update = (dir = project, tty = false, force = false) => quiet(() => runUpdateCommand(dir, { skipNew: true, force },
    { stdinTTY: tty, stdoutTTY: tty, prompt, createRegistry: registry }));
  await fs.mkdir(project);
  await init();
  let config = await loadConfig(project);
  assert.equal(choicesSeen.length, ids.length);
  assert.equal(choicesSeen.every(row => row.checked === true), true);
  const realFile = path.join(repo, 'rules-registry/code/unity/stack', `${biome}.md`);
  assert.equal(await read(rulePath(project, biome)), await read(realFile));
  assert.equal(entry(config, biome).origin, 'bundled');
  assert.equal(entry(config, biome).installed_hash, computeContentHash(await read(realFile)));
  const realManifest = JSON.parse(await read(path.join(repo, 'rules-registry/manifest.json')));
  const realRow = realManifest.modules.code.engines.unity.stack.find(row => row.id === biome);
  for (const name of realRow.references) {
    assert.equal(await read(path.join(project, '.unikit/memory/code/stack/references', name)),
      await read(path.join(repo, 'rules-registry/code/unity/stack/references', name)));
  }
  const indexPath = path.join(project, '.unikit/memory/code/RULES_INDEX.md');
  assert.equal((await read(indexPath)).includes(biome), true);
  const independentPaths = ['.mcp.json', '.claude/skills/unikit-implement/SKILL.md', `.unikit/system/engine-bridges/${biome}/INDEX.md`];
  const independent = await Promise.all(independentPaths.map(file => read(path.join(project, file))));
  assert.equal(independent[0].includes(biome), true);
  assert.equal(independent[1].includes(`mcp__${biome}__`), true);
  await fs.mkdir(path.join(project, '.unikit/bridge-notes'), { recursive: true });
  await fs.writeFile(path.join(project, `.unikit/bridge-notes/${biome}.md`), '# User findings\n');
  await fs.writeFile(path.join(project, '.unikit/bridges.yaml'), `order:\n  - ${biome}\n  - unity-cli\n`);
  const order = await read(path.join(project, '.unikit/bridges.yaml'));
  const unrelated = { name: 'local-unrelated', source: 'local', installed_hash: 'preserved' };
  config.rules.installed.modules.code.stack.push(unrelated);
  await fs.writeFile(rulePath(project, unrelated.name), '# User rule');
  await saveConfig(project, config);

  mode = 'none';
  await init();
  config = await loadConfig(project);
  assert.deepEqual(config.rules.providerSelection, Object.fromEntries(ids.map(id => [id, false])));
  assert.equal(JSON.stringify(entry(config, unrelated.name)), JSON.stringify(unrelated));
  for (const id of ids) assert.equal(await exists(rulePath(project, id)), false);
  assert.deepEqual(await Promise.all(independentPaths.map(file => read(path.join(project, file)))), independent);
  assert.equal(await read(path.join(project, `.unikit/bridge-notes/${biome}.md`)), '# User findings\n');
  assert.equal(await read(path.join(project, '.unikit/bridges.yaml')), order);
  await update(project, false, true);
  for (const id of ids) assert.equal(await exists(rulePath(project, id)), false);

  mode = 'all';
  await init();
  const installedHash = entry(await loadConfig(project), biome).installed_hash;
  await fs.appendFile(rulePath(project, biome), '\nUser change\n');
  mode = 'none';
  await init();
  assert.equal((await read(rulePath(project, biome))).includes('User change'), true);
  assert.equal(entry(await loadConfig(project), biome).installed_hash, installedHash);
  assert.equal(logs.some(line => line.includes('edited after it was installed')), true);

  const pendingDir = path.join(root, 'pending');
  const pending = { ...(await loadConfig(project)), agents: [], rulesRegistry: fixture,
    rules: { installed: emptyRulesInstallation() } };
  await saveConfig(pendingDir, pending);
  mode = 'all';
  await update(pendingDir);
  assert.equal((await loadConfig(pendingDir)).rules.providerSelection, undefined);
  assert.equal(await exists(rulePath(pendingDir, biome)), false);
  await update(pendingDir, true);
  assert.equal(await exists(rulePath(pendingDir, biome)), true);
  await fs.unlink(rulePath(pendingDir, biome));
  mode = 'none';
  await update(pendingDir, true);
  assert.equal((await loadConfig(pendingDir)).rules.providerSelection[biome], false);
  assert.equal(await exists(rulePath(pendingDir, biome)), false);
  assert.equal(entry(await loadConfig(pendingDir), biome), undefined);

  // A failed reference write must not be registered as local by the following Phase 1.
  const retry = await loadConfig(pendingDir);
  delete retry.rules.providerSelection[biome];
  await saveConfig(pendingDir, retry);
  const targetRef = path.join(pendingDir, '.unikit/memory/code/stack/references', realRow.references[0]);
  const oldRef = await read(targetRef);
  let failOnce = true;
  const write = extra.writeFile;
  extra.writeFile = async (file, ...args) => {
    if (file === targetRef && failOnce) { failOnce = false; throw new Error('flow reference fault'); }
    return write(file, ...args);
  };
  mode = 'all';
  try { await update(pendingDir, true); } finally { extra.writeFile = write; }
  assert.equal(await exists(rulePath(pendingDir, biome)), false);
  assert.equal(entry(await loadConfig(pendingDir), biome), undefined);
  assert.equal(await read(targetRef), oldRef);
  await update(pendingDir, true);
  assert.equal(await exists(rulePath(pendingDir, biome)), true);

  const cli = (...args) => {
    const result = spawnSync(process.execPath, [path.join(repo, 'dist/cli/index.js'), ...args],
      { cwd: pendingDir, env: { ...process.env, UNIKIT_OFFICIAL_REGISTRY_URL: fixture }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return result.stdout;
  };
  cli('rules', 'sync', '--prune');
  assert.equal(await exists(rulePath(pendingDir, biome)), true);
  // The preferred source returns with the same version and a different body.
  fixtureManifest.modules.code.engines.unity.stack.push(realRow);
  await fs.writeFile(manifestFile, JSON.stringify(fixtureManifest));
  await fs.writeFile(path.join(fixture, 'code/unity/stack', `${biome}.md`), (await read(realFile)) + '\nRemote revision\n');
  for (const name of realRow.references) await fs.copyFile(path.join(repo, 'rules-registry/code/unity/stack/references', name), path.join(fixture, 'code/unity/stack/references', name));
  cli('rules', 'sync', '--prune');
  config = await loadConfig(pendingDir);
  assert.equal(entry(config, biome).origin, 'primary');
  assert.equal(entry(config, biome).version, realRow.version);
  assert.equal((await read(rulePath(pendingDir, biome))).includes('Remote revision'), true);
  const unchanged = await read(path.join(pendingDir, '.unikit.json'));
  cli('rules', 'sync', '--prune');
  assert.equal(await read(path.join(pendingDir, '.unikit.json')), unchanged);
  delete config.rules.providerSelection;
  await saveConfig(pendingDir, config);
  cli('rules', 'sync');
  config = await loadConfig(pendingDir);
  assert.deepEqual(config.rules.providerSelection, Object.fromEntries(ids.map(id => [id, true])));
  config.rules.providerSelection.context7 = false;
  config.rules.installed.modules.code.stack = config.rules.installed.modules.code.stack.filter(row => row.name !== 'context7');
  await fs.unlink(rulePath(pendingDir, 'context7'));
  await saveConfig(pendingDir, config);
  cli('rules', 'install', 'context7');
  assert.equal(await exists(rulePath(pendingDir, 'context7')), true);
  assert.equal((await loadConfig(pendingDir)).rules.providerSelection.context7, false);

  mode = 'cancel';
  const beforeCancel = await read(path.join(project, '.unikit.json'));
  await init();
  assert.equal(await read(path.join(project, '.unikit.json')), beforeCancel);
  console.log('PASS provider flow: real bundled body/refs, init/re-init, independent bridge assets, refusal/force, non-TTY→TTY, restoration consent, rollback→retry, standalone prune and equal-version remote recovery');
} finally {
  for (const [key, value] of Object.entries(catalogEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await fs.rm(root, { recursive: true, force: true });
}
