import YAML from 'yaml';
import type { CanvasNode, Block, Arrow, Port, CanvasLayout, WorkspaceConfig, WorkspaceState, ContractSet } from '../types';

// Backward-compatible direction normalizer: 'in'→'entry', 'out'→'exit'
function normalizeDirection(dir: string): 'entry' | 'exit' {
  if (dir === 'in' || dir === 'entry') return 'entry';
  if (dir === 'out' || dir === 'exit') return 'exit';
  return dir as 'entry' | 'exit';
}

// Serialize a ContractSet, omitting empty arrays
function serializeContractSet(c: ContractSet | undefined): Record<string, unknown> | undefined {
  if (!c) return undefined;
  const out: Record<string, unknown> = {};
  if (c.invariants.length > 0) out.invariants = c.invariants;
  if (c.preconditions.length > 0) out.preconditions = c.preconditions;
  if (c.postconditions.length > 0) out.postconditions = c.postconditions;
  if (c.test_cases.length > 0) out.test_cases = c.test_cases;
  return Object.keys(out).length > 0 ? out : undefined;
}

// Serialize a port
function serializePort(p: Port): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: p.id,
    label: p.label,
    direction: p.direction,
  };
  if (p.type) out.type = p.type;
  if (p.parent_arrow) out.parent_arrow = p.parent_arrow;
  if (p.bound_to) out.bound_to = p.bound_to;
  if (p.annotation) out.annotation = p.annotation;
  if (p.contract) out.contract = serializeContractSet(p.contract);
  return out;
}

// Deserialize a port from YAML data with backward compat
function deserializePort(p: Record<string, unknown>): Port {
  const port: Port = {
    id: p.id as string,
    label: p.label as string,
    direction: normalizeDirection(p.direction as string),
  };
  if (p.type) port.type = p.type as string;
  if (p.parent_arrow) port.parent_arrow = p.parent_arrow as string;
  if (p.bound_to) port.bound_to = p.bound_to as string;
  if (p.annotation) port.annotation = p.annotation as string;
  if (p.contract) port.contract = deserializeContractSetData(p.contract as Record<string, unknown>);
  return port;
}

// Deserialize a ContractSet from raw YAML data
function deserializeContractSetData(data: Record<string, unknown> | undefined): ContractSet | undefined {
  if (!data) return undefined;
  return {
    invariants: (data.invariants as ContractSet['invariants']) ?? [],
    preconditions: (data.preconditions as ContractSet['preconditions']) ?? [],
    postconditions: (data.postconditions as ContractSet['postconditions']) ?? [],
    test_cases: (data.test_cases as ContractSet['test_cases']) ?? [],
  };
}

// Serialize a canvas node to the on-disk YAML format (node.yaml)
export function serializeNodeYaml(canvas: CanvasNode): string {
  const doc: Record<string, unknown> = {
    id: canvas.id,
    label: canvas.label,
    parent: canvas.parentId,
    components: canvas.components.map((b) => {
      const block: Record<string, unknown> = {
        id: b.id,
        label: b.label,
        has_children: b.hasChildren,
        ports: b.ports.map(serializePort),
      };
      if (b.type) block.type = b.type;
      if (b.status) block.status = b.status;
      if (b.annotation) block.annotation = b.annotation;
      if (b.tags && b.tags.length > 0) block.tags = b.tags;
      if (b.contract) block.contract = serializeContractSet(b.contract);
      if (b.source_map) block.source_map = b.source_map;
      if (b._meta) block._meta = b._meta;
      return block;
    }),
    connections: canvas.connections.map((a) => {
      const arrow: Record<string, unknown> = {
        id: a.id,
        from: a.from,
        to: a.to,
      };
      if (a.fromPort) arrow.from_port = a.fromPort;
      if (a.toPort) arrow.to_port = a.toPort;
      if (a.label) arrow.label = a.label;
      if (a.type) arrow.type = a.type;
      if (a.direction) arrow.direction = a.direction;
      if (a.order != null) arrow.order = a.order;
      if (a.weight) arrow.weight = a.weight;
      if (a.interface) arrow.interface = a.interface;
      if (a.contract) arrow.contract = serializeContractSet(a.contract);
      if (a.annotation) arrow.annotation = a.annotation;
      if (a.protocol) arrow.protocol = a.protocol;
      if (a._meta) arrow._meta = a._meta;
      return arrow;
    }),
  };
  if (canvas.ports && canvas.ports.length > 0) {
    doc.ports = canvas.ports.map(serializePort);
  }
  if (canvas.groups && canvas.groups.length > 0) {
    doc.groups = canvas.groups;
  }
  return YAML.stringify(doc);
}

// Serialize a canvas layout to JSON
export function serializeLayoutJson(layout: CanvasLayout): string {
  return JSON.stringify(layout, null, 2);
}

// Serialize interfaces content for a block
export function serializeInterfaces(block: Block): string {
  return block.interfacesContent ?? '// TypeScript interfaces\n';
}

// Serialize notes for a block
export function serializeNotes(block: Block): string {
  return block.notesContent ?? '';
}

