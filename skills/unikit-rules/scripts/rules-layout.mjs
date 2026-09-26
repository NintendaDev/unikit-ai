#!/usr/bin/env node
// rules-layout.mjs — the mechanical half of `/unikit-rules optimise`.
//
// The agent decides WHERE every rule goes; this script does everything that has to be exact.
//   parse    Inventory of `.unikit/RULES.md` and the topic files its `## Topics` table lists.
//            Every line is either layout structure or belongs to exactly one item: a rule
//            (R<n>) or a block the grammar does not recognise (B<n>). No format is guessed,
//            and nothing is lost — an unknown shape surfaces as a block for the agent to place.
//   apply    Reads the agent's plan (`.unikit/rules-layout.plan.json`), proves that every item
//            lands exactly once and word for word, then writes the topic files and the root.
//            `--dry-run` prints the preview instead and writes nothing.
//   discard  Deletes the plan file (the user cancelled).
//
// Self-contained: Node >= 18, no dependencies, no sibling modules.
// Exit codes: 0 ok · 1 usage or I/O · 2 invalid plan or failed invariant (nothing written)
//             · 3 the rule files changed since `parse`.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// ── CONSTANTS ──────────────────────────────────────────────────────────────────────────────
const ROOT_FILE = '.unikit/RULES.md';
const TOPICS_DIR = '.unikit/rules';
const PLAN_FILE = '.unikit/rules-layout.plan.json';
const PLAN_VERSION = 1;
const TITLE = '# Project Rules';
const TOPIC_TITLE_PREFIX = '# Project Rules — ';
const HEADER = [
  'Project-specific rules that override or extend the base knowledge rules in `.unikit/memory/`.',
  'One rule per line, one directive per rule. When this file has a `## Topics` table, the rules under `## Common` apply to every task, and a topic file applies when the work matches its "Load when" — check again when the work moves to a new phase or area, and when unsure, load it.',
].join('\n');
// Every header line a UniKit template has ever written (git history of the unikit-rules
// template): these, and only these, are replaced by HEADER.
const KNOWN_HEADER_RES = [
  /^Project-specific rules that override or extend the base knowledge rules in `\.unikit\/memory\/`\.$/,
  /^One rule per line, one directive per rule\./,
  /^For base code style see `[^`]*code-style\.md`\.$/,
];
const BOM = String.fromCharCode(0xfeff);
const FLAT_MARKER = '<!-- unikit:rules-layout flat -->';
const TOPICS_HEADING_TEXT = 'Topics';
const COMMON_HEADING_TEXT = 'Common';
const TABLE_HEADER = '| Topic | Load when |';
const TABLE_DELIMITER = '|-------|-----------|';
const COMMON = 'common';
const RULE_MARKER = '- ';
const BLOCK_INDENT = '  ';
const EXIT = { OK: 0, USAGE: 1, INVALID: 2, STALE: 3 };
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,2}$/;
const ID_RE = /^([RB])(\d+)$/;
const RANGE_RE = /^([RB])(\d+)-(?:[RB])?(\d+)$/;
const ITEM_RE = /^([-*+]|\d{1,3}[.)])[ \t]+(?=\S)/;
const NUMBERED_RE = /^\d{1,3}[.)][ \t]+\S/;
const HEADING_RE = /^(#{1,6})[ \t]+(.*?)[ \t#]*$/;
const SEPARATOR_RE = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const FENCE_RE = /^[ \t]*(`{3,}|~{3,})/;
const INDENTED_RE = /^[ \t]+\S/;
const TABLE_HEAD_RE = /^\|\s*Topic\s*\|\s*Load when\s*\|\s*$/i;
const TABLE_DELIM_RE = /^\|[\s:|-]+\|\s*$/;
const TABLE_ROW_RE = /^\|\s*\[([^\]]+)\]\(rules\/([a-z0-9-]+)\.md\)\s*\|\s*(.*?)\s*\|\s*$/;
const FORBIDDEN_CELL_RE = /[|\r\n]/;
const FORBIDDEN_TITLE_RE = /[|[\]\r\n]/;

const USAGE = `Usage: node rules-layout.mjs <command> [--root <project dir>]
  parse [--json]      inventory of .unikit/RULES.md and its topic files
  apply [--dry-run]   check and write the plan in ${PLAN_FILE} (--dry-run: preview only)
  discard             delete ${PLAN_FILE}`;

