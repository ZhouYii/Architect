import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  AgentChangeset,
  CanvasNode,
  ChatMessage,
  CodeGraph,
  DesignNode,
  MergeConflict,
  TrackInfo,
  UIState,
  ViewMode,
} from './types.js';
import { MOCK_CANVASES } from './mockData.js';

// ─── State Shape ──────────────────────────────────────────────────────────────

export interface DesignStoreState {
  canvases: Record<string, CanvasNode>;
  ui: UIState;
  code_graph: CodeGraph | null;
  // Phase 4: agent changesets
  agent_changesets: AgentChangeset[];
  // Phase 4: per-canvas chat
  chatMessagesByCanvas: Record<string, ChatMessage[]>;
  chatLoadingByCanvas: Record<string, boolean>;
  // Phase 4: selected provider id
  selectedProviderId: string;
  // Phase 5: design tracks
  active_track: string | null;    // null = main branch
  tracks: TrackInfo[];
  merge_conflicts: MergeConflict[];
}

// ─── Actions Shape ────────────────────────────────────────────────────────────

export interface DesignStoreActions {
  // Node mutations
  addBlock: (canvasId: string, node: DesignNode) => void;
  removeBlock: (canvasId: string, nodeId: string) => void;
  updateBlock: (canvasId: string, nodeId: string, patch: Partial<DesignNode>) => void;
  addArrow: (canvasId: string, arrow: DesignNode) => void;
  removeArrow: (canvasId: string, arrowId: string) => void;

  // Navigation
  navigateTo: (canvasId: string) => void;
  navigateUp: () => void;
  navigateToIndex: (index: number) => void;

  // Selection
  selectNode: (nodeId: string | null) => void;

  // Side panel
  setSidePanelTab: (tab: UIState['side_panel_tab']) => void;
  setSidePanelOpen: (open: boolean) => void;

  // View mode & code graph
  setViewMode: (mode: ViewMode) => void;
  setCodeGraph: (graph: CodeGraph | null) => void;

  // Delta mode
  toggleDeltaMode: () => void;

  // Versioning
  setVersion: (version: string, majorVersion: number, majorHash: string) => void;
  resetDirtyNodes: () => void;

  // Workspace bulk-load
  loadCanvases: (canvases: Record<string, CanvasNode>, currentPath: string[]) => void;

  // Phase 4: Agent Changesets
  addChangeset: (cs: AgentChangeset) => void;
  removeChangeset: (id: string) => void;
  addChangesetFeedback: (changesetId: string, message: string) => void;

  // Phase 4: Chat
  addChatMessage: (canvasId: string, msg: ChatMessage) => void;
  setChatLoading: (canvasId: string, loading: boolean) => void;
  clearChat: (canvasId: string) => void;

  // Phase 4: Provider selection
  setSelectedProvider: (id: string) => void;

  // Phase 5: Track management
  setActiveTrack: (name: string | null) => void;
  setTracks: (tracks: TrackInfo[]) => void;
  setMergeConflicts: (conflicts: MergeConflict[]) => void;
  resolveMergeConflict: (nodeId: string, canvasId: string, resolution: 'main' | 'track') => void;
}

