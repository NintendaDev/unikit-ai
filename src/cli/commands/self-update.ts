import chalk from 'chalk';
import semver from 'semver';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { realpathSync } from 'fs';
import { getCurrentVersion } from '../../core/config.js';

async function getLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch('https://registry.npmjs.org/unikit-ai/latest', {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    const data = await response.json() as { version: string };
    if (!semver.valid(data.version)) return null;
    return data.version;
  } catch {
    return null;
  }
}

function getInstallCommand(version: string): string {
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const binPath = execSync(`${whichCmd} unikit-ai`, {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).split('\n')[0].trim();
    const realPath = realpathSync(binPath).replaceAll('\\', '/');

    if (realPath.includes('.bun/')) return `bun add -g unikit-ai@${version}`;
    if (realPath.includes('/mise/')) return `mise use -g npm:unikit-ai@${version}`;
    if (realPath.includes('/volta/')) return `volta install unikit-ai@${version}`;
    if (realPath.includes('/pnpm/')) return `pnpm add -g unikit-ai@${version}`;
    if (realPath.includes('/yarn/')) return `yarn global add unikit-ai@${version}`;
  } catch {
    // Binary not found or symlink resolution failed, default to npm
  }
  return `npm install -g unikit-ai@${version}`;
}

export async function selfUpdateCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🎮 UniKit — Self Update\n'));

  const currentVersion = getCurrentVersion();
  const latestVersion = await getLatestVersion();

  if (!latestVersion) {
    console.log(chalk.dim('Could not check for new versions\n'));
    return;
  }

  if (!semver.gt(latestVersion, currentVersion)) {
    console.log(chalk.dim('unikit-ai is up to date\n'));
    return;
  }

  console.log(chalk.cyan(`📦 New version available: ${currentVersion} → ${latestVersion}`));

  if (!process.stdin.isTTY) {
    console.log(chalk.dim('Non-interactive mode — skipping self-update\n'));
    return;
  }

  const { shouldUpdate } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldUpdate',
    message: `Update unikit-ai to ${latestVersion}?`,
    default: true,
  }]);

  if (!shouldUpdate) {
    console.log(chalk.dim('Skipping package update\n'));
    return;
  }

  try {
    const installCmd = getInstallCommand(latestVersion);
    console.log(chalk.dim(`\n$ ${installCmd}`));
    execSync(installCmd, { stdio: 'inherit' });
    console.log(chalk.green(`\n✓ Updated to ${latestVersion}\n`));
  } catch (error) {
    console.log(chalk.red(`\n✗ Self-update failed: ${(error as Error).message}\n`));
    process.exit(1);
  }
}
