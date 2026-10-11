// Unit tests for the extension item selection model: the listing of items (L), reading a stored
// selection (N, P), the decision table (D), manifest filters (F), flag resolution (K), difference
// and summary (X), item descriptions and dangling preloads (S), the record in .unikit.json (C, B).
// Consumed from scripts/test-skills.sh (Part 7f7). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const S = await import(dist('core/extension-selection.js'));
const Q = await import(dist('core/extension-selection-query.js'));
const D = await import(dist('core/extension-selection-describe.js'));
const config = await import(dist('core/config.js'));
const constants = await import(dist('core/constants.js'));
const { buildExtensionRecord, loadExtensionManifest } = await import(dist('core/extensions.js'));

let passed = 0;
let failed = 0;

function fail(name, detail) {
    failed++;
    console.error(`FAIL [${name}] ${detail}`);
}

function pass(name) {
    passed++;
    console.log(`PASS [${name}]`);
}

function assertEq(name, actual, expected) {
    if (actual === expected) {
        pass(name);
    } else {
        fail(name, `\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

// Structural comparison through JSON (key order is part of the contract for maps built in item order).
function assertJson(name, actual, expected) {
    assertEq(name, JSON.stringify(actual), JSON.stringify(expected));
}

function assertTrue(name, condition, detail = '') {
    if (condition) {
        pass(name);
    } else {
        fail(name, detail || 'condition is false');
    }
}

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

async function withTmp(fn) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-ext-selection-'));
    try {
        await fn(dir);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
}

const manifest = (over = {}) => ({ name: 'ext-a', version: '1.0.0', ...over });
const rec = (over = {}) => ({ name: 'ext-a', source: 'x', version: '1.0.0', ...over });
const sel = (skills = {}, subagents = {}, mcpServers = {}) => ({ skills, subagents, mcpServers });
const has = (map, key) => Object.hasOwn(map, key);

// ── L: listing the items of a manifest ──────────────────────────────────────

await group('L', async () => {
    const m = manifest({
        skills: ['skills/b', 'skills/a'],
        replaces: { 'skills/c': 'unikit-commit' },
        subagents: ['subagents/x.md'],
        mcpServers: [{ key: 'm', template: './m.json' }],
    });
    const items = S.listExtensionItems(m);
    assertJson('L1 keys in manifest order, replacements after own skills', items.map(i => i.key),
        ['skills/b', 'skills/a', 'skills/c', 'subagents/x.md', 'm']);
    assertJson('L1 kinds', items.map(i => i.kind), ['skills', 'skills', 'skills', 'subagents', 'mcpServers']);
    assertJson('L1 names', items.map(i => i.name), ['b', 'a', 'c', 'x', 'm']);
    assertJson('L1 installsOwn is false only for a replacement-only skill', items.map(i => i.installsOwn),
        [true, true, false, true, true]);
    assertEq('L1 MCP item carries the template path', items[4].template, './m.json');

    const both = S.listExtensionItems(manifest({
        skills: ['skills/c'], replaces: { 'skills/c': 'unikit-commit' },
    }));
    assertEq('L2 a path in skills and replaces is one item', both.length, 1);
    assertEq('L2 it installs its own name', both[0].installsOwn, true);
    assertEq('L2 and names the base skill it replaces', both[0].replaces, 'unikit-commit');

    const dup = S.listExtensionItems(manifest({
        skills: ['skills/a', 'skills/a'],
        subagents: ['subagents/readme.txt', 'subagents/x.md', 'subagents/x.md'],
        mcpServers: [{ key: 'm', template: 'a.json' }, { key: 'm', template: 'b.json' }],
    }));
    assertJson('L3 duplicates collapse and a non-markdown subagent is not an item',
        dup.map(i => i.key), ['skills/a', 'subagents/x.md', 'm']);
    assertEq('L3 the first MCP entry wins', dup[2].template, 'a.json');

    assertEq('L4 label of an own skill', S.itemLabel(items[0]), 'b');
    assertEq('L4 label of a replacement', S.itemLabel(items[2]), 'c → unikit-commit');
    assertEq('L4 label of own + replacement', S.itemLabel(both[0]), 'c (+ unikit-commit)');
    assertEq('L4 label of a subagent is its name without .md', S.itemLabel(items[3]), 'x');

    const odd = S.listExtensionItems(manifest({ skills: ['constructor'], replaces: {} }));
    assertEq('L5 an inherited property name is not a replacement', odd[0].replaces, undefined);
    assertEq('L5 id is kind and key', S.itemId(items[0]), 'skills:skills/b');
});

// ── N: normalizing a stored value ───────────────────────────────────────────

await group('N', async () => {
    for (const [label, raw] of [['undefined', undefined], ['null', null], ['5', 5], ['array', []], ['{}', {}], ['string', 'x']]) {
        assertEq(`N1 ${label} is no selection`, S.normalizeSelection(raw), undefined);
    }

    assertJson('N2 a non-object map reads as empty',
        S.normalizeSelection({ skills: { a: true }, subagents: [], mcpServers: 'x' }),
        sel({ a: true }));
    assertJson('N3 non-boolean values are dropped',
        S.normalizeSelection({ skills: { a: 'yes', b: true, c: 0, d: false } }),
        sel({ b: true, d: false }));

    const proto = S.normalizeSelection(JSON.parse('{"skills":{"__proto__":true}}'));
    assertTrue('N4 a __proto__ key survives as an own property',
        proto !== undefined && has(proto.skills, '__proto__') && proto.skills['__proto__'] === true);
    assertTrue('N4 and does not change the prototype of the map',
        proto !== undefined && Object.getPrototypeOf(proto.skills) === Object.prototype);

    const items = S.listExtensionItems(manifest({ skills: ['a', 'b'], subagents: ['s.md'] }));
    assertJson('N5 allEnabled marks every item',
        S.allEnabled(items), sel({ a: true, b: true }, { 's.md': true }));
    assertJson('N6 emptySelection', S.emptySelection(), sel());
});

// ── P: the decisions an installed extension brings into a run ───────────────

await group('P', async () => {
    assertEq('P1 no record is a first install', S.priorSelectionOf(undefined, null), null);
    assertEq('P1 even with a manifest on disk', S.priorSelectionOf(undefined, manifest({ skills: ['a'] })), null);

    const saved = sel({ a: false, b: true });
    assertJson('P2 a valid selection is returned', S.priorSelectionOf(rec({ selection: saved }), null), saved);

    assertJson('P3 a legacy record turns on what the previous manifest offered',
        S.priorSelectionOf(rec(), manifest({ skills: ['a', 'b'], subagents: ['s.md'] })),
        sel({ a: true, b: true }, { 's.md': true }));
    assertEq('P4 a legacy record without a previous manifest reads as a first install',
        S.priorSelectionOf(rec(), null), null);
    assertJson('P5 a malformed selection is legacy',
        S.priorSelectionOf(rec({ selection: 'x' }), manifest({ skills: ['a'] })), sel({ a: true }));
});

// ── D: the decision table ───────────────────────────────────────────────────

await group('D', async () => {
    const items = S.listExtensionItems(manifest({ skills: ['skills/old', 'skills/new'] }));
    const installed = sel({ 'skills/old': false });
    const decide = (over) => S.decideSelection({
        items, prior: installed, skip: new Set(), installNew: false, skipNew: false, ...over,
    });
    const old = 'skills/old';
    const nu = 'skills/new';

    let r = decide({ prior: null });
    assertTrue('D1 first install, no flags: everything on', r.skills[old] === true && r.skills[nu] === true);

    r = decide({ prior: null, skip: new Set(['skills:skills/old']) });
    assertTrue('D2 first install, --skip names old: old off, new on', r.skills[old] === false && r.skills[nu] === true);

    r = decide({ prior: null, installNew: true, skipNew: true });
    assertTrue('D3 first install ignores --install-new and --skip-new', r.skills[old] === true && r.skills[nu] === true);

    r = decide({});
    assertTrue('D4 installed, no flags: old stays off', r.skills[old] === false);
    assertTrue('D4 and the new item stays undecided', !has(r.skills, nu));

    r = decide({ installNew: true });
    assertTrue('D5 --install-new does not turn an earlier "off" on', r.skills[old] === false);
    assertTrue('D5 and turns the undecided item on', r.skills[nu] === true);

    r = decide({ skipNew: true });
    assertTrue('D6 --skip-new leaves the new item undecided', !has(r.skills, nu));

    r = decide({ installNew: true, skipNew: true });
    assertTrue('D7 --skip-new wins over --install-new', !has(r.skills, nu));

    r = decide({ installNew: true, skip: new Set(['skills:skills/new']) });
    assertTrue('D8 a --skip name beats --install-new', r.skills[nu] === false);

    r = decide({ prior: sel({ 'skills/old': true, 'skills/new': true }), skip: new Set(['skills:skills/old']) });
    assertTrue('D9 a --skip name turns a decided "on" off', r.skills[old] === false);
    assertTrue('D9 and leaves the other decision', r.skills[nu] === true);

    r = decide({ skipNew: true, skip: new Set(['skills:skills/new']) });
    assertTrue('D10 a --skip name decides the item even with --skip-new', r.skills[nu] === false);

    const odd = S.listExtensionItems(manifest({ skills: ['__proto__', 'ok'] }));
    r = S.decideSelection({ items: odd, prior: null, skip: new Set(), installNew: false, skipNew: false });
    assertTrue('D11 a __proto__ item key is decided as an own key', has(r.skills, '__proto__') && r.skills['__proto__'] === true);
});

// ── F: manifest filters ─────────────────────────────────────────────────────

await group('F', async () => {
    const injections = [{ id: 'x' }];
    const commands = [{ name: 'c', description: 'd', module: 'm.js' }];
    const m = manifest({
        skills: ['skills/a', 'skills/b'],
        replaces: { 'skills/c': 'unikit-commit' },
        subagents: ['subagents/h.md', 'subagents/notes.txt'],
        mcpServers: [{ key: 'srv', template: 't.json' }],
        injections,
        commands,
    });

    assertTrue('F1 no selection returns the same object', S.filterManifest(m, undefined) === m);

    const off = sel(
        { 'skills/a': false, 'skills/b': true, 'skills/c': false },
        { 'subagents/h.md': true },
        { srv: false },
    );
    const filtered = S.filterManifest(m, off);
    assertJson('F2 skills narrowed', filtered.skills, ['skills/b']);
    assertJson('F2 replaces narrowed', filtered.replaces, {});
    assertJson('F2 subagents narrowed, non-markdown dropped', filtered.subagents, ['subagents/h.md']);
    assertJson('F2 MCP servers narrowed', filtered.mcpServers, []);
    assertTrue('F2 injections and commands are untouched', filtered.injections === injections && filtered.commands === commands);
    assertEq('F2 identity fields are untouched', `${filtered.name}@${filtered.version}`, 'ext-a@1.0.0');
    assertJson('F2 the source manifest is not changed', m.skills, ['skills/a', 'skills/b']);

    const undecided = S.filterManifest(m, sel({ 'skills/a': true }));
    assertJson('F3 an undecided item is not installed', undecided.skills, ['skills/a']);

    const items = S.listExtensionItems(m);
    const subset = S.manifestSubset(m, [items.find(i => i.key === 'skills/b')]);
    assertJson('F4 subset keeps only the given item', subset.skills, ['skills/b']);
    assertTrue('F4 subset has no injections and no commands', subset.injections === undefined && subset.commands === undefined);
    assertJson('F4 subset has no other kinds', [subset.subagents, subset.mcpServers, subset.replaces], [[], [], {}]);

    assertEq('F5 no enabled replacement gives no replacedSkills',
        S.deriveReplacedSkills(m, sel({ 'skills/c': false })), undefined);
    assertJson('F5 an enabled replacement gives base → path',
        S.deriveReplacedSkills(m, sel({ 'skills/c': true })), { 'unikit-commit': 'skills/c' });
    assertJson('F5 no selection counts every replacement',
        S.deriveReplacedSkills(m, undefined), { 'unikit-commit': 'skills/c' });
    assertEq('F5 a manifest without replaces gives undefined',
        S.deriveReplacedSkills(manifest({ skills: ['a'] }), undefined), undefined);

    assertJson('F6 a disabled own skill is a disabled target',
        [...S.disabledOwnTargets(m, sel({ 'skills/a': false, 'skills/b': true })).skills], ['a']);
    assertJson('F6 an undecided own skill is a disabled target',
        [...S.disabledOwnTargets(m, sel({ 'skills/b': true })).skills], ['a']);
    assertEq('F6 a disabled replacement is not a disabled target',
        S.disabledOwnTargets(m, sel({ 'skills/a': true, 'skills/b': true, 'skills/c': false })).skills.size, 0);
    const twin = manifest({ skills: ['x/foo', 'y/foo'] });
    assertEq('F6 an enabled item of the same name keeps the name out',
        S.disabledOwnTargets(twin, sel({ 'x/foo': false, 'y/foo': true })).skills.size, 0);
    assertJson('F6 a disabled subagent is a disabled target',
        [...S.disabledOwnTargets(m, sel({ 'skills/a': true, 'skills/b': true }, { 'subagents/h.md': false })).subagents], ['h']);
    assertEq('F6 no selection disables nothing', S.disabledOwnTargets(m, undefined).skills.size, 0);
});

// ── K: --skip-* names ───────────────────────────────────────────────────────

await group('K', async () => {
    const m = manifest({
        skills: ['skills/a', 'other/a', 'skills/b', 'a'],
        subagents: ['subagents/helper.md'],
        mcpServers: [{ key: 'srv', template: 't.json' }],
    });
    const items = S.listExtensionItems(m);
    const none = { skills: [], subagents: [], mcpServers: [] };
    const run = (over) => Q.resolveSkipFlags(items, { ...none, ...over });

    let r = run({ skills: ['skills/b'] });
    assertTrue('K1 a manifest path is found', r.ok && r.ids.has('skills:skills/b'));
    r = run({ skills: ['b'] });
    assertTrue('K2 a unique basename is found', r.ok && r.ids.has('skills:skills/b'));
    r = run({ skills: ['a'] });
    assertTrue('K3 an exact key wins over names that also match', r.ok && r.ids.has('skills:a') && r.ids.size === 1);

    const twin = S.listExtensionItems(manifest({ skills: ['skills/a', 'other/a'] }));
    r = Q.resolveSkipFlags(twin, { ...none, skills: ['a'] });
    assertTrue('K4 an ambiguous basename is an error', !r.ok && r.error.includes('Ambiguous'));
    assertTrue('K4 naming both paths', !r.ok && r.error.includes('skills/a') && r.error.includes('other/a'));

    r = run({ skills: ['x'] });
    assertTrue('K5 an unknown name is an error', !r.ok && r.error.startsWith('Unknown skill "x" for --skip-skills'));
    assertTrue('K5 listing what is available', !r.ok && r.error.includes('Available:') && r.error.includes('b'));

    r = Q.resolveSkipFlags(S.listExtensionItems(manifest({ skills: ['a'] })), { ...none, mcpServers: ['srv'] });
    assertTrue('K6 a flag for a kind with no items is an error',
        !r.ok && r.error === '--skip-mcp given, but the extension offers no mcp servers');

    r = run({ subagents: ['helper'] });
    assertTrue('K7 a subagent by name without .md', r.ok && r.ids.has('subagents:subagents/helper.md'));
    r = run({ subagents: ['subagents/helper.md'] });
    assertTrue('K7 a subagent by path', r.ok && r.ids.has('subagents:subagents/helper.md'));
    r = run({ mcpServers: ['srv'] });
    assertTrue('K8 an MCP server by key', r.ok && r.ids.has('mcpServers:srv'));
    r = run({ mcpServers: ['nope'] });
    assertTrue('K8 an unknown server is an error', !r.ok && r.error.startsWith('Unknown MCP server "nope" for --skip-mcp'));

    r = run({ skills: ['', '  skills/b  ', ' '] });
    assertTrue('K9 empty elements are ignored and spaces trimmed', r.ok && r.ids.size === 1 && r.ids.has('skills:skills/b'));
    r = run({});
    assertTrue('K10 no names, no ids', r.ok && r.ids.size === 0);
});

// ── X: difference, normalizing, applying decisions, summary ─────────────────

await group('X', async () => {
    const items = S.listExtensionItems(manifest({ skills: ['a', 'b', 'c'], subagents: ['s.md'] }));
    const idsOf = list => list.map(i => i.key);

    let diff = Q.diffSelection(items, undefined, sel({ a: true, b: false, c: true }, { 's.md': false }));
    assertJson('X1 legacy before: the items turned off are disabled', idsOf(diff.disable), ['b', 's.md']);
    assertJson('X1 legacy before: nothing is newly enabled', idsOf(diff.enable), []);

    diff = Q.diffSelection(items, sel({ a: true }), sel({ a: true, b: true }));
    assertJson('X2 an undecided item turned on is newly enabled', idsOf(diff.enable), ['b']);
    assertJson('X2 an undecided item left undecided is neither', idsOf(diff.disable), []);

    diff = Q.diffSelection(items, sel({ a: true, b: true }), sel({ a: false, b: true }));
    assertJson('X3 an item turned off is disabled', idsOf(diff.disable), ['a']);

    const narrowed = S.normalizeToItems(
        { skills: { a: true, gone: false }, subagents: { 'x.md': true }, mcpServers: {} },
        items,
    );
    assertJson('X4 normalizeToItems drops keys that are not items', narrowed, sel({ a: true }));

    const applied = S.applyDecisions(items, sel({ a: true, b: true }), new Map([['skills:a', false], ['skills:c', false]]));
    assertEq('X5 a decision "off" is recorded', applied.skills['a'], false);
    assertEq('X5 a prior decision stays', applied.skills['b'], true);
    assertEq('X5 a decision for an undecided item is recorded', applied.skills['c'], false);
    assertTrue('X5 an item with no decision stays undecided', !has(applied.subagents, 's.md'));

    assertJson('X6 pendingItems lists the undecided', idsOf(S.pendingItems(items, sel({ a: true }, { 's.md': true }))), ['b', 'c']);

    const checked = S.selectionFromChecked(items, new Set(['skills:a', 'subagents:s.md']));
    assertJson('X7 selectionFromChecked decides every item', checked, sel({ a: true, b: false, c: false }, { 's.md': true }));

    const sum = Q.summarizeSelection(items, sel({ a: true, b: false }, { 's.md': true }));
    assertJson('X8 summary splits enabled / disabled / undecided',
        [sum.skills.enabled, sum.skills.disabled, sum.skills.undecided, sum.skills.total], [['a'], ['b'], ['c'], 3]);
    assertJson('X8 summary of subagents', sum.subagents.enabled, ['s']);
    assertEq('X8 summary of an empty kind', sum.mcpServers.total, 0);
    assertJson('X9 no selection: everything enabled', Q.summarizeSelection(items, undefined).skills.enabled, ['a', 'b', 'c']);

    assertJson('X10 kinds and their order', [...constants.EXTENSION_ITEM_KINDS], ['skills', 'subagents', 'mcpServers']);
    assertTrue('X10 the skip reason target-disabled has a hint', typeof constants.EXTENSION_SKIP_HINTS['target-disabled'] === 'string');
});

// ── S: descriptions and dangling preloads ───────────────────────────────────

await group('S', async () => {
    assertEq('S1 control characters become spaces and runs collapse',
        D.sanitizeDisplayText('a\u001b[31mb\nc', 100), 'a [31mb c');
    assertEq('S1 CR and tab', D.sanitizeDisplayText('a\r\n\tb'), 'a b');
    const cut = D.sanitizeDisplayText('x'.repeat(300), 100);
    assertEq('S1 a long text is cut to the limit', cut.length, 100);
    assertTrue('S1 and ends with an ellipsis', cut.endsWith('…'));
    assertEq('S1 without a limit nothing is cut', D.sanitizeDisplayText('x'.repeat(300)).length, 300);

    const fm = (body) => `---\nname: n\n${body}\n---\n\n# Title\n`;
    assertEq('S2 plain description', D.readFrontmatterDescription(fm('description: some text')), 'some text');
    assertEq('S2 quoted description keeps the colon', D.readFrontmatterDescription(fm('description: "quoted: text"')), 'quoted: text');
    assertEq('S2 folded block scalar', D.readFrontmatterDescription(fm('description: >-\n  first line\n  second line')), 'first line second line');
    assertEq('S2 no description field', D.readFrontmatterDescription(fm('other: x')), null);
    assertEq('S2 no frontmatter', D.readFrontmatterDescription('# Title\n'), null);
    assertEq('S2 CRLF frontmatter', D.readFrontmatterDescription('---\r\ndescription: crlf\r\n---\r\n'), 'crlf');

    assertJson('S3 inline skills list', D.readPreloadedSkills(fm('skills: [a, "b"]')), ['a', 'b']);
    assertJson('S3 block skills list', D.readPreloadedSkills(fm('skills:\n  - a\n  - "b"')), ['a', 'b']);
    assertJson('S3 a scalar is not a list', D.readPreloadedSkills(fm('skills: a')), []);
    assertJson('S3 no skills field', D.readPreloadedSkills(fm('other: x')), []);

    await withTmp(async (dir) => {
        await fs.mkdir(path.join(dir, 'skills', 's1'), { recursive: true });
        await fs.mkdir(path.join(dir, 'subagents'), { recursive: true });
        await fs.mkdir(path.join(dir, 'mcp'), { recursive: true });
        await fs.writeFile(path.join(dir, 'skills', 's1', 'SKILL.md'), '---\nname: s1\ndescription: Skill one\n---\n');
        await fs.writeFile(path.join(dir, 'subagents', 'helper.md'), '---\nname: helper\ndescription: A helper\nskills: [beta]\n---\n');
        await fs.writeFile(path.join(dir, 'mcp', 'ok.json'), JSON.stringify({ command: 'npx', args: ['-y', 'pkg'], env: { TOKEN: 's3cr3t' } }));
        await fs.writeFile(path.join(dir, 'mcp', 'url.json'), JSON.stringify({ url: 'https://example.test/mcp', headers: { Authorization: 'Bearer zzz' } }));
        await fs.writeFile(path.join(dir, 'mcp', 'bad.json'), JSON.stringify({ foo: 1 }));

        const m = manifest({
            skills: ['skills/s1', '../outside'],
            subagents: ['subagents/helper.md'],
            mcpServers: [
                { key: 'ok', template: 'mcp/ok.json' },
                { key: 'url', template: 'mcp/url.json' },
                { key: 'bad', template: 'mcp/bad.json' },
                { key: 'gone', template: 'mcp/missing.json' },
            ],
        });
        const views = await D.describeExtensionItems(dir, S.listExtensionItems(m));
        const view = (id) => views.find(v => v.id === id);

        assertEq('S4 skill description', view('skills:skills/s1').description, 'Skill one');
        assertEq('S4 subagent description', view('subagents:subagents/helper.md').description, 'A helper');
        assertEq('S4 MCP command and args', view('mcpServers:ok').description, 'npx -y pkg');
        assertTrue('S4 MCP env values are not shown',
            !JSON.stringify(view('mcpServers:ok')).includes('s3cr3t') && !JSON.stringify(view('mcpServers:ok')).includes('TOKEN'));
        assertEq('S4 MCP url', view('mcpServers:url').description, 'https://example.test/mcp');
        assertTrue('S4 MCP headers are not shown', !JSON.stringify(view('mcpServers:url')).includes('Bearer'));
        assertTrue('S4 a template without command and url is unusable', typeof view('mcpServers:bad').unusable === 'string');
        assertTrue('S4 a missing template is unusable', view('mcpServers:gone').unusable.startsWith('template not found:'));
        assertEq('S4 a path leaving the extension has no description', view('skills:../outside').description, undefined);
        assertEq('S4 the label of a skill', view('skills:skills/s1').label, 's1');

        const full = manifest({ skills: ['skills/alpha', 'skills/beta'], subagents: ['subagents/helper.md'] });
        const dangling = (selection, over = full) => D.findDanglingPreloads(dir, over, selection);

        assertJson('S5 a selected subagent preloading a disabled skill is reported',
            await dangling(sel({ 'skills/alpha': true, 'skills/beta': false }, { 'subagents/helper.md': true })),
            [{ subagent: 'helper', skills: ['beta'] }]);
        assertJson('S5 an enabled skill is not reported',
            await dangling(sel({ 'skills/alpha': true, 'skills/beta': true }, { 'subagents/helper.md': true })), []);
        assertJson('S5 a disabled subagent is not scanned',
            await dangling(sel({ 'skills/beta': false }, { 'subagents/helper.md': false })), []);
        assertJson('S5 a disabled replacement is not reported',
            await dangling(
                sel({ 'skills/beta': false }, { 'subagents/helper.md': true }),
                manifest({ replaces: { 'skills/beta': 'unikit-x' }, subagents: ['subagents/helper.md'] }),
            ), []);
        assertJson('S5 no selection reports nothing', await dangling(undefined), []);
        assertEq('S5 the warning text',
            D.formatDanglingPreload('ext-a', { subagent: 'helper', skills: ['beta', 'gamma'] }),
            'ext-a: subagent "helper" preloads skill "beta", "gamma", left out of the selection');
    });

    const helloDir = path.join(ROOT, 'examples', 'extensions', 'unikit-ext-hello');
    const hello = await loadExtensionManifest(helloDir);
    assertTrue('S6 the hello example manifest loads', hello !== null);
    if (hello !== null) {
        const helloViews = await D.describeExtensionItems(helloDir, S.listExtensionItems(hello));
        assertEq('S6 hello skill description', helloViews.find(v => v.kind === 'skills').description, 'A test skill from an extension');
        assertEq('S6 hello subagent description', helloViews.find(v => v.kind === 'subagents').description, 'A test subagent from an extension');
    }
});

// ── C: the record in .unikit.json ───────────────────────────────────────────

await group('C', async () => {
    await withTmp(async (dir) => {
        const valid = sel({ a: true, b: false }, { 's.md': true });
        const raw = {
            version: '2.5.0',
            engine: 'unity',
            agents: [],
            extensions: [
                { name: 'e1', source: 'p', version: '1.0.0', selection: valid },
                { name: 'e2', source: 'p', version: '1.0.0', selection: [] },
                { name: 'e3', source: 'p', version: '1.0.0', selection: 'x' },
                { name: 'e4', source: 'p', version: '1.0.0', selection: { skills: { a: 'yes', b: true } }, futureField: 7 },
                { name: 'e5', source: 'p', version: '1.0.0' },
            ],
        };
        await fs.writeFile(path.join(dir, '.unikit.json'), JSON.stringify(raw));

        const loaded = await config.loadConfig(dir);
        const byName = Object.fromEntries(loaded.extensions.map(e => [e.name, e]));
        assertJson('C1 a valid selection is kept as is', byName.e1.selection, valid);
        assertEq('C2 an array selection reads as no selection', byName.e2.selection, undefined);
        assertEq('C3 a string selection reads as no selection', byName.e3.selection, undefined);
        assertJson('C4 a partly valid selection keeps the boolean entries', byName.e4.selection, sel({ b: true }));
        assertEq('C4 fields this version does not know are kept', byName.e4.futureField, 7);
        assertEq('C5 a record without the field stays without it', has(byName.e5, 'selection'), false);

        await config.saveConfig(dir, loaded);
        const again = await config.loadConfig(dir);
        assertJson('C6 save and load again is idempotent', again.extensions, loaded.extensions);
    });
});

// ── B: building the record ──────────────────────────────────────────────────

await group('B', async () => {
    const resolved = {
        manifest: manifest({
            skills: ['skills/a'],
            replaces: { 'skills/c': 'unikit-commit' },
            subagents: ['subagents/h.md'],
        }),
        source: { type: 'local', raw: './ext', resolved: '/abs/ext' },
        localPath: '/abs/ext',
    };

    const legacy = buildExtensionRecord(resolved);
    assertJson('B1 without a selection every replacement counts', legacy.replacedSkills, { 'unikit-commit': 'skills/c' });
    assertEq('B1 and no selection field is written', has(legacy, 'selection'), false);

    const withOff = buildExtensionRecord(resolved, sel({ 'skills/a': true, 'skills/c': false, 'gone': true }, { 'subagents/h.md': true }));
    assertEq('B2 a disabled replacement is not in replacedSkills', withOff.replacedSkills, undefined);
    assertJson('B2 the selection is narrowed to the offered items',
        withOff.selection, sel({ 'skills/a': true, 'skills/c': false }, { 'subagents/h.md': true }));
    assertJson('B3 the record keeps its key order',
        Object.keys(buildExtensionRecord(resolved, sel({ 'skills/c': true }))), ['name', 'source', 'version', 'replacedSkills', 'selection']);
});

// ── A, I, J: the selection applied in the core ──────────────────────────────

const { collectExtensionSkillNames } = await import(dist('core/installer/agent-removal.js'));
const { reinstallExtensionAssets } = await import(dist('core/extension-ops.js'));
const { applyExtensionInjections } = await import(dist('core/extension-injections.js'));

const CLAUDE = { id: 'claude', skillsDir: '.claude/skills', subagentsDir: '.claude/agents', installedSkills: [], installedSubagents: [] };
const exists = async (p) => fs.access(p).then(() => true, () => false);

async function writeFiles(root, files) {
    for (const [rel, text] of Object.entries(files)) {
        const file = path.join(root, rel);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, text);
    }
}

