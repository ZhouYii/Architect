The Visual Design Canvas decomposes into five responsibility areas that
reflect a clear separation between what the user sees (Diagram Rendering),
how they move through depth (Hierarchy Navigation), how they edit properties
(Element Editing), where truth lives (State Synchronization), and how things
are positioned (Spatial Layout).

## Key Architectural Decision: Centralized Store

The most consequential boundary is the State Synchronization layer. Every
other sub-component depends on it. This is intentional: by making the Zustand
store the single source of truth, the system gains dirty-tracking for free
(any mutation sets a flag that triggers autosave), and undo/redo becomes
feasible (replay or reverse store actions). The cost is coupling -- nearly
every import chain passes through `store.ts`. This was accepted because the
alternative (each component owning its own state slice) would require manual
synchronization that is historically the #1 source of UI bugs in diagram tools.

## Trade-off: React Flow Coupling

The Diagram Rendering layer is tightly coupled to React Flow's data model
(Node, Edge, Position types). Migrating to a different canvas library would
require rewriting BlockNode, ArrowEdge, and Canvas. This coupling was accepted
because React Flow provides pan, zoom, minimap, snap-to-grid, and selection
for free. Building these from scratch would take months.

## Why Layout Is Separate from Structure

Position data (node.layout.json) is deliberately excluded from the structural
hash. Two consequences: (1) moving blocks around never creates a "dirty"
checkpoint, and (2) two users can arrange the same architecture differently
without merge conflicts in the YAML. The auto-layout engine (Dagre) provides
a "reset" when manual positioning gets messy.

## Open Questions

- Should the store use temporal middleware for true undo/redo?
- Should React Flow's internal state be the source of truth for positions,
  with the store as a write-behind cache, instead of the current two-way sync?
- Could the element editing panel become a plugin system for custom editors?
