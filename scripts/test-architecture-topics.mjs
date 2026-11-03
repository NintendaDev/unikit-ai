// Guards for the architecture topics (ART-1…ART-14) and for the request-driven modes of unikit-rules (RMI-1…RMI-4),
// consumed from scripts/test-skills.sh (Part 7e8). Pure fs over skills/, subagents/, data/ and docs/: reads the
// sources, imports nothing from dist/, writes nothing. Every guard is anchored on formulations, never on headings,
// counts the objects it looked at, and fails when it found none. The behaviour of the helper script is not here:
// scripts/test-architecture-layout.sh (TAL-1…TAL-14) runs it for real.
//
//   ART-1  the layout of the root and the topic files in SKILL.md (shapes, table, marker, states, anchors)
//   ART-2  the modes: parameter → intent → state, announcements, frontmatter (grants, version, description)
//   ART-3  mode-update.md: nothing removed, the table of kinds, the hand-off block, the new topic, the offer
//   ART-4  mode-optimise.md and architecture-layout.mjs: no item deleted, confirmation, helper limits, constants
//
// Run alone: node scripts/test-architecture-topics.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Constants ───────────────────────────────────────────────────────────────

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER_DIR = 'skills/unikit-architecture';
const OWNER_SKILL = `${OWNER_DIR}/SKILL.md`;
const OWNER_REFS = `${OWNER_DIR}/references`;
const REF_UPDATE = `${OWNER_REFS}/mode-update.md`;
const REF_OPTIMISE = `${OWNER_REFS}/mode-optimise.md`;
const HELPER = `${OWNER_DIR}/scripts/architecture-layout.mjs`;
const HELPER_PATH_FORM = '{{skills_dir}}/{{self_name}}/scripts/architecture-layout.mjs';
const MAX_DESCRIPTION = 1024;
const MAX_REFERENCE_BYTES = 12000;
const MAX_HELPER_LINES = 500;
const LOAD_LINE_PREFIX = 'Read **only** when';
const LOAD_LINE_NUMBER = 3;
const STOP_WORDS_RE = /\b(Unity|Godot|Unreal|GDScript)\b|rogue-brick/;
const CYRILLIC_RE = /[Ѐ-ӿ]/;
const PATTERN_COUNT_FLOOR = 1;

// ── Scaffold ────────────────────────────────────────────────────────────────

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const cases = [];

function guard(id, label, body) {
  const why = [];
  let checked = 0;
  const t = {
    has(text, needle, tag) { checked++; if (!text.includes(needle)) why.push(`${tag ?? 'missing'}: ${needle.slice(0, 80)}`); },
    lacks(text, needle, tag) { checked++; if (text.includes(needle)) why.push(`${tag ?? 'forbidden'}: ${needle.slice(0, 80)}`); },
    ok(condition, tag) { checked++; if (!condition) why.push(tag); },
    seen(n) { checked += n; },
  };
  try { body(t); } catch (e) { why.push(`threw: ${e.message}`); }
  if (checked < PATTERN_COUNT_FLOOR) why.push('checked no object');
  cases.push({ id, label, checked, why });
}

function frontmatter(text) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text);
  return m ? m[1] : '';
}

function foldedDescription(front) {
  const lines = front.split('\n');
  const at = lines.findIndex((l) => /^description:\s*>-?\s*$/.test(l));
  if (at < 0) return '';
  const out = [];
  for (let i = at + 1; i < lines.length && /^ {2}\S/.test(lines[i]); i++) out.push(lines[i].trim());
  return out.join(' ');
}

const SKILL = read(OWNER_SKILL);
const SKILL_FRONT = frontmatter(SKILL);
const UPDATE = read(REF_UPDATE);
const OPTIMISE = read(REF_OPTIMISE);
const HELPER_TEXT = read(HELPER);

// A constant of the helper: `const NAME = '…';` — the literal between the quotes.
function helperConstant(name) {
  const m = new RegExp(`^const ${name} = '(.*)';$`, 'm').exec(HELPER_TEXT);
  return m ? m[1] : null;
}

const refFiles = () => fs.readdirSync(path.join(ROOT, OWNER_REFS)).filter((n) => n.endsWith('.md')).sort();

// ── ART-1 ───────────────────────────────────────────────────────────────────

guard('ART-1', 'layout: shapes, table, marker, states, anchors', (t) => {
  t.has(SKILL, '| Topic | Load when |', 'table header row');
  t.has(SKILL, '`## Topics` and its table exist together or not at all', 'table-with-heading rule');
  t.has(SKILL, '**`Load when` lives only in the root table.**', 'Load when only in the root table');
  t.has(SKILL, 'its sections apply to every task', 'header quote: root applies to every task');
  t.has(SKILL, 'check again when the work moves to a new phase or area, and when unsure, load it', 'header quote: re-check and load when unsure');
  t.has(SKILL, '<!-- unikit:architecture-layout flat -->', 'flat marker');
  t.has(SKILL, 'There is no marker for the topic layout: the `## Topics` table is the sign.', 'no marker for the topic layout');
  const states = ['`topics` | a line `## Topics`', '`flat` | the marker line', '`empty` | no file', '`legacy` | anything else'];
  const at = states.map((s) => SKILL.indexOf(s));
  t.ok(at.every((n) => n >= 0) && at.every((n, i) => i === 0 || n > at[i - 1]), 'the four states in the order topics, flat, empty, legacy');
  t.has(SKILL, 'checked in this order, the first match wins', 'state order rule');
  t.has(SKILL, 'When unsure, the root.', 'when unsure the root');
  t.has(SKILL, '`.unikit/code/architecture/`', 'the neighbouring directory is named');
  t.has(SKILL, 'This skill reads and writes only the first.', 'the neighbouring directory is not ours');
  t.has(SKILL, 'The section names of the template stay: other tools read them by name.', 'template section names stay');
  for (const name of ['## Project', '## Tech Stack', '## Folder Structure', '## Dependency Rules']) t.has(SKILL, name, `section name ${name}`);
  t.has(SKILL, 'architecture documentation always stays in English', 'topic files are English');
  t.has(SKILL, 'Inside its own area a topic wins over a root section it contradicts.', 'priority inside an area');
  t.has(SKILL, 'The root and its topics are one level (number 2 of `RULES_INDEX.md`).', 'priority level');
});

