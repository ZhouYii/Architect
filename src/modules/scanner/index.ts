// ─── Scanner Registry ─────────────────────────────────────────────────────────
//
// Maintains the ordered list of scanner plugins and exposes a single `scan()`
// entry point that picks the first applicable plugin for a given project path.

export type { ScannerPlugin } from './types.js';
export type { CodeGraph, CodeGraphNode, CodeGraphEdge } from './types.js';

import type { ScannerPlugin } from './types.js';
import type { CodeGraph } from '../store/types.js';
import { dependencyCruiserPlugin } from './dependency-cruiser.js';
import { lspPlugin } from './lsp.js';

// ─── Plugin registry (priority order) ────────────────────────────────────────

const PLUGINS: ScannerPlugin[] = [
  dependencyCruiserPlugin,
  lspPlugin,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Scan a project directory and return a CodeGraph.
 *
 * The registry tries each registered plugin in priority order, calling
 * `canHandle()` to select the first applicable one. If no plugin matches,
 * returns an empty graph.
 */
export async function scan(projectPath: string): Promise<CodeGraph> {
  for (const plugin of PLUGINS) {
    if (await plugin.canHandle(projectPath)) {
      console.info(`[scanner] Using plugin '${plugin.name}' for: ${projectPath}`);
      return plugin.scan(projectPath);
    }
  }

  console.warn('[scanner] No applicable plugin found. Returning empty graph.');
  return { nodes: [], edges: [], scanned_at: new Date().toISOString() };
}

/**
 * Register a custom plugin at the front of the registry (highest priority).
 * Useful for tests or external language extensions.
 */
export function registerPlugin(plugin: ScannerPlugin): void {
  PLUGINS.unshift(plugin);
}
