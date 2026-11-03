// Guards for the system-file variable registry (src/core/constants-template.ts): SV-1 … SV-8, plus
// the self-checks of the detectors they use. SV-3 (registry ⇔ delivered tree) needs an installed
// project and runs as `--tree <projectDir> --engine-tree yes|no` from scripts/test-install.sh.
// Consumed from scripts/test-skills.sh (Part 7f8). Imports the compiled build because tests run
// after `ensure_build` in the parent harness. Writes nothing into the repository.
//
// Every guard counts what it looked at; a guard that looked at nothing fails ("scanned nothing"),
// because a scan that finds nothing is indistinguishable from a scan that is broken.
//
// Debugging: `SV_VERBOSE=1 node scripts/test-system-vars.mjs` makes SV-5 list every distinct
// `.unikit/system…` literal it met in skills/, subagents/ and data/, with its number of occurrences.

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { fileURLToPath, pathToFileURL } from 'url';

// ── Constants ────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const dist = (rel) => pathToFileURL(path.join(ROOT, 'dist', rel)).href;

// The registry comes first: the shape of a name below is the registry's own, not a second copy of it.
const registry = await import(dist('core/constants-template.js'));
const {
    SYSTEM_FILE_VARS, SYSTEM_PATH_VARS, SYSTEM_VAR_NAMES, TEMPLATE_VAR_NAMES, FIXED_TEMPLATE_VAR_NAMES,
    TEMPLATE_VAR_NAME_SHAPE, EXTENSION_UNKNOWN_VARS_MAX_FILES,
} = registry;

const SELF_FILE = path.basename(__filename);
const TREE_FLAG = '--tree';
const ENGINE_TREE_FLAG = '--engine-tree';

const POSIX = '/';
const FRAMEWORK_DIR = '.unikit';
const CONSTANTS_FILE = 'src/core/constants.ts';
const REGISTRY_FILE = 'src/core/constants-template.ts';
const REGISTRY_IMPORT_ALLOWED = ['./constants.js', './constants-bridges.js'];
// SV-9b: where the warning for an unknown name is called from, and the module it lives in.
const INJECTIONS_FILE = 'src/core/extension-injections.ts';
const UNKNOWN_VARS_FILE = 'src/core/extension-unknown-vars.ts';
const UNKNOWN_VARS_CALLS = ['findUnknownVarsInExtension', 'formatUnknownVars'];
// The scan is advice: the pass catches its failure (one warning, constant below) and the module keeps
// every manifest path inside the extension directory.
const UNKNOWN_VARS_FAILURE_CONSTANT = 'EXTENSION_UNKNOWN_VARS_SCAN_FAILED';
// The constant must stand in the body of a `catch` (not only in the import line, which would keep a
// removed `catch` green): a bounded window after `catch (…) {`.
const UNKNOWN_VARS_CATCH_RE = new RegExp(`catch\\s*\\([^)]*\\)\\s*\\{[\\s\\S]{0,300}?\\b${UNKNOWN_VARS_FAILURE_CONSTANT}\\b`);
const UNKNOWN_VARS_CONFINEMENT_CALL = 'isInsideDirectory(';
const UNKNOWN_VARS_SANDBOX_PREFIX = 'sv9-';
const UNKNOWN_VARS_REASON_PART = 'not template variables of this build';
const CLI_IMPORT_RE = /(^|\/)cli(\/|$)/;
const REGISTRY_MODULE_NAME = 'constants-template';
// An import, re-export or dynamic import of the registry module. A comment may name the file; a statement may not.
const REGISTRY_IMPORT_STATEMENT_RE = new RegExp(`(?:\\bfrom\\s+|\\bimport\\s*\\(\\s*)['"][^'"]*${REGISTRY_MODULE_NAME}[^'"]*['"]`);

const DATA_DIR = 'data';
const DATA_GAMEDESIGN_DIR = 'data/gamedesign';
const DATA_NOT_A_SYSTEM_FILE = ['RULES_INDEX_TEMPLATE.md'];
const LANGUAGE_RULES_TEMPLATE = 'skills/unikit/references/LANGUAGE_RULES_TEMPLATE.md';
const SCRIPTS_DIR = 'scripts';
const SCRIPTS_SKIPPED_DIR = 'test-fixtures';
const DOCS_FILE = 'docs/extensions.md';
const DOCS_SECTION_HEADING = '### Template Variables';

// Sources of text that ships with the framework (SV-5, SV-8).
const SHIPPED_TEXT_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.txt', '.mjs', '.js', '.sh', '.html', '.py']);
const LITERAL_ROOTS = ['skills', 'subagents', 'data'];
const BASE_TEXT_ROOTS = ['skills'];
const BASE_TEXT_FLAT_DIRS = ['subagents', 'data', 'data/gamedesign'];
// `dev-principles.md` is the one system file that goes through the substitution (SV-8 lets it carry names).
const SV8_ALLOWED = ['data/dev-principles.md'];

// Where an extension name must not appear (SV-7b): the texts the framework ships and documents.
const EXTENSION_NAME_PROBE = 'unikit-game-studio-tools';
const EXTENSION_NAME_ROOTS = ['docs', 'skills', 'subagents', 'data', 'src'];
const EXTENSION_NAME_FILES = ['README.md'];