const skillMd = (name, body = name) => `---\nname: ${name}\ndescription: ${name}\n---\n\n${body}\n`;

// A — which skill names an agent removal takes out.
await group('A', async () => {
    await withTmp(async (dir) => {
        await writeFiles(dir, {
            '.unikit/extensions/ext-a/extension.json': JSON.stringify({
                name: 'ext-a', version: '1.0.0', skills: ['skills/a', 'skills/b'], replaces: { 'skills/c': 'unikit-commit' },
            }),
        });
        const names = async (record) => (await collectExtensionSkillNames(dir, { extensions: [record] })).sort();

        assertJson('A1 only the enabled skill and no disabled replacement',
            await names(rec({ selection: sel({ 'skills/a': false, 'skills/b': true, 'skills/c': false }) })), ['b']);
        assertJson('A2 an enabled replacement names its base skill',
            await names(rec({ selection: sel({ 'skills/a': true, 'skills/b': false, 'skills/c': true }) })), ['a', 'unikit-commit']);
        assertJson('A3 a legacy record names everything, as before', await names(rec()), ['a', 'b', 'unikit-commit']);
        assertJson('A4 replacedSkills of the record still add their base names',
            await names(rec({
                replacedSkills: { 'unikit-plan': 'skills/x' },
                selection: sel({ 'skills/a': false, 'skills/b': false, 'skills/c': false }),
            })), ['unikit-plan']);
        assertJson('A5 an undecided skill is not named', await names(rec({ selection: sel({ 'skills/b': true }) })), ['b']);
    });
});

