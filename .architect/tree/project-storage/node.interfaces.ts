/**
 * Level 2 — Project Storage internal interfaces.
 *
 * These types describe the data shapes flowing between the storage system's
 * sub-components: autosave, serialization, native filesystem, tree structure,
 * and workspace metadata.
 */

/** A file entry ready for disk write via the Tauri IPC bridge. */
export interface FileEntry {
  /** Relative path within the base directory. */
  path: string;
  /** UTF-8 file content. */
  content: string;
}

/** The four file types that comprise a canvas on disk. */
export interface CanvasFileSet {
  /** Blocks, arrows, ports — the structural definition. */
  nodeYaml: string;
  /** Block positions — presentation only, excluded from hash. */
  layoutJson: string;
  /** TypeScript interface definitions — included in hash. */
  interfacesTs?: string;
  /** Design notes — excluded from hash. */
  notesMd?: string;
  /** Mermaid diagram — generated at checkpoint, excluded from hash. */
  diagramMermaid?: string;
}

/** Configuration fields persisted in workspace.yaml. */
export interface WorkspaceConfigShape {
  schema_version: number;
  project_name: string;
  created_at: string;
  last_checkpoint: string;
  last_checkpoint_at?: string;
  last_checkpoint_hash: string;
  llm: { preferred_provider: string; ollama_model: string };
}

/** Transient state persisted in workspace.state.yaml. */
export interface WorkspaceStateShape {
  version: string;
  head_hash: string;
  dirty: boolean;
  pending_changes: number;
  last_flush_at: string;
}

/** What the structural hash covers vs. excludes. */
export interface HashPolicy {
  /** Files included in the SHA-256 hash. */
  included: ['node.yaml', 'node.interfaces.ts'];
  /** Files excluded — changes to these don't affect the hash. */
  excluded: ['node.layout.json', 'node.notes.md', 'node.diagram.mermaid'];
  /** Rationale: position and prose don't change architecture meaning. */
  rationale: string;
}
