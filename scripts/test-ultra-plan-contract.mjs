// Contract test for the ultra plan bundle — two invariants `grep` cannot express.
//
// 1. The canonical manifest template is EXTRACTED from
//    skills/unikit-plan/references/ULTRA-PLAN-FORMAT.md, never copied here. A test that
//    holds its own copy of the template validates itself and nothing else.
// 2. The list of files obliged to carry the literal mode marker IS a contract: a consumer
//    that "forgets" ultra degrades silently to full-plan behaviour, and nothing else in the
//    suite would notice.
//
// This test is dev-time only — `scripts/` is not in package.json `files`, so it never
// reaches a user machine. There the contract is held by the text of the specification
// alone, which is why that text has to be self-sufficient.
//
// Reads source text only: no `dist/` import, no temp files, no writes.

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// ── Literals (project rule: no magic strings inline) ─────────────────────────

const MODE_MARKER = '<!-- unikit:plan-mode:ultra -->';

const SPEC_PATH = 'skills/unikit-plan/references/ULTRA-PLAN-FORMAT.md';

const HEADING_MANIFEST_TEMPLATE = '## Manifest Template';
const HEADING_PHASE_TEMPLATE = '## Phase File Template';
const HEADING_DETAIL_GATE = '## Required Detail Gate';
const HEADING_INTEGRITY = '## Integrity Checks';

const SECTION_PHASE_INDEX = '## Phase Index';
const SECTION_CHECKLIST = '## Checklist';
const SECTION_MCP_FINDINGS = '## MCP Findings';
const SECTION_TECHNICAL_CONTEXT = '## Technical Context';
const SECTION_OPEN_QUESTIONS = '## Open Questions';
const SECTION_FILES_IN_PHASE = '## Files in This Phase';

const PHASE_BACKLINK = 'Plan: [PLAN.md](PLAN.md)';

const TASK_SUBSECTIONS = [
    '### Intent',
    '### Implementation Steps',
    '### Required Interfaces and Contracts',
    '### Error Handling and Logging',
    '### Tests',
    '### Acceptance Criteria',
    '### Verification',
];

const FORBIDDEN_DELEGATION_WORDS = ['handle', 'support', 'wire up', 'as needed', 'etc.'];

const INTEGRITY_REASON = 'the committed specification is incomplete';

const DETAIL_GATE_POINTS = 7;
const INTEGRITY_POINTS = 7;

// Every file here must carry the literal marker. The list IS the contract:
// a consumer that "forgets" ultra degrades silently to full-plan behaviour, and
// nothing else in the suite would notice. Adding a consumer means adding a line.
const markerConsumers = [
    'skills/unikit-plan/references/ULTRA-PLAN-FORMAT.md',   // declares it
    'skills/unikit-plan/references/mode-ultra.md',          // writes it
    'data/ultra-plan-read.md',                              // tells consumers to look for it
    'skills/unikit-implement/SKILL.md',
    'skills/unikit-verify/SKILL.md',
    'skills/unikit-improve/SKILL.md',
    'skills/unikit-commit/SKILL.md',
];

// The four skills that read the reader contract. Their graceful-degradation wording must be
// identical, and none of them may grow its own copy of the integrity checklist.
const readerConsumers = [
    'skills/unikit-implement/SKILL.md',
    'skills/unikit-verify/SKILL.md',
    'skills/unikit-improve/SKILL.md',
    'skills/unikit-commit/SKILL.md',
];

const READER_CONTRACT_FILE = 'ultra-plan-read.md';
const DEGRADATION_TOKEN = 'missing';

// Threshold measured, not chosen: before this port these files carried ZERO lines naming
// `Phase Index`; the detection branch adds none, the improve `Write` ban names it once and
// the bundle-editing rule may name it once more. Three or more is the signature of a
// consumer restating the contract instead of pointing at it — the failure mode measured in
// the format ultra was ported from. Raising the threshold requires updating this reason.
const MAX_PHASE_INDEX_MENTIONS = 2;
const PHASE_INDEX_TOKEN = 'Phase Index';

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function pass(name) {
    passed++;
    console.log(`PASS [${name}]`);
}

function fail(name, detail) {
    failed++;
    console.error(`FAIL [${name}] ${detail}`);
}

function assertTrue(name, condition, detail) {
    if (condition) pass(name);
    else fail(name, detail);
}

function assertEq(name, actual, expected) {
    if (actual === expected) pass(name);
    else fail(name, `expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`);
}

function assertContains(name, haystack, needle, where) {
    if (typeof haystack === 'string' && haystack.includes(needle)) pass(name);
    else fail(name, `missing ${JSON.stringify(needle)} in ${where}`);
}

async function readRepoFile(relPath) {
    try {
        return await fs.readFile(path.join(ROOT, relPath), 'utf-8');
    } catch {
        return null;
    }
}

