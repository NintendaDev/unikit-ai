import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { emptyRulesInstallation, loadConfig, saveConfig } from '../dist/core/config.js';
import { normalizeProviderSelection, activeProviderIds, adoptLegacyProviderSelection } from '../dist/core/provider-rule-selection.js';
import { providerRulePath } from '../dist/core/constants-provider-rules.js';
import { RuleCandidateResolver } from '../dist/core/registry/rule-candidate.js';
import { syncProviderRules } from '../dist/core/installer/provider-rules.js';
import extra from 'fs-extra';
import { syncRulesState } from '../dist/core/installer/rules-sync.js';
import { getModule } from '../dist/core/modules.js';
import { runWizard } from '../dist/cli/wizard/prompts.js';
import { prepareUpdateProviderRules } from '../dist/cli/commands/update-provider-rules.js';
import { runUpdateCommand } from '../dist/cli/commands/update.js';
import { setVerbose } from '../dist/utils/log.js';
import { OfficialRegistry } from '../dist/core/registry/index.js';
import { collectProviderCandidates, providerRuleChoices } from '../dist/cli/wizard/provider-rules.js';
import { RULE_FETCH_CONCURRENCY } from '../dist/core/constants.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'provider-rules-'));
const config = () => ({ version: '3.0.0', engine: 'unity', rulesRegistry: null,
  mcp: { servers: { context7: 'vendor' } }, engineBridges: { selected: { biome: 'other' } }, agents: [],
  rules: { installed: emptyRulesInstallation() } });
