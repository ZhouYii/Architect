# State Synchronization - Implementation Notes

## Architecture Decisions

### Single Store as Coupling Magnet
The Zustand store intentionally owns ALL application state: canvas tree, selection, navigation, chat, ACPs, diff/merge, workspace metadata. This is the recognized trade-off documented in the Level 2 annotation: "the store becomes a coupling magnet -- nearly every module depends on it -- but this is accepted because the alternative (distributed state with manual sync) would be far harder to keep consistent."

### Middleware Stack Order
The middleware chain is `subscribeWithSelector(immer(fn))`. Order matters:
- **Inner (Immer)**: Applied to every `set()` call, enabling draft-based mutations
- **Outer (subscribeWithSelector)**: Enables `store.subscribe(selector, callback)` for watching specific fields

If reversed, the selector middleware would see Immer drafts instead of finalized state, breaking equality checks.

### Dynamic Import for Autosave
`wireAutosave()` uses `import('./lib/flush')` to avoid a circular dependency:
- `store.ts` defines the store
- `flush.ts` imports `useDesignStore` from store
- If `store.ts` imported `flush.ts` at the top level, it would be circular

The dynamic import defers the resolution until runtime, after both modules are loaded.

## State Shape

```
DesignStore
  +-- workspacePath: string | null
  +-- config: WorkspaceConfig | null
  +-- state: WorkspaceState | null
  +-- nodes: Record<ID, CanvasNode>     <-- main data
  |     +-- [canvasId]: CanvasNode
  |           +-- components: Block[]
  |           +-- connections: Arrow[]
  |           +-- layout: CanvasLayout
  +-- currentPath: ID                    <-- navigation
  +-- breadcrumb: BreadcrumbItem[]
  +-- selectedBlockId: ID | null         <-- selection
  +-- selectedArrowId: ID | null
  +-- dirty: boolean                     <-- persistence
  +-- version: string
  +-- diffEntries: DiffEntry[]           <-- merge review
  +-- showMergeReview: boolean
  +-- chatMessages: ChatMessage[]        <-- AI chat
  +-- chatLoading: boolean
  +-- pendingACPs: ACP[]                 <-- change proposals
```

## Performance Constraints

### Structural Sharing via Immer
Immer produces structurally shared objects: if only one block in a canvas changes, the other blocks keep the same object reference. This is critical for React.memo in BlockNode -- unchanged blocks don't re-render.

### Subscription Granularity
Components should use narrow selectors: `useDesignStore(s => s.selectedBlockId)` rather than `useDesignStore(s => s)`. The subscribeWithSelector middleware provides `subscribe(selector, callback)` for non-React contexts (e.g., autosave).

### No Undo/Redo Yet
The store does not implement undo/redo. The dirty tracking + checkpoint system provides coarse-grained version recovery. Fine-grained undo would require either Immer patches or a command pattern, neither of which is currently implemented.

## Edge Cases

### Demo Mode
When `workspacePath === '__demo__'`, flush operations are skipped. The store initializes with `createDemoData()` which provides a three-canvas hierarchy for testing.

### Concurrent Canvas Mutations
`addBlockToCanvas(canvasId, block)` allows adding to ANY canvas, not just `currentPath`. This is used by `applyACP` for decompose operations that create child canvases. However, `updateBlock` and `removeBlock` only operate on `nodes[currentPath]`, so the apply-acp module temporarily navigates to the target canvas and back.

### genId() Uniqueness
The ID generator uses `Date.now()` + a module-level counter. This is unique within a single session but NOT globally unique across sessions. For true uniqueness, block IDs should be user-provided slugs (like "game-server") rather than generated.
