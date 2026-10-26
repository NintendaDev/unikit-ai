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
const { TEMPLATE_VAR_NAMES } = await import(dist('core/constants-template.js'));
const { computeSourceHashWithTemplate, computeSubagentSourceHash, profileHashComponent, transformRevisionComponent } = await import(dist('core/installer/hashing.js'));
const { installSkills } = await import(dist('core/installer/skills.js'));
const { getTransformer, getAgentOnboarding } = await import(dist('core/transformer.js'));
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
    claude: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'sonnet', modelArg: 'model', effortArg: 'effort', skillCall: 'skilltool', spawnArgs: '' },
    codex: { readerType: '', workerType: '', modelDefault: 'inherit', modelArg: 'model', effortArg: 'reasoning_effort', skillCall: 'read', spawnArgs: 'fork_turns: "none", task_name: "<a short name no other subagent of this session has used>",' },
    cursor: { readerType: 'explore', workerType: 'generalPurpose', modelDefault: 'inherit', modelArg: '', effortArg: '', skillCall: 'read', spawnArgs: '' },
    qwen: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'inherit', modelArg: '', effortArg: '', skillCall: 'read', spawnArgs: '' },
    opencode: { readerType: 'explore', workerType: 'general', modelDefault: 'inherit', modelArg: '', effortArg: '', skillCall: 'read', spawnArgs: '' },
    // no effort argument in invoke_subagent (probe 2026-10-16, DEC-108)
    antigravity: { readerType: 'research', workerType: 'self', modelDefault: 'flash', modelArg: 'Model', effortArg: '', skillCall: 'read', spawnArgs: '' },
    kimi: { readerType: 'explore', workerType: 'coder', modelDefault: 'inherit', modelArg: '', effortArg: '', skillCall: 'read', spawnArgs: '' },
    universal: { readerType: 'Explore', workerType: 'general-purpose', modelDefault: 'inherit', modelArg: '', effortArg: '', skillCall: 'read', spawnArgs: '' },
};

// The leading arguments of an Agent(...) call, written out per agent for the same reason: a changed
// type or extra argument must turn this table red. Module level because the installed-text group
// (I) reads it too.
const HEADS = {
    claude: { reader: 'subagent_type: Explore, model: <model>, effort: <effort>,', worker: 'subagent_type: general-purpose, model: <model>, effort: <effort>,', workerQuoted: 'subagent_type: "general-purpose", model: <model>, effort: <effort>,' },
    codex: { reader: 'fork_turns: "none", task_name: "<a short name no other subagent of this session has used>", model: <model>, reasoning_effort: <effort>,', worker: 'fork_turns: "none", task_name: "<a short name no other subagent of this session has used>", model: <model>, reasoning_effort: <effort>,', workerQuoted: 'fork_turns: "none", task_name: "<a short name no other subagent of this session has used>", model: <model>, reasoning_effort: <effort>,' },
    cursor: { reader: 'subagent_type: explore,', worker: 'subagent_type: generalPurpose,', workerQuoted: 'subagent_type: "generalPurpose",' },
    qwen: { reader: 'subagent_type: Explore,', worker: 'subagent_type: general-purpose,', workerQuoted: 'subagent_type: "general-purpose",' },
    opencode: { reader: 'subagent_type: explore,', worker: 'subagent_type: general,', workerQuoted: 'subagent_type: "general",' },
    antigravity: { reader: 'subagent_type: research, Model: <model>,', worker: 'subagent_type: self, Model: <model>,', workerQuoted: 'subagent_type: "self", Model: <model>,' },
    kimi: { reader: 'subagent_type: explore,', worker: 'subagent_type: coder,', workerQuoted: 'subagent_type: "coder",' },
    universal: { reader: 'subagent_type: Explore,', worker: 'subagent_type: general-purpose,', workerQuoted: 'subagent_type: "general-purpose",' },
};

// ── P: the registry profile (Task 18) ───────────────────────────────────────

