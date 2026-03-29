/**
 * Autosave flush — serializes the entire store to YAML and writes to disk.
 *
 * Usage:
 *   scheduleFlush()  — debounced (5 s), safe to call on every state change
 *   flush()          — immediate, call on window blur / beforeunload
 */

import { useDesignStore } from '../store/store.js';
import { serializeCanvas } from './yaml.js';
import { writeFiles } from './io.js';

// ─── Workspace path ───────────────────────────────────────────────────────────
// The workspace path is stored in a simple module-level variable so flush()
// can be called without passing it every time. Set via setWorkspacePath().

let _workspacePath: string | null = null;

export function setWorkspacePath(path: string): void {
  _workspacePath = path;
}

export function getWorkspacePath(): string | null {
  return _workspacePath;
}

// ─── Debounce timer ───────────────────────────────────────────────────────────

const DEBOUNCE_MS = 5000;
let _timer: ReturnType<typeof setTimeout> | null = null;

/** Schedule a flush in 5 seconds, resetting the timer on each call. */
export function scheduleFlush(): void {
  if (_timer !== null) {
    clearTimeout(_timer);
  }
  _timer = setTimeout(() => {
    _timer = null;
    flush().catch((err: unknown) => {
      console.error('[autosave] flush error:', err);
    });
  }, DEBOUNCE_MS);
}

/** Cancel any pending scheduled flush. */
export function cancelScheduledFlush(): void {
  if (_timer !== null) {
    clearTimeout(_timer);
    _timer = null;
  }
}

// ─── Main flush ───────────────────────────────────────────────────────────────

let _isFlushing = false;

/**
 * Serialize the entire store to YAML files and write them to disk.
 * Safe to call concurrently — a second call while one is in progress is a no-op.
 */
export async function flush(): Promise<void> {
  if (_workspacePath === null) return;
  if (_isFlushing) return;

  _isFlushing = true;
  try {
    await _doFlush(_workspacePath);
  } finally {
    _isFlushing = false;
  }
}

async function _doFlush(basePath: string): Promise<void> {
  const state = useDesignStore.getState();
  const files: [string, string][] = [];

  // ── Per-canvas files ──────────────────────────────────────────────────────
  for (const [canvasId, canvas] of Object.entries(state.canvases)) {
    // Sanitize canvas ID for use as a directory name (replace slashes)
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const prefix = `tree/${dirName}`;

    // node.yaml — the full canvas state
    files.push([`${prefix}/node.yaml`, serializeCanvas(canvas)]);

    // node.interfaces.ts — raw TypeScript interfaces content if present
    const ifaces = canvas.interfacesContent ?? '';
    files.push([`${prefix}/node.interfaces.ts`, ifaces]);

    // node.notes.md — narrative / notes
    const notes = canvas.narrative ?? '';
    files.push([`${prefix}/node.notes.md`, notes]);
  }

  // ── workspace.yaml ────────────────────────────────────────────────────────
  // Derive a minimal config from current state
  const rootCanvasId =
    state.ui.current_path[0] ??
    Object.keys(state.canvases)[0] ??
    'root';

  const workspaceYaml = _buildWorkspaceYaml(rootCanvasId);
  files.push(['workspace.yaml', workspaceYaml]);

  // ── workspace.state.yaml ──────────────────────────────────────────────────
  const stateYaml = _buildWorkspaceStateYaml(state.ui.current_path);
  files.push(['workspace.state.yaml', stateYaml]);

  const written = await writeFiles(basePath, files);
  if (written.length > 0) {
    console.debug(`[autosave] wrote ${written.length} file(s):`, written);
  }
}

// ─── YAML builders ───────────────────────────────────────────────────────────

function _buildWorkspaceYaml(rootCanvasId: string): string {
  // Attempt to recover stored config; fall back to sensible defaults
  const lines = [
    `schema_version: 1`,
    `project_name: "Architect Project"`,
    `root_canvas_id: "${rootCanvasId}"`,
    `version: "1.0"`,
    `created_at: "${new Date().toISOString()}"`,
  ];
  return lines.join('\n') + '\n';
}

function _buildWorkspaceStateYaml(currentPath: string[]): string {
  const pathJson = JSON.stringify(currentPath);
  const lines = [
    `version: "1.0"`,
    `head_hash: ""`,
    `dirty: false`,
    `current_path: ${pathJson}`,
    `updated_at: "${new Date().toISOString()}"`,
  ];
  return lines.join('\n') + '\n';
}
