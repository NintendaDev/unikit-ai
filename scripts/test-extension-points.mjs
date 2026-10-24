// Unit tests for extension points: the registry and name checks (R) and the pure marker primitives
// (M). Consumed from scripts/test-skills.sh (Part 7f6). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const points = await import(dist('core/extension-points.js'));
const markers = await import(dist('core/extension-markers.js'));
const hashing = await import(dist('core/installer/hashing.js'));
const { hashFile } = await import(dist('utils/fs.js'));
const schema = await import(dist('core/extension-injections-schema.js'));
const { validateManifest } = await import(dist('core/extensions.js'));

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

// ── R: the registry and the name checks ─────────────────────────────────────

await group('R', async () => {
    const registry = await points.loadExtensionPointRegistry();
    const keys = Object.keys(registry.skills);
    console.log(`  R: ${keys.length} registry target(s) scanned`);

    assertTrue('R1 the registry is not empty', keys.length > 0, 'registry has no skill targets');
    assertEq('R1 the registry lists 35 skills', keys.length, 35);
    assertTrue(
        'R1 every skill offers exactly the point "bootstrap"',
        keys.every(key => JSON.stringify(registry.skills[key]) === '["bootstrap"]'),
        keys.filter(key => JSON.stringify(registry.skills[key]) !== '["bootstrap"]').join(', '),
    );
    assertTrue(
        'R1 the two skills without an extension point are not listed',
        !('unikit-skills-context' in registry.skills) && !('unikit-help' in registry.skills),
    );

    const missing = [];
    for (const key of keys) {
        try {
            await fs.access(path.join(ROOT, 'skills', key, 'SKILL.md'));
        } catch {
            missing.push(key);
        }
    }
    assertEq('R2 every registry key is a skill directory with a SKILL.md', missing.join(', '), '');

    assertEq('R3 the subagents section is empty', Object.keys(registry.subagents).length, 0);

    for (const name of ['bootstrap', 'before-tasks', 'a1']) {
        assertEq(`R4 point "${name}" is valid`, points.validatePointName(name), null);
    }
    for (const name of ['', 'Bootstrap', '1a', 'a_b', 'a b', 'foo-agent', 'a'.repeat(65)]) {
        assertTrue(`R4 point "${name.length > 20 ? name.length + ' chars' : name}" is rejected`, typeof points.validatePointName(name) === 'string'
            && points.validatePointName(name).startsWith('point'));
    }
    for (const id of ['spec-line', 'a1']) {
        assertEq(`R4 id "${id}" is valid`, points.validateInjectionId(id), null);
    }
    for (const id of ['', 'Spec', '-a', 'a:b', 'a b']) {
        assertTrue(`R4 id "${id}" is rejected`, typeof points.validateInjectionId(id) === 'string'
            && points.validateInjectionId(id).startsWith('id'));
    }

    assertEq('R5 slug of @scope/pkg', points.extensionSlug('@scope/pkg'), '=scope+pkg');
    assertEq('R5 slug of a/b', points.extensionSlug('a/b'), 'a+b');
    assertEq('R5 slug of a.b', points.extensionSlug('a.b'), 'a.b');
    assertTrue('R5 @a/b and a/b differ', points.extensionSlug('@a/b') !== points.extensionSlug('a/b'));
    const names = ['a', 'a.b', 'a-b', 'a_b', 'a/b', '@a', '@a/b', '@a/b.c', 'b/a', '@b/a', 'a@b', 'ab'];
    const slugs = new Set(names.map(points.extensionSlug));
    assertEq('R5 twelve distinct names give twelve distinct slugs', slugs.size, names.length);
    assertTrue(
        'R5 a slug holds no path separator',
        names.every(name => !/[\\/]/.test(points.extensionSlug(name))),
    );

    const manual = { skills: { 'unikit-plan': ['bootstrap'] }, subagents: {} };
    assertEq('R6 a known skill offers bootstrap', JSON.stringify(points.registeredPoints(manual, 'skill', 'unikit-plan')), '["bootstrap"]');
    assertEq('R6 an unknown skill offers nothing', JSON.stringify(points.registeredPoints(manual, 'skill', 'nope')), '[]');
    assertEq('R6 a subagent target offers nothing', JSON.stringify(points.registeredPoints(manual, 'subagent', 'unikit-plan')), '[]');
    assertEq('R6 a prototype key is not a target', JSON.stringify(points.registeredPoints(manual, 'skill', 'constructor')), '[]');
});

// ── M: the marker primitives ────────────────────────────────────────────────

const ANCHOR = '<!-- unikit:extension-point:bootstrap -->';
const key = (id) => markers.pointBlockKey('ext-a', 'unikit-plan', 'bootstrap', id);
const region = (id, text = `line ${id}`) => markers.renderBlockRegion(key(id), text);

