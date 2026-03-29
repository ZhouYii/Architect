/**
 * architect status — show workspace status.
 */

import { loadWorkspaceCli, getDeltaCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import type { WorkspaceConfig } from '../../modules/store/types.js';

export function runStatus(basePath: string, format: OutputFormat): void {
  const ws = loadWorkspaceCli(basePath);
  const delta = getDeltaCli(ws.canvases);

  const canvasCount = Object.keys(ws.canvases).length;

  // workspace.yaml uses project_name in practice; WorkspaceConfig.name is the canonical field
  const rawConfig = ws.config as WorkspaceConfig & { project_name?: string };
  const data = {
    name: rawConfig.name ?? rawConfig.project_name ?? 'Architect Project',
    version: ws.config.version,
    root_canvas_id: ws.config.root_canvas_id,
    canvas_count: canvasCount,
    dirty_count: delta.length,
    current_path: ws.currentPath,
    track_count: ws.tracks.length,
  };

  if (format === 'json') {
    output(data, format);
    return;
  }

  const name = data.name;
  const dirty = data.dirty_count > 0 ? ` (${data.dirty_count} dirty)` : '';
  console.log(`Workspace: ${name}`);
  console.log(`Version:   ${data.version}${dirty}`);
  console.log(`Root:      ${data.root_canvas_id}`);
  console.log(`Canvases:  ${data.canvas_count}`);
  console.log(`Path:      ${data.current_path.join(' > ')}`);
  if (data.track_count > 0) {
    console.log(`Tracks:    ${data.track_count}`);
  }
}