try {
  assert.equal(normalizeProviderSelection(undefined), undefined);
  assert.equal(normalizeProviderSelection([]), undefined);
  assert.deepEqual(normalizeProviderSelection({ context7: false, biome: true, '../escape': true, invalid: 1 }), { context7: false, biome: true });
  for (const selection of [undefined, {}, { context7: false, biome: true }]) {
    const c = config();
    c.rules.providerSelection = selection;
    await saveConfig(root, c);
    assert.deepEqual((await loadConfig(root)).rules.providerSelection, selection);
  }
  const c = config();
  c.engineBridges.selected.context7 = 'changed-vendor';
  assert.deepEqual(activeProviderIds(c), ['context7', 'biome']);
  c.rules.installed.modules.code.stack.push({ name: 'context7', source: 'registry' }, { name: 'biome', source: 'local' });
  assert.equal(await adoptLegacyProviderSelection(root, c), false);
  await fs.mkdir(path.dirname(providerRulePath(root, 'context7')), { recursive: true });
  await fs.writeFile(providerRulePath(root, 'context7'), '# Existing');
  await fs.writeFile(providerRulePath(root, 'biome'), '# Local');
  assert.equal(await adoptLegacyProviderSelection(root, c), true);
  assert.deepEqual(c.rules.providerSelection, { context7: true });
  assert.equal(await adoptLegacyProviderSelection(root, c), false);
  c.rules.providerSelection.context7 = false;
  assert.equal(await adoptLegacyProviderSelection(root, c), false);
  const directoryConfig = config();
  directoryConfig.mcp.servers = { 'not-a-file': 'vendor' };
  directoryConfig.rules.installed.modules.code.stack.push({ name: 'not-a-file', source: 'registry' });
  await fs.mkdir(providerRulePath(root, 'not-a-file'));
  assert.equal(await adoptLegacyProviderSelection(root, directoryConfig), false);
  console.log('PASS provider decisions: round-trip, malformed, vendor identity, disk legacy, explicit refusal');

  function source(origin, rows, bodies = {}, refs = {}) {
    return { origin, counts: { manifest: 0, body: 0, refs: 0 },
      async fetchManifest() { this.counts.manifest++; return { schema: 1, engines: { unity: { core: [], stack: rows } } }; },
      async fetchRule(_m, _e, tier, id) { this.counts.body++; return bodies[id] === undefined ? null : { id, category: tier, content: bodies[id] }; },
      async fetchReferences(_m, _e, _t, id) { this.counts.refs++; return refs[id] ?? []; } };
  }
  const row = { id: 'biome', version: '1', description: 'Fixture', references: ['biome-ref.md'] };
  const primary = source('primary', [row], { biome: 'primary' });
  const official = source('official', [row], { biome: 'official' }, { biome: [{ filename: 'biome-ref.md', content: 'official ref' }] });
  const bundled = source('bundled', [{ ...row, version: '99' }], { biome: 'local' }, { biome: [{ filename: 'biome-ref.md', content: 'local ref' }] });
  const resolver = new RuleCandidateResolver(() => [primary, official, bundled], s => s.origin);
  const hit = await resolver.resolve('code', 'unity', 'stack', 'biome');
  assert.equal(hit.origin, 'official');
  assert.equal(hit.content, 'official');
  assert.equal(hit.references[0].content, 'official ref');
  assert.equal(bundled.counts.manifest, 0);
  assert.strictEqual(await resolver.resolve('code', 'unity', 'stack', 'biome'), hit);
  assert.equal(await resolver.resolve('code', 'unity', 'stack', 'missing'), null);
  assert.equal(await resolver.resolve('code', 'unity', 'stack', 'missing'), null);
  assert.deepEqual([primary, official, bundled].map(s => s.counts.manifest), [1, 1, 1]);
  const noBody = source('official', [row]);
  const localResolver = new RuleCandidateResolver(() => [noBody, bundled], s => s.origin);
  assert.equal((await localResolver.resolve('code', 'unity', 'stack', 'biome')).origin, 'bundled');
  assert.equal(await localResolver.resolve('code', 'unity', 'stack', '../escape'), null);
  const newer = source('primary', []);
  newer.fetchManifest = async () => ({ schema: 999, modules: {} });
  assert.equal((await new RuleCandidateResolver(() => [newer, official], s => s.origin).resolve('code', 'unity', 'stack', 'biome')).origin, 'official');
  console.log('PASS candidates: atomic fallback, remote priority, schema 1/2 gate, negative and manifest caches');

  // Slow providers must overlap without an unbounded burst or changing picker order.
  const providerIds = Array.from({ length: RULE_FETCH_CONCURRENCY + 2 }, (_, i) => `provider-${i}`);
  let activeFetches = 0;
  let peakFetches = 0;
  const fetchedIds = [];
  const collected = await collectProviderCandidates({ resolveRuleCandidate: async (_m, _e, _t, id) => {
    fetchedIds.push(id);
    peakFetches = Math.max(peakFetches, ++activeFetches);
    await new Promise(resolve => setTimeout(resolve, id === providerIds[0] ? 30 : 5));
    activeFetches--;
    return id === providerIds.at(-1) ? null : { ...hit, rule: { ...hit.rule, id } };
  } }, 'unity', [...providerIds, providerIds[0]]);
  assert.ok(peakFetches > 1, 'independent provider downloads must overlap');
  assert.ok(peakFetches <= RULE_FETCH_CONCURRENCY, 'provider downloads must remain bounded');
  assert.deepEqual(fetchedIds, providerIds, 'duplicate providers are fetched once');
  assert.deepEqual([...collected.keys()], providerIds.map(id => `code\0unity\0stack\0${id}`));
  const providerCatalog = new Map([[providerIds[0], { code: 'provider-command', fullName: 'Provider (requirements)', shortName: 'Provider' }]]);
  const compactChoices = providerRuleChoices(collected, 'unity', providerIds, providerCatalog);
  assert.deepEqual(compactChoices.map(choice => choice.name), ['Provider', ...providerIds.slice(1, -1)]);
  assert.deepEqual(compactChoices.map(choice => choice.value), providerIds.slice(0, -1));
  assert.equal(compactChoices.every(choice => choice.checked), true);
  console.log('PASS provider picker: bounded overlapping downloads, stable order, deduplication, short names with ID values');

  const lifecycle = config();
  lifecycle.mcp.servers = { biome: 'vendor' };
  const bundle = { ...hit, references: [{ filename: 'biome-ref.md', content: 'new reference' }] };
  const lifecycleDir = path.join(root, 'lifecycle');
  const input = { projectDir: lifecycleDir, config: lifecycle, registry: { resolveRuleCandidate: async () => bundle }, engineId: 'unity',
    previousProviderIds: [], currentProviderIds: ['biome'], previousRules: lifecycle.rules.installed, regenerateIndex: 'none' };
  assert.equal((await syncProviderRules(input)).lines[0].status, 'pending');
  assert.equal(await fs.stat(providerRulePath(lifecycleDir, 'biome')).catch(() => null), null);
  assert.equal((await syncProviderRules({ ...input, decisions: { biome: false } })).stateChanged, true);
  assert.equal((await syncProviderRules(input)).stateChanged, false);
  const referencePath = path.join(path.dirname(providerRulePath(lifecycleDir, 'biome')), 'references', 'biome-ref.md');
  await fs.mkdir(path.dirname(referencePath), { recursive: true });
  await fs.writeFile(referencePath, 'previous reference');
  const originalWrite = extra.writeFile;
  let failedOnce = false;
  extra.writeFile = async (file, ...args) => {
    if (file === referencePath && !failedOnce) { failedOnce = true; throw new Error('injected reference write failure'); }
    return originalWrite(file, ...args);
  };
  let failure;
  try { failure = await syncProviderRules({ ...input, decisions: { biome: true } }); }
  finally { extra.writeFile = originalWrite; }
  assert.equal(failure.lines[0].status, 'failed');
  assert.equal(await fs.stat(providerRulePath(lifecycleDir, 'biome')).catch(() => null), null);
  assert.equal(await fs.readFile(referencePath, 'utf8'), 'previous reference');
  assert.equal(lifecycle.rules.installed.modules.code.stack.length, 0);
  assert.equal(lifecycle.rules.providerSelection.biome, true);
  assert.equal((await syncProviderRules(input)).lines[0].status, 'pending');
  assert.equal((await syncProviderRules({ ...input, decisions: { biome: true } })).lines[0].status, 'installed');
  assert.equal(lifecycle.rules.installed.modules.code.stack[0].origin, 'official');
  const resetConfig = config();
  await fs.appendFile(providerRulePath(lifecycleDir, 'biome'), '\nUser edit');
  const retained = await syncProviderRules({ ...input, config: resetConfig, decisions: { biome: false } });
  assert.equal(retained.lines.some(line => line.status === 'kept'), true);
  assert.deepEqual(resetConfig.rules.installed.modules.code.stack[0], lifecycle.rules.installed.modules.code.stack[0]);
  await fs.writeFile(providerRulePath(lifecycleDir, 'biome'), bundle.content);
  assert.equal((await syncProviderRules({ ...input, decisions: { biome: false } })).lines.some(line => line.status === 'removed'), true);
  console.log('PASS lifecycle: decision-only, current consent, write rollback, preserved refs, retry and decline cleanup');

  await syncProviderRules({ ...input, decisions: { biome: true } });
  const syncRegistry = { resolveRuleCandidate: async () => ({ ...bundle, origin: 'primary', content: '# remote same version' }),
    fetchModuleManifest: async () => ({ schema: 2, modules: { code: { engines: { unity: { core: [], stack: [] } } } } }),
    getModuleRules: () => [] };
  const module = getModule('code');
  const refreshed = await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry, { prune: true });
  assert.equal(refreshed.changed, true);
  assert.equal(await fs.readFile(providerRulePath(lifecycleDir, 'biome'), 'utf8'), '# remote same version');
  assert.equal(lifecycle.rules.installed.modules.code.stack[0].origin, 'primary');
  assert.equal((await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry, { prune: true })).changed, false);
  lifecycle.rules.installed.modules.code.stack[0].version = '2.0.0';
  const lowerVersion = { ...syncRegistry, resolveRuleCandidate: async () => ({ ...bundle, rule: { ...bundle.rule, version: '1.0.0' } }) };
  assert.equal((await syncRulesState(lifecycleDir, 'unity', module, lifecycle, lowerVersion, { replace: true })).events.some(e => e.kind === 'phase2:downgrade'), true);
  await fs.appendFile(providerRulePath(lifecycleDir, 'biome'), '\nuser edit');
  assert.equal((await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry)).events.some(e => e.kind === 'phase2:skipped-local-mod'), true);
  await fs.unlink(providerRulePath(lifecycleDir, 'biome'));
  await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry, { replace: true, prune: true });
  assert.equal(await fs.stat(providerRulePath(lifecycleDir, 'biome')).catch(() => null), null);
  assert.equal(lifecycle.rules.installed.modules.code.stack.length, 0);
  console.log('PASS provider sync: fallback outside winner/prune, equal-version origin/body refresh, no-op, edited guard, missing replace/prune');

  async function replayWizard({ available = true, picked = [], cancelled = false } = {}) {
    const questions = [];
    const fetched = [];
    const answers = await runWizard(['claude'], null, 'unity', null, null, {
      createRegistry: () => ({ resolveRuleCandidate: async (_m, _e, _t, id) => {
        fetched.push(id);
        return available ? { ...bundle, rule: { ...bundle.rule, id } } : null;
      } }),
      prompt: async rows => {
        const q = rows[0];
        questions.push(q);
        if (q.name === 'selectedAgents') return { selectedAgents: ['claude'] };
        if (q.name === 'selectedSkills') return { selectedSkills: ['unikit-verify'] };
        if (q.name === 'useCustom') return { useCustom: false };
        if (q.name === 'selected') return { selected: q.message.startsWith('Configure') ? ['context7'] : ['unity-biome-mcp'] };
        if (q.name === 'providerRules') {
          if (cancelled) { const error = new Error('closed'); error.name = 'ExitPromptError'; throw error; }
          return { providerRules: picked };
        }
        throw new Error(`unexpected prompt ${q.name}`);
      },
    });
    return { answers, questions, fetched };
  }
  const wizard = await replayWizard();
  assert.deepEqual(wizard.questions.slice(-3).map(q => q.name), ['selected', 'selected', 'providerRules']);
  assert.deepEqual(wizard.questions.at(-2).choices.filter(row => row.checked).map(row => row.value), ['unity-cli']);
  assert.deepEqual(wizard.fetched, ['context7', 'unity-biome-mcp']);
  assert.equal(wizard.questions.at(-1).choices.every(row => row.checked === true), true);
  assert.deepEqual(wizard.questions.at(-1).choices.map(row => row.name), ['Context7', 'Unity Biome MCP']);
  assert.equal(wizard.questions.at(-2).choices.find(row => row.value === 'unity-cli').name,
    'Unity CLI (Unity 6000.0+, needs the com.unity.pipeline package)');
  assert.deepEqual(wizard.answers.providerDecisions, { context7: false, 'unity-biome-mcp': false });
  assert.equal((await replayWizard({ available: false })).questions.some(q => q.name === 'providerRules'), false);
  await assert.rejects(() => replayWizard({ cancelled: true }), { name: 'ExitPromptError' });
  console.log('PASS full wizard replay: universal → bridges → rules, checked defaults, deselect-all, unavailable skip, cancellation');

  const pendingConfig = config();
  pendingConfig.mcp.servers = { biome: 'vendor' };
  pendingConfig.engineBridges.selected = {};
  let prompts = 0;
  const deps = { stdinTTY: true, stdoutTTY: true, prompt: async rows => {
    prompts++;
    assert.equal(rows[0].choices.every(row => row.checked), true);
    assert.deepEqual(rows[0].choices.map(row => row.name), ['Biome']);
    return { providerRules: [] };
  } };
  const updateCatalog = new Map([['biome', { code: 'vendor', fullName: 'Biome (requirements)', shortName: 'Biome' }]]);
  for (const [stdinTTY, stdoutTTY] of [[false, true], [true, false], [false, false]]) {
    const nonTTY = await prepareUpdateProviderRules(path.join(root, 'pending'), pendingConfig, input.registry, updateCatalog, { ...deps, stdinTTY, stdoutTTY });
    assert.deepEqual(nonTTY.decisions, {});
  }
  assert.equal(prompts, 0);
  assert.deepEqual((await prepareUpdateProviderRules(path.join(root, 'pending'), pendingConfig, input.registry, updateCatalog, deps)).decisions, { biome: false });
  pendingConfig.rules.providerSelection = { biome: false };
  assert.deepEqual((await prepareUpdateProviderRules(path.join(root, 'pending'), pendingConfig, { resolveRuleCandidate: () => { throw new Error('refused id fetched'); } }, updateCatalog, deps)).decisions, {});

  const cancelDir = path.join(root, 'update-cancel');
  pendingConfig.rules.providerSelection = { biome: true };
  await saveConfig(cancelDir, pendingConfig);
  const configBefore = await fs.readFile(path.join(cancelDir, '.unikit.json'));
  await runUpdateCommand(cancelDir, { force: true, skipNew: true }, { ...deps,
    createRegistry: () => input.registry,
    prompt: async () => { const error = new Error('User force closed'); throw error; } });
  assert.deepEqual(await fs.readFile(path.join(cancelDir, '.unikit.json')), configBefore);
  assert.equal(await fs.stat(providerRulePath(cancelDir, 'biome')).catch(() => null), null);
  assert.equal(await fs.stat(path.join(cancelDir, '.unikit', 'system')).catch(() => null), null);
  console.log('PASS update replay: both TTY streams, persistent refusal, confirmed [], cancel before component/config writes');

  const verbose = [];
  const printer = console.log;
  setVerbose(true);
  console.log = (...args) => verbose.push(args.join(' '));
  try {
    const absentId = source('primary', []);
    const broken = source('official', []);
    broken.fetchManifest = async () => { broken.counts.manifest++; throw new Error('transport failure'); };
    const complete = source('bundled', [row], { biome: 'bundled' }, { biome: [{ filename: 'biome-ref.md', content: 'bundled reference' }] });
    const fallback = new RuleCandidateResolver(() => [absentId, broken, complete], s => s.origin);
    assert.equal((await fallback.resolve('code', 'unity', 'stack', 'biome')).content, 'bundled');
    await fallback.resolve('code', 'unity', 'stack', 'missing');
    assert.equal(broken.counts.manifest, 1);
    const schema2 = source('primary', []);
    schema2.fetchManifest = async () => ({ schema: 2, modules: { code: { engines: { unity: { core: [], stack: [row] } } } } });
    schema2.fetchRule = async () => ({ content: 'schema 2' });
    schema2.fetchReferences = async () => [{ filename: 'biome-ref.md', content: 'schema 2 ref' }];
    assert.equal((await new RuleCandidateResolver(() => [schema2], s => s.origin).resolve('code', 'unity', 'stack', 'biome')).content, 'schema 2');
  } finally { console.log = printer; setVerbose(false); }
  assert.equal(verbose.some(line => line.includes('falling back')), true);
  assert.equal(verbose.some(line => line.includes('resolved bundled')), true);
  const snapshotConfig = config();
  snapshotConfig.mcp.servers = { biome: 'changed-code' };
  snapshotConfig.engineBridges.selected = {};
  const snapshotDir = path.join(root, 'snapshot');
  const snap = new Map([['code\0unity\0stack\0biome', bundle]]);
  const noFetch = { resolveRuleCandidate: () => { throw new Error('snapshot must prevent refetch'); } };
  assert.equal((await syncProviderRules({ ...input, projectDir: snapshotDir, config: snapshotConfig,
    registry: noFetch, previousRules: snapshotConfig.rules.installed, decisions: { biome: true }, candidates: snap })).lines[0].status, 'installed');
  const noCandidate = new Map([['code\0unity\0stack\0biome', null]]);
  await syncRulesState(snapshotDir, 'unity', module, snapshotConfig, { ...syncRegistry, ...noFetch }, { providerCandidates: noCandidate, prune: true });
  assert.equal(await fs.readFile(providerRulePath(snapshotDir, 'biome'), 'utf8'), bundle.content);
  console.log('PASS resolver transport/schema guards, verbose reasons, positive and negative snapshot reuse without fetch');
  const unavailable = source('official', []);
  unavailable.fetchManifest = async () => { unavailable.counts.manifest++; throw new Error('offline'); };
  const local = source('bundled', [row], { biome: 'local body' }, { biome: [{ filename: 'biome-ref.md', content: 'local ref' }] });
  const chain = new OfficialRegistry(unavailable, 'unity', local);
  assert.equal((await chain.resolveRuleCandidate('code', 'unity', 'stack', 'biome')).origin, 'bundled');
  await chain.fetchModuleManifest('code');
  assert.equal(chain.getModuleRules('code', 'stack')[0].id, 'biome');
  assert.deepEqual([unavailable.counts.manifest, local.counts.manifest], [1, 1]);
  console.log('PASS operation manifest cache shared by picker and generic sync, including failed sources');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
