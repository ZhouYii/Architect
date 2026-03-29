/**
 * MergeConflictView — modal shown when a track merge has unresolved conflicts.
 *
 * Shows each conflicting node side-by-side (main vs. track) with per-node
 * "Use Main" / "Use Track" buttons, and an "Apply Merge" button once all
 * conflicts are resolved.
 */

import { useCallback } from 'react';
import { useDesignStore } from '../store/store.js';
import { TOKENS, STATUS_COLORS } from '../../styles/theme.js';
import { applyMerge } from '../workspace/tracks.js';
import type { DesignNode, MergeConflict } from '../store/types.js';

export function MergeConflictView() {
  const conflicts = useDesignStore((s) => s.merge_conflicts);
  const resolveMergeConflict = useDesignStore((s) => s.resolveMergeConflict);
  const setMergeConflicts = useDesignStore((s) => s.setMergeConflicts);

  if (conflicts.length === 0) return null;

  const allResolved = conflicts.every((c) => c.resolution !== undefined);

  const handleApply = useCallback(async () => {
    try {
      await applyMerge();
    } catch (err) {
      console.error('[MergeConflictView] applyMerge failed:', err);
      window.alert(`Failed to apply merge: ${String(err)}`);
    }
  }, []);

  const handleCancel = useCallback(() => {
    // Discard the pending merge
    setMergeConflicts([]);
  }, [setMergeConflicts]);

  return (
    // Backdrop
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
      }}
    >
      {/* Modal panel */}
      <div
        style={{
          background: TOKENS.bgSurface,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 8,
          width: '80vw',
          maxWidth: 900,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: `1px solid ${TOKENS.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 14, color: TOKENS.statusAmber }}>⚠</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: TOKENS.textPrimary }}>
            Merge Conflicts
          </span>
          <span style={{ fontSize: 12, color: TOKENS.textTertiary, marginLeft: 4 }}>
            {conflicts.filter((c) => c.resolution !== undefined).length} / {conflicts.length} resolved
          </span>
          <div style={{ flex: 1 }} />
          <button
            onClick={handleCancel}
            style={{
              fontSize: 12,
              color: TOKENS.textTertiary,
              padding: '3px 8px',
              border: `1px solid ${TOKENS.border}`,
              borderRadius: 4,
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => { void handleApply(); }}
            disabled={!allResolved}
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: allResolved ? TOKENS.bgBase : TOKENS.textGhost,
              background: allResolved ? TOKENS.accent : TOKENS.bgSurfaceRaised,
              padding: '3px 12px',
              border: `1px solid ${allResolved ? TOKENS.accent : TOKENS.border}`,
              borderRadius: 4,
              cursor: allResolved ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            Apply Merge
          </button>
        </div>

        {/* Column labels */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 0,
            padding: '8px 20px',
            borderBottom: `1px solid ${TOKENS.border}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 11, color: TOKENS.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Main
          </span>
          <span style={{ fontSize: 11, color: TOKENS.textGhost, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Track
          </span>
        </div>

        {/* Conflict list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conflicts.map((conflict) => (
            <ConflictRow
              key={`${conflict.canvas_id}:${conflict.node_id}`}
              conflict={conflict}
              onResolve={(resolution) =>
                resolveMergeConflict(conflict.node_id, conflict.canvas_id, resolution)
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ConflictRow ─────────────────────────────────────────────────────────────

function ConflictRow({
  conflict,
  onResolve,
}: {
  conflict: MergeConflict;
  onResolve: (r: 'main' | 'track') => void;
}) {
  const { resolution, main_version, track_version, canvas_id } = conflict;

  return (
    <div
      style={{
        border: `1px solid ${resolution ? TOKENS.border : TOKENS.statusAmber}`,
        borderRadius: 6,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Row header */}
      <div
        style={{
          padding: '6px 10px',
          background: TOKENS.bgSurfaceRaised,
          borderBottom: `1px solid ${TOKENS.border}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 11, color: TOKENS.textTertiary }}>
          canvas: <span style={{ color: TOKENS.textSecondary }}>{canvas_id}</span>
          {' '}/ node: <span style={{ color: TOKENS.textSecondary }}>{conflict.node_id}</span>
        </span>
        <div style={{ flex: 1 }} />
        {resolution && (
          <span style={{ fontSize: 11, color: TOKENS.statusGreen }}>
            ✓ using {resolution}
          </span>
        )}
      </div>

      {/* Side-by-side node views + action buttons */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 0,
        }}
      >
        {/* Main side */}
        <NodeCard
          node={main_version}
          side="main"
          chosen={resolution === 'main'}
          onChoose={() => onResolve('main')}
        />

        {/* Track side */}
        <NodeCard
          node={track_version}
          side="track"
          chosen={resolution === 'track'}
          onChoose={() => onResolve('track')}
          borderLeft
        />
      </div>
    </div>
  );
}

// ─── NodeCard ────────────────────────────────────────────────────────────────

function NodeCard({
  node,
  side,
  chosen,
  onChoose,
  borderLeft,
}: {
  node: DesignNode;
  side: 'main' | 'track';
  chosen: boolean;
  onChoose: () => void;
  borderLeft?: boolean;
}) {
  const statusColor = STATUS_COLORS[node.status] ?? TOKENS.textGhost;

  return (
    <div
      style={{
        padding: '10px',
        background: chosen ? TOKENS.accentDim : 'transparent',
        borderLeft: borderLeft ? `1px solid ${TOKENS.border}` : undefined,
        transition: 'background 0.15s',
      }}
    >
      {/* Node name + type */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: TOKENS.textPrimary }}>
          {node.name}
        </span>
        {node.block_type && (
          <span style={{ fontSize: 10, color: TOKENS.textGhost }}>
            {node.block_type}
          </span>
        )}
      </div>

      {/* Status badge */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            color: statusColor,
            border: `1px solid ${statusColor}`,
            borderRadius: 3,
            padding: '1px 5px',
          }}
        >
          {node.status}
        </span>
        {node.annotation && (
          <span style={{ fontSize: 10, color: TOKENS.textTertiary, fontStyle: 'italic' }}>
            {node.annotation}
          </span>
        )}
      </div>

      {/* Choose button */}
      <button
        onClick={onChoose}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          border: `1px solid ${chosen ? TOKENS.accent : TOKENS.border}`,
          borderRadius: 4,
          background: chosen ? TOKENS.accent : TOKENS.bgSurfaceRaised,
          color: chosen ? TOKENS.bgBase : TOKENS.textSecondary,
          cursor: 'pointer',
          fontWeight: chosen ? 600 : 400,
          transition: 'background 0.15s, border-color 0.15s',
        }}
      >
        {chosen ? `✓ Using ${side}` : `Use ${side}`}
      </button>
    </div>
  );
}
