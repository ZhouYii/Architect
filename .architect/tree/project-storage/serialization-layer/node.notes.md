# Serialization Layer - Implementation Notes

## Architecture Decisions

### YAML for Structural Data, JSON for Layout
`node.yaml` stores the semantic architecture (blocks, arrows, ports, contracts) in YAML for human readability and git-friendly diffs. `node.layout.json` stores positions in JSON because it's a simple key-value map that changes frequently and benefits from compact representation. This split means moving a block on the canvas (layout change) never modifies the structural hash.

### Snake_case on Disk, CamelCase in Memory
The serializer performs case conversion: `hasChildren` <-> `has_children`, `fromPort` <-> `from_port`, `toPort` <-> `to_port`. This is because YAML conventions use snake_case while TypeScript conventions use camelCase. The conversion is manual (not a generic transformer) to maintain explicit control over which fields map where.

### Backward Compatibility in Deserializer
The deserializer handles legacy field names:
- Port direction: `'in'` -> `'entry'`, `'out'` -> `'exit'`
- Workspace config: `'version'` -> `'last_checkpoint'`, `'last_major_hash'` -> `'last_checkpoint_hash'`

This allows older project files to be loaded without migration scripts.

### Optional Field Omission
The YAML serializer omits falsy/empty optional fields. For example, a block with no tags, no contract, and no annotation produces clean YAML with only `id`, `label`, `has_children`, and `ports`. This keeps files readable and reduces noise in git diffs.

## File Format Contracts

### node.yaml Structure
```yaml
id: <canvas-id>
label: <display name>
parent: <parent-canvas-id | null>
components:
  - id: <block-id>
    label: <name>
    has_children: <bool>
    ports: [...]
    type: <optional>
    status: <optional>
    annotation: <optional>
    contract: <optional>
    source_map: <optional>
connections:
  - id: <arrow-id>
    from: <block-id>
    to: <block-id>
    label: <optional>
    type: <optional>
    interface: <optional>
ports: <optional, canvas-level ports>
groups: <optional>
```

### node.layout.json Structure
```json
{
  "block-id": { "x": 100, "y": 200 },
  ...
}
```

## Performance Constraints

### serializeTreeToFiles Walk
The function iterates ALL canvases and ALL blocks in a single synchronous pass. For a project with N canvases and M blocks per canvas, it produces O(N * (2 + M)) files. This is called on every flush (every 5 seconds of inactivity), so it must be fast.

### Mermaid Generation
Mermaid diagrams are generated at checkpoint time only, not on every flush. This is because they are a derived artifact (not source-of-truth) and regeneration would add unnecessary I/O to the autosave path.

### Hash-Relevant vs Hash-Ignored Files
Per PRD section 8.2, the structural hash (computed in Rust) only considers:
- **Included**: `node.yaml`, `node.interfaces.ts`
- **Excluded**: `node.layout.json`, `node.notes.md`, `*.mermaid`, `*.tar.gz`

This means layout changes and notes edits don't change the structural hash, which is intentional: two users can arrange the same architecture differently without creating a hash mismatch.

## Test Coverage (from src/__tests__/)

### yaml.test.ts
- YAML round-trip: serialize -> deserialize preserves structure
- Backward compat: old 'in'/'out' directions normalize to 'entry'/'exit'
- Workspace config round-trip with all fields
- Workspace state round-trip
- serializeTreeToFiles: produces correct paths for root + child canvases
- serializeTreeToFiles: includes interface files when content exists

### mermaid.test.ts
- Simple canvas: generates valid graph LR with nodes and edges
- Type-appropriate shapes: data-store uses [()], external uses {{}}
- Empty canvas: produces just "graph LR"
- Arrows without labels: uses plain --> syntax

### commands.rs tests (Rust side)
- write_files + read_workspace round-trip
- write_files skips unchanged files (compare-before-write)
- compute_tree_hash: deterministic across calls
- compute_tree_hash: changes when structural files change
- compute_tree_hash: ignores non-structural files (notes, layout)
- archive + restore: tar.gz round-trip preserves content
- detect_changes: false when hash matches, true when structural files differ

## Edge Cases
- buildCanvasPath does NOT guard against infinite parentId loops. If canvas A's parentId points to canvas B and B's parentId points to A, the function will loop forever.
- serializeTreeToFiles generates node.interfaces.ts and node.notes.md at the CANVAS level (prefix), but the content comes from individual blocks. If multiple blocks in the same canvas have interfacesContent, they will overwrite each other's file (last block wins). This is a known limitation of the current file-per-canvas model.
