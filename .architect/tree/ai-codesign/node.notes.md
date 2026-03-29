The AI Co-Design system decomposes into four areas: conversation presentation,
LLM provider abstraction, prompt context assembly, and response parsing. The
key design principle is that the AI never touches the live design -- it can
only propose changes that flow through the review gate.

## Key Architectural Decision: CLI-Based Provider Model

Instead of embedding HTTP SDK clients for each AI service, the system spawns
CLI tools (claude, opencode, ollama) as subprocesses via Tauri's shell plugin.
This has several advantages: (1) authentication is handled by the CLI tool's
own config, not by Architect; (2) new providers can be added without shipping
new dependencies; (3) the user's existing tool setup just works. The trade-off
is that streaming is line-buffered (not token-buffered), and advanced features
like tool calling or structured output modes are unavailable.

## Trade-off: Permissive Parsing

The proposal extraction layer uses a "best effort" approach: it looks for
YAML fenced code blocks, tries to parse them, and silently skips failures.
This means the user always sees the AI's full response even if the YAML is
malformed. The cost is that sometimes valid suggestions are missed because
of minor formatting issues. A stricter parser would catch more proposals but
would also produce confusing error messages when the AI's YAML is close but
not quite right.

## Flush-Before-Prompt Guarantee

A critical invariant: `flush()` is called before every LLM prompt. This
ensures the AI sees the exact state that is on disk, not a stale cached
version. Without this, the AI could propose changes that conflict with
recent edits that haven't been saved yet.

## Open Questions

- Should the system support multi-turn conversations with message history
  sent to the LLM, or is each message a standalone prompt?
- Could structured output (JSON mode) replace the YAML-in-fences extraction?
- Should there be an "explain this block" mode that doesn't propose changes?
