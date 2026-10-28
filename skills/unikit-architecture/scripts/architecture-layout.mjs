#!/usr/bin/env node
// architecture-layout.mjs — the mechanical half of `/unikit-architecture optimise`.
//
// The agent decides WHERE every block goes; this script does everything that has to be exact.
//   parse    Inventory of `.unikit/ARCHITECTURE.md` and the topic files its `## Topics` table lists. Every line
//            is layout structure or belongs to exactly one item: a paragraph (P<n>), a list item with its
//            continuations (L<n>), a table row (T<n>) or a fenced code block (C<n>). An unknown shape surfaces
//            as a paragraph — nothing is lost, no format is guessed.
//   apply    Reads the agent's plan (`.unikit/architecture-layout.plan.json`), proves that every item lands
//            exactly once and word for word, then writes the topic files and the root. `--dry-run` prints the
//            outline of the layout and writes nothing.
//   discard  Deletes the plan file (the user cancelled).
// Headings, `---` lines, the flat marker, the header quote and the Topics table are layout structure: rebuilt,
// never counted; a `###` heading with no item under it is not carried. Node >= 18, no dependencies.
// Exit codes: 0 ok · 1 usage or I/O · 2 invalid plan or failed invariant (nothing written)
//             · 3 the architecture files changed since `parse`.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────────────────
const ROOT_FILE = '.unikit/ARCHITECTURE.md';
const TOPICS_DIR = '.unikit/architecture';
const PLAN_FILE = '.unikit/architecture-layout.plan.json';
const PLAN_VERSION = 1;
const FLAT_MARKER = '<!-- unikit:architecture-layout flat -->';
const TABLE_HEADER = '| Topic | Load when |';
const TABLE_DELIMITER = '|-------|-----------|';
const TOPIC_TITLE_PREFIX = '# Architecture — ';
const HEADER_QUOTE = '> This file is the root: when it has a `## Topics` table, its sections apply to every task, and a topic file in `.unikit/architecture/` applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.';
const TOPICS_NAME = 'Topics';
const DETAILED_NAME = 'Detailed Rules';
const LEAD_NAME = 'Overview';
const DEFAULT_TITLE = '# Architecture';
const ROOT = 'root';
const BOM = String.fromCharCode(0xfeff);
const PEEK = 70;
const EXIT = { OK: 0, USAGE: 1, INVALID: 2, STALE: 3 };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,2}$/;
const ID_RE = /^([PLTC])(\d+)$/;
const RANGE_RE = /^([PLTC])(\d+)-(?:[PLTC])?(\d+)$/;
const ITEM_RE = /^([-*+]|\d{1,3}[.)])[ \t]+(?=\S)/;
const NUMBERED_RE = /^\d{1,3}[.)][ \t]+\S/;
const HEADING_RE = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;
const SEPARATOR_RE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;
const INDENTED_RE = /^[ \t]+\S/;
const TABLE_HEAD_RE = /^\|\s*Topic\s*\|\s*Load when\s*\|\s*$/i;
const TABLE_DELIM_RE = /^\|[\s:|-]*-[\s:|-]*\|\s*$/;
const TABLE_ROW_RE = /^\|\s*\[([^\]]+)\]\(architecture\/([a-z0-9-]+)\.md\)\s*\|\s*(.*?)\s*\|\s*$/;
const FORBIDDEN_CELL_RE = /[|\r\n]/;
const FORBIDDEN_TITLE_RE = /[|[\]\r\n]/;

const USAGE = `Usage: node architecture-layout.mjs <command> [--root <project dir>]
  parse               inventory of ${ROOT_FILE} and its topic files
  apply [--dry-run]   check and write the plan in ${PLAN_FILE} (--dry-run: outline only)
  discard             delete ${PLAN_FILE}`;
class UsageError extends Error {}

// ── READING ────────────────────────────────────────────────────────────────────────────────
function readFile(abs) {
  const raw = fs.readFileSync(abs);
  let text = raw.toString('utf8');
  if (text.startsWith(BOM)) text = text.slice(1);
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return { lines, eol, sha: createHash('sha256').update(raw).digest('hex') };
}