// ── READING ────────────────────────────────────────────────────────────────────────────────
function readRuleFile(abs) {
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
const quoteLines = (text) => text.split('\n').filter(Boolean).map((l) => `"${l}"`).join(' · ') || 'nothing';

function fenceEnd(lines, openIndex, openText) {
  const open = FENCE_RE.exec(openText)[1];
  const close = new RegExp(`^[ \\t]*${open[0] === '`' ? '`' : '~'}{${open.length},}[ \\t]*$`);
  let k = openIndex + 1;
  while (k < lines.length && !close.test(lines[k])) k++;
  return Math.min(k + 1, lines.length);
}

// An item runs from its marker line over indented continuation lines, fenced code (also a
// fence at column 0 right after the item, with no blank line between), numbered steps at
// column 0 right under a bullet that ends with a colon (steps of that rule, not rules of
// their own), and blank lines that are followed by more indented continuation.
function itemEnd(lines, start) {
  const marker = ITEM_RE.exec(lines[start])[0];
  const bullet = !NUMBERED_RE.test(lines[start]);
  let steps = false;
  let j = FENCE_RE.test(lines[start].slice(marker.length)) ? fenceEnd(lines, start, lines[start].slice(marker.length)) : start + 1;
  while (j < lines.length) {
    if (isBlank(lines[j])) {
      let k = j;
      while (k < lines.length && isBlank(lines[k])) k++;
      if (k < lines.length && INDENTED_RE.test(lines[k])) { j = k; continue; }
      break;
    }
    if (FENCE_RE.test(lines[j])) { j = fenceEnd(lines, j, lines[j]); continue; }
    if (bullet && NUMBERED_RE.test(lines[j]) && (steps || /:\s*$/.test(lines[j - 1]))) { steps = true; j++; continue; }
    if (INDENTED_RE.test(lines[j])) { j++; continue; }
    break;
  }
  return j;
}

function startsSomethingElse(line, role) {
  return HEADING_RE.test(line) || SEPARATOR_RE.test(line) || ITEM_RE.test(line) || FENCE_RE.test(line)
    || (role === 'root' && line.trim() === FLAT_MARKER);
}

// Scans one file into structure and items. `role` is 'root' or 'topic'.
function scanFile(lines, role) {
  const out = { items: [], structure: [], rows: [], hasTable: false, hasMarker: false, header: null, title: null };
  let section = null;
  let titleSeen = false;
  let headerPending = false;
  let i = 0;
  const push = (kind, from, to, extra = {}) => out.structure.push({ kind, from: from + 1, to, ...extra });
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) { i++; continue; }
    if (role === 'root' && line.trim() === FLAT_MARKER) {
      out.hasMarker = true; push('marker', i, i + 1); i++; continue;
    }
    const heading = HEADING_RE.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      headerPending = false;
      if (level === 1 && !titleSeen) {
        titleSeen = true; out.title = text; headerPending = role === 'root'; push('title', i, i + 1); i++; continue;
      }
      if (role === 'root' && level === 2 && text === TOPICS_HEADING_TEXT) {
        let k = i + 1;
        while (k < lines.length && isBlank(lines[k])) k++;
        if (k + 1 < lines.length && TABLE_HEAD_RE.test(lines[k]) && TABLE_DELIM_RE.test(lines[k + 1])) {
          out.hasTable = true;
          let r = k + 2;
          while (r < lines.length && lines[r].trim().startsWith('|')) {
            const row = TABLE_ROW_RE.exec(lines[r].trim());
            out.rows.push(row ? { title: row[1].trim(), slug: row[2], loadWhen: row[3], line: r + 1 } : { bad: lines[r], line: r + 1 });
            r++;
          }
          push('topics-table', i, r); section = null; i = r; continue;
        }
      }
      if (role === 'root' && level === 2 && text === COMMON_HEADING_TEXT) {
        push('common-heading', i, i + 1); section = null; i++; continue;
      }
      section = text; push('section-heading', i, i + 1, { text }); i++; continue;
    }
    if (SEPARATOR_RE.test(line)) { headerPending = false; push('separator', i, i + 1); i++; continue; }
    if (ITEM_RE.test(line)) {
      headerPending = false;
      const end = itemEnd(lines, i);
      out.items.push({ kind: 'rule', from: i + 1, to: end, section, marker: ITEM_RE.exec(line)[1], lines: lines.slice(i, end) });
      i = end; continue;
    }
    let end = i + 1;
    if (FENCE_RE.test(line)) end = fenceEnd(lines, i, line);
    else while (end < lines.length && !isBlank(lines[end]) && !startsSomethingElse(lines[end], role)) end++;
    if (headerPending) {
      // Only the lines UniKit itself ever wrote there are header; a line the user added to the
      // header paragraph is content, and surfaces as a block like any other unknown text.
      headerPending = false;
      const para = lines.slice(i, end);
      const known = (line) => KNOWN_HEADER_RES.some((re) => re.test(line.trim()));
      out.header = para.filter(known).join('\n');
      push('header', i, end);
      const extra = para.map((line, n) => ({ line, n: i + n })).filter(({ line }) => !known(line));
      if (extra.length) out.items.push({ kind: 'block', from: extra[0].n + 1, to: extra[extra.length - 1].n + 1, section, marker: null, lines: extra.map((e) => e.line) });
    } else {
      out.items.push({ kind: 'block', from: i + 1, to: end, section, marker: null, lines: lines.slice(i, end) });
    }
    i = end;
  }
  return out;
}