await group('M', async () => {
    // M1 — a block goes right under the anchor in the middle of a file and comes out byte-exact.
    {
        const base = `# Title\n\n${ANCHOR}\n\nNext step\n`;
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertEq('M1 the block sits right under the anchor', inserted, `# Title\n\n${ANCHOR}\n${region('one')}\n\nNext step\n`);
        const back = markers.removePointBlocks(inserted);
        assertEq('M1 removal returns the source byte for byte', back.content, base);
        assertEq('M1 removal counts one block', back.removed, 1);
    }

    // M2 — the anchor on the last line, with and without a trailing newline.
    for (const [label, base] of [['without', `# T\n${ANCHOR}`], ['with', `# T\n${ANCHOR}\n`]]) {
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertTrue(`M2 ${label} a trailing newline: inserted`, typeof inserted === 'string' && inserted.includes(region('one')));
        assertEq(`M2 ${label} a trailing newline: byte-exact removal`, markers.removePointBlocks(inserted).content, base);
    }

    // M3 — two blocks under one anchor, in the given order.
    {
        const base = `A\n${ANCHOR}\nB\n`;
        const inserted = markers.insertAtAnchor(base, 'bootstrap', [region('one'), region('two')]);
        assertEq('M3 the blocks keep the given order', inserted, `A\n${ANCHOR}\n${region('one')}\n${region('two')}\nB\n`);
        assertEq('M3 removing both returns the source', markers.removePointBlocks(inserted).content, base);
        const first = markers.removeBlockByKey(inserted, key('one'));
        assertEq('M3 removing one by key leaves the other in place', first.content, `A\n${ANCHOR}\n${region('two')}\nB\n`);
        assertEq('M3 removing the second one returns the source', markers.removeBlockByKey(first.content, key('two')).content, base);
    }

    // M4 — an indented anchor, and CRLF line ends.
    {
        const indented = `1. step\n   ${ANCHOR}\n2. next\n`;
        const a = markers.insertAtAnchor(indented, 'bootstrap', [region('one')]);
        assertEq('M4 an indented anchor round-trips', markers.removePointBlocks(a).content, indented);
        const crlf = `# T\r\n${ANCHOR}\r\nrest\r\n`;
        const b = markers.insertAtAnchor(crlf, 'bootstrap', [region('one')]);
        assertTrue('M4 a CRLF anchor takes a block', typeof b === 'string' && b.includes(region('one')));
        assertEq('M4 a CRLF anchor round-trips', markers.removePointBlocks(b).content, crlf);
    }

    // M5 — counting anchors and refusing to guess.
    {
        const none = 'no anchor here\n';
        const one = `x\n${ANCHOR}\n`;
        const two = `${ANCHOR}\nx\n${ANCHOR}\n`;
        assertEq('M5 no anchor counts 0', markers.countAnchors(none, 'bootstrap'), 0);
        assertEq('M5 one anchor counts 1', markers.countAnchors(one, 'bootstrap'), 1);
        assertEq('M5 two anchors count 2', markers.countAnchors(two, 'bootstrap'), 2);
        assertEq('M5 no anchor: insertion refused', markers.insertAtAnchor(none, 'bootstrap', [region('one')]), null);
        assertEq('M5 two anchors: insertion refused', markers.insertAtAnchor(two, 'bootstrap', [region('one')]), null);
        assertEq('M5 nothing to insert returns the content', markers.insertAtAnchor(one, 'bootstrap', []), one);
        assertEq('M5 a mention inside a sentence is not an anchor', markers.countAnchors(`see ${ANCHOR} here\n`, 'bootstrap'), 0);
    }

    // M6 — point removal leaves legacy blocks and look-alikes alone.
    {
        const legacyKey = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const legacy = markers.renderBlockRegion(legacyKey, 'old text');
        const text = `A\n${ANCHOR}\n${region('one')}\nB\n\n${legacy}\nunikit-ext:ext-a:x:y:z:start\n`;
        const result = markers.removePointBlocks(text);
        assertEq('M6 only the point block is counted', result.removed, 1);
        assertTrue('M6 the legacy block stays', result.content.includes(legacy));
        assertTrue('M6 the look-alike line stays', result.content.includes('unikit-ext:ext-a:x:y:z:start'));
        assertTrue('M6 the point block is gone', !result.content.includes(region('one')));
    }

    // M7 — the legacy append shape, one block and two.
    {
        const k1 = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const k2 = markers.legacyBlockKey('ext-b', 'unikit-plan', 'append');
        const r1 = markers.renderBlockRegion(k1, 'first');
        const r2 = markers.renderBlockRegion(k2, 'second');
        const one = `A\n\n${r1}\n`;
        assertEq('M7 one legacy append comes out', markers.removeBlockByKey(one, k1).content, 'A\n');
        const two = `A\n\n${r1}\n\n${r2}\n`;
        assertEq('M7 two legacy blocks: first then second', markers.removeBlockByKey(markers.removeBlockByKey(two, k1).content, k2).content, 'A\n');
        assertEq('M7 two legacy blocks: second then first', markers.removeBlockByKey(markers.removeBlockByKey(two, k2).content, k1).content, 'A\n');
        assertEq('M7 the hash view of two legacy blocks', markers.stripBlocksForHash(two), 'A\n');
    }

    // M8 — the legacy prepend shape (a region before the frontmatter).
    {
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'prepend');
        const r = markers.renderBlockRegion(k, 'before everything');
        const base = '---\nname: x\n---\n\n# T\n';
        assertEq('M8 a legacy prepend comes out', markers.removeBlockByKey(`${r}\n${base}`, k).content, base);
    }

    // M9 — prepend after the frontmatter.
    {
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'prepend');
        const r = markers.renderBlockRegion(k, 'after frontmatter');
        const base = '---\nname: x\n---\n\n# T\n';
        const inserted = markers.insertAfterFrontmatter(base, r);
        assertEq('M9 the block sits between the boundary and the blank line', inserted, `---\nname: x\n---\n${r}\n\n# T\n`);
        assertEq('M9 removal returns the source', markers.removeBlockByKey(inserted, k).content, base);
        assertEq('M9 a file with no frontmatter gets the block first', markers.insertAfterFrontmatter('# T\n', r), `${r}\n# T\n`);
    }

    // M10 — the hash view.
    {
        const plain = 'no markers\n';
        assertTrue('M10 a file without markers is returned as it is', markers.stripBlocksForHash(plain) === plain);
        const base = `A\n${ANCHOR}\nB\n`;
        const withBlock = markers.insertAtAnchor(base, 'bootstrap', [region('one')]);
        assertEq('M10 a file with a block hashes as its source', markers.stripBlocksForHash(withBlock), base);
        const k = markers.legacyBlockKey('ext-a', 'unikit-plan', 'append');
        const mixed = `${withBlock.replace(/\n$/, '')}\n\n${markers.renderBlockRegion(k, 'tail')}\n`;
        assertEq('M10 mixed shapes hash as the source', markers.stripBlocksForHash(mixed), base);
        const once = markers.stripBlocksForHash(mixed);
        assertEq('M10 the normalisation is idempotent', markers.stripBlocksForHash(once), once);
    }

    // M11 — a pair with no end is not touched.
    {
        const broken = `A\n${markers.blockStartMarker(key('one'))}\nno end\n`;
        assertEq('M11 a start without an end is not a region', markers.findBlockRegions(broken).length, 0);
        assertEq('M11 point removal leaves it as it is', markers.removePointBlocks(broken).content, broken);
        assertEq('M11 the hash view leaves it as it is', markers.stripBlocksForHash(broken), broken);
    }

    // M12 — what a block text must never contain.
    {
        assertTrue('M12 a marker is detected', markers.containsBlockMarker('x <!-- unikit-ext:a:b:c:d:start --> y'));
        assertTrue('M12 the bare word is not a marker', !markers.containsBlockMarker('the unikit-ext word'));
        assertTrue('M12 an anchor is not a marker', !markers.containsBlockMarker(ANCHOR));
    }
});

// ── H: the installed hash does not see extension blocks ─────────────────────

