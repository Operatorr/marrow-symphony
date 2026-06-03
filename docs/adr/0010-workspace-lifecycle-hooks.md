# Repo-owned Workspace lifecycle hooks (setup / teardown)

Real Runners usually need environment prep before the agent is useful — install dependencies, copy a
`.env`, start a service — and cleanup afterward. 0001/0002 only prep the Workspace directory and write
the materialized Issue file. Both Marrow's ancestor (SPEC.md §9.4 hooks) and superset (project
setup/teardown scripts) have this. We adopt a small, **repo-owned** hook set. Implementation is
**deferred to the Worktree slice ([`0003`])**, where it matters most — a freshly created worktree has
no `node_modules` — but the mechanism is Workspace-Strategy-independent and helps shared checkout too.

## Decision

- A Project MAY define lifecycle hooks, run via the user's **login shell** ([ADR 0004]) cwd'd to the
  Workspace, each with a timeout:
  - `after_create` — once, when a Workspace directory is first created (e.g. install deps in a new
    worktree).
  - `before_run` — before each Session launch (e.g. refresh env).
  - `after_run` — after a Session ends.
  - `before_remove` — before Workspace cleanup.
- **Repo-owned and versioned** ([core belief #1]): hooks live in-repo (e.g. `.marrow/config.{toml,json}`
  — exact format decided in [`0003`]), **not** in the app DB, so they travel with the Project and an
  agent can read them.
- **Failure semantics** mirror the ancestor: `after_create` / `before_run` failure **aborts** the
  launch; `after_run` / `before_remove` failures are **logged and ignored** (cleanup still proceeds).
- Hooks run with the same non-editable **system env layer** ([ADR 0007]) the Runner gets
  (`MARROW_ISSUE_FILE`, `MARROW_SESSION_ID`, `MARROW_NOTIFY_SOCKET`).

## Considered options

- **Store hooks in SQLite** — rejected: not versioned, invisible to the repo and the agent; breaks
  "knowledge lives in versioned files."
- **No hooks; users prep manually** — rejected: a fresh worktree with no deps is unusable, defeating
  one-click Start.
- **Adopt Symphony's full `WORKFLOW.md` contract** — rejected: that is the headless-daemon contract
  ([ADR 0001] — ancestor, not contract). We take only the hook concept.

## Consequences

- Implementation lands in [`0003`] alongside worktrees (the case that most needs
  `after_create`/`before_run`), but shared checkout benefits from `before_run` immediately.
- Adds a small backend **hook-runner** + a repo config schema (defined in [`0003`]).
- A failing `before_run` becomes a first-class Start error surfaced to the user.

[ADR 0001]: ./0001-symphony-is-an-ancestor-not-a-contract.md
[ADR 0004]: ./0004-trust-posture-inherit-user-permissions.md
[ADR 0007]: ./0007-runner-registry-kind-keyed-editable-presets.md
[core belief #1]: ../design-docs/core-beliefs.md
[`0003`]: ../exec-plans/active/0003-worktree-isolation.md
