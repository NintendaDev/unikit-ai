#!/usr/bin/env node
// Build-time generator: reads cli-contract.ts, writes data/cli-contract.md
// Usage: npx tsx scripts/generate-cli-contract.ts

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  // Dynamic import of compiled module. On Windows, absolute paths must be
  // wrapped in a `file://` URL for the ESM loader (otherwise the drive letter
  // like `d:` is parsed as an unsupported protocol).
  const compiledPath = path.join(__dirname, '..', 'dist', 'core', 'cli-contract.js');
  const contractModule = await import(pathToFileURL(compiledPath).href);
  const markdown: string = contractModule.generateCliContractMarkdown();

  const outPath = path.join(__dirname, '..', 'data', 'cli-contract.md');
  fs.writeFileSync(outPath, markdown + '\n', 'utf-8');
  console.log(`Generated: ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