await group('H', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-ext-hash-'));
    try {
        const skillsDir = '.claude/skills';
        const skillDir = path.join(tmp, skillsDir, 'unikit-x');
        const skillFile = path.join(skillDir, 'SKILL.md');
        await fs.mkdir(path.join(skillDir, 'references'), { recursive: true });
        const base = `---\nname: unikit-x\ndescription: x\n---\n\n# X\n\n${ANCHOR}\n\nBody\n`;
        await fs.writeFile(skillFile, base);
        await fs.writeFile(path.join(skillDir, 'references', 'a.md'), 'reference\n');

        const paths = hashing.resolveSkillPaths(tmp, skillsDir, 'claude', 'unikit-x', path.join(tmp, 'source'));
        const hashNow = () => hashing.hashInstalledSkill(paths);
        const h0 = await hashNow();
        assertTrue('H1 a skill directory hashes', typeof h0 === 'string' && h0.length === 64);

        // H2 — a legacy append block.
        const legacyKey = markers.legacyBlockKey('ext-a', 'unikit-x', 'append');
        await fs.writeFile(skillFile, `${base.trimEnd()}\n\n${markers.renderBlockRegion(legacyKey, 'appended')}\n`);
        assertEq('H2 a legacy append block does not move the hash', await hashNow(), h0);

        // H3 — a point block, then back.
        const withBlock = markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(markers.pointBlockKey('ext-a', 'unikit-x', 'bootstrap', 'one'), 'a line')]);
        await fs.writeFile(skillFile, withBlock);
        assertEq('H3 a point block does not move the hash', await hashNow(), h0);
        await fs.writeFile(skillFile, base);
        assertEq('H3 taking it out does not either', await hashNow(), h0);

        // H4 — prepend before and after the frontmatter.
        const prependKey = markers.legacyBlockKey('ext-a', 'unikit-x', 'prepend');
        const prependRegion = markers.renderBlockRegion(prependKey, 'first');
        await fs.writeFile(skillFile, `${prependRegion}\n${base}`);
        assertEq('H4 a prepend before the frontmatter does not move the hash', await hashNow(), h0);
        await fs.writeFile(skillFile, markers.insertAfterFrontmatter(base, prependRegion));
        assertEq('H4 a prepend after the frontmatter does not move the hash', await hashNow(), h0);

        // H5 — the extension reference directory is invisible, other files are not.
        await fs.writeFile(skillFile, base);
        await fs.mkdir(path.join(skillDir, 'references', 'ext', '=scope+pkg'), { recursive: true });
        await fs.writeFile(path.join(skillDir, 'references', 'ext', '=scope+pkg', 'spec.md'), 'delivered\n');
        assertEq('H5 a file under references/ext does not move the hash', await hashNow(), h0);
        await fs.writeFile(path.join(skillDir, 'references', 'other.md'), 'user file\n');
        assertTrue('H5 another reference file does', (await hashNow()) !== h0);
        await fs.rm(path.join(skillDir, 'references', 'other.md'));

        // H6 — the base text counts, the block text does not.
        await fs.writeFile(skillFile, base.replace('Body', 'Edited body'));
        assertTrue('H6 an edit of the base text moves the hash', (await hashNow()) !== h0);
        const blockKey = markers.pointBlockKey('ext-a', 'unikit-x', 'bootstrap', 'one');
        await fs.writeFile(skillFile, markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(blockKey, 'text one')]));
        const hBlock = await hashNow();
        await fs.writeFile(skillFile, markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion(blockKey, 'a quite different text two')]));
        assertEq('H6 an edit inside a block does not move the hash', await hashNow(), hBlock);

        // H7 — subagent files.
        const agentFile = path.join(tmp, 'agent.md');
        const agentBase = '---\nname: a\n---\n\nBody\n';
        await fs.writeFile(agentFile, agentBase);
        const plainHash = await hashing.hashInstalledSubagent(agentFile);
        assertEq('H7 a file without markers hashes as raw bytes', plainHash, await hashFile(agentFile));
        await fs.writeFile(agentFile, `${agentBase}\n${markers.renderBlockRegion(markers.legacyBlockKey('ext-a', 'a', 'append'), 'tail')}\n`);
        assertEq('H7 a subagent with a block hashes as without', await hashing.hashInstalledSubagent(agentFile), plainHash);

        // H8 — the word in prose is not a marker.
        const prose = `${agentBase}\nunikit-ext: is a word here\n`;
        await fs.writeFile(agentFile, prose);
        assertEq('H8 prose with the word hashes as raw bytes', await hashing.hashInstalledSubagent(agentFile), await hashFile(agentFile));
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});

// ── L: the original position entries on the shared primitives ───────────────

const injections = await import(dist('core/injections.js'));

await group('L', async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-ext-legacy-'));
    try {
        const agent = { id: 'claude', skillsDir: '.claude/skills', subagentsDir: '.claude/agents', installedSkills: [], installedSubagents: [] };
        const file = path.join(tmp, '.claude', 'skills', 't', 'SKILL.md');
        await fs.mkdir(path.dirname(file), { recursive: true });
        const base = '---\nname: t\ndescription: t\n---\n\n# T\n\nBody\n';
        const reset = () => fs.writeFile(file, base);
        const read = () => fs.readFile(file, 'utf8');
        const prepend = { target: 't', targetType: 'skill', position: 'prepend', file: 'p.md' };
        const append = { target: 't', targetType: 'skill', position: 'append', file: 'a.md' };

        // L1 — prepend sits after the frontmatter, is idempotent and exactly removable.
        await reset();
        assertTrue('L1 prepend applies', await injections.applyInjection(tmp, agent, 'ext-a', prepend, 'top text'));
        const once = await read();
        assertTrue('L1 the file still starts with the fence', once.startsWith('---\nname: t'));
        assertTrue('L1 the marker follows the closing fence', once.includes('---\n<!-- unikit-ext:ext-a:t:prepend:start -->'));
        await injections.applyInjection(tmp, agent, 'ext-a', prepend, 'top text');
        assertEq('L1 re-applying changes nothing', await read(), once);
        assertTrue('L1 strip reports a removal', await injections.stripInjection(tmp, agent, 'ext-a', prepend));
        assertEq('L1 strip returns the source byte for byte', await read(), base);

        // L2 — append, idempotency, two extensions removed in either order.
        await reset();
        await injections.applyInjection(tmp, agent, 'ext-a', append, 'tail a');
        const appended = await read();
        assertEq('L2 append is the legacy shape', appended, `${base.trimEnd()}\n\n${markers.renderBlockRegion('ext-a:t:append', 'tail a')}\n`);
        await injections.applyInjection(tmp, agent, 'ext-a', append, 'tail a');
        assertEq('L2 re-applying changes nothing', await read(), appended);
        await injections.stripInjection(tmp, agent, 'ext-a', append);
        assertEq('L2 strip returns the source byte for byte', await read(), base);
        for (const order of [['ext-a', 'ext-b'], ['ext-b', 'ext-a']]) {
            await reset();
            await injections.applyInjection(tmp, agent, 'ext-a', append, 'tail a');
            await injections.applyInjection(tmp, agent, 'ext-b', append, 'tail b');
            for (const name of order) await injections.stripInjection(tmp, agent, name, append);
            assertEq(`L2 two extensions stripped ${order.join(' then ')} give the source`, await read(), base);
        }

        // L3 — a block of the old prepend shape is moved after the frontmatter.
        const oldRegion = markers.renderBlockRegion('ext-a:t:prepend', 'top text');
        await fs.writeFile(file, `${oldRegion}\n${base}`);
        await injections.applyInjection(tmp, agent, 'ext-a', prepend, 'top text');
        const migrated = await read();
        assertTrue('L3 the file starts with the fence again', migrated.startsWith('---\n'));
        assertEq('L3 exactly one block remains', migrated.split('unikit-ext:ext-a:t:prepend:start').length - 1, 1);
        await injections.stripInjection(tmp, agent, 'ext-a', prepend);
        assertEq('L3 and it comes out byte for byte', await read(), base);

        // L4 — strip-all handles position entries only.
        await reset();
        await injections.applyInjection(tmp, agent, 'ext-a', append, 'tail a');
        const pointEntryForT = { target: 't', targetType: 'skill', point: 'bootstrap', id: 'one', file: 'x.md', references: [] };
        const count = await injections.stripAllInjections(tmp, agent, 'ext-a', [append, pointEntryForT]);
        assertEq('L4 one entry was stripped', count, 1);

        // L5 — a missing target is a quiet false and creates nothing.
        const ghost = { target: 'ghost', targetType: 'skill', position: 'append', file: 'a.md' };
        const warn = console.warn;
        console.warn = () => {};
        let result;
        try {
            result = await injections.applyInjection(tmp, agent, 'ext-a', ghost, 'x');
        } finally {
            console.warn = warn;
        }
        assertEq('L5 a missing target returns false', result, false);
        let created = true;
        try {
            await fs.access(path.join(tmp, '.claude', 'skills', 'ghost'));
        } catch {
            created = false;
        }
        assertEq('L5 and no directory is created', created, false);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
});

