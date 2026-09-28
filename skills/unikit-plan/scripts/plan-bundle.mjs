#!/usr/bin/env node
// plan-bundle.mjs — the mechanical half of writing an ultra plan in `/unikit-plan`.
//
// The model writes the bundle; this script does what has to be exact.
//   check <dir>           Runs the Integrity Checks of
//                         `unikit-plan/references/ULTRA-PLAN-FORMAT.md` (1-15, the
//                         numbers are the same) on the manifest `<dir>/PLAN.md` and its phase files.
//                         A manifest without the ultra marker is a full plan: only
//                         checks 6, 9, 11 and 12-15 apply to it.
//   finalize <plan-dir>   Checks `<plan-dir>`, then removes its `.planning/` folder — only
//                         one directly inside a folder under `.unikit/code/plans/`.
//   discard <plan-dir>    Removes an unfinished plan folder: never one that holds `<plan-dir>/PLAN.md`,
//                         never one outside `.unikit/code/plans/`.
//
// Check 10 only warns: "looks like a test-run command" is a judgement, not a mechanism.
// Self-contained: Node >= 18, builtin imports only, no sibling modules.
// Exit codes: 0 ok · 1 usage or I/O · 2 a check failed (nothing removed)
//             · 3 the folder holds a finished plan (nothing removed).

import fs from 'node:fs';
import path from 'node:path';

