// Guards for how a skill names its reference files (RP-1…RP-4), consumed from scripts/test-skills.sh
// (Part 7g12). Pure fs over skills/**/*.md: reads the sources, imports nothing from dist/, writes
// nothing. Only `.md` files are scanned, because only they are run through the {{…}} substitution.
//
//   RP-1  a file of ANOTHER skill is written with the install directory: {{skills_dir}}/unikit-<skill>/…
//   RP-2  the pinned sites (the table in PINNED_SITES) say the full path and not the old wording
//   RP-3  a skill's OWN file that is named bare somewhere also has a full path somewhere in that skill
//   RP-4  a skill's OWN file that is named bare in a .md also has a full path in THAT .md
//
// Order of mentions (full path before the short ones) is deliberately not checked: a long SKILL.md is
// not read top to bottom, and an order check would raise false alarms. Self-tests at the end mutate
// in-memory text so that a green run proves each guard is able to fail.

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

// ── Constants ───────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(ROOT, 'skills');
const MARKDOWN_EXTENSION = '.md';
const SKILL_SUBDIRS = 'references|scripts|templates|assets';
const SKILLS_DIR_MARK = '{{skills_dir}}';
const SELF_NAME_MARK = '{{self_name}}';

// RP-1: `unikit-<skill>/<subdir>/<file>` that is not preceded by the install directory mark and is not
// part of a longer path (`.unikit/skill-context/…` and `/unikit-…` after a directory do not match).
const CROSS_SKILL_RE = new RegExp(
    String.raw`(?<!\{\{skills_dir\}\}\/)(?<![A-Za-z0-9_.-])unikit(?:-[a-z0-9]+)*\/(?:${SKILL_SUBDIRS})\/[A-Za-z0-9_.-]+`,
    'g',
);
const PREFIXED_CROSS_SKILL_RE = new RegExp(
    String.raw`\{\{skills_dir\}\}\/unikit(?:-[a-z0-9]+)*\/(?:${SKILL_SUBDIRS})\/`,
    'g',
);
// RP-3 / RP-4: a bare `<subdir>/<file>.<ext>` (not after a path character) and the full own-file form.
const BARE_OWN_RE = new RegExp(
    String.raw`(?<![A-Za-z0-9_.\/}-])(${SKILL_SUBDIRS})\/([A-Za-z0-9_.-]+\.[A-Za-z0-9]+)`,
    'g',
);
const FULL_OWN_RE = new RegExp(
    String.raw`\{\{skills_dir\}\}\/\{\{self_name\}\}\/(${SKILL_SUBDIRS})\/([A-Za-z0-9_.-]+\.[A-Za-z0-9]+)`,
    'g',
);

const HINT_CROSS_SKILL = `write ${SKILLS_DIR_MARK}/unikit-<skill>/<subdir>/<file> (the skill name literally)`;
const HINT_OWN_SKILL = `write ${SKILLS_DIR_MARK}/${SELF_NAME_MARK}/<subdir>/<file> at least once`;
const HINT_OWN_FILE = `write ${SKILLS_DIR_MARK}/${SELF_NAME_MARK}/<subdir>/<file> where this file first names it`;

const EXPECTED_MIN_COUNT = 1;

const FULL_SELF = (subdirFile) => `${SKILLS_DIR_MARK}/${SELF_NAME_MARK}/${subdirFile}`;
const COHERENCE_CALL = `Read ${FULL_SELF('references/coherence-gate.md')} and run`;
const VALIDATOR_FULL = FULL_SELF('references/VALIDATOR.md');
const CHECK_MODE_FULL = FULL_SELF('references/CHECK-MODE.md');
const HTML_TEMPLATE_FULL = FULL_SELF('templates/html-template.html');
const METHODS_FULL = `${SKILLS_DIR_MARK}/unikit-gd-brainstorm/references/methods.md`;
const ENGINE_RULES_FULL = `${SKILLS_DIR_MARK}/unikit-plan/references/ENGINE_RULES.md`;