// ── P: the project-level injection pass ─────────────────────────────────────

const { applyExtensionInjections } = await import(dist('core/extension-injections.js'));
const { renderExtensionText } = await import(dist('core/extension-render.js'));

const CLAUDE = { id: 'claude', skillsDir: '.claude/skills', subagentsDir: '.claude/agents', installedSkills: [], installedSubagents: [] };
const CODEX = { id: 'codex', skillsDir: '.codex/skills', subagentsDir: '.codex/agents', installedSkills: [], installedSubagents: [] };

const skillText = (name, anchors = 1) => `---\nname: ${name}\ndescription: d\n---\n\n# ${name}\n\nStep\n\n${(ANCHOR + '\n\n').repeat(anchors)}Next\n`;

async function withProject(fn) {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-ext-pass-'));
    try {
        await fn(tmp);
    } finally {
        await fs.rm(tmp, { recursive: true, force: true });
    }
}

async function writeSkill(tmp, skillsDir, name, text = skillText(name)) {
    const file = path.join(tmp, skillsDir, name, 'SKILL.md');
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, text);
    return file;
}

async function writeExt(tmp, name, injectionsList, files = {}) {
    const dir = path.join(tmp, '.unikit', 'extensions', ...name.split('/'));
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'extension.json'), JSON.stringify({ name, version: '1.0.0', injections: injectionsList }));
    for (const [rel, text] of Object.entries(files)) {
        await fs.mkdir(path.dirname(path.join(dir, rel)), { recursive: true });
        await fs.writeFile(path.join(dir, rel), text);
    }
    return { name, source: 'test', version: '1.0.0' };
}

const runPass = (tmp, agents, extensions) => applyExtensionInjections({ projectDir: tmp, engine: 'unity', engineMcpKey: null, agents, extensions });
const pointFor = (id, over = {}) => ({ id, target: 'unikit-plan', point: 'bootstrap', file: `inj/${id}.md`, ...over });
const outcomeById = (report, id) => report.outcomes.find(o => o.id === id);
const exists = async (p) => fs.access(p).then(() => true, () => false);