// ── INVENTORY ──────────────────────────────────────────────────────────────────────────────
function inventory(root) {
  const inv = { state: 'none', files: [], topics: [], missing: [], unlisted: [], warnings: [], items: [], header: null, hasMarker: false, eol: '\n' };
  const rootAbs = path.join(root, ROOT_FILE);
  if (!fs.existsSync(rootAbs)) return withFingerprint(inv);
  const rootRead = readRuleFile(rootAbs);
  const rootScan = scanFile(rootRead.lines, 'root');
  inv.eol = rootRead.eol;
  inv.header = rootScan.header;
  inv.hasMarker = rootScan.hasMarker;
  inv.files.push({ path: ROOT_FILE, role: 'root', slug: null, lines: rootRead.lines.length, sha: rootRead.sha, scan: rootScan });
  if (rootScan.hasTable && rootScan.hasMarker) inv.warnings.push('WARN [rules] layout: flat marker ignored — the file already has a ## Topics table');
  for (const row of rootScan.rows) {
    if (row.bad) { inv.warnings.push(`WARN [rules] topic table: row ${row.line} is not a [Title](rules/<slug>.md) row — ignored: ${row.bad.trim()}`); continue; }
    const rel = `${TOPICS_DIR}/${row.slug}.md`;
    const abs = path.join(root, rel);
    inv.topics.push({ slug: row.slug, title: row.title, loadWhen: row.loadWhen, path: rel });
    if (!fs.existsSync(abs)) { inv.missing.push(row.slug); inv.warnings.push(`WARN [rules] topic file missing: ${rel}`); continue; }
    const read = readRuleFile(abs);
    inv.files.push({ path: rel, role: 'topic', slug: row.slug, lines: read.lines.length, sha: read.sha, scan: scanFile(read.lines, 'topic') });
  }
  const listed = new Set(inv.topics.map((t) => `${t.slug}.md`));
  const dirAbs = path.join(root, TOPICS_DIR);
  if (fs.existsSync(dirAbs)) {
    for (const name of fs.readdirSync(dirAbs).filter((n) => n.endsWith('.md')).sort()) {
      if (!listed.has(name)) {
        inv.unlisted.push(`${TOPICS_DIR}/${name}`);
        inv.warnings.push(`WARN [rules] topic table: ${TOPICS_DIR}/${name} is not listed under ## Topics — no reader loads it`);
      }
    }
  }
  let [rules, blocks] = [0, 0];
  for (const file of inv.files) {
    for (const item of file.scan.items) {
      const id = item.kind === 'rule' ? `R${++rules}` : `B${++blocks}`;
      inv.items.push({ id, file: file.path, source: file.slug, ...item, text: item.lines.join('\n') });
    }
  }
  inv.state = rootScan.hasTable ? 'topics' : rootScan.hasMarker ? 'flat' : inv.items.length === 0 ? 'empty' : 'legacy';
  return withFingerprint(inv);
}

function withFingerprint(inv) {
  const h = createHash('sha256');
  for (const f of inv.files) h.update(`${f.path}\0${f.sha}\n`);
  inv.fingerprint = h.digest('hex').slice(0, 16);
  return inv;
}

