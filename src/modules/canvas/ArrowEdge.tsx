import { memo } from 'react';
import {
  EdgeLabelRenderer,
  getBezierPath,
  BaseEdge,
} from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';
import { TOKENS } from '../../styles/theme.js';
import type { DesignNode } from '../store/types.js';

export interface ArrowEdgeData extends Record<string, unknown> {
  arrow: DesignNode;
}

function ArrowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const { arrow } = (data ?? {}) as ArrowEdgeData;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isProposed = arrow?.status === 'proposed';
  const strokeColor = selected
    ? TOKENS.accent
    : isProposed
    ? TOKENS.textTertiary
    : '#3A3D4A';

  const label = arrow?.label ?? arrow?.name;
  const hasInterface = !!(arrow?.interface);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: strokeColor,
          strokeWidth: 1.5,
          strokeDasharray: isProposed ? '5 3' : undefined,
        }}
        markerEnd={`url(#arrow-${isProposed ? 'proposed' : 'default'})`}
      />

      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              background: TOKENS.bgSurfaceRaised,
              border: `1px solid ${selected ? TOKENS.accent : TOKENS.border}`,
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 11,
              color: TOKENS.textSecondary,
              whiteSpace: 'nowrap',
              zIndex: 1000,
            }}
            className="nodrag nopan"
          >
            {hasInterface && (
              <span style={{ fontSize: 10, color: TOKENS.textTertiary }}>{'{ }'}</span>
            )}
            <span>{label}</span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const ArrowEdge = memo(ArrowEdgeComponent);