await group('P', async () => {
    // P1 / P2 / P4 — one block, idempotence, and the way back.
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const base = await fs.readFile(file, 'utf8');
        const ext = await writeExt(tmp, 'ext-a', [pointFor('one')], { 'inj/one.md': 'line one\n' });

        const first = await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P1 one entry applied', first.applied, 1);
        assertEq(
            'P1 the block sits under the anchor, the rest is untouched',
            await fs.readFile(file, 'utf8'),
            markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion('ext-a:unikit-plan:bootstrap:one', 'line one')]),
        );
        const afterFirst = await fs.readFile(file, 'utf8');

        const second = await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P2 a second pass leaves the file as it is', await fs.readFile(file, 'utf8'), afterFirst);
        assertEq('P2 and reports the same', `${second.applied}/${second.referencesWritten}`, `${first.applied}/${first.referencesWritten}`);

        await runPass(tmp, [CLAUDE], []);
        assertEq('P4 a pass with no extensions returns the source byte for byte', await fs.readFile(file, 'utf8'), base);
        assertEq('P4 and leaves no reference directory', await exists(path.join(tmp, '.claude/skills/unikit-plan/references/ext')), false);
    });

    // P3 — two extensions in one point: any installation order, one result.
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const a = await writeExt(tmp, 'ext-a', [pointFor('b-line'), pointFor('a-line')], { 'inj/b-line.md': 'a:b', 'inj/a-line.md': 'a:a' });
        const b = await writeExt(tmp, 'ext-b', [pointFor('first')], { 'inj/first.md': 'b:first' });
        await runPass(tmp, [CLAUDE], [a, b]);
        const ab = await fs.readFile(file, 'utf8');
        await runPass(tmp, [CLAUDE], [b, a]);
        const ba = await fs.readFile(file, 'utf8');
        assertEq('P3 the order of the extensions does not change the file', ba, ab);
        const order = ['a:a', 'a:b', 'b:first'].map(text => ab.indexOf(text));
        assertTrue('P3 blocks go by extension, then id', order[0] > 0 && order[0] < order[1] && order[1] < order[2], JSON.stringify(order));
    });

    // P5 — reference files and placeholders.
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const ext = await writeExt(tmp, 'ext-a', [pointFor('one', { references: ['refs/spec.md'] })], {
            'inj/one.md': 'Read {{ext_reference:spec.md}} first',
            'refs/spec.md': 'In {{skills_dir}} for {{self_name}}; call /unikit-plan\n',
        });
        const report = await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P5 one reference file written', report.referencesWritten, 1);
        const refFile = path.join(tmp, '.claude/skills/unikit-plan/references/ext/ext-a/spec.md');
        assertEq('P5 the reference is rendered', await fs.readFile(refFile, 'utf8'), 'In .claude/skills for unikit-plan; call /unikit-plan\n');
        assertTrue(
            'P5 the placeholder in the block is the delivered path',
            (await fs.readFile(file, 'utf8')).includes('Read .claude/skills/unikit-plan/references/ext/ext-a/spec.md first'),
        );
    });

    // P6 / P7 — per-agent rendering and the agent filter.
    await withProject(async (tmp) => {
        const claudeFile = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const codexFile = await writeSkill(tmp, '.codex/skills', 'unikit-plan');
        const ext = await writeExt(tmp, 'ext-a', [pointFor('one', { references: ['refs/spec.md'] })], {
            'inj/one.md': 'run /unikit-plan\n<!-- unikit:agents codex -->\nonly for codex\n<!-- unikit:end -->',
            'refs/spec.md': 'see /unikit-verify\n',
        });
        await runPass(tmp, [CLAUDE, CODEX], [ext]);
        const claudeText = await fs.readFile(claudeFile, 'utf8');
        const codexText = await fs.readFile(codexFile, 'utf8');
        assertTrue('P6 Claude keeps /unikit-plan', claudeText.includes('run /unikit-plan') && !claudeText.includes('$unikit-plan'));
        assertTrue('P6 Codex gets $unikit-plan in the block', codexText.includes('run $unikit-plan'));
        assertEq(
            'P6 Codex gets $unikit-verify in the reference',
            await fs.readFile(path.join(tmp, '.codex/skills/unikit-plan/references/ext/ext-a/spec.md'), 'utf8'),
            'see $unikit-verify\n',
        );
        assertTrue('P7 the codex-only text is absent for Claude', !claudeText.includes('only for codex'));
        assertTrue('P7 and present for Codex', codexText.includes('only for codex'));
    });
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const base = await fs.readFile(file, 'utf8');
        const ext = await writeExt(tmp, 'ext-a', [pointFor('one')], { 'inj/one.md': '<!-- unikit:agents codex -->\nnever closed' });
        const report = await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P7 a broken marker is render-failed', outcomeById(report, 'one')?.reason, 'render-failed');
        assertEq('P7 and the target is untouched', await fs.readFile(file, 'utf8'), base);
    });

    // P8 — every reason a point is not applied.
    await withProject(async (tmp) => {
        await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        await writeSkill(tmp, '.claude/skills', 'unikit', skillText('unikit', 0));
        await writeSkill(tmp, '.claude/skills', 'unikit-todo', skillText('unikit-todo', 2));
        await writeSkill(tmp, '.claude/skills', 'unikit-review');
        await writeSkill(tmp, '.claude/skills', 'unikit-roadmap');
        await writeSkill(tmp, '.claude/skills', 'unikit-rules');
        const ext = await writeExt(tmp, 'ext-a', [
            pointFor('unknown-target', { target: 'not-a-skill', file: 'inj/t.md' }),
            pointFor('unknown-point', { point: 'before-tasks', file: 'inj/t.md' }),
            pointFor('no-anchor', { target: 'unikit', file: 'inj/t.md' }),
            pointFor('two-anchors', { target: 'unikit-todo', file: 'inj/t.md' }),
            pointFor('not-installed', { target: 'unikit-docs', file: 'inj/t.md' }),
            pointFor('no-file', { target: 'unikit-review', file: 'inj/missing.md' }),
            pointFor('no-reference', { target: 'unikit-roadmap', file: 'inj/t.md', references: ['refs/none.md'] }),
            pointFor('unresolved', { target: 'unikit-rules', file: 'inj/u.md' }),
            { id: 'subagent', target: 'develop-agent', targetType: 'subagent', point: 'bootstrap', file: 'inj/t.md' },
        ], { 'inj/t.md': 'text', 'inj/u.md': 'see {{ext_reference:nothing.md}}' });
        const report = await runPass(tmp, [CLAUDE], [ext]);
        const expected = {
            'unknown-target': 'unknown-point', 'unknown-point': 'unknown-point', 'no-anchor': 'anchor-missing',
            'two-anchors': 'anchor-duplicated', 'not-installed': 'target-not-installed', 'no-file': 'source-missing',
            'no-reference': 'source-missing', unresolved: 'reference-unresolved', subagent: 'unknown-point',
        };
        for (const [id, reason] of Object.entries(expected)) {
            const outcome = outcomeById(report, id);
            assertTrue(`P8 ${id} is skipped as ${reason}`, outcome !== undefined && outcome.applied === false && outcome.reason === reason, JSON.stringify(outcome));
        }
        assertEq('P8 nothing was applied', report.applied, 0);
    });

    // P9 — a scoped name keeps one path segment.
    await withProject(async (tmp) => {
        await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const ext = await writeExt(tmp, '@scope/pkg', [pointFor('one', { references: ['refs/spec.md'] })], { 'inj/one.md': 'x', 'refs/spec.md': 'y' });
        await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P9 the reference directory is the slug', await exists(path.join(tmp, '.claude/skills/unikit-plan/references/ext/=scope+pkg/spec.md')), true);
    });

    // P10 — position entries through the pass; both forms in one file.
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const base = await fs.readFile(file, 'utf8');
        const ext = await writeExt(tmp, 'ext-a', [
            pointFor('one'),
            { target: 'unikit-plan', targetType: 'skill', position: 'append', file: 'inj/tail.md' },
            { target: 'unikit-plan', targetType: 'skill', position: 'prepend', file: 'inj/head.md' },
            { target: 'unikit-plan', targetType: 'skill', position: 'append', file: '../outside.md' },
        ], { 'inj/one.md': 'point text', 'inj/tail.md': 'tail text', 'inj/head.md': 'head text' });
        const warn = console.warn;
        console.warn = () => {};
        let report;
        try {
            report = await runPass(tmp, [CLAUDE], [ext]);
        } finally {
            console.warn = warn;
        }
        const text = await fs.readFile(file, 'utf8');
        assertTrue('P10 point, append and prepend are all present', ['point text', 'tail text', 'head text'].every(part => text.includes(part)));
        assertTrue('P10 the file starts with the fence', text.startsWith('---\n'));
        assertTrue('P10 an entry outside the extension is skipped', report.outcomes.some(o => o.reason === 'path-outside-extension'));
        console.warn = () => {};
        try {
            await runPass(tmp, [CLAUDE], [ext]);
        } finally {
            console.warn = warn;
        }
        assertEq('P10 a second pass is idempotent', await fs.readFile(file, 'utf8'), text);
        // Remove the point and position blocks the way the commands do.
        const stripped = markers.removeBlockByKey(markers.removeBlockByKey(markers.removePointBlocks(text).content, 'ext-a:unikit-plan:append').content, 'ext-a:unikit-plan:prepend').content;
        assertEq('P10 taking every block out returns the source', stripped, base);
    });

    // P11 — the pass heals what an absent extension left behind.
    await withProject(async (tmp) => {
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan');
        const base = await fs.readFile(file, 'utf8');
        const orphan = markers.insertAtAnchor(base, 'bootstrap', [markers.renderBlockRegion('gone:unikit-plan:bootstrap:x', 'orphan')]);
        await fs.writeFile(file, orphan);
        const refDir = path.join(tmp, '.claude/skills/unikit-plan/references/ext/old');
        await fs.mkdir(refDir, { recursive: true });
        await fs.writeFile(path.join(refDir, 'x.md'), 'old');
        await runPass(tmp, [CLAUDE], []);
        assertEq('P11 the orphan block is gone', await fs.readFile(file, 'utf8'), base);
        assertEq('P11 and the orphan reference directory too', await exists(path.join(tmp, '.claude/skills/unikit-plan/references/ext')), false);
    });

    // P12 — CRLF and an indented anchor.
    await withProject(async (tmp) => {
        const crlf = `---\r\nname: unikit-plan\r\n---\r\n\r\n1. step\r\n   ${ANCHOR}\r\n2. next\r\n`;
        const file = await writeSkill(tmp, '.claude/skills', 'unikit-plan', crlf);
        const ext = await writeExt(tmp, 'ext-a', [pointFor('one')], { 'inj/one.md': 'crlf line' });
        const report = await runPass(tmp, [CLAUDE], [ext]);
        assertEq('P12 applied under a CRLF indented anchor', report.applied, 1);
        await runPass(tmp, [CLAUDE], []);
        assertEq('P12 and removed byte for byte', await fs.readFile(file, 'utf8'), crlf);
    });

    // P13 — nothing to do, nothing touched.
    await withProject(async (tmp) => {
        const names = ['unikit-plan', 'unikit', 'unikit-fix'];
        const before = {};
        for (const name of names) {
            const file = await writeSkill(tmp, '.claude/skills', name);
            before[name] = await fs.readFile(file, 'utf8');
        }
        const report = await runPass(tmp, [CLAUDE], []);
        assertEq('P13 an empty pass reports nothing', report.total, 0);
        for (const name of names) {
            assertEq(`P13 ${name} is untouched`, await fs.readFile(path.join(tmp, '.claude/skills', name, 'SKILL.md'), 'utf8'), before[name]);
        }
    });

    // P14 — the renderer on its own.
    {
        const ctx = { agent: CLAUDE, engine: 'unity', engineMcpKey: null, target: 'unikit-plan', referenceBaseDir: 'x/y', referenceNames: new Set() };
        const unresolved = renderExtensionText('{{ext_reference:a.md}} and {{ext_reference:b.md}} and {{ext_reference:a.md}}', ctx, 'block');
        assertEq('P14 unresolved names are listed once, in order', unresolved.ok ? 'ok' : `${unresolved.reason}:${unresolved.detail}`, 'reference-unresolved:a.md, b.md');
        const marker = renderExtensionText('x <!-- unikit-ext:a:b:c:d:start --> y', ctx, 'block');
        assertEq('P14 a marker in the text is refused', marker.ok ? 'ok' : marker.reason, 'render-failed');
        const anchor = renderExtensionText(`see ${ANCHOR}`, ctx, 'reference');
        assertEq('P14 an anchor in the text is refused', anchor.ok ? 'ok' : anchor.reason, 'render-failed');
    }
});

