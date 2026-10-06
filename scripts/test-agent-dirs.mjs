// Unit tests for the rules about an agent's directory: removal that takes only what UniKit installed
// (R), the "two agents never share one skills directory" rule (S) and the universal agent (U).
// Consumed from scripts/test-skills.sh (Part 7f5). Imports the compiled build because tests run after
// `ensure_build` in the parent harness. Works in temporary directories only.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

const { removeAgentSetup, collectExtensionSkillNames } = await import(dist('core/installer/agent-removal.js'));
const { findSharedSkillsDirs, describeSharedSkillsDir } = await import(dist('core/agent-skills-dir.js'));
const { AGENT_REGISTRY, getAgentChoices } = await import(dist('core/agents.js'));
const { validateAgentSelection } = await import(dist('cli/wizard/prompts.js'));
const { getTransformer, getAgentOnboarding } = await import(dist('core/transformer.js'));
const { getMcpWriter } = await import(dist('core/mcp-writers/index.js'));
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

async function project(files) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'unikit-agent-dirs-'));
    for (const [rel, text] of Object.entries(files)) {
        const target = path.join(dir, rel);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, text, 'utf8');
    }
    return dir;
}
const exists = (target) => fs.access(target).then(() => true, () => false);
const record = (id, skillsDir, installedSkills) => ({ id, skillsDir, subagentsDir: skillsDir.replace(/skills$/, 'agents'), installedSkills, installedSubagents: [] });

// ─── R: removing an agent takes only what UniKit installed ────────────────────────────────────
// `.agents/skills` is shared with other runtimes and `npx skills add`; `.claude/skills` holds the
// maintainers' own `aif-*` skills. Removal must leave all of that alone (RISK-004, DEC-009).

