/**
 * Level 1 — Product-level interfaces for the Architect self-map.
 *
 * These types describe the information that flows between the five
 * top-level capability areas. They are intentionally high-level;
 * deeper decompositions will refine them into concrete data shapes.
 */

/** A complete architecture diagram at a single level of depth. */
export interface DesignSnapshot {
  /** Human-readable name of the design or sub-design. */
  label: string;
  /** The building blocks visible on the canvas. */
  components: ComponentSummary[];
  /** The labeled relationships between those blocks. */
  relationships: RelationshipSummary[];
  /** When this snapshot was captured. */
  capturedAt: string;
}

/** Abbreviated description of a single building block. */
export interface ComponentSummary {
  id: string;
  label: string;
  kind: string;
  hasInternalDetail: boolean;
}

/** Abbreviated description of a single arrow between blocks. */
export interface RelationshipSummary {
  id: string;
  from: string;
  to: string;
  label: string;
  nature: string;
}

/** A structured change proposal from AI or version comparison. */
export interface ChangeProposal {
  id: string;
  description: string;
  /** Individual modifications grouped under this proposal. */
  modifications: Modification[];
  origin: "ai-agent" | "version-comparison";
  proposedAt: string;
}

/** One discrete modification within a change proposal. */
export interface Modification {
  action: "add" | "remove" | "modify" | "restructure";
  targetLabel: string;
  reason: string;
}

/** The user's verdict on a proposed change. */
export interface ReviewDecision {
  proposalId: string;
  accepted: boolean;
  reviewedAt: string;
  reviewerNote?: string;
}

/** A named, immutable point-in-time record of the full design. */
export interface VersionCheckpoint {
  checkpointId: string;
  label: string;
  createdAt: string;
  /** Fingerprint used to detect whether anything changed. */
  contentHash: string;
}

/** Differences between two versions, ready for human review. */
export interface VersionDiff {
  baseCheckpoint: string;
  compareCheckpoint: string;
  differences: Modification[];
}
