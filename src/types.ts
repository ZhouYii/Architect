export type ID = string;

// ─── Enums ───

export type BlockType = 'service' | 'module' | 'class' | 'function' | 'data-store' | 'external' | 'queue' | 'config';
export type Status = 'draft' | 'approved' | 'implementing' | 'done' | 'deprecated';
export type ArrowType = 'calls' | 'reads' | 'writes' | 'publishes' | 'subscribes' | 'depends';

// ─── Shared structures ───

export interface Position {
  x: number;
  y: number;
}

export interface Meta {
  modified_by: string;
  modified_at: string;
  reason?: string;
}

export interface SourceMap {
  files: string[];
  entry_point: string;
}

// ─── Contracts (PRD §5) ───

export interface ContractImpl {
  file: string;
  symbol: string;
  test_file?: string;
  test_symbol?: string;
}

export interface ContractEntry {
  id: ID;
  description: string;
  expression?: string;
  status?: 'draft' | 'implemented' | 'verified';
  impl?: ContractImpl;
}

export interface TestCase {
  id: ID;
  name: string;
  description?: string;
  inputs: Record<string, unknown>;
  expectedOutputs: Record<string, unknown>;
  status?: 'draft' | 'implemented' | 'verified';
  impl?: ContractImpl;
}

export interface ContractSet {
  invariants: ContractEntry[];
  preconditions: ContractEntry[];
  postconditions: ContractEntry[];
  test_cases: TestCase[];
}

// ─── Port (PRD §4) ───

export interface Port {
  id: ID;
  label: string;
  direction: 'entry' | 'exit';
  type?: string;
  parent_arrow?: ID;
  bound_to?: ID;
  annotation?: string;
  contract?: ContractSet;
}

// ─── Block (PRD §2.1) ───

export interface Block {
  id: ID;
  label: string;
  type?: BlockType;
  status?: Status;
  hasChildren: boolean;
  annotation?: string;
  tags?: string[];
  interfacesContent?: string;
  notesContent?: string;
  ports: Port[];
  contract?: ContractSet;
  source_map?: SourceMap;
  _meta?: Meta;
}

// ─── Arrow (PRD §2.2) ───

export interface ArrowInterface {
  request?: string;
  response?: string;
  async?: boolean;
  error_handling?: 'throw' | 'rollback' | 'retry' | 'ignore';
  protocol?: 'rpc' | 'event' | 'stream' | 'http';
}

export interface Arrow {
  id: ID;
  from: ID;
  fromPort?: ID;
  to: ID;
  toPort?: ID;
  label?: string;
  type?: ArrowType;
  direction?: 'forward' | 'backward' | 'bidirectional';
  order?: number;
  weight?: 'normal' | 'bold';
  interface?: ArrowInterface;
  contract?: ContractSet;
  annotation?: string;
  protocol?: string;
  _meta?: Meta;
}

// ─── Canvas / Node (PRD §2.3) ───

export interface Group {
  id: ID;
  label: string;
  members: ID[];
}

export interface CanvasLayout {
  [blockId: string]: Position;
}

export interface CanvasNode {
  id: ID;
  label: string;
  parentId: ID | null;
  type?: string;
  status?: Status;
  owner?: string;
  created_at?: string;
  last_modified?: string;
  components: Block[];
  connections: Arrow[];
  layout: CanvasLayout;
  ports?: Port[];
  groups?: Group[];
}

// ─── Workspace ───

export interface WorkspaceConfig {
  schema_version: number;
  project_name: string;
  created_at: string;
  last_checkpoint: string;
  last_checkpoint_at?: string;
  last_checkpoint_hash: string;
  llm: {
    preferred_provider: string;
    ollama_model: string;
  };
}

export interface WorkspaceState {
  version: string;
  head_hash: string;
  dirty: boolean;
  pending_changes: number;
  last_flush_at: string;
  agent_sessions?: AgentSession[];
}

export interface AgentSession {
  agent: string;
  session_id: string;
  started_at: string;
  changes_proposed: number;
  changes_accepted: number;
}

export interface BreadcrumbItem {
  canvasId: ID;
  label: string;
}

// ─── ACP (PRD §10) ───

export type ACPKind =
  | 'add_component' | 'remove_component' | 'modify_component'
  | 'add_block' | 'remove_block' | 'modify_block'
  | 'add_arrow' | 'remove_arrow' | 'modify_arrow'
  | 'decompose' | 'refine_arrow' | 'restructure';

export interface ACPChange {
  kind: ACPKind;
  target_canvas: ID;
  target_id?: ID;
  reason: string;
  proposal: Record<string, unknown>;
}

export interface ACP {
  id: ID;
  description: string;
  changes: ACPChange[];
  status: 'pending' | 'accepted' | 'dismissed';
  timestamp: string;
  agent?: string;
  session?: 'co-design' | 'implementation';
  based_on_checkpoint?: string;
}

// ─── Diff (PRD §9) ───

export type DiffType = 'added' | 'removed' | 'modified' | 'decomposed' | 'moved' | 'rebound';
export type DiffCategory = 'component' | 'connection' | 'interface_type' | 'port' | 'contract_entry';

export interface DiffEntry {
  type: DiffType;
  entity: 'block' | 'arrow';
  canvasId: ID;
  id: ID;
  label: string;
  before?: Block | Arrow;
  after?: Block | Arrow;
  fields?: string[];
  accepted?: boolean;
  category?: DiffCategory;
  node_path?: string;
  element_id?: ID;
  source?: 'acp' | 'direct_edit';
  acp_file?: string;
  agent?: string;
  timestamp?: string;
}

// ─── Chat ───

export interface ChatMessage {
  id: ID;
  role: 'user' | 'assistant';
  content: string;
  proposals?: ACP[];
  timestamp: string;
}
