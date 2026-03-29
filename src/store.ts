import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
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
} from './types';

let idCounter = 0;
export function genId(): ID {
  return `id_${Date.now()}_${++idCounter}`;
}

interface DesignStore {
  // Workspace
  workspacePath: string | null;
  config: WorkspaceConfig | null;
  state: WorkspaceState | null;

  // Canvas tree
  nodes: Record<ID, CanvasNode>;
  currentPath: ID;
  breadcrumb: BreadcrumbItem[];
  selectedBlockId: ID | null;
  selectedArrowId: ID | null;

  // Dirty tracking
  dirty: boolean;
  version: string;
  lastCheckpoint: number;

  // Diff / merge
  diffEntries: DiffEntry[];
  showMergeReview: boolean;

  // Chat (per-canvas)
  chatMessagesByCanvas: Record<ID, ChatMessage[]>;
  chatLoadingByCanvas: Record<ID, boolean>;
  chatUnreadByCanvas: Record<ID, boolean>;
  activeLLMProvider: string | null;

  // Available providers
  availableProviders: string[];

  // ACPs
  pendingACPs: ACP[];

  // Actions — workspace
  setWorkspacePath: (path: string) => void;
  setConfig: (config: WorkspaceConfig) => void;
  setState: (state: WorkspaceState) => void;
  setVersion: (version: string) => void;

  // Actions — navigation
  navigateTo: (canvasId: ID) => void;
  navigateUp: () => void;

  // Actions — selection
  selectBlock: (id: ID | null) => void;
  selectArrow: (id: ID | null) => void;

  // Actions — blocks
  addBlock: (block: Block) => void;
  updateBlock: (blockId: ID, updates: Partial<Block>) => void;
  removeBlock: (blockId: ID) => void;
  updateBlockPosition: (blockId: ID, position: Position) => void;

  // Actions — arrows
  addArrow: (arrow: Arrow) => void;
  updateArrow: (arrowId: ID, updates: Partial<Arrow>) => void;
  removeArrow: (arrowId: ID) => void;

  // Actions — canvas tree
  loadNodes: (nodes: Record<ID, CanvasNode>) => void;
  createChildCanvas: (parentCanvasId: ID, blockId: ID) => void;
  addBlockToCanvas: (canvasId: ID, block: Block) => void;
  addArrowToCanvas: (canvasId: ID, arrow: Arrow) => void;

  // Actions — layout
  setCanvasLayout: (layout: CanvasLayout) => void;

  // Actions — dirty
  markDirty: () => void;
  markClean: (hash: string) => void;

  // Actions — diff/merge
  setDiffEntries: (entries: DiffEntry[]) => void;
  setShowMergeReview: (show: boolean) => void;
  acceptDiffEntry: (index: number) => void;
  rejectDiffEntry: (index: number) => void;

  // Actions — chat
  addChatMessage: (message: ChatMessage) => void;
  addChatMessageToCanvas: (canvasId: ID, message: ChatMessage) => void;
  updateChatMessage: (messageId: ID, updates: Partial<ChatMessage>) => void;
  updateChatMessageInCanvas: (canvasId: ID, messageId: ID, updates: Partial<ChatMessage>) => void;
  setChatLoading: (canvasId: ID, loading: boolean) => void;
  clearUnread: (canvasId: ID) => void;
  setActiveLLMProvider: (provider: string | null) => void;

  // Actions — available providers
  setAvailableProviders: (providers: string[]) => void;

  // Actions — ACP
  addPendingACP: (acp: ACP) => void;
  resolveACP: (acpId: ID, status: 'accepted' | 'dismissed') => void;
}

