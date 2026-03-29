---
name: architect-map
description: >
  Maps any codebase into Architect's hierarchical design specification (.architect/tree/).
  Use this skill whenever the user wants to: reverse-engineer a codebase into a visual architecture,
  create an .architect/ workspace from existing code, understand a project's architecture by generating
  Architect spec files, "map this repo", "analyze this codebase structure", "generate architecture docs",
  or any request that involves converting source code into Architect's block/arrow/contract format.
  Also use when the user says "architect map", "map codebase", "reverse engineer architecture",
  "create design from code", or similar. Even if they just say "understand this project" or
  "what does this codebase do" — this skill produces structured, navigable architecture output
  that answers those questions far better than a prose summary.
---

# Architect Map — Codebase to Design Specification

You are mapping a codebase into Architect's structured design language. The output is a complete `.architect/` workspace that the Architect GUI can open and that implementation agents can read.

The key advantage you have over static analysis tools: you can **uplevel**. A code tracer sees function calls and directory names. You see *why* the system is structured the way it is, and you can name things by their purpose rather than their implementation.

**Critical: Do NOT mirror the file system.** The Architect spec is a *design document*, not a source tree browser. Blocks represent *concepts and responsibilities*, not files and directories. A reader should understand the system's architecture without ever having seen the code.

Bad block names: "src/lib/flush.ts", "commands.rs", "SidePanel.tsx"
Good block names: "Autosave Engine", "Design Persistence", "Element Inspector"

Bad annotations: "This file exports the flush() function which writes files"
Good annotations: "Ensures design edits are never lost — automatically persists the working copy to disk within 5 seconds of any change, using content-aware diffing to minimize I/O"

At the top level, explain what the system does in *business/user terms*. At the module level, explain *architectural decisions and trade-offs*. At the leaf level, document *invariants, contracts, and edge cases*. Every layer is written for a human reader who wants to understand the design, not navigate the code.

## How It Works

You scan the codebase in **breadth-first passes**, starting from the 10,000-foot view and working down. Each pass produces a complete `.architect/tree/` directory. You iterate, comparing each pass against the previous one, until the design converges (no meaningful structural changes between passes).

```
Pass 1: Identify top-level services/modules → root node.yaml
Pass 2: Decompose each block → child directories with their own node.yaml
Pass 3: Go deeper into sub-modules, identify interfaces between them
Pass 4+: Refine contracts, fill in gaps, add ports for cross-depth arrows
        → Converge when diff between passes is minimal
```

## Multi-Resolution Design

The hierarchy MUST have at least 3 levels. The exact number is up to you — use as many as the codebase warrants — but never fewer than 3. This is because the value of the spec comes from the *gradient* between abstract and concrete. Two levels is just "overview + details." Three or more levels create a genuine progressive disclosure that a reader can navigate at the resolution they need.

### The Abstraction Gradient

```
Level 1 (Root):     Pure concept. No code words. A product manager can read this.
                    "What does the system do? What are its major capabilities?"

Level 2 (Mid):      Architectural. An engineer new to the project reads this.
                    "How is each capability structured? What are the key boundaries and trade-offs?"

Level 3+ (Leaf):    Concrete. Maps to actual code interfaces, types, and contracts.
                    "What are the function signatures, invariants, and test cases?"

In between:         Gradual transition. Each level adds one step of specificity.
```

**The top level should be readable by someone who doesn't write code.** It describes what the system does, not how. "Visual Design Editor", "AI Co-Design Agent", "Design Version Control" — these are capabilities, not components.

**The bottom level should be useful to an engineer implementing a change.** It maps to actual interfaces, has `source_map` pointing to files, and carries contracts with test cases. This is where `flush()` and `invoke('write_files')` belong — never at the top.

**Middle levels bridge the gap.** They explain *architectural decisions*: why this boundary exists, what pattern was chosen, what the trade-offs were. An engineer reading the middle level understands the system well enough to know where to make a change, without yet knowing the specific function signatures.

### Labels at Each Level

| Level | Block labels | Arrow labels | Annotation tone | Intent connection |
|-------|-------------|-------------|-----------------|-------------------|
| Top (abstract) | Product capabilities: "Design Canvas", "Version Control" | Business relationships: "persists designs", "reviews changes" | What does a user get from this? | "How does this capability serve the program's users?" |
| Middle (architectural) | Responsibility areas: "State Synchronization", "Checkpoint Manager" | Interaction patterns: "subscribes to mutations", "archives on export" | Why this boundary? What trade-off? | "What architectural decision does this represent, and why is it the right choice for this kind of program?" |
| Bottom (concrete) | Implementation units: "YAML Serializer", "SHA-256 Hasher" | Code-level calls: "serializeNodeYaml(canvas)", "invoke('write_files')" | Invariants, edge cases, performance constraints | "What implementation constraints exist because of the program's specific requirements?" |

