// ── SidePanel Tab System ──

/** Available tabs in the SidePanel */
export type Tab = 'details' | 'interfaces' | 'notes' | 'contracts' | 'chat' | 'versions' | 'dashboard';

// ── Contract Editor Types ──

import type { ContractSet, ContractEntry, TestCase } from '../../../src/types';

/** Factory for empty contract sets */
export function createEmptyContract(): ContractSet {
  return {
    invariants: [],
    preconditions: [],
    postconditions: [],
    test_cases: [],
  };
}

/** Contract violation detected during validation */
export interface ContractViolation {
  blockId: string;
  blockLabel: string;
  category: 'invariant' | 'precondition' | 'postcondition';
  description: string;
  message: string;
}

// ── Arrow Interface Editor Types ──

import type { ArrowInterface, ArrowType, BlockType, Status } from '../../../src/types';

/** The enum values offered in the Type dropdown for blocks */
export const BLOCK_TYPE_OPTIONS: BlockType[] = [
  'service', 'module', 'class', 'function',
  'data-store', 'external', 'queue', 'config',
];

/** The enum values offered in the Status dropdown */
export const STATUS_OPTIONS: Status[] = [
  'draft', 'approved', 'implementing', 'done', 'deprecated',
];

/** The enum values offered in the ArrowType dropdown */
export const ARROW_TYPE_OPTIONS: ArrowType[] = [
  'calls', 'reads', 'writes', 'publishes', 'subscribes', 'depends',
];

/** Error handling strategies for arrow interfaces */
export const ERROR_HANDLING_OPTIONS: ArrowInterface['error_handling'][] = [
  'throw', 'rollback', 'retry', 'ignore',
];

/** Protocol options for arrow interfaces */
export const PROTOCOL_OPTIONS: ArrowInterface['protocol'][] = [
  'rpc', 'event', 'stream', 'http',
];

// ── Contract Dashboard Types ──

export interface CanvasContractStats {
  id: string;
  label: string;
  total: number;
  implemented: number;
}
