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

console.log(`\nextension-selection: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
