/**
 * DeltaOverlay — floating badge shown when delta mode is active.
 *
 * Displays "Delta: N changes" in the bottom-left of the canvas.
 * Only renders when delta_mode is true.
 */

import { useDesignStore } from '../store/store.js';
import { TOKENS } from '../../styles/theme.js';

export function DeltaOverlay() {
  const deltaMode = useDesignStore((s) => s.ui.delta_mode);
  const canvases = useDesignStore((s) => s.canvases);

  if (!deltaMode) return null;

  // Count all non-clean nodes
  const changeCount = Object.values(canvases).reduce((acc, canvas) => {
    const b = canvas.components.filter((n) => n.status !== 'clean').length;
    const a = canvas.connections.filter((n) => n.status !== 'clean').length;
    return acc + b + a;
  }, 0);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 1000,
        background: TOKENS.accent,
        color: '#000',
        fontSize: 11,
        fontWeight: 700,
        padding: '4px 10px',
        borderRadius: 6,
        pointerEvents: 'none',
        letterSpacing: '0.04em',
        boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
      }}
    >
      {changeCount > 0 ? `Delta: ${changeCount} change${changeCount === 1 ? '' : 's'}` : 'Delta: no changes'}
    </div>
  );
}