// Demo data for Phase 0
function createDemoData(): Record<ID, CanvasNode> {
  return {
    root: {
      id: 'root',
      label: 'System Overview',
      parentId: null,
      components: [
        {
          id: 'game-server',
          label: 'Game Server',
          ports: [
            { id: 'gs-in', label: 'requests', direction: 'entry' },
            { id: 'gs-out', label: 'responses', direction: 'exit' },
          ],
          hasChildren: true,
        },
        {
          id: 'client',
          label: 'Client App',
          ports: [
            { id: 'cl-out', label: 'API calls', direction: 'exit' },
            { id: 'cl-in', label: 'updates', direction: 'entry' },
          ],
          hasChildren: true,
        },
        {
          id: 'database',
          label: 'Database',
          annotation: 'PostgreSQL cluster',
          ports: [
            { id: 'db-in', label: 'queries', direction: 'entry' },
            { id: 'db-out', label: 'results', direction: 'exit' },
          ],
          hasChildren: false,
        },
      ],
      connections: [
        { id: 'arr-1', from: 'client', to: 'game-server', label: 'HTTP/WS' },
        { id: 'arr-2', from: 'game-server', to: 'database', label: 'SQL' },
      ],
      layout: {
        'game-server': { x: 400, y: 200 },
        client: { x: 50, y: 200 },
        database: { x: 750, y: 200 },
      },
    },
    'game-server': {
      id: 'game-server',
      label: 'Game Server',
      parentId: 'root',
      components: [
        {
          id: 'gacha-service',
          label: 'Gacha Service',
          ports: [
            { id: 'ga-in', label: 'pull request', direction: 'entry' },
            { id: 'ga-out', label: 'result', direction: 'exit' },
          ],
          hasChildren: false,
        },
        {
          id: 'inventory-service',
          label: 'Inventory Service',
          ports: [
            { id: 'inv-in', label: 'items', direction: 'entry' },
          ],
          hasChildren: false,
        },
      ],
      connections: [
        { id: 'arr-3', from: 'gacha-service', to: 'inventory-service', label: 'grant item' },
      ],
      layout: {
        'gacha-service': { x: 100, y: 150 },
        'inventory-service': { x: 450, y: 150 },
      },
    },
    client: {
      id: 'client',
      label: 'Client App',
      parentId: 'root',
      components: [
        {
          id: 'ui-layer',
          label: 'UI Layer',
          ports: [{ id: 'ui-out', label: 'events', direction: 'exit' }],
          hasChildren: false,
        },
        {
          id: 'api-client',
          label: 'API Client',
          ports: [
            { id: 'api-in', label: 'requests', direction: 'entry' },
            { id: 'api-out', label: 'responses', direction: 'exit' },
          ],
          hasChildren: false,
        },
      ],
      connections: [
        { id: 'arr-4', from: 'ui-layer', to: 'api-client', label: 'dispatch' },
      ],
      layout: {
        'ui-layer': { x: 100, y: 150 },
        'api-client': { x: 400, y: 150 },
      },
    },
  };
}