const isBlank = (line) => line.trim() === '';
const bySlug = (a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
const toLines = (entries) => entries.join('\n').split('\n');
const textOf = (item) => item.lines.join('\n');
const bytesOf = (item) => Buffer.byteLength(textOf(item), 'utf8');
const peek = (item) => item.lines[0].trim().slice(0, PEEK);

function fenceEnd(lines, openIndex, openText = lines[openIndex]) {
  const open = FENCE_RE.exec(openText)[1];
  const close = new RegExp(`^[ \\t]*${open[0] === '`' ? '`' : '~'}{${open.length},}[ \\t]*$`);
  let k = openIndex + 1;
  while (k < lines.length && !close.test(lines[k])) k++;
  return { end: Math.min(k + 1, lines.length), closed: k < lines.length };
}

const tableAt = (lines, i) => /^\s*\|/.test(lines[i]) && i + 1 < lines.length && TABLE_DELIM_RE.test(lines[i + 1].trim());

// A list item runs from its marker over indented continuation lines (nested items too), fenced
// code, numbered steps right under a bullet that ends with a colon, and blank lines that are
// followed by more indented continuation.
function itemEnd(lines, start) {
  const marker = ITEM_RE.exec(lines[start])[0];
  const bullet = !NUMBERED_RE.test(lines[start]);
  let [steps, j] = [false, start + 1];
  if (FENCE_RE.test(lines[start].slice(marker.length))) j = fenceEnd(lines, start, lines[start].slice(marker.length)).end;
  while (j < lines.length) {
    if (isBlank(lines[j])) {
      let k = j;
      while (k < lines.length && isBlank(lines[k])) k++;
      if (k < lines.length && INDENTED_RE.test(lines[k])) { j = k; continue; }
      break;
    }
    if (FENCE_RE.test(lines[j])) { j = fenceEnd(lines, j).end; continue; }
    if (bullet && NUMBERED_RE.test(lines[j]) && (steps || /:\s*$/.test(lines[j - 1]))) { steps = true; j++; continue; }
    if (INDENTED_RE.test(lines[j])) { j++; continue; }
    break;
  }
  return j;
}

function startsSomethingElse(lines, k, role) {
  const line = lines[k];
  return HEADING_RE.test(line) || SEPARATOR_RE.test(line) || ITEM_RE.test(line) || FENCE_RE.test(line)
    || (role === ROOT && line.trim() === FLAT_MARKER) || tableAt(lines, k);
}

// Scans one file into items (P, L, T, C) and the structure around them. `role` is 'root' or 'topic'.
function scanFile(lines, role, rel) {
  const out = { items: [], sections: [], rows: [], hasTable: false, hasMarker: false, title: null, dropped: 0, warnings: [] };
  let [sec, sub, prev, blank, i] = [null, null, null, false, 0];
  const add = (kind, from, to, extra = {}) => {
    const item = { kind, sec, sub, from: from + 1, to, lines: lines.slice(from, to), blankBefore: blank, prev, ...extra };
    if (sec) sec.count++;
    out.items.push(item); prev = item; blank = false; i = to;
  };
  const structure = (next) => { prev = null; blank = false; i = next; };
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { blank = true; i++; continue; }
    if (role === ROOT && line.trim() === FLAT_MARKER) { out.hasMarker = true; structure(i + 1); continue; }
    if (role === ROOT && !sec && line.trimEnd() === HEADER_QUOTE) { structure(i + 1); continue; }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const [level, name] = [heading[1].length, heading[2]];
      if (level === 1 && out.title === null) { out.title = line; structure(i + 1); continue; }
      if (role === ROOT && level === 2 && name === TOPICS_NAME) {
        let k = i + 1;
        while (k < lines.length && isBlank(lines[k])) k++;
        if (k + 1 < lines.length && TABLE_HEAD_RE.test(lines[k]) && TABLE_DELIM_RE.test(lines[k + 1].trim())) {
          out.hasTable = true;
          let r = k + 2;
          while (r < lines.length && lines[r].trim().startsWith('|')) {
            const row = TABLE_ROW_RE.exec(lines[r].trim());
            out.rows.push(row ? { title: row[1].trim(), slug: row[2], loadWhen: row[3], line: r + 1 } : { bad: lines[r], line: r + 1 });
            r++;
          }
          sec = null; sub = null; structure(r); continue;
        }
      }
      if (level === 2) { sec = { name, raw: line, count: 0 }; out.sections.push(sec); sub = null; } else sub = line;
      structure(i + 1); continue;
    }
    if (SEPARATOR_RE.test(line)) { out.dropped++; structure(i + 1); continue; }
    if (FENCE_RE.test(line)) {
      const { end, closed } = fenceEnd(lines, i);
      if (!closed) out.warnings.push(`WARN [architecture] parse: ${rel}:${i + 1} code fence is never closed — kept as one item up to the end of the file`);
      add('C', i, end); continue;
    }
    if (tableAt(lines, i)) {
      let r = i + 2;
      while (r < lines.length && lines[r].trim().startsWith('|')) r++;
      if (r > i + 2) {
        const head = [lines[i], lines[i + 1]];
        for (let n = i + 2; n < r; n++) {
          if (n === i + 2) prev = null; else blank = false;
          add('T', n, n + 1, { head });
        }
        continue;
      }
    }
    if (ITEM_RE.test(line)) { add('L', i, itemEnd(lines, i)); continue; }
    let end = i + 1;
    while (end < lines.length && !isBlank(lines[end]) && !startsSomethingElse(lines, end, role)) end++;
    add('P', i, end);
  }
  return out;
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────────────────
function inventory(root) {
  const inv = { state: 'empty', files: [], topics: [], warnings: [], items: [], hasMarker: false, eol: '\n', rootScan: null };
  const rootAbs = path.join(root, ROOT_FILE);
  if (!fs.existsSync(rootAbs)) return withFingerprint(inv);
  const rootRead = readFile(rootAbs);
  const rootScan = scanFile(rootRead.lines, ROOT, ROOT_FILE);
  Object.assign(inv, { eol: rootRead.eol, hasMarker: rootScan.hasMarker, rootScan });
  inv.files.push({ path: ROOT_FILE, role: ROOT, slug: null, lines: rootRead.lines.length, sha: rootRead.sha, scan: rootScan });
  if (rootScan.hasTable && rootScan.hasMarker) inv.warnings.push('WARN [architecture] layout: flat marker ignored — the file already has a ## Topics table');
  for (const row of rootScan.rows) {
    if (row.bad) { inv.warnings.push(`WARN [architecture] topic table: row ${row.line} is not a [Title](architecture/<slug>.md) row — ignored: ${row.bad.trim()}`); continue; }
    const rel = `${TOPICS_DIR}/${row.slug}.md`;
    inv.topics.push({ slug: row.slug, title: row.title, loadWhen: row.loadWhen, path: rel });
    if (!fs.existsSync(path.join(root, rel))) { inv.warnings.push(`WARN [architecture] topic table: ${row.slug} is listed, ${rel} does not exist`); continue; }
    const read = readFile(path.join(root, rel));
    inv.files.push({ path: rel, role: 'topic', slug: row.slug, lines: read.lines.length, sha: read.sha, scan: scanFile(read.lines, 'topic', rel) });
  }
  const listed = new Set(inv.topics.map((t) => `${t.slug}.md`));
  const dirAbs = path.join(root, TOPICS_DIR);
  if (fs.existsSync(dirAbs)) {
    for (const name of fs.readdirSync(dirAbs).filter((n) => n.endsWith('.md')).sort()) {
      if (!listed.has(name)) inv.warnings.push(`WARN [architecture] topic table: ${TOPICS_DIR}/${name} is not listed under ## Topics — no reader loads it`);
    }
  }
  inv.state = rootScan.hasTable ? 'topics' : rootScan.hasMarker ? 'flat' : rootScan.sections.length === 0 ? 'empty' : 'legacy';
  if (inv.state !== 'empty') {
    const counts = {};
    for (const file of inv.files) {
      inv.warnings.push(...file.scan.warnings);
      for (const item of file.scan.items) {
        Object.assign(item, { id: `${item.kind}${(counts[item.kind] = (counts[item.kind] ?? 0) + 1)}`, file: file.path, source: file.slug, section: item.sec?.name ?? null });
        inv.items.push(item);
      }
    }
  }
  return withFingerprint(inv);
}

