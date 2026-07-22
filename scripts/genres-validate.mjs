// Structural validator for bundled genre profiles (data/gamedesign/genres/*.json).
//
// Asserts required fields + valid enum values + id==basename + exact key order.
// STRUCTURAL ONLY — it does NOT cross-ref the existence of referenced packs /
// content-types: seeds legitimately forward-ref not-yet-built P1 packs and
// narrative CTs, so a cross-ref would reject valid profiles. Run by
// scripts/test-genres.sh Part 2.
//
// Usage: node scripts/genres-validate.mjs <genres-dir>

import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
if (!dir) {
  console.error('usage: node genres-validate.mjs <genres-dir>');
  process.exit(2);
}

const CONF = ['high', 'medium', 'low'];
const FLOW = ['linear', 'conditional', 'emergent'];
const SCALE = ['bulk', 'curated'];
const KIND = ['soft', 'hard', 'event'];
const REQ = [
  'schema_version', 'version', 'id', 'name', 'aliases', 'summary', 'confidence',
  'default_flow_mode', 'default_packs', 'seed_systems', 'seed_content_types',
  'seed_entities', 'seed_resources', 'critical_sections', 'review_emphasis',
];

let errors = 0;
let n = 0;

for (const file of fs.readdirSync(dir).sort()) {
  if (!file.endsWith('.json')) continue;
  n++;
  const id = file.slice(0, -'.json'.length);
  let p;
  try {
    p = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf-8'));
  } catch (e) {
    console.error(`PARSE ${file}: ${e.message}`);
    errors++;
    continue;
  }
  const E = (m) => { console.error(`${file}: ${m}`); errors++; };

  for (const k of REQ) if (!(k in p)) E(`missing required field "${k}"`);
  if (p.id !== id) E(`id "${p.id}" != basename "${id}"`);
  if (p.schema_version !== 1) E(`schema_version must be 1, got ${p.schema_version}`);
  if (typeof p.version !== 'number') E('version must be a number');
  if (!CONF.includes(p.confidence)) E(`invalid confidence "${p.confidence}"`);
  if (!FLOW.includes(p.default_flow_mode)) E(`invalid default_flow_mode "${p.default_flow_mode}"`);
  for (const arrKey of ['aliases', 'default_packs', 'critical_sections', 'review_emphasis']) {
    if (!Array.isArray(p[arrKey])) E(`${arrKey} must be an array`);
  }
  if (Array.isArray(p.review_emphasis) && p.review_emphasis.length === 0) E('review_emphasis must be non-empty');
  for (const s of (p.seed_systems || [])) {
    if (!s.slug || !s.category || !s.tier) E(`seed_system needs slug/category/tier: ${JSON.stringify(s)}`);
  }
  for (const c of (p.seed_content_types || [])) {
    if (!c.slug || !c.belongs_to || !SCALE.includes(c.scale)) E(`seed_content_type bad shape/scale: ${JSON.stringify(c)}`);
  }
  for (const r of (p.seed_resources || [])) {
    if (!r.slug || !KIND.includes(r.kind)) E(`seed_resource bad shape/kind: ${JSON.stringify(r)}`);
  }
  for (const cs of (p.critical_sections || [])) {
    if (typeof cs !== 'string' || !cs.includes('.')) E(`critical_section not "<pack>.<Section>": "${cs}"`);
  }
  // Exact key order: REQ then optional platform_default last.
  const expected = [...REQ, ...('platform_default' in p ? ['platform_default'] : [])];
  if (Object.keys(p).join(',') !== expected.join(',')) E(`key order: ${Object.keys(p).join(',')}`);
}

console.log(`${n} profiles checked, ${errors} error(s)`);
process.exit(errors ? 1 : 0);