// --- CONSTANTS ---
const MANIFEST = 'PLAN.md';
const MODE_MARKER = '<!-- unikit:plan-mode:ultra -->';
const EXIT = { OK: 0, USAGE: 1, FAILED: 2, FINISHED: 3 };
const TOTAL_ULTRA_CHECKS = 15;
const FULL_PLAN_CHECKS = [6, 9, 11, 12, 13, 14, 15];
const H_SETTINGS = '## Settings';
const H_PHASE_INDEX = '## Phase Index';
const H_CROSS_DEPS = '## Cross-Phase Dependencies';
const H_CHECKLIST = '## Checklist';
const H_COMMIT_PLAN = '## Commit Plan';
const H_MODULES = '## Modules';
const H_TESTS = '### Tests';
const H_VERIFICATION = '### Verification';
const SECTION_RE = /^## /;
const SUBSECTION_RE = /^### /;
const SETTING_TESTING = '- Testing:';
const SETTING_TEST_CHECKPOINTS = '- Test checkpoints:';
const SETTING_PR_CHECKPOINTS = '- PR checkpoints:';
const YES = 'yes';
const RUN_PLACEMENTS_WITHOUT_TASK_RUNS = ['phase', 'plan'];
const PHASE_FILE_RE = /^phase-\d{2}-[a-z0-9-]+\.md$/;
const INDEX_ITEM_RE = /^\d+\.\s/;
const INDEX_LINE_RE = /^\d+\.\s+\[Phase (\d+): .+\]\(([^)]+)\)\s+—\s+Tasks? (\d+\.\d+)(?:\s*[-–]\s*(\d+\.\d+))?/;
const PHASE_HEADING_RE = /^### Phase (\d+):/;
const DEPENDENCIES_RE = /^\*\*Dependencies:\*\*(.*)$/;
const PHASE_REF_RE = /Phase (\d+)/g;
const TASK_RE = /^- \[( |x)\] Task (\d+)\.(\d+)\b/;
const DETAILS_RE = /\(\[details\]\(([^)#]+)#([^)]+)\)\)/;
const TEST_CHECKPOINT = 'Test checkpoint:';
const TEST_CHECKPOINT_PLAN = 'Test checkpoint: plan';
const PR_CHECKPOINT = 'PR checkpoint:';
const COMMIT_RE = /^### Commit (\d+): after tasks? (\d+\.\d+)(?:\s*[-–]\s*(\d+\.\d+))?/;
const MODULE_RE = /^- M(\d+) · (.+?) · phases? (\d+)(?:\s*[-–]\s*(\d+))? · delivers: (.+)$/;
const MODULE_PR_RE = / · PR: task (\d+\.\d+)/;
const MODULE_WHY_LONG = ' · why long: ';
const MODULE_ITEM = '- ';
const MAX_MODULE_PHASES = 4;
const TASK_SECTION_RE = /^## Task (\d+\.\d+): (.+)$/;
const PHASE_CHECKBOX_RE = /^\s*- \[( |x)\]/;
const TASK_ID_RE = /\b(\d+\.\d+)\b/g;
const SLUG_DROP_RE = /[^\p{L}\p{M}\p{N}\p{Pc} -]/gu;
const RUN_COMMAND_RE = /\b(npm (run )?test|npx (jest|vitest|mocha)|yarn test|pnpm test|pytest|dotnet test|go test|cargo test|gradlew? test|-runTests|run[-_ ]tests)\b/i;
const PLANS_SEGMENTS = ['.unikit', 'code', 'plans'];
const PLANNING_DIR = '.planning';
const USAGE = 'Usage: node plan-bundle.mjs check <dir> | finalize <plan-dir> | discard <plan-dir>';

// --- Reading ---

function readLines(file) {
  return fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n').split('\n');
}

/** Lines under a `## ` heading, up to the next `## ` heading. `null` when the heading is absent. */
function section(lines, heading) {
  const start = lines.findIndex((line) => line.startsWith(heading));
  if (start === -1) return null;
  const body = [];
  for (let i = start + 1; i < lines.length && !SECTION_RE.test(lines[i]); i++) body.push(lines[i]);
  return body;
}

function setting(lines, prefix) {
  const body = section(lines, H_SETTINGS) ?? [];
  const line = body.find((l) => l.trim().startsWith(prefix));
  return line ? line.trim().slice(prefix.length).trim() : null;
}

/** GitHub heading anchor: lowercase, drop everything but letters, marks, digits, connectors, spaces and hyphens. */
function slug(text) {
  return text.trim().toLowerCase().replace(SLUG_DROP_RE, '').replace(/ /g, '-');
}

function compareIds(a, b) {
  const [pa, ma] = a.split('.').map(Number);
  const [pb, mb] = b.split('.').map(Number);
  return pa - pb || ma - mb;
}

function parseChecklist(lines) {
  const body = section(lines, H_CHECKLIST) ?? [];
  const phases = [];
  const tasks = [];
  let phase = null;
  let task = null;
  for (const line of body) {
    const heading = line.match(PHASE_HEADING_RE);
    if (heading) {
      phase = { num: Number(heading[1]), deps: [], tasks: [] };
      phases.push(phase);
      task = null;
      continue;
    }
    if (SUBSECTION_RE.test(line)) { task = null; continue; }
    const deps = line.match(DEPENDENCIES_RE);
    if (deps && phase) {
      phase.deps = [...deps[1].matchAll(PHASE_REF_RE)].map((m) => Number(m[1]));
      continue;
    }
    const t = line.match(TASK_RE);
    if (t) {
      task = { id: `${t[2]}.${t[3]}`, phase: phase ? phase.num : Number(t[2]), lines: [line] };
      tasks.push(task);
      if (phase) phase.tasks.push(task);
      continue;
    }
    if (task) task.lines.push(line);
  }
  for (const t of tasks) {
    const text = t.lines.join('\n');
    const details = text.match(DETAILS_RE);
    t.detailsFile = details ? details[1] : null;
    t.anchor = details ? details[2] : null;
    t.isTestCheckpoint = text.includes(TEST_CHECKPOINT);
    t.isFullRun = text.includes(TEST_CHECKPOINT_PLAN);
    t.isPrCheckpoint = text.includes(PR_CHECKPOINT);
  }
  return { phases, tasks };
}

function parseModules(lines) {
  const body = section(lines, H_MODULES);
  if (body === null) return null;
  const modules = [];
  const bad = [];
  for (const line of body) {
    if (!line.startsWith(MODULE_ITEM)) continue;
    const m = line.match(MODULE_RE);
    if (!m) { bad.push(line.slice(0, 40)); continue; }
    const rest = m[5];
    const pr = rest.match(MODULE_PR_RE);
    modules.push({
      k: Number(m[1]), name: m[2], from: Number(m[3]), to: Number(m[4] ?? m[3]),
      pr: pr ? pr[1] : null, whyLong: rest.includes(MODULE_WHY_LONG.trim()),
    });
  }
  return { modules, bad };
}

function readPhaseFiles(dir, files) {
  const sections = [];
  const checkboxes = [];
  for (const file of files) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) continue;
    const lines = readLines(full);
    let current = null;
    for (const line of lines) {
      if (PHASE_CHECKBOX_RE.test(line)) checkboxes.push(file);
      const s = line.match(TASK_SECTION_RE);
      if (s) {
        current = { id: s[1], file, slug: slug(line.slice(3)), lines: [] };
        sections.push(current);
      } else if (SECTION_RE.test(line)) {
        current = null;
      } else if (current) {
        current.lines.push(line);
      }
    }
  }
  return { sections, checkboxes };
}

/** Lines of one `### ` subsection inside a task section. */
function subsection(lines, heading) {
  const start = lines.findIndex((l) => l.startsWith(heading));
  if (start === -1) return [];
  const out = [];
  for (let i = start + 1; i < lines.length && !SUBSECTION_RE.test(lines[i]); i++) out.push(lines[i]);
  return out;
}

// --- Checks ---

function runChecks(dir) {
  const manifestPath = path.join(dir, MANIFEST);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) throw new Error(`not a directory: ${dir}`);
  if (!fs.existsSync(manifestPath)) throw new Error(`no ${MANIFEST} in ${dir}`);

  const lines = readLines(manifestPath);
  const out = [];
  const fail = (n, detail) => out.push({ kind: 'FAIL', n, detail });
  const warn = (n, detail) => out.push({ kind: 'WARN', n, detail });
  const markerCount = lines.filter((l) => l.trim() === MODE_MARKER).length;
  const ultra = markerCount > 0;
  const ran = new Set(ultra ? Array.from({ length: TOTAL_ULTRA_CHECKS }, (_, i) => i + 1) : FULL_PLAN_CHECKS);

  const { phases, tasks } = parseChecklist(lines);
  const taskIds = tasks.map((t) => t.id);
  const taskSet = new Set(taskIds);
  const phaseNums = new Set(phases.map((p) => p.num));

  // 1 — the marker, exactly once, on the first line
  if (ultra && (markerCount !== 1 || lines[0].trim() !== MODE_MARKER)) {
    fail(1, `marker found ${markerCount} time(s); first line ${lines[0].trim() === MODE_MARKER ? 'is' : 'is not'} the marker`);
  }

  // 2, 5, 7 — the Phase Index
  const indexFiles = [];
  const indexIds = new Set();
  if (ultra) {
    for (const line of section(lines, H_PHASE_INDEX) ?? []) {
      if (!INDEX_ITEM_RE.test(line)) continue;
      const m = line.match(INDEX_LINE_RE);
      if (!m) { fail(2, `unparsable Phase Index line: ${line.slice(0, 60)}`); continue; }
      const target = m[2];
      if (path.isAbsolute(target) || target.includes('..') || target.includes('/') || target.includes('\\')
          || !PHASE_FILE_RE.test(target)) {
        fail(2, `link escapes the bundle or is not a phase file: ${target}`);
        continue;
      }
      if (!fs.existsSync(path.join(dir, target))) { fail(2, `link target missing: ${target}`); continue; }
      indexFiles.push(target);
      const from = m[3];
      const to = m[4] ?? m[3];
      const [pf, mf] = from.split('.').map(Number);
      const [pt, mt] = to.split('.').map(Number);
      if (pf !== pt) { fail(7, `range crosses phases: ${from}-${to}`); continue; }
      for (let i = mf; i <= mt; i++) indexIds.add(`${pf}.${i}`);
    }
    const onDisk = fs.readdirSync(dir).filter((f) => PHASE_FILE_RE.test(f));
    for (const f of onDisk) if (!indexFiles.includes(f)) fail(5, `orphan phase file: ${f}`);
    for (const id of taskIds) if (!indexIds.has(id)) fail(7, `task ${id} is in no Phase Index range`);
    for (const id of indexIds) if (!taskSet.has(id)) fail(7, `Phase Index range names task ${id}, the checklist does not`);
  }

  // 3, 4, 8 — task sections in the phase files
  if (ultra) {
    const { sections, checkboxes } = readPhaseFiles(dir, indexFiles);
    for (const file of new Set(checkboxes)) fail(8, `task checkbox in phase file: ${file}`);
    for (const t of tasks) {
      const found = sections.filter((s) => s.id === t.id);
      if (found.length !== 1) { fail(3, `task ${t.id} has ${found.length} ## Task section(s)`); continue; }
      if (!t.detailsFile) { fail(3, `task ${t.id} carries no ([details](…)) link`); continue; }
      if (t.detailsFile !== found[0].file) fail(3, `task ${t.id} links ${t.detailsFile}, its section is in ${found[0].file}`);
      else if (t.anchor !== found[0].slug) fail(3, `task ${t.id} anchor #${t.anchor} ≠ #${found[0].slug}`);
    }
    const seen = new Map();
    for (const s of sections) seen.set(s.id, (seen.get(s.id) ?? 0) + 1);
    for (const [id, count] of seen) {
      if (count > 1) fail(4, `## Task ${id} appears ${count} times`);
      if (!taskSet.has(id)) fail(4, `## Task ${id} is not in the checklist`);
    }

    // 10 — a run command where the placement forbids one (warning only)
    const placement = setting(lines, SETTING_TEST_CHECKPOINTS);
    if (placement && RUN_PLACEMENTS_WITHOUT_TASK_RUNS.includes(placement)) {
      const runTasks = new Set(tasks.filter((t) => t.isTestCheckpoint).map((t) => t.id));
      for (const s of sections) {
        if (runTasks.has(s.id)) continue;
        const text = [...subsection(s.lines, H_TESTS), ...subsection(s.lines, H_VERIFICATION)].join('\n');
        if (RUN_COMMAND_RE.test(text)) warn(10, `task ${s.id} may carry a test-run command under Test checkpoints: ${placement}`);
      }
    }
  }

  // 6 — dependency references exist
  for (const p of phases) for (const d of p.deps) if (!phaseNums.has(d)) fail(6, `Phase ${p.num} depends on Phase ${d}, which does not exist`);
  if (ultra) {
    for (const line of section(lines, H_CROSS_DEPS) ?? []) {
      for (const m of line.matchAll(TASK_ID_RE)) if (!taskSet.has(m[1])) fail(6, `Cross-Phase Dependencies name task ${m[1]}, which does not exist`);
    }
  }

  // 9 — Commit Plan ranges are made of existing ids
  const commits = [];
  for (const line of section(lines, H_COMMIT_PLAN) ?? []) {
    const m = line.match(COMMIT_RE);
    if (!m) continue;
    const from = m[2];
    const to = m[3] ?? m[2];
    if (!taskSet.has(from) || !taskSet.has(to)) { fail(9, `Commit ${m[1]} names a task that does not exist (${from}-${to})`); continue; }
    commits.push({ n: m[1], ids: taskIds.filter((id) => compareIds(id, from) >= 0 && compareIds(id, to) <= 0) });
  }

  // 11 — under Testing: yes the last task is the full run
  if (setting(lines, SETTING_TESTING) === YES && !(tasks.length && tasks[tasks.length - 1].isFullRun)) {
    fail(11, 'Testing: yes, but the last checklist task is not Test checkpoint: plan');
  }

  // 12-15 — modules
  const parsed = parseModules(lines);
  const modules = parsed ? parsed.modules : [];
  const prTasks = tasks.filter((t) => t.isPrCheckpoint);
  const prSetting = setting(lines, SETTING_PR_CHECKPOINTS) === YES;
  const phaseOrder = phases.map((p) => p.num);
  const moduleOf = new Map();

  if (parsed) {
    for (const b of parsed.bad) fail(12, `unparsable ## Modules line: ${b}`);
    let expected = 0;
    modules.forEach((m, i) => {
      if (m.k !== i + 1) fail(12, `module M${m.k} is out of order (expected M${i + 1})`);
      const covered = phaseOrder.filter((n) => n >= m.from && n <= m.to);
      if (!covered.length || phaseOrder.indexOf(covered[0]) !== expected) fail(12, `M${m.k} does not continue from the previous module's phases`);
      expected = phaseOrder.indexOf(covered[covered.length - 1]) + 1;
      if (covered.length > MAX_MODULE_PHASES && !m.whyLong) fail(12, `M${m.k} spans ${covered.length} phases and carries no why long:`);
      for (const n of covered) moduleOf.set(n, m);
    });
    if (modules.length && expected !== phaseOrder.length) fail(12, `## Modules covers ${expected} of ${phaseOrder.length} phases`);
  }

  if (prTasks.length && !prSetting) {
    warn(13, 'legacy plan — PR checkpoint tasks without PR checkpoints: yes; check 13 not applied');
    ran.delete(13);
  } else {
    if (prSetting && !prTasks.length) fail(13, 'PR checkpoints: yes, but the plan carries no PR checkpoint task');
    if (prTasks.length && !modules.length) fail(13, 'PR checkpoint tasks in a plan without ## Modules');
    const last = modules[modules.length - 1];
    if (last && last.pr) fail(13, `the last module M${last.k} carries a PR: field`);
    for (const t of prTasks) {
      const phase = phases.find((p) => p.num === t.phase);
      const m = moduleOf.get(t.phase);
      if (!m) continue;
      if (phase.tasks[phase.tasks.length - 1] !== t) fail(13, `PR checkpoint task ${t.id} is not the last task of phase ${t.phase}`);
      if (t.phase !== m.to) fail(13, `PR checkpoint task ${t.id} is not in the closing phase of M${m.k}`);
      if (m === last) fail(13, `PR checkpoint task ${t.id} is in the last module`);
    }
    if (prSetting) {
      for (const m of modules.slice(0, -1)) {
        const own = prTasks.filter((t) => moduleOf.get(t.phase) === m);
        if (!own.length) fail(13, `M${m.k} carries no PR checkpoint task`);
        if (m.pr && !own.some((t) => t.id === m.pr)) fail(13, `M${m.k} says PR: task ${m.pr}, which is not its PR checkpoint task`);
        if (!m.pr && own.length) fail(13, `M${m.k} has a PR checkpoint task but no PR: field`);
      }
    }
  }

  if (modules.length > 1) {
    const depsOf = new Map(phases.map((p) => [p.num, p.deps]));
    const ancestors = (n, acc = new Set()) => {
      for (const d of depsOf.get(n) ?? []) if (!acc.has(d)) { acc.add(d); ancestors(d, acc); }
      return acc;
    };
    // 14 — the barrier
    modules.forEach((m, i) => {
      const own = phaseOrder.filter((n) => moduleOf.get(n) === m);
      const closing = own[own.length - 1];
      const before = ancestors(closing);
      for (const n of own) if (n !== closing && !before.has(n)) fail(14, `closing Phase ${closing} of M${m.k} does not depend on Phase ${n}`);
      const next = modules[i + 1];
      if (!next) return;
      for (const n of phaseOrder.filter((p) => moduleOf.get(p) === next)) {
        if (!ancestors(n).has(closing)) fail(14, `Phase ${n} of M${next.k} does not depend on Phase ${closing}, the closing phase of M${m.k}`);
      }
    });
    // 15 — no commit range crosses a module boundary
    for (const c of commits) {
      const touched = new Set(c.ids.map((id) => moduleOf.get(Number(id.split('.')[0]))));
      if (touched.size > 1) fail(15, `Commit ${c.n} crosses a module boundary`);
    }
  }

  return { out, ran };
}

