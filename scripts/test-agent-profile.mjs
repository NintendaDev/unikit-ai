// Unit tests for the agent subagent profile: the registry values (P), and — once the template
// layer reads them — the {{agent_*}} variables (V). Consumed from scripts/test-skills.sh
// (Part 7f4). Imports the compiled build because tests run after `ensure_build` in the parent
// harness. Writes nothing into the repository.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const { AGENT_REGISTRY } = await import(dist('core/agents.js'));
const { buildTemplateVars, processTemplate } = await import(dist('core/template.js'));
const { buildSubagentTemplateVars } = await import(dist('core/installer/shared.js'));
const { computeSourceHashWithTemplate } = await import(dist('core/installer/hashing.js'));
const { installSkills } = await import(dist('core/installer/skills.js'));

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

function assertEq(name, actual, expected) {
    if (actual === expected) {
        pass(name);
    } else {
        fail(name, `\n  expected: ${JSON.stringify(expected)}\n  actual:   ${JSON.stringify(actual)}`);
    }
}

function assertTrue(name, condition, detail = '') {
    if (condition) {
        pass(name);
    } else {
        fail(name, detail || 'condition is false');
    }
}

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

async function walk(dir) {
    const out = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...await walk(full));
        else out.push(full);
    }
    return out;
}

// The profile as the research package states it (ASP-REQ-001, ASP-REQ-008). Writing the table
// out here is the point: a changed registry value shows up as a red test, never silently.
const EXPECTED = {
    claude: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'sonnet' },
    codex: { readerType: 'explorer', workerType: 'worker', modelDefault: '' },
    cursor: { readerType: 'explore', workerType: 'generalPurpose', modelDefault: '' },
    qwen: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: '' },
    opencode: { readerType: 'explore', workerType: 'general', modelDefault: '' },
    antigravity: { readerType: 'research', workerType: 'self', modelDefault: 'flash' },
    kimi: { readerType: 'explore', workerType: 'coder', modelDefault: '' },
    universal: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: '' },
};

// ── P: the registry profile (Task 18) ───────────────────────────────────────

await group('P', async () => {
    const agents = Object.values(AGENT_REGISTRY);
    assertTrue('P0 the registry is not empty', agents.length > 0);

    for (const agent of agents) {
        const profile = agent.subagentProfile;
        const typesOk = profile
            && typeof profile.readerType === 'string' && /^\S+$/.test(profile.readerType)
            && typeof profile.workerType === 'string' && /^\S+$/.test(profile.workerType);
        assertTrue(`P1 ${agent.id}: readerType and workerType are non-empty strings without spaces`, Boolean(typesOk), JSON.stringify(profile));
        if (!profile) continue;

        assertTrue(`P2 ${agent.id}: the reader is not the worker`, profile.readerType !== profile.workerType, profile.readerType);
        assertTrue(
            `P3 ${agent.id}: modelDefault is empty or a stable vendor alias (letters only)`,
            typeof profile.modelDefault === 'string' && (profile.modelDefault === '' || /^[a-z]+$/.test(profile.modelDefault)),
            JSON.stringify(profile.modelDefault),
        );
    }

    for (const [id, expected] of Object.entries(EXPECTED)) {
        assertEq(`P4 ${id}: the profile matches the table`, JSON.stringify(AGENT_REGISTRY[id]?.subagentProfile), JSON.stringify(expected));
    }

    assertEq(
        'P5 the registry holds exactly the eight known agents (a new agent needs a conscious edit here and a config-template key)',
        Object.keys(AGENT_REGISTRY).sort().join(','),
        Object.keys(EXPECTED).sort().join(','),
    );
});

// ── V: template variables and the hash (Task 19) ────────────────────────────

const PROFILE_VARS = ['agent_id', 'agent_reader_type', 'agent_worker_type', 'agent_model_default'];

