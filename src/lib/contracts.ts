import type { Block, ContractSet } from '../types';

export interface ContractViolation {
  blockId: string;
  blockLabel: string;
  category: 'invariant' | 'precondition' | 'postcondition';
  description: string;
  message: string;
}

/**
 * Validate all contracts after a change.
 * Returns list of violations (empty = all pass).
 *
 * Iterates over invariants, preconditions, and postconditions (ContractEntry objects).
 * Full runtime evaluation would require a safe expression parser.
 * For now, we check that blocks referenced in entry descriptions still exist.
 */
export function validateContracts(
  blocks: Block[],
  allBlockIds: Set<string>,
): ContractViolation[] {
  const violations: ContractViolation[] = [];

  for (const block of blocks) {
    if (!block.contract) continue;

    const checks: Array<{ entries: ContractSet['invariants']; category: ContractViolation['category'] }> = [
      { entries: block.contract.invariants, category: 'invariant' },
      { entries: block.contract.preconditions, category: 'precondition' },
      { entries: block.contract.postconditions, category: 'postcondition' },
    ];

    for (const { entries, category } of checks) {
      for (const entry of entries) {
        // Check expression or description for references to block IDs that no longer exist
        const text = entry.expression ?? entry.description;
        const refs = text.match(/\b[a-z][\w-]*\b/g) ?? [];
        for (const ref of refs) {
          if (ref.includes('-') && !allBlockIds.has(ref)) {
            violations.push({
              blockId: block.id,
              blockLabel: block.label,
              category,
              description: entry.description,
              message: `Referenced block "${ref}" does not exist`,
            });
          }
        }
      }
    }
  }

  return violations;
}

/**
 * Create a default empty contract for a block.
 */
export function createEmptyContract(): ContractSet {
  return {
    invariants: [],
    preconditions: [],
    postconditions: [],
    test_cases: [],
  };
}
