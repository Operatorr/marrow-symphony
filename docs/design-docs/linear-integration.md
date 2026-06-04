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

**v1 implementation note (exec-plan 0002):** the access token (personal API key or OAuth token) is
held in the **OS keychain** (macOS Keychain / Windows Credential Manager / Linux Secret Service) via
the `keyring` crate — it is **never** written to SQLite. The `linear_connection` row keeps only
non-secret metadata (`method` + `workspace_name`); a status check reads that row alone and so never
touches the keychain. A status check thus cannot trigger a keychain-access prompt; only operations
that call Linear (list/import) read the token back. Disconnecting deletes both the keychain entry and
the row. _(Earlier drafts stored the token in SQLite as a local-first shortcut; migration
`20260605000000_linear_credential_to_keychain` purges that column, so an existing connection must be
re-entered once after upgrading.)_

**OAuth CSRF (resolved):** the authorize request carries an unguessable, single-use `state` generated
server-side and held in memory; completing the flow requires the same `state` echoed back in the
redirect URL (constant-time compared, consumed on match). The user pastes the full redirect URL so
both `code` and `state` round-trip. OAuth **token refresh** remains a deferred hardening follow-up.

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
