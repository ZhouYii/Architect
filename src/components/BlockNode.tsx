import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Block, BlockType } from '../types';

export type BlockNodeType = Node<{ block: Block; selected: boolean }, 'block'>;

function typeIcon(t?: BlockType): string {
  switch (t) {
    case 'service': return 'S';
    case 'module': return 'M';
    case 'class': return 'C';
    case 'function': return 'f';
    case 'data-store': return 'D';
    case 'external': return 'E';
    case 'queue': return 'Q';
    case 'config': return 'G';
    default: return 'B';
  }
}

const SIDES = [
  { pos: Position.Left, prop: 'top' as const },
  { pos: Position.Right, prop: 'top' as const },
  { pos: Position.Top, prop: 'left' as const },
  { pos: Position.Bottom, prop: 'left' as const },
];
const OFFSETS = [15, 50, 85];

function BlockNodeInner({ data }: NodeProps<BlockNodeType>) {
  const { block, selected } = data;
  const hasChildren = block.hasChildren;

  return (
    <div
      className={`block-node ${selected ? 'selected' : ''} ${hasChildren ? 'has-children' : ''}`}
    >
      {/* Handles on all 4 sides, 3 per side */}
      {SIDES.map(({ pos, prop }) =>
        OFFSETS.map((pct, i) => (
          <Handle key={`target-${pos}-${i}`} type="target" position={pos}
            id={`target-${pos}-${i}`} style={{ [prop]: `${pct}%` }} />
        ))
      )}
      {SIDES.map(({ pos, prop }) =>
        OFFSETS.map((pct, i) => (
          <Handle key={`source-${pos}-${i}`} type="source" position={pos}
            id={`source-${pos}-${i}`} style={{ [prop]: `${pct}%` }} />
        ))
      )}

      <div className="block-header">
        <span className="block-type-icon">{typeIcon(block.type)}</span>
        <span className="block-label">{block.label}</span>
        {hasChildren && <span className="drill-indicator">&#x25B6;</span>}
        {block.status && <span className={`status-dot status-${block.status}`} />}
      </div>

      {block.contract && (() => {
        const total = block.contract.invariants.length + block.contract.preconditions.length + block.contract.postconditions.length;
        const impl = [...block.contract.invariants, ...block.contract.preconditions, ...block.contract.postconditions].filter(e => e.status === 'implemented' || e.status === 'verified').length;
        return total > 0 ? <div className="contract-badge">{impl}/{total} impl</div> : null;
      })()}

      {block.annotation && (
        <div className="block-annotation">{block.annotation}</div>
      )}

      {block.ports.length > 0 && (
        <div className="block-ports">
          {block.ports.map((p) => (
            <div key={p.id} className={`port port-${p.direction}`}>
              <span className="port-dot" />
              <span className="port-label">{p.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const BlockNode = memo(BlockNodeInner);