Arrow labels should **explain the relationship to a reader**, not just name it. At the top level, "persists designs to disk" is better than "calls write_files". At the bottom level, "invoke('write_files', {base, files})" is appropriate because the reader is now at the code level.

**Arrow labels describe the user's workflow, not the code's execution:**
- Top level: "user edits flow to disk", "AI suggestions enter review queue" (workflow language)
- Middle level: "dirty state triggers persistence", "checkpoint archives working copy" (architectural language)
- Bottom level: "invoke('write_files', {base, files})", "extractACPProposals(response)" (code language)

### Multiple Arrows Between Blocks

**When to use multiple arrows:**
- Two blocks have distinct types of interaction (e.g., reads AND writes, or sync calls AND event subscriptions)
- The sequence of calls matters for understanding the control flow
- Different arrows carry different interfaces (different request/response types)

**When to use a single bold arrow instead:**
- At high-level canvases where the detail would be noise
- For dependencies that happen at multiple points in the flow (not a single call)
- When the interaction is simple enough that one label captures it

## Input

The user provides a path to a codebase. If not specified, use the current working directory.

## Output

A complete `.architect/` directory inside the target codebase, containing:
- `workspace.yaml` — project metadata
- `tree/` — the hierarchical design (node.yaml, node.interfaces.ts, node.notes.md per canvas)
- `prompts/AGENT_GUIDE.md` — auto-generated agent instructions
- `checkpoints/cp-001.tar.gz` — initial snapshot

## Step-by-Step Procedure

### Phase 0: Reconnaissance

Before writing any spec files, understand what you're looking at.

1. **Read the project root**: package.json / Cargo.toml / pyproject.toml / go.mod / etc. Understand the language, framework, and dependencies.
2. **Read README and docs**: Get the business context. What does this project do? Who uses it?
3. **Scan the directory structure**: `find . -type f | head -200` or `ls -R`. Identify the major directories and what lives where.
4. **Identify entry points**: main files, CLI entry, HTTP server bootstrap, test runners.
5. **Read CLAUDE.md** if it exists — it often has the best summary of architecture and conventions.

Do NOT read every file. You're building a mental model, not ingesting the codebase. Read strategically: entry points, key types/interfaces, and module boundaries.

### Phase 0.5: Identify Program Intent

Before mapping any blocks, answer three questions:
1. **What is this program for?** Is it a game, a developer tool, a web service, a library, a CLI utility? Write one sentence.
2. **Who uses it?** End users, developers, operators, other systems?
3. **What problem does it solve?** What would the user have to do without it?

Write the answers in the root `node.notes.md`. Then use them as a lens for every description you write — every block annotation should connect back to how that block helps achieve the program's intent.

**Example for a design tool:**
- Intent: "A desktop app where humans and AI agents collaboratively design software architectures"
- Bad annotation: "Serializes CanvasNode objects to YAML using the yaml npm package"
- Good annotation: "Ensures every design edit is preserved — converts the live canvas into structured files that both humans and AI agents can read, modify, and version independently"

The intent frames everything. A game's "Rendering Engine" annotation would emphasize frame rates and player experience. A tool's "Persistence Layer" annotation would emphasize never losing user work. Same code structure, different framing.

### Phase 1: Root Canvas — "What does this system do?" (Level 1: Abstract)

This is the product-level view. A non-engineer should be able to read this canvas and understand what the system is for. No code words, no file names, no technical jargon without explanation.

Create the top-level `node.yaml` with 3-7 *capability* blocks. Not "what directories exist" but "what can this system do."

**Block naming**: Product capabilities only.
- "Design Canvas" not "React Flow wrapper"
- "AI Co-Design Agent" not "LLM integration module"
- "Design Version Control" not "workspace.ts + flush.ts"

**Arrow naming**: Business relationships.
- "persists designs to disk" not "calls write_files"
- "reviews and merges changes" not "runs diffCanvases"
- Use `weight: bold` for all root-level arrows — they're summary channels

**Annotations**: What does the user get from this block? Why does it exist from a product perspective?

Write `node.yaml`, `node.interfaces.ts`, and `node.notes.md`. The notes should be 1-2 paragraphs that could open an architecture document — something you'd show a VP of Engineering.

### Phase 2: Decompose to Architectural Level (Level 2: Structural)

Every root block MUST be decomposed (has_children: true). This is where the minimum-3-levels rule kicks in.

This level answers: "How is each capability structured? What are the key boundaries and trade-offs?"

