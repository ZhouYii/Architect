import { invoke } from '@tauri-apps/api/core';
import { useDesignStore } from '../store';
import {
  serializeWorkspaceConfig,
  serializeWorkspaceState,
  deserializeWorkspaceConfig,
  deserializeWorkspaceState,
  deserializeNodeYaml,
  deserializeLayoutJson,
  serializeTreeToFiles,
} from './yaml';
import { flush } from './flush';
import type { CanvasNode, WorkspaceConfig, WorkspaceState, ID } from '../types';

function buildCanvasPath(nodes: Record<string, CanvasNode>, canvasId: string): string {
  const parts: string[] = [];
  let current = nodes[canvasId];
  while (current && current.id !== 'root') {
    parts.unshift(current.id + '/');
    current = current.parentId ? nodes[current.parentId] : undefined!;
  }
  return parts.join('');
}

interface FileEntry {
  path: string;
  content: string;
}

/**
 * Validate tree integrity before checkpoint (PRD §8.3).
 * Checks: broken arrow references, orphaned child canvases, missing required fields.
 */
function validateTree(nodes: Record<string, CanvasNode>): string[] {
  const errors: string[] = [];
  for (const [canvasId, canvas] of Object.entries(nodes)) {
    const blockIds = new Set(canvas.components.map((b) => b.id));
    // Check arrow references point to existing blocks
    for (const arrow of canvas.connections) {
      if (!blockIds.has(arrow.from)) {
        errors.push(`Canvas "${canvasId}": arrow "${arrow.id}" references missing source block "${arrow.from}"`);
      }
      if (!blockIds.has(arrow.to)) {
        errors.push(`Canvas "${canvasId}": arrow "${arrow.id}" references missing target block "${arrow.to}"`);
      }
    }
    // Check has_children blocks have corresponding canvas nodes
    for (const block of canvas.components) {
      if (block.hasChildren && !nodes[block.id]) {
        errors.push(`Canvas "${canvasId}": block "${block.id}" has has_children=true but no child canvas exists`);
      }
    }
  }
  return errors;
}

/**
 * Initialize a new .architect workspace at the given path.
 */
export async function initWorkspace(basePath: string, projectName: string) {
  const archPath = `${basePath}/.architect`;
  const store = useDesignStore.getState();

  const now = new Date().toISOString();
  const config: WorkspaceConfig = {
    schema_version: 1,
    project_name: projectName,
    created_at: now,
    last_checkpoint: 'cp-001',
    last_checkpoint_at: now,
    last_checkpoint_hash: '',
    llm: {
      preferred_provider: 'claude-code',
      ollama_model: 'llama3',
    },
  };

  const state: WorkspaceState = {
    version: '1.0',
    head_hash: '',
    dirty: false,
    pending_changes: 0,
    last_flush_at: now,
  };

  // Write workspace config files
  await invoke<number>('write_files', {
    base: archPath,
    files: [
      { path: 'workspace.yaml', content: serializeWorkspaceConfig(config) },
      { path: 'workspace.state.yaml', content: serializeWorkspaceState(state) },
    ],
  });

  // Write initial tree
  const treeFiles = serializeTreeToFiles(store.nodes).map((f) => ({
    path: f.path,
    content: f.content,
  }));
  await invoke<number>('write_files', {
    base: `${archPath}/tree`,
    files: treeFiles,
  });

  // Compute initial hash
  const hash = await invoke<string>('compute_tree_hash', {
    treePath: `${archPath}/tree`,
  });

  config.last_checkpoint_hash = hash;
  state.head_hash = hash;

  // Create initial checkpoint archive
  await invoke('create_version_archive', {
    treePath: `${archPath}/tree`,
    archivePath: `${archPath}/checkpoints/cp-001.tar.gz`,
  });

  // Update config with hash
  await invoke<number>('write_files', {
    base: archPath,
    files: [
      { path: 'workspace.yaml', content: serializeWorkspaceConfig(config) },
      { path: 'workspace.state.yaml', content: serializeWorkspaceState(state) },
    ],
  });

  store.setWorkspacePath(basePath);
  store.setConfig(config);
  store.setState(state);
  store.setVersion('1.0');
  store.markClean(hash);

  // Generate AGENT_GUIDE.md
  await generateAgentGuide(basePath, config);
}