export type DesignStore = DesignStoreState & DesignStoreActions;

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL_STATE: DesignStoreState = {
  canvases: MOCK_CANVASES,
  code_graph: null,
  ui: {
    selected_node_id: null,
    current_path: ['root'],
    side_panel_tab: 'inspector',
    is_side_panel_open: true,
    view_mode: 'conceptual',
    delta_mode: false,
    version: '1.0',
    last_major_version: 0,
    last_major_hash: '',
  },
  // Phase 4
  agent_changesets: [],
  chatMessagesByCanvas: {},
  chatLoadingByCanvas: {},
  selectedProviderId: 'mock',
  // Phase 5
  active_track: null,
  tracks: [],
  merge_conflicts: [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDesignStore = create<DesignStore>()(
  immer((set) => ({
    ...INITIAL_STATE,

    // ── Block mutations ────────────────────────────────────────────────────

    addBlock: (canvasId, node) =>
      set((state) => {
        const canvas = state.canvases[canvasId];
        if (canvas) {
          canvas.components.push(node);
        }
      }),

    removeBlock: (canvasId, nodeId) =>
      set((state) => {
        const canvas = state.canvases[canvasId];
        if (canvas) {
          canvas.components = canvas.components.filter((n) => n.id !== nodeId);
          // Remove any arrows referencing this block
          canvas.connections = canvas.connections.filter(
            (a) => a.source !== nodeId && a.target !== nodeId
          );
        }
      }),

    updateBlock: (canvasId, nodeId, patch) =>
      set((state) => {
        const canvas = state.canvases[canvasId];
        if (!canvas) return;
        const idx = canvas.components.findIndex((n) => n.id === nodeId);
        if (idx !== -1) {
          Object.assign(canvas.components[idx], patch);
        }
      }),

    // ── Arrow mutations ────────────────────────────────────────────────────

    addArrow: (canvasId, arrow) =>
      set((state) => {
        const canvas = state.canvases[canvasId];
        if (canvas) {
          canvas.connections.push(arrow);
        }
      }),

    removeArrow: (canvasId, arrowId) =>
      set((state) => {
        const canvas = state.canvases[canvasId];
        if (canvas) {
          canvas.connections = canvas.connections.filter((a) => a.id !== arrowId);
        }
      }),

    // ── Navigation ────────────────────────────────────────────────────────

    navigateTo: (canvasId) =>
      set((state) => {
        if (state.canvases[canvasId]) {
          state.ui.current_path.push(canvasId);
          state.ui.selected_node_id = null;
        }
      }),

    navigateUp: () =>
      set((state) => {
        if (state.ui.current_path.length > 1) {
          state.ui.current_path.pop();
          state.ui.selected_node_id = null;
        }
      }),

    navigateToIndex: (index) =>
      set((state) => {
        if (index >= 0 && index < state.ui.current_path.length) {
          state.ui.current_path = state.ui.current_path.slice(0, index + 1);
          state.ui.selected_node_id = null;
        }
      }),

    // ── Selection ─────────────────────────────────────────────────────────

    selectNode: (nodeId) =>
      set((state) => {
        state.ui.selected_node_id = nodeId;
        if (nodeId !== null) {
          state.ui.is_side_panel_open = true;
        }
      }),

    // ── Side panel ────────────────────────────────────────────────────────

    setSidePanelTab: (tab) =>
      set((state) => {
        state.ui.side_panel_tab = tab;
      }),

    setSidePanelOpen: (open) =>
      set((state) => {
        state.ui.is_side_panel_open = open;
      }),

    // ── View mode & code graph ─────────────────────────────────────────────

    setViewMode: (mode) =>
      set((state) => {
        state.ui.view_mode = mode;
      }),

    setCodeGraph: (graph) =>
      set((state) => {
        state.code_graph = graph;
      }),

    // ── Delta mode ────────────────────────────────────────────────────────

    toggleDeltaMode: () =>
      set((state) => {
        state.ui.delta_mode = !state.ui.delta_mode;
      }),

    // ── Versioning ────────────────────────────────────────────────────────

    setVersion: (version, majorVersion, majorHash) =>
      set((state) => {
        state.ui.version = version;
        state.ui.last_major_version = majorVersion;
        state.ui.last_major_hash = majorHash;
      }),

    resetDirtyNodes: () =>
      set((state) => {
        for (const canvas of Object.values(state.canvases)) {
          for (const node of canvas.components) {
            if (node.status === 'modified' || node.status === 'implemented') {
              node.status = 'clean';
            }
          }
          for (const arrow of canvas.connections) {
            if (arrow.status === 'modified' || arrow.status === 'implemented') {
              arrow.status = 'clean';
            }
          }
        }
      }),

    // ── Workspace bulk-load ───────────────────────────────────────────────

    loadCanvases: (canvases, currentPath) =>
      set((state) => {
        state.canvases = canvases;
        state.ui.current_path = currentPath;
        state.ui.selected_node_id = null;
      }),

    // ── Phase 4: Agent Changesets ─────────────────────────────────────────

    addChangeset: (cs) =>
      set((state) => {
        state.agent_changesets.push(cs);
      }),

    removeChangeset: (id) =>
      set((state) => {
        state.agent_changesets = state.agent_changesets.filter((c) => c.id !== id);
      }),

    addChangesetFeedback: (changesetId, message) =>
      set((state) => {
        const cs = state.agent_changesets.find((c) => c.id === changesetId);
        if (cs) {
          if (!cs.feedback) cs.feedback = {};
          const key = `fb-${Date.now()}`;
          cs.feedback[key] = message;
        }
      }),

    // ── Phase 4: Chat ─────────────────────────────────────────────────────

    addChatMessage: (canvasId, msg) =>
      set((state) => {
        if (!state.chatMessagesByCanvas[canvasId]) {
          state.chatMessagesByCanvas[canvasId] = [];
        }
        state.chatMessagesByCanvas[canvasId].push(msg);
      }),

    setChatLoading: (canvasId, loading) =>
      set((state) => {
        state.chatLoadingByCanvas[canvasId] = loading;
      }),

    clearChat: (canvasId) =>
      set((state) => {
        state.chatMessagesByCanvas[canvasId] = [];
      }),

    // ── Phase 4: Provider selection ───────────────────────────────────────

    setSelectedProvider: (id) =>
      set((state) => {
        state.selectedProviderId = id;
      }),

    // ── Phase 5: Track management ─────────────────────────────────────────

    setActiveTrack: (name) =>
      set((state) => {
        state.active_track = name;
      }),

    setTracks: (tracks) =>
      set((state) => {
        state.tracks = tracks;
      }),

    setMergeConflicts: (conflicts) =>
      set((state) => {
        state.merge_conflicts = conflicts;
      }),

    resolveMergeConflict: (nodeId, canvasId, resolution) =>
      set((state) => {
        const conflict = state.merge_conflicts.find(
          (c) => c.node_id === nodeId && c.canvas_id === canvasId
        );
        if (conflict) {
          conflict.resolution = resolution;
        }
      }),
  }))
);