// ── ART-2 ───────────────────────────────────────────────────────────────────

guard('ART-2', 'modes: parameter, intent, state, announcements, frontmatter', (t) => {
  t.has(SKILL, '**(1) an explicit parameter, (2) the intent of free text, (3) the state.**', 'order of the three');
  t.has(SKILL, 'Both ways stay:', 'both ways stay');
  t.has(SKILL, '1. Parameter — checked first, never interpreted:', 'parameter first');
  t.has(SKILL, 'the whole argument is `optimise` / `optimize` (any letter case)', 'optimise parameter');
  t.has(SKILL, 'the first word is `update`', 'update parameter');
  t.has(SKILL, 'the whole argument is `generate`', 'generate parameter');
  t.has(SKILL, 'read its intent, do not match words', 'intent is read');
  t.has(SKILL, '**Rules of the intent.**', 'rules of the intent');
  t.has(SKILL, '`Update instead` (recommended) / `Rewrite from scratch`', 'generate on a file with content');
  t.has(SKILL, '`Update` (recommended) / `Reorganize into topics`', 'unclear tidy-up');
  t.has(SKILL, 'Whatever the wording or the parameter, Mode C writes nothing before the user confirms its preview.', 'optimise confirms first');
  t.has(SKILL, "the announcement is the run's very first output, before Step 0", 'announcement is first');
  t.has(SKILL, '`generate: I\'ll scan the project and write .unikit/ARCHITECTURE.md.`', 'announcement A');
  t.has(SKILL, '`update: I\'ll rescan the project and add what is missing to .unikit/ARCHITECTURE.md; nothing already written is removed.`', 'announcement B');
  t.has(SKILL, '`optimise: I\'ll sort .unikit/ARCHITECTURE.md into a root and topic files and show you the proposed layout before writing anything.`', 'announcement C');
  t.has(SKILL, '`INFO [architecture] update: no file — generating`', 'update on an empty file');
  t.has(SKILL, '`INFO [architecture] optimise: no architecture document — nothing to do`', 'optimise on an empty file');
  t.has(SKILL, 'the message that started this run', 'request falls back to the starting message');
  const refs = refFiles();
  t.ok(refs.includes('mode-update.md') && refs.includes('mode-optimise.md'), 'the two mode references of the owner exist');
  for (const name of refs) {
    const text = read(`${OWNER_REFS}/${name}`);
    t.lacks(text, 'I\'ll scan the project and write', `${name}: announcement A only in SKILL.md`);
    t.lacks(text, 'I\'ll rescan the project and add what is missing', `${name}: announcement B only in SKILL.md`);
    t.lacks(text, 'I\'ll sort .unikit/ARCHITECTURE.md into a root', `${name}: announcement C only in SKILL.md`);
  }
  const grants = SKILL_FRONT.split('\n');
  t.ok(grants.includes('  - Bash(node *)'), 'grant Bash(node *)');
  t.ok(grants.includes('  - Bash(rm .unikit/architecture/*)'), 'grant Bash(rm .unikit/architecture/*)');
  t.has(SKILL, '<!-- unikit:extension-point:bootstrap -->', 'bootstrap extension point');
  t.ok(/^version: "3\.0"$/m.test(SKILL_FRONT), 'version 3.0');
  const description = foldedDescription(SKILL_FRONT);
  t.ok(description.length > 0 && description.length <= MAX_DESCRIPTION, `description fits ${MAX_DESCRIPTION} characters (${description.length})`);
  t.ok(!CYRILLIC_RE.test(description), 'description has English triggers only');
  const hint = /^argument-hint:\s*"(.*)"$/m.exec(SKILL_FRONT)?.[1] ?? '';
  t.ok(hint.includes('update') && hint.includes('optimise'), 'argument-hint names update and optimise');
  t.has(SKILL, 'mode-update.md', 'Mode B reads mode-update.md');
  t.has(SKILL, 'mode-optimise.md', 'Mode C reads mode-optimise.md');
});

// ── ART-3 ───────────────────────────────────────────────────────────────────

guard('ART-3', 'update: nothing removed, kinds of facts, hand-off block, new topic, offer', (t) => {
  t.has(UPDATE, 'Nothing already written is removed, reworded or reordered', 'nothing removed');
  t.has(UPDATE, 'it does not regenerate the file from the Step 4 template', 'no regeneration');
  const kinds = ['a new module, directory or layer', 'a new edge or prohibition', 'a new contract or channel between modules', 'a new package or library',
    'a principle, an anti-pattern, a pattern choice', 'how a mechanism works (narrative)'];
  const rows = UPDATE.split('\n').filter((l) => kinds.some((k) => l.startsWith(`| ${k} |`)));
  t.ok(rows.length === kinds.length, `the table of kinds has ${kinds.length} rows (${rows.length})`);
  t.has(UPDATE, 'When unsure, the root.', 'when unsure the root');
  t.has(UPDATE, 'WARN [architecture] update: <path> is named in the file and not found in the project (left as written)', 'stale path is reported, not removed');
  t.has(UPDATE, 'It is **not** removed and not edited.', 'stale is left');
  t.has(UPDATE, 'Write it **word for word**', 'hand-off block word for word');
  t.has(UPDATE, '`Create the topic` / `Put it in the root` / `Not now`', 'new topic question');
  t.has(UPDATE, 'No answer → `Put it in the root`.', 'new topic default');
  t.has(UPDATE, 'Only this mode and `optimise` create a topic.', 'who creates a topic');
  t.has(UPDATE, 'INFO [architecture] update: added=<n> stale=<k> new-topics=<t>', 'report line');
  t.has(UPDATE, 'State `legacy` only: follow `## Offer`', 'offer only from legacy');
  t.has(UPDATE, '{{skills_dir}}/{{self_name}}/references/mode-optimise.md', 'path to the optimise reference');
  t.has(UPDATE, 'the question tool of your agent (`AskUserQuestion`)', 'canonical question phrase');
});

