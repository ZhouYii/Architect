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

export type ImplTaskStatus = 'queued' | 'running' | 'done' | 'failed' | 'blocked' | 'escalated';

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

/** Proposed design node inside an AgentChangeset */
export interface ProposedNode {
  id: string;
  kind: 'block';
  block_type?: BlockType;
  name: string;
  status: 'proposed';
  annotation?: string;
  agent_proposed: true;
  x?: number;
  y?: number;
}

/** Changeset produced by an agent via the chat panel */
export interface AgentChangeset {
  id: string;
  title: string;
  agent: string;
  target_canvas_id: string;
  nodes: ProposedNode[];
  raw_response: string;
  created_at: string;
  /** Feedback messages keyed by nodeId */
  feedback?: Record<string, string>;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export type ChatRole = 'user' | 'agent';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  changeset_id?: string; // if this message contained a parsed changeset
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
  // Planning fields (Phase 6)
  title?: string;
  method?: string;
  type?: string;
  complexity?: string;
  design_node?: string;
  agent?: string;
  file?: string;
  test_file?: string;
  prompt?: string;
  correct_when?: string;
  depends_on?: string[];
  // Legacy fields
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

// ─── Tracks (design branches) ─────────────────────────────────────────────────

export interface TrackInfo {
  name: string;
  forked_from: number;   // last_major_version at fork time
  forked_at: string;     // ISO timestamp
  status: 'active' | 'merged' | 'archived';
  description?: string;
}

export interface MergeConflict {
  node_id: string;
  canvas_id: string;
  main_version: DesignNode;
  track_version: DesignNode;
  resolution?: 'main' | 'track';
}

// ─── UI State ─────────────────────────────────────────────────────────────────

export type ViewMode = 'conceptual' | 'code';

/** Phase 8: lifecycle phase of the implementation pipeline */
export type ImplPhase =
  | 'idle'
  | 'planning'
  | 'executing'
  | 'verifying'
  | 'complete';

export interface UIState {
  selected_node_id: string | null;
  current_path: string[];      // stack of canvas IDs, [0] = root
  side_panel_tab: 'inspector' | 'changesets' | 'chat';
  is_side_panel_open: boolean;
  view_mode: ViewMode;
  delta_mode: boolean;
  version: string;             // e.g. "1.0", "2.0"
  last_major_version: number;
  last_major_hash: string;
  // Phase 6: Implementation Drawer
  drawer_open: boolean;
  drawer_height: number;
  selected_task_id: string | null;
  impl_plan_id: string | null;
  // Phase 8: pipeline lifecycle + completion report
  impl_phase: ImplPhase;
  completion_report: string | null;
  // Phase 11: Command palette
  command_palette_open: boolean;
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
