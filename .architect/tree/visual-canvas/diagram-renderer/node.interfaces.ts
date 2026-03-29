// ── Block Node Types ──

import type { Node, Edge, NodeProps } from '@xyflow/react';
import type { Block, Arrow, Port } from '../../../src/types';

/** React Flow node data for BlockNode */
export type BlockNodeType = Node<{ block: Block; selected: boolean }, 'block'>;

/** React Flow edge data for ArrowEdge */
export type ArrowEdgeType = Edge<{ arrow: Arrow; selected: boolean; offsetIndex?: number }, 'arrow'>;

/** React Flow node data for PortNode */
export type PortNodeType = Node<{ port: Port }, 'port'>;

// ── Canvas Component Interface ──

/** Node type registry passed to ReactFlow */
export interface NodeTypeRegistry {
  block: typeof import('../../../src/components/BlockNode').BlockNode;
}

/** Edge type registry passed to ReactFlow */
export interface EdgeTypeRegistry {
  arrow: typeof import('../../../src/components/ArrowEdge').ArrowEdge;
}

/** Type icon mapping: BlockType -> single character */
export type TypeIconMap = Record<string, string>;
// service='S', module='M', class='C', function='f', data-store='D',
// external='E', queue='Q', config='G', default='B'

/** Shape delimiters for Mermaid block type rendering */
export type MermaidShapeMap = Record<string, [string, string]>;
