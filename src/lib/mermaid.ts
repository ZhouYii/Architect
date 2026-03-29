import type { CanvasNode } from '../types';

const BLOCK_TYPE_SHAPES: Record<string, [string, string]> = {
  'service': ['[[', ']]'],
  'module': ['[', ']'],
  'class': ['[/', '/]'],
  'function': ['(', ')'],
  'data-store': ['[(', ')]'],
  'external': ['{{', '}}'],
  'queue': ['[/', '\\]'],
  'config': ['>', ']'],
};

function mermaidId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_]/g, '_');
}

export function generateMermaidDiagram(canvas: CanvasNode): string {
  const lines: string[] = ['graph LR'];

  for (const block of canvas.components) {
    const mid = mermaidId(block.id);
    const [open, close] = BLOCK_TYPE_SHAPES[block.type ?? 'module'] ?? ['[', ']'];
    const label = block.label.replace(/"/g, '#quot;');
    lines.push(`  ${mid}${open}"${label}"${close}`);
  }

  for (const arrow of canvas.connections) {
    const from = mermaidId(arrow.from);
    const to = mermaidId(arrow.to);
    const label = arrow.label ? `|${arrow.label.replace(/"/g, '#quot;')}|` : '';
    lines.push(`  ${from} -->${label} ${to}`);
  }

  return lines.join('\n');
}
