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
  { file: 'subagents/unikit-implement-coordinator.md', mode: 'P', needs: [`${READER_MARK} only the root here`, '`Load when` matches this phase', MISSING_WARN] },
  { file: 'subagents/unikit-plan-polisher.md', mode: 'P', needs: [`${READER_MARK} its topic files load lazily`, '`Load when` matches a phase you write or check', 'when unsure, load'] },
  { file: 'skills/unikit-improve/SKILL.md', mode: 'F', needs: [`${READER_MARK} the root now`, 'matches any phase of the plan under review', 'when unsure, load', MISSING_WARN] },
  { file: 'skills/unikit-improve/references/VALIDATOR.md', mode: 'F', needs: ['the `.unikit/ARCHITECTURE.md` root and the topic file the item names', 'the `.unikit/ARCHITECTURE.md` root and the matched topic'] },
];
const READERS_FLOOR = 8;

guard('ART-6', 'readers: every reader of the root says how it loads the topics', (t) => {
  t.ok(READERS.length >= READERS_FLOOR, `the table has at least ${READERS_FLOOR} readers (${READERS.length})`);
  for (const r of READERS) {
    const text = read(r.file);
    for (const need of r.needs) t.has(text, need, `${r.file} (mode ${r.mode})`);
  }
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
  t.has(execute, 'print `INFO [architecture] update suggested: <one line>`', 'execute 5.1: a decision is suggested');
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
