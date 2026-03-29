# Architect — Visual System Design Tool

Tauri v2 + React 19 + TypeScript desktop application for visual system architecture design with AI co-design capabilities.

## Tech Stack

- **Backend:** Rust (Tauri v2) — 7 IPC commands in `src-tauri/src/commands.rs`
- **Frontend:** React 19 + TypeScript, @xyflow/react 12 (React Flow), Zustand 5 + Immer 10
- **Data format:** YAML for design data, TypeScript for interfaces
- **Build:** Vite, TypeScript strict mode
- **LLM:** CLI-first (spawns `claude`, `opencode`, `ollama` as subprocesses) — zero API key management, zero LLM SDK deps

## Commands

```bash
npx tauri dev          # Full app (Rust + Vite HMR)
npx tauri build        # Production build
npm run dev            # Vite dev server only (no Rust)
npm run build          # Frontend build only
cargo test --manifest-path src-tauri/Cargo.toml   # Rust tests
```

## Source Layout

```
src-tauri/
  src/commands.rs      # 7 Tauri commands (all backend logic)
  src/lib.rs           # Plugin registration + command handler
  src/main.rs          # Entry point
  capabilities/        # Tauri v2 security permissions
src/
  types.ts             # Block, Arrow, Canvas, Workspace, ACP, DiffEntry
  store.ts             # Zustand + Immer store (single store, all state)
  components/
    Canvas.tsx          # React Flow wrapper — maps store state to nodes/edges
    BlockNode.tsx       # Custom node (block with type icon, status dot, contract badge)
    ArrowEdge.tsx       # Custom edge (labeled arrow)
    PortNode.tsx        # Cross-depth port boundary node (entry/exit)
    Breadcrumb.tsx      # Canvas hierarchy navigation
    Toolbar.tsx         # Controls + checkpoint badge
    SidePanel.tsx       # Tabbed panel (details, interfaces, notes, contracts, chat, versions, dashboard)
    ChatPanel.tsx       # LLM chat with streaming + inline ACP suggestions
    MergeReview.tsx     # Diff review modal (accept/reject changes)
    SuggestionCard.tsx  # ACP proposal card (Apply wires to applyACP)
    Settings.tsx        # App settings modal
    TreeNavigator.tsx   # Collapsible tree sidebar showing all canvases
    ContractDashboard.tsx # Aggregated contract completion stats
    InitWizard.tsx      # Workspace creation/open wizard (shown on first launch)
  lib/
    flush.ts            # Autosave engine (5s debounce → Rust write_files + workspace.state.yaml)
    workspace.ts        # Load/init/export workspace + AGENT_GUIDE.md generation
    yaml.ts             # YAML serialization/deserialization with backward compat
    diff.ts             # Custom diff engine (Block/Arrow/decomposed detection)
    acp.ts              # ACP parsing from LLM responses
    apply-acp.ts        # Apply ACP changes to canvas tree (all 9 kinds)
    contracts.ts        # ContractSet validation (invariants/pre/postconditions)
    mermaid.ts          # Mermaid diagram generation (node.diagram.mermaid)
    auto-layout.ts      # Dagre-based DAG layout with barycenter crossing minimization
    chat.ts             # Async per-canvas LLM chat (survives navigation)
    llm/
      provider.ts       # LLMProvider interface
      cli-provider.ts   # CLIProvider (spawns CLI via tauri-plugin-shell)
      registry.ts       # Provider detection + lookup
      prompts.ts        # System prompts for co-design
  styles/
    globals.css         # All styles + CSS custom properties + dark theme
skills/
  architect-map/
    SKILL.md            # Codebase-to-spec mapping skill
```

## Conventions

