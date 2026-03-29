/**
 * Level 2 — Version History internal interfaces.
 *
 * These types describe the data shapes flowing between the version system's
 * sub-components: checkpoint lifecycle, integrity validation, comparison
 * engine, and version browsing.
 */

/** The sequence of operations in a checkpoint creation. */
export interface CheckpointSequence {
  steps: [
    'flush_to_disk',
    'validate_tree',
    'compute_hash',
    'create_archive',
    'update_metadata',
    'archive_acps',
    'generate_mermaid',
    'generate_agent_guide',
  ];
  /** If any step fails, the entire checkpoint is aborted. */
  atomicity: 'all-or-nothing';
}

/** Result of tree integrity validation. */
export interface ValidationResult {
  valid: boolean;
  /** Human-readable error messages, one per violation. */
  errors: string[];
}

/** Errors caught by integrity validation. */
export interface IntegrityCheck {
  /** Arrow references a block ID that does not exist in its canvas. */
  brokenArrowRef: { canvasId: string; arrowId: string; missingBlockId: string };
  /** Block has hasChildren=true but no child canvas node exists. */
  orphanedChildFlag: { canvasId: string; blockId: string };
}

/** A checkpoint archive entry from the versions list. */
export interface CheckpointEntry {
  /** Archive filename, e.g. "cp-003.tar.gz" */
  filename: string;
  /** Extracted version number. */
  versionNumber: number;
}