function printCheck(dir) {
  const { out, ran } = runChecks(dir);
  for (const r of out) console.log(`${r.kind} ${r.n} ${r.detail}`);
  const failedChecks = new Set(out.filter((r) => r.kind === 'FAIL').map((r) => r.n));
  if (failedChecks.size) {
    console.log(`FAILED ${failedChecks.size} of ${ran.size} checks`);
    return false;
  }
  console.log(`OK ${ran.size} checks`);
  return true;
}

// --- Finalize and discard ---

/** `<dir>` is `.unikit/code/plans/<name>` — the three segments in a row, then exactly one name. Compared by segment: `path.resolve` gives `\` on Windows. */
function isPlanFolder(dir) {
  const parts = path.resolve(dir).split(path.sep);
  const at = parts.length - 1 - PLANS_SEGMENTS.length;
  return at >= 0 && parts[parts.length - 1] !== '' && PLANS_SEGMENTS.every((seg, j) => parts[at + j] === seg);
}

function finalize(planDir) {
  if (!printCheck(planDir)) return EXIT.FAILED;
  if (!isPlanFolder(planDir)) {
    console.log(`ERROR refusing to clean ${planDir}: not a folder under .unikit/code/plans/`);
    return EXIT.USAGE;
  }
  const planning = path.join(planDir, PLANNING_DIR);
  if (!fs.existsSync(planning)) {
    console.log('OK nothing to clean');
    return EXIT.OK;
  }
  fs.rmSync(planning, { recursive: true, force: true });
  console.log(`CLEANED ${planDir}`);
  return EXIT.OK;
}