// ── F: the printed report ───────────────────────────────────────────────────

const { formatInjectionReport } = await import(dist('cli/commands/injection-report.js'));
const { EXTENSION_SKIP_HINTS } = await import(dist('core/constants.js'));

await group('F', async () => {
    const outcome = (over) => ({
        extension: 'ext-a', id: 'one', kind: 'point', point: 'bootstrap', target: 'unikit-plan',
        targetType: 'skill', agent: 'claude', applied: true, ...over,
    });
    const reportOf = (outcomes, referencesWritten = 0) => ({
        outcomes, applied: outcomes.filter(o => o.applied).length,
        skipped: outcomes.filter(o => !o.applied).length, total: outcomes.length, referencesWritten,
    });

    const clean = formatInjectionReport(reportOf([outcome({}), outcome({ id: 'two' })]));
    assertEq('F1 a clean report is one line', JSON.stringify(clean), '["Injections: 2 of 2 applied"]');

    const withRefs = formatInjectionReport(reportOf([outcome({ references: 3 })], 3));
    assertEq('F1 reference files are counted', withRefs[0], 'Injections: 1 of 1 applied, 3 reference file(s)');

    const skipped = formatInjectionReport(reportOf([
        outcome({ id: 'b', target: 'unikit', applied: false, reason: 'anchor-missing' }),
        outcome({ id: 'a', target: 'unikit-todo', applied: false, reason: 'source-missing', detail: 'inj/a.md' }),
        outcome({ id: 'b', target: 'unikit', agent: 'codex', applied: false, reason: 'anchor-missing' }),
        outcome({ extension: 'ext-0', id: 'z' }),
    ]));
    assertEq('F2 the summary counts every outcome', skipped[0], 'Injections: 1 of 4 applied');
    assertEq('F2 one line per group of skips', skipped.length, 3);
    assertTrue('F2 groups are ordered by extension, then id', skipped[1].startsWith('  ext-a › a →') && skipped[2].startsWith('  ext-a › b →'), skipped.join('\n'));
    assertTrue('F2 the hint of the reason is printed', skipped[2].includes(EXTENSION_SKIP_HINTS['anchor-missing']));
    assertTrue('F2 the detail is printed', skipped[1].includes('— inj/a.md'));
    assertTrue('F2 agents of one group are merged', skipped[2].endsWith('[claude, codex]'), skipped[2]);

    const only = formatInjectionReport(reportOf([outcome({}), outcome({ extension: 'ext-b' })]), { onlyExtension: 'ext-b' });
    assertEq('F3 the report can be limited to one extension', JSON.stringify(only), '["Injections: 1 of 1 applied"]');
    assertEq('F3 an empty report prints nothing', JSON.stringify(formatInjectionReport(reportOf([]))), '[]');
});

// ── I: what init needs back after it reinstalled the base skills ────────────

const { reinstallExtensionAssets } = await import(dist('core/extension-ops.js'));

