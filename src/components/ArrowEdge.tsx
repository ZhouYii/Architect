import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  MarkerType,
  type EdgeProps,
  type Edge,
} from '@xyflow/react';
import type { Arrow } from '../types';

export type ArrowEdgeType = Edge<{ arrow: Arrow; selected: boolean }, 'arrow'>;

export function ArrowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<ArrowEdgeType>) {
  const arrow = data?.arrow;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  });

  const strokeWidth = arrow?.weight === 'bold' ? 4 : 2;
  const className = `arrow-edge ${selected ? 'selected' : ''} ${arrow?.weight === 'bold' ? 'bold' : ''}`;
  const showEnd = arrow?.direction !== 'backward';
  const showStart = arrow?.direction === 'bidirectional' || arrow?.direction === 'backward';

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        className={className}
        style={{ strokeWidth }}
        markerEnd={showEnd ? `url(#${MarkerType.ArrowClosed})` : undefined}
        markerStart={showStart ? `url(#${MarkerType.ArrowClosed})` : undefined}
      />
      {arrow?.label && (
        <EdgeLabelRenderer>
          <div
            className="arrow-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            {arrow.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
