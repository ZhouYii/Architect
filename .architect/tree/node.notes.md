Architect is a desktop application for designing system architectures visually
and collaboratively with AI. Users draw diagrams made of labeled blocks and
arrows, drill into any block to see deeper layers of detail, and chat with AI
assistants that can read the current design and propose structural changes.
Every proposal goes through a review step where the user accepts or rejects
each modification before it touches the live diagram, keeping humans firmly in
control of the final architecture.

The design is continuously saved as a tree of human-readable files on disk --
one folder per level of the hierarchy, each containing diagram data, interface
definitions, and design notes. This structure is deliberately friendly to Git
and other version-control systems, so architecture diagrams can live alongside
the source code they describe. Named checkpoints let users snapshot the design
at meaningful milestones and compare any two points in time, with differences
surfaced through the same review workflow used for AI proposals.