- **State:** All state mutations go through Zustand actions. Never modify state directly.
- **Immer:** All store actions use Immer's mutable-style syntax (write `s.foo = bar`, not spread).
- **React Flow:** Node/edge state is derived from the Zustand store via `useMemo`. React Flow's internal state is synced back to the store on drag-end and connect.
- **Tauri commands:** All 7 commands are `async` and return `Result<T, String>`. Call via `invoke()` from `@tauri-apps/api/core`.
- **Parameter naming:** JS uses camelCase, Rust uses snake_case. Tauri auto-converts between them.
- **File format:** YAML for design data (`node.yaml`, `workspace.yaml`), JSON for layout (`node.layout.json`), TypeScript for interfaces (`node.interfaces.ts`), Markdown for notes (`node.notes.md`), Mermaid for diagrams (`node.diagram.mermaid`).
- **Checkpoints (not versions):** Immutable snapshots named `cp-001`, `cp-002`, etc. Stored as `.tar.gz` in `.architect/checkpoints/`.
- **Arrow direction:** `forward` (markerEnd), `backward` (markerStart), `bidirectional` (both markers).
- **Arrow weight:** `normal` (strokeWidth 2) or `bold` (strokeWidth 4).
- **Arrow order:** Integer field for control-flow sequencing within a canvas.
- **Per-canvas chat state:** `chatMessagesByCanvas`, `chatLoadingByCanvas`, `chatUnreadByCanvas` maps in the store, keyed by canvas path.

## Architecture Decisions

- **Tauri over Electron:** 30-50 MB idle vs 150+ MB. Rust backend gives native-speed hashing/archiving.
- **CLI-first LLM:** No API keys in the app. The user's existing `claude`/`opencode`/`ollama` CLI handles auth.
- **Custom diff engine:** Block/Arrow data model is specific enough that generic diff libraries (json-diff, etc.) produce noisy results. The custom engine (~80 lines) compares by entity ID and reports field-level changes.
- **Hierarchical canvas:** Each Block can contain a sub-Canvas. Double-click drills down, breadcrumb navigates back. `key={currentPath}` on ReactFlow prevents stale state.
- **Autosave + compare-before-write:** Rust `write_files` reads existing content before writing. Skips unchanged files. Keeps flush under 100ms even for large workspaces.
- **Multi-handle arrow routing:** 4 sides × 3 handles per node, position-aware assignment picks the closest handle pair for each connection.
- **Per-canvas async chat:** Each canvas has independent LLM chat state that survives navigation. Parallel conversations across canvases.
- **Activity indicators:** Yellow dot = streaming response in progress, green dot = unread response ready.
- **Auto-layout via Dagre:** Left-to-right DAG layout with barycenter reordering pass for crossing minimization.

## Tauri v2 Specifics

- **Capabilities** (not allowlist): Security permissions live in `src-tauri/capabilities/default.json`. Misconfiguration causes silent permission denials.
- **Shell scoping:** Each CLI tool (claude, opencode, ollama) must be explicitly listed in capabilities with `"args": true` to allow arbitrary arguments.
- **Plugin registration:** Plugins are registered in `lib.rs` via `.plugin()` calls. Only ONE `.invoke_handler()` — multiple calls override each other.
- **Import path:** `invoke()` comes from `@tauri-apps/api/core` (NOT `@tauri-apps/api/tauri` which was v1).

## Gotchas

- **React Flow CSS:** Must import `@xyflow/react/dist/style.css` or the canvas renders as a blank div.
- **Windows CLI wrappers:** Tools installed via npm may be `.cmd` wrappers. The shell plugin's `Command.create()` uses the scope name (e.g., `run-claude`), not the binary name directly.
- **Async Rust commands:** Any command doing file I/O must be `async` to avoid blocking the UI thread.
- **First build:** Initial `npx tauri dev` takes 3-5 minutes (compiles Rust + WebView2 bindings). Subsequent builds are incremental.

## Workspace Directory (.architect/)

```
.architect/
  workspace.yaml          # Git-tracked config
  workspace.state.yaml    # Gitignored ephemeral state
  checkpoints/            # Immutable snapshots (cp-001.tar.gz, ...)
  changes/                # ACP proposals
    pending/              # Unreviewed (gitignored)
    accepted/             # Audit trail (git-tracked)
    dismissed/            # Audit trail (git-tracked)
  prompts/AGENT_GUIDE.md  # Comprehensive agent guide (~150 lines, auto-generated)
  tree/                   # Living design tree (working copy)
    node.yaml             # Root canvas
    node.interfaces.ts    # TypeScript types for arrows
    node.notes.md         # Design notes
    node.layout.json      # Gitignored (GUI positions)
    node.diagram.mermaid  # Gitignored (auto-generated on checkpoint)
    game-server/
      node.yaml
      ...
```