// ── PARSE OUTPUT ───────────────────────────────────────────────────────────────────────────
function printParse(inv, asJson) {
  if (asJson) {
    const files = inv.files.map(({ scan, ...f }) => ({ ...f, structure: scan.structure }));
    return console.log(JSON.stringify({ ...inv, files, items: inv.items.map(({ lines, ...it }) => it) }, null, 2));
  }
  const count = (k) => inv.items.filter((it) => it.kind === k).length;
  console.log(`rules-layout parse — state: ${inv.state}   fingerprint: ${inv.fingerprint}`);
  console.log(`rules: ${count('rule')}   blocks: ${count('block')}   files: ${inv.files.map((f) => `${f.path} (${f.lines} lines)`).join(', ') || 'none'}`);
  if (inv.header !== null) console.log(`header paragraph: ${inv.header === HEADER ? 'canonical' : `not canonical — apply replaces these template lines: ${quoteLines(inv.header)}`}`);
  if (inv.hasMarker) console.log('flat marker: present — apply removes it');
  for (const w of inv.warnings) console.log(w);
  for (const file of inv.files) {
    console.log(`\n## ${file.path}`);
    const dropped = file.scan.structure.filter((s) => s.kind === 'section-heading' || s.kind === 'separator');
    if (dropped.length) console.log(`(${dropped.length} section headings/separators — removed by apply; their rules keep their order)`);
    let section;
    for (const it of inv.items.filter((x) => x.file === file.path)) {
      if (it.section !== section) { section = it.section; if (section) console.log(`### ${section}`); }
      const where = it.from === it.to ? `L${it.from}` : `L${it.from}-${it.to}`;
      const [first, ...rest] = it.lines;
      console.log(`${it.id.padEnd(5)}${where.padEnd(10)}${it.kind === 'block' ? '[block] ' : ''}${first}`);
      for (const line of rest) console.log(`${' '.repeat(15)}${line}`);
    }
  }
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
    else errors.push(`"${token}" is not an item id (R<n>, B<n>, or a range such as R3-R9)`);
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
    else if (t.slug === COMMON || slugs.has(t.slug)) errors.push(`topic slug "${t.slug}" is reserved or used twice`);
    slugs.add(t?.slug);
    if (!t?.title || FORBIDDEN_TITLE_RE.test(t.title)) errors.push(`topic "${t?.slug}": title is empty or carries | [ ] or a line break`);
    if (!t?.loadWhen || FORBIDDEN_CELL_RE.test(t.loadWhen)) errors.push(`topic "${t?.slug}": "Load when" is empty or carries | or a line break`);
  }
  const byId = new Map(inv.items.map((it) => [it.id, it]));
  const order = new Map(inv.items.map((it, n) => [it.id, n]));
  // `attach`: a block that belongs to the item right above it (a table or an example under a
  // rule) travels inside that item instead of becoming a rule of its own.
  const attachedIds = new Set();
  for (const id of expandIds(plan.attach ?? [], errors)) {
    const block = byId.get(id);
    const above = block && inv.items[order.get(id) - 1];
    if (!block || block.kind !== 'block') errors.push(`attach: ${id} is not a block`);
    else if (!above || above.file !== block.file) errors.push(`attach: ${id} has no item above it in ${block.file}`);
    else attachedIds.add(id);
  }
  const hostOf = (id) => { let n = order.get(id) - 1; while (attachedIds.has(inv.items[n].id)) n--; return inv.items[n].id; };
  const attached = new Map();
  for (const id of [...attachedIds].sort((a, b) => order.get(a) - order.get(b))) {
    const host = hostOf(id);
    attached.set(host, [...(attached.get(host) ?? []), byId.get(id)]);
  }
  const dest = new Map([[COMMON, []], ...topics.map((t) => [t.slug, []])]);
  const seen = new Map();
  for (const [key, value] of Object.entries(plan.assign ?? {})) {
    if (!dest.has(key)) { errors.push(`"assign" names "${key}", which is neither "common" nor a topic of the plan`); continue; }
    for (const id of expandIds(value, errors)) {
      if (!byId.has(id)) errors.push(`${id} does not exist in the inventory`);
      else if (attachedIds.has(id)) errors.push(`${id} is attached to ${hostOf(id)} and travels with it — do not assign it`);
      else if (seen.has(id)) errors.push(`${id} is assigned twice (${seen.get(id)} and ${key})`);
      else { seen.set(id, key); dest.get(key).push(byId.get(id)); }
    }
  }
  const unassigned = inv.items.filter((it) => !seen.has(it.id) && !attachedIds.has(it.id)).map((it) => it.id);
  if (unassigned.length) errors.push(`not assigned — every item needs one place, nothing is deleted: ${unassigned.join(', ')}`);
  for (const t of topics) if (dest.get(t.slug)?.length === 0) errors.push(`topic "${t.slug}" receives no rule — there is never an empty topic`);
  for (const list of dest.values()) list.sort((a, b) => order.get(a.id) - order.get(b.id));
  const text = (item) => [ownText(item), ...(attached.get(item.id) ?? []).map(indentBlock)].join('\n\n');
  return { errors, topics, dest, attached, attachedIds, text, total: inv.items.length - attachedIds.size };
}