// RP-2: the single place a new pinned site is added. `require` substrings must be present, `forbid`
// substrings absent (wording, never headings).
const PINNED_SITES = [
    { file: 'unikit-implement/SKILL.md', require: [ENGINE_RULES_FULL, '§6 is owned by the `unikit-plan` skill'], forbid: ["inside that skill's own directory"] },
    { file: 'unikit-improve/SKILL.md', require: [CHECK_MODE_FULL, VALIDATOR_FULL], forbid: [] },
    { file: 'unikit-review/SKILL.md', require: [CHECK_MODE_FULL, VALIDATOR_FULL], forbid: [] },
    { file: 'unikit-improve/references/CHECK-MODE.md', require: [`Read \`${VALIDATOR_FULL}\``], forbid: [] },
    { file: 'unikit-review/references/CHECK-MODE.md', require: [`Read \`${VALIDATOR_FULL}\``], forbid: [] },
    { file: 'unikit-explore/SKILL.md', require: [COHERENCE_CALL], forbid: ['<path of references/'] },
    { file: 'unikit-gd-explore/SKILL.md', require: [COHERENCE_CALL, FULL_SELF('references/delegation-contract.md')], forbid: ['<path of references/'] },
    { file: 'unikit-docs/SKILL.md', require: [HTML_TEMPLATE_FULL], forbid: ['Read `templates/html-template.html`'] },
    { file: 'unikit-docs/references/HTML-GENERATION.md', require: [HTML_TEMPLATE_FULL], forbid: ['Read `templates/html-template.html`'] },
    { file: 'unikit-gd-explore/references/market-scan.md', require: [METHODS_FULL], forbid: ['in `brainstorm/references/methods.md`'] },
];

// ── Pure detectors ──────────────────────────────────────────────────────────

const normalize = (text) => text.replaceAll('\r\n', '\n');

function lineOf(text, index) {
    let line = 1;
    for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
    return line;
}

// RP-1: every `unikit-<skill>/<subdir>/<file>` that lacks the install directory.
export function findUnprefixedCrossSkillPaths(text) {
    const hits = [];
    for (const match of text.matchAll(CROSS_SKILL_RE)) {
        hits.push({ line: lineOf(text, match.index), token: match[0] });
    }
    return hits;
}

export function countPrefixedCrossSkillPaths(text) {
    return [...text.matchAll(PREFIXED_CROSS_SKILL_RE)].length;
}

function collectFullForms(text) {
    const forms = new Set();
    for (const match of text.matchAll(FULL_OWN_RE)) forms.add(`${match[1]}/${match[2]}`);
    return forms;
}

// RP-3 (scope 'skill') and RP-4 (scope 'file'). `files` — [{ rel, text }] of ONE skill; `exists(subdirFile)`
// tells whether the token names a real file of that skill (a token that does not is somebody else's file,
// and RP-1 covers it). Returns the recognized own-file mentions and those without a full form in scope.
export function findBareOwnPaths(files, exists, scope) {
    const skillForms = new Set();
    if (scope === 'skill') for (const file of files) for (const form of collectFullForms(file.text)) skillForms.add(form);

    const recognized = [];
    const uncovered = [];
    for (const file of files) {
        const covered = scope === 'skill' ? skillForms : collectFullForms(file.text);
        for (const match of file.text.matchAll(BARE_OWN_RE)) {
            const token = `${match[1]}/${match[2]}`;
            if (!exists(token)) continue;
            const hit = { rel: file.rel, line: lineOf(file.text, match.index), token };
            recognized.push(hit);
            if (!covered.has(token)) uncovered.push(hit);
        }
    }
    return { recognized, uncovered };
}

