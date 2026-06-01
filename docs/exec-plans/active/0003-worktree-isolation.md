---
status: draft
slice: worktree-isolation
created: 2026-06-02
---

# 0003 — Worktree isolation (opt-in) + Workspace setup hooks

> **Status: draft.** Queued *after* [`0002`](./0002-full-functional-ui.md). Specced now so the seams in
> 0002 (Workspace Strategy override UI, diff, the Runner's `{{branch}}`) land in the right shape.

## Goal

Implement the **Worktree** (and, lower-priority, **Branch-in-place**) Workspace Strategies as **opt-in**
per-Project / per-Issue policies, with **Shared checkout remaining the default and primary mode**.
Bring in the repo-owned **Workspace lifecycle hooks** ([ADR 0010]) so an isolated worktree is actually
usable (deps / env).

> **Design stance (deliberate):** worktree isolation is **off by default**. Shared checkout — working
> directly in the Project's own checkout — is the freer, primary mode and stays the default. Worktrees
> are the *opt-in* answer for users who want per-Issue isolation and clean per-Issue diffs/PRs. This is
> the inverse of tools like superset, where worktree-per-task is mandatory; in Marrow it is a choice.

## Definition of done

A user can set a **git-backed** Project's (or a single Issue's) Workspace Strategy to **Worktree**;
Start then creates a dedicated worktree + branch for the Issue, runs the Project's
`after_create`/`before_run` hooks, and launches the Runner cwd'd there. The Issue page shows the
worktree path + branch and a **per-Issue diff** (now well-defined against the branch's merge-base).
Cleanup (offered on `done`/`canceled`, or explicit) runs `before_remove` and removes the worktree,
guarding uncommitted changes. **Shared checkout is unchanged and remains the default**; non-git
Projects never see worktree options. `pnpm tauri dev` boots and the smoke check is green.

## Decision log

| Area | Choice | Why |
|------|--------|-----|
| Default | **Shared checkout stays the default**; Worktree/Branch-in-place are opt-in, git-only | Product design — shared checkout is the freer primary mode |
| Worktree layout | Dedicated worktree + unique branch per Issue; storage location + branch-name scheme TBD (see open questions) | Mirrors `git worktree` best practice; unique branch avoids double-checkout |
| Per-Issue diff | Diff vs the branch **merge-base** for worktree/branch strategies | Resolves the 0002 caveat that diffs are *workspace-level* (whole checkout) under shared checkout |
| Setup hooks | Repo-owned `.marrow/config.*` + a backend hook-runner ([ADR 0010]) | A fresh worktree has no deps; hooks make Start one-click |
| Runtime env caveat | Worktrees isolate **files**, not the OS runtime (ports, global caches) | superset's documented limitation; surface it, don't pretend otherwise |
| Merge / PR back | **Out of scope here** — its own later slice (ties to GitHub + Linear-branch) | Keep 0003 to create / use / diff / clean up |

## Steps (each keeps the app working and is independently mergeable)

### Step 0 — Repo-owned Workspace config + hook-runner ([ADR 0010])
- Parse `.marrow/config.*`; run `after_create` / `before_run` / `after_run` / `before_remove` via the
  login shell with a timeout and the ADR 0010 failure semantics; inject the system env layer. Wire into
  Start — **shared checkout benefits immediately** (e.g. `before_run` deps/env).
- **DoD:** a Project with hooks runs them at the right lifecycle points; a failing `before_run` aborts
  Start with a clear error.

### Step 1 — Worktree Strategy backend
- On Start with `strategy = worktree` (git-backed only): create the worktree + a unique branch, run
  `after_create` (first time) then `before_run`, launch the Runner cwd'd in the worktree, and record the
  Workspace (path + branch) on the Session/Issue.
- **DoD:** Starting a Worktree-strategy Issue runs the agent in an isolated worktree on its own branch.

### Step 2 — Per-Issue diff vs branch base
- Generalize `workspace_diff` to compute against the branch merge-base for worktree/branch strategies;
  keep the honest workspace-level summary for shared checkout.
- **DoD:** the Issue page / Feed show a per-Issue diff for worktree Issues; shared-checkout diffs stay
  labeled workspace-level.

### Step 3 — Strategy selection wired (UI already exists from 0002)
- Make the Project-default and Issue-override Strategy controls (rendered but gated in 0002) functional
  for git-backed Projects; show worktree path + branch on the Issue page.
- **DoD:** a user can switch a git-backed Project/Issue to Worktree and back.

### Step 4 — Cleanup lifecycle
- On `done`/`canceled` (offered, per 0002) or explicit removal: run `before_remove`, then
  `git worktree remove` + branch handling; refuse/guard when there are uncommitted changes.
- **DoD:** cleanup removes the worktree safely and never silently discards uncommitted work.

### Step 5 — (optional) Branch-in-place Strategy
- A dedicated branch checked out in the Project's own directory; only one such Issue active at a time.
- **DoD:** Branch-in-place works for a single active Issue; guards against a second.

## Explicitly deferred (NOT in this slice)
PR / merge-back flow · GitHub integration · Linear-branch naming sync · concurrency hard caps (the human
stays the throttle).

## Open questions
- **Worktree storage** — under `<project>/.marrow/worktrees/<issue-id>` vs a sibling dir outside the
  repo. (git-exclude implications either way.)
- **Branch naming** — e.g. `marrow/<issue-id>-<slug>`; collision policy.
- **Dependencies across worktrees** — `after_create install` vs symlinking shared caches; the
  shared-runtime caveat above.
- **Uncommitted-changes-on-cleanup** — block, stash, or prompt.

## Progress log
- 2026-06-02 — Drafted (`status: draft`) as the opt-in isolation slice queued after 0002. Worktrees are
  explicitly **off by default** per product design; folds in repo-owned Workspace hooks ([ADR 0010]).
  Not started.

[ADR 0010]: ../../adr/0010-workspace-lifecycle-hooks.md
