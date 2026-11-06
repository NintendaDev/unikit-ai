// Behaviour of data/research-hash.mjs, the one way `Summary SHA256` is computed. Consumed from
// scripts/test-skills.sh (Part 7f9). The expected digests are constants computed once by an
// independent Git Bash pipeline (`awk | tr | sed | sha256sum`), never by this script: a digest
// derived from the script under test would stay green through any regression. The script runs
// through spawnSync with no shell, so no shell can change the bytes on the way.
// Writes only into a temporary directory.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = path.join(ROOT, 'data', 'research-hash.mjs');
const CONSTANTS = path.join(ROOT, 'src', 'core', 'constants-artifacts.ts');
const FIXTURE = path.join(ROOT, 'scripts', 'test-fixtures', 'research-indexes', 'project', '2026-10-02_unicode', 'RESEARCH.md');

const START = '<!-- unikit:active-summary:start -->';
const END = '<!-- unikit:active-summary:end -->';
const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

const EXPECTED_EXIT_MARKERS = 2;
const EXPECTED_EXIT_UNREADABLE = 3;

const DIGEST_A_B = 'c0f8c8bcee55839c166f52dad306d3663bbbe8892cf084c7ff85dfa43096cced';
const DIGEST_TAB = '71a2781c1d6094c922602e8939142002a76f181cc769ffffce428e866f9a4cfb';
const DIGEST_LEAD = '165dfd72f4cfe0d4a4ab19cbae5879c4703bc4aae2735a1cadb55d4c56835523';
const DIGEST_COMMENT = '278574a2db4ab7a019d4a2485094bdcaaccfe858dc66c6c4f10b7956c78cfaad';
const DIGEST_EMPTY = '01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b';
const DIGEST_FIXTURE = 'ab542cb16b4c0712cddda2a4eae1ca6fceceb6011be8b6aeb21212a0b2966167';

/** `body` is written between the markers, in LF form, unless the case builds the file itself. */
const manifest = (body) => `# Title\n\nUpdated: 2026-01-01\n\n## Active Summary\n${START}\n${body}${END}\n\n## Sessions\nTopic: outside\n`;

/** One region, every spelling of it: each must give the same digest. */
const DIGEST_CASES = [
    ['LF', manifest('A\nБ\n'), DIGEST_A_B],
    ['CRLF', manifest('A\nБ\n').replace(/\n/g, '\r\n'), DIGEST_A_B],
    ['BOM + CRLF', Buffer.concat([BOM, Buffer.from(manifest('A\nБ\n').replace(/\n/g, '\r\n'))]), DIGEST_A_B],
    ['BOM before a marker on the first line', Buffer.concat([BOM, Buffer.from(`${START}\nA\nБ\n${END}\n`)]), DIGEST_A_B],
    ['BOM at the start of the region', Buffer.concat([Buffer.from(`${START}\n`), BOM, Buffer.from(`A\nБ\n${END}\n`)]), DIGEST_A_B],
    ['trailing spaces', manifest('A   \nБ \n'), DIGEST_A_B],
    ['blank lines before the end marker', manifest('A\nБ\n\n  \n\n'), DIGEST_A_B],
    ['a trailing tab stays', manifest('A\t\n'), DIGEST_TAB],
    ['a leading blank line stays', manifest('\nA\n'), DIGEST_LEAD],
    ['a comment inside the region stays', manifest('<!-- c -->\nA\n'), DIGEST_COMMENT],
    ['markers side by side', manifest(''), DIGEST_EMPTY],
];

const MARKER_CASES = [
    ['no markers', 'just text\n'],
    ['no end marker', `${START}\nA\n`],
    ['no start marker', `A\n${END}\n`],
    ['two start markers', `${START}\n${START}\nA\n${END}\n`],
    ['two end markers', `${START}\nA\n${END}\n${END}\n`],
    ['the end marker first', `${END}\nA\n${START}\n`],
    ['a marker with a trailing space', `${START} \nA\n${END}\n`],
    ['a marker inside a longer line', `see ${START}\nA\n${END}\n`],
];

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

function run(args) {
    return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

function expectDigest(name, file, digest) {
    const result = run([file]);
    check(name, result.status === 0 && result.stdout === `${digest}\n` && result.stderr === '',
        `exit ${result.status}, stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}, expected ${digest}`);
}

function expectFailure(name, args, status) {
    const result = run(args);
    const stderrLines = result.stderr.trim().split('\n').filter(Boolean);
    check(name, result.status === status && result.stdout === '' && stderrLines.length === 1,
        `exit ${result.status} (expected ${status}), stdout ${JSON.stringify(result.stdout)}, stderr ${JSON.stringify(result.stderr)}`);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'unikit-research-hash-'));
try {
    DIGEST_CASES.forEach(([name, content, digest], index) => {
        const file = path.join(tmp, `digest-${index}.md`);
        fs.writeFileSync(file, content);
        expectDigest(name, file, digest);
    });

    MARKER_CASES.forEach(([name, content], index) => {
        const file = path.join(tmp, `markers-${index}.md`);
        fs.writeFileSync(file, content);
        expectFailure(name, [file], EXPECTED_EXIT_MARKERS);
    });

    expectFailure('no such file', [path.join(tmp, 'missing.md')], EXPECTED_EXIT_UNREADABLE);
    expectFailure('no path given', [], EXPECTED_EXIT_UNREADABLE);
    expectFailure('a directory', [tmp], EXPECTED_EXIT_UNREADABLE);

    // A real research of the repository, through the primary path.
    expectDigest('the unicode research fixture', FIXTURE, DIGEST_FIXTURE);

    // A folder name with Cyrillic and a space: the path reaches the script unchanged.
    const cyrillicDir = path.join(tmp, 'исследование один');
    fs.mkdirSync(cyrillicDir);
    const cyrillicFile = path.join(cyrillicDir, 'RESEARCH.md');
    fs.writeFileSync(cyrillicFile, manifest('A\nБ\n'));
    expectDigest('a Cyrillic path with a space', cyrillicFile, DIGEST_A_B);

    // The markers the script hashes between are the ones the installer's constants declare.
    const script = fs.readFileSync(SCRIPT, 'utf8');
    const constants = fs.readFileSync(CONSTANTS, 'utf8');
    for (const constant of ['RESEARCH_ACTIVE_SUMMARY_START', 'RESEARCH_ACTIVE_SUMMARY_END']) {
        const declared = constants.match(new RegExp(`export const ${constant} = '([^']+)';`))?.[1];
        check(`${constant} in the script`, Boolean(declared) && script.includes(`'${declared}'`),
            `the constant reads ${JSON.stringify(declared)}, and the script does not carry it`);
    }
    check('the script is a flat copy', !script.includes('{{'), 'the script carries a template token');
} finally {
    fs.rmSync(tmp, { recursive: true, force: true });
}

if (passed === 0) {
    console.error('FAIL no case ran: the suite has no object');
    process.exit(1);
}
console.log(`research-hash: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
