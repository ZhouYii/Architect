/**
 * Level 2 — Design Review internal interfaces.
 *
 * These types describe the data shapes flowing between the review system's
 * sub-components: proposal queue, suggestion presentation, diff rendering,
 * change application, and diff computation.
 */

/** A pending proposal in the queue with conflict/staleness metadata. */
export interface QueuedProposal {
  acp: import('../../types').ACP;
  /** True if another pending ACP targets the same component. */
  hasConflict: boolean;
  /** True if the ACP's based_on_checkpoint differs from current. */
  isStale: boolean;
}

/** The user's action on a single suggestion card. */
export interface SuggestionAction {
  acpId: string;
  action: 'apply' | 'dismiss';
}

/** The user's action on a single diff entry in the merge overlay. */
export interface DiffAction {
  entryIndex: number;
  action: 'accept' | 'reject';
}

/** Summary of merge review progress. */
export interface ReviewProgress {
  total: number;
  resolved: number;
  accepted: number;
  rejected: number;
}

/** The mapping from ACP kind to store mutation(s). */
export interface ApplicationMapping {
  kind: import('../../types').ACPKind;
  /** Store actions invoked to realize this change kind. */
  storeActions: string[];
  /** Whether this kind requires cross-canvas search. */
  requiresCrossCanvasLookup: boolean;
}
