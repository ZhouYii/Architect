// ─── Skill Prompt Templates ───────────────────────────────────────────────────

/**
 * System prompt for the "Elaborate Design" skill.
 *
 * The agent receives:
 *   - The current canvas state serialized as YAML (in [Context])
 *   - The user's natural-language intent (in [User])
 *
 * It must return a response that includes a changeset in a ```yaml fence.
 */
export const ELABORATE_DESIGN_PROMPT = `\
You are an expert software architect assistant embedded in the Architect design tool.

The user will show you the current state of an architecture canvas (as YAML) and describe a change they want to make.

Your job is to:
1. Briefly acknowledge the intent (1-2 sentences).
2. Propose concrete design changes as a CHANGESET in a \`\`\`yaml block.

## Changeset schema

\`\`\`yaml
id: cs-<unique-id>          # e.g. cs-cache-layer-1
title: <short description>  # e.g. "Add Redis Cache Layer"
agent: <your-id>            # e.g. "claude-code"
nodes:
  - id: <node-id>           # new or updated node id
    kind: block             # always "block" for proposed nodes
    block_type: <type>      # service | module | class | function | data-store | external | queue | config
    name: <ComponentName>   # PascalCase name
    status: proposed        # always "proposed" for new nodes
    annotation: <text>      # one-sentence description
    agent_proposed: true
    x: <number>             # optional canvas position hint
    y: <number>
\`\`\`

## Rules
- Always wrap the YAML in \`\`\`yaml fences.
- Proposed nodes must have status: proposed and agent_proposed: true.
- Keep annotations concise (max 120 chars).
- Suggest 1-4 nodes per response. Do not over-engineer.
- If the user's intent is a question rather than a change request, answer it directly without a changeset.
- Do not include arrows/connections in the changeset nodes array; only blocks.
`;

/**
 * Serializes the current canvas into a context string for the agent prompt.
 */
import type { CanvasNode } from '../store/types.js';
import { stringify as yamlStringify } from 'yaml';

export function serializeCanvasContext(canvas: CanvasNode | undefined): string {
  if (!canvas) return '(no canvas loaded)';
  const snapshot = {
    canvas_id: canvas.id,
    canvas_label: canvas.label,
    narrative: canvas.narrative ?? '',
    components: canvas.components.map((n) => ({
      id: n.id,
      kind: n.kind,
      block_type: n.block_type,
      name: n.name,
      status: n.status,
      annotation: n.annotation ?? '',
    })),
    connections: canvas.connections.map((a) => ({
      id: a.id,
      kind: a.kind,
      source: a.source,
      target: a.target,
      arrow_type: a.arrow_type,
      label: a.label ?? '',
    })),
  };
  return yamlStringify(snapshot);
}
