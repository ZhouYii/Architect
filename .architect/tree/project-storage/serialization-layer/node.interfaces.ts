// ── YAML Serialization Types ──

import type { CanvasNode, Block, Arrow, Port, CanvasLayout, WorkspaceConfig, WorkspaceState, ContractSet } from '../../../src/types';

// ── Serialization Function Signatures ──

/** Serialize a CanvasNode to on-disk YAML (node.yaml) */
export declare function serializeNodeYaml(canvas: CanvasNode): string;

/** Deserialize a node.yaml back to CanvasNode (without layout) */
export declare function deserializeNodeYaml(yaml: string): Omit<CanvasNode, 'layout'>;

/** Serialize canvas layout to JSON string */
export declare function serializeLayoutJson(layout: CanvasLayout): string;

/** Deserialize layout JSON string */
export declare function deserializeLayoutJson(json: string): CanvasLayout;

/** Serialize block interfaces content */
export declare function serializeInterfaces(block: Block): string;

/** Serialize block notes content */
export declare function serializeNotes(block: Block): string;

/** Serialize workspace.yaml */
export declare function serializeWorkspaceConfig(config: WorkspaceConfig): string;

/** Deserialize workspace.yaml with backward-compat migration */
export declare function deserializeWorkspaceConfig(yaml: string): WorkspaceConfig;

/** Serialize workspace.state.yaml */
export declare function serializeWorkspaceState(state: WorkspaceState): string;

/** Deserialize workspace.state.yaml */
export declare function deserializeWorkspaceState(yaml: string): WorkspaceState;

/** Build complete file list for all canvases */
export declare function serializeTreeToFiles(
  nodes: Record<string, CanvasNode>,
): Array<{ path: string; content: string }>;

// ── Mermaid Types ──

/** Mermaid shape delimiters by BlockType */
export const BLOCK_TYPE_SHAPES: Record<string, [string, string]> = {
  'service': ['[[', ']]'],
  'module': ['[', ']'],
  'class': ['[/', '/]'],
  'function': ['(', ')'],
  'data-store': ['[(', ')]'],
  'external': ['{{', '}}'],
  'queue': ['[/', '\\]'],
  'config': ['>', ']'],
};

/** Generate a Mermaid diagram from a canvas */
export declare function generateMermaidDiagram(canvas: CanvasNode): string;

// ── Internal helpers (not exported from source, documented for reference) ──

/** Normalize legacy port directions: 'in' -> 'entry', 'out' -> 'exit' */
// function normalizeDirection(dir: string): 'entry' | 'exit';

/** Serialize a ContractSet, omitting empty arrays. Returns undefined if all empty. */
// function serializeContractSet(c: ContractSet | undefined): Record<string, unknown> | undefined;

/** Serialize a Port to plain object */
// function serializePort(p: Port): Record<string, unknown>;

/** Build directory path for a canvas: walks parentId chain to root */
// function buildCanvasPath(nodes: Record<string, CanvasNode>, canvasId: string): string;

/** Sanitize ID for Mermaid: replace non-alphanumeric with underscore */
// function mermaidId(id: string): string;

// ── Rust IPC FileEntry (from src-tauri/src/commands.rs) ──

export interface FileEntry {
  path: string;
  content: string;
}
