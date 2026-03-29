/**
 * Workspace initialization — creates the `.architect/` skeleton on first run.
 */

import { writeFiles } from './io.js';

const AGENT_GUIDE_TEMPLATE = `# Agent Guide

This file is the starting point for any AI agent working in this workspace.

## Workspace structure
- \`workspace.yaml\` — project configuration
- \`workspace.state.yaml\` — runtime state (current canvas path, dirty flag)
- \`tree/<canvas-id>/node.yaml\` — canvas data
- \`tree/<canvas-id>/node.interfaces.ts\` — TypeScript interface declarations
- \`tree/<canvas-id>/node.notes.md\` — narrative notes

## Conventions
- Each canvas has a unique string ID.
- Blocks are \`DesignNode\` records with \`kind: "block"\`.
- Arrows are \`DesignNode\` records with \`kind: "arrow"\`.
- Status values: clean | modified | proposed | ready | running | implemented | failed | dismissed

## Editing guidelines
- Keep YAML files human-readable; prefer explicit \`null\` over omitting optional keys.
- Document invariants in \`contract.invariants\` before marking a node \`ready\`.
`;

/**
 * Create the `.architect/` directory skeleton at `basePath`.
 * Safe to call even if some files already exist — the backend skips unchanged content.
 */
export async function initWorkspace(
  basePath: string,
  projectName: string
): Promise<void> {
  const now = new Date().toISOString();

  const workspaceYaml = [
    `schema_version: 1`,
    `project_name: "${projectName}"`,
    `root_canvas_id: "root"`,
    `version: "1.0"`,
    `created_at: "${now}"`,
  ].join('\n') + '\n';

  const workspaceStateYaml = [
    `version: "1.0"`,
    `head_hash: ""`,
    `dirty: false`,
    `current_path: ["root"]`,
    `updated_at: "${now}"`,
  ].join('\n') + '\n';

  const rootNodeYaml = [
    `id: root`,
    `label: "System Overview"`,
    `components: []`,
    `connections: []`,
    `layout:`,
    `  zoom: 1`,
    `  pan_x: 0`,
    `  pan_y: 0`,
    `narrative: ""`,
  ].join('\n') + '\n';

  await writeFiles(basePath, [
    ['workspace.yaml', workspaceYaml],
    ['workspace.state.yaml', workspaceStateYaml],
    ['tree/root/node.yaml', rootNodeYaml],
    ['tree/root/node.interfaces.ts', ''],
    ['tree/root/node.notes.md', ''],
    ['prompts/AGENT_GUIDE.md', AGENT_GUIDE_TEMPLATE],
  ]);
}
