import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { Port } from '../types';

export type PortNodeType = Node<{ port: Port }, 'port'>;

function PortNodeInner({ data }: NodeProps<PortNodeType>) {
  const { port } = data;
  const isEntry = port.direction === 'entry';

  return (
    <div className={`port-node port-node-${port.direction}`}>
      {isEntry && <Handle type="target" position={Position.Left} id="target" />}
      <div className="port-node-label">
        <span className="port-node-arrow">{isEntry ? '\u2192' : '\u2190'}</span>
        <span>{port.label}</span>
        {port.type && <span className="port-node-type">{port.type}</span>}
      </div>
      {!isEntry && <Handle type="source" position={Position.Right} id="source" />}
    </div>
  );
}

export const PortNode = memo(PortNodeInner);