// Shapes. A name is lower-case words joined by underscores; the docs table cell is `{{name}}`.
const NAME_SHAPE = new RegExp(`^${TEMPLATE_VAR_NAME_SHAPE}$`);
const NAME_CHAR = '[A-Za-z0-9_]';
const SYSTEM_LITERAL_RE = /\.unikit\/system(?:\/[^\s`'"()\[\]{}|,;]*)?/g;
const LITERAL_TRAILING_PUNCTUATION = /[.:]+$/;
const LITERAL_TRAILING_SLASH = /\/+$/;
// A literal with one of these characters is prose or a pattern (`.unikit/system/**`, `genres/<id>.json`),
// not a path: it is skipped, never compared.
const LITERAL_PATTERN_CHARS = /[<>*]/;
const VALUE_BAD_SEGMENT = /(^|\/)\.{1,2}(\/|$)/;
const DOCS_TABLE_NAME_RE = new RegExp(`^\\|\\s*\`\\{\\{(${TEMPLATE_VAR_NAME_SHAPE})\\}\\}\`\\s*\\|`);
const DOCS_ANY_NAME_RE = new RegExp(`\`\\{\\{(${TEMPLATE_VAR_NAME_SHAPE})\\}\\}\``, 'g');
const TEMPLATE_TOKEN_RE = new RegExp(`\\{\\{(${TEMPLATE_VAR_NAME_SHAPE})\\}\\}`, 'g');
const ALTERNATION_MIN_NAMES = 3;
const VERBOSE_ENV = 'SV_VERBOSE';

// The public names, pinned (SV-1b): adding, removing or renaming one takes two edits — here and in
// the registry. A name is public API of extensions, like an extension-point anchor.
const PINNED_NAMES = [
    'system_dir', 'system_gamedesign_dir', 'system_genres_dir', 'system_engine_bridges_dir',
    'cli_contract', 'dev_principles', 'modules_yml', 'gate_result_contract', 'ultra_plan_read_contract',
    'research_link_contract', 'plan_boundaries_contract', 'merge_analysis_contract', 'balance_handback_contract',
    'prototype_profile_contract', 'subagent_arguments_contract', 'subagent_roles_contract', 'user_questions_contract',
    'gd_principles', 'gd_authoring', 'gd_lifecycle', 'gd_flow_axis', 'gd_content_axis', 'gd_provenance', 'gd_critique',
    'design_read_contract', 'engine_bridges_manifest', 'language_rules',
];
const USER_QUESTIONS_NAME = 'user_questions_contract';
const USER_QUESTIONS_VALUE = '.unikit/system/user-questions.md';
const UNKNOWN_NAME_PROBE = '{{no_such_name}}';
const SKILL_CALL_PROBE = '{{agent_skill_call:x}}';
const SUBAGENT_PROBE_SELF_NAME = 'x';
const PROBE_ENGINE = 'unity';

const ROW_KINDS = ['file', 'dir'];
const ROW_DELIVERIES = ['cli', 'cli-generated', 'cli-conditional', 'skill'];
const DIR_KIND = 'dir';
const FILE_KIND = 'file';
const DELIVERY_ALWAYS = ['cli', 'cli-generated'];
const DELIVERY_CLI = 'cli';
const DELIVERY_CONDITIONAL = 'cli-conditional';
const DELIVERY_SKILL = 'skill';
const SYSTEM_DIR_NAME_VAR = 'system_dir';
const GAMEDESIGN_DIR_NAME_VAR = 'system_gamedesign_dir';
const ENGINE_BRIDGES_DIR_VAR = 'system_engine_bridges_dir';
const GENRES_DIR_VAR = 'system_genres_dir';
// SV-3 (--tree): the rules tree of the selected engine MCP server, and the exit code of a bad call.
const ENGINE_TREE_YES = 'yes';
const ENGINE_TREE_NO = 'no';
const ENGINE_TREE_VALUES = [ENGINE_TREE_YES, ENGINE_TREE_NO];
const TREE_USAGE = `usage: node scripts/${SELF_FILE} ${TREE_FLAG} <projectDir> ${ENGINE_TREE_FLAG} ${ENGINE_TREE_YES}|${ENGINE_TREE_NO}`;
const USAGE_EXIT_CODE = 2;

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function fail(guard, detail) {
    failed++;
    console.error(`FAIL [${guard}] ${detail}`);
}

function pass(guard, what, count) {
    passed++;
    console.log(`PASS [${guard}] ${what}${count === undefined ? '' : ` (${count})`}`);
}

// Reports one guard: nothing scanned is a failure, every violation is a failure, otherwise a pass.
function report(guard, what, scanned, violations) {
    if (scanned === 0) {
        fail(guard, `${what}: scanned nothing`);
        return;
    }
    for (const violation of violations) fail(guard, violation);
    if (violations.length === 0) pass(guard, what, scanned);
}

function assertEq(guard, what, actual, expected) {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a === e) pass(guard, what);
    else fail(guard, `${what}\n  expected: ${e}\n  actual:   ${a}`);
}

// An exception inside a group must not take the whole run down silently.
async function group(name, fn) {
    try {
        await fn();
    } catch (error) {
        fail(name, `threw: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    }
}

async function walk(dir, skipDir = null) {
    const out = [];
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === skipDir) continue;
            out.push(...await walk(full, skipDir));
        } else {
            out.push(full);
        }
    }
    return out;
}

const rel = (file) => path.relative(ROOT, file).split(path.sep).join(POSIX);
const read = (file) => fs.readFile(file, 'utf8');
const readOrNull = async (file) => {
    try {
        return await read(file);
    } catch {
        return null;
    }
};
const exists = async (file) => {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
};
const textFilesUnder = async (dir) => (await walk(path.join(ROOT, dir))).filter((file) => SHIPPED_TEXT_EXTENSIONS.has(path.extname(file)));
const mdFilesIn = async (dir) => (await fs.readdir(path.join(ROOT, dir), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => entry.name);

// ── Detectors (pure; exercised on samples below) ─────────────────────────────

// Every `.unikit/system…` literal in a text, as written.
function findLiterals(text) {
    return [...text.matchAll(SYSTEM_LITERAL_RE)].map((match) => match[0]);
}

// Why a literal is not allowed, or null. `rows` is the registry table.
// Allowed: equal to the value of a row (file or directory), or inside a directory whose content is
// free (a `cli-conditional` directory: `engine-bridges/`, `gamedesign/genres/`). Under an unconditional
// directory (`system/`, `system/gamedesign/`) only an exact row is allowed — every path lies under
// `.unikit/system`, so a subtree rule there would make the guard always green.
function classifyLiteral(literal, rows) {
    const form = literal.replace(LITERAL_TRAILING_PUNCTUATION, '').replace(LITERAL_TRAILING_SLASH, '');
    if (LITERAL_PATTERN_CHARS.test(form)) return null;
    const values = new Set(rows.map((row) => row.value));
    if (values.has(form)) return null;
    const freeTrees = rows.filter((row) => row.kind === DIR_KIND && row.delivery === DELIVERY_CONDITIONAL);
    if (freeTrees.some((row) => form.startsWith(`${row.value}${POSIX}`))) return null;
    return `"${form}" is not the value of a registry row`;
}

// Lines that join ALTERNATION_MIN_NAMES or more different variable names with `|` or `\|` — a hand-written
// copy of the list of names. Braces and backslashes around a name (`{{name}}\|`) are part of the chain.
function findAlternations(text, names) {
    const alt = [...names].sort((a, b) => b.length - a.length).join('|');
    const token = `(?:${alt})(?!${NAME_CHAR})`;
    const chain = new RegExp(`(?<!${NAME_CHAR})${token}(?:[{}\\\\]*\\|[{}\\\\]*${token}){${ALTERNATION_MIN_NAMES - 1},}`, 'g');
    const found = [];
    for (const [index, line] of text.split('\n').entries()) {
        for (const match of line.matchAll(chain)) {
            const parts = new Set(match[0].split(/[{}\\|]+/).filter(Boolean));
            if (parts.size >= ALTERNATION_MIN_NAMES) found.push({ line: index + 1, names: [...parts] });
        }
    }
    return found;
}

// The `### Template Variables` section of the extensions doc: from its heading to the next heading.
function docsSection(markdown) {
    const lines = markdown.split('\n');
    const start = lines.findIndex((line) => line.trim() === DOCS_SECTION_HEADING);
    if (start < 0) return null;
    const rest = lines.slice(start + 1);
    const end = rest.findIndex((line) => /^#{1,3}\s/.test(line));
    return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

// Names in the first cell of the section's table rows, and every `{{name}}` written in backticks.
function docsVarNames(section) {
    const table = new Set();
    for (const line of section.split('\n')) {
        const match = DOCS_TABLE_NAME_RE.exec(line);
        if (match) table.add(match[1]);
    }
    const mentioned = new Set([...section.matchAll(DOCS_ANY_NAME_RE)].map((match) => match[1]));
    return { table, mentioned };
}

// ── Registry ─────────────────────────────────────────────────────────────────

const rows =SYSTEM_FILE_VARS.map((row) => ({ ...row, value: SYSTEM_PATH_VARS[row.name] }));
const rowByName = new Map(rows.map((row) => [row.name, row]));
const dirValue = (name) => rowByName.get(name)?.value;
const parentOf = (value) => path.posix.dirname(value);
const rowNameOfValue = (value) => rows.find((row) => row.value === value)?.name;

// ── SV-3 (--tree): the registry against a delivered `.unikit/system` tree ────

const argv = process.argv.slice(2);
const treeMode = argv.includes(TREE_FLAG);

if (treeMode) {
    const projectDir = argv[argv.indexOf(TREE_FLAG) + 1];
    const engineTree = argv[argv.indexOf(ENGINE_TREE_FLAG) + 1];
    if (!projectDir || !ENGINE_TREE_VALUES.includes(engineTree)) {
        console.error(TREE_USAGE);
        process.exit(USAGE_EXIT_CODE);
    }

    await group('SV-3', async () => {
        const violations = [];
        const systemDir = dirValue(SYSTEM_DIR_NAME_VAR);
        const gamedesignDir = dirValue(GAMEDESIGN_DIR_NAME_VAR);
        const engineDir = dirValue(ENGINE_BRIDGES_DIR_VAR);
        const genresDir = dirValue(GENRES_DIR_VAR);
        const absolute = (value) => path.join(projectDir, ...value.split(POSIX));
        const relative = (file) => path.relative(projectDir, file).split(path.sep).join(POSIX);
        const fileRows = new Map(rows.filter((row) => row.kind === FILE_KIND).map((row) => [row.value, row]));
        const dirValues = new Set(rows.filter((row) => row.kind === DIR_KIND).map((row) => row.value));
        const engineTreeExpected = engineTree === ENGINE_TREE_YES;

        // Every file on disk: a registry row of the same path — except the two free trees, whose
        // content is not the registry's to list (the engine-bridge layer, which holds only BRIDGES.md as a row
        // beside the rules tree of every selected bridge, and the installed genre profiles).
        const delivered = (await walk(absolute(systemDir))).map(relative);
        for (const value of delivered) {
            if (value.startsWith(`${engineDir}${POSIX}`) || value.startsWith(`${genresDir}${POSIX}`)) continue;
            if (!fileRows.has(value)) violations.push(`${value}: delivered, but no registry row has this path`);
        }

        // Every sub-directory of the system directory and of its game-design directory: a directory row.
        const subdirs = async (value) => (await fs.readdir(absolute(value), { withFileTypes: true }).catch(() => []))
            .filter((entry) => entry.isDirectory()).map((entry) => `${value}${POSIX}${entry.name}`);
        for (const value of [...await subdirs(systemDir), ...await subdirs(gamedesignDir)]) {
            if (!dirValues.has(value)) violations.push(`${value}: a directory is delivered, but no registry row has this path`);
        }

        // Every row: a file or directory that `init`/`update` always write must be there; the
        // engine-bridge layer is there exactly when the project selected a bridge;
        // a file a skill writes (`skill`) and the installed genre profiles are not checked.
        for (const row of rows) {
            if (row.delivery === DELIVERY_SKILL || row.name === GENRES_DIR_VAR) continue;
            const isEngineRow = row.value === engineDir || row.value.startsWith(`${engineDir}${POSIX}`);
            const present = await exists(absolute(row.value));
            if (isEngineRow) {
                if (present !== engineTreeExpected) violations.push(`${row.value}: ${present ? 'present' : 'missing'}, expected ${engineTreeExpected ? 'present' : 'absent'} (${ENGINE_TREE_FLAG} ${engineTree})`);
            } else if (!present && (DELIVERY_ALWAYS.includes(row.delivery))) {
                violations.push(`${row.value}: registry row (${row.name}, ${row.delivery}) has no ${row.kind} in the delivered tree`);
            }
        }

        report('SV-3', 'the delivered tree and the registry agree', delivered.length, violations);
        console.log(`Tree check ${projectDir}: ${delivered.length} files, ${rows.length} rows, ${violations.length} divergences`);
    });
}

if (!treeMode) {
    // ── SV-1 / SV-1b / SV-1c: the shape of the registry ─────────────────────

    await group('SV-1', async () => {
        const violations = [];
        const names = rows.map((row) => row.name);
        const values = rows.map((row) => row.value);
        for (const name of names) {
            if (!NAME_SHAPE.test(name)) violations.push(`${name}: not a lower-case name of words joined by underscores`);
            if (FIXED_TEMPLATE_VAR_NAMES.includes(name)) violations.push(`${name}: collides with a variable that existed before the registry`);
        }
        for (const name of names.filter((n, i) => names.indexOf(n) !== i)) violations.push(`${name}: name appears twice`);
        for (const value of values.filter((v, i) => values.indexOf(v) !== i)) violations.push(`${value}: value appears twice`);
        for (const row of rows) {
            if (!ROW_KINDS.includes(row.kind)) violations.push(`${row.name}: unknown kind "${row.kind}"`);
            if (!ROW_DELIVERIES.includes(row.delivery)) violations.push(`${row.name}: unknown delivery "${row.delivery}"`);
            const v = row.value;
            if (!v.startsWith(`${FRAMEWORK_DIR}${POSIX}`)) violations.push(`${row.name}: value "${v}" does not start inside the framework directory`);
            if (v.includes('\\') || v.includes('//') || v.endsWith(POSIX) || VALUE_BAD_SEGMENT.test(v)) violations.push(`${row.name}: value "${v}" is not a clean project-relative path with "/"`);
            if (row.name !== SYSTEM_DIR_NAME_VAR && !rowByName.has(rowNameOfValue(parentOf(v)))) violations.push(`${row.name}: parent "${parentOf(v)}" is not a registry directory`);
        }
        for (const row of rows.filter((r) => r.kind === FILE_KIND)) {
            if (rows.some((r) => r.kind === DIR_KIND && r.value === row.value)) violations.push(`${row.name}: a file value equal to a directory value`);
        }
        report('SV-1', 'registry rows are well-formed and unique', rows.length, violations);

        const nameList = TEMPLATE_VAR_NAMES;
        const dup = nameList.filter((n, i) => nameList.indexOf(n) !== i);
        assertEq('SV-1', 'TEMPLATE_VAR_NAMES is the fixed names plus the registry names, once each', dup, []);
        assertEq('SV-1', 'TEMPLATE_VAR_NAMES length', nameList.length, FIXED_TEMPLATE_VAR_NAMES.length + SYSTEM_VAR_NAMES.length);
    });

    await group('SV-1b', async () => {
        const actual = new Set(rows.map((row) => row.name));
        const pinned = new Set(PINNED_NAMES);
        const extra = [...actual].filter((name) => !pinned.has(name));
        const missing = [...pinned].filter((name) => !actual.has(name));
        if (extra.length === 0 && missing.length === 0) {
            pass('SV-1b', 'the registry names equal the pinned public names', actual.size);
        } else {
            fail('SV-1b', `registry and pinned list differ — in the registry only: [${extra.join(', ')}]; pinned only: [${missing.join(', ')}]. A public name changes with two edits: the registry and PINNED_NAMES in ${SELF_FILE}`);
        }
        assertEq('SV-1b', `${USER_QUESTIONS_NAME} is ${USER_QUESTIONS_VALUE}`, SYSTEM_PATH_VARS[USER_QUESTIONS_NAME], USER_QUESTIONS_VALUE);
    });

    await group('SV-1c', async () => {
        const constantsText = await read(path.join(ROOT, CONSTANTS_FILE));
        const registryText = await read(path.join(ROOT, REGISTRY_FILE));
        const violations = [];
        if (REGISTRY_IMPORT_STATEMENT_RE.test(constantsText)) violations.push(`${CONSTANTS_FILE} imports or re-exports ${REGISTRY_MODULE_NAME}: an \`export *\` from it would make a cycle and a TDZ error`);
        const imports = [...registryText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
        for (const specifier of imports) {
            if (!REGISTRY_IMPORT_ALLOWED.includes(specifier)) violations.push(`${REGISTRY_FILE} imports "${specifier}" — it is a leaf and imports only ${REGISTRY_IMPORT_ALLOWED.join(', ')}`);
        }
        if (/^export\s+(\*|\{[^}]*\})\s+from\s/m.test(registryText)) violations.push(`${REGISTRY_FILE} re-exports another module`);
        report('SV-1c', 'the registry is a leaf: no cycle with constants.ts, no re-export', imports.length + 1, violations);
    });

    // ── SV-2: one substitution for every agent and for subagent files ───────

    await group('SV-2', async () => {
        const { AGENT_REGISTRY } = await import(dist('core/agents.js'));
        const { buildTemplateVars, processTemplate } = await import(dist('core/template.js'));
        const { buildSubagentTemplateVars } = await import(dist('core/installer/shared.js'));
        const { getTransformer } = await import(dist('core/transformer.js'));

        const builders = [
            ...Object.values(AGENT_REGISTRY).map((agent) => [`agent ${agent.id}`, () => buildTemplateVars(agent)]),
            ['subagent file', () => buildSubagentTemplateVars(SUBAGENT_PROBE_SELF_NAME)],
            [`subagent file with engine ${PROBE_ENGINE}`, () => buildSubagentTemplateVars(SUBAGENT_PROBE_SELF_NAME, PROBE_ENGINE)],
        ];
        const nonNames = new Set(['agent_skill_call_form']);
        const violations = [];
        let probes = 0;
        for (const [label, build] of builders) {
            const vars = build();
            for (const name of SYSTEM_VAR_NAMES) {
                probes++;
                const got = processTemplate(`{{${name}}}`, vars);
                if (got !== SYSTEM_PATH_VARS[name]) violations.push(`${label}: {{${name}}} -> "${got}", expected "${SYSTEM_PATH_VARS[name]}"`);
            }
            probes++;
            const unknown = processTemplate(UNKNOWN_NAME_PROBE, vars);
            if (unknown !== UNKNOWN_NAME_PROBE) violations.push(`${label}: an unknown token was changed to "${unknown}"`);
            const keys = Object.keys(vars).filter((key) => !nonNames.has(key)).sort();
            const expected = [...TEMPLATE_VAR_NAMES].sort();
            const extra = keys.filter((key) => !expected.includes(key));
            const missing = expected.filter((key) => !keys.includes(key));
            probes++;
            if (extra.length || missing.length) violations.push(`${label}: variable keys differ from TEMPLATE_VAR_NAMES — extra [${extra.join(', ')}], missing [${missing.join(', ')}]`);
        }
        const subagentVars = buildSubagentTemplateVars(SUBAGENT_PROBE_SELF_NAME);
        probes++;
        const call = processTemplate(SKILL_CALL_PROBE, subagentVars);
        if (call !== SKILL_CALL_PROBE) violations.push(`subagent file: ${SKILL_CALL_PROBE} was changed to "${call}"`);
        for (const agent of Object.values(AGENT_REGISTRY)) {
            const transform = getTransformer(agent.id).transformReference;
            if (typeof transform !== 'function') continue;
            for (const value of Object.values(SYSTEM_PATH_VARS)) {
                probes++;
                const out = transform.call(getTransformer(agent.id), value);
                if (out !== value) violations.push(`agent ${agent.id}: transformReference changed the path "${value}" to "${out}"`);
            }
        }
        report('SV-2', 'every registry name resolves to its path for every agent and subagent file', probes, violations);
    });

    // ── SV-4: data/ ⇔ registry rows whose file is delivered from data/ ──────

    await group('SV-4', async () => {
        const violations = [];
        let scanned = 0;
        const systemDir = dirValue(SYSTEM_DIR_NAME_VAR);
        const gamedesignDir = dirValue(GAMEDESIGN_DIR_NAME_VAR);
        const values = new Set(rows.filter((row) => row.kind === FILE_KIND).map((row) => row.value));
        const dataFlat = (await mdFilesIn(DATA_DIR)).filter((name) => !DATA_NOT_A_SYSTEM_FILE.includes(name));
        const dataGamedesign = await mdFilesIn(DATA_GAMEDESIGN_DIR);
        for (const [dir, files, parent] of [[DATA_DIR, dataFlat, systemDir], [DATA_GAMEDESIGN_DIR, dataGamedesign, gamedesignDir]]) {
            for (const file of files) {
                scanned++;
                const value = `${parent}${POSIX}${file}`;
                if (!values.has(value)) violations.push(`${dir}/${file}: delivered to ${value}, which is not a registry row`);
            }
        }
        for (const row of rows.filter((r) => r.kind === FILE_KIND && r.delivery === DELIVERY_CLI)) {
            scanned++;
            const parent = parentOf(row.value);
            const dir = parent === systemDir ? DATA_DIR : parent === gamedesignDir ? DATA_GAMEDESIGN_DIR : null;
            if (!dir) {
                violations.push(`${row.name}: a delivered-from-data row must sit directly in ${systemDir} or ${gamedesignDir}, not in ${parent}`);
                continue;
            }
            if (!await exists(path.join(ROOT, dir, path.posix.basename(row.value)))) violations.push(`${row.name}: ${dir}/${path.posix.basename(row.value)} does not exist`);
        }
        for (const row of rows.filter((r) => r.delivery === DELIVERY_SKILL)) {
            scanned++;
            if (!await exists(path.join(ROOT, LANGUAGE_RULES_TEMPLATE))) violations.push(`${row.name}: the template ${LANGUAGE_RULES_TEMPLATE} does not exist`);
        }
        report('SV-4', 'data/ and data/gamedesign/ match the registry both ways', scanned, violations);
        console.log(`  SV-4: ${dataFlat.length} flat file(s) in ${DATA_DIR}/, ${dataGamedesign.length} in ${DATA_GAMEDESIGN_DIR}/`);
    });

    // ── SV-5: every `.unikit/system…` literal in shipped text is a registry value ────

    await group('SV-5', async () => {
        const violations = [];
        const counts = new Map();
        let files = 0;
        for (const root of LITERAL_ROOTS) {
            for (const file of await textFilesUnder(root)) {
                files++;
                const text = await read(file);
                for (const literal of findLiterals(text)) {
                    counts.set(literal, (counts.get(literal) ?? 0) + 1);
                    const why = classifyLiteral(literal, rows);
                    if (why) violations.push(`${rel(file)}: ${why}`);
                }
            }
        }
        report('SV-5', 'every system-path literal in skills/, subagents/ and data/ is a registry value', files, violations);
        console.log(`  SV-5: ${counts.size} distinct literal form(s), ${[...counts.values()].reduce((a, b) => a + b, 0)} occurrence(s) in ${files} file(s)`);
        if (process.env[VERBOSE_ENV]) for (const [literal, n] of [...counts].sort()) console.log(`    ${String(n).padStart(4)}  ${literal}`);
    });

    // ── SV-6: no hand-written alternation of variable names in scripts/ ─────

    await group('SV-6', async () => {
        const violations = [];
        let files = 0;
        for (const file of await walk(path.join(ROOT, SCRIPTS_DIR), SCRIPTS_SKIPPED_DIR)) {
            if (path.basename(file) === SELF_FILE) continue;
            const text = await readOrNull(file);
            if (text === null) continue;
            files++;
            for (const hit of findAlternations(text, TEMPLATE_VAR_NAMES)) {
                violations.push(`${rel(file)}:${hit.line}: a hand-written list of ${hit.names.length} variable names (${hit.names.join('|')}) — read TEMPLATE_VAR_NAMES from dist/core/constants-template.js`);
            }
        }
        report('SV-6', 'no script keeps its own alternation of variable names', files, violations);
    });

    // ── SV-7: the docs table lists exactly the variable names ───────────────

    await group('SV-7', async () => {
        const markdown = await readOrNull(path.join(ROOT, DOCS_FILE));
        const section = markdown === null ? null : docsSection(markdown);
        if (section === null) {
            fail('SV-7', `${DOCS_FILE} has no "${DOCS_SECTION_HEADING}" section`);
            return;
        }
        const { table, mentioned } = docsVarNames(section);
        const known = new Set(TEMPLATE_VAR_NAMES);
        const violations = [];
        for (const name of known) if (!table.has(name)) violations.push(`${DOCS_FILE}: the table has no row for {{${name}}}`);
        for (const name of table) if (!known.has(name)) violations.push(`${DOCS_FILE}: the table lists {{${name}}}, which is not a template variable`);
        for (const name of mentioned) if (!known.has(name)) violations.push(`${DOCS_FILE}: the section writes {{${name}}} in code, which is not a template variable`);
        report('SV-7', 'the Template Variables table equals TEMPLATE_VAR_NAMES', table.size, violations);
    });

    await group('SV-7b', async () => {
        const violations = [];
        let files = 0;
        const targets = [];
        for (const root of EXTENSION_NAME_ROOTS) targets.push(...await walk(path.join(ROOT, root)));
        for (const name of EXTENSION_NAME_FILES) targets.push(path.join(ROOT, name));
        for (const file of targets) {
            const text = await readOrNull(file);
            if (text === null) continue;
            files++;
            if (text.includes(EXTENSION_NAME_PROBE)) violations.push(`${rel(file)}: names a concrete extension (${EXTENSION_NAME_PROBE}); shipped text names none`);
        }
        report('SV-7b', 'no shipped text names a concrete extension', files, violations);
    });

    // ── SV-8: base texts carry no registry names (until the hash learns about them) ──

    await group('SV-8', async () => {
        // Lifted by the step that adds a `sysvars:` component to computeSourceHashWithTemplate and
        // computeSubagentSourceHash: until then a base text that used a name would not be reinstalled
        // when the file it names moves, because the hash covers the source, not the substituted values.
        const known = new Set(SYSTEM_VAR_NAMES);
        const violations = [];
        const files = new Set();
        for (const root of BASE_TEXT_ROOTS) for (const file of await textFilesUnder(root)) files.add(file);
        for (const dir of BASE_TEXT_FLAT_DIRS) for (const name of await mdFilesIn(dir)) files.add(path.join(ROOT, dir, name));
        let scanned = 0;
        for (const file of files) {
            if (SV8_ALLOWED.includes(rel(file))) continue;
            const text = await readOrNull(file);
            if (text === null) continue;
            scanned++;
            for (const name of [...text.matchAll(TEMPLATE_TOKEN_RE)].map((match) => match[1])) {
                if (known.has(name)) violations.push(`${rel(file)}: {{${name}}} — a base text must not use a registry name yet (SV-8)`);
            }
        }
        report('SV-8', 'base skills, subagents and flat contracts carry no registry names', scanned, violations);
    });

    // ── SV-9: the warning for a name this build does not know ───────────────

    await group('SV-9', async () => {
        const unknown = await import(dist('core/extension-unknown-vars.js'));
        let samples = 0;
        const check = (what, actual, expected) => {
            samples++;
            assertEq('SV-9', what, actual, expected);
        };
        const tokens = (names) => names.map((name) => `{{${name}}}`).join(' ');

        check('every registry name is known', unknown.unknownTemplateVarNames(tokens(TEMPLATE_VAR_NAMES)), []);
        check('an unknown name is reported', unknown.unknownTemplateVarNames('{{no_such_name}}'), ['no_such_name']);
        check('a repeated unknown name is reported once', unknown.unknownTemplateVarNames('{{a_x}} and {{a_x}}'), ['a_x']);
        check('a token with a colon is not a candidate', unknown.unknownTemplateVarNames('{{ext_reference:x}} {{agent_skill_call:x}}'), []);
        check('an upper-case token is not a candidate', unknown.unknownTemplateVarNames('{{PROJECT_CONTEXT}}'), []);
        check('a name with a digit is a candidate', unknown.unknownTemplateVarNames('{{a1}}'), ['a1']);
        check('names come out sorted', unknown.unknownTemplateVarNames('{{zeta}} {{alpha}}'), ['alpha', 'zeta']);

        const lines = unknown.formatUnknownVars('demo', [{ file: 'a.md', names: ['x', 'y'] }]);
        check(
            'one finding is one line with the file, the names and the reason',
            [lines.length, lines[0].includes('a.md'), lines[0].includes('{{x}}, {{y}}'), lines[0].includes(UNKNOWN_VARS_REASON_PART)],
            [1, true, true, true],
        );
        const extra = 2;
        const many = Array.from({ length: EXTENSION_UNKNOWN_VARS_MAX_FILES + extra }, (_, i) => ({ file: `f${i}.md`, names: ['n'] }));
        const manyLines = unknown.formatUnknownVars('demo', many);
        check(
            'files beyond the limit are counted on one closing line',
            [manyLines.length, manyLines.at(-1).includes(`${extra} more`)],
            [EXTENSION_UNKNOWN_VARS_MAX_FILES + 1, true],
        );
        // The sources of an extension: which files are read, and nothing outside its directory.
        const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), UNKNOWN_VARS_SANDBOX_PREFIX));
        try {
            const put = async (relative, text) => {
                const file = path.join(sandbox, relative);
                await fs.mkdir(path.dirname(file), { recursive: true });
                await fs.writeFile(file, text);
            };
            await put('ext/skills/a/SKILL.md', '{{skill_name_x}}');
            await put('ext/skills/a/references/r.md', '{{skill_ref_x}}');
            await put('ext/skills/a/notes.txt', '{{not_markdown_x}}');
            await put('ext/skills/repl/SKILL.md', '{{replaced_x}}');
            await put('ext/agents/helper.md', '{{agent_x}}');
            await put('ext/injections/i.md', '{{inj_x}}');
            await put('ext/references/n.md', '{{inj_ref_x}}');
            await put('outside/SKILL.md', '{{outside_skill_x}}');
            await put('outside.md', '{{outside_file_x}}');
            const manifest = {
                name: 'demo',
                version: '1.0.0',
                skills: ['skills/a', '../outside'],
                replaces: { 'skills/repl': 'unikit-fix' },
                subagents: ['agents/helper.md', '../outside.md'],
                injections: [
                    { id: 'i', target: 'unikit', targetType: 'skill', point: 'bootstrap', file: './injections/i.md', references: ['./references/n.md', '../outside.md'] },
                    { position: 'append', target: 'unikit', targetType: 'skill', file: '../outside.md' },
                ],
            };
            const scan = await unknown.findUnknownVarsInExtension(path.join(sandbox, 'ext'), manifest);
            const names = scan.findings.flatMap((finding) => finding.names);
            check(
                'every kind of source is read: a skill, its references, a replacement skill, a subagent, an injection and its reference',
                scan.findings.map((finding) => finding.file),
                ['agents/helper.md', 'injections/i.md', 'references/n.md', 'skills/a/SKILL.md', 'skills/a/references/r.md', 'skills/repl/SKILL.md'],
            );
            check('only markdown is read inside a skill directory', names.includes('not_markdown_x'), false);
            check('a path that leaves the extension directory is neither read nor reported', names.filter((name) => name.startsWith('outside')), []);
            check('every file read here carried a name', scan.scanned, scan.findings.length);
        } finally {
            await fs.rm(sandbox, { recursive: true, force: true });
        }
        console.log(`  SV-9: ${samples} sample(s) checked`);
    });

    // SV-9b: the warning is called from the project pass, and the module knows nothing of the CLI.
    await group('SV-9b', async () => {
        const injectionsText = await read(path.join(ROOT, INJECTIONS_FILE));
        const moduleText = await read(path.join(ROOT, UNKNOWN_VARS_FILE));
        const violations = [];
        for (const call of UNKNOWN_VARS_CALLS) {
            if (!new RegExp(`\\b${call}\\(`).test(injectionsText)) violations.push(`${INJECTIONS_FILE}: no call of ${call}()`);
        }
        const imports = [...moduleText.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
        for (const specifier of imports) {
            if (CLI_IMPORT_RE.test(specifier)) violations.push(`${UNKNOWN_VARS_FILE} imports "${specifier}" — it must not know the CLI`);
        }
        if (!UNKNOWN_VARS_CATCH_RE.test(injectionsText)) violations.push(`${INJECTIONS_FILE}: the pass does not catch a failing scan (${UNKNOWN_VARS_FAILURE_CONSTANT} is not used in a catch block)`);
        if (!moduleText.includes(UNKNOWN_VARS_CONFINEMENT_CALL)) violations.push(`${UNKNOWN_VARS_FILE}: no ${UNKNOWN_VARS_CONFINEMENT_CALL}) — manifest paths are not confined to the extension directory`);
        report('SV-9b', 'the warning is called from the project pass, caught there, confined to the extension, and the module stays below cli/', imports.length + UNKNOWN_VARS_CALLS.length + 2, violations);
    });

    // ── Detector self-checks: a good sample passes, a bad one gives exactly one message ──

    await group('SV-self', async () => {
        let samples = 0;
        const check = (what, actual, expected) => {
            samples++;
            assertEq('SV-self', what, actual, expected);
        };
        // A fixed sample registry, not the live one: a detector's self-check must not turn red because a
        // file was renamed on purpose (that is SV-3/SV-4/SV-5's business). Same shapes as the real rows.
        const sampleRows = [
            { name: 'sample_dir', kind: DIR_KIND, delivery: DELIVERY_CLI, value: '.unikit/system' },
            { name: 'sample_file', kind: FILE_KIND, delivery: DELIVERY_CLI, value: '.unikit/system/sample.md' },
            { name: 'sample_gd_dir', kind: DIR_KIND, delivery: DELIVERY_CLI, value: '.unikit/system/gamedesign' },
            { name: 'sample_gd_file', kind: FILE_KIND, delivery: DELIVERY_CLI, value: '.unikit/system/gamedesign/sample-gd.md' },
            { name: 'sample_free_tree', kind: DIR_KIND, delivery: DELIVERY_CONDITIONAL, value: '.unikit/system/engine-bridges' },
            { name: 'sample_genres', kind: DIR_KIND, delivery: DELIVERY_CONDITIONAL, value: '.unikit/system/gamedesign/genres' },
        ];
        const messages = (text) => findLiterals(text).map((literal) => classifyLiteral(literal, sampleRows)).filter(Boolean);

        check('literal: a registry path is allowed', messages('Read `.unikit/system/sample.md` first.'), []);
        check('literal: a path with trailing punctuation is allowed', messages('See .unikit/system/gamedesign/sample-gd.md.'), []);
        check('literal: the directory with a trailing slash is allowed', messages('The `.unikit/system/` directory.'), []);
        check('literal: a file inside a free tree is allowed', messages('.unikit/system/engine-bridges/anything.md and .unikit/system/gamedesign/genres/x.json'), []);
        check('literal: a glob and a placeholder are prose', messages('`.unikit/system/**` and `.unikit/system/gamedesign/genres/<id>.json`'), []);
        check('literal: an unknown flat file is one message', messages('Read `.unikit/system/nope.md`.').length, 1);
        check('literal: an unknown file under gamedesign/ is one message (no subtree rule there)', messages('.unikit/system/gamedesign/nope.md').length, 1);

        const names = ['skills_dir', 'settings_file', 'self_name', 'agent_id'];
        check('alternation: three names joined by | are one finding', findAlternations('x=(skills_dir|settings_file|self_name)', names).length, 1);
        check('alternation: the old escaped brace form is one finding', findAlternations("grep '{{skills_dir}}\\|{{settings_file}}\\|{{self_name}}'", names).length, 1);
        check('alternation: two names are allowed', findAlternations('skills_dir|settings_file', names).length, 0);
        check('alternation: an array of names is allowed', findAlternations("['skills_dir', 'settings_file', 'self_name']", names).length, 0);
        check('alternation: a longer identifier is not a name', findAlternations('x_skills_dir|settings_file|self_name', names).length, 0);

        check('registry import: a comment that names the file is allowed', REGISTRY_IMPORT_STATEMENT_RE.test(' * and by `constants-template.ts`, hence exported'), false);
        check('registry import: an export-star from it is flagged', REGISTRY_IMPORT_STATEMENT_RE.test("export * from './constants-template.js';"), true);
        check('registry import: a dynamic import of it is flagged', REGISTRY_IMPORT_STATEMENT_RE.test("await import('./constants-template.js')"), true);

        check('scan-failed pin: the constant in a catch block passes', UNKNOWN_VARS_CATCH_RE.test(`import { ${UNKNOWN_VARS_FAILURE_CONSTANT} } from './x.js';\ntry { go(); } catch (error) {\n  logWarn(c, \`\${${UNKNOWN_VARS_FAILURE_CONSTANT}} \${error}\`);\n}`), true);
        check('scan-failed pin: the constant only in the import line does not', UNKNOWN_VARS_CATCH_RE.test(`import { ${UNKNOWN_VARS_FAILURE_CONSTANT} } from './x.js';\ntry { go(); } catch (error) {\n  logWarn(c, 'scan failed');\n}`), false);

        const doc = ['intro', '| `{{skills_dir}}` | a | b |', '| `{{agent_skill_call:<skill>}}` | a | b |', 'text `{{other_name}}` here'].join('\n');
        const parsed = docsVarNames(doc);
        check('docs: a table row names the variable, a form with ":" is skipped', [...parsed.table], ['skills_dir']);
        check('docs: a name written in code is collected', [...parsed.mentioned].sort(), ['other_name', 'skills_dir']);
        check('docs: the section ends at the next heading', docsSection('### Template Variables\nbody\n### Next\nelse'), 'body');

        console.log(`  SV-self: ${samples} sample(s) checked`);
    });
}

console.log(`\nSystem variable guards: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