// I — what `init` puts back follows the selection.
await group('I', async () => {
    await withTmp(async (tmp) => {
        await writeFiles(tmp, {
            '.unikit/extensions/ext-a/extension.json': JSON.stringify({
                name: 'ext-a',
                version: '1.0.0',
                skills: ['skills/foo', 'skills/skipped'],
                subagents: ['subagents/bar.md', 'subagents/off.md'],
                replaces: { 'skills/my-commit': 'unikit-commit' },
            }),
            '.unikit/extensions/ext-a/skills/foo/SKILL.md': skillMd('foo'),
            '.unikit/extensions/ext-a/skills/skipped/SKILL.md': skillMd('skipped'),
            '.unikit/extensions/ext-a/skills/my-commit/SKILL.md': skillMd('my-commit', 'REPLACEMENT TEXT'),
            '.unikit/extensions/ext-a/subagents/bar.md': skillMd('bar'),
            '.unikit/extensions/ext-a/subagents/off.md': skillMd('off'),
            '.claude/skills/unikit-commit/SKILL.md': skillMd('unikit-commit', 'BASE TEXT'),
        });

        const selected = rec({
            selection: sel(
                { 'skills/foo': true, 'skills/skipped': false, 'skills/my-commit': false },
                { 'subagents/bar.md': true, 'subagents/off.md': false },
            ),
        });
        const result = await reinstallExtensionAssets({
            projectDir: tmp, engine: 'unity', engineMcpKey: null, agents: [CLAUDE], extensions: [selected],
        });
        assertEq('I1 the extension is reinstalled', result.reinstalled.join(','), 'ext-a');
        assertEq('I1 the enabled skill is there', await exists(path.join(tmp, '.claude/skills/foo/SKILL.md')), true);
        assertEq('I1 the disabled skill is not', await exists(path.join(tmp, '.claude/skills/skipped')), false);
        assertEq('I1 the enabled subagent is there', await exists(path.join(tmp, '.claude/agents/bar.md')), true);
        assertEq('I1 the disabled subagent is not', await exists(path.join(tmp, '.claude/agents/off.md')), false);
        assertTrue('I1 the disabled replacement leaves the base skill alone',
            (await fs.readFile(path.join(tmp, '.claude/skills/unikit-commit/SKILL.md'), 'utf8')).includes('BASE TEXT'));

        await reinstallExtensionAssets({
            projectDir: tmp, engine: 'unity', engineMcpKey: null, agents: [CLAUDE], extensions: [rec()],
        });
        assertTrue('I2 a legacy record installs everything, replacement included',
            (await fs.readFile(path.join(tmp, '.claude/skills/unikit-commit/SKILL.md'), 'utf8')).includes('REPLACEMENT TEXT'));
        assertEq('I2 and the skipped skill comes with it', await exists(path.join(tmp, '.claude/skills/skipped/SKILL.md')), true);
    });
});