await group('I', async () => {
    await withProject(async (tmp) => {
        // The extension on disk: a skill, a replacement of unikit-commit, a subagent, a point and an append.
        const dir = path.join(tmp, '.unikit', 'extensions', 'ext-a');
        await fs.mkdir(path.join(dir, 'skills', 'foo'), { recursive: true });
        await fs.mkdir(path.join(dir, 'skills', 'my-commit'), { recursive: true });
        await fs.mkdir(path.join(dir, 'subagents'), { recursive: true });
        await fs.mkdir(path.join(dir, 'inj'), { recursive: true });
        await fs.writeFile(path.join(dir, 'skills', 'foo', 'SKILL.md'), '---\nname: foo\ndescription: foo\n---\n\nFoo skill\n');
        await fs.writeFile(path.join(dir, 'skills', 'my-commit', 'SKILL.md'), '---\nname: my-commit\ndescription: c\n---\n\nREPLACEMENT TEXT\n');
        await fs.writeFile(path.join(dir, 'subagents', 'bar.md'), '---\nname: bar\ndescription: bar\n---\n\nBar agent\n');
        await fs.writeFile(path.join(dir, 'inj', 'point.md'), 'point text');
        await fs.writeFile(path.join(dir, 'inj', 'tail.md'), 'tail text');
        await fs.writeFile(path.join(dir, 'extension.json'), JSON.stringify({
            name: 'ext-a',
            version: '1.0.0',
            skills: ['skills/foo'],
            subagents: ['subagents/bar.md'],
            replaces: { 'skills/my-commit': 'unikit-commit' },
            injections: [
                { id: 'one', target: 'unikit-plan', point: 'bootstrap', file: 'inj/point.md' },
                { target: 'unikit-plan', position: 'append', file: 'inj/tail.md' },
            ],
        }));

        // "After init": the base skills are back, the replacement and the blocks are gone.
        await writeSkill(tmp, '.claude/skills', 'unikit-commit', '---\nname: unikit-commit\ndescription: base\n---\n\nBASE TEXT\n');
        const planFile = await writeSkill(tmp, '.claude/skills', 'unikit-plan');

        const input = {
            projectDir: tmp, engine: 'unity', engineMcpKey: null, agents: [CLAUDE],
            extensions: [{ name: 'ext-a', source: 'x', version: '1.0.0' }, { name: 'ghost', source: 'x', version: '1.0.0' }],
        };
        const restored = await reinstallExtensionAssets(input);
        assertEq('I1 the present extension is reinstalled', restored.reinstalled.join(','), 'ext-a');
        assertEq('I1 the missing one is reported', restored.missing.join(','), 'ghost');
        assertEq('I1 its skill is back', await exists(path.join(tmp, '.claude/skills/foo/SKILL.md')), true);
        assertTrue(
            'I1 the replacement is back under the base name',
            (await fs.readFile(path.join(tmp, '.claude/skills/unikit-commit/SKILL.md'), 'utf8')).includes('REPLACEMENT TEXT'),
        );
        assertEq('I1 its subagent is back', await exists(path.join(tmp, '.claude/agents/bar.md')), true);

        const report = await applyExtensionInjections(input);
        const plan = await fs.readFile(planFile, 'utf8');
        assertTrue('I2 the point block is in place', plan.includes('point text'));
        assertTrue('I2 the append block is in place', plan.includes('tail text'));
        assertEq('I2 both entries applied', report.applied, 2);
    });
});

// ── V: the manifest model and its validation ────────────────────────────────

const manifestWith = (injections) => ({ name: 'ext-a', version: '1.0.0', injections });
const pointEntry = (over = {}) => ({ id: 'spec-line', target: 'unikit-plan', point: 'bootstrap', file: 'inj/a.md', ...over });
const check = (injections) => validateManifest(manifestWith(injections));
const errorOf = (injections) => {
    const result = check(injections);
    return result.valid ? null : result.error;
};

await group('V', async () => {
    // V1 — a valid point entry, normalised.
    {
        const result = check([pointEntry({ references: ['references/a.md'] })]);
        assertTrue('V1 a point entry is valid', result.valid === true, JSON.stringify(result));
        const entry = result.valid ? result.manifest.injections[0] : null;
        assertEq('V1 the point is kept', entry?.point, 'bootstrap');
        assertEq('V1 targetType defaults to skill', entry?.targetType, 'skill');
        assertEq('V1 references are kept', JSON.stringify(entry?.references), '["references/a.md"]');
        const bare = check([pointEntry()]);
        assertEq('V1 missing references become an empty array', JSON.stringify(bare.valid ? bare.manifest.injections[0].references : null), '[]');
    }

    // V2 — position and point are exclusive and one of them is required.
    {
        assertTrue('V2 both position and point are rejected', (errorOf([pointEntry({ position: 'append' })]) ?? '').includes('exactly one'));
        assertTrue('V2 neither is rejected', (errorOf([{ target: 'unikit-plan', file: 'inj/a.md' }]) ?? '').includes('exactly one'));
    }

    // V3 — the id.
    {
        const noId = pointEntry();
        delete noId.id;
        assertTrue('V3 a missing id names injections[0].id', (errorOf([noId]) ?? '').includes('injections[0].id'));
        for (const id of ['Spec', 'a b', 'a:b']) {
            assertTrue(`V3 id "${id}" is rejected`, (errorOf([pointEntry({ id })]) ?? '').startsWith('injections[0].id'));
        }
    }

    // V4 — the point name.
    for (const point of ['Bootstrap', '1a', 'x-agent']) {
        assertTrue(`V4 point "${point}" is rejected`, (errorOf([pointEntry({ point })]) ?? '').startsWith('injections[0].point'));
    }

    // V5 — ids are unique inside one manifest.
    assertTrue(
        'V5 two entries with one id are rejected',
        (errorOf([pointEntry(), pointEntry({ point: 'other', file: 'inj/b.md' })]) ?? '').includes('duplicates'),
    );

    // V6 — `file` stays inside the extension directory.
    for (const file of ['../x.md', '/etc/x', 'C:\\x.md', 'a/../../x']) {
        assertTrue(`V6 file "${file}" is rejected`, (errorOf([pointEntry({ file })]) ?? '').includes('inside the extension directory'));
    }
    for (const file of ['./inj/x.md', 'inj/x.md']) {
        assertTrue(`V6 file "${file}" is valid`, check([pointEntry({ file })]).valid === true);
    }

    // V7 — references.
    {
        assertTrue('V7 references must be an array', (errorOf([pointEntry({ references: 'a.md' })]) ?? '').includes('references must be an array'));
        assertTrue('V7 a number is rejected', (errorOf([pointEntry({ references: [1] })]) ?? '').includes('references[0] must be a string'));
        assertTrue('V7 a basename listed twice is rejected', (errorOf([pointEntry({ references: ['a/x.md', 'b/x.md'] })]) ?? '').includes('twice'));
        assertTrue(
            'V7 one basename on two paths is rejected',
            (errorOf([pointEntry({ references: ['a/x.md'] }), pointEntry({ id: 'second', references: ['b/x.md'] })]) ?? '').includes('conflicts'),
        );
        assertTrue('V7 a name with a space is rejected', (errorOf([pointEntry({ references: ['a/my file.md'] })]) ?? '').includes('valid reference file name'));
        assertTrue(
            'V7 one file in two entries is valid',
            check([pointEntry({ references: ['a/x.md'] }), pointEntry({ id: 'second', references: ['a/x.md'] })]).valid === true,
        );
    }

    // V8 — references need a point.
    assertTrue(
        'V8 references on a position entry are rejected',
        (errorOf([{ target: 'unikit-plan', file: 'inj/a.md', position: 'append', references: ['a.md'] }]) ?? '').includes('requires "point"'),
    );

    // V9 — the original form keeps working.
    {
        const result = check([
            { target: 'unikit-plan', file: 'a.md', position: 'append' },
            { target: 'unikit-plan', file: 'b.md', position: 'prepend', targetType: 'subagent' },
        ]);
        assertTrue('V9 legacy entries are valid', result.valid === true, JSON.stringify(result));
        assertEq('V9 targetType defaults to skill', result.valid ? result.manifest.injections[0].targetType : null, 'skill');
        assertEq('V9 an explicit subagent is kept', result.valid ? result.manifest.injections[1].targetType : null, 'subagent');
        assertTrue(
            'V9 an unknown position keeps the old text',
            (errorOf([{ target: 'unikit-plan', file: 'a.md', position: 'middle' }]) ?? '').includes('must be "append" or "prepend"'),
        );
    }

    // V10 — the files a manifest names.
    {
        const parsed = schema.parseInjections([
            pointEntry({ references: ['r/a.md', 'r/b.md'] }),
            pointEntry({ id: 'second', file: 'inj/a.md', references: ['r/a.md'] }),
            { target: 'unikit-plan', file: 'legacy.md', position: 'append' },
        ]);
        assertTrue('V10 the manifest parses', parsed.ok === true);
        const files = parsed.ok ? schema.collectPointInjectionFiles(parsed.injections) : [];
        assertEq('V10 point files are listed once each', JSON.stringify(files), '["inj/a.md","r/a.md","r/b.md"]');
        const legacy = schema.parseInjections([{ target: 'unikit-plan', file: 'legacy.md', position: 'append' }]);
        assertEq('V10 legacy entries name no point files', JSON.stringify(legacy.ok ? schema.collectPointInjectionFiles(legacy.injections) : null), '[]');
    }

    // V11 — containment.
    assertEq('V11 a child is inside', schema.isInsideDirectory('/a/b', '/a/b/c'), true);
    assertEq('V11 a sibling is outside', schema.isInsideDirectory('/a/b', '/a/x'), false);
    assertEq('V11 the directory itself is not inside', schema.isInsideDirectory('/a/b', '/a/b'), false);
});

