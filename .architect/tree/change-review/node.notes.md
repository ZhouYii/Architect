The Design Review system is the gatekeeping layer that ensures no change
reaches the live design without human approval. It decomposes into five
areas: the proposal queue (buffering), suggestion presentation (inline cards),
diff rendering (modal overlay), change application (mutation engine), and
diff computation (pure comparison logic).

## Key Architectural Decision: Two Review Modalities

The system has two distinct review UIs for the same underlying purpose:

1. **Suggestion Cards** (inline in chat) -- for AI proposals. Each ACP gets
   its own card with Apply/Dismiss buttons. Cards appear contextually within
   the conversation that generated them.

2. **Merge Review Overlay** (modal) -- for version diffs. A flat list of
   all changes between two versions, with bulk accept/reject. This is a
   separate UI because reviewing 50 changes at once requires a different
   interaction pattern than reviewing 3 inline suggestions.

Both modalities funnel through the same change application engine, ensuring
consistent mutation behavior regardless of the source.

## Trade-off: Cross-Canvas Search in Application

When applying an ACP, the system searches all canvases to find the target
block by ID (`removeBlockFromAnyCanvas`, `updateBlockInAnyCanvas`). This
makes the AI's job easier (it doesn't need to specify which canvas a block
lives on), but scales O(canvases * blocks). For typical architectures (<100
canvases), this is negligible. For very large designs, a block-to-canvas
index would be needed.

## Trade-off: Conflict Detection Is Shallow

Conflict detection only checks whether two pending ACPs target the same
`target_id` on the same `target_canvas`. It does not check for semantic
conflicts (e.g., one ACP removes a block that another ACP's new arrow
references). Full semantic conflict detection would require simulating
both changes and checking for broken references, which is planned but not
yet implemented.

## Open Questions

- Should the merge review overlay support partial application (apply some
  diff entries, reject others, and keep the rest pending)?
- Could the diff computation detect renamed blocks (same label, different ID)?
- Should accepted ACPs be logged as an audit trail alongside the design?
