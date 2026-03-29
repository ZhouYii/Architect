# Element Editing - Implementation Notes

## Architecture Decisions

### Monolithic SidePanel Component
All editing tabs live in a single SidePanel.tsx component (~580 lines). This is a deliberate trade-off: it keeps all property editing logic colocated and avoids prop-drilling between small components, but makes the file large. Future refactoring could extract each tab into its own component file.

### Store-Mediated Editing
Editing NEVER directly mutates the rendered diagram. Every change goes through `store.updateBlock()` or `store.updateArrow()`, which:
1. Mutates state via Immer
2. Sets `dirty = true`
3. Triggers autosave subscription (`wireAutosave` in store.ts)

This indirection is the key architectural boundary: the editing UI doesn't know about persistence, and the persistence system doesn't know about the editing UI.

### Resizable Panel
The panel width is managed with local React state and window-level mousemove/mouseup listeners. The resize handle is a thin div on the left edge. Width is clamped to 280-700px. This is a simple implementation without virtualized scrolling.

## Edge Cases

### Selection Priority
When both a block and arrow could theoretically be selected, the code enforces mutual exclusion: `selectBlock` clears `selectedArrowId` and vice versa. The Details tab checks `selectedBlock` first, then `selectedArrow`, then falls back to "no selection" state.

### Contract Array Mutations
Contract editing creates new arrays on every change (spread + filter/map). This is intentional for Immer compatibility -- even though Immer allows mutation, the contract helper functions use immutable patterns because they were written before Immer was added.

### Interface Content Default
When `interfacesContent` is undefined, the textarea shows "// TypeScript interfaces\n" but does NOT write this default to the store until the user actually types. This prevents creating node.interfaces.ts files for blocks that never had interfaces edited.

## Performance Considerations
- The `versions` tab lazily loads version list only when the tab becomes active (useEffect on activeTab === 'versions')
- Contract dashboard iterates ALL nodes on every render; for large projects (100+ canvases) this could become slow
- No debouncing on text inputs -- every keystroke triggers a store mutation and dirty flag