export const useDesignStore = create<DesignStore>()(
  subscribeWithSelector(immer((set, get) => ({
    workspacePath: null,
    config: null,
    state: null,
    nodes: createDemoData(),
    currentPath: 'root',
    breadcrumb: [{ canvasId: 'root', label: 'System Overview' }],
    selectedBlockId: null,
    selectedArrowId: null,
    dirty: false,
    version: '1.0',
    lastCheckpoint: 1,
    diffEntries: [],
    showMergeReview: false,
    chatMessagesByCanvas: {},
    chatLoadingByCanvas: {},
    chatUnreadByCanvas: {},
    activeLLMProvider: null,
    availableProviders: [],
    pendingACPs: [],

    setWorkspacePath: (path) =>
      set((s) => { s.workspacePath = path; }),

    setConfig: (config) =>
      set((s) => { s.config = config; }),

    setState: (state) =>
      set((s) => { s.state = state; }),

    setVersion: (version) =>
      set((s) => { s.version = version; }),

    navigateTo: (canvasId) =>
      set((s) => {
        const node = s.nodes[canvasId];
        if (!node) return;
        s.currentPath = canvasId;
        s.selectedBlockId = null;
        s.selectedArrowId = null;
        // Don't clear unread on navigation — only clear when user sends a reply
        // Build breadcrumb by walking up
        const crumbs: BreadcrumbItem[] = [];
        let current: CanvasNode | undefined = node;
        while (current) {
          crumbs.unshift({ canvasId: current.id, label: current.label });
          current = current.parentId ? s.nodes[current.parentId] : undefined;
        }
        s.breadcrumb = crumbs;
      }),

    navigateUp: () => {
      const { breadcrumb, nodes } = get();
      if (breadcrumb.length <= 1) return;
      const parentId = nodes[get().currentPath]?.parentId;
      if (parentId) get().navigateTo(parentId);
    },

    selectBlock: (id) =>
      set((s) => { s.selectedBlockId = id; s.selectedArrowId = null; }),

    selectArrow: (id) =>
      set((s) => { s.selectedArrowId = id; s.selectedBlockId = null; }),

    addBlock: (block) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.components.push(block);
        canvas.layout[block.id] = { x: 200, y: 200 };
        s.dirty = true;
      }),

    updateBlock: (blockId, updates) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        const idx = canvas.components.findIndex((b) => b.id === blockId);
        if (idx === -1) return;
        Object.assign(canvas.components[idx], updates);
        s.dirty = true;
      }),

    removeBlock: (blockId) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.components = canvas.components.filter((b) => b.id !== blockId);
        canvas.connections = canvas.connections.filter(
          (a) => a.from !== blockId && a.to !== blockId,
        );
        delete canvas.layout[blockId];
        if (s.selectedBlockId === blockId) s.selectedBlockId = null;
        // Remove child canvas if exists
        if (s.nodes[blockId]) delete s.nodes[blockId];
        s.dirty = true;
      }),

    updateBlockPosition: (blockId, position) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.layout[blockId] = position;
        s.dirty = true;
      }),

    addArrow: (arrow) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.connections.push(arrow);
        s.dirty = true;
      }),

    updateArrow: (arrowId, updates) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        const idx = canvas.connections.findIndex((a) => a.id === arrowId);
        if (idx === -1) return;
        Object.assign(canvas.connections[idx], updates);
        s.dirty = true;
      }),

    removeArrow: (arrowId) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.connections = canvas.connections.filter((a) => a.id !== arrowId);
        if (s.selectedArrowId === arrowId) s.selectedArrowId = null;
        s.dirty = true;
      }),

    loadNodes: (nodes) =>
      set((s) => {
        s.nodes = nodes;
        s.currentPath = 'root';
        s.breadcrumb = [{ canvasId: 'root', label: nodes.root?.label ?? 'Root' }];
        s.dirty = false;
      }),

    createChildCanvas: (parentCanvasId, blockId) =>
      set((s) => {
        const parent = s.nodes[parentCanvasId];
        if (!parent) return;
        const block = parent.components.find((b) => b.id === blockId);
        if (!block) return;
        block.hasChildren = true;
        s.nodes[blockId] = {
          id: blockId,
          label: block.label,
          parentId: parentCanvasId,
          components: [],
          connections: [],
          layout: {},
        };
        s.dirty = true;
      }),

    addBlockToCanvas: (canvasId, block) =>
      set((s) => {
        const canvas = s.nodes[canvasId];
        if (!canvas) return;
        canvas.components.push(block);
        canvas.layout[block.id] = { x: 200, y: 200 };
        s.dirty = true;
      }),

    addArrowToCanvas: (canvasId, arrow) =>
      set((s) => {
        const canvas = s.nodes[canvasId];
        if (!canvas) return;
        canvas.connections.push(arrow);
        s.dirty = true;
      }),

    setCanvasLayout: (layout) =>
      set((s) => {
        const canvas = s.nodes[s.currentPath];
        if (!canvas) return;
        canvas.layout = layout;
        s.dirty = true;
      }),

    markDirty: () =>
      set((s) => { s.dirty = true; }),

    markClean: (hash) =>
      set((s) => {
        s.dirty = false;
        if (s.state) {
          s.state.head_hash = hash;
          s.state.dirty = false;
          s.state.last_flush_at = new Date().toISOString();
        }
      }),

    setDiffEntries: (entries) =>
      set((s) => { s.diffEntries = entries; }),

    setShowMergeReview: (show) =>
      set((s) => { s.showMergeReview = show; }),

    acceptDiffEntry: (index) =>
      set((s) => {
        if (s.diffEntries[index]) s.diffEntries[index].accepted = true;
      }),

    rejectDiffEntry: (index) =>
      set((s) => {
        if (s.diffEntries[index]) s.diffEntries[index].accepted = false;
      }),

    addChatMessage: (message) =>
      set((s) => {
        const path = s.currentPath;
        if (!s.chatMessagesByCanvas[path]) s.chatMessagesByCanvas[path] = [];
        s.chatMessagesByCanvas[path].push(message);
      }),

    addChatMessageToCanvas: (canvasId, message) =>
      set((s) => {
        if (!s.chatMessagesByCanvas[canvasId]) s.chatMessagesByCanvas[canvasId] = [];
        s.chatMessagesByCanvas[canvasId].push(message);
        if (canvasId !== s.currentPath) {
          s.chatUnreadByCanvas[canvasId] = true;
        }
      }),

    updateChatMessage: (messageId, updates) =>
      set((s) => {
        const msgs = s.chatMessagesByCanvas[s.currentPath];
        if (!msgs) return;
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx !== -1) Object.assign(msgs[idx], updates);
      }),

    updateChatMessageInCanvas: (canvasId, messageId, updates) =>
      set((s) => {
        const msgs = s.chatMessagesByCanvas[canvasId];
        if (!msgs) return;
        const idx = msgs.findIndex((m) => m.id === messageId);
        if (idx !== -1) Object.assign(msgs[idx], updates);
      }),

    setChatLoading: (canvasId, loading) =>
      set((s) => { s.chatLoadingByCanvas[canvasId] = loading; }),

    clearUnread: (canvasId) =>
      set((s) => { s.chatUnreadByCanvas[canvasId] = false; }),

    setActiveLLMProvider: (provider) =>
      set((s) => { s.activeLLMProvider = provider; }),

    setAvailableProviders: (providers) =>
      set((s) => { s.availableProviders = providers; }),

    addPendingACP: (acp) =>
      set((s) => { s.pendingACPs.push(acp); }),

    resolveACP: (acpId, status) =>
      set((s) => {
        const acp = s.pendingACPs.find((a) => a.id === acpId);
        if (acp) acp.status = status;
      }),
  }))),
);

// Autosave: schedule flush whenever dirty becomes true
// Import is deferred to avoid circular dependency (flush imports store)
let flushWired = false;
export function wireAutosave() {
  if (flushWired) return;
  flushWired = true;
  import('./lib/flush').then(({ scheduleFlush }) => {
    useDesignStore.subscribe(
      (s) => s.dirty,
      (dirty) => { if (dirty) scheduleFlush(); },
    );
  });
}