await group('P', async () => {
    const agents = Object.values(AGENT_REGISTRY);
    assertTrue('P0 the registry is not empty', agents.length > 0);

    for (const agent of agents) {
        const profile = agent.subagentProfile;
        // A type is a word without spaces, or empty when the runtime's agent call takes no type and the
        // profile says what it takes instead (spawnArgs).
        const typeOk = (type) => typeof type === 'string'
            && (/^\S+$/.test(type) || (type === '' && typeof profile.spawnArgs === 'string' && profile.spawnArgs !== ''));
        const typesOk = profile && typeOk(profile.readerType) && typeOk(profile.workerType);
        assertTrue(`P1 ${agent.id}: each type is a word without spaces, or empty with spawnArgs set`, Boolean(typesOk), JSON.stringify(profile));
        if (!profile) continue;

        assertTrue(`P2 ${agent.id}: the reader is not the worker (unless the runtime takes no type)`, profile.readerType !== profile.workerType || profile.readerType === '', profile.readerType);
        assertTrue(
            `P3 ${agent.id}: modelDefault is never empty - a stable vendor alias or inherit (letters only)`,
            typeof profile.modelDefault === 'string' && /^[a-z]+$/.test(profile.modelDefault),
            JSON.stringify(profile.modelDefault),
        );
        assertTrue(`P7 ${agent.id}: modelArg is the name of the model argument or empty`, typeof profile.modelArg === 'string' && /^[A-Za-z_]*$/.test(profile.modelArg), JSON.stringify(profile.modelArg));
        assertTrue(`P8 ${agent.id}: effortArg is the name of the effort argument or empty`, typeof profile.effortArg === 'string' && /^[A-Za-z_]*$/.test(profile.effortArg), JSON.stringify(profile.effortArg));
        assertTrue(`P9 ${agent.id}: an agent whose call takes no model argument has the built-in model inherit`, profile.modelArg !== '' || profile.modelDefault === 'inherit', JSON.stringify(profile));
    }

    for (const agent of agents) {
        const form = agent.subagentProfile?.skillCall;
        assertTrue(`P6 ${agent.id}: skillCall is a known form, and only claude calls the Skill tool`,
            ['read', 'skilltool'].includes(form) && ((form === 'skilltool') === (agent.id === 'claude')), String(form));
    }

    for (const agent of agents) {
        const { readerType, workerType, spawnArgs } = agent.subagentProfile;
        if (readerType !== '' || workerType !== '') continue;
        assertTrue(`P7 ${agent.id}: an agent with no types carries spawn arguments with fork_turns and a task_name`,
            spawnArgs.includes('fork_turns: "none"') && spawnArgs.includes('task_name:'), spawnArgs);
    }

    for (const [id, expected] of Object.entries(EXPECTED)) {
        assertEq(`P4 ${id}: the profile matches the table`, JSON.stringify(AGENT_REGISTRY[id]?.subagentProfile), JSON.stringify(expected));
    }

    assertEq(
        'P5 the registry holds exactly the eight known agents (a new agent needs a conscious edit here; a config-template key only when its profile names a model argument, and an effort key only when it names an effort argument)',
        Object.keys(AGENT_REGISTRY).sort().join(','),
        Object.keys(EXPECTED).sort().join(','),
    );
});

// ── V: template variables and the hash (Task 19) ────────────────────────────

const PROFILE_VARS = ['agent_id', 'agent_reader_type', 'agent_worker_type', 'agent_model_default'];

// Written out by hand and equal to the registry value to the character: a difference is a red test,
// never a reason to edit the test to match the code.
const USER_QUESTIONS_CONTRACT_PROBE = '{{user_questions_contract}}';
const USER_QUESTIONS_CONTRACT_PATH = '.unikit/system/user-questions.md';