// ── EP-1…EP-5: the registry and the anchors in the shipped skills agree ──────
// The guard does not know how many points exist: it counts the pairs the registry lists and prints
// the number, so adding a point (a minor version) needs no edit here, and a registry that vanished
// is `0 pairs`, never a green run.

const ANCHOR_MARK = '<!-- unikit:extension-point:';
const escapeRe = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anchorLine = (point) => new RegExp(`^[ \\t]*${escapeRe(ANCHOR_MARK + point)} -->[ \\t]*$`);

async function listMarkdown(dir) {
    const out = [];
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await listMarkdown(full));
        else if (entry.name.endsWith('.md')) out.push(full);
    }
    return out;
}

await group('EP', async () => {
    // EP-1 — the registry itself.
    let registry = null;
    try {
        registry = JSON.parse(await fs.readFile(path.join(ROOT, 'data', 'extension-points.json'), 'utf8'));
    } catch (error) {
        fail('EP-1', `data/extension-points.json cannot be read: ${error instanceof Error ? error.message : String(error)}`);
        return;
    }
    const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
    if (!isObject(registry) || !isObject(registry.skills) || !isObject(registry.subagents)) {
        fail('EP-1', 'the registry must be an object with "skills" and "subagents" objects');
        return;
    }
    const pairs = [];
    for (const [target, list] of Object.entries(registry.skills)) {
        if (!Array.isArray(list)) {
            fail('EP-1', `skills.${target} is not an array`);
            continue;
        }
        for (const point of list) pairs.push([target, point]);
    }
    console.log(`  EP-1: ${pairs.length} (target, point) pair(s) in the registry`);
    assertTrue('EP-1 the registry lists at least one pair', pairs.length > 0, '0 pairs — the registry is empty or unreadable');
    assertEq(
        'EP-1 subagent points are not supported yet — the pass reports them as unknown-point',
        Object.keys(registry.subagents).length,
        0,
    );

    // EP-2 — every registry pair has its anchor exactly once.
    {
        let bad = 0;
        for (const [target, point] of pairs) {
            const file = path.join(ROOT, 'skills', target, 'SKILL.md');
            let text;
            try {
                text = await fs.readFile(file, 'utf8');
            } catch {
                fail('EP-2', `skills/${target}/SKILL.md does not exist`);
                bad++;
                continue;
            }
            const count = text.split('\n').filter(line => anchorLine(point).test(line)).length;
            if (count !== 1) {
                fail('EP-2', `skills/${target}/SKILL.md carries the anchor "${point}" ${count} time(s), expected exactly 1`);
                bad++;
            }
        }
        if (bad === 0) pass(`EP-2 ${pairs.length} anchors, one per registry pair`);
    }

    // EP-3 — no anchor anywhere else.
    {
        const files = [...await listMarkdown(path.join(ROOT, 'skills')), ...await listMarkdown(path.join(ROOT, 'subagents'))];
        console.log(`  EP-3: ${files.length} markdown file(s) scanned`);
        assertTrue('EP-3 some files were scanned', files.length > 0, '0 files scanned');
        const known = new Set(pairs.map(([target, point]) => `${target}:${point}`));
        let stray = 0;
        for (const file of files) {
            const rel = path.relative(ROOT, file).replaceAll('\\', '/');
            const lines = (await fs.readFile(file, 'utf8')).split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (!lines[i].includes(ANCHOR_MARK)) continue;
                const whole = /^[ \t]*<!-- unikit:extension-point:([a-z][a-z0-9-]*) -->[ \t]*$/.exec(lines[i]);
                const target = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel)?.[1];
                if (!whole || !target || !known.has(`${target}:${whole[1]}`)) {
                    fail('EP-3', `${rel}:${i + 1} an anchor that is not a registry pair on its own line of a SKILL.md`);
                    stray++;
                }
            }
        }
        if (stray === 0) pass('EP-3 no stray anchors');
    }

    // EP-4 — the names are valid by the one rule.
    {
        const invalid = pairs.filter(([, point]) => points.validatePointName(point) !== null);
        assertEq('EP-4 every point name passes validatePointName', invalid.map(([t, p]) => `${t}:${p}`).join(', '), '');
    }

    // EP-5 — precondition of the hash normalisation: one trailing newline.
    {
        const files = [
            ...(await fs.readdir(path.join(ROOT, 'skills'))).map(name => path.join(ROOT, 'skills', name, 'SKILL.md')),
            ...(await fs.readdir(path.join(ROOT, 'subagents'))).filter(name => name.endsWith('.md')).map(name => path.join(ROOT, 'subagents', name)),
        ];
        let scanned = 0;
        let bad = 0;
        for (const file of files) {
            let text;
            try {
                text = await fs.readFile(file, 'utf8');
            } catch {
                continue;
            }
            scanned++;
            if (!text.endsWith('\n') || text.endsWith('\n\n')) {
                fail('EP-5', `${path.relative(ROOT, file).replaceAll('\\', '/')} must end with exactly one newline`);
                bad++;
            }
        }
        console.log(`  EP-5: ${scanned} file(s) scanned`);
        assertTrue('EP-5 some files were scanned', scanned > 0, '0 files scanned');
        if (bad === 0) pass('EP-5 every skill and subagent file ends with exactly one newline');
    }
});

console.log(`\nextension-points: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
