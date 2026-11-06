#!/usr/bin/env node
// Prints a SHA-256 of the project's content: one `<blob id> <path>` line per file, sorted by bytes.
// Usage: node tree-hash.mjs [--all]
//   default: `.unikit/` and Markdown files are left out (the record of a test run).
//   --all:   every file git does not ignore (the change guard of a planning run).
// Exit 0: the digest on stdout. 3: git did not answer; nothing on stdout.
// Git is called with no shell, so the digest does not depend on the shell, its pipes or the locale.
// A commit is not part of the text: a commit that moves no file does not move the digest.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const EXIT_NO_ANSWER = 3;
const NESTED_REPOSITORY = 'nested-repository';
const SCOPE = process.argv.includes('--all')
  ? ['--', '.']
  : ['--', '.', ':(exclude).unikit', ':(exclude,icase)*.md'];
const AGAINST_HEAD = ['diff', 'HEAD', '--name-only', '--no-renames', '--ignore-submodules'];

// core.quotepath=on: every byte above ASCII of a path is octal-escaped, so no code page can touch the text,
// the digest does not follow the user's setting, and `--stdin-paths` reads that form back.
const git = (args, input = '') =>
  execFileSync('git', ['-c', 'core.quotepath=on', ...args], { input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 2 ** 30 });
const lines = (buffer) => buffer.toString().split('\n').filter(Boolean);
const bytewise = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

try {
  // The files of HEAD with their blob ids: a diff against the empty tree, so one pathspec rules all three lists.
  const emptyTree = lines(git(['hash-object', '-t', 'tree', '--stdin']))[0];
  const tree = new Map();
  for (const row of lines(git(['diff', '--raw', '--no-abbrev', '--no-renames', emptyTree, 'HEAD', ...SCOPE]))) {
    const tab = row.indexOf('\t');
    tree.set(row.slice(tab + 1), row.slice(0, tab).split(' ')[3]);
  }
  for (const path of lines(git([...AGAINST_HEAD, '--diff-filter=D', ...SCOPE]))) tree.delete(path);

  const untracked = lines(git(['ls-files', '--others', '--exclude-standard', '--full-name', ...SCOPE]));
  const changed = lines(git([...AGAINST_HEAD, '--diff-filter=d', ...SCOPE]));
  // A nested repository is listed as `path/`: its presence counts, its own files are its own.
  for (const path of untracked.filter((p) => p.endsWith('/'))) tree.set(path, NESTED_REPOSITORY);
  const toHash = [...changed, ...untracked].filter((p) => !p.endsWith('/'));
  if (toHash.length > 0) {
    const ids = lines(git(['hash-object', '--stdin-paths'], `${toHash.join('\n')}\n`));
    if (ids.length !== toHash.length) throw new Error('git hashed fewer files than it was given');
    toHash.forEach((path, index) => tree.set(path, ids[index]));
  }

  const text = [...tree].map(([path, id]) => `${id} ${path}\n`).sort(bytewise).join('');
  console.log(createHash('sha256').update(text).digest('hex'));
} catch (error) {
  const said = String(error.stderr?.length ? error.stderr : error.message).split('\n');
  console.error(`tree-hash: git did not answer: ${said.find((line) => line.startsWith('fatal:')) ?? said[0]}`);
  process.exit(EXIT_NO_ANSWER);
}