await group('V', async () => {
    const kimiVars = buildTemplateVars(AGENT_REGISTRY.kimi);
    assertEq(
        'V1 buildTemplateVars(kimi) carries the profile',
        JSON.stringify(PROFILE_VARS.map((k) => kimiVars[k])),
        JSON.stringify(['kimi', 'explore', 'coder', '']),
    );

    const probe = '{{agent_id}} {{agent_reader_type}} {{agent_worker_type}} [{{agent_model_default}}]';
    assertEq('V2a claude substitution', processTemplate(probe, buildTemplateVars(AGENT_REGISTRY.claude)), 'claude Explore general-purpose [sonnet]');
    assertEq('V2b kimi substitution', processTemplate(probe, buildTemplateVars(AGENT_REGISTRY.kimi)), 'kimi explore coder []');

    const neutral = buildSubagentTemplateVars('x');
    assertEq(
        'V3a subagent files and system assets get empty profile slots',
        JSON.stringify(PROFILE_VARS.map((k) => neutral[k])),
        JSON.stringify(['', '', '', '']),
    );
    assertEq('V3b the neutral substitution leaves the surrounding text alone', processTemplate('a {{agent_id}} b', neutral), 'a  b');
});

await group('V4', async () => {
    const skillDir = path.join(ROOT, 'skills', 'unikit-help');
    const hash = () => computeSourceHashWithTemplate(skillDir, 'unity', 'unikit-help', 'claude', null, {});
    const profile = AGENT_REGISTRY.claude.subagentProfile;
    const before = await hash();
    assertTrue('V4a the skill hash is computed', typeof before === 'string' && before.length > 0);

    for (const field of ['modelDefault', 'readerType', 'workerType']) {
        const original = profile[field];
        try {
            profile[field] = original + 'x';
            const changed = await hash();
            assertTrue(`V4b changing ${field} changes the skill hash`, changed !== before);
        } finally {
            profile[field] = original;
        }
        assertEq(`V4c restoring ${field} restores the skill hash`, await hash(), before);
    }
});

// ── C: the config template against the registry (Task 26) ───────────────────
// The template holds the user-facing `subagents.model` block; the registry holds the profile.
// The Claude and Antigravity defaults are written in both places (the installer never reads the
// config), so only this comparison keeps them from drifting apart. There is no YAML parser in
// the project: the block has a fixed shape and is read line by line.