await group('R1', async () => {
    const dir = await project({
        '.agents/skills/unikit/SKILL.md': 'x',
        '.agents/skills/unikit-plan/SKILL.md': 'x',
        '.agents/skills/community-skill/SKILL.md': 'x',
        '.agents/skills/NOTES.txt': 'x',
        '.agents/rules/unikit.md': 'x',
    });
    try {
        const result = await removeAgentSetup(dir, record('antigravity', '.agents/skills', ['unikit', 'unikit-plan']));
        const skills = path.join(dir, '.agents', 'skills');
        assertTrue('R1 unikit is removed', !await exists(path.join(skills, 'unikit')));
        assertTrue('R1 unikit-plan is removed', !await exists(path.join(skills, 'unikit-plan')));
        assertTrue('R1 the foreign skill survives', await exists(path.join(skills, 'community-skill', 'SKILL.md')));
        assertTrue('R1 the foreign file survives', await exists(path.join(skills, 'NOTES.txt')));
        assertTrue('R1 the shared directory stays', await exists(skills));
        assertEq('R1 directoryRemoved is false', result.directoryRemoved, false);
        assertEq('R1 keptEntries names the foreign entries', JSON.stringify(result.keptEntries), '["NOTES.txt","community-skill"]');
        assertTrue('R1 the cleanup hook removed the Antigravity rules file', !await exists(path.join(dir, '.agents', 'rules', 'unikit.md')));
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R2', async () => {
    const dir = await project({
        '.agents/skills/unikit/SKILL.md': 'x',
        '.agents/skills/unikit-plan/SKILL.md': 'x',
        '.agents/rules/unikit.md': 'x',
    });
    try {
        const result = await removeAgentSetup(dir, record('antigravity', '.agents/skills', ['unikit', 'unikit-plan']));
        assertTrue('R2 the emptied skills directory is removed', !await exists(path.join(dir, '.agents', 'skills')));
        assertEq('R2 directoryRemoved is true', result.directoryRemoved, true);
        assertEq('R2 keptEntries is empty', result.keptEntries.length, 0);
        assertTrue('R2 the cleanup hook removed the Antigravity rules file', !await exists(path.join(dir, '.agents', 'rules', 'unikit.md')));
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R3', async () => {
    const dir = await project({
        '.claude/skills/unikit/SKILL.md': 'x',
        '.claude/skills/ext-skill/SKILL.md': 'x',
        '.claude/skills/aif-plan/SKILL.md': 'x',
    });
    try {
        const result = await removeAgentSetup(dir, record('claude', '.claude/skills', ['unikit']), ['ext-skill']);
        const skills = path.join(dir, '.claude', 'skills');
        assertTrue('R3 the UniKit skill is removed', !await exists(path.join(skills, 'unikit')));
        assertTrue('R3 the extension skill is removed', !await exists(path.join(skills, 'ext-skill')));
        assertTrue('R3 the foreign aif-* skill survives', await exists(path.join(skills, 'aif-plan', 'SKILL.md')));
        assertTrue('R3 the directory stays', await exists(skills));
        assertEq('R3 keptEntries is the foreign skill', JSON.stringify(result.keptEntries), '["aif-plan"]');
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R4', async () => {
    const dir = await project({});
    try {
        const result = await removeAgentSetup(dir, record('claude', '.claude/skills', ['unikit']));
        assertEq('R4 an absent skills directory: directoryRemoved is false', result.directoryRemoved, false);
        assertEq('R4 an absent skills directory: nothing kept', result.keptEntries.length, 0);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R5', async () => {
    const dir = await project({
        '.claude/skills/unikit/SKILL.md': 'x',
        '.claude/skills/unikit-orphan/SKILL.md': 'x',
    });
    try {
        await removeAgentSetup(dir, record('claude', '.claude/skills', ['unikit']));
        assertTrue('R5 a skill that is not in installedSkills survives, whatever its name looks like', await exists(path.join(dir, '.claude', 'skills', 'unikit-orphan', 'SKILL.md')));
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R6', async () => {
    const manifest = {
        name: 'ext-a',
        version: '1.0.0',
        skills: ['skills/foo-skill', 'skills/bar'],
        replaces: { 'skills/over': 'base-skill' },
    };
    const dir = await project({ '.unikit/extensions/ext-a/extension.json': JSON.stringify(manifest) });
    try {
        const config = {
            extensions: [
                { name: 'ext-a', source: 'x', version: '1.0.0', replacedSkills: { 'base-skill': 'skills/over' } },
                { name: 'ext-b', source: 'y', version: '1.0.0', replacedSkills: { 'other-base': 'skills/x' } },
            ],
        };
        const names = await collectExtensionSkillNames(dir, config);
        assertEq('R6 own skills and the replacement from the manifest, the replacement of a manifest-less extension from its record', [...names].sort().join(','), 'bar,base-skill,foo-skill,other-base');
        assertEq('R6 no config: no names', (await collectExtensionSkillNames(dir, null)).length, 0);
        assertEq('R6 a config without extensions: no names', (await collectExtensionSkillNames(dir, {})).length, 0);
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

await group('R7', async () => {
    const dir = await project({
        '.claude/skills/unikit/SKILL.md': 'x',
        '.claude/skills/base-skill/SKILL.md': 'x',
        '.claude/skills/aif-plan/SKILL.md': 'x',
    });
    try {
        await removeAgentSetup(dir, record('claude', '.claude/skills', ['unikit']), ['base-skill']);
        const skills = path.join(dir, '.claude', 'skills');
        assertTrue('R7 a replacement skill is removed although its base skill was not in installedSkills', !await exists(path.join(skills, 'base-skill')));
        assertTrue('R7 the UniKit skill is removed', !await exists(path.join(skills, 'unikit')));
        assertTrue('R7 the foreign aif-* skill survives', await exists(path.join(skills, 'aif-plan', 'SKILL.md')));
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

// ─── S: two agents never share one skills directory ───────────────────────────────────────────
// The groups of registered agents that share a skills directory. Antigravity and the universal agent
// both write `.agents/skills`; that pair is the only place the rule has work to do, and the init
// wizard, `update` and the extension commands refuse it.
const EXPECTED_SHARED_GROUPS = [{ skillsDir: '.agents/skills', agentIds: ['antigravity', 'universal'] }];

await group('S', async () => {
    const a = (id, skillsDir) => ({ id, skillsDir });

    assertEq('S1 distinct directories: no group', JSON.stringify(findSharedSkillsDirs([a('x', 'one'), a('y', 'two')])), '[]');
    assertEq('S1 distinct directories: no message', describeSharedSkillsDir([a('x', 'one'), a('y', 'two')]), null);

    assertEq(
        'S2 a shared directory forms one group, in the order given',
        JSON.stringify(findSharedSkillsDirs([a('x', '.agents/skills'), a('y', '.agents/skills'), a('z', '.z/skills')])),
        JSON.stringify([{ skillsDir: '.agents/skills', agentIds: ['x', 'y'] }]),
    );
    const message = describeSharedSkillsDir([a('x', '.agents/skills'), a('y', '.agents/skills')]);
    assertTrue(
        'S2 the message names both agents, the directory and the way out',
        typeof message === 'string' && message.includes('x and y') && message.includes('(.agents/skills)') && message.includes('Select only one of them.'),
        String(message),
    );

    const spelled = findSharedSkillsDirs([a('p', '.agents/skills'), a('q', './.agents/skills/'), a('r', '.AGENTS\\Skills')]);
    assertEq('S3 spelling does not matter: slashes, ./, case', JSON.stringify(spelled), JSON.stringify([{ skillsDir: '.agents/skills', agentIds: ['p', 'q', 'r'] }]));
    assertTrue('S3 three agents read "A, B and C"', describeSharedSkillsDir([a('p', 'd'), a('q', 'd'), a('r', 'd')]).startsWith('p, q and r would'));

    assertEq('S4 one agent listed twice is not a conflict', JSON.stringify(findSharedSkillsDirs([a('x', 'd'), a('x', 'd')])), '[]');

    const two = describeSharedSkillsDir([a('a', 'd1'), a('b', 'd1'), a('c', 'd2'), a('d', 'd2')]);
    assertEq('S5 two shared directories: one line each', two.split('\n').length, 2);

    assertEq('S6 a path that merely contains another is not the same directory', JSON.stringify(findSharedSkillsDirs([a('x', '.agents/skills'), a('y', '.agents/skills-extra')])), '[]');

    assertEq(
        'S7 the registry shares exactly the expected directories',
        JSON.stringify(findSharedSkillsDirs(Object.values(AGENT_REGISTRY))),
        JSON.stringify(EXPECTED_SHARED_GROUPS),
    );

    assertEq('S8 an empty selection is refused', validateAgentSelection([]), 'Select at least one agent.');
    assertEq('S8 two agents with their own directories pass', validateAgentSelection(['claude', 'codex']), true);

    // S9: the checkbox verdict is wired to the rule. A probe entry shares Codex's directory for the
    // length of the check; without the wiring this returns `true`.
    AGENT_REGISTRY.__probe = { ...AGENT_REGISTRY.codex, id: '__probe', displayName: 'Probe Agent' };
    try {
        const verdict = validateAgentSelection(['codex', '__probe']);
        assertTrue(
            'S9 the agent checkbox refuses two agents that share a directory',
            typeof verdict === 'string' && verdict.includes('Codex CLI and Probe Agent') && verdict.includes('.codex/skills'),
            String(verdict),
        );
    } finally {
        delete AGENT_REGISTRY.__probe;
    }
    assertEq('S9 the probe entry is gone', Object.keys(AGENT_REGISTRY).includes('__probe'), false);
});

// ─── U: the universal agent ───────────────────────────────────────────────────────────────────
// For runtimes UniKit does not name. It rides on the defaults; only the welcome text is its own.

await group('U', async () => {
    const t = getTransformer('universal');
    assertEq('U1 the universal agent has its own transformer', t.constructor.name, 'UniversalTransformer');
    assertEq(
        'U2 skills are written exactly as for a default agent',
        JSON.stringify(t.transform('unikit-plan', 'body')),
        JSON.stringify(getTransformer('claude').transform('unikit-plan', 'body')),
    );
    for (const hook of ['transformReference', 'transformSubagent', 'postInstall', 'cleanup', 'getInvocationHint']) {
        assertEq(`U3 no ${hook}: nothing is adapted and no extra file is written`, typeof t[hook], 'undefined');
    }
    const lines = getAgentOnboarding('universal').welcomeMessage;
    assertTrue('U4 the welcome message has at least 3 lines', Array.isArray(lines) && lines.length >= 3);
    assertTrue('U4 it names the skills directory', lines.some((line) => line.includes('.agents/skills')));
    assertTrue('U4 it names the MCP file and the by-hand fallback (DEC-011)', lines.some((line) => line.includes('.mcp.json') && /by hand/i.test(line)));

    const universal = AGENT_REGISTRY.universal;
    const pick = (source, keys) => Object.fromEntries(keys.map((key) => [key, source[key]]));
    assertEq(
        'U5 the registry entry matches the research (REQ-001)',
        JSON.stringify(pick(universal, ['id', 'displayName', 'configDir', 'skillsDir', 'subagentsDir', 'settingsFile', 'supportsMcp', 'supportsSubagents', 'skillsCliAgent', 'isStable'])),
        JSON.stringify({ id: 'universal', displayName: 'Universal / Other', configDir: '.agents', skillsDir: '.agents/skills', subagentsDir: '.agents/agents', settingsFile: '.mcp.json', supportsMcp: true, supportsSubagents: false, skillsCliAgent: 'universal', isStable: false }),
    );
    assertTrue('U6 MCP goes through the very writer Claude Code uses (same file, same format)', getMcpWriter('universal') === getMcpWriter('claude'));
    assertEq(
        'U7 the wizard row',
        JSON.stringify(getAgentChoices().find((choice) => choice.value === 'universal')),
        JSON.stringify({ name: 'Universal / Other (.agents/)', value: 'universal', isStable: false }),
    );
    assertTrue(
        'U8 the welcome message names exactly what the registry says',
        lines.some((line) => line.includes(universal.skillsDir)) && lines.some((line) => line.includes(universal.settingsFile)),
    );
    const verdict = validateAgentSelection(['antigravity', 'universal']);
    assertTrue(
        'U9 the wizard refuses Antigravity next to the universal agent, naming both and the directory',
        typeof verdict === 'string' && verdict.includes('Antigravity and Universal / Other') && verdict.includes('.agents/skills'),
        String(verdict),
    );
    for (const other of ['claude', 'codex', 'cursor', 'qwen', 'opencode', 'kimi']) {
        assertEq(`U9 the wizard accepts ${other} next to the universal agent`, validateAgentSelection([other, 'universal']), true);
    }
});

// ─── W: swapping Antigravity for the universal agent in one repeat init ───────────────────────
// Both write `.agents/skills`. Removing Antigravity must keep a foreign skill that lives there, and
// installing the universal agent afterwards must write its own text, not Antigravity's.

await group('W', async () => {
    const dir = await project({ '.agents/skills/community-skill/SKILL.md': 'community\n' });
    const skills = ['unikit', 'unikit-plan'];
    const install = (agentId) => installSkills({ projectDir: dir, skillsDir: '.agents/skills', skills, agentId, engineId: 'unity', engineMcpKey: null });
    try {
        await install('antigravity');
        assertTrue('W1 setup: Antigravity wrote its guardrails file', await exists(path.join(dir, '.agents/rules/unikit.md')));
        await removeAgentSetup(dir, record('antigravity', '.agents/skills', skills));
        assertTrue('W1 the foreign skill survives the removal of Antigravity', await exists(path.join(dir, '.agents/skills/community-skill/SKILL.md')));
        assertEq('W1 the guardrails file is gone', await exists(path.join(dir, '.agents/rules/unikit.md')), false);
        assertEq('W1 the Antigravity skills are gone', await exists(path.join(dir, '.agents/skills/unikit-plan')), false);

        await install('universal');
        const plan = await fs.readFile(path.join(dir, '.agents/skills/unikit-plan/SKILL.md'), 'utf8');
        assertTrue('W2 the universal text names the Claude worker type', plan.includes('Agent(subagent_type: general-purpose, prompt: "Reconnaissance for an ultra plan'));
        assertEq('W2 and not the Antigravity one', plan.includes('subagent_type: self'), false);
        assertEq('W2 the universal agent writes no guardrails file', await exists(path.join(dir, '.agents/rules/unikit.md')), false);
        assertTrue('W2 the foreign skill is still there after the swap', await exists(path.join(dir, '.agents/skills/community-skill/SKILL.md')));
    } finally {
        await fs.rm(dir, { recursive: true, force: true });
    }
});

console.log(`\nagent-dirs: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
