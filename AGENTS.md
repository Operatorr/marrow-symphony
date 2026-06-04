# Marrow Symphony — Agent Map

> This file is a **table of contents**, not a manual. It points you at the sources of truth.
> Keep it short. When something here grows past a pointer, move the detail into `docs/` and link it.

## What this is

A **Tauri 2 (Rust) + React 19** desktop app, package-managed with **pnpm**, that runs interactive
coding-agent CLIs against your work. You organize work into Projects and Issues, each Issue gets an
isolated Workspace, and you drive an agent inside an embedded terminal Session. The UI has **three
first-class views** — a **Board** (Issues by State Type), a **Sessions** view (the live-Session
fleet; formerly "Cockpit"), and a **Feed** (the signature surface: the next agent that needs you,
one at a time). See
`docs/design-docs/ui-io-spec.md`.

## Read these first

- **`CONTEXT.md`** — the domain glossary. Group, Project, Issue, Workspace, Workspace Strategy,
  Session, Runner, State Type. Use these words exactly; don't reintroduce avoided aliases.
- **`docs/adr/`** — architecture decisions and *why*. Start with `0001` (Symphony is an ancestor,
  not a contract).
- **`ARCHITECTURE.md`** — the system map: layers, domains, and how the Rust backend and React
  frontend split responsibilities.
- **`docs/design-docs/core-beliefs.md`** — the operating principles for working in this repo.
- **`docs/design-docs/index.md`** — deeper design notes and the current **open questions**.
- **`docs/design-docs/ui-io-spec.md`** — the screen + IO spec for every user-facing surface (the three
  views, Issue page, terminal frame, forms, attention model).
- **`docs/exec-plans/active/`** — the current build plans. Start here to implement:
  [`0002-full-functional-ui.md`](docs/exec-plans/active/0002-full-functional-ui.md) is the active
  slice (App Shell + Board + Sessions + Feed + Issue page, wired to live data).
  [`0001-scaffold-and-first-slice.md`](docs/exec-plans/active/0001-scaffold-and-first-slice.md) is the
  done tracer-bullet slice (scaffold → create Project → Issue → embedded agent terminal).

## Ancestor, not contract

`SPEC.md` ("Symphony") is a headless Codex/Linear orchestration daemon. Marrow Symphony **borrows its
orchestration core** (workspace model, issue/tracker model, observability ideas) and **deliberately
diverges** everywhere else: a GUI, interactive Runner-agnostic terminals instead of the Codex
app-server, local-first SQLite instead of no-DB, Linear optional instead of required. Do **not**
"fix" the code to conform to `SPEC.md`. See `docs/adr/0001`, `0002`, `0003`.

## Operating philosophy

We follow the agent-first practices in `docs/references/harness-engineering-codex-agent-first-world.md`:
push knowledge into the repo (if the agent can't see it, it doesn't exist), prefer boring/legible
tech, keep this map small, and let `docs/` be the system of record.

## Golden principles (enforce continuously)

1. **Agent legibility is the goal.** An Issue's task is materialized into its Workspace
   (`.marrow/issues/<id>.md`) so the Runner can read it; knowledge lives in versioned files.
2. **Runner-agnostic, human-in-the-loop.** Marrow hosts agent CLIs and owns workspace/session
   lifecycle; it never impersonates or speaks an agent's protocol.
3. **Local-first.** Everything works offline; Linear is an optional, opt-in two-way sync per Project.
4. **Boring tech the agent can model.** SQLite, Tauri, React, `portable-pty`, xterm.js.
