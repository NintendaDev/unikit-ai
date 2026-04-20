// Scan skills/*/SKILL.md and subagents/*.md for malformed
// <!-- unikit:agents ... --> / <!-- unikit:end --> markers.
// Reuses applyAgentFilter as the validator — it already rejects inline,
// nested, unclosed, unknown-agent, and mixed include/exclude cases with
// line-numbered error messages.
//
// Consumed from scripts/test-skills.sh (Part 7g). Expects dist/ to be
// fresh (parent harness runs ensure_build before invoking).

import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const { applyAgentFilter } = await import(pathToFileURL(path.join(ROOT, 'dist', 'core', 'agent-filter.js')).href);

// Any valid agent id works — the parser validates marker tokens regardless
// of which agentId is being filtered for. Using 'claude' as the canary.
const CANARY_AGENT = 'claude';

async function collectFiles() {
    const result = [];

    const skillsDir = path.join(ROOT, 'skills');
    for (const entry of await fs.readdir(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const skillMd = path.join(skillsDir, entry.name, 'SKILL.md');
        try {
            await fs.access(skillMd);
            result.push(skillMd);
        } catch { /* missing SKILL.md is caught by other parts of test-skills.sh */ }
    }

    const subagentsDir = path.join(ROOT, 'subagents');
    try {
        for (const entry of await fs.readdir(subagentsDir, { withFileTypes: true })) {
            if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
            result.push(path.join(subagentsDir, entry.name));
        }
    } catch { /* subagents/ is optional */ }

    return result;
}

const files = await collectFiles();
let errors = 0;

for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    try {
        applyAgentFilter(content, CANARY_AGENT);
        console.log(`OK   ${path.relative(ROOT, file)}`);
    } catch (err) {
        errors++;
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`FAIL ${path.relative(ROOT, file)}: ${msg}`);
    }
}

console.log(`\nvalidate-agent-markers: ${files.length - errors}/${files.length} files clean`);
if (errors > 0) {
    process.exit(1);
}