// ── Extraction ───────────────────────────────────────────────────────────────

/**
 * Body of the first fenced block that follows `headingText`, or null when the heading or the
 * fence is absent. An empty result is a failure for the caller, never a skip: a guard that
 * has lost its object must go red (the NN-4 / RT-7 convention of this suite).
 */
function extractFenced(spec, headingText) {
    const lines = spec.split('\n');
    const start = lines.findIndex((l) => l.startsWith(headingText));
    if (start === -1) return null;

    let open = -1;
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith('```')) { open = i; break; }
        if (lines[i].startsWith('## ')) return null;   // next section, no fence in this one
    }
    if (open === -1) return null;

    const body = [];
    for (let i = open + 1; i < lines.length; i++) {
        if (lines[i].startsWith('```')) return body.join('\n');
        body.push(lines[i]);
    }
    return null;   // unterminated fence
}

/**
 * Collapse every run of whitespace to a single space. Prose wraps: the verbatim phrases
 * asserted below are sentences, and a reflow that moves a line break into the middle of one
 * must not read as a broken contract. Wording is what is pinned here, not line layout.
 */
function flatten(text) {
    return text.replace(/\s+/g, ' ');
}

/** Section body between `heading` and the next `## ` heading. */
function extractSection(spec, heading) {
    const lines = spec.split('\n');
    const start = lines.findIndex((l) => l.startsWith(heading));
    if (start === -1) return null;
    const body = [];
    for (let i = start + 1; i < lines.length; i++) {
        if (lines[i].startsWith('## ')) break;
        body.push(lines[i]);
    }
    return body.join('\n');
}

/** Expand `Tasks 1.1-1.4` (or a bare `Tasks 1.1`) into the ids it covers. */
function expandTaskRange(rangeText) {
    const both = rangeText.match(/(\d+)\.(\d+)\s*-\s*(\d+)\.(\d+)/);
    if (both) {
        const [, p1, m1, p2, m2] = both;
        if (p1 !== p2) return null;
        const ids = [];
        for (let m = Number(m1); m <= Number(m2); m++) ids.push(`${p1}.${m}`);
        return ids;
    }
    const single = rangeText.match(/(\d+)\.(\d+)/);
    return single ? [`${single[1]}.${single[2]}`] : null;
}

// ── Run ──────────────────────────────────────────────────────────────────────

const spec = await readRepoFile(SPEC_PATH);
if (spec === null) {
    fail('spec/exists', `${SPEC_PATH} is missing — the contract has no object left`);
} else {
    pass('spec/exists');
}

const manifest = spec ? extractFenced(spec, HEADING_MANIFEST_TEMPLATE) : null;
const phaseTpl = spec ? extractFenced(spec, HEADING_PHASE_TEMPLATE) : null;

if (!manifest) {
    fail('manifest/extracted', `no fenced block under "${HEADING_MANIFEST_TEMPLATE}" in ${SPEC_PATH}`);
}
if (!phaseTpl) {
    fail('phase/extracted', `no fenced block under "${HEADING_PHASE_TEMPLATE}" in ${SPEC_PATH}`);
}

