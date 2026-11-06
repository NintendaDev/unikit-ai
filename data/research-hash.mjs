#!/usr/bin/env node
// Prints the SHA-256 of the Active Summary region of a research manifest.
// Usage: node research-hash.mjs <path to RESEARCH.md>
// Exit 0: the digest on stdout. 2: the markers are missing or duplicated. 3: no readable file.
// Works on bytes (latin1), so the digest does not depend on the shell, the code page or the locale.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const START = '<!-- unikit:active-summary:start -->';
const END = '<!-- unikit:active-summary:end -->';
const BOM = '\xEF\xBB\xBF';

const file = process.argv[2];
let text;
try {
  text = readFileSync(file, 'latin1');
} catch {
  console.error(`research-hash: cannot read ${file}`);
  process.exit(3);
}

const lines = text.replace(/\r/g, '').split('\n');
if (lines[0].startsWith(BOM)) lines[0] = lines[0].slice(BOM.length);
const starts = lines.flatMap((line, i) => (line === START ? [i] : []));
const ends = lines.flatMap((line, i) => (line === END ? [i] : []));
if (starts.length !== 1 || ends.length !== 1 || ends[0] < starts[0]) {
  console.error(`research-hash: ${file}: Active Summary markers missing or duplicated`);
  process.exit(2);
}

const region = lines.slice(starts[0] + 1, ends[0]).map((line) => line.replace(/ +$/, ''));
if (region.length > 0 && region[0].startsWith(BOM)) region[0] = region[0].slice(BOM.length);
const normalized = `${region.join('\n').replace(/\n+$/, '')}\n`;
console.log(createHash('sha256').update(Buffer.from(normalized, 'latin1')).digest('hex'));
