// ── Zustand Store Interface ──

import type {
  ID,
  Block,
  Arrow,
  CanvasNode,
  CanvasLayout,
  BreadcrumbItem,
  WorkspaceConfig,
  WorkspaceState,
  Position,
  DiffEntry,
  ChatMessage,
  ACP,
} from '../../../src/types';

/**
 * The complete Zustand store interface.
 * Extracted from src/store.ts DesignStore interface.
 */
export interface DesignStore {
  // ── State Slices ──

  /** Absolute path to the workspace root (null if not loaded) */
  workspacePath: string | null;
  /** Workspace configuration from workspace.yaml */
  config: WorkspaceConfig | null;
  /** Workspace runtime state from workspace.state.yaml */
  state: WorkspaceState | null;

  /** Complete canvas hierarchy: canvasId -> CanvasNode */
  nodes: Record<ID, CanvasNode>;
  /** Currently displayed canvas ID */
  currentPath: ID;
  /** Breadcrumb path from root to current canvas */
  breadcrumb: BreadcrumbItem[];
  /** Currently selected block ID (mutually exclusive with selectedArrowId) */
  selectedBlockId: ID | null;
  /** Currently selected arrow ID (mutually exclusive with selectedBlockId) */
  selectedArrowId: ID | null;

  /** Whether the store has unsaved changes */
  dirty: boolean;
  /** Current version string (e.g., "1.14") */
  version: string;
  /** Last checkpoint number */
  lastCheckpoint: number;

  /** Diff entries for merge review overlay */
  diffEntries: DiffEntry[];
  /** Whether the merge review overlay is visible */
  showMergeReview: boolean;

  /** Chat message history */
  chatMessages: ChatMessage[];
  /** Whether an LLM request is in flight */
  chatLoading: boolean;
  /** Currently active LLM provider name */
  activeLLMProvider: string | null;

  /** Pending Architecture Change Proposals */
  pendingACPs: ACP[];

  // ── Actions ──

  setWorkspacePath: (path: string) => void;
  setConfig: (config: WorkspaceConfig) => void;
  setState: (state: WorkspaceState) => void;
  setVersion: (version: string) => void;

  navigateTo: (canvasId: ID) => void;
  navigateUp: () => void;

  selectBlock: (id: ID | null) => void;
  selectArrow: (id: ID | null) => void;

  addBlock: (block: Block) => void;
  updateBlock: (blockId: ID, updates: Partial<Block>) => void;
  removeBlock: (blockId: ID) => void;
  updateBlockPosition: (blockId: ID, position: Position) => void;

  addArrow: (arrow: Arrow) => void;
  updateArrow: (arrowId: ID, updates: Partial<Arrow>) => void;
  removeArrow: (arrowId: ID) => void;

  loadNodes: (nodes: Record<ID, CanvasNode>) => void;
  createChildCanvas: (parentCanvasId: ID, blockId: ID) => void;
  addBlockToCanvas: (canvasId: ID, block: Block) => void;
  addArrowToCanvas: (canvasId: ID, arrow: Arrow) => void;

  setCanvasLayout: (layout: CanvasLayout) => void;

  markDirty: () => void;
  markClean: (hash: string) => void;

  setDiffEntries: (entries: DiffEntry[]) => void;
  setShowMergeReview: (show: boolean) => void;
  acceptDiffEntry: (index: number) => void;
  rejectDiffEntry: (index: number) => void;

  addChatMessage: (message: ChatMessage) => void;
  updateChatMessage: (messageId: ID, updates: Partial<ChatMessage>) => void;
  setChatLoading: (loading: boolean) => void;
  setActiveLLMProvider: (provider: string | null) => void;

  addPendingACP: (acp: ACP) => void;
  resolveACP: (acpId: ID, status: 'accepted' | 'dismissed') => void;
}

/** ID generator: "id_{timestamp}_{counter}" */
export function genId(): ID {
  // Implementation: Date.now() + incrementing module-level counter
  return `id_${Date.now()}_${0}`;
}
