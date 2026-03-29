The Version History system decomposes into four areas: checkpoint lifecycle
(orchestration), integrity validation (pre-commit checks), version comparison
(diff generation), and version browsing (UI). The core principle is that
checkpoints are immutable -- once archived, they cannot be modified, only
restored from.

## Key Architectural Decision: Archive-Based Checkpoints

Versions are stored as tar.gz archives of the entire tree directory, not as
incremental diffs. This makes restoration trivial (unpack and reload) and
each checkpoint fully self-contained. The cost is storage space: each
checkpoint is a full copy. For a typical architecture with ~50 canvases,
each checkpoint is roughly 50-200 KB compressed, so even 100 checkpoints
use less than 20 MB. If designs grow much larger, incremental storage
(like git packfiles) would be needed.

## Key Architectural Decision: Structural Hash Scope

The content hash (SHA-256) only covers `node.yaml` and `node.interfaces.ts`
files. Layout, notes, and Mermaid diagrams are excluded. This means:
- Rearranging blocks on the canvas does not create a new checkpoint-worthy
  change.
- Editing design notes does not trigger a hash change.
- Only structural modifications (adding/removing blocks, changing types,
  modifying contracts) are captured.

This aligns with the principle that architecture is about structure and
contracts, not presentation.

## Trade-off: No Branching

The version model is linear: a single sequence of checkpoints, latest wins.
There is no branching, merging, or parallel version tracks. This keeps the
mental model simple but means that restoring an old version and making changes
effectively discards everything after the restore point. Git branching at the
file level can supplement this if needed.

## Integrity Validation Details

Pre-checkpoint validation catches:
1. Broken arrow references (from/to pointing to non-existent block IDs)
2. Orphaned child flags (hasChildren=true but no child canvas node exists)
3. Contract reference violations (contract expressions referencing deleted blocks)

If any check fails, the checkpoint is rejected with a descriptive error
message. The user must fix the issue before they can archive.

## Open Questions

- Should checkpoints support user-provided labels/descriptions?
- Could the system automatically checkpoint on significant events (e.g.,
  after applying a batch of ACPs)?
- Should there be a "diff between any two checkpoints" feature, not just
  "current vs. last"?
