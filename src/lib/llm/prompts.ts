import type { CanvasNode } from '../../types';
import { serializeNodeYaml } from '../yaml';

export const REVIEW_SYSTEM_PROMPT = `You are co-designing a system architecture in Architect.
Review this canvas. Identify problems, missing components, untyped arrows,
blocks that should be decomposed, and missing error handling or observability.
Blocks have optional type (service, module, class, function, data-store, external, queue, config) and status (draft, approved, implementing, done, deprecated) fields.

For each suggestion, emit YAML in \`\`\`yaml fences with ACP format:
- kind: add_block | remove_block | modify_block | add_arrow | remove_arrow | modify_arrow | add_component | decompose | refine_arrow | restructure
- target_canvas: the canvas ID
- target_id: the block or arrow ID (for modify/remove)
- reason: A detailed explanation with three parts:
    1. PROBLEM: What issue or gap does this address?
    2. IMPACT: What improves if this change is made? What breaks if it isn't?
    3. ALTERNATIVES: What other approaches were considered and why this one is better?
- proposal: the new/modified data

Be specific and actionable. Reference existing block IDs. The reason field is shown directly to the human reviewer — make it persuasive and informative, not terse.`;

export const DECOMPOSE_SYSTEM_PROMPT = `You are co-designing a system architecture in Architect.
The user wants to decompose a block into sub-components.

Suggest 2-5 internal blocks and their connections.
Use ACP format in \`\`\`yaml fences.
Each block needs: id, label, ports (with direction entry/exit).
Each arrow needs: from, to, label.`;

export const CONTRACT_SYSTEM_PROMPT = `You are co-designing a system architecture in Architect.
Help write contracts (invariants and test cases) for a block.

Invariants are boolean conditions that must always hold.
Test cases have inputs and expected outputs.

Return your suggestions in \`\`\`yaml fences.`;

/**
 * Build context string for a canvas review.
 */
export function buildCanvasContext(
  canvas: CanvasNode,
  workspacePath: string,
  version: string,
  lastCheckpoint: number,
): string {
  return `Workspace: ${workspacePath}
Canvas: .architect/tree/${canvas.id}/node.yaml
Version: ${version} (checkpoint: cp-${String(lastCheckpoint).padStart(3, '0')})

Design:
\`\`\`yaml
${serializeNodeYaml(canvas)}
\`\`\`

Interfaces:
\`\`\`typescript
${canvas.components.map((b) => b.interfacesContent ?? '').filter(Boolean).join('\n\n') || '// none defined'}
\`\`\``;
}