// --- T1..T6, T11..T13: the manifest template ---
if (manifest) {
    pass('manifest/extracted');
    const mLines = manifest.split('\n');
    const firstNonEmpty = mLines.find((l) => l.trim() !== '') ?? '';
    assertEq('T1 manifest-marker-is-first-line', firstNonEmpty.trim(), MODE_MARKER);

    const markerCount = mLines.filter((l) => l.includes(MODE_MARKER)).length;
    assertEq('T2 manifest-marker-exactly-once', markerCount, 1);

    const idxPhaseIndex = mLines.findIndex((l) => l.startsWith(SECTION_PHASE_INDEX));
    const idxChecklist = mLines.findIndex((l) => l.startsWith(SECTION_CHECKLIST));
    assertTrue('T3 phase-index-above-checklist',
        idxPhaseIndex !== -1 && idxChecklist !== -1 && idxPhaseIndex < idxChecklist,
        `Phase Index at ${idxPhaseIndex}, Checklist at ${idxChecklist}`);

    const idxFindings = mLines.findIndex((l) => l.startsWith(SECTION_MCP_FINDINGS));
    const idxTechCtx = mLines.findIndex((l) => l.startsWith(SECTION_TECHNICAL_CONTEXT));
    assertTrue('T4 mcp-findings-above-technical-context',
        idxFindings !== -1 && idxTechCtx !== -1 && idxFindings < idxTechCtx,
        `MCP Findings at ${idxFindings}, Technical Context at ${idxTechCtx}`);

    const topHeadings = mLines
        .filter((l) => l.startsWith('## '))
        .filter((l) => !l.startsWith(SECTION_OPEN_QUESTIONS));
    const lastHeading = topHeadings[topHeadings.length - 1] ?? null;
    assertTrue('T5 technical-context-is-last-section',
        lastHeading !== null && lastHeading.startsWith(SECTION_TECHNICAL_CONTEXT),
        `last section is ${JSON.stringify(lastHeading)}`);

    const checkboxLines = mLines.filter((l) => /^\s*-\s\[ \]\s+Task\s+\d+\.\d+/.test(l));
    assertTrue('T6 manifest-has-task-checkboxes', checkboxLines.length > 0,
        'no `- [ ] Task N.M` line in the manifest template');

    const indexRanges = mLines.filter((l) => /^\s*\d+\.\s*\[.+\]\(phase-\d+-[^)]*\)/.test(l));
    const setA = new Set();
    const indexFiles = new Set();
    let rangeParseError = null;
    for (const line of indexRanges) {
        const fileMatch = line.match(/\((phase-\d+-[^)]*)\)/);
        if (fileMatch) indexFiles.add(fileMatch[1]);
        const rangePart = line.split('—').pop() ?? '';
        const ids = expandTaskRange(rangePart);
        if (!ids) { rangeParseError = line; break; }
        ids.forEach((id) => setA.add(id));
    }

    const setB = new Set();
    const checklistFiles = new Set();
    const taskToFile = new Map();
    for (const line of checkboxLines) {
        const id = line.match(/Task\s+(\d+\.\d+)/)[1];
        setB.add(id);
        const link = line.match(/\((phase-\d+-[^)#]*)(?:#[^)]*)?\)/);
        if (link) { checklistFiles.add(link[1]); taskToFile.set(id, link[1]); }
    }

    if (rangeParseError) {
        fail('T11 index-set == checklist-set', `unparsable range line: ${rangeParseError}`);
    } else if (setA.size === 0 || setB.size === 0) {
        fail('T11 index-set == checklist-set',
            `a projection is empty (index ${setA.size}, checklist ${setB.size}) — the template teaches nothing`);
    } else {
        const onlyA = [...setA].filter((id) => !setB.has(id));
        const onlyB = [...setB].filter((id) => !setA.has(id));
        assertTrue('T11 index-set == checklist-set', onlyA.length === 0 && onlyB.length === 0,
            `index-only: [${onlyA}] checklist-only: [${onlyB}]`);
    }

    const phasesInIndex = new Set([...indexFiles].map((f) => f.match(/^phase-(\d+)-/)[1]));
    assertTrue('T11b index-declares-at-least-two-phases', phasesInIndex.size >= 2,
        `only ${phasesInIndex.size} phase(s) in the template — the projections cannot disagree, so T11 would pass vacuously`);

    const danglingLinks = [...checklistFiles].filter((f) => !indexFiles.has(f));
    assertTrue('T12 checklist-links-declared-in-index',
        checklistFiles.size > 0 && danglingLinks.length === 0,
        `links not declared in ${SECTION_PHASE_INDEX}: [${danglingLinks}]`);

    const misfiled = [...taskToFile.entries()].filter(([id, file]) => {
        const phase = id.split('.')[0];
        const fileNum = file.match(/^phase-(\d+)-/)[1];
        return Number(fileNum) !== Number(phase);
    });
    assertTrue('T13 task-phase-matches-phase-file', taskToFile.size > 0 && misfiled.length === 0,
        `task/file phase mismatch: ${JSON.stringify(misfiled)}`);
}

// --- T7..T10: the phase file template ---
if (phaseTpl) {
    pass('phase/extracted');
    const pLines = phaseTpl.split('\n');

    const checkboxes = pLines.filter((l) => l.includes('- [ ]')).length;
    assertEq('T7 phase-template-has-no-checkboxes', checkboxes, 0);

    const missingSubsections = TASK_SUBSECTIONS.filter((h) => !pLines.some((l) => l.startsWith(h)));
    assertTrue('T8 phase-template-has-seven-task-subsections', missingSubsections.length === 0,
        `missing: ${JSON.stringify(missingSubsections)}`);

    assertContains('T9 phase-template-links-back-to-manifest', phaseTpl, PHASE_BACKLINK, HEADING_PHASE_TEMPLATE);
    assertContains('T10 phase-template-has-files-section', phaseTpl, SECTION_FILES_IN_PHASE, HEADING_PHASE_TEMPLATE);
}

// --- T14..T15: the marker consumers ---
if (markerConsumers.length === 0) {
    fail('T14 marker-consumer-list-non-empty', 'the consumer list is empty — the guard has no object');
}
for (const rel of markerConsumers) {
    const content = await readRepoFile(rel);
    if (content === null) {
        fail(`T14 marker-consumer-exists (${rel})`, `${rel} does not exist`);
        continue;
    }
    pass(`T14 marker-consumer-exists (${rel})`);
    // Substring comparison, never a regex: a whitespace-tolerant regex would accept
    // `<!--  unikit:plan-mode:ultra -->`, which is a different line to every reader.
    assertTrue(`T15 marker-verbatim (${rel})`, content.includes(MODE_MARKER),
        `${rel} does not carry the literal ${MODE_MARKER}`);
}

// --- T16: identical graceful-degradation wording across the four reader consumers ---
const degradationLines = new Map();
let degradationBroken = false;
for (const rel of readerConsumers) {
    const content = await readRepoFile(rel);
    if (content === null) {
        fail('T16 degradation-wording-identical', `${rel} does not exist`);
        degradationBroken = true;
        continue;
    }
    const hits = content.split('\n')
        .filter((l) => l.includes(READER_CONTRACT_FILE) && l.includes(DEGRADATION_TOKEN))
        .map((l) => l.trim().replace(/\s+/g, ' '));
    if (hits.length !== 1) {
        fail('T16 degradation-wording-identical',
            `${rel} carries ${hits.length} lines naming both "${READER_CONTRACT_FILE}" and "${DEGRADATION_TOKEN}" (expected exactly 1)`);
        degradationBroken = true;
        continue;
    }
    degradationLines.set(rel, hits[0]);
}
if (!degradationBroken) {
    const distinct = new Set(degradationLines.values());
    if (distinct.size === 1) {
        pass('T16 degradation-wording-identical');
    } else {
        fail('T16 degradation-wording-identical',
            `${distinct.size} distinct wordings:\n` +
            [...degradationLines.entries()].map(([f, l]) => `    ${f}\n      ${l}`).join('\n'));
    }
}

// --- T17: no consumer restates the integrity checklist ---
for (const rel of readerConsumers) {
    const content = await readRepoFile(rel);
    if (content === null) {
        fail(`T17 no-restated-contract (${rel})`, `${rel} does not exist`);
        continue;
    }
    const mentions = content.split('\n').filter((l) => l.includes(PHASE_INDEX_TOKEN)).length;
    assertTrue(`T17 no-restated-contract (${rel})`, mentions <= MAX_PHASE_INDEX_MENTIONS,
        `${mentions} lines name "${PHASE_INDEX_TOKEN}" (max ${MAX_PHASE_INDEX_MENTIONS}) — a consumer restating the contract instead of pointing at it`);
}

// --- T18..T20: the detail gate and the integrity checks are present and complete ---
const gateSection = spec ? extractSection(spec, HEADING_DETAIL_GATE) : null;
if (!gateSection) {
    fail('T18 detail-gate-has-seven-points', `no "${HEADING_DETAIL_GATE}" section in ${SPEC_PATH}`);
    fail('T19 detail-gate-forbids-delegation-words', `no "${HEADING_DETAIL_GATE}" section in ${SPEC_PATH}`);
} else {
    const gateLines = gateSection.split('\n');
    const numbered = gateLines.filter((l) => /^\d+\.\s/.test(l));
    assertEq('T18 detail-gate-has-seven-points', numbered.length, DETAIL_GATE_POINTS);

    const seventhStart = gateLines.findIndex((l) => /^7\.\s/.test(l));
    let seventh = '';
    if (seventhStart !== -1) {
        for (let i = seventhStart; i < gateLines.length; i++) {
            if (i > seventhStart && /^\d+\.\s/.test(gateLines[i])) break;
            seventh += gateLines[i] + '\n';
        }
    }
    const seventhFlat = flatten(seventh);
    const missingWords = FORBIDDEN_DELEGATION_WORDS.filter((w) => !seventhFlat.includes(w));
    assertTrue('T19 detail-gate-forbids-delegation-words',
        seventhStart !== -1 && missingWords.length === 0,
        seventhStart === -1 ? 'point 7 not found' : `point 7 does not name: ${JSON.stringify(missingWords)}`);
}

const integritySection = spec ? extractSection(spec, HEADING_INTEGRITY) : null;
if (!integritySection) {
    fail('T20 integrity-checks-complete', `no "${HEADING_INTEGRITY}" section in ${SPEC_PATH}`);
} else {
    const numbered = integritySection.split('\n').filter((l) => /^\d+\.\s/.test(l));
    const hasReason = flatten(integritySection).includes(INTEGRITY_REASON);
    assertTrue('T20 integrity-checks-complete',
        numbered.length === INTEGRITY_POINTS && hasReason,
        `${numbered.length} numbered checks (expected ${INTEGRITY_POINTS}), reason present: ${hasReason}`);
}

console.log(`\nultra-plan-contract: ${passed} passed, ${failed} failed`);
if (failed > 0) {
    process.exit(1);
}
