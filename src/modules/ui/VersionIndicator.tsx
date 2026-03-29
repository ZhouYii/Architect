/**
 * VersionIndicator — shows current version string and dirty-node count.
 *
 * Examples:
 *   v1.0
 *   v2.0 (3 modified)
 *
 * Clicking the indicator cuts a new version (Ctrl+. also triggers this).
 */

import { useCallback, useState } from 'react';
import { useDesignStore } from '../store/store.js';
import { cutVersion } from '../workspace/versioning.js';
import { TOKENS } from '../../styles/theme.js';
import type { NodeStatus } from '../store/types.js';

const DIRTY_STATUSES: NodeStatus[] = ['modified', 'proposed'];

export function VersionIndicator() {
  const version = useDesignStore((s) => s.ui.version);
  const canvases = useDesignStore((s) => s.canvases);
  const [isCutting, setIsCutting] = useState(false);

  // Count nodes that are modified or proposed across all canvases
  const dirtyCount = Object.values(canvases).reduce((acc, canvas) => {
    const blocksDirty = canvas.components.filter((n) =>
      DIRTY_STATUSES.includes(n.status)
    ).length;
    const arrowsDirty = canvas.connections.filter((n) =>
      DIRTY_STATUSES.includes(n.status)
    ).length;
    return acc + blocksDirty + arrowsDirty;
  }, 0);

  const label =
    dirtyCount > 0
      ? `v${version} (${dirtyCount} modified)`
      : `v${version}`;

  const handleCut = useCallback(async () => {
    if (isCutting) return;
    setIsCutting(true);
    try {
      await cutVersion();
    } catch (err) {
      console.error('[VersionIndicator] cutVersion failed:', err);
    } finally {
      setIsCutting(false);
    }
  }, [isCutting]);

  return (
    <button
      onClick={() => { void handleCut(); }}
      title="Cut version (Ctrl+.)"
      style={{
        fontSize: 11,
        color: dirtyCount > 0 ? TOKENS.textPrimary : TOKENS.textGhost,
        padding: '2px 8px',
        border: `1px solid ${dirtyCount > 0 ? TOKENS.accent : TOKENS.border}`,
        borderRadius: 4,
        background: TOKENS.bgSurfaceRaised,
        cursor: isCutting ? 'wait' : 'pointer',
        opacity: isCutting ? 0.6 : 1,
        whiteSpace: 'nowrap',
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      {isCutting ? 'cutting…' : label}
    </button>
  );
}
