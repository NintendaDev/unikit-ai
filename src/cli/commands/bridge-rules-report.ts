import chalk from 'chalk';
import type { BridgeRulesReport } from '../../core/installer/bridge-rules.js';
import { BRIDGE_RULE_REPORT, bridgeRuleDisplayPath } from '../../core/constants-bridges.js';

/**
 * What `init` and `update` tell the user about the rule of a bridge: a rule that arrived, one that left,
 * one that stayed although its bridge went, and one that could not be installed. A rule that is already
 * there, and a bridge the registry has no rule for, are not news and print nothing.
 */
export function printBridgeRulesReport(report: BridgeRulesReport): void {
  for (const { id, status, reason } of report.lines) {
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