await group('V', async () => {
    const kimiVars = buildTemplateVars(AGENT_REGISTRY.kimi);
    assertEq(
        'V1 buildTemplateVars(kimi) carries the profile',
        JSON.stringify(PROFILE_VARS.map((k) => kimiVars[k])),
        JSON.stringify(['kimi', 'explore', 'coder', 'inherit']),
    );
    assertEq(
        'V1 buildTemplateVars(kimi) carries the call heads and the skill-call form',
        JSON.stringify([kimiVars.agent_call_reader, kimiVars.agent_call_worker, kimiVars.agent_call_worker_quoted, kimiVars.agent_skill_call_form]),
        JSON.stringify(['subagent_type: explore,', 'subagent_type: coder,', 'subagent_type: "coder",', 'read']),
    );

    const probe = '{{agent_id}} {{agent_reader_type}} {{agent_worker_type}} [{{agent_model_default}}]';
    assertEq('V2a claude substitution', processTemplate(probe, buildTemplateVars(AGENT_REGISTRY.claude)), 'claude Explore general-purpose [sonnet]');
    assertEq('V2b kimi substitution', processTemplate(probe, buildTemplateVars(AGENT_REGISTRY.kimi)), 'kimi explore coder [inherit]');

    const neutral = buildSubagentTemplateVars('x');
    assertEq(
        'V3a subagent files and system assets get empty profile slots',
        JSON.stringify(PROFILE_VARS.map((k) => neutral[k])),
        JSON.stringify(['', '', '', '']),
    );
    assertEq(
        'V3a subagent files and system assets get empty call-head slots and no skill-call form',
        JSON.stringify([neutral.agent_call_reader, neutral.agent_call_worker, neutral.agent_call_worker_quoted, neutral.agent_skill_call_form]),
        JSON.stringify(['', '', '', '']),
    );
    assertEq('V3b the neutral substitution leaves the surrounding text alone', processTemplate('a {{agent_id}} b', neutral), 'a  b');
    // The path to the skills is empty in an agent file by design, so a path built from it would lose its
    // prefix without a sound: the sources keep `{{skills_dir}}` out of subagents/ and data/ (AP-12).
    assertEq('V3c an agent file renders {{skills_dir}} empty', neutral.skills_dir, '');

    // V5: a system-file variable depends on neither agent nor engine — the same string for every agent
    // and for a subagent file or system asset (which gets empty agent_* slots, but not an empty path).
    // The walk over every registry name is SV-2 in test-system-vars.mjs; this is the probe the order names.
    for (const agent of Object.values(AGENT_REGISTRY)) {
        assertEq(
            `V5 ${agent.id}: ${USER_QUESTIONS_CONTRACT_PROBE} resolves to the contract path`,
            processTemplate(USER_QUESTIONS_CONTRACT_PROBE, buildTemplateVars(agent)),
            USER_QUESTIONS_CONTRACT_PATH,
        );
    }
    assertEq(
        `V5 subagent files and system assets: ${USER_QUESTIONS_CONTRACT_PROBE} resolves to the contract path`,
        processTemplate(USER_QUESTIONS_CONTRACT_PROBE, neutral),
        USER_QUESTIONS_CONTRACT_PATH,
    );
});