// Deserialize a node.yaml back into a CanvasNode (partial — layout comes separately)
export function deserializeNodeYaml(yaml: string): Omit<CanvasNode, 'layout'> {
  const doc = YAML.parse(yaml);
  return {
    id: doc.id,
    label: doc.label,
    parentId: doc.parent ?? null,
    components: (doc.components ?? []).map((b: Record<string, unknown>): Block => {
      const block: Block = {
        id: b.id as string,
        label: b.label as string,
        hasChildren: !!b.has_children,
        ports: ((b.ports as Array<Record<string, unknown>>) ?? []).map(deserializePort),
      };
      if (b.type) block.type = b.type as Block['type'];
      if (b.status) block.status = b.status as Block['status'];
      if (b.annotation) block.annotation = b.annotation as string;
      if (b.tags) block.tags = b.tags as string[];
      if (b.contract) block.contract = deserializeContractSetData(b.contract as Record<string, unknown>);
      if (b.source_map) block.source_map = b.source_map as Block['source_map'];
      if (b._meta) block._meta = b._meta as Block['_meta'];
      return block;
    }),
    connections: (doc.connections ?? []).map((a: Record<string, unknown>): Arrow => {
      const arrow: Arrow = {
        id: a.id as string,
        from: a.from as string,
        to: a.to as string,
      };
      if (a.from_port) arrow.fromPort = a.from_port as string;
      if (a.to_port) arrow.toPort = a.to_port as string;
      if (a.label) arrow.label = a.label as string;
      if (a.type) arrow.type = a.type as Arrow['type'];
      if (a.direction) arrow.direction = a.direction as Arrow['direction'];
      if (a.order != null) arrow.order = a.order as number;
      if (a.weight) arrow.weight = a.weight as Arrow['weight'];
      if (a.interface) arrow.interface = a.interface as Arrow['interface'];
      if (a.contract) arrow.contract = deserializeContractSetData(a.contract as Record<string, unknown>);
      if (a.annotation) arrow.annotation = a.annotation as string;
      if (a.protocol) arrow.protocol = a.protocol as string;
      if (a._meta) arrow._meta = a._meta as Arrow['_meta'];
      return arrow;
    }),
    ports: doc.ports
      ? (doc.ports as Array<Record<string, unknown>>).map(deserializePort)
      : undefined,
    groups: doc.groups ?? undefined,
  };
}

// Deserialize layout JSON
export function deserializeLayoutJson(json: string): CanvasLayout {
  return JSON.parse(json);
}

// Serialize workspace.yaml
export function serializeWorkspaceConfig(config: WorkspaceConfig): string {
  return YAML.stringify(config);
}

// Deserialize workspace.yaml — accepts old field names for migration
export function deserializeWorkspaceConfig(yaml: string): WorkspaceConfig {
  const raw = YAML.parse(yaml);
  return {
    schema_version: raw.schema_version ?? 1,
    project_name: raw.project_name ?? '',
    created_at: raw.created_at ?? '',
    // Migration: old 'version' field → 'last_checkpoint'
    last_checkpoint: raw.last_checkpoint ?? raw.version ?? '',
    last_checkpoint_at: raw.last_checkpoint_at ?? undefined,
    // Migration: old 'last_major_hash' → 'last_checkpoint_hash'
    last_checkpoint_hash: raw.last_checkpoint_hash ?? raw.last_major_hash ?? '',
    llm: raw.llm ?? { preferred_provider: 'claude-code', ollama_model: 'llama3' },
  };
}

// Serialize workspace.state.yaml
export function serializeWorkspaceState(state: WorkspaceState): string {
  return YAML.stringify(state);
}

// Deserialize workspace.state.yaml
export function deserializeWorkspaceState(yaml: string): WorkspaceState {
  return YAML.parse(yaml);
}

// Build the list of files to write for the entire tree
export function serializeTreeToFiles(
  nodes: Record<string, CanvasNode>,
): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];

  for (const [id, canvas] of Object.entries(nodes)) {
    const prefix = id === 'root' ? '' : buildCanvasPath(nodes, id);

    files.push({ path: `${prefix}node.yaml`, content: serializeNodeYaml(canvas) });
    files.push({ path: `${prefix}node.layout.json`, content: serializeLayoutJson(canvas.layout) });

    // Per-block files (interfaces + notes)
    for (const block of canvas.components) {
      if (block.interfacesContent) {
        files.push({
          path: `${prefix}node.interfaces.ts`,
          content: block.interfacesContent,
        });
      }
      if (block.notesContent) {
        files.push({
          path: `${prefix}node.notes.md`,
          content: block.notesContent,
        });
      }
    }
  }

  return files;
}

// Build the directory path for a canvas based on its hierarchy
function buildCanvasPath(
  nodes: Record<string, CanvasNode>,
  canvasId: string,
): string {
  const parts: string[] = [];
  let current = nodes[canvasId];
  while (current && current.id !== 'root') {
    parts.unshift(current.id + '/');
    current = current.parentId ? nodes[current.parentId] : undefined!;
  }
  return parts.join('');
}