await group('C', async () => {
    const template = await fs.readFile(path.join(ROOT, 'skills', 'unikit', 'references', 'config-template.yaml'), 'utf8');
    const lines = template.split(/\r?\n/);
    const start = lines.findIndex((l) => /^subagents:\s*$/.test(l));
    assertTrue('C1 the template has a top-level subagents: block', start >= 0);
    const modelAt = lines.findIndex((l, i) => i > start && /^  model:\s*$/.test(l));
    assertTrue('C2 subagents: holds a model: mapping', modelAt > start);

    const entries = {};
    for (let i = modelAt + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*#/.test(line) || line.trim() === '') continue;
        const m = /^ {4}([a-z]+):\s*([A-Za-z0-9_.-]*)\s*(?:#.*)?$/.exec(line);
        if (!m) break; // the first line that is not a 4-space key ends the block
        entries[m[1]] = m[2];
    }
    assertEq('C3 the template carries a key for exactly every registered agent', Object.keys(entries).sort().join(','), Object.keys(AGENT_REGISTRY).sort().join(','));
    for (const [id, agent] of Object.entries(AGENT_REGISTRY)) {
        assertEq(`C4 ${id}: the template default equals the profile's modelDefault`, entries[id], agent.subagentProfile.modelDefault);
    }
    assertTrue('C5 the block carries no {{placeholder}}', !lines.slice(start).some((l) => l.includes('{{')));
});

// ── I: the installed text, per agent (Task 25) ──────────────────────────────
// The table is built from AGENT_REGISTRY and goes through the real installSkills over the real
// skills/, so a new agent joins it by itself and the test cannot repeat the installer's logic.

const INSTALL_SKILLS = ['unikit-explore', 'unikit-plan', 'unikit-gd-review', 'unikit-implement', 'unikit-gd-explore', 'unikit-review'];
const countOf = (text, needle) => text.split(needle).length - 1;

await group('I', async () => {
    const agents = Object.values(AGENT_REGISTRY);
    const installed = {};

    for (const agent of agents) {
        const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), `unikit-profile-${agent.id}-`));
        try {
            await installSkills({ projectDir, skillsDir: agent.skillsDir, skills: INSTALL_SKILLS, agentId: agent.id, engineId: 'unity', engineMcpKey: null });
            const skill = (name, file = 'SKILL.md') => fs.readFile(path.join(projectDir, agent.skillsDir, name, file), 'utf8');
            const texts = {
                explore: await skill('unikit-explore'),
                plan: await skill('unikit-plan'),
                gdReview: await skill('unikit-gd-review'),
                implement: await skill('unikit-implement'),
                contract: await skill('unikit-gd-explore', path.join('references', 'delegation-contract.md')),
            };

            let leaked = 0;
            for (const file of await walk(path.join(projectDir, agent.skillsDir))) {
                if (file.endsWith('.md') && (await fs.readFile(file, 'utf8')).includes('{{agent_')) leaked++;
            }
            installed[agent.id] = texts;

            const { readerType: reader, workerType: worker, modelDefault } = agent.subagentProfile;
            assertTrue(`I1 ${agent.id}: recon-agent launches the reader type "${reader}"`, texts.explore.includes(`Agent(subagent_type: ${reader}, prompt: "<focused question>")`));
            assertTrue(`I1 ${agent.id}: check-agent launches the reader type "${reader}"`, texts.explore.includes(`Agent(subagent_type: ${reader}, prompt: "Read <path of references/coherence-gate.md>`));
            assertTrue(`I2 ${agent.id}: the recon writer launches the worker type "${worker}"`, texts.plan.includes(`Agent(subagent_type: ${worker}, prompt: "Reconnaissance for an ultra plan`));
            assertTrue(`I3 ${agent.id}: lens-agent launches the worker type "${worker}"`, texts.gdReview.includes(`Agent(subagent_type: ${worker}, prompt: "<one lens brief>")`));
            assertEq(`I3 ${agent.id}: develop-agent and docs-agent name the worker type`, countOf(texts.implement, `subagent_type: "${worker}",`), 2);
            assertTrue(`I3 ${agent.id}: a reference file carries the worker type too`, texts.contract.includes(`subagent_type: "${worker}",`));
            assertTrue(`I4 ${agent.id}: the model rule names its own config key`, texts.explore.includes(`subagents.model.${agent.id}`));
            assertTrue(`I4 ${agent.id}: the model rule carries the built-in default "${modelDefault}"`, texts.explore.includes('built-in default `"' + modelDefault + '"`'));
            assertEq(`I6 ${agent.id}: no unresolved {{agent_…}} in any installed .md`, leaked, 0);
            assertEq(`I7 ${agent.id}: the codex-only block is present for codex alone`, texts.explore.includes('Subagent Delegation — BLOCKING PRE-REQUISITE'), agent.id === 'codex');
        } finally {
            await fs.rm(projectDir, { recursive: true, force: true });
        }
    }

    // I5: no agent's text carries another agent's type. The trailing comma (and the quote on the
    // worker form) is what tells `explore` from `explorer` and `general` from `general-purpose`.
    for (const agent of agents) {
        for (const other of agents) {
            if (other.id === agent.id) continue;
            const mine = agent.subagentProfile;
            const theirs = other.subagentProfile;
            if (theirs.readerType !== mine.readerType) {
                assertTrue(`I5 ${agent.id} has no trace of ${other.id}'s reader type "${theirs.readerType}"`, !installed[agent.id].explore.includes(`Agent(subagent_type: ${theirs.readerType},`));
            }
            if (theirs.workerType !== mine.workerType) {
                assertTrue(`I5 ${agent.id} has no trace of ${other.id}'s worker type "${theirs.workerType}"`, !installed[agent.id].implement.includes(`subagent_type: "${theirs.workerType}",`));
            }
        }
    }
});

console.log(`\nagent-profile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