/**
 * Load an existing .architect workspace from disk.
 */
export async function loadWorkspace(basePath: string) {
  const archPath = `${basePath}/.architect`;
  const store = useDesignStore.getState();

  const files: FileEntry[] = await invoke('read_workspace', { path: archPath });

  // Find and parse workspace config
  const configFile = files.find((f) => f.path === 'workspace.yaml');
  if (!configFile) throw new Error('workspace.yaml not found');
  const config = deserializeWorkspaceConfig(configFile.content);

  // Find and parse workspace state
  const stateFile = files.find((f) => f.path === 'workspace.state.yaml');
  const state: WorkspaceState = stateFile
    ? deserializeWorkspaceState(stateFile.content)
    : {
        version: config.last_checkpoint,
        head_hash: config.last_checkpoint_hash,
        dirty: false,
        pending_changes: 0,
        last_flush_at: new Date().toISOString(),
      };

  // Parse all canvas nodes from tree/
  const nodes: Record<ID, CanvasNode> = {};
  const treeFiles = files.filter((f) => f.path.startsWith('tree/'));

  const yamlFiles = treeFiles.filter((f) => f.path.endsWith('node.yaml'));
  const layoutFiles = treeFiles.filter((f) => f.path.endsWith('node.layout.json'));
  const interfaceFiles = treeFiles.filter((f) => f.path.endsWith('node.interfaces.ts'));
  const noteFiles = treeFiles.filter((f) => f.path.endsWith('node.notes.md'));

  for (const yf of yamlFiles) {
    const dir = yf.path.replace('tree/', '').replace('node.yaml', '');
    const canvas = deserializeNodeYaml(yf.content);

    const layoutFile = layoutFiles.find((f) =>
      f.path === `tree/${dir}node.layout.json`,
    );
    const layout = layoutFile
      ? deserializeLayoutJson(layoutFile.content)
      : {};

    const ifFile = interfaceFiles.find((f) =>
      f.path === `tree/${dir}node.interfaces.ts`,
    );
    const nFile = noteFiles.find((f) =>
      f.path === `tree/${dir}node.notes.md`,
    );

    if (ifFile && canvas.components.length > 0) {
      canvas.components[0].interfacesContent = ifFile.content;
    }
    if (nFile && canvas.components.length > 0) {
      canvas.components[0].notesContent = nFile.content;
    }

    nodes[canvas.id] = { ...canvas, layout };
  }

  // Detect dirty state
  const currentHash = await invoke<string>('compute_tree_hash', {
    treePath: `${archPath}/tree`,
  });
  const isDirty = currentHash !== config.last_checkpoint_hash;

  store.setWorkspacePath(basePath);
  store.setConfig(config);
  store.setState({ ...state, dirty: isDirty, head_hash: currentHash });
  store.setVersion(state.version);
  if (Object.keys(nodes).length > 0) {
    store.loadNodes(nodes);
  }
  if (!isDirty) {
    store.markClean(currentHash);
  }
}

/**
 * Extract checkpoint number from a checkpoint string like "cp-003" or legacy "3.0"
 */
function parseCheckpointNumber(cp: string): number {
  const match = cp.match(/(\d+)/);
  return match ? parseInt(match[1]) : 1;
}

/**
 * Export a checkpoint snapshot.
 */
