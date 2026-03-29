// ─── Changeset Parser ─────────────────────────────────────────────────────────
// Extracts ```yaml blocks from agent responses and validates AgentChangeset shape.

import { parse as yamlParse } from 'yaml';
import type { AgentChangeset, ProposedNode } from '../store/types.js';

const YAML_FENCE_RE = /```yaml\s*([\s\S]*?)```/gi;

/**
 * Parses an agent response string and returns the first valid AgentChangeset,
 * or null if no valid changeset was found.
 */
export function parseChangeset(
  response: string,
  targetCanvasId: string
): AgentChangeset | null {
  const matches = [...response.matchAll(YAML_FENCE_RE)];
  if (matches.length === 0) return null;

  for (const match of matches) {
    const yamlText = match[1]?.trim();
    if (!yamlText) continue;

    let parsed: unknown;
    try {
      parsed = yamlParse(yamlText);
    } catch {
      continue;
    }

    const cs = validateChangeset(parsed, response, targetCanvasId);
    if (cs) return cs;
  }

  return null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateChangeset(
  raw: unknown,
  fullResponse: string,
  targetCanvasId: string
): AgentChangeset | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') return null;
  if (typeof obj['title'] !== 'string') return null;
  if (typeof obj['agent'] !== 'string') return null;

  const rawNodes = obj['nodes'];
  if (!Array.isArray(rawNodes) || rawNodes.length === 0) return null;

  const nodes: ProposedNode[] = [];
  for (const rawNode of rawNodes) {
    const node = validateNode(rawNode);
    if (node) nodes.push(node);
  }

  if (nodes.length === 0) return null;

  return {
    id: obj['id'] as string,
    title: obj['title'] as string,
    agent: obj['agent'] as string,
    target_canvas_id: targetCanvasId,
    nodes,
    raw_response: fullResponse,
    created_at: new Date().toISOString(),
    feedback: {},
  };
}

const VALID_BLOCK_TYPES = new Set([
  'service',
  'module',
  'class',
  'function',
  'data-store',
  'external',
  'queue',
  'config',
]);

function validateNode(raw: unknown): ProposedNode | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj['id'] !== 'string') return null;
  if (typeof obj['name'] !== 'string') return null;

  // Coerce kind to 'block'
  const kind = 'block';

  const blockType = typeof obj['block_type'] === 'string' && VALID_BLOCK_TYPES.has(obj['block_type'])
    ? (obj['block_type'] as ProposedNode['block_type'])
    : 'module';

  const annotation = typeof obj['annotation'] === 'string' ? obj['annotation'] : undefined;
  const x = typeof obj['x'] === 'number' ? obj['x'] : undefined;
  const y = typeof obj['y'] === 'number' ? obj['y'] : undefined;

  return {
    id: obj['id'] as string,
    kind,
    block_type: blockType,
    name: obj['name'] as string,
    status: 'proposed',
    annotation,
    agent_proposed: true,
    x,
    y,
  };
}
