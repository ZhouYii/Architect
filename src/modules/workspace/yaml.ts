/**
 * YAML serialization / deserialization for workspace entities.
 * Uses eemeli's `yaml` package throughout — never js-yaml.
 *
 * Field mapping:
 *   TypeScript camelCase  ←→  YAML snake_case
 *   e.g. pan_x, pan_y, block_type, arrow_type, has_children …
 *   (Most fields already match because the types use snake_case themselves.)
 *   `interfacesContent` is the only camelCase field — serialised as
 *   `interfaces_content` in YAML.
 */

import * as YAML from 'yaml';
import type { CanvasNode, WorkspaceConfig } from '../store/types.js';

// ─── Internal field name helpers ────────────────────────────────────────────

type PlainObject = Record<string, unknown>;

/** camelCase → snake_case for the one camelCase field we have */
function toSnake(obj: PlainObject): PlainObject {
  const out: PlainObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k === 'interfacesContent' ? 'interfaces_content' : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[snakeKey] = toSnake(v as PlainObject);
    } else if (Array.isArray(v)) {
      out[snakeKey] = v.map((item) =>
        item !== null && typeof item === 'object' ? toSnake(item as PlainObject) : item
      );
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

/** snake_case → camelCase for the one snake_case→camelCase field */
function fromSnake(obj: PlainObject): PlainObject {
  const out: PlainObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const camelKey = k === 'interfaces_content' ? 'interfacesContent' : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[camelKey] = fromSnake(v as PlainObject);
    } else if (Array.isArray(v)) {
      out[camelKey] = v.map((item) =>
        item !== null && typeof item === 'object' ? fromSnake(item as PlainObject) : item
      );
    } else {
      out[camelKey] = v;
    }
  }
  return out;
}

// ─── CanvasNode ──────────────────────────────────────────────────────────────

/**
 * Serialize a CanvasNode to a YAML string.
 * Fields with undefined values are omitted.
 */
export function serializeCanvas(canvas: CanvasNode): string {
  const plain = toSnake(canvas as unknown as PlainObject);
  return YAML.stringify(plain, { lineWidth: 0, defaultKeyType: 'PLAIN' });
}

/**
 * Deserialize a YAML string back to a CanvasNode.
 */
export function deserializeCanvas(yamlStr: string): CanvasNode {
  const raw = YAML.parse(yamlStr) as PlainObject;
  return fromSnake(raw) as unknown as CanvasNode;
}

/**
 * Parse `originalYaml` as a YAML Document (preserving comments/formatting),
 * apply `updates` on top, then re-stringify.
 * Use this when editing existing files that may have hand-written comments.
 */
export function parseAndMerge(
  originalYaml: string,
  updates: Partial<CanvasNode>
): string {
  const doc = YAML.parseDocument(originalYaml);
  const updatesSnake = toSnake(updates as unknown as PlainObject);

  for (const [key, value] of Object.entries(updatesSnake)) {
    if (value === undefined) continue;
    doc.set(key, value);
  }

  return doc.toString({ lineWidth: 0 });
}

// ─── WorkspaceConfig ─────────────────────────────────────────────────────────

export function serializeWorkspaceConfig(config: WorkspaceConfig): string {
  return YAML.stringify(config, { lineWidth: 0, defaultKeyType: 'PLAIN' });
}

export function deserializeWorkspaceConfig(yamlStr: string): WorkspaceConfig {
  return YAML.parse(yamlStr) as WorkspaceConfig;
}
