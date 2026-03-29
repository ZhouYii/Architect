The Project Storage system decomposes into five areas: autosave engine
(debounced persistence), serialization layer (format conversion), native
filesystem bridge (Rust IPC), tree file organization (directory conventions),
and workspace metadata (config and state files).

## Key Architectural Decision: Tauri Native Bridge

All filesystem operations go through Rust commands invoked via Tauri IPC.
This is not optional -- the web frontend runs in a browser sandbox that
cannot access the filesystem directly. The Rust layer provides:
- **Compare-before-write**: Each file is read before writing; unchanged files
  are skipped. This prevents unnecessary disk I/O and avoids updating file
  modification times when nothing changed.
- **Deterministic hashing**: The hash algorithm walks files in sorted path
  order, ensuring the same content always produces the same hash regardless
  of filesystem enumeration order.
- **Archive management**: tar.gz creation and extraction use Rust's flate2
  and tar crates for reliable cross-platform compression.

## Key Architectural Decision: Human-Readable File Format

Designs are stored as YAML, not a binary format or database. This makes
the `.architect/` directory:
- Browsable with any text editor or terminal
- Diffable with standard Git tools
- Editable by AI agents without needing the Architect UI

The trade-off is that YAML parsing adds complexity (field normalization,
backward compatibility) and is slower than binary serialization. For the
expected design sizes (<1000 blocks total), this is not a bottleneck.

## Trade-off: Per-Canvas File Granularity

Each canvas level gets its own directory with its own node.yaml. This means
a change to one deep canvas does not touch files in sibling or parent
directories. The benefit is minimal merge conflicts in Git. The cost is that
loading the full tree requires reading many small files -- but the Rust
read_workspace command handles this efficiently with walkdir.

## Serialization Complexity

The serialization layer handles several non-obvious concerns:
- **Field name translation**: In-memory uses camelCase (hasChildren), on-disk
  uses snake_case (has_children). Ports use 'entry'/'exit' internally but
  accept legacy 'in'/'out' on read.
- **Optional field omission**: Empty arrays, undefined fields, and default
  values are omitted from YAML to keep files clean.
- **Contract nesting**: ContractSet objects are serialized with empty arrays
  omitted, so a block with no contracts produces no `contract:` key.
- **Backward compatibility**: Old field names (version -> last_checkpoint,
  last_major_hash -> last_checkpoint_hash) are accepted during deserialization.

## Open Questions

- Should the system support project-level `.gitignore` generation for the
  `.architect/` directory (ignoring layout and state files)?
- Could the serialization layer validate YAML against a JSON Schema on read?
- Should workspace.state.yaml be excluded from version control entirely,
  since it changes on every flush?