**Block naming**: Responsibility areas and architectural boundaries.
- "State Synchronization" not "store.ts"
- "Checkpoint Manager" not "workspace.ts exportSnapshot()"
- "Interface Type System" not "types.ts"

**Arrow naming**: Interaction patterns and data flow.
- "subscribes to state mutations" not "useDesignStore((s) => s.dirty)"
- "archives tree on checkpoint" not "invoke('create_version_archive')"
- Use `weight: normal`, add `order` for control-flow sequences

**Annotations**: Why does this boundary exist? What architectural decision does it represent? What's the trade-off?

**When to decompose further vs. leave as leaf at this level:**
- Decompose if the block has 2+ distinct *responsibilities* (not just 2+ files)
- Leave as leaf if it does one conceptually coherent thing
- Every block that you leave as leaf here becomes a Level 3 concrete node

### Phase 2b: Decompose to Concrete Level (Level 3+: Implementation)

At least some Level 2 blocks should decompose further to Level 3. This is where the spec starts mapping to actual code.

**Block naming**: Implementation units — these CAN reference technical concepts.
- "YAML Serializer", "SHA-256 Hasher", "CLI Subprocess Spawner"
- Still prefer descriptive names over file names, but technical precision is welcome

**Arrow naming**: Code-level interactions, specific enough to implement against.
- "serializeNodeYaml(canvas) → YAML string"
- "invoke('write_files', {base, files}) → count"
- Use `order` extensively — at this level, control flow sequence matters

**Annotations**: Invariants, edge cases, performance constraints, implementation notes.

**Contracts**: This is where contracts live in full detail — invariants with expressions, pre/postconditions, test cases with inputs/outputs, all with `impl` blocks pointing to actual source files.

**source_map**: Every Level 3 block MUST have a `source_map` with the actual files and entry point. This is the bridge from design to code.

### Depth decision guide

You decide the exact number of levels. Use your judgment:

| Codebase size | Typical levels | Example |
|--------------|---------------|---------|
| Small (<20 files) | 3 | Root → 2 capability areas → leaf modules |
| Medium (20-100 files) | 3-4 | Root → capabilities → subsystems → implementation |
| Large (100+ files) | 4-5 | Root → domains → services → modules → implementation |

The rule: **every path from root to a leaf block must traverse at least 3 levels.** If you find yourself with a 2-level path (root → leaf), add an intermediate architectural level even if the code doesn't have an obvious directory boundary for it — group related leaves under a conceptual parent.

### Phase 3: Identify Cross-Depth Connections (Ports)

After decomposition, some arrows from the parent canvas connect to specific internal components. Add ports:

```yaml
# In the child's node.yaml
ports:
  - parent_arrow: parent-arrow-id
    direction: entry          # or exit
    bound_to: internal-component-id
    label: "Human-readable description"
    annotation: |
      Explain which internal component handles this
      external connection and why.
```

### Phase 4: Extract Contracts

For each block and arrow, identify:

**Invariants**: Rules that must always hold
- Look for assertions, validation logic, guard clauses
- Look for comments that say "must", "always", "never"
- Look for documented constraints in README/docs

**Preconditions**: What must be true before a call
- Look at input validation at function/method entry
- Look at auth/permission checks
- Look at type guards and null checks

**Postconditions**: What is guaranteed after a call
- Look at return type guarantees
- Look at side effects (writes to DB, emits events)
- Look at error handling contracts

**Test cases**: Extract from existing tests
- Map test descriptions to contract entries
- Use test inputs/outputs as the test case data
- Set `status: implemented` and fill the `impl` block with file/symbol references

For each contract entry, include:
```yaml
- id: inv-01
  description: "Human-readable description of the rule"
  expression: "Optional formal expression"
  status: implemented    # or draft if inferred but not tested
  impl:
    file: src/path/to/file.ts
    symbol: ClassName.methodName
    test_file: src/path/to/__tests__/file.test.ts
    test_symbol: "exact test description"
```

### Phase 5: Fill Source Maps

For each block, fill the `source_map` field linking design to code:
```yaml
source_map:
  files:
    - src/auth/token-manager.ts
    - src/auth/token-manager.test.ts
  entry_point: "src/auth/token-manager.ts:TokenManager"
```

### Phase 6: Convergence Check

After each full pass:

1. Compare the current `tree/` against the previous pass
2. Count structural changes: blocks added/removed/moved, arrows added/removed, contracts added
3. If changes < 5% of total elements, **converge** — the design is stable
4. If changes >= 5%, iterate with another pass, focusing on the areas that changed

Report to the user after each pass:
```
Pass N complete:
- Canvases: X (Y new, Z modified)
- Blocks: X total across all canvases
- Arrows: X total
- Contracts: X entries (Y implemented, Z draft)
- Changes from previous pass: N%
- Status: [converging / iterating]
```