// ── ART-4 ───────────────────────────────────────────────────────────────────

guard('ART-4', 'optimise: no item deleted, confirmation, offer, helper limits and constants', (t) => {
  t.has(OPTIMISE, '**No item is deleted** — under any outcome.', 'no item deleted');
  t.has(OPTIMISE, 'it runs **only on confirmation**', 'only on confirmation');
  t.has(OPTIMISE, 'It touches only `.unikit/ARCHITECTURE.md` and `.unikit/architecture/`: never `RULES_INDEX.md`, never anything under `.unikit/memory/`.', 'scope of the writes');
  t.has(OPTIMISE, 'Tool output is folded away from the user: whatever the user must see', 'tool output is printed again');
  t.has(OPTIMISE, 'the proposal holds exactly `N` items, and every parsed item stands in exactly one destination, word for word', 'by-hand invariant');
  t.has(OPTIMISE, 'WARN [architecture] optimise: wrote <M> items, expected <N> — check git diff', 'read-back warning');
  t.has(OPTIMISE, '**No topic proposed → no question, nothing written, no line printed**', 'no topic, no question');
  t.has(OPTIMISE, '`Apply` — D.5 and D.6: the file takes the topic layout.', 'offer option Apply');
  t.has(OPTIMISE, '`Keep the flat format` — run `discard`', 'offer option Keep the flat format');
  t.has(OPTIMISE, '`Not now` — run `discard`', 'offer option Not now');
  t.has(OPTIMISE, 'The refusal is final: the offer is never made for this file again.', 'the refusal is final');
  t.has(OPTIMISE, 'INFO [architecture] layout: flat marker written — /unikit-architecture optimise reorganizes later', 'marker line');
  t.has(OPTIMISE, 'INFO [architecture] optimise: cancelled, file unchanged', 'cancel line');
  t.has(OPTIMISE, 'Only when `node` cannot run', 'by-hand path');
  t.has(OPTIMISE, HELPER_PATH_FORM, 'helper path in the installed form');
  t.lacks(OPTIMISE.replaceAll(HELPER_PATH_FORM, ''), 'architecture-layout.mjs', 'no other spelling of the helper path');
  const lines = HELPER_TEXT.split('\n').length - (HELPER_TEXT.endsWith('\n') ? 1 : 0);
  t.ok(lines <= MAX_HELPER_LINES, `the helper is at most ${MAX_HELPER_LINES} lines (${lines})`);
  const imports = [...HELPER_TEXT.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
  t.ok(imports.length > 0 && imports.every((m) => m.startsWith('node:')), 'the helper imports only node: modules');
  for (const [name, literal] of [['FLAT_MARKER', '<!-- unikit:architecture-layout flat -->'], ['TABLE_HEADER', '| Topic | Load when |'],
    ['TABLE_DELIMITER', '|-------|-----------|'], ['TOPIC_TITLE_PREFIX', '# Architecture — ']]) {
    t.ok(helperConstant(name) === literal, `helper constant ${name} equals the literal`);
    t.has(SKILL, literal, `SKILL.md carries the literal of ${name}`);
  }
  const quote = helperConstant('HEADER_QUOTE');
  t.ok(quote !== null && SKILL.includes(`${quote}\n`), 'helper HEADER_QUOTE equals the quote of SKILL.md, byte for byte');
  for (const name of refFiles()) {
    const rel = `${OWNER_REFS}/${name}`;
    const text = read(rel);
    const bytes = Buffer.byteLength(text, 'utf8');
    t.ok(text.trim().length > 0, `${name} is not empty`);
    t.ok(bytes <= MAX_REFERENCE_BYTES, `${name} is at most ${MAX_REFERENCE_BYTES} bytes (${bytes})`);
    if (name !== 'ENGINE_RULES.md') t.ok(text.split('\n')[LOAD_LINE_NUMBER - 1].startsWith(LOAD_LINE_PREFIX), `${name}: line ${LOAD_LINE_NUMBER} is its load condition`);
    t.lacks(text, '<!-- unikit:agents', `${name}: no agent markers outside SKILL.md`);
  }
  for (const [rel, text] of [[OWNER_SKILL, SKILL], [REF_UPDATE, UPDATE], [REF_OPTIMISE, OPTIMISE]]) {
    t.ok(!STOP_WORDS_RE.test(text), `${rel}: no engine stop words and no project name`);
    t.ok(!/invoke `unikit-/.test(text), `${rel}: no skill call without a recipe`);
  }
  t.ok(exists(HELPER), 'the helper exists');
});

// ── ART-5 ───────────────────────────────────────────────────────────────────

const TEMPLATE_CODE = 'data/RULES_INDEX_TEMPLATE.md';
const TEMPLATE_GAMEDESIGN = 'data/gamedesign/templates/GD_RULES_INDEX.md';
const CANON_MARK = '**Project architecture topics.**';

function walk(dir, ext, out = []) {
  for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(rel, ext, out);
    else if (entry.name.endsWith(ext)) out.push(rel);
  }
  return out;
}

guard('ART-5', 'canon: one paragraph in the code RULES_INDEX template, none in the game-design one, nothing in src/', (t) => {
  const template = read(TEMPLATE_CODE);
  const paragraph = template.split('\n').find((l) => l.startsWith(CANON_MARK)) ?? '';
  t.ok(paragraph.length > 0, 'the canon paragraph exists');
  for (const sentence of [
    'A `.unikit/ARCHITECTURE.md` with a `## Topics` section — a table with the columns `Topic` and `Load when` — is split',
    'each table row links a topic file `.unikit/architecture/<slug>.md` that applies only to the work its `Load when` describes',
    'Load a topic file by the same rule as a rule topic: when the current work matches it',
    're-check whenever the work moves to a new phase or area, and read only the topic files not loaded yet; when unsure, load it',
    'A skill that works in phases loads topic files at the start of each phase; a check loads them by the files it checks.',
    'print `WARN [architecture] topic file missing: .unikit/architecture/<slug>.md` and continue',
    'Inside its own area a topic wins over a root section it contradicts.',
    'No `## Topics` section → the whole file applies, as before.',
  ]) t.has(paragraph, sentence, 'canon sentence');
  t.has(template, '2. **`.unikit/ARCHITECTURE.md`** and its topic files in `.unikit/architecture/` — project architecture decisions', 'priority line 2 names the topics');
  t.lacks(read(TEMPLATE_GAMEDESIGN), CANON_MARK, 'the game-design index does not carry the architecture canon');
  const srcFiles = walk('src', '.ts');
  t.ok(srcFiles.length > 0, 'src/ files found');
  for (const file of srcFiles) {
    const text = read(file);
    t.ok(!text.includes('architecture-layout') && !text.includes('.unikit/architecture'), `${file}: the installer knows nothing of the topic files`);
  }
});

// ── ART-6 ───────────────────────────────────────────────────────────────────

const READER_MARK = '**Architecture topics:**';
const MISSING_WARN = 'WARN [architecture] topic file missing: .unikit/architecture/<slug>.md';
// Every skill or agent file that reads the root, the way it loads the topics. Tasks 14, 18 and 22 add their rows.
const READERS = [
  { file: 'skills/unikit-plan/SKILL.md', mode: 'P', needs: [`${READER_MARK} only the root here`, 'load per phase in Step 5 (**Rule refresh per phase**)'] },
  { file: 'skills/unikit-implement/SKILL.md', mode: 'P', needs: [`${READER_MARK} only the root here`, 'load per phase in Step 3.0'] },
  { file: 'skills/unikit-execute/SKILL.md', mode: 'P', needs: [`${READER_MARK} the root now`, '`Load when` matches this task', 'when unsure, load', MISSING_WARN] },
  { file: 'subagents/unikit-implement-worker.md', mode: 'P', needs: [`${READER_MARK} then load the topic files`, '`Load when` matches your phase', 'when unsure, load', MISSING_WARN] },
  { file: 'subagents/unikit-implement-coordinator.md', mode: 'P', needs: [`${READER_MARK} only the root here`, 'And the topic files listed under `## Topics` in `.unikit/ARCHITECTURE.md` whose `Load when` matches this phase', `(${READER_MARK} when unsure, load; a missing file → \`WARN [architecture] topic file missing:`] },
  { file: 'subagents/unikit-plan-polisher.md', mode: 'P', needs: [`${READER_MARK} its topic files load lazily`, '`Load when` matches a phase you write or check', 'when unsure, load'] },
  { file: 'skills/unikit-improve/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root now`, 'matches any phase of the plan under review', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-improve/references/VALIDATOR.md', mode: 'F', needs: ['the `.unikit/ARCHITECTURE.md` root and the topic file the item names', 'the `.unikit/ARCHITECTURE.md` root and the matched topic'] },
  { file: 'skills/unikit-verify/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root now`, 'matches a file the plan\'s tasks changed', 'when unsure, load', 'A listed file that is missing is reported in 3.4'] },
  { file: 'skills/unikit-review/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root always`, '`Load when` matches a reviewed file', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-commit/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root; then the topic files`, '`Load when` matches a staged file', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-fix/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root now`, '`Load when` matches the files you localized', 'when unsure, load', MISSING_WARN] },
  { file: 'subagents/unikit-architecture-sidecar.md', mode: 'F', needs: [`${READER_MARK} then load the topic files`, '`Load when` matches the changed files you were handed', 'when unsure, load', MISSING_WARN] },
  { file: 'subagents/unikit-review-sidecar.md', mode: 'F', needs: [`${READER_MARK} then load the topic files`, '`Load when` matches the changed files you were handed', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-explore/SKILL.md', mode: 'T', needs: [`${READER_MARK} the root; then the topic files`, '`Load when` matches the subject of the work', 'when the work moves to another area, load the ones not loaded yet', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-gd-review/SKILL.md', mode: 'T', needs: [`${READER_MARK} the root; then the topic files`, '`Load when` matches the subject of the assessment', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-docs/SKILL.md', mode: 'A', needs: [`${READER_MARK} read the root and every topic file listed under its \`## Topics\``, MISSING_WARN] },
];
const READERS_FLOOR = 17;
// Files that mention the root without reading it for their own work: the owner, the pointers, the roadmap (mode R: the
// root alone is enough), the ownership contract and the docs template (the skill that owns it is in READERS).
const EXEMPT = [
  'skills/unikit-architecture/', 'skills/unikit/', 'skills/unikit-help/', 'skills/unikit-memory/', 'skills/unikit-rules/', 'skills/unikit-evolve/',
  'skills/unikit-roadmap/SKILL.md', 'skills/unikit-verify/references/CONTEXT-GATES-AND-OWNERSHIP.md', 'skills/unikit-docs/references/DOC-TEMPLATES.md',
];

guard('ART-6', 'readers: every reader of the root says how it loads the topics', (t) => {
  t.ok(READERS.length >= READERS_FLOOR, `the table has at least ${READERS_FLOOR} readers (${READERS.length})`);
  for (const r of READERS) {
    const text = read(r.file).replace(/\s+/g, ' ');
    for (const need of r.needs) t.has(text, need, `${r.file} (mode ${r.mode})`);
  }
  // Mode R: the scope of a commit is read from the module map in the root, so Step 6 carries no topic clause.
  const commit = read('skills/unikit-commit/SKILL.md');
  const from = commit.indexOf('\n6. **Identify Scope**');
  const to = commit.indexOf('\n7. ', from);
  t.ok(from >= 0 && to > from, 'the commit Step 6 window is found');
  t.lacks(commit.slice(from, to), READER_MARK, 'commit Step 6 reads the root only (mode R)');
});

// ── ART-7 ───────────────────────────────────────────────────────────────────

guard('ART-7', 'loading by phase: implement Step 3.0, the plan refresh, the references that point to it', (t) => {
  const implement = read('skills/unikit-implement/SKILL.md');
  const from = implement.indexOf('**3.0: Phase Rules Refresh');
  const to = implement.indexOf('Inside a phase, do NOT re-check rules', from);
  t.ok(from >= 0 && to > from, 'the Step 3.0 window is found');
  const window = implement.slice(from, to);
  t.has(window, '.unikit/ARCHITECTURE.md', 'Step 3.0 names the architecture table');
  t.has(window, '.unikit/architecture/', 'Step 3.0 names the topic directory');
  t.has(window, 'A topic whose match is uncertain is needed.', 'Step 3.0 loads on doubt');
  t.has(window, MISSING_WARN, 'Step 3.0 warns about a missing topic file');
  const plan = read('skills/unikit-plan/SKILL.md');
  const refresh = plan.split('\n').find((l) => l.trimStart().startsWith('**Rule refresh per phase.**')) ?? '';
  t.has(refresh, '.unikit/ARCHITECTURE.md', 'the plan refresh paragraph names the architecture table');
  t.has(refresh, 'when unsure, load', 'the plan refresh loads on doubt');
  t.has(refresh, 'WARN [architecture] topic file missing: .unikit/architecture/<slug>.md', 'the plan refresh warns about a missing topic file');
  for (const ref of ['mode-add.md', 'mode-ultra.md', 'ultra-direct.md', 'ultra-stateful.md']) {
    t.has(read(`skills/unikit-plan/references/${ref}`), 'Rule refresh per phase', `${ref} still points to the refresh`);
  }
  const coordinator = read('subagents/unikit-implement-coordinator.md');
  const phaseItem = coordinator.split('\n').find((l) => l.startsWith('- **Every phase you execute yourself, the first included**')) ?? '';
  const firstItem = coordinator.split('\n').find((l) => l.startsWith('- **The first phase you execute yourself**')) ?? '';
  t.has(firstItem, '`.unikit/ARCHITECTURE.md` (the root;', 'coordinator Bootstrap reads the root (F7)');
  t.has(phaseItem, '`## Topics` in `.unikit/ARCHITECTURE.md`', 'coordinator loads the topic files in the phase item (F7)');
  t.has(coordinator, 'Rules — once per phase, never per task.', 'coordinator keeps "once per phase"');
  t.has(read('subagents/unikit-implement-worker.md'), 'your phase', 'worker loads by its phase');
  t.has(read('subagents/unikit-plan-polisher.md'), 'load lazily', 'polisher loads lazily');
});

// ── ART-8 ───────────────────────────────────────────────────────────────────

guard('ART-8', 'sub-agent prompts carry topic paths, not "read the file"', (t) => {
  const plan = read('skills/unikit-plan/SKILL.md');
  t.has(plan, '[architecture topic paths relevant to <focus> — from the root\'s `## Topics`]', 'Phase A slot');
  const at = plan.indexOf('   - .unikit/ARCHITECTURE.md\n');
  t.ok(at >= 0 && plan.slice(at, at + 400).includes('[architecture topic paths relevant to <focus>'), 'the slot stands right under the root in the Phase A prompt');
  t.has(plan, 'the topic files matched to the phases found in Phase A', 'Phase B names the topic files');
  const improve = read('skills/unikit-improve/SKILL.md');
  const slots = improve.split('[architecture topic paths relevant to focus]').length - 1;
  t.ok(slots === 3, `improve Step 2 prompts carry the topic-path slot three times (${slots})`);
  t.has(improve, 'the architecture topic files matched to its focus', 'improve names the topic files in the recon rules');
  t.has(improve, 'plus the topic paths matched to the task\'s focus', 'improve doc references');
  const validator = read('skills/unikit-improve/references/VALIDATOR.md');
  t.has(validator, 'root and the topic file the item names', 'the validator reads the root and the named topic');
  t.has(validator, 'the matched topic', 'the validator rereads the matched topic');
});

// ── ART-9 ───────────────────────────────────────────────────────────────────

guard('ART-9', 'the delta: one row or line per fact, never a paragraph, a topic or a moved block', (t) => {
  const implement = read('skills/unikit-implement/SKILL.md');
  const execute = read('skills/unikit-execute/SKILL.md');
  t.has(implement, 'with one table row or one list line per fact', 'implement 3.7: the form');
  t.has(implement, 'Never a paragraph, a new topic or a moved block.', 'implement 3.7: what is not a delta');
  t.has(implement, 'print `INFO [architecture] update suggested: <one line>` and leave the file', 'implement 3.7: a decision is suggested, not written');
  t.lacks(implement, 'add new modules to the folder structure section', 'implement 3.7: the old wording is gone');
  t.has(implement, '**3.7: Update context artifacts (if project structure changed)**', 'implement 3.7 heading unchanged');
  t.has(implement, 'Skip this step if the phase only modified existing files without structural changes.', 'implement 3.7 last line unchanged');
  t.has(implement, '→ update `.unikit/DESCRIPTION.md` with factual deltas only.', 'new libraries still go to DESCRIPTION.md');
  t.has(execute, 'as one table row or list line in the topic file whose `Load when` matches', 'execute 5.1: the form');
  t.has(execute, '(never a paragraph, a new topic or a moved block)', 'execute 5.1: what is not a delta');
  t.lacks(execute, '`AGENTS.md` and `.unikit/ARCHITECTURE.md` — only when new modules, directories or layers were created', 'execute 5.1: the old wording is gone');
  t.has(execute, 'print `INFO [architecture] update suggested: <one line>`', 'execute 5.1: a decision is suggested');
});

// ── ART-10 ──────────────────────────────────────────────────────────────────

guard('ART-10', 'verify and the ownership contract: table check, suggestions, growth sign, owner of the topic files', (t) => {
  const verify = read('skills/unikit-verify/SKILL.md');
  const contract = read('skills/unikit-verify/references/CONTEXT-GATES-AND-OWNERSHIP.md');
  t.has(verify, 'Topic table ↔ `.unikit/architecture/`: a listed file missing, or a file no row lists → `WARN [architecture] topic table:', '3.4 checks the table against the files');
  t.has(verify, '→ suggest `/unikit-architecture update`; growth or a topic table ↔ files mismatch → suggest `/unikit-architecture optimise`', '3.6 suggests update and optimise');
  t.has(verify, 'CONTEXT-GATES-AND-OWNERSHIP.md` → `## Architecture growth sign`', 'SKILL.md points to the contract for the numbers');
  t.lacks(verify, '300 lines', 'the numbers live only in the contract');
  t.has(verify, '`/unikit-verify` is **read-only** for context artifacts.', '3.6 stays read-only');
  for (const n of ['3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.9']) t.ok(new RegExp(`^#{2,4} ${n.replace('.', '\\.')}[ :]`, 'm').test(verify), `verify keeps the step ${n}`);
  t.ok(Buffer.byteLength(verify, 'utf8') <= 70000, 'verify SKILL.md stays under the 70000-byte ceiling');
  t.has(contract, '## Architecture growth sign', 'the contract has the growth sign');
  t.has(contract, '(a) the root has no `## Topics` table and no `flat` marker and is longer than 300 lines;', 'the contract holds the number for a root without topics');
  t.has(contract, '(b) a topic file is longer than 300 lines;', 'the contract holds the number for a topic file');
  t.has(contract, '(c) a row of the table lists a missing file, or a file in `.unikit/architecture/` has no row.', 'the contract holds the table-against-files mismatch');
  t.has(contract, 'Suggest `/unikit-architecture optimise` when:', 'the sign suggests optimise');
  t.has(contract, 'The result is a suggestion in 3.6, never a write', 'the sign never writes');
  t.has(contract, '`.unikit/ARCHITECTURE.md` and the topic files in `.unikit/architecture/`', 'the matrix names the topic files');
  t.has(contract, 'A new topic, a moved block or a split is `unikit-architecture` only', 'only the owner creates a topic');
  t.has(contract, 'one table row or list line per fact', 'implement may add a row, not a block');
  // literals the older guards (T8-9, RCA-17…19, PRT-9, PRT-10, BC-3) pin in this file must survive
  for (const literal of ['Single sanctioned design write', 'written **only** by `/unikit-rules`', 'removal only', '## Rule Candidates', 'implemented_version', '.unikit/rules/',
    'the `<!-- @no-migrate -->` tag its Keep option appends', 'deletes a rule only in its `prune` mode', '`## Measurements` is read here, never written.']) t.has(contract, literal, 'older guard literal');
  t.lacks(contract, 'No command edits', 'retired wording stays retired');
});

// ── ART-11 ──────────────────────────────────────────────────────────────────

guard('ART-11', 'the two gaps (fix, coordinator), the engine checks and the prototype profile', (t) => {
  const fix = read('skills/unikit-fix/SKILL.md');
  const bootstrap = fix.slice(fix.indexOf('## Step 0.2: Load Fix Context'), fix.indexOf('**The fix runs against a plan whose manifest has `## Experiment Context`**'));
  t.has(bootstrap, 'Also read `.unikit/ARCHITECTURE.md` (the root)', 'fix Bootstrap 0.2 reads the root (F1)');
  t.has(bootstrap, '4. For EACH row in the Core table', 'fix keeps its numbered Bootstrap list');
  t.has(fix, 'module boundaries defined in the `.unikit/ARCHITECTURE.md` root and the loaded topics', 'fix 4.4 checks against the loaded topics');
  t.has(fix, 'convention table from the `.unikit/ARCHITECTURE.md` root and the loaded topics', 'fix 4.5 checks against the loaded topics');
  for (const sidecar of ['subagents/unikit-architecture-sidecar.md', 'subagents/unikit-review-sidecar.md']) {
    const text = read(sidecar);
    t.has(text, '`Load when`', `${sidecar} names Load when`);
    t.has(text, 'changed files', `${sidecar} names the changed files`);
  }
  t.has(read('subagents/unikit-architecture-sidecar.md'), 'backed by specific rules from the `.unikit/ARCHITECTURE.md` root or a loaded topic', 'the sidecar reports only breaches of a written rule, topic included');
  for (const engine of ['UNITY', 'GODOT', 'GODOT_NET', 'UNREAL_ENGINE_5']) {
    t.has(read(`data/engine-templates/skills/unikit-verify/${engine}_RULES.md`), 'topic files matched to the changed files', `${engine}_RULES.md defers to root and topics`);
  }
  const profile = read('data/prototype-profile.md');
  t.has(profile, '(the root or a loaded topic)', 'the prototype profile accepts a prohibition in a loaded topic');
  t.has(profile, '(implement Step 3.7)', 'the profile still points to implement Step 3.7');
});

// ── ART-6b ──────────────────────────────────────────────────────────────────

guard('ART-6b', 'every file that names the root path is a listed reader or a justified exception, and every listed reader names it', (t) => {
  const files = [...walk('skills', '.md'), ...walk('subagents', '.md')];
  const mentioning = files.filter((rel) => read(rel).includes('.unikit/ARCHITECTURE.md'));
  const outside = mentioning.filter((rel) => !EXEMPT.some((e) => rel.startsWith(e)));
  for (const rel of outside) t.ok(READERS.some((r) => r.file === rel), `${rel} names .unikit/ARCHITECTURE.md and is not in READERS or EXEMPT — add a row or justify the exception`);
  for (const r of READERS) t.ok(outside.includes(r.file), `${r.file} is in READERS but no longer names .unikit/ARCHITECTURE.md — drop the row`);
  t.ok(outside.length === READERS.length, `the crawl found ${outside.length} readers outside the exceptions, the table has ${READERS.length} (${mentioning.length - outside.length} exempt, ${files.length} files)`);
});

// ── ART-12 ──────────────────────────────────────────────────────────────────

guard('ART-12', 'one-way border of the design review: a fixed set of paths that includes the topic directory', (t) => {
  const review = read('skills/unikit-gd-review/SKILL.md').replace(/\s+/g, ' ');
  const lenses = read('skills/unikit-gd-review/references/lenses.md');
  const principles = read('data/gamedesign/gd-principles.md').replace(/\s+/g, ' ');
  t.has(review, 'the `.unikit/ARCHITECTURE.md` root and the topic files `.unikit/architecture/*.md` that its `## Topics` lists (a fixed set of paths, no other project file)', 'review: the exception names the fixed paths');
  t.has(review, 'the `ARCHITECTURE.md` root and `.unikit/architecture/*.md` for the feasibility lens only', 'review: the read-only list names the topic directory');
  t.has(lenses.split('\n').find((l) => l.startsWith('| **feasibility**')) ?? '', '`.unikit/architecture/*.md`', 'lenses: the feasibility row names the topic directory');
  t.ok(/feasibility lens\*\* inside `unikit-gd-review` may read `DESCRIPTION\.md`, the `ARCHITECTURE\.md` root and `\.unikit\/architecture\/\*\.md`/.test(principles), 'gd-principles: the feasibility exception names the same set of paths');
  for (const [name, text] of [['review', review], ['lenses', lenses], ['gd-principles', principles]]) t.lacks(text, 'two files, exact', `${name}: the old "two files" wording is gone`);
  t.has(principles, 'Sanctioned exceptions (three, narrow)', 'T8-8 heading unchanged');
  for (const fragment of ['brownfield-bootstrap carve-out', 'read-only research verbs', 'extracted from code', 'are **never** in']) t.has(principles, fragment, 'RD-3 fragment');
});

// ── ART-13 ──────────────────────────────────────────────────────────────────

guard('ART-13', 'pointers, the receivers of the hand-off, Step 10 of /unikit, the help map', (t) => {
  t.has(read('skills/unikit/references/mode-menu.md'), 'otherwise runs in its update mode, so nothing already written is removed', 'the menu action Description runs update on an existing file');
  t.has(read('skills/unikit-rules/references/mode-prune.md'), '`/unikit-architecture update` with the block as its argument', 'prune hands the block to update');
  t.has(read('skills/unikit-rules/SKILL.md'), '`ARCHITECTURE.md` and its topic files', 'unikit-rules points to the topic files');
  for (const rel of ['skills/unikit-memory/SKILL.md', 'skills/unikit-memory/references/module-code.md', 'skills/unikit-memory/references/module-gamedesign.md']) t.has(read(rel), '`.unikit/architecture/`', `${rel} routes architecture decisions to the topic files too`);
  t.has(read('skills/unikit-evolve/SKILL.md'), '(and `.unikit/architecture/`)', 'evolve may not write the topic files');
  t.has(read('skills/unikit/references/LANGUAGE_RULES_TEMPLATE.md'), 'the topic files in `.unikit/architecture/`', 'topic files are always English');
  const unikit = read('skills/unikit/SKILL.md');
  t.has(unikit, '`.unikit/ARCHITECTURE.md` with its topic files in `.unikit/architecture/`', 'unikit: the list of artifact paths');
  t.has(unikit, '`.unikit/ARCHITECTURE.md`** and its topic files in `.unikit/architecture/` — project architecture decisions', 'unikit: priority line 2');
  t.has(unikit, 'See `.unikit/ARCHITECTURE.md` (and its topic files in `.unikit/architecture/`) for detailed architecture guidelines.', 'unikit: the pointer in the generated file');
  t.has(unikit, 'The sub-skill may ask the user (the pattern in generate, the layout offer in update); wait for it to return before Step 11.', 'Step 10 waits for the questions of the sub-skill');
  t.has(unikit, 'prompt: "{{agent_skill_call:unikit-architecture}}",', 'Step 10 still calls the skill without arguments (I8)');
  const map = read('skills/unikit-help/references/skill-map.md');
  t.has(map, '### unikit-architecture', 'the map keeps the heading the help test requires');
  for (const mode of ['`generate`', '`update [text]`', '`optimise`']) t.has(map, mode, `the map names the mode ${mode}`);
  t.has(map, '`.unikit/architecture/`', 'the map names the topic directory');
  t.has(map.replace(/\s+/g, ' '), 'and the topic files in `.unikit/architecture/` when it has topics', 'the map lists the topic files among the outputs');
  t.has(read('skills/unikit-rules/references/mode-optimise.md'), 'the request asked for it', 'unikit-rules optimise starts on a request too');
  t.has(read('skills/unikit-help/references/knowledge-base.md'), '`.unikit/ARCHITECTURE.md` (+ its topic files)', 'the priority line has the topic files');
});

// ── RMI-1…RMI-4 ─────────────────────────────────────────────────────────────

const RULES_SKILL = read('skills/unikit-rules/SKILL.md');
const RULES_SKILL_FLAT = RULES_SKILL.replace(/\s+/g, ' ');

guard('RMI-1', 'unikit-rules: parameter, then the intent of the request, then the arguments', (t) => {
  t.has(RULES_SKILL, 'Determine the mode: the parameter first, then the intent of the request, then the arguments.', 'order of the three');
  t.has(RULES_SKILL, 'Parameter (checked first, never interpreted; any letter case):', 'parameter first');
  for (const p of ['the whole argument is `compact`', 'the whole argument is `optimise` / `optimize`', 'the whole argument is `prune`']) t.has(RULES_SKILL, p, `parameter ${p}`);
  t.has(RULES_SKILL, 'Mode A: Direct add, N rules', 'Mode A batch stays');
  t.has(RULES_SKILL, 'Mode A: Direct add, 1 rule', 'Mode A single stays');
  t.has(RULES_SKILL, 'Mode B: Interactive', 'Mode B stays');
  t.has(RULES_SKILL, 'exact argument, never on containment', 'RFM-6 literal');
  t.has(RULES_SKILL, 'numbered batch | compact', 'RFM-5 substring of the argument-hint');
  t.lacks(RULES_SKILL, 'only the bare argument selects the mode', 'the old rule is gone');
});

guard('RMI-2', 'unikit-rules: rules of the intent', (t) => {
  t.has(RULES_SKILL, '**A rule stays a rule.**', 'a rule stays a rule');
  t.has(RULES_SKILL, 'When in doubt it is a rule.', 'doubt means a rule');
  t.has(RULES_SKILL, '("Prune unused usings before every commit")', 'the example of a directive about code');
  t.has(RULES_SKILL, '`optimise` (recommended — it moves rules and deletes or rewords nothing) / `compact` / `prune`', 'the question of an unclear kind');
  t.has(RULES_SKILL_FLAT, 'runs in the order given', 'a rule and a wish run in the order given');
  t.has(RULES_SKILL_FLAT, '`$ARGUMENTS` empty and the message that started the run', 'the starting message is the request');
  t.has(RULES_SKILL, 'Modes C, D and E write nothing before the user confirms.', 'maintenance confirms first');
});

guard('RMI-3', 'unikit-rules: the announcement and the references', (t) => {
  t.has(RULES_SKILL, '**Announce the mode first.**', 'PRT-12: announce first');
  t.has(RULES_SKILL, 'very first output of the run', 'PRT-12: first output');
  t.has(RULES_SKILL_FLAT, "before Step 0, before the mode's reference file, before any project file, and before any other sentence", 'PRT-12: before everything');
  for (const line of ["`Adding <N> rule(s) — first I'll check them against the knowledge base and the rules you already have.`",
    "`compact: I'll shorten the rules that can be shorter and show every change before writing — no rule is deleted.`",
    "`optimise: I'll sort the rules into topics and show you the proposed layout before writing anything.`",
    "`prune: I'll look for rules that can go — duplicates, outdated references, lines that aren't rules — and for rules that contradict each other; nothing changes until you choose.`"]) t.has(RULES_SKILL, line, 'PRT-12: the announcement line');
  t.has(RULES_SKILL_FLAT, 'The request alone decides the mode (the parameter, or the intent of the request)', 'the request decides');
  t.has(RULES_SKILL_FLAT, 'that question comes first, and the announcement follows the answer', 'the one exception to the first output');
  const optimise = read('skills/unikit-rules/references/mode-optimise.md');
  const prune = read('skills/unikit-rules/references/mode-prune.md');
  t.has(optimise, 'the request asked for it', 'mode-optimise: explicit means the request asked');
  t.has(prune, 'the request asked for `prune`', 'mode-prune: the request asked');
  t.lacks(optimise, '**Explicit** — the whole argument is', 'mode-optimise: not only the bare argument');
  t.lacks(prune, 'reads this file only when the whole argument is', 'mode-prune: not only the bare argument');
});

guard('RMI-4', 'unikit-rules: the surface and the help files', (t) => {
  const front = frontmatter(RULES_SKILL);
  const hint = /^argument-hint:\s*"(.*)"$/m.exec(front)?.[1] ?? '';
  t.has(hint, 'a request about the rules in plain words', 'argument-hint names the request');
  const description = foldedDescription(front);
  t.ok(description.length > 0 && description.length <= MAX_DESCRIPTION, `description fits ${MAX_DESCRIPTION} characters (${description.length})`);
  t.ok(!CYRILLIC_RE.test(description), 'description has English triggers only');
  t.has(description, 'by keyword or in plain words', 'description says both ways');
  for (const rel of ['skills/unikit-help/references/skill-map.md', 'skills/unikit-help/references/knowledge-base.md', 'docs/skills.md', 'docs/dynamic-memory.md']) {
    t.has(read(rel).replace(/\s+/g, ' '), 'started by a request in plain words', `${rel} says both ways`);
    t.has(read(rel).replace(/\s+/g, ' '), 'the keyword stays the exact form', `${rel} keeps the keyword exact`);
  }
});

// ── ART-14 ──────────────────────────────────────────────────────────────────

const DOC_PAGES = ['dynamic-memory', 'skills', 'workflow', 'subagents', 'plan-files', 'configuration', 'getting-started', 'gamedesign'];

guard('ART-14', 'docs: eight pages name the topic directory, the marker is documented', (t) => {
  for (const page of DOC_PAGES) t.has(read(`docs/${page}.md`), '.unikit/architecture/', `docs/${page}.md names the topic directory`);
  t.has(read('docs/dynamic-memory.md'), '<!-- unikit:architecture-layout flat -->', 'dynamic-memory documents the flat marker');
  t.has(read('docs/dynamic-memory.md'), '## Architecture topics', 'dynamic-memory has the section on architecture topics');
  t.has(read('docs/gamedesign.md').replace(/\s+/g, ' '), 'a fixed set of paths', 'gamedesign documents the fixed set of paths');
  t.lacks(read('docs/subagents.md'), 'step 10 writes `ARCHITECTURE.md` through `unikit-architecture`', 'subagents: the old "step 10 writes" wording is gone');
  t.ok(DOC_PAGES.length === 8, `eight pages are checked (${DOC_PAGES.length})`);
});

// ── Report ──────────────────────────────────────────────────────────────────

let failed = 0;
for (const c of cases) {
  const ok = c.why.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${c.id} ${c.label} (${c.checked} checked)`);
  for (const w of c.why) console.log(`    - ${w}`);
}
console.log(`ART: ${cases.length - failed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