await group('V4', async () => {
    const skillDir = path.join(ROOT, 'skills', 'unikit-help');
    const hash = () => computeSourceHashWithTemplate(skillDir, 'unity', 'unikit-help', 'claude', { mcp: {}, bridges: {} });
    const profile = AGENT_REGISTRY.claude.subagentProfile;
    const before = await hash();
    assertTrue('V4a the skill hash is computed', typeof before === 'string' && before.length > 0);

    for (const field of ['modelDefault', 'readerType', 'workerType', 'skillCall', 'spawnArgs', 'modelArg', 'effortArg']) {
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

    // modelArg and effortArg are in the loop above: their names are drawn into every call head as slots and so reach
    // the installed text. Renaming one has to reinstall the skills of that agent - the hash carries them (args=).
});

// ── H: the profile component of the hash ────────────────────────────────────
// The skill-call form, the extra call arguments and the argument names join the tag only for a value that is not the
// default, so the agents that have neither keep the hash they had. Written out by hand: a changed
// component is a red line here, and the codex row is copied from the real output, not typed.

const COMPONENTS = {
    claude: 'profile:Explore|general-purpose|sonnet|call=skilltool|args=model/effort',
    codex: 'profile:||inherit|spawn=fork_turns: "none", task_name: "<a short name no other subagent of this session has used>",|args=model/reasoning_effort',
    cursor: 'profile:explore|generalPurpose|inherit',
    qwen: 'profile:Explore|general-purpose|inherit',
    opencode: 'profile:explore|general|inherit',
    antigravity: 'profile:research|self|flash|args=Model/',
    kimi: 'profile:explore|coder|inherit',
    universal: 'profile:Explore|general-purpose|inherit',
};

await group('H', async () => {
    for (const [id, expected] of Object.entries(COMPONENTS)) {
        assertEq(`H1 ${id}: the profile hash component`, profileHashComponent(id), expected);
    }
    assertEq('H2 the table covers exactly the registry', Object.keys(COMPONENTS).sort().join(','), Object.keys(AGENT_REGISTRY).sort().join(','));
    assertEq('H3 an unknown agent gives profile:none', profileHashComponent('no-such-agent'), 'profile:none');
});

// ── S: the slots of the call head ───────────────────────────────────────────
// A slot is drawn for each argument the profile names, spelled with the runtime's own name, in the order
// type, spawn arguments, model, effort. An agent whose call takes neither keeps the head it always had.

await group('S', async () => {
    for (const [id, agent] of Object.entries(AGENT_REGISTRY)) {
        const { modelArg, effortArg } = agent.subagentProfile;
        const vars = buildTemplateVars(agent);
        const heads = [vars.agent_call_reader, vars.agent_call_worker, vars.agent_call_worker_quoted];
        assertTrue(`S1 ${id}: the model slot stands in every call head iff the profile names a model argument`, heads.every((h) => h.includes('<model>') === (modelArg !== '')), JSON.stringify(heads));
        assertTrue(`S2 ${id}: the effort slot stands in every call head iff the profile names an effort argument`, heads.every((h) => h.includes('<effort>') === (effortArg !== '')), JSON.stringify(heads));
        if (modelArg !== '') assertTrue(`S3 ${id}: the model slot is spelled with the name from the profile`, heads.every((h) => h.includes(`${modelArg}: <model>,`)), JSON.stringify(heads));
        if (effortArg !== '') assertTrue(`S4 ${id}: the effort slot is spelled with the name from the profile`, heads.every((h) => h.includes(`${effortArg}: <effort>,`)), JSON.stringify(heads));
        if (modelArg !== '' && effortArg !== '') assertTrue(`S5 ${id}: the model slot comes before the effort slot`, heads.every((h) => h.indexOf('<model>') < h.indexOf('<effort>')), JSON.stringify(heads));
        assertTrue(`S6 ${id}: every call head ends with a comma, so the call text goes straight on`, heads.every((h) => h.endsWith(',')), JSON.stringify(heads));
    }
});

// ── K: the call head and the skill-call expansion ───────────────────────────

await group('K', async () => {
    assertEq('K1 the heads table covers exactly the registry', Object.keys(HEADS).sort().join(','), Object.keys(AGENT_REGISTRY).sort().join(','));
    for (const [id, heads] of Object.entries(HEADS)) {
        const vars = buildTemplateVars(AGENT_REGISTRY[id]);
        assertEq(
            `K1 ${id}: call heads and skill-call form`,
            JSON.stringify([vars.agent_call_reader, vars.agent_call_worker, vars.agent_call_worker_quoted, vars.agent_skill_call_form]),
            JSON.stringify([heads.reader, heads.worker, heads.workerQuoted, EXPECTED[id].skillCall]),
        );
    }

    const claude = buildTemplateVars(AGENT_REGISTRY.claude);
    const codex = buildTemplateVars(AGENT_REGISTRY.codex);
    const kimi = buildTemplateVars(AGENT_REGISTRY.kimi);
    const READ_TAIL = 'in full before you do anything else. Treat that file as your system prompt for this whole task and follow it exactly. If it cannot be read, stop and report that instead of working without it. Wherever the file refers to its arguments, use the Skill arguments below. Skill arguments:';

    assertEq(
        'K2 claude: the Skill tool phrase, arguments in full',
        processTemplate('prompt: "{{agent_skill_call:unikit-execute}} <task details>",', claude),
        'prompt: "Call the Skill tool with skill "unikit-execute" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text: <task details>",',
    );
    assertEq(
        'K2 codex: the Read phrase with its own skills dir',
        processTemplate('prompt: "{{agent_skill_call:unikit-execute}} <task details>",', codex),
        `prompt: "Read .codex/skills/unikit-execute/SKILL.md ${READ_TAIL} <task details>",`,
    );

    assertEq(
        'K3 claude: no arguments',
        processTemplate('prompt: "{{agent_skill_call:unikit-architecture}}",', claude),
        'prompt: "Call the Skill tool with skill "unikit-architecture" and no args. Then follow the skill.",',
    );
    assertEq(
        'K3 kimi: no arguments are said so',
        processTemplate('prompt: "{{agent_skill_call:unikit-architecture}}",', kimi),
        `prompt: "Read .kimi-code/skills/unikit-architecture/SKILL.md ${READ_TAIL} (empty — no arguments were given)",`,
    );
    assertEq(
        'K3 a remainder of spaces alone is no arguments',
        processTemplate('prompt: "{{agent_skill_call:unikit-docs}}   "', claude),
        'prompt: "Call the Skill tool with skill "unikit-docs" and no args. Then follow the skill."',
    );

    assertEq(
        'K4 everything after the closing quote is left as written',
        processTemplate('prompt: "{{agent_skill_call:unikit-docs}} <context>", description: "Update documentation"', claude),
        'prompt: "Call the Skill tool with skill "unikit-docs" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text: <context>", description: "Update documentation"',
    );

    const awkward = '--module code --skip-registry Add stack rules for {technology name} | <x> + $& $1';
    assertEq(
        'K5 braces, angle brackets, pipes, plus and replacement patterns pass through unchanged',
        processTemplate(`prompt: "{{agent_skill_call:unikit-memory}} ${awkward}"`, claude),
        `prompt: "Call the Skill tool with skill "unikit-memory" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text: ${awkward}"`,
    );
    const twice = processTemplate('a "{{agent_skill_call:unikit-docs}} one" b "{{agent_skill_call:unikit-memory}} two"', kimi);
    assertTrue('K5 two tokens in one text are both expanded', !twice.includes('{{agent_skill_call') && twice.includes('unikit-docs/SKILL.md') && twice.includes('unikit-memory/SKILL.md'), twice);

    const neutral = buildSubagentTemplateVars('x');
    assertEq('K6 an agent file or system asset leaves the token as written', processTemplate('{{agent_skill_call:unikit-docs}} text', neutral), '{{agent_skill_call:unikit-docs}} text');
    assertEq('K6 an invalid skill name is left as written', processTemplate('"{{agent_skill_call:Bad}} x"', claude), '"{{agent_skill_call:Bad}} x"');
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
    const skillHash = (agent) => computeSourceHashWithTemplate(skillDir, 'unity', 'unikit-help', agent, { mcp: {}, bridges: {} });
    const subagentHash = (agent) => computeSubagentSourceHash(subagent, 'unity', agent, { mcp: {}, bridges: {} });

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

// ── Q: the Qwen transformer writes nothing (REQ-009, DEC-012) ───────────────
await group('Q', async () => {
    const t = getTransformer('qwen');
    assertEq('Q1 qwen has its own transformer (the onboarding text)', t.constructor.name, 'QwenTransformer');
    for (const hook of ['transformReference', 'transformSubagent', 'postInstall', 'cleanup']) {
        assertEq(`Q2 no ${hook}: nothing is rewritten and nothing extra is written`, typeof t[hook], 'undefined');
    }
    assertEq(
        'Q3 skills are written exactly as for a default agent',
        JSON.stringify(t.transform('unikit-plan', 'run /unikit-implement')),
        JSON.stringify(getTransformer('claude').transform('unikit-plan', 'run /unikit-implement')),
    );
    assertTrue('Q4 no TRANSFORM_REVISIONS entry', !('qwen' in TRANSFORM_REVISIONS));
    const onboarding = getAgentOnboarding('qwen');
    assertTrue(
        'Q5 the welcome text names /<name> and /unikit and never the retired form',
        onboarding.welcomeMessage.some((l) => l.includes('/<name>')) && onboarding.welcomeMessage.some((l) => l.includes('/unikit ')) && !onboarding.welcomeMessage.some((l) => l.includes('/skills')),
    );
    assertEq('Q6 the invocation hint', onboarding.invocationHint, 'Qwen Code: /unikit-plan, /unikit-commit');
});

// ── C: the config template against the registry (Task 26) ───────────────────
// The template holds the user-facing `subagents.model` block and the `effort` block next to it: one map of roles per agent.
// The registry holds the profile. The Claude and Antigravity defaults are written in both places (the installer never reads
// the config), so only this comparison keeps them from drifting apart. There is no YAML parser in the project: the blocks
// have a fixed shape — `  model:` / `  effort:` at 2 spaces, the agent at 4, the role at 6 — and are read line by line.

const ROLES = ['reader', 'validator', 'executor'];

await group('C', async () => {
    const template = await fs.readFile(path.join(ROOT, 'skills', 'unikit', 'references', 'config-template.yaml'), 'utf8');
    const lines = template.split(/\r?\n/);
    const start = lines.findIndex((l) => /^subagents:\s*$/.test(l));
    assertTrue('C1 the template has a top-level subagents: block', start >= 0);

    // One block: `{ at, agents: { <agent>: { <role>: <value> } } }`. Comments and blank lines are skipped; the first
    // line that is neither an agent key nor a role key ends the block.
    const readBlock = (header, from) => {
        const at = lines.findIndex((l, i) => i > from && header.test(l));
        const agents = {};
        if (at < 0) return { at, agents };
        let agent = null;
        for (let i = at + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*#/.test(line) || line.trim() === '') continue;
            const a = /^ {4}([a-z]+):\s*(?:#.*)?$/.exec(line);
            if (a) { agent = a[1]; agents[agent] = {}; continue; }
            const r = /^ {6}([a-z]+):\s*([A-Za-z0-9_.-]*)\s*(?:#.*)?$/.exec(line);
            if (r && agent) { agents[agent][r[1]] = r[2]; continue; }
            break;
        }
        return { at, agents };
    };

    const model = readBlock(/^ {2}model:\s*$/, start);
    assertTrue('C2 subagents: holds a model: mapping', model.at > start);
    const keyed = Object.entries(AGENT_REGISTRY).filter(([, agent]) => agent.subagentProfile.modelArg !== '');
    assertEq('C3 the template carries a model block for exactly the agents whose call takes a model', Object.keys(model.agents).sort().join(','), keyed.map(([id]) => id).sort().join(','));
    for (const [id, agent] of keyed) {
        assertEq(`C3 ${id}: the model block holds the three roles, in order`, Object.keys(model.agents[id] ?? {}).join(','), ROLES.join(','));
        assertEq(`C4 ${id}: reader and validator default to the profile's modelDefault`, [model.agents[id]?.reader, model.agents[id]?.validator].join(','), `${agent.subagentProfile.modelDefault},${agent.subagentProfile.modelDefault}`);
        assertEq(`C4 ${id}: the executor model is inherit`, model.agents[id]?.executor, 'inherit');
    }
    assertTrue('C5 the block carries no {{placeholder}}', !lines.slice(start).some((l) => l.includes('{{')));

    // The effort block follows the model block, read the same way.
    const effort = readBlock(/^ {2}effort:\s*$/, model.at);
    assertTrue('C6 subagents: holds an effort: mapping after the model: block', effort.at > model.at);
    const effortKeyed = Object.entries(AGENT_REGISTRY).filter(([, agent]) => agent.subagentProfile.effortArg !== '');
    assertEq('C7 the template carries an effort block for exactly the agents whose call takes an effort argument', Object.keys(effort.agents).sort().join(','), effortKeyed.map(([id]) => id).sort().join(','));
    for (const [id] of effortKeyed) {
        assertEq(`C7 ${id}: the effort block holds the three roles, in order`, Object.keys(effort.agents[id] ?? {}).join(','), ROLES.join(','));
        assertEq(`C8 ${id}: reader and validator default to medium`, [effort.agents[id]?.reader, effort.agents[id]?.validator].join(','), 'medium,medium');
        assertEq(`C8 ${id}: the executor effort is inherit`, effort.agents[id]?.executor, 'inherit');
    }
});

// ── I: the installed text, per agent (Task 25) ──────────────────────────────
// The table is built from AGENT_REGISTRY and goes through the real installSkills over the real
// skills/, so a new agent joins it by itself and the test cannot repeat the installer's logic.

const INSTALL_SKILLS = ['unikit', 'unikit-explore', 'unikit-plan', 'unikit-gd-review', 'unikit-gd-brainstorm', 'unikit-implement', 'unikit-gd-explore', 'unikit-review', 'unikit-fix', 'unikit-verify', 'unikit-docs', 'unikit-improve', 'unikit-gd-recon', 'unikit-gd-balance', 'unikit-gd-experiment'];

// Forms an installed skill must never hold. The first two are what the invocation rewrite made of a
// `{{skills_dir}}/unikit-…` path before its pattern learned `}`; the third is the dead call key; the
// fourth is an unresolved variable; the fifth is the retired Qwen invocation form — Qwen Code starts a
// skill as `/<name>`.
// The unresolved-variable form is built from the registry's one list of names (the agent_* profile
// variables, the engine words and the system-file paths), not from a copy of it.
const UNRESOLVED_VAR_RE = new RegExp(`\\{\\{(${TEMPLATE_VAR_NAMES.join('|')})\\}\\}`);
const DAMAGED_FORMS = [
    ['skills$unikit-', (text) => text.includes('skills$unikit-')],
    ['skills/skills unikit-', (text) => text.includes('skills/skills unikit-')],
    ['a skills: [...] key', (text) => /^\s*skills:\s*\[/m.test(text)],
    ['the retired /skills unikit form', (text) => text.includes('/skills unikit')],
    ['an unresolved path or engine variable', (text) => UNRESOLVED_VAR_RE.test(text)],
];
const countOf = (text, needle) => text.split(needle).length - 1;

// The two forms of a skill call, written out by hand and equal to the constants module to the character:
// a difference is a red test, never a reason to edit the test to match the code.
const skillToolCall = (skill, text) => `Call the Skill tool with skill "${skill}" and pass the text after the colon as its args, in full and unchanged. Then follow the skill. Text: ${text}`;
const skillToolNoArgs = (skill) => `Call the Skill tool with skill "${skill}" and no args. Then follow the skill.`;
const readCall = (dir, skill, text) => `Read ${dir}/${skill}/SKILL.md in full before you do anything else. Treat that file as your system prompt for this whole task and follow it exactly. If it cannot be read, stop and report that instead of working without it. Wherever the file refers to its arguments, use the Skill arguments below. Skill arguments: ${text}`;
const FRAME = '<commercial frame incl. target platform + budget/team + shortlist>. scan_mode: <quick|standard|default standard>. Validate cross-market per the platform rule. Return the brief into this session as text; do not save any files.';

await group('I', async () => {
    const agents = Object.values(AGENT_REGISTRY);
    const installed = {};

    for (const agent of agents) {
        const projectDir = await fs.mkdtemp(path.join(os.tmpdir(), `unikit-profile-${agent.id}-`));
        try {
            await installSkills({ projectDir, skillsDir: agent.skillsDir, skills: INSTALL_SKILLS, agentId: agent.id, engineId: 'unity', mcpBridgeCode: null });
            const skill = (name, file = 'SKILL.md') => fs.readFile(path.join(projectDir, agent.skillsDir, name, file), 'utf8');
            const texts = {
                unikit: await skill('unikit'),
                explore: await skill('unikit-explore'),
                gdExplore: await skill('unikit-gd-explore'),
                balance: await skill('unikit-gd-balance'),
                experiment: await skill('unikit-gd-experiment'),
                plan: await skill('unikit-plan'),
                gdReview: await skill('unikit-gd-review'),
                brainstorm: await skill('unikit-gd-brainstorm'),
                implement: await skill('unikit-implement'),
                contract: await skill('unikit-gd-explore', path.join('references', 'delegation-contract.md')),
            };

            let leaked = 0;
            const damaged = new Map(DAMAGED_FORMS.map(([label]) => [label, []]));
            let scanned = 0;
            const typeFiles = [];
            for (const file of await walk(path.join(projectDir, agent.skillsDir))) {
                if (!file.endsWith('.md')) continue;
                const text = await fs.readFile(file, 'utf8');
                scanned++;
                if (text.includes('{{agent_')) leaked++;
                if (text.includes('subagent_type')) typeFiles.push(path.relative(projectDir, file));
                for (const [label, test] of DAMAGED_FORMS) {
                    if (test(text)) damaged.get(label).push(path.relative(projectDir, file));
                }
            }
            installed[agent.id] = texts;

            const { modelDefault } = agent.subagentProfile;
            const h = HEADS[agent.id];
            const RO = 'You are read-only: edit and write nothing.';
            assertTrue(`I1 ${agent.id}: recon-agent carries its reader call head and the read-only sentence`, texts.explore.includes(`Agent(${h.reader} prompt: "<focused question> ${RO}")`));
            assertTrue(`I1 ${agent.id}: check-agent carries its reader call head`, texts.explore.includes(`Agent(${h.reader} prompt: "Read ${agent.skillsDir}/unikit-explore/references/coherence-gate.md and run`));
            assertTrue(`I1 ${agent.id}: the balance skill's recon-agent carries its reader call head and the read-only sentence`, texts.balance.includes(`Agent(${h.reader} prompt: "<focused question> ${RO}")`));
            assertTrue(`I1 ${agent.id}: the experiment skill's recon-agent carries its reader call head and the read-only sentence`, texts.experiment.includes(`Agent(${h.reader} prompt: "<focused question> ${RO}")`));
            assertTrue(`I1 ${agent.id}: gd-explore check-agent carries its reader call head`, texts.gdExplore.includes(`Agent(${h.reader} prompt: "Read ${agent.skillsDir}/unikit-gd-explore/references/coherence-gate.md and run`));
            assertTrue(`I2 ${agent.id}: the recon writer carries its worker call head`, texts.plan.includes(`Agent(${h.worker} prompt: "Reconnaissance for an ultra plan`));
            assertTrue(`I3 ${agent.id}: lens-agent carries its worker call head`, texts.gdReview.includes(`Agent(${h.worker} prompt: "<one lens brief>")`));
            assertEq(`I3 ${agent.id}: develop-agent and docs-agent carry the quoted worker head`, countOf(texts.implement, h.workerQuoted), 2);
            assertTrue(`I3 ${agent.id}: a reference file carries the worker head too`, texts.contract.includes(h.workerQuoted));
            assertEq(`I10 ${agent.id}: fork_turns appears iff the profile has spawn arguments`, texts.implement.includes('fork_turns: "none"'), agent.subagentProfile.spawnArgs !== '');
            assertEq(`I10 ${agent.id}: subagent_type is written iff the profile has a type`, texts.implement.includes('subagent_type'), agent.subagentProfile.workerType !== '');
            if (agent.subagentProfile.workerType === '' && agent.subagentProfile.readerType === '') {
                assertTrue(`I10 ${agent.id}: no installed .md names a subagent type`, typeFiles.length === 0, `found in: ${typeFiles.slice(0, 3).join(', ')}`);
            }

            // I8: the call is the profile's form — a Skill-tool call, or a read of the skill file by this
            // agent's own installed path. The dead `skills:` key is gone, and a path variable that survived
            // to the install would show as the wrong prefix.
            const viaTool = agent.subagentProfile.skillCall === 'skilltool';
            const call = (skill, text) => (viaTool ? skillToolCall(skill, text) : readCall(agent.skillsDir, skill, text));
            assertTrue(`I8 ${agent.id}: develop-agent calls the execute skill`, texts.implement.includes(call('unikit-execute', '<task details>')));
            assertTrue(`I8 ${agent.id}: docs-agent calls the docs skill`, texts.implement.includes(call('unikit-docs', '<context>')));
            assertTrue(`I8 ${agent.id}: the brainstorm delegation calls the explore skill`, texts.brainstorm.includes(call('unikit-gd-explore', FRAME)));
            assertTrue(`I8 ${agent.id}: its mirror in the delegation contract calls it the same way`, texts.contract.includes(call('unikit-gd-explore', FRAME)));
            assertTrue(`I8 ${agent.id}: step 9.8 calls the memory skill with both flags`, texts.unikit.includes(call('unikit-memory', '--module code --skip-registry Add stack rules for {technology name}')));
            assertTrue(
                `I8 ${agent.id}: step 10 calls the architecture skill with no arguments`,
                texts.unikit.includes(viaTool ? skillToolNoArgs('unikit-architecture') : readCall(agent.skillsDir, 'unikit-architecture', '(empty — no arguments were given)')),
            );
            assertTrue(
                `I8 ${agent.id}: the other form is absent from the call sites`,
                viaTool
                    ? !texts.implement.includes(`Read ${agent.skillsDir}/unikit-execute/SKILL.md in full before you do anything else`)
                    : !texts.implement.includes('Call the Skill tool with skill'),
            );

            // I9: nothing damaged anywhere in the installed set (the scan is non-empty by construction)
            assertTrue(`I9 ${agent.id}: the installed set was scanned`, scanned > 0);
            for (const [label, files] of damaged) {
                assertTrue(`I9 ${agent.id}: no installed .md holds ${label}`, files.length === 0, `found in: ${files.slice(0, 3).join(', ')}`);
            }
            assertTrue(`I4 ${agent.id}: the arguments rule names its own model key by role`, texts.explore.includes(`subagents.model.${agent.id}.<role>`));
            assertTrue(`I4 ${agent.id}: the arguments rule names its own effort key by role`, texts.explore.includes(`subagents.effort.${agent.id}.<role>`));
            assertTrue(`I4 ${agent.id}: the arguments rule carries the built-in model "${modelDefault}" of a reader and a validator`, texts.explore.includes('built-in model of a reader and a validator: `"' + modelDefault + '"`, of an executor: none'));
            assertTrue(
                `I11 ${agent.id}: the skills without a delegation alias carry the same pointer (unikit, implement, brainstorm)`,
                [texts.unikit, texts.implement, texts.brainstorm].every((t) => t.includes('**Subagent arguments.**') && t.includes(`subagents.model.${agent.id}.<role>`)),
            );
            assertEq(`I6 ${agent.id}: no unresolved {{agent_…}} in any installed .md`, leaked, 0);
            assertEq(`I7 ${agent.id}: no installed skill carries the retired Subagent Delegation block`, texts.explore.includes('Subagent Delegation — BLOCKING PRE-REQUISITE'), false);
            assertEq(`I7 ${agent.id}: the gd-review handoff auto-invoke block is present for codex alone`, texts.gdReview.includes('Auto-invoke the handoff — BLOCKING PRE-REQUISITE'), agent.id === 'codex');
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
            if (theirs.readerType !== '' && theirs.readerType !== mine.readerType) {
                assertTrue(`I5 ${agent.id} has no trace of ${other.id}'s reader type "${theirs.readerType}"`, !installed[agent.id].explore.includes(`Agent(subagent_type: ${theirs.readerType},`));
            }
            if (theirs.workerType !== '' && theirs.workerType !== mine.workerType) {
                assertTrue(`I5 ${agent.id} has no trace of ${other.id}'s worker type "${theirs.workerType}"`, !installed[agent.id].implement.includes(`subagent_type: "${theirs.workerType}",`));
            }
        }
    }
});

console.log(`\nagent-profile: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