// RP-2: the problems of one pinned site in `text` (empty when the site is fine).
export function checkPinnedSite(site, text) {
    const problems = [];
    for (const needle of site.require) if (!text.includes(needle)) problems.push(`missing: ${needle}`);
    for (const needle of site.forbid) if (text.includes(needle)) problems.push(`forbidden: ${needle}`);
    return problems;
}

// ── Harness ─────────────────────────────────────────────────────────────────

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

function assertTrue(name, condition, detail = '') {
    if (condition) pass(name);
    else fail(name, detail || 'condition is false');
}

async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

async function walkMarkdown(dir) {
    const found = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) found.push(...await walkMarkdown(full));
        else if (entry.isFile() && entry.name.endsWith(MARKDOWN_EXTENSION)) found.push(full);
    }
    return found;
}

const rel = (file) => path.relative(SKILLS_DIR, file).replaceAll('\\', '/');

// ── The tree ────────────────────────────────────────────────────────────────

const markdown = [];
const bySkill = new Map();
const existing = new Set();

for (const file of (await walkMarkdown(SKILLS_DIR)).sort()) {
    const entry = { rel: rel(file), text: normalize(await fs.readFile(file, 'utf8')) };
    markdown.push(entry);
    const skill = entry.rel.split('/')[0];
    if (!bySkill.has(skill)) bySkill.set(skill, []);
    bySkill.get(skill).push(entry);
}
for (const skill of bySkill.keys()) {
    for (const subdir of SKILL_SUBDIRS.split('|')) {
        const dir = path.join(SKILLS_DIR, skill, subdir);
        const names = await fs.readdir(dir).catch(() => []);
        for (const name of names) existing.add(`${skill}/${subdir}/${name}`);
    }
}
const existsFor = (skill) => (token) => existing.has(`${skill}/${token}`);

let prefixedForms = 0;
for (const entry of markdown) prefixedForms += countPrefixedCrossSkillPaths(entry.text);

// ── RP-1 ────────────────────────────────────────────────────────────────────

await group('RP-1', async () => {
    let hits = 0;
    const files = new Set();
    for (const entry of markdown) {
        for (const hit of findUnprefixedCrossSkillPaths(entry.text)) {
            fail('RP-1', `${entry.rel}:${hit.line} ${hit.token} — ${HINT_CROSS_SKILL}`);
            hits++;
            files.add(entry.rel);
        }
    }
    console.log(`  RP-1: ${markdown.length} file(s) scanned, ${prefixedForms} prefixed cross-skill form(s), ${hits} bare hit(s) in ${files.size} file(s)`);
    assertTrue('RP-1 some files were scanned', markdown.length >= EXPECTED_MIN_COUNT, '0 files scanned');
    assertTrue('RP-1 some prefixed cross-skill forms were found', prefixedForms >= EXPECTED_MIN_COUNT, 'no `{{skills_dir}}/unikit-…` form found: the detector is broken');
    if (hits === 0) pass('RP-1 every file of another skill is written with the install directory');
});

// ── RP-2 ────────────────────────────────────────────────────────────────────

await group('RP-2', async () => {
    const byRel = new Map(markdown.map(entry => [entry.rel, entry.text]));
    let bad = 0;
    for (const site of PINNED_SITES) {
        const text = byRel.get(site.file);
        if (text === undefined) {
            fail('RP-2', `${site.file} — pinned file does not exist`);
            bad++;
            continue;
        }
        for (const problem of checkPinnedSite(site, text)) {
            fail('RP-2', `${site.file} — ${problem}`);
            bad++;
        }
    }
    console.log(`  RP-2: ${PINNED_SITES.length} pinned site(s) checked`);
    assertTrue('RP-2 the pinned-site table is not empty', PINNED_SITES.length >= EXPECTED_MIN_COUNT);
    if (bad === 0) pass('RP-2 every pinned site says the full path');
});

// ── RP-3 and RP-4 ───────────────────────────────────────────────────────────