// The only changes a text undergoes: a rule's marker becomes `- `; a block becomes a rule item
// (`- ` before its first line, the rest indented) or, attached, an indented part of its host.
function ownText(item) {
  if (item.kind === 'rule') return RULE_MARKER + item.lines[0].replace(ITEM_RE, '') + (item.lines.length > 1 ? '\n' + item.lines.slice(1).join('\n') : '');
  return RULE_MARKER + indentBlock(item).slice(BLOCK_INDENT.length);
}

function indentBlock(block) {
  return block.lines.map((line) => (isBlank(line) ? '' : BLOCK_INDENT + line)).join('\n');
}

function render(checked) {
  const { topics, dest } = checked;
  const texts = (key) => dest.get(key).map(checked.text);
  const files = new Map();
  for (const t of topics) files.set(`${TOPICS_DIR}/${t.slug}.md`, [TOPIC_TITLE_PREFIX + t.title, '', ...texts(t.slug)]);
  const root = [TITLE, '', HEADER, ''];
  if (topics.length > 0) {
    const rows = [...topics].sort(bySlug).map((t) => `| [${t.title}](rules/${t.slug}.md) | ${t.loadWhen} |`);
    root.push(`## ${TOPICS_HEADING_TEXT}`, '', TABLE_HEADER, TABLE_DELIMITER, ...rows, '', `## ${COMMON_HEADING_TEXT}`, '');
  }
  root.push(...texts(COMMON));
  while (root[root.length - 1] === '') root.pop();
  files.set(ROOT_FILE, root);
  return files;
}