### Phase 7: Finalize

Once converged:

1. Write `workspace.yaml` with project metadata
2. Generate `AGENT_GUIDE.md` from the workspace
3. Create the initial checkpoint (`cp-001`)
4. Report final statistics to the user

## File Formats

All output files must follow the Architect spec exactly. Reference files:

### node.yaml
```yaml
id: block-id                    # kebab-case
label: Human Label
type: service                   # service|module|class|function|data-store|external|queue|config
status: done                    # draft|approved|implementing|done|deprecated
owner: human
created_at: 2026-03-28T00:00:00Z
last_modified: 2026-03-28T00:00:00Z

components:
  - id: sub-block-id
    label: Sub Block
    type: module
    status: done
    has_children: false
    annotation: |
      What this does and why.
    tags: [relevant, tags]
    ports: []
    contract:
      invariants: []
      preconditions: []
      postconditions: []
      test_cases: []
    source_map:
      files: [src/path.ts]
      entry_point: "src/path.ts:ClassName"

connections:
  - id: arrow-id
    from: source-block
    to: target-block
    label: what this connection does
    type: calls
    direction: forward           # forward|backward|bidirectional
    order: 1                     # control-flow sequence (1=first, 2=second, ...)
    weight: normal               # normal|bold (bold = summary arrow at high level)
    interface:
      request: RequestType
      response: ResponseType
      async: false
      error_handling: throw
      protocol: rpc
    contract:
      invariants: []
      preconditions: []
      postconditions: []
      test_cases: []

ports: []                       # cross-depth bindings

groups: []                      # visual grouping
```

### node.interfaces.ts
```typescript
// Arrow: source-block → target-block
export type RequestType = {
  field: string;
};

export type ResponseType = {
  result: boolean;
};
```

### node.notes.md
```markdown
# Block Name

Brief overview of what this subsystem does and why it exists.

## Key Decisions
- Why this architecture was chosen
- Important trade-offs

## Open Questions
- Things that aren't clear from the code
```

### workspace.yaml
```yaml
schema_version: 1
project_name: "Project Name"
created_at: 2026-03-28T00:00:00Z
last_checkpoint: cp-001
last_checkpoint_at: 2026-03-28T00:00:00Z
last_checkpoint_hash: "sha256:..."
llm:
  preferred_provider: claude-code
  ollama_model: llama3
```

## Control Flow Ordering

When multiple arrows exist between blocks or within a canvas, assign `order` values to capture the control flow sequence:

```yaml
connections:
  - id: step-1
    from: user-action
    to: store
    label: dispatch mutation
    order: 1

  - id: step-2
    from: store
    to: flush-engine
    label: dirty → scheduleFlush
    order: 2

  - id: step-3
    from: flush-engine
    to: backend
    label: invoke write_files
    order: 3
```

Order values don't need to be contiguous — `1, 2, 5` is fine. They just establish relative sequence. Arrows without `order` are unordered dependencies.

## Important Principles

1. **Uplevel, don't trace.** This is the #1 rule. The value of this mapping is that you explain architecture in *human, conceptual terms*. A reader should understand each canvas in under 30 seconds without knowing the programming language. If a block label contains a file extension, class name, or function signature — you haven't upleveled enough.

2. **Name by purpose, not implementation.** Blocks are concepts and responsibilities. "Design Persistence" not "flush.ts + workspace.ts". "Agent Co-Design" not "llm/ directory". "Element Inspector" not "SidePanel.tsx". The source_map field links back to files — the label never should.

3. **BFS, not DFS.** Get the whole picture right at each level before going deeper. A correct top-level map with leaf blocks is more useful than a deeply traced single module with nothing else.

4. **Each canvas reads like a doc chapter.** A reader going root → child → grandchild should feel like they're reading an architecture document that progressively reveals detail. Each level should be self-contained and coherent. Don't assume the reader has read the parent canvas.

5. **Converge, don't perforate.** Each pass should improve the overall quality. Don't keep adding blocks forever — converge when the structure is stable and the descriptions are clear.

6. **Contracts are the handshake.** Every contract entry you extract from the code is a bridge between the design and the implementation. Prioritize contracts that are actually tested over inferred ones.

7. **source_map links design to code.** Every block should trace back to specific files via the `source_map` field. This is how implementation agents find what to modify. But the block *label* and *annotation* should never mention files — they describe the concept.

8. **Annotations explain the "why".** The YAML structure captures the "what" (blocks, arrows, types). The annotations and notes capture the "why" — design decisions, trade-offs, constraints. Good annotations answer: "Why does this exist? What problem does it solve? What would break without it?"