// J — a position injection into a skill the selection left out.
await group('J', async () => {
    const runPass = (tmp, record) => applyExtensionInjections({
        projectDir: tmp, engine: 'unity', engineMcpKey: null, agents: [CLAUDE], extensions: [record],
    });
    const quietly = async (fn) => {
        const original = console.warn;
        const lines = [];
        console.warn = (...args) => { lines.push(args.join(' ')); };
        try {
            return { result: await fn(), lines };
        } finally {
            console.warn = original;
        }
    };
    const setup = async (tmp, manifestOver, installed) => {
        await writeFiles(tmp, {
            '.unikit/extensions/ext-a/extension.json': JSON.stringify({ name: 'ext-a', version: '1.0.0', ...manifestOver }),
            '.unikit/extensions/ext-a/inj/t.md': 'INJECTED TEXT',
            ...Object.fromEntries(installed.map(name => [`.claude/skills/${name}/SKILL.md`, skillMd(name)])),
        });
    };
    const append = (target) => ({ target, targetType: 'skill', position: 'append', file: 'inj/t.md' });

    await withTmp(async (tmp) => {
        await setup(tmp, { skills: ['skills/beta'], injections: [append('beta')] }, ['beta']);
        const { result, lines } = await quietly(() => runPass(tmp, rec({ selection: sel({ 'skills/beta': false }) })));
        assertEq('J1 one outcome', result.outcomes.length, 1);
        assertEq('J1 it is not applied', result.outcomes[0].applied, false);
        assertEq('J1 with its own reason', result.outcomes[0].reason, 'target-disabled');
        assertTrue('J1 and no raw "target not found" warning', !lines.some(line => line.includes('Injection target not found')), lines.join('\n'));
        assertTrue('J1 the installed copy is untouched', !(await fs.readFile(path.join(tmp, '.claude/skills/beta/SKILL.md'), 'utf8')).includes('INJECTED TEXT'));
    });

    await withTmp(async (tmp) => {
        await setup(tmp, { skills: ['skills/beta'], injections: [append('beta')] }, ['beta']);
        const { result } = await quietly(() => runPass(tmp, rec({ selection: sel({ 'skills/beta': true }) })));
        assertEq('J2 an enabled target is applied', result.applied, 1);
        assertTrue('J2 the text is in the skill', (await fs.readFile(path.join(tmp, '.claude/skills/beta/SKILL.md'), 'utf8')).includes('INJECTED TEXT'));
    });

    await withTmp(async (tmp) => {
        await setup(tmp, { skills: ['skills/beta'], injections: [append('beta')] }, ['beta']);
        const { result } = await quietly(() => runPass(tmp, rec()));
        assertEq('J3 a legacy record applies as before', result.applied, 1);
    });

    await withTmp(async (tmp) => {
        await setup(tmp, { replaces: { 'skills/my': 'unikit-commit' }, injections: [append('unikit-commit')] }, ['unikit-commit']);
        const { result } = await quietly(() => runPass(tmp, rec({ selection: sel({ 'skills/my': false }) })));
        assertEq('J4 an injection into the base skill of a disabled replacement is applied', result.applied, 1);
    });

    await withTmp(async (tmp) => {
        await setup(tmp, { skills: ['x/beta', 'y/beta'], injections: [append('beta')] }, ['beta']);
        const { result } = await quietly(() => runPass(tmp, rec({ selection: sel({ 'x/beta': false, 'y/beta': true }) })));
        assertEq('J5 an enabled skill of the same name keeps the target', result.applied, 1);
    });
});