function withFingerprint(inv) {
  const h = createHash('sha256');
  for (const f of inv.files) h.update(`${f.path}\0${f.sha}\n`);
  inv.fingerprint = h.digest('hex').slice(0, 16);
  return inv;
}

// ── PARSE OUTPUT ───────────────────────────────────────────────────────────────────────────
function printParse(inv) {
  const count = (k) => inv.items.filter((it) => it.kind === k).length;
  console.log(`architecture-layout parse — state: ${inv.state}   fingerprint: ${inv.fingerprint}`);
  console.log(`items: ${inv.items.length} (P=${count('P')}, L=${count('L')}, T=${count('T')}, C=${count('C')})   files: ${inv.files.map((f) => `${f.path} (${f.lines} lines)`).join(', ') || 'none'}`);
  if (inv.hasMarker) console.log('flat marker: present — apply removes it once there is a topic');
  for (const w of inv.warnings) console.log(w);
  if (inv.items.length === 0) return;
  const dropped = inv.files.reduce((n, f) => n + f.scan.dropped, 0);
  if (dropped) console.log(`(${dropped} "---" separator lines are layout structure — apply does not carry them)`);
  const where = (it) => `${it.section ?? '(before the first section)'}${it.source ? ` [${it.source}]` : ''}`;
  const rows = new Map();
  for (const it of inv.items) rows.set(where(it), [(rows.get(where(it)) ?? [0, 0])[0] + 1, (rows.get(where(it)) ?? [0, 0])[1] + bytesOf(it)]);
  console.log('\n| Section | Items | Bytes |\n|---------|-------|-------|');
  for (const [key, [n, bytes]] of rows) console.log(`| ${key} | ${n} | ${bytes} |`);
  console.log('\nid | section | bytes | head');
  for (const it of inv.items) console.log(`${it.id} | ${where(it)}${it.sub ? ` / ${it.sub.replace(/^#+\s*/, '')}` : ''} | ${bytesOf(it)} | ${peek(it)}`);
}

// ── PLAN ───────────────────────────────────────────────────────────────────────────────────
function expandIds(value, errors) {
  const ids = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const token = String(raw).trim();
    const range = RANGE_RE.exec(token);
    if (range) {
      const [from, to] = [Number(range[2]), Number(range[3])];
      if (to < from) errors.push(`range ${token} runs backwards`);
      for (let n = from; n <= to; n++) ids.push(`${range[1]}${n}`);
    } else if (ID_RE.test(token)) ids.push(token);
    else errors.push(`"${token}" is not an item id (P<n>, L<n>, T<n>, C<n>, or a range such as P3-P9)`);
  }
  if (!Array.isArray(value)) errors.push('every value under "assign" must be a list of ids');
  return ids;
}

function checkPlan(inv, plan) {
  const errors = [];
  if (plan.version !== PLAN_VERSION) errors.push(`"version" must be ${PLAN_VERSION}`);
  const topics = Array.isArray(plan.topics) ? plan.topics : [];
  if (!Array.isArray(plan.topics)) errors.push('"topics" must be a list (empty for a flat file)');
  const slugs = new Set();
  for (const t of topics) {
    if (!SLUG_RE.test(t?.slug ?? '')) errors.push(`topic slug "${t?.slug}" must be kebab-case, one to three words`);
    else if (t.slug === ROOT || slugs.has(t.slug)) errors.push(`topic slug "${t.slug}" is reserved or used twice`);
    slugs.add(t?.slug);
    if (!t?.title || FORBIDDEN_TITLE_RE.test(t.title)) errors.push(`topic "${t?.slug}": title is empty or carries | [ ] or a line break`);
    if (!t?.loadWhen || FORBIDDEN_CELL_RE.test(t.loadWhen)) errors.push(`topic "${t?.slug}": "Load when" is empty or carries | or a line break`);
  }
  const byId = new Map(inv.items.map((it) => [it.id, it]));
  const order = new Map(inv.items.map((it, n) => [it.id, n]));
  const dest = new Map([[ROOT, []], ...topics.map((t) => [t.slug, []])]);
  const seen = new Map();
  for (const [key, value] of Object.entries(plan.assign ?? {})) {
    if (!dest.has(key)) { errors.push(`"assign" names "${key}", which is neither "root" nor a topic of the plan`); continue; }
    for (const id of expandIds(value, errors)) {
      if (!byId.has(id)) errors.push(`${id} does not exist in the inventory`);
      else if (seen.has(id)) errors.push(`${id} is assigned twice (${seen.get(id)} and ${key})`);
      else { seen.set(id, key); dest.get(key).push(byId.get(id)); }
    }
  }
  const unassigned = inv.items.filter((it) => !seen.has(it.id)).map((it) => it.id);
  if (unassigned.length) errors.push(`not assigned — every item needs one place, nothing is deleted: ${unassigned.slice(0, 40).join(', ')}${unassigned.length > 40 ? ` … and ${unassigned.length - 40} more` : ''}`);
  for (const t of topics) if (dest.get(t.slug)?.length === 0) errors.push(`topic "${t.slug}" receives no item — there is never an empty topic`);
  const known = new Set(inv.items.map((it) => it.section).filter(Boolean));
  const rename = new Map();
  for (const [slug, map] of Object.entries(plan.sections ?? {})) {
    if (!slugs.has(slug)) { errors.push(`"sections" names "${slug}", which is not a topic of the plan`); continue; }
    for (const [from, to] of Object.entries(map ?? {})) {
      if (!known.has(from)) errors.push(`"sections" renames "${from}", which is not a section of the source`);
      else if (typeof to !== 'string' || !to.trim() || /[\r\n]/.test(to)) errors.push(`"sections" gives "${from}" an empty name or one with a line break`);
      else rename.set(`${slug}\0${from}`, to.trim());
    }
  }
  for (const list of dest.values()) list.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { errors, topics, dest, rename, total: inv.items.length };
}

// ── RENDER ─────────────────────────────────────────────────────────────────────────────────
// Writes items after a heading. A blank line separates two items unless they were neighbours
// in the source and nothing separated them there; table rows share a copy of their table head.
function writeItems(out, items) {
  let [sub, prev] = [null, null];
  const gap = () => { if (out[out.length - 1] !== '') out.push(''); };
  for (const it of items) {
    if (it.sub !== sub && it.sub) { gap(); out.push(it.sub); prev = null; }
    sub = it.sub ?? sub;
    const neighbour = prev && it.prev === prev;
    if (it.kind === 'T' && !(neighbour && prev.kind === 'T')) { gap(); out.push(...it.head); }
    else if (!neighbour || it.blankBefore) gap();
    out.push(...it.lines);
    prev = it;
  }
}

function renderRoot(checked, inv) {
  const { topics } = checked;
  const items = checked.dest.get(ROOT);
  const out = [inv.rootScan.title ?? DEFAULT_TITLE];
  if (topics.length === 0 && inv.hasMarker) out.push(FLAT_MARKER);
  if (topics.length > 0) out.push('', HEADER_QUOTE);
  writeItems(out, items.filter((it) => !it.section));
  const names = [...new Set(inv.rootScan.sections.map((s) => s.name))];
  const extra = [...new Set(items.map((it) => it.section).filter((n) => n && !names.includes(n)))];
  const detailed = names.indexOf(DETAILED_NAME);
  const ordered = detailed < 0 ? [...names, ...extra] : [...names.slice(0, detailed), ...extra, ...names.slice(detailed)];
  const raw = (name) => inv.rootScan.sections.find((s) => s.name === name)?.raw ?? `## ${name}`;
  const table = () => {
    const rows = [...topics].sort(bySlug).map((t) => `| [${t.title}](architecture/${t.slug}.md) | ${t.loadWhen} |`);
    out.push('', `## ${TOPICS_NAME}`, '', TABLE_HEADER, TABLE_DELIMITER, ...rows);
  };
  let tableDone = topics.length === 0;
  for (const name of ordered) {
    if (name === DETAILED_NAME && !tableDone) { table(); tableDone = true; }
    const mine = items.filter((it) => it.section === name);
    const hadItems = inv.rootScan.sections.filter((s) => s.name === name).some((s) => s.count > 0);
    if (mine.length === 0 && hadItems) continue;
    out.push('', raw(name));
    writeItems(out, mine);
  }
  if (!tableDone) table();
  return out;
}

function renderTopic(t, items, checked) {
  const out = [TOPIC_TITLE_PREFIX + t.title];
  const groups = new Map();
  for (const it of items) {
    const name = checked.rename.get(`${t.slug}\0${it.section}`) ?? it.section ?? LEAD_NAME;
    groups.set(name, [...(groups.get(name) ?? []), it]);
  }
  for (const [name, list] of groups) { out.push('', `## ${name}`); writeItems(out, list); }
  return out;
}

function render(checked, inv) {
  const files = new Map();
  for (const t of checked.topics) files.set(`${TOPICS_DIR}/${t.slug}.md`, renderTopic(t, checked.dest.get(t.slug), checked));
  files.set(ROOT_FILE, renderRoot(checked, inv));
  return files;
}

// Re-scans every rendered file: its items must be exactly the items assigned to it, word for word.
function proveRendered(files, checked, inv) {
  const [problems, together] = [[], []];
  for (const [rel, lines] of files) {
    const key = rel === ROOT_FILE ? ROOT : path.basename(rel, '.md');
    const expected = checked.dest.get(key).map(textOf).sort();
    const got = scanFile(toLines(lines), rel === ROOT_FILE ? ROOT : 'topic', rel).items.map(textOf).sort();
    together.push(...got);
    const bad = got.findIndex((text, n) => text !== expected[n]);
    if (got.length !== expected.length || bad >= 0) problems.push(`${rel}: expected ${expected.length} items, re-reading the output gives ${got.length}${bad >= 0 ? ` (first difference: "${(got[bad] ?? '').split('\n')[0].slice(0, PEEK)}")` : ''}`);
  }
  const source = inv.items.map(textOf).sort();
  together.sort();
  if (together.length !== source.length || together.some((text, n) => text !== source[n])) problems.push(`all written files hold ${together.length} items, the source has ${source.length}`);
  return problems;
}

function changeLabel(t, checked, inv) {
  const old = new Set(inv.topics.map((x) => x.slug));
  const sources = new Set(checked.dest.get(t.slug).map((it) => it.source).filter((s) => s && s !== t.slug));
  const parts = [old.has(t.slug) ? 'kept' : sources.size === 0 ? 'new' : null].filter(Boolean);
  const destOf = (it) => [...checked.dest.entries()].find(([, list]) => list.includes(it))?.[0];
  const split = [...sources].filter((s) => new Set(inv.items.filter((it) => it.source === s).map(destOf)).size > 1);
  const merged = [...sources].filter((s) => !split.includes(s));
  if (merged.length) parts.push(`merged from ${merged.join(', ')}`);
  if (split.length) parts.push(`split from ${split.join(', ')}`);
  return parts.join(', ');
}

function printOutline(inv, checked) {
  const { topics, dest } = checked;
  const removed = inv.topics.filter((t) => !topics.some((x) => x.slug === t.slug));
  const size = (list) => list.reduce((n, it) => n + bytesOf(it), 0);
  console.log(`## Proposed layout — ${topics.length} topics, ${dest.get(ROOT).length} root items, ${checked.total} items\n`);
  console.log('| Topic | Load when | Items | Bytes | Change |\n|-------|-----------|-------|-------|--------|');
  for (const t of [...topics].sort(bySlug)) console.log(`| [${t.title}](architecture/${t.slug}.md) | ${t.loadWhen} | ${dest.get(t.slug).length} | ${size(dest.get(t.slug))} | ${changeLabel(t, checked, inv)} |`);
  for (const t of removed) console.log(`| [${t.title}](architecture/${t.slug}.md) | ${t.loadWhen} | 0 | 0 | removed |`);
  console.log(`| root | — | ${dest.get(ROOT).length} | ${size(dest.get(ROOT))} | — |`);
  const outline = (heading, list, key) => {
    console.log(`\n### ${heading} (${list.length} items, ${size(list)} bytes)`);
    let last;
    for (const it of list) {
      const name = checked.rename.get(`${key}\0${it.section}`) ?? it.section ?? '(before the first section)';
      if (name !== last) { last = name; console.log(`#### ${name}`); }
      console.log(`${it.id.padEnd(5)}${String(bytesOf(it)).padStart(6)} B  ${peek(it)}`);
    }
  };
  for (const t of topics) outline(`${t.title} — architecture/${t.slug}.md`, dest.get(t.slug), t.slug);
  outline(`Root — ${ROOT_FILE}`, dest.get(ROOT), ROOT);
  const notes = [];
  if (inv.hasMarker && topics.length > 0) notes.push('The flat marker is removed.');
  if (removed.length) notes.push(`Deleted after writing: ${removed.map((t) => t.path).join(', ')}.`);
  if (notes.length) console.log(`\n${notes.join('\n')}`);
}

function readPlan(root) {
  const abs = path.join(root, PLAN_FILE);
  if (!fs.existsSync(abs)) throw new UsageError(`${PLAN_FILE} does not exist — write the plan first`);
  try { return JSON.parse(fs.readFileSync(abs, 'utf8').replace(BOM, '')); }
  catch (e) { throw new UsageError(`${PLAN_FILE} is not valid JSON: ${e.message}`); }
}

// ── COMMANDS ───────────────────────────────────────────────────────────────────────────────
function apply(root, dryRun) {
  const inv = inventory(root);
  const plan = readPlan(root);
  if (plan.fingerprint !== inv.fingerprint) {
    console.log(`The architecture files changed since parse (fingerprint ${plan.fingerprint} ≠ ${inv.fingerprint}) — run parse again and rebuild the plan. Nothing written.`);
    return EXIT.STALE;
  }
  if (inv.items.length === 0) { console.log('INFO [architecture] optimise: no architecture document — file unchanged'); return EXIT.OK; }
  const checked = checkPlan(inv, plan);
  if (checked.errors.length) {
    console.log(`The plan is not valid — nothing written:\n${checked.errors.map((e) => `  - ${e}`).join('\n')}`);
    return EXIT.INVALID;
  }
  const files = render(checked, inv);
  const problems = proveRendered(files, checked, inv);
  if (problems.length) {
    console.log(`WARN [architecture] optimise: ${checked.total} items before, the output does not match — file unchanged\n${problems.map((e) => `  - ${e}`).join('\n')}`);
    return EXIT.INVALID;
  }
  if (dryRun) { printOutline(inv, checked); return EXIT.OK; }
  const write = (rel, entries) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), toLines(entries).join(inv.eol) + inv.eol);
  };
  for (const [rel, lines] of files) if (rel !== ROOT_FILE) write(rel, lines);
  write(ROOT_FILE, files.get(ROOT_FILE));
  const deleted = inv.topics.filter((t) => !files.has(t.path) && fs.existsSync(path.join(root, t.path)));
  for (const t of deleted) fs.rmSync(path.join(root, t.path));
  if (fs.existsSync(path.join(root, TOPICS_DIR)) && fs.readdirSync(path.join(root, TOPICS_DIR)).length === 0) fs.rmdirSync(path.join(root, TOPICS_DIR));
  fs.rmSync(path.join(root, PLAN_FILE));
  const after = inventory(root);
  const n = checked.total;
  console.log(`INFO [architecture] optimise: topics=${checked.topics.length} root=${checked.dest.get(ROOT).length} items=${n}`);
  console.log(`\n| Topic | Items |\n|-------|-------|\n${[...checked.topics.map((t) => t.slug), ROOT].map((k) => `| ${k} | ${checked.dest.get(k).length} |`).join('\n')}`);
  if (deleted.length) console.log(`\nDeleted: ${deleted.map((t) => t.path).join(', ')}`);
  if (after.items.length !== n) {
    console.log(`WARN [architecture] optimise: wrote ${after.items.length} items, expected ${n} — check git diff`);
    return EXIT.INVALID;
  }
  return EXIT.OK;
}

function main(argv) {
  const args = argv.filter((a) => a !== '--dry-run');
  const rootAt = args.indexOf('--root');
  let root = process.cwd();
  if (rootAt >= 0) {
    if (!args[rootAt + 1]) throw new UsageError('--root needs a directory');
    root = path.resolve(args[rootAt + 1]);
    args.splice(rootAt, 2);
  }
  const dryRun = argv.includes('--dry-run');
  const [command, ...extra] = args;
  if (!command || command === '--help' || command === '-h' || extra.length) {
    console.log(USAGE);
    return command === '--help' || command === '-h' ? EXIT.OK : EXIT.USAGE;
  }
  if (command === 'parse') { printParse(inventory(root)); return EXIT.OK; }
  if (command === 'apply') return apply(root, dryRun);
  if (command === 'discard') { fs.rmSync(path.join(root, PLAN_FILE), { force: true }); return EXIT.OK; }
  console.log(USAGE);
  return EXIT.USAGE;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof UsageError ? e.message : `architecture-layout: ${e.stack ?? e}`);
  process.exitCode = EXIT.USAGE;
}
