import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { CanvasNode, CodeGraph, DesignNode, UIState, ViewMode } from './types.js';
import { MOCK_CANVASES } from './mockData.js';

// ─── State Shape ──────────────────────────────────────────────────────────────

export interface DesignStoreState {
  canvases: Record<string, CanvasNode>;
  ui: UIState;
  code_graph: CodeGraph | null;
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
  },
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
  }))
);