// ── M: the interface layer ──────────────────────────────────────────────────

const optionsApi = await import(dist('cli/commands/extension-options.js'));
const ui = await import(dist('cli/commands/extension-selection-ui.js'));

await group('M', async () => {
    assertJson('M1 names are split, trimmed and appended', optionsApi.collectNameList('a, b,,c', ['x']), ['x', 'a', 'b', 'c']);
    assertJson('M1 no previous list', optionsApi.collectNameList('a'), ['a']);

    const show = (over) => optionsApi.shouldShowMenu({ interactive: true, itemCount: 3, installed: false, options: {}, ...over });
    assertEq('M2 no terminal: no menu', show({ interactive: false }), false);
    assertEq('M2 nothing to choose: no menu', show({ itemCount: 0 }), false);
    assertEq('M2 --yes: no menu', show({ options: { yes: true } }), false);
    assertEq('M2 --skip-skills: no menu', show({ options: { skipSkills: ['x'] } }), false);
    assertEq('M2 --skip-mcp: no menu', show({ options: { skipMcp: ['x'] } }), false);
    assertEq('M2 first install with --install-new still shows it', show({ options: { installNew: true } }), true);
    assertEq('M2 first install with --skip-new still shows it', show({ options: { skipNew: true } }), true);
    assertEq('M2 installed with --install-new: no menu', show({ installed: true, options: { installNew: true } }), false);
    assertEq('M2 installed with --skip-new: no menu', show({ installed: true, options: { skipNew: true } }), false);
    assertEq('M2 a terminal and no flags: the menu', show({}), true);
    assertEq('M2 installed, terminal, no flags: the menu', show({ installed: true }), true);

    assertEq('M3 no flags change nothing', optionsApi.hasSelectionChange({}), false);
    assertEq('M3 --yes alone changes nothing', optionsApi.hasSelectionChange({ yes: true }), false);
    assertEq('M3 --skip-new alone changes nothing', optionsApi.hasSelectionChange({ skipNew: true }), false);
    assertEq('M3 --install-new changes', optionsApi.hasSelectionChange({ installNew: true }), true);
    assertEq('M3 --skip-mcp changes', optionsApi.hasSelectionChange({ skipMcp: ['a'] }), true);
    assertJson('M3 skipFlagsOf maps the three lists', optionsApi.skipFlagsOf({ skipSkills: ['a'], skipMcp: ['m'] }),
        { skills: ['a'], subagents: [], mcpServers: ['m'] });

    const views = [
        { id: 'mcpServers:srv', kind: 'mcpServers', key: 'srv', label: 'srv', description: 'npx -y pkg' },
        { id: 'mcpServers:bad', kind: 'mcpServers', key: 'bad', label: 'bad', unusable: 'template not found: t.json' },
        { id: 'skills:a', kind: 'skills', key: 'a', label: 'a', description: 'First' },
        { id: 'skills:b', kind: 'skills', key: 'b', label: 'b' },
    ];
    const rows = ui.buildMenuRows(views, sel({ a: false }, {}, {}));
    assertJson('M4 sections follow Skills, MCP servers and an empty one is not printed',
        rows.filter(r => r.type === 'separator').map(r => r.text), ['-- Skills --', '-- MCP servers --']);
    const item = (id) => rows.find(r => r.type === 'item' && r.id === id);
    assertEq('M4 a decided "off" is unchecked', item('skills:a').checked, false);
    assertEq('M4 an undecided item is checked', item('skills:b').checked, true);
    assertEq('M4 the description follows the label', item('skills:a').name, 'a — First');
    assertEq('M4 an unusable item is unchecked', item('mcpServers:bad').checked, false);
    assertEq('M4 and disabled with its reason', item('mcpServers:bad').disabled, 'template not found: t.json');
    assertTrue('M4 a first install checks everything usable', ui.buildMenuRows(views, null).filter(r => r.type === 'item' && r.checked).length === 3);

    const items = S.listExtensionItems(manifest({
        skills: ['a', 'b', 'c', 'd', 'e'], subagents: ['s1.md', 's2.md'],
    }));
    const lines = ui.formatSelectionSummary(items, sel(
        { a: false, b: false, c: true, d: true, e: true }, { 's1.md': true, 's2.md': true },
    ));
    assertJson('M5 skipped items are named and a full kind has no tail', lines, ['Skills: 3 of 5 — skipped: a, b', 'Subagents: 2 of 2']);
    const withUndecided = ui.formatSelectionSummary(items, sel({ a: false, b: false, d: true, e: true }, { 's1.md': true, 's2.md': true }));
    assertEq('M5 undecided items are listed', withUndecided[0], 'Skills: 2 of 5 — skipped: a, b — not installed (undecided): c');
    const dirty = S.listExtensionItems(manifest({ skills: ['x\u001b[31my'] }));
    assertTrue('M5 labels are cleaned of escape characters', !ui.formatSelectionSummary(dirty, sel({ 'x\u001b[31my': false }))[0].includes('\u001b'));

    assertJson('M6 nothing pending, nothing printed', ui.formatPendingNotice([]), []);
    const notice = ui.formatPendingNotice([{ extension: 'ext-a', items: ['Skills: c', 'MCP servers: m'] }]);
    assertEq('M6 one line per extension', notice.length, 1);
    assertTrue('M6 it names the select command', notice[0].includes('unikit-ai extension select ext-a'));
    assertTrue('M6 and the flag', notice[0].includes('--install-new'));
    assertTrue('M6 and the items', notice[0].includes('Skills: c; MCP servers: m'));

    const request = { extension: 'ext-a', version: '2.0.0', sourceDir: '/nowhere', items };
    const offline = { interactive: () => false };
    const yes = await ui.buildNewItemsChooser({ installNew: true }, offline)(request);
    assertTrue('M7 --install-new answers yes to every item', yes.size === items.length && [...yes.values()].every(v => v === true));
    const both = await ui.buildNewItemsChooser({ skipNew: true, installNew: true }, offline)(request);
    assertEq('M7 --skip-new wins and answers nothing', both.size, 0);
    const none = await ui.buildNewItemsChooser({}, offline)(request);
    assertEq('M7 no terminal and no flag answers nothing', none.size, 0);
});

console.log(`\nextension-selection: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
