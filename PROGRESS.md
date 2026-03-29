# Architect v2 — Build Progress

## Phase 0: Skeleton
- [x] Project initialized
- [x] Types defined (src/modules/store/types.ts)
- [x] Store with mock data (gacha-service, 6 blocks, 5 arrows)
- [x] BlockNode component (type icon, status ring, contract badge, aggregate bar)
- [x] ArrowEdge component (label pill with {  } icon)
- [x] Canvas component (React Flow + drill-down)
- [x] Toolbar (breadcrumb, version indicator)
- [x] SidePanel + Inspector
- [x] App layout
- [x] Theme + styles (dark mode, full color system)
- [x] Rust backend stubs (6 commands)
- [x] EXIT: app launches, canvas renders, drill-down works

## Phase 1: Codebase Ingestion
- [ ] Static analysis scanner (dependency-cruiser)
- [ ] Code view rendering
- [ ] View toggle
- [ ] EXIT: real JS/TS project scans and renders

## Phase 2: File I/O + Autosave
- [ ] Rust commands implemented (read_workspace, write_files)
- [ ] YAML serialization with comment preservation
- [ ] Autosave flush (5s timer)
- [ ] Workspace init
- [ ] Load workspace on open
- [ ] EXIT: round-trip GUI → YAML → reopen → same state

## Phase 3: Design Versions + Delta
- [ ] Rust versioning commands
- [ ] cutVersion (archive + reset)
- [ ] Delta mode (D key toggle, clean nodes dimmed)
- [ ] Version indicator
- [ ] EXIT: cut v1, make changes, delta highlights, cut v2 resets

## Phase 4: Co-Design + Changesets
- [ ] LLM provider abstraction
- [ ] CLI provider
- [ ] Changeset parser
- [ ] Changeset promote/review
- [ ] Chat panel
- [ ] Changesets panel
- [ ] EXIT: full co-design loop with real CLI agent

## Phase 5: Design Tracks
- [ ] Track create/switch/merge
- [ ] Three-way merge conflict resolution
- [ ] Track switcher UI
- [ ] EXIT: fork, work, merge with conflict resolution

## Phase 6: Implementation Planning
- [ ] Planning agent invocation
- [ ] Task DAG parsing
- [ ] Implementation drawer UI
- [ ] EXIT: plan produces task DAG, drawer renders it

## Phase 7: Orchestrator + Execution
- [ ] DAG executor (topological sort, parallel spawn)
- [ ] Correctness checking (tsc + tests)
- [ ] Escalation tiers
- [ ] Task logging
- [ ] Manual + autopilot modes
- [ ] EXIT: autopilot runs 5+ tasks in parallel with escalation

## Phase 8: Verification + Post-Impl
- [ ] Verification phase
- [ ] Fix DAG generation
- [ ] Post-implementation changeset
- [ ] EXIT: end-to-end design → impl → verify → design update

## Phase 9: CLI
- [ ] All commands from PRD §13
- [ ] JSON output
- [ ] EXIT: every GUI operation has CLI equivalent

## Phase 10: Agent-as-Developer + Debate
- [ ] Autonomous mode
- [ ] Debate protocol
- [ ] EXIT: autonomous produces useful changesets

## Phase 11: Polish
- [ ] Command palette (Ctrl+K)
- [ ] Keyboard shortcuts
- [ ] Transitions and motion
- [ ] Error recovery
- [ ] Light theme
- [ ] AGENT_GUIDE.md generation
- [ ] EXIT: production-ready UX