function discard(planDir) {
  if (!isPlanFolder(planDir)) {
    console.log(`ERROR refusing to discard ${planDir}: not a folder under .unikit/code/plans/`);
    return EXIT.USAGE;
  }
  if (!fs.existsSync(planDir) || !fs.statSync(planDir).isDirectory()) {
    console.log(`ERROR not a directory: ${planDir}`);
    return EXIT.USAGE;
  }
  if (fs.existsSync(path.join(planDir, MANIFEST))) {
    console.log(`ERROR refusing to discard ${planDir}: it holds a finished plan`);
    return EXIT.FINISHED;
  }
  fs.rmSync(planDir, { recursive: true, force: true });
  console.log(`DISCARDED ${planDir}`);
  return EXIT.OK;
}

// --- Main ---

function main(argv) {
  const [command, ...args] = argv;
  try {
    if (command === 'check' && args.length === 1) return printCheck(args[0]) ? EXIT.OK : EXIT.FAILED;
    if (command === 'finalize' && args.length === 1) return finalize(args[0]);
    if (command === 'discard' && args.length === 1) return discard(args[0]);
    console.log(USAGE);
    return EXIT.USAGE;
  } catch (err) {
    console.log(`ERROR ${err.message}`);
    return EXIT.USAGE;
  }
}

process.exitCode = main(process.argv.slice(2));
