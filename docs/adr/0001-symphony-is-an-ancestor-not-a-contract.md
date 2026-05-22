# Symphony (SPEC.md) is an ancestor, not a conformance target

`SPEC.md` describes "Symphony": a headless, unattended daemon that drives the **Codex app-server**
over a JSON protocol, **requires Linear**, keeps **no database**, and explicitly lists a rich GUI
as a non-goal. Marrow is a desktop product whose three defining pillars — a Tauri GUI with an
optional Kanban view, **Claude Code (and other CLIs) driven interactively**, and a **local-first**
model where Linear is optional — each contradict one of those Symphony requirements.

**Decision:** We treat `SPEC.md` as the intellectual reference for the orchestration *core* only
(workspace model §9, the Issue/tracker model §4/§11, concurrency and observability ideas) and write
our own product spec for everything else. Marrow is **not** a conforming Symphony implementation and
should not be "corrected" to become one.

**Why this is recorded:** A future reader or agent that opens `SPEC.md` first will reasonably assume
the code is meant to conform to it, and may try to reintroduce Codex, the poll-and-dispatch loop, or
the DB-less constraint as "fixes." This ADR marks those divergences as deliberate. See
[0002](./0002-runner-agnostic-interactive-terminals.md) and
[0003](./0003-local-first-sqlite-with-materialized-context.md) for the specific departures.
