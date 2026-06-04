# Linear integration

> **Status:** _draft._ Linear is optional and per-Project; everything works offline without it
> (local-first, [ADR 0003](../adr/0003-local-first-sqlite-with-materialized-context.md)). For
> vocabulary see [`../../CONTEXT.md`](../../CONTEXT.md).

## Auth (resolved)

Marrow supports **both** auth methods from v1, abstracted behind a single "Linear connection" whose
`auth_method` is `api_key | oauth`:

- **Personal API key** — user pastes a key; simplest path.
- **OAuth app flow** — "Connect" button → redirect (Tauri loopback server or a custom deep-link
  scheme) → token exchange → **token refresh**. Requires registering a Linear OAuth app
  (client id/secret).

**Secret handling (SPEC §15.3):** tokens are **never logged**. The credential layer exposes only
"get a valid token for connection X."

**v1 implementation note (exec-plan 0002 follow-up):** the connection (method + token) is persisted
**locally in SQLite** (`linear_connection`, single row), not the OS keychain. This is a deliberate
local-first v1 choice — the credential never leaves the machine and is never logged, satisfying the
hard SPEC §15.3 requirement ("do not log tokens"). The OS-keychain aspiration above is **deferred**;
moving the token to the keychain (e.g. the `keyring` crate) and OAuth token refresh are tracked as
hardening follow-ups, not part of the current slice.

## Mapping

- Linear **project/team** ↔ Marrow **Project** (the link target).
- Linear **workflow states** (typed: backlog/unstarted/started/completed/canceled) ↔ Marrow board
  columns by **State Type** — this is why automation keys off State Type, not labels (`CONTEXT.md`).
- Linear issue fields (title, description, priority, labels, assignee, identifier) ↔ Marrow Issue.

## Sync model (phased)

Local-first, per-Project, opt-in, **two-way**:

- **Phase 1:** import Linear issues as Marrow Issues; push Marrow state changes (column moves) back to
  Linear. One-directional-feeling but both ways for state.
- **Phase 2:** fuller field sync (description, labels, comments, etc.).

## Conflict policy (resolved)

When an Issue diverges on both sides between syncs: **last-write-wins by `updated_at`, per Issue.**
Marrow records every overwrite in a visible **sync log** so nothing is silently lost (overwrites are
recoverable from the log). This requires **change detection**: persist a last-synced snapshot +
timestamps per linked Issue.

Rejected for v1: field-level 3-way merge (too much machinery for a single user) and manual
conflict-resolution UI (interrupts flow). The sync log keeps last-write-wins safe enough; revisit if
real conflicts prove common.

## Open

- **Change detection transport** — webhooks (Linear push) vs polling vs Linear's delta sync. Desktop
  apps often can't receive webhooks easily; polling on a cadence may be simplest. Decide before
  building Phase 1.
