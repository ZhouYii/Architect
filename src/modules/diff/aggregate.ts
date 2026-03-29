/**
 * Aggregate helpers for the diff/delta system.
 */

import type { DesignNode, ImplSummary } from '../store/types.js';
// Re-export from selectors so there is a single canonical implementation.
export { aggregateStatus } from '../store/selectors.js';

/**
 * Stub: reads `.architect/impl/status.json` and returns a per-node
 * implementation summary.  Full implementation in Phase 7.
 *
 * @param _nodeId  The DesignNode id to look up.
 */
export async function implSummaryForNode(_nodeId: string): Promise<ImplSummary | null> {
  // Phase 7: invoke Rust to read .architect/impl/status.json, find the task
  // whose node_id matches, and return its summary.
  return null;
}

/**
 * Convenience: group an array of DesignNodes by their status.
 * Returns a map of status → nodes.
 */
export function groupByStatus(
  nodes: DesignNode[]
): Record<string, DesignNode[]> {
  const groups: Record<string, DesignNode[]> = {};
  for (const node of nodes) {
    if (!groups[node.status]) groups[node.status] = [];
    groups[node.status].push(node);
  }
  return groups;
}

/**
 * Return only nodes matching specific statuses (helper for UI filters).
 */
export function filterByStatuses(
  nodes: DesignNode[],
  statuses: string[]
): DesignNode[] {
  return nodes.filter((n) => statuses.includes(n.status));
}
