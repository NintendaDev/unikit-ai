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
const { computeSourceHashWithTemplate, computeSubagentSourceHash, transformRevisionComponent } = await import(dist('core/installer/hashing.js'));
const { installSkills } = await import(dist('core/installer/skills.js'));
const { getTransformer } = await import(dist('core/transformer.js'));
const { TRANSFORM_REVISIONS } = await import(dist('core/constants.js'));

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
    // The path to the skills is empty in an agent file by design, so a path built from it would lose its
    // prefix without a sound: the sources keep `{{skills_dir}}` out of subagents/ and data/ (AP-12).
    assertEq('V3c an agent file renders {{skills_dir}} empty', neutral.skills_dir, '');
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

// ── R: the transformer revision in the source hash ──────────────────────────
// The hash holds the package text, not the transformer's logic. TRANSFORM_REVISIONS is the only way
// a changed regex or adapter reaches an installed project through a plain `update`.

await group('R', async () => {
    const ids = Object.keys(AGENT_REGISTRY);
    const rewriters = ids.filter((id) => {
        const t = getTransformer(id);
        return typeof t.transformReference === 'function' || typeof t.transformSubagent === 'function';
    });
    assertTrue('R1 at least one transformer rewrites text (the check below is not vacuous)', rewriters.length > 0);
    assertEq(
        'R1 a revision exists exactly for the agents whose transformer defines transformReference or transformSubagent',
        JSON.stringify(Object.keys(TRANSFORM_REVISIONS).sort()),
        JSON.stringify([...rewriters].sort()),
    );
    assertTrue('R1 every revision is a non-empty string', Object.values(TRANSFORM_REVISIONS).every((rev) => typeof rev === 'string' && rev !== ''));

    for (const id of ids) {
        const component = transformRevisionComponent(id);
        if (rewriters.includes(id)) {
            assertEq(`R2 ${id}: the component is transform:<revision>`, component, `transform:${TRANSFORM_REVISIONS[id]}`);
        } else {
            assertEq(`R2 ${id}: no component for a transformer that rewrites nothing`, component, '');
        }
    }

    const skillDir = path.join(ROOT, 'skills', 'unikit-help');
    const subagent = path.join(ROOT, 'subagents', 'unikit-implement-worker.md');
    const skillHash = (agent) => computeSourceHashWithTemplate(skillDir, 'unity', 'unikit-help', agent, null, {});
    const subagentHash = (agent) => computeSubagentSourceHash(subagent, 'unity', agent, null, {});

    // Raising a revision changes both hashes of that agent and restoring it restores them (the V4 shape).
    for (const id of rewriters) {
        const [skillBefore, subagentBefore] = [await skillHash(id), await subagentHash(id)];
        const original = TRANSFORM_REVISIONS[id];
        try {
            TRANSFORM_REVISIONS[id] = `${original}+`;
            assertTrue(`R3 raising the ${id} revision changes the skill hash`, (await skillHash(id)) !== skillBefore);
            assertTrue(`R3 raising the ${id} revision changes the subagent hash`, (await subagentHash(id)) !== subagentBefore);
        } finally {
            TRANSFORM_REVISIONS[id] = original;
        }
        assertEq(`R3 restoring the ${id} revision restores the skill hash`, await skillHash(id), skillBefore);
        assertEq(`R3 restoring the ${id} revision restores the subagent hash`, await subagentHash(id), subagentBefore);
    }

    // An agent absent from the table contributes nothing: giving it an entry is the only thing that
    // moves its hash, so adding the table moved no hash of the agents outside it.
    const outsider = ids.find((id) => !rewriters.includes(id));
    assertTrue('R4 some agent has no revision', outsider !== undefined);
    const outsiderBefore = await skillHash(outsider);
    try {
        TRANSFORM_REVISIONS[outsider] = '1';
        assertTrue(`R4 an entry for ${outsider} would change its hash (the component is wired in)`, (await skillHash(outsider)) !== outsiderBefore);
    } finally {
        delete TRANSFORM_REVISIONS[outsider];
    }
    assertEq(`R4 without the entry the ${outsider} hash is what it was`, await skillHash(outsider), outsiderBefore);
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

const INSTALL_SKILLS = ['unikit', 'unikit-explore', 'unikit-plan', 'unikit-gd-review', 'unikit-gd-brainstorm', 'unikit-implement', 'unikit-gd-explore', 'unikit-review'];

// Forms an installed skill must never hold. The first two are what the invocation rewrite made of a
// `{{skills_dir}}/unikit-…` path before its pattern learned `}`; a bare `skills unikit-` is NOT
// listed — it is the legitimate Qwen rewrite `/skills unikit-plan`. The third is the dead call key.
const DAMAGED_FORMS = [
    ['skills$unikit-', (text) => text.includes('skills$unikit-')],
    ['skills/skills unikit-', (text) => text.includes('skills/skills unikit-')],
    ['a skills: [...] key', (text) => /^\s*skills:\s*\[/m.test(text)],
    ['an unresolved path or engine variable', (text) => /\{\{(skills_dir|home_skills_dir|settings_file|self_name|skills_cli_agent_flag|engine_name|engine_code_language|engine_mcp_tool)\}\}/.test(text)],
];
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
                unikit: await skill('unikit'),
                explore: await skill('unikit-explore'),
                plan: await skill('unikit-plan'),
                gdReview: await skill('unikit-gd-review'),
                brainstorm: await skill('unikit-gd-brainstorm'),
                implement: await skill('unikit-implement'),
                contract: await skill('unikit-gd-explore', path.join('references', 'delegation-contract.md')),
            };

            let leaked = 0;
            const damaged = new Map(DAMAGED_FORMS.map(([label]) => [label, []]));
            let scanned = 0;
            for (const file of await walk(path.join(projectDir, agent.skillsDir))) {
                if (!file.endsWith('.md')) continue;
                const text = await fs.readFile(file, 'utf8');
                scanned++;
                if (text.includes('{{agent_')) leaked++;
                for (const [label, test] of DAMAGED_FORMS) {
                    if (test(text)) damaged.get(label).push(path.relative(projectDir, file));
                }
            }
            installed[agent.id] = texts;

            const { readerType: reader, workerType: worker, modelDefault } = agent.subagentProfile;
            assertTrue(`I1 ${agent.id}: recon-agent launches the reader type "${reader}"`, texts.explore.includes(`Agent(subagent_type: ${reader}, prompt: "<focused question>")`));
            assertTrue(`I1 ${agent.id}: check-agent launches the reader type "${reader}"`, texts.explore.includes(`Agent(subagent_type: ${reader}, prompt: "Read <path of references/coherence-gate.md>`));
            assertTrue(`I2 ${agent.id}: the recon writer launches the worker type "${worker}"`, texts.plan.includes(`Agent(subagent_type: ${worker}, prompt: "Reconnaissance for an ultra plan`));
            assertTrue(`I3 ${agent.id}: lens-agent launches the worker type "${worker}"`, texts.gdReview.includes(`Agent(subagent_type: ${worker}, prompt: "<one lens brief>")`));
            assertEq(`I3 ${agent.id}: develop-agent and docs-agent name the worker type`, countOf(texts.implement, `subagent_type: "${worker}",`), 2);
            assertTrue(`I3 ${agent.id}: a reference file carries the worker type too`, texts.contract.includes(`subagent_type: "${worker}",`));

            // I8: the call names the skill FILE by this agent's own installed path — the dead `skills:` key
            // is gone and a path variable that survived to the install would show as the wrong prefix.
            const reads = (skill) => `Read ${agent.skillsDir}/${skill}/SKILL.md and follow it as your instructions throughout this task`;
            assertTrue(`I8 ${agent.id}: develop-agent reads the devcontext skill file from ${agent.skillsDir}`, texts.implement.includes(reads('unikit-devcontext')));
            assertTrue(`I8 ${agent.id}: docs-agent reads the docs skill file`, texts.implement.includes(reads('unikit-docs')));
            assertTrue(`I8 ${agent.id}: the brainstorm delegation reads the explore skill file`, texts.brainstorm.includes(reads('unikit-gd-explore')));
            assertTrue(`I8 ${agent.id}: its mirror in the delegation contract reads it too`, texts.contract.includes(reads('unikit-gd-explore')));
            assertTrue(`I8 ${agent.id}: /unikit step 9.8 reads the memory skill file`, texts.unikit.includes(reads('unikit-memory')));
            assertTrue(`I8 ${agent.id}: /unikit step 10 reads the architecture skill file`, texts.unikit.includes(reads('unikit-architecture')));

            // I9: nothing damaged anywhere in the installed set (the scan is non-empty by construction)
            assertTrue(`I9 ${agent.id}: the installed set was scanned`, scanned > 0);
            for (const [label, files] of damaged) {
                assertTrue(`I9 ${agent.id}: no installed .md holds ${label}`, files.length === 0, `found in: ${files.slice(0, 3).join(', ')}`);
            }
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