export async function exportSnapshot() {
  const store = useDesignStore.getState();
  if (!store.workspacePath || !store.config) return;

  await flush();

  const archPath = `${store.workspacePath}/.architect`;
  const treePath = `${archPath}/tree`;

  // Validate tree before checkpoint (PRD §8.3)
  const errors = validateTree(store.nodes);
  if (errors.length > 0) {
    throw new Error(`Cannot checkpoint: ${errors.join('; ')}`);
  }

  const hash = await invoke<string>('compute_tree_hash', { treePath });

  const prevNum = parseCheckpointNumber(store.config.last_checkpoint);
  const newNum = prevNum + 1;
  const cpName = `cp-${String(newNum).padStart(3, '0')}`;

  // Create archive
  await invoke('create_version_archive', {
    treePath,
    archivePath: `${archPath}/checkpoints/${cpName}.tar.gz`,
  });

  // Update workspace.yaml
  const now = new Date().toISOString();
  const newConfig: WorkspaceConfig = {
    ...store.config,
    last_checkpoint: cpName,
    last_checkpoint_at: now,
    last_checkpoint_hash: hash,
  };
  // Write both workspace.yaml and workspace.state.yaml
  const newState: WorkspaceState = {
    version: `${newNum}.0`,
    head_hash: hash,
    dirty: false,
    pending_changes: 0,
    last_flush_at: now,
  };
  await invoke<number>('write_files', {
    base: archPath,
    files: [
      { path: 'workspace.yaml', content: serializeWorkspaceConfig(newConfig) },
      { path: 'workspace.state.yaml', content: serializeWorkspaceState(newState) },
    ],
  });

  // Archive pending ACPs to flat changes/accepted/ or changes/dismissed/
  const pendingACPs = store.pendingACPs;
  if (pendingACPs.length > 0) {
    const { serializeACP } = await import('./acp');
    const acpFiles = pendingACPs.map((acp, i) => ({
      path: `${acp.status === 'accepted' ? 'accepted' : 'dismissed'}/${String(i + 1).padStart(3, '0')}-${acp.id}.yaml`,
      content: serializeACP(acp),
    }));
    await invoke<number>('write_files', {
      base: `${archPath}/changes`,
      files: acpFiles,
    });
  }

  // Generate mermaid diagrams for each canvas
  const { generateMermaidDiagram } = await import('./mermaid');
  const mermaidFiles = Object.values(store.nodes).map((canvas) => {
    const prefix = canvas.id === 'root' ? '' : buildCanvasPath(store.nodes, canvas.id);
    return { path: `${prefix}node.diagram.mermaid`, content: generateMermaidDiagram(canvas) };
  });
  if (mermaidFiles.length > 0) {
    await invoke<number>('write_files', { base: treePath, files: mermaidFiles });
  }

  // Update store
  store.setConfig(newConfig);
  store.setVersion(`${newNum}.0`);
  store.markClean(hash);

  await generateAgentGuide(store.workspacePath, newConfig);

  return newNum;
}

/**
 * List checkpoint archives.
 */
export async function listVersions(basePath: string): Promise<string[]> {
  const archPath = `${basePath}/.architect`;
  // Try checkpoints/ first, fall back to versions/ for migration
  for (const dir of ['checkpoints', 'versions']) {
    try {
      const files: FileEntry[] = await invoke('read_workspace', {
        path: `${archPath}/${dir}`,
      });
      const archives = files.map((f) => f.path).filter((p) => p.endsWith('.tar.gz'));
      if (archives.length > 0) return archives;
    } catch { /* dir doesn't exist */ }
  }
  return [];
}

/**
 * Restore from a specific checkpoint archive.
 */
export async function restoreVersion(basePath: string, version: number) {
  const archPath = `${basePath}/.architect`;
  const cpName = `cp-${String(version).padStart(3, '0')}`;
  // Try new naming first, fall back to old
  for (const path of [
    `${archPath}/checkpoints/${cpName}.tar.gz`,
    `${archPath}/versions/v${version}.tar.gz`,
  ]) {
    try {
      await invoke('restore_from_archive', {
        archivePath: path,
        treePath: `${archPath}/tree`,
      });
      await loadWorkspace(basePath);
      return;
    } catch { /* try next */ }
  }
  throw new Error(`Checkpoint ${version} not found`);
}

/**
 * Generate comprehensive AGENT_GUIDE.md (PRD §11).
 */
