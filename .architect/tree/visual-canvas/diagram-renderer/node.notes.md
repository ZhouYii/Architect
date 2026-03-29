# Diagram Rendering - Implementation Notes

## Architecture Decisions

### React Flow as Foundation
The diagram rendering is entirely built on @xyflow/react (React Flow). This provides:
- Pan/zoom/selection for free
- Node and edge rendering pipeline
- Handle-based connection system
- MiniMap, Controls, Background components

The trade-off is tight coupling to React Flow's coordinate system, event model, and Node/Edge data structure. Custom nodes (BlockNode, ArrowEdge, PortNode) must conform to React Flow's NodeProps/EdgeProps interfaces.

### Key={currentPath} Remount Strategy
When the user navigates to a different canvas, the ReactFlow component is completely remounted via `key={currentPath}`. This resets pan/zoom state cleanly but means all internal React Flow state (selection, viewport) is lost. This is intentional -- each canvas is a fresh workspace.

### State Synchronization Pattern
The Canvas component uses a two-layer state approach:
1. Zustand store (source of truth) -> `rfNodes`/`rfEdges` computed via useMemo
2. React Flow internal state via `useNodesState`/`useEdgesState`

Changes flow: Store -> useMemo -> setNodes/setEdges (push). Position changes flow back: onNodesChange -> updateBlockPosition (pull on drag-end only).

## Performance Constraints

### Memo Optimization
- BlockNode and PortNode are wrapped in `React.memo()` to prevent re-render when data hasn't changed
- ArrowEdge is NOT memoized (it's a plain function component), which is acceptable because edges are lightweight SVG paths
- The `rfNodes` useMemo depends on `[canvas, selectedBlockId]` -- selection changes trigger rebuild of ALL nodes (each gets updated `selected` flag)

### Multi-Edge Offset
Multiple edges between the same source/target pair are visually offset by 20px each. This uses a simple Map-based counter in the rfEdges useMemo. The offset is applied to sourceY/targetY in getSmoothStepPath, which can cause visual artifacts if the offset pushes the edge path outside the visible area.

## Edge Cases
- Empty canvas (no components): renders "No canvas loaded" placeholder
- Block with no layout position: falls back to {x: 0, y: 0}
- Arrows referencing non-existent blocks: React Flow silently drops them (no edge rendered)
- Snap-to-grid: 16px grid; positions are snapped after drag
