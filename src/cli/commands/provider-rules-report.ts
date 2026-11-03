import chalk from 'chalk';
import type { ProviderRulesReport } from '../../core/installer/provider-rules.js';
import { BRIDGE_RULE_REPORT, bridgeRuleDisplayPath } from '../../core/constants-bridges.js';
import { PROVIDER_RULE_LABELS } from '../../core/constants-provider-rules.js';

/**
 * Human output for MCP / bridge memory rules. Unavailable bundles and pending choices are
 * handled by the picker; the lifecycle reports actual files, decisions and failures here.
 */
export function printProviderRulesReport(report: ProviderRulesReport): void {
  for (const { id, status, reason } of report.lines) {
    if (status === 'declined' || status === 'present') {
      console.log(chalk.dim(`${PROVIDER_RULE_LABELS[status]} ${id}`));
    }
    if (status === 'installed') {
      console.log(chalk.green(`✓ ${BRIDGE_RULE_REPORT.installed} ${id} (${bridgeRuleDisplayPath(id)})`));
    } else if (status === 'removed') {
      console.log(chalk.dim(`${BRIDGE_RULE_REPORT.removed} ${id}`));
    } else if (status === 'kept') {
      console.log(chalk.yellow(`⚠ ${BRIDGE_RULE_REPORT.kept} ${id} ${BRIDGE_RULE_REPORT.keptOf}: ${reason}`));
    } else if (status === 'failed') {
      console.log(chalk.yellow(`⚠ ${BRIDGE_RULE_REPORT.failed} ${id}: ${reason}`));
    }
  }
}
