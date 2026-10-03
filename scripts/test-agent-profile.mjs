// Unit tests for the agent subagent profile: the registry values (P), and — once the template
// layer reads them — the {{agent_*}} variables (V). Consumed from scripts/test-skills.sh
// (Part 7f4). Imports the compiled build because tests run after `ensure_build` in the parent
// harness. Writes nothing into the repository.

import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const { AGENT_REGISTRY } = await import(dist('core/agents.js'));
const { buildTemplateVars, processTemplate } = await import(dist('core/template.js'));
const { buildSubagentTemplateVars } = await import(dist('core/installer/shared.js'));
const { computeSourceHashWithTemplate } = await import(dist('core/installer/hashing.js'));

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
        'P5 the registry holds exactly the seven known agents (a new agent needs a conscious edit here and a config-template key)',
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

console.log(`\nagent-profile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
