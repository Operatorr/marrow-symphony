# Local-first SQLite store with Issue context materialized into each Workspace

Symphony is deliberately DB-less: scheduler state is in-memory and recovery is tracker- plus
filesystem-driven (SPEC.md §2.1, §14.3), because it polls Linear as the source of truth. Marrow is
local-first — you manage Groups, Projects, and Issues offline, with Linear an optional two-way sync —
so it needs durable local state of its own.

**Decision:** A central **SQLite** database in the app data directory holds Groups, Projects, Issues,
board state, and Linear sync metadata. Additionally, when a Workspace is prepared, Marrow writes the
Issue's context (title, description, links, acceptance criteria) into an **issue-scoped, git-excluded**
file inside the working dir — `.marrow/issues/<issue-id>.md`, with `.marrow/` added to git exclude —
and points the Runner at it via an env var (`MARROW_ISSUE_FILE`) and/or a seeded first line.

The path is issue-scoped (not a fixed `ISSUE.md`) precisely so it survives the **Shared branch**
Workspace Strategy, where multiple Issues run in the *same* checkout in parallel; git-excluding
`.marrow/` keeps materialized context from ever being committed or churning a shared branch. See
[Workspace Strategy](../../CONTEXT.md).

**Why:**
- SQLite is "boring," ubiquitous, and well-represented in training data — the harness-engineering doc
  favors exactly this kind of agent-legible dependency.
- Materializing context honors that doc's central principle: *anything the agent can't access
  in-context effectively doesn't exist.* A DB-only design would leave the in-Workspace Runner blind
  to its task.

**Considered and rejected:** *In-repo files as the source of truth* (issues as markdown in every
Project repo) — maximally legible/portable, but makes cross-project board queries and Linear
sync-state awkward and writes Marrow files into every managed repo. We keep SQLite as the source of
truth and treat the in-Workspace file as a derived, agent-facing projection.
