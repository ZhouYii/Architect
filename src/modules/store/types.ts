// ─── Core Enums / Literals ────────────────────────────────────────────────────

export type NodeStatus =
  | 'clean'
  | 'modified'
  | 'proposed'
  | 'ready'
  | 'running'
  | 'implemented'
  | 'failed'
  | 'dismissed';

export type BlockType =
  | 'service'
  | 'module'
  | 'class'
  | 'function'
  | 'data-store'
  | 'external'
  | 'queue'
  | 'config';

export type ArrowType =
  | 'calls'
  | 'reads'
  | 'writes'
  | 'publishes'
  | 'subscribes'
  | 'depends';

export type ChangesetLevel = 'block' | 'canvas' | 'workspace';

export type ImplTaskStatus = 'pending' | 'running' | 'done' | 'failed';

// ─── Design Nodes ─────────────────────────────────────────────────────────────

export interface CodeLink {
  file: string;
  line_start?: number;
  line_end?: number;
  symbol?: string;
}

export interface ContractEntry {
  id: string;
  description: string;
  satisfied: boolean;
}

export interface TestCase {
  id: string;
  name: string;
  status: 'pass' | 'fail' | 'skip' | 'unknown';
}

export interface ImplRef {
  canvas_path: string;
  node_id: string;
}

export interface ArrowInterface {
  request_schema?: string;
  response_schema?: string;
  description?: string;
}

export interface Contract {
  invariants: ContractEntry[];
  test_cases: TestCase[];
}

export interface DesignNode {
  id: string;
  kind: 'block' | 'arrow';
  status: NodeStatus;
  // Block-specific
  block_type?: BlockType;
  name: string;
  annotation?: string;
  has_children?: boolean;
  child_canvas_id?: string;
  contract?: Contract;
  code_links?: CodeLink[];
  impl_ref?: ImplRef;
  // Arrow-specific
  source?: string;
  target?: string;
  arrow_type?: ArrowType;
  label?: string;
  interface?: ArrowInterface;
  // Authorship
  agent_proposed?: boolean;
  author?: string;
  // Position (for layout persistence)
  x?: number;
  y?: number;
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export interface CanvasLayout {
  zoom?: number;
  pan_x?: number;
  pan_y?: number;
}

export interface CanvasNode {
  id: string;
  label: string;
  components: DesignNode[];   // blocks
  connections: DesignNode[];  // arrows
  layout?: CanvasLayout;
  narrative?: string;
  interfacesContent?: string;
  parent_canvas_id?: string;
}

// ─── Changesets ───────────────────────────────────────────────────────────────

export interface Changeset {
  id: string;
  level: ChangesetLevel;
  target_canvas_id?: string;
  target_node_id?: string;
  description: string;
  diff_snapshot?: string;
  created_at: string;
  applied: boolean;
}

// ─── Implementation ───────────────────────────────────────────────────────────

export interface AttemptLog {
  attempt: number;
  timestamp: string;
  result: 'success' | 'failure';
  message?: string;
  output?: string;
}

export interface ImplTask {
  id: string;
  canvas_id: string;
  node_id: string;
  status: ImplTaskStatus;
  attempts: AttemptLog[];
  created_at: string;
  updated_at: string;
}

export interface ImplSummary {
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
}

export interface ImplStatusFile {
  tasks: ImplTask[];
  summary: ImplSummary;
  last_updated: string;
}

// ─── Workspace ────────────────────────────────────────────────────────────────

export interface WorkspaceConfig {
  name: string;
  root_canvas_id: string;
  version: string;
  created_at: string;
}

export interface WorkspaceState {
  config: WorkspaceConfig | null;
  canvases: Record<string, CanvasNode>;
  changesets: Changeset[];
  impl_tasks: ImplTask[];
  is_loaded: boolean;
  workspace_path?: string;
}

// ─── Scanner / Code Graph ─────────────────────────────────────────────────────

export interface ScannerPlugin {
  id: string;
  name: string;
  language: string;
  enabled: boolean;
}

export interface CodeGraphNode {
  id: string;
  type: 'file' | 'class' | 'function' | 'module';
  name: string;
  path: string;
  line?: number;
}

export interface CodeGraphEdge {
  source: string;
  target: string;
  relationship: 'calls' | 'imports' | 'extends' | 'implements';
}

export interface CodeGraph {
  nodes: CodeGraphNode[];
  edges: CodeGraphEdge[];
  scanned_at: string;
}

// ─── Tracks (multi-track content system) ─────────────────────────────────────

export interface Track {
  id: string;
  name: string;
  canvas_ids: string[];
  color?: string;
  active: boolean;
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ViewMode = 'conceptual' | 'code';

export interface UIState {
  selected_node_id: string | null;
  current_path: string[];      // stack of canvas IDs, [0] = root
  side_panel_tab: 'inspector' | 'changesets' | 'chat';
  is_side_panel_open: boolean;
  view_mode: ViewMode;
}

// ─── Aggregate / Computed ─────────────────────────────────────────────────────

export interface StatusAggregate {
  clean: number;
  modified: number;
  proposed: number;
  ready: number;
  running: number;
  implemented: number;
  failed: number;
  dismissed: number;
  total: number;
}
