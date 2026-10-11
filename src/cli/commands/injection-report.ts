import chalk from 'chalk';
import { EXTENSION_SKIP_HINTS } from '../../core/constants.js';
import type { InjectionOutcome, InjectionReport } from '../../core/extension-injections.js';

// How the result of the injection pass reaches the user: one summary line and one line per group of
// skipped entries, with the reason's hint. Shared by `extension add|remove|update`, `update` and `init`
// so the three commands cannot word it differently.

export interface PrintReportOptions {
  /** Report only this extension's entries (the one `extension add` just installed). */
  onlyExtension?: string;
}

interface SkipGroup {
  extension: string;
  label: string;
  target: string;
  where: string;
  reason: NonNullable<InjectionOutcome['reason']>;
  detail: string | undefined;
  agents: string[];
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function groupSkipped(outcomes: InjectionOutcome[]): SkipGroup[] {
  const groups = new Map<string, SkipGroup>();

  for (const outcome of outcomes) {
    if (outcome.applied || !outcome.reason) continue;

    const label = outcome.id ?? 'position';
    const where = outcome.point ?? 'position';
    const key = [outcome.extension, outcome.kind, label, outcome.target, outcome.reason, outcome.detail ?? ''].join('\u0000');
    const group = groups.get(key) ?? {
      extension: outcome.extension, label, target: outcome.target, where,
      reason: outcome.reason, detail: outcome.detail, agents: [],
    };
    if (!group.agents.includes(outcome.agent)) group.agents.push(outcome.agent);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) =>
    compare(a.extension, b.extension) || compare(a.label, b.label) || compare(a.target, b.target));
}

/** The lines to print; `[]` when there is nothing to say. First line is the summary. */
export function formatInjectionReport(report: InjectionReport, options: PrintReportOptions = {}): string[] {
  const outcomes = options.onlyExtension
    ? report.outcomes.filter(o => o.extension === options.onlyExtension)
    : report.outcomes;
  if (outcomes.length === 0) return [];

  // One outcome per entry and agent — the same unit the report's own counters use.
  const appliedCount = outcomes.filter(o => o.applied).length;

  let summary = `Injections: ${appliedCount} of ${outcomes.length} applied`;
  const references = outcomes.reduce((sum, o) => sum + (o.references ?? 0), 0);
  if (references > 0) {
    summary += `, ${references} reference file(s)`;
  }

  const lines = [summary];
  for (const group of groupSkipped(outcomes)) {
    const detail = group.detail ? ` — ${group.detail}` : '';
    lines.push(
      `  ${group.extension} › ${group.label} → ${group.target} (${group.where}): `
      + `${EXTENSION_SKIP_HINTS[group.reason]}${detail} [${group.agents.join(', ')}]`,
    );
  }
  return lines;
}

export function printInjectionReport(report: InjectionReport, options: PrintReportOptions = {}): void {
  const lines = formatInjectionReport(report, options);
  if (lines.length === 0) return;

  const clean = lines.length === 1;
  console.log(clean ? chalk.green(`✓ ${lines[0]}`) : chalk.yellow(`⚠ ${lines[0]}`));
  for (const line of lines.slice(1)) {
    console.log(chalk.yellow(line));
  }
}
