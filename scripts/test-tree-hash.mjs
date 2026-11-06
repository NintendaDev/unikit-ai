// Behaviour of data/tree-hash.mjs, the one way `tree-sha256` and the recon change guard are computed.
// Consumed from scripts/test-skills.sh (Part 7f10). The two expected digests are constants computed once
// by an independent Git Bash pipeline (`git ls-tree`, `git hash-object`, `LC_ALL=C sort`, `sha256sum`),
// never by this script: a digest derived from the script under test would stay green through any regression.
// Every other case compares two runs on a real repository. The script runs through spawnSync with no
// shell. Writes only into a temporary directory; git reads no system or user configuration here.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'data', 'tree-hash.mjs');

const EXPECTED_EXIT_NO_ANSWER = 3;
const DIGEST_ONE_FILE = '8a9e8c1d0f074c629503f74ae7dfefcbb0a733fbbe08e5e259aabd523d402939';
const DIGEST_MIXED_TREE = 'a6b202b94fdf565f06a1a7d5145fc2249f322fc3e40812ac65daf3a7d5e65d25';
const CYRILLIC_FILE = 'Assets/Ёлка файл.cs';
const MOVED = 'moved';
const SAME = 'same';

let passed = 0;
let failed = 0;

function check(name, ok, detail) {
    if (ok) {
        passed++;
    } else {
        failed++;
        console.error(`FAIL [${name}] ${detail}`);
    }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unikit-tree-hash-'));
const emptyConfig = path.join(tmp, 'gitconfig');
fs.writeFileSync(emptyConfig, '');

// A hook or a shell of the user may export GIT_DIR, GIT_INDEX_FILE and the like: none of them reaches a test repository.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('GIT_')));
const gitEnv = { ...cleanEnv, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: emptyConfig };

function git(dir, ...args) {
    return execFileSync('git', args, { cwd: dir, env: gitEnv, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function newRepo(name, autocrlf = 'false') {
    const dir = path.join(tmp, name);
    fs.mkdirSync(dir, { recursive: true });
    git(dir, 'init', '-q', '.');
    git(dir, 'config', 'user.email', 'test@example.invalid');
    git(dir, 'config', 'user.name', 'test');
    git(dir, 'config', 'core.autocrlf', autocrlf);
    return dir;
}

function write(dir, relative, content) {
    const file = path.join(dir, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
}

function commitAll(dir, message = 'commit') {
    git(dir, 'add', '-A');
    git(dir, 'commit', '-qm', message);
}

function run(dir, args = [], env = gitEnv) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env, encoding: 'utf8' });
}

/** One clean run: a digest on stdout, nothing on stderr. A broken run is a failure of its own and returns its text. */
function digestOf(name, dir, args = []) {
    const result = run(dir, args);
    const clean = result.status === 0 && /^[0-9a-f]{64}\n$/.test(result.stdout) && result.stderr === '';
    check(`${name}: a clean run`, clean, `exit ${result.status}, stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
    return result.stdout;
}

/** Each step acts, then its digest is compared with the digest of the step before it. */
function walk(title, dir, args, steps) {
    let previous = digestOf(`${title}: the start`, dir, args);
    for (const [name, action, expected] of steps) {
        action();
        const current = digestOf(`${title}: ${name}`, dir, args);
        const actual = current === previous ? SAME : MOVED;
        check(`${title}: ${name}`, actual === expected, `the digest ${actual}, expected ${expected}`);
        previous = current;
    }
}

function expectNoAnswer(name, dir, env = gitEnv) {
    const result = run(dir, [], env);
    const stderrLines = result.stderr.trim().split('\n').filter(Boolean);
    check(name,
        result.status === EXPECTED_EXIT_NO_ANSWER && result.stdout === '' && stderrLines.length === 1
            && stderrLines[0].startsWith('tree-hash: git did not answer: '),
        `exit ${result.status} (expected ${EXPECTED_EXIT_NO_ANSWER}), stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
}

/** The repository behind the two pinned digests: recipes of the independent pipeline, byte for byte. */
function pinnedRepo() {
    const dir = newRepo('pinned');
    write(dir, 'a.cs', 'a\n');
    commitAll(dir);
    check('pinned: one file', digestOf('pinned: one file', dir) === `${DIGEST_ONE_FILE}\n`, `expected ${DIGEST_ONE_FILE}`);

    write(dir, 'Assets/Alpha.cs', 'class A {}\n');
    write(dir, 'Assets/_under.cs', 'u\n');
    write(dir, CYRILLIC_FILE, 'c\n');
    write(dir, 'README.md', 'm\n');
    write(dir, '.unikit/PLAN.md', 'p\n');
    commitAll(dir);
    write(dir, 'Assets/New.cs', 'x\n');
    write(dir, 'Assets/Alpha.cs', 'class A { }\n');
    fs.rmSync(path.join(dir, 'Assets/_under.cs'));
    check('pinned: a mixed tree', digestOf('pinned: a mixed tree', dir) === `${DIGEST_MIXED_TREE}\n`, `expected ${DIGEST_MIXED_TREE}`);

    // The path of the Cyrillic file is one text whatever the user set: raw bytes would be another digest.
    git(dir, 'config', 'core.quotepath', 'false');
    check('pinned: core.quotepath=false', digestOf('pinned: core.quotepath=false', dir) === `${DIGEST_MIXED_TREE}\n`, `expected ${DIGEST_MIXED_TREE}`);
    git(dir, 'config', '--unset', 'core.quotepath');
    return dir;
}

function caseLineEndings() {
    const dir = newRepo('crlf', 'true');
    write(dir, 'Assets/A.cs', 'class A {}\r\n');
    write(dir, 'Docs/R.md', 'd\r\n');
    write(dir, '.unikit/code/PLAN.md', 'p\r\n');
    commitAll(dir);
    walk('autocrlf', dir, [], [
        ['an edit', () => write(dir, 'Assets/A.cs', 'class A { int x; }\r\n'), MOVED],
        ['staging it', () => git(dir, 'add', '-A'), SAME],
        ['committing it', () => git(dir, 'commit', '-qm', 'edit'), SAME],
        ['a new file', () => write(dir, 'Assets/N.cs', 'class N {}\r\n'), MOVED],
        ['committing the new file', () => commitAll(dir), SAME],
        ['a message amended', () => git(dir, 'commit', '-q', '--amend', '-m', 'amended'), SAME],
        ['a Markdown edit', () => write(dir, 'Docs/R.md', 'd2\r\n'), SAME],
        ['a new upper-case Markdown file', () => write(dir, 'Docs/UP.MD', 'd3\r\n'), SAME],
        ['an edit under .unikit', () => write(dir, '.unikit/code/PLAN.md', 'p2\r\n'), SAME],
        ['committing Markdown and .unikit', () => commitAll(dir), SAME],
    ]);
}

function casePaths() {
    const dir = newRepo('paths');
    write(dir, 'a.cs', 'a\n');
    commitAll(dir);
    walk('paths', dir, [], [
        ['new files: Cyrillic, a space, mixed case', () => {
            write(dir, CYRILLIC_FILE, 'a\n');
            write(dir, 'Assets/_u.cs', 'b\n');
            write(dir, 'Assets/Alpha.cs', 'c\n');
        }, MOVED],
        ['committing them', () => commitAll(dir), SAME],
        ['an edit of the Cyrillic file', () => write(dir, CYRILLIC_FILE, 'a2\n'), MOVED],
        ['a checkout back', () => git(dir, 'checkout', '-q', '--', '.'), MOVED],
        ['a deletion', () => fs.rmSync(path.join(dir, CYRILLIC_FILE)), MOVED],
        ['committing the deletion', () => commitAll(dir), SAME],
        ['a rename', () => git(dir, 'mv', 'Assets/Alpha.cs', 'Assets/Beta.cs'), MOVED],
        ['committing the rename', () => git(dir, 'commit', '-qm', 'rename'), SAME],
        ['a mode change alone', () => fs.chmodSync(path.join(dir, 'a.cs'), 0o755), SAME],
    ]);
    git(dir, 'checkout', '-q', '--', '.');

    const before = digestOf('revert: before', dir);
    write(dir, 'Assets/Once.cs', 'x\n');
    commitAll(dir, 'once');
    check('revert: the commit moved it', digestOf('revert: after the commit', dir) !== before, 'the digest did not move');
    git(dir, 'revert', '--no-edit', 'HEAD');
    check('revert: back to the same files, back to the same digest', digestOf('revert: after the revert', dir) === before, 'the digest differs');
}

function caseAll() {
    const dir = newRepo('all');
    write(dir, 'a.cs', 'a\n');
    write(dir, 'Docs/R.md', 'd\n');
    write(dir, '.unikit/code/PLAN.md', 'p\n');
    commitAll(dir);
    walk('--all', dir, ['--all'], [
        ['a Markdown edit', () => write(dir, 'Docs/R.md', 'd2\n'), MOVED],
        ['an edit under .unikit', () => write(dir, '.unikit/code/PLAN.md', 'p2\n'), MOVED],
        ['staging', () => git(dir, 'add', '-A'), SAME],
        ['unstaging', () => git(dir, 'reset', '-q'), SAME],
        ['a source edit', () => write(dir, 'a.cs', 'a2\n'), MOVED],
    ]);
}

function caseSubdirectory() {
    const root = newRepo('sub');
    write(root, 'Sub/Assets/S.cs', 's\n');
    write(root, 'Sub/.unikit/U.cs', 'u\n');
    write(root, 'Other/O.cs', 'o\n');
    write(root, '.unikit/R.cs', 'r\n');
    commitAll(root);
    const project = path.join(root, 'Sub');
    walk('a project in a subdirectory', project, [], [
        ['a change next to the project', () => write(root, 'Other/O.cs', 'o2\n'), SAME],
        ['a change under <project>/.unikit', () => write(project, '.unikit/U.cs', 'u2\n'), SAME],
        ['an edit in the project', () => write(project, 'Assets/S.cs', 's2\n'), MOVED],
        ['committing it', () => {
            git(project, 'add', '-A', '.');
            git(project, 'commit', '-qm', 'edit');
        }, SAME],
    ]);
}

function caseNestedAndLinks() {
    const dir = newRepo('nested');
    write(dir, 'a.cs', 'a\n');
    write(dir, '.gitignore', 'ignored/\n');
    commitAll(dir);
    const nestedDir = path.join('nested', 'inner');
    walk('nested and linked repositories', dir, [], [
        ['a file in an ignored directory', () => write(dir, 'ignored/x', 'x\n'), SAME],
        ['a nested repository appears', () => {
            const nested = newRepo(nestedDir);
            write(nested, 'n', 'n\n');
            commitAll(nested);
        }, MOVED],
        ['an edit inside the nested repository', () => write(dir, 'inner/n', 'n2\n'), SAME],
        ['a committed gitlink', () => {
            git(dir, 'update-index', '--add', '--cacheinfo', `160000,${git(dir, 'rev-parse', 'HEAD')},lib`);
            git(dir, 'commit', '-qm', 'link');
        }, MOVED],
        ['a committed gitlink bump', () => {
            git(dir, 'update-index', '--cacheinfo', `160000,${git(dir, 'rev-parse', 'HEAD')},lib`);
            git(dir, 'commit', '-qm', 'bump');
        }, MOVED],
    ]);
}

function caseFailures() {
    expectNoAnswer('a repository with no commits', newRepo('unborn'));

    const outside = path.join(tmp, 'outside');
    fs.mkdirSync(outside);
    expectNoAnswer('a directory outside any repository', outside);

    const dir = newRepo('boom');
    write(dir, 'a.cs', 'a\n');
    write(dir, '.gitattributes', '*.boom filter=boom\n');
    commitAll(dir);
    git(dir, 'config', 'filter.boom.required', 'true');
    git(dir, 'config', 'filter.boom.clean', 'false');
    write(dir, 'x.boom', 'b\n');
    expectNoAnswer('a file git cannot hash: no partial digest', dir);

    // No git on PATH. The key is removed in any spelling: on Windows it is usually `Path`.
    const noGit = path.join(tmp, 'no-git-on-path');
    fs.mkdirSync(noGit);
    const envWithoutPath = Object.fromEntries(Object.entries(gitEnv).filter(([key]) => key.toUpperCase() !== 'PATH'));
    const clean = newRepo('clean');
    write(clean, 'a.cs', 'a\n');
    commitAll(clean);
    expectNoAnswer('no git on PATH', clean, { ...envWithoutPath, PATH: noGit });
}

/** A Windows shell gives the same digest: the mechanism exists to work there. */
function casePowerShell(dir) {
    if (process.platform !== 'win32') return;
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `& '${process.execPath}' '${SCRIPT}'`],
        { cwd: dir, env: gitEnv, encoding: 'utf8' });
    check('PowerShell gives the same digest', result.status === 0 && result.stdout.trim() === DIGEST_MIXED_TREE,
        `exit ${result.status}, stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
}

try {
    casePowerShell(pinnedRepo());
    caseLineEndings();
    casePaths();
    caseAll();
    caseSubdirectory();
    caseNestedAndLinks();
    caseFailures();
    check('the script is a flat copy', !fs.readFileSync(SCRIPT, 'utf8').includes('{{'), 'the script carries a template token');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

if (passed === 0) {
    console.error('FAIL no case ran: the suite has no object');
    process.exit(1);
}
console.log(`tree-hash: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
