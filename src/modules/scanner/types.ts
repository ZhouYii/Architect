// ─── Scanner Plugin Interface ─────────────────────────────────────────────────
//
// Re-exports the CodeGraph types from the store and defines the functional
// ScannerPlugin interface that every scanner implementation must satisfy.

export type { CodeGraph, CodeGraphNode, CodeGraphEdge } from '../store/types.js';

import type { CodeGraph } from '../store/types.js';

/**
 * A ScannerPlugin knows how to analyse a project path and produce a CodeGraph.
 * Adding a new language scanner = implementing this interface in one file.
 */
export interface ScannerPlugin {
  /** Unique identifier, e.g. "dependency-cruiser" or "lsp". */
  readonly id: string;
  /** Human-readable display name. */
  readonly name: string;
  /**
   * Returns true when this plugin is applicable to the given project path.
   * The registry calls this to pick the right plugin automatically.
   */
  canHandle(projectPath: string): Promise<boolean>;
  /**
   * Analyse the project and return a CodeGraph.
   * Implementations should never throw — return an empty graph + warn on failure.
   */
  scan(projectPath: string): Promise<CodeGraph>;
}