async function generateAgentGuide(basePath: string, config: WorkspaceConfig) {
  const guide = `# ${config.project_name} — Agent Guide

> Auto-generated by Architect on checkpoint ${config.last_checkpoint}

You are working in a codebase managed by Architect.
The \`.architect/\` directory contains the design specification.
Read this guide before modifying any \`.architect/\` files.

## Reading the Design

1. Start at \`.architect/tree/node.yaml\` to see the top-level architecture.
2. Each block with \`has_children: true\` has a subdirectory — enter it to see that block's internal design.
3. Arrows with \`interface:\` have typed contracts. Type names reference definitions in the sibling \`node.interfaces.ts\`.
4. \`node.notes.md\` has design rationale, constraints, and open questions.
5. \`ports:\` show how parent arrows bind to internal components — this tells you which component should make or receive external calls.

## Block Types

\`service\` | \`module\` | \`class\` | \`function\` | \`data-store\` | \`external\` | \`queue\` | \`config\`

## Block Status

\`draft\` → \`approved\` → \`implementing\` → \`done\` → \`deprecated\`

## Arrow Types

\`calls\` | \`reads\` | \`writes\` | \`publishes\` | \`subscribes\` | \`depends\`

## Reading Contracts

Blocks and arrows have \`contract:\` sections with:
- \`invariants\`: conditions that must always hold
- \`preconditions\`: what must be true before execution
- \`postconditions\`: what must be true after execution
- \`test_cases\`: named scenarios with inputs and expected outputs

Each entry has \`id\`, \`description\`, optional \`expression\`, \`status\` (draft|implemented|verified), and \`impl\` linking to source code.

## Proposing Changes (Preferred)

Write ACP files to \`.architect/changes/pending/\`:

1. Name: \`NNN-short-description.yaml\` (next sequential number)
2. Required fields: kind, target_canvas, reason, proposal
3. Optional: agent, session (co-design|implementation), based_on_checkpoint, timestamp

### ACP Kinds

| Kind | Use when |
|------|----------|
| \`add_component\` | Adding a new block to a canvas |
| \`remove_component\` | Removing a block |
| \`modify_component\` | Changing block fields (status, annotation, contract) |
| \`decompose\` | Breaking a leaf block into child components |
| \`refine_arrow\` | Adding/updating interface and contract on an arrow |
| \`restructure\` | Moving blocks between canvases |
| \`add_arrow\` | Adding a new connection |
| \`remove_arrow\` | Removing a connection |

### Example ACP

\`\`\`yaml
kind: add_component
target_canvas: gacha-service
agent: claude-code
session: implementation
based_on_checkpoint: ${config.last_checkpoint}
timestamp: ${new Date().toISOString()}
reason: |
  Missing rate limiting — players can spam pull requests.
proposal:
  component:
    id: rate-limiter
    type: module
    status: draft
    annotation: "Sliding window counter, 10 pulls/min/player"
    contract:
      invariants:
        - id: inv-01
          description: "Rejects pulls exceeding 10/min"
          status: draft
  connections_add:
    - from: banner-manager
      to: rate-limiter
      label: routes pull
      type: calls
\`\`\`

## Direct Edits (Allowed)

You may directly edit files in \`.architect/tree/\`:
- EDIT: \`node.yaml\`, \`node.interfaces.ts\`, \`node.notes.md\`
- CREATE: new subdirectories with their own \`node.yaml\`
- DELETE: components, connections, directories
- NEVER EDIT: \`node.layout.json\`, \`node.diagram.mermaid\`
- NEVER EDIT: anything in \`checkpoints/\`, \`workspace.yaml\`, or \`workspace.state.yaml\`

Add \`_meta\` blocks on elements you change:
\`\`\`yaml
_meta:
  modified_by: your-agent-id
  modified_at: 2026-03-28T16:30:00Z
  reason: "Brief explanation"
\`\`\`

## Implementing Contracts

1. Read the \`contract\` in the parent's \`node.yaml\`.
2. Implement code satisfying all invariants, pre/post conditions.
3. Write tests matching each \`test_cases\` entry.
4. Update each satisfied entry with \`status: implemented\` and \`impl\` block.
5. You may NOT set \`status: verified\` — that requires CI or human review.

## Implementing Ports

- \`direction: exit\` → your block originates this call. \`bound_to\` is where the outgoing call lives.
- \`direction: entry\` → your block receives this call. \`bound_to\` is where the handler lives.

## Current State

- Checkpoint: ${config.last_checkpoint}
- Hash: ${config.last_checkpoint_hash}
`;

  await invoke<number>('write_files', {
    base: `${basePath}/.architect/prompts`,
    files: [{ path: 'AGENT_GUIDE.md', content: guide }],
  });
}
