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
  await fs.appendFile(providerRulePath(lifecycleDir, 'biome'), '\nuser edit');
  assert.equal((await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry)).events.some(e => e.kind === 'phase2:skipped-local-mod'), true);
  await fs.unlink(providerRulePath(lifecycleDir, 'biome'));
  await syncRulesState(lifecycleDir, 'unity', module, lifecycle, syncRegistry, { replace: true, prune: true });
  assert.equal(await fs.stat(providerRulePath(lifecycleDir, 'biome')).catch(() => null), null);
  assert.equal(lifecycle.rules.installed.modules.code.stack.length, 0);
  console.log('PASS provider sync: fallback outside winner/prune, equal-version origin/body refresh, no-op, edited guard, missing replace/prune');
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
