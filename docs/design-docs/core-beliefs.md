# Core beliefs

The agent-first operating principles for Marrow Symphony, distilled from
[`../references/harness-engineering-codex-agent-first-world.md`](../references/harness-engineering-codex-agent-first-world.md)
and the decisions in [`../adr/`](../adr/). These are the lens for design and review.

1. **Agent legibility is the goal.** Anything an agent can't access in-context effectively doesn't
   exist. Push knowledge into versioned files; materialize an Issue's task into its Workspace so the
   Runner can read it. We optimize the repo for agent navigation first.

2. **Runner-agnostic, human-in-the-loop.** Marrow hosts interactive agent CLIs and owns
   workspace/session lifecycle. It never speaks an agent's protocol or impersonates the human; the
   human approves and steers inside the terminal. ([ADR 0002])

3. **Local-first; Linear is optional.** Every feature works offline against the local SQLite store.
   Linear is an opt-in, per-Project two-way sync — never a requirement.

4. **Boring tech the agent can model.** Prefer composable, API-stable, well-represented tools
   (SQLite, Tauri, React, `portable-pty`, xterm.js) over clever or opaque ones. Reimplementing a
   small, fully-owned helper can beat depending on an opaque package.

5. **Symphony is an ancestor, not a contract.** Borrow its orchestration core; don't conform to its
   non-goals. ([ADR 0001])

6. **Enforce boundaries, allow local freedom.** Be strict about data shapes at boundaries, the
   backend-domain split, and the State-Type-driven automation contract. Be permissive about how any
   one module is written, as long as it's correct and legible.

7. **Keep `AGENTS.md` a map, not a manual.** When a pointer grows into prose, move the prose into
   `docs/` and leave a link. Stale monolithic guidance is worse than none.
