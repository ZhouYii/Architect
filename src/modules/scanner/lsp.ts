// ─── LSP Scanner Plugin (stub) ────────────────────────────────────────────────
//
// Placeholder for a future Language Server Protocol-based scanner.
// Returns an empty CodeGraph and logs a "not implemented" message.

import type { ScannerPlugin } from './types.js';
import type { CodeGraph } from '../store/types.js';

function emptyGraph(): CodeGraph {
  return { nodes: [], edges: [], scanned_at: new Date().toISOString() };
}

export const lspPlugin: ScannerPlugin = {
  id: 'lsp',
  name: 'LSP (Language Server Protocol)',

  async canHandle(_projectPath: string): Promise<boolean> {
    // Never selected automatically — must be explicitly requested.
    return false;
  },

  async scan(_projectPath: string): Promise<CodeGraph> {
    console.warn('[lsp] LSP scanner is not yet implemented. Returning empty graph.');
    return emptyGraph();
  },
};