for (const [family, scope, hint, label] of [
    ['RP-3', 'skill', HINT_OWN_SKILL, 'a skill names each of its own files by the full path at least once'],
    ['RP-4', 'file', HINT_OWN_FILE, 'a file names each of its own skill files by the full path where it mentions them'],
]) {
    await group(family, async () => {
        let recognized = 0;
        const uncovered = [];
        for (const [skill, files] of bySkill) {
            const result = findBareOwnPaths(files, existsFor(skill), scope);
            recognized += result.recognized.length;
            uncovered.push(...result.uncovered);
        }
        for (const hit of uncovered) fail(family, `${hit.rel}:${hit.line} ${hit.token} — ${hint}`);
        const files = new Set(uncovered.map(hit => hit.rel));
        console.log(`  ${family}: ${recognized} own-file mention(s) recognized, ${uncovered.length} without a full form in ${files.size} file(s)`);
        assertTrue(`${family} some own-file mentions were recognized`, recognized >= EXPECTED_MIN_COUNT, 'no own-file mention recognized: the detector is broken');
        if (uncovered.length === 0) pass(`${family} ${label}`);
    });
}

// ── Self-tests: one mutation per invariant ──────────────────────────────────

await group('RP-self', async () => {
    const bare = '`unikit-plan/references/TASK-FORMAT.md`';
    const prefixed = `\`${SKILLS_DIR_MARK}/unikit-plan/references/TASK-FORMAT.md\``;
    assertTrue('RP-1 self: a bare cross-skill path is caught', findUnprefixedCrossSkillPaths(`See ${bare}.`).length === 1);
    assertTrue('RP-1 self: a prefixed cross-skill path is accepted', findUnprefixedCrossSkillPaths(`See ${prefixed}.`).length === 0);
    assertTrue('RP-1 self: a project override path is not a skill file', findUnprefixedCrossSkillPaths('Use `.unikit/skill-context/unikit-plan/SKILL.md`.').length === 0);

    const own = (dir, text) => ({ rel: `unikit-x/${dir}`, text });
    const exists = (token) => token === 'references/a.md';
    const bareMention = own('SKILL.md', 'Then see `references/a.md`.');
    const fullMention = `Read \`${FULL_SELF('references/a.md')}\`.`;
    assertTrue('RP-3 self: a bare own file with no full form is caught', findBareOwnPaths([bareMention], exists, 'skill').uncovered.length === 1);
    assertTrue(
        'RP-3 self: a full form in the skill clears it',
        findBareOwnPaths([bareMention, own('references/b.md', fullMention)], exists, 'skill').uncovered.length === 0,
    );
    assertTrue('RP-3 self: a token that is not a file of the skill is skipped', findBareOwnPaths([own('SKILL.md', 'See `references/nope.md`.')], exists, 'skill').recognized.length === 0);
    assertTrue(
        'RP-4 self: a full form in ANOTHER file does not clear it',
        findBareOwnPaths([bareMention, own('references/b.md', fullMention)], exists, 'file').uncovered.length === 1,
    );
    assertTrue(
        'RP-4 self: a full form in the same file clears it',
        findBareOwnPaths([own('SKILL.md', `${fullMention} Then see \`references/a.md\`.`)], exists, 'file').uncovered.length === 0,
    );

    const site = { file: 'x', require: ['good phrase'], forbid: ['old phrase'] };
    assertTrue('RP-2 self: a fine text passes', checkPinnedSite(site, 'a good phrase here').length === 0);
    assertTrue('RP-2 self: a forbidden phrase is caught', checkPinnedSite(site, 'a good phrase and the old phrase').length === 1);
    assertTrue('RP-2 self: a missing phrase is caught', checkPinnedSite(site, 'nothing').length === 1);
});

console.log(`\nRP-1…RP-4: ${markdown.length} files scanned, ${prefixedForms} prefixed cross-skill forms, ${PINNED_SITES.length} pinned sites, ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