// Re-scans every rendered file and demands exactly the expected rule texts, in order.
function proveRendered(files, checked) {
  const problems = [];
  for (const [rel, lines] of files) {
    const scan = scanFile(toLines(lines), rel === ROOT_FILE ? 'root' : 'topic');
    const key = rel === ROOT_FILE ? COMMON : path.basename(rel, '.md');
    const expected = checked.dest.get(key).map(checked.text);
    const got = scan.items.map((it) => (it.kind === 'rule' ? it.lines.join('\n') : `[block] ${it.lines.join('\n')}`));
    if (got.length !== expected.length || got.some((text, n) => text !== expected[n])) {
      problems.push(`${rel}: expected ${expected.length} rules, re-reading the output gives ${got.length}${got.find((t, n) => t !== expected[n]) ? ` (first difference: "${(got.find((t, n) => t !== expected[n]) ?? '').split('\n')[0]}")` : ''}`);
    }
  }
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

function printPreview(inv, checked) {
  const { topics, dest } = checked;
  const n = checked.total;
  const removed = inv.topics.filter((t) => !topics.some((x) => x.slug === t.slug));
  console.log(`## Proposed layout — ${topics.length} topics, ${dest.get(COMMON).length} common rules, ${n} rules\n`);
  console.log('| Topic | Load when | Rules | Change |\n|-------|-----------|-------|--------|');
  for (const t of [...topics].sort(bySlug)) console.log(`| [${t.title}](rules/${t.slug}.md) | ${t.loadWhen} | ${dest.get(t.slug).length} | ${changeLabel(t, checked, inv)} |`);
  for (const t of removed) console.log(`| [${t.title}](rules/${t.slug}.md) | ${t.loadWhen} | 0 | removed |`);
  console.log(`| common | — | ${dest.get(COMMON).length} | — |`);
  const section = (heading, list) => { console.log(`\n### ${heading} (${list.length})`); for (const it of list) console.log(checked.text(it)); };
  for (const t of topics) section(`${t.title} — rules/${t.slug}.md`, dest.get(t.slug));
  section('Common', dest.get(COMMON));
  const notes = [];
  const blocks = inv.items.filter((it) => it.kind === 'block' && !checked.attachedIds.has(it.id));
  if (blocks.length) notes.push(`Blocks turned into rule items, text unchanged: ${blocks.map((b) => `${b.id} (${b.file}:${b.from})`).join(', ')}.`);
  for (const [host, list] of checked.attached) notes.push(`${list.map((b) => b.id).join(', ')} stay inside ${host}, as part of its text.`);
  const remarked = inv.items.filter((it) => it.kind === 'rule' && it.marker !== '-').length;
  if (remarked) notes.push(`${remarked} rules change only their list marker to "- ".`);
  if (inv.header !== null && inv.header !== HEADER) notes.push(`The header paragraph is replaced with the canonical one; it replaces: ${quoteLines(inv.header)}.`);
  if (inv.hasMarker) notes.push('The flat marker is removed.');
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
class UsageError extends Error {}

function apply(root, dryRun) {
  const inv = inventory(root);
  const plan = readPlan(root);
  if (plan.fingerprint !== inv.fingerprint) {
    console.log(`The rule files changed since parse (fingerprint ${plan.fingerprint} ≠ ${inv.fingerprint}) — run parse again and rebuild the plan. Nothing written.`);
    return EXIT.STALE;
  }
  if (inv.items.length === 0) { console.log('INFO [rules] optimise: no rules — file unchanged'); return EXIT.OK; }
  const checked = checkPlan(inv, plan);
  if (checked.errors.length) {
    console.log(`The plan is not valid — nothing written:\n- ${checked.errors.join('\n- ')}`);
    return EXIT.INVALID;
  }
  const files = render(checked);
  const problems = proveRendered(files, checked);
  if (problems.length) {
    console.log(`WARN [rules] optimise: ${checked.total} rules before, the output does not match — file unchanged\n- ${problems.join('\n- ')}`);
    return EXIT.INVALID;
  }
  if (dryRun) { printPreview(inv, checked); return EXIT.OK; }
  const write = (rel, entries) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), toLines(entries).join(inv.eol) + inv.eol);
  };
  for (const [rel, lines] of files) if (rel !== ROOT_FILE) write(rel, lines);
  write(ROOT_FILE, files.get(ROOT_FILE));
  const deleted = inv.topics.filter((t) => !files.has(t.path) && fs.existsSync(path.join(root, t.path)));
  for (const t of deleted) fs.rmSync(path.join(root, t.path));
  fs.rmSync(path.join(root, PLAN_FILE));
  const after = inventory(root);
  const rulesAfter = after.items.filter((it) => it.kind === 'rule').length;
  const n = checked.total;
  console.log(`INFO [rules] optimise: topics=${checked.topics.length} common=${checked.dest.get(COMMON).length} rules=${n}`);
  console.log('\n| Topic | Rules |\n|-------|-------|');
  for (const t of checked.topics) console.log(`| ${t.slug} | ${checked.dest.get(t.slug).length} |`);
  console.log(`| common | ${checked.dest.get(COMMON).length} |`);
  if (deleted.length) console.log(`\nDeleted: ${deleted.map((t) => t.path).join(', ')}`);
  if (rulesAfter !== n || after.items.length !== n) {
    console.log(`WARN [rules] optimise: wrote ${rulesAfter} rules, expected ${n} — check git diff`);
    return EXIT.INVALID;
  }
  return EXIT.OK;
}

function main(argv) {
  const args = [...argv];
  const take = (flag) => { const k = args.indexOf(flag); if (k < 0) return false; args.splice(k, 1); return true; };
  const rootAt = args.indexOf('--root');
  let root = process.cwd();
  if (rootAt >= 0) {
    if (!args[rootAt + 1]) throw new UsageError('--root needs a directory');
    root = path.resolve(args[rootAt + 1]);
    args.splice(rootAt, 2);
  }
  const json = take('--json');
  const dryRun = take('--dry-run');
  const [command, ...extra] = args;
  if (!command || command === '--help' || command === '-h' || extra.length) {
    console.log(USAGE);
    return command === '--help' || command === '-h' ? EXIT.OK : EXIT.USAGE;
  }
  if (command === 'parse') { printParse(inventory(root), json); return EXIT.OK; }
  if (command === 'apply') return apply(root, dryRun);
  if (command === 'discard') { fs.rmSync(path.join(root, PLAN_FILE), { force: true }); return EXIT.OK; }
  console.log(USAGE);
  return EXIT.USAGE;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (e) {
  console.error(e instanceof UsageError ? e.message : `rules-layout: ${e.stack ?? e}`);
  process.exitCode = EXIT.USAGE;
}
