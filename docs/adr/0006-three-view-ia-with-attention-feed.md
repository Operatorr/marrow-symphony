# Three-view information architecture with an attention Feed

The frontend exposes **three co-equal first-class views**, switched from the top bar, rather than one
primary view with optional lenses:

- **Board** — Issues by State Type, with a scope toggle: a single Project (its own column labels) or
  **All Projects** (global, columns = the canonical State Types; cards color-coded by Project).
- **Cockpit** — the fleet: all live Sessions as embedded terminals, grouped by Project, with
  Needs-Input tiles highlighted.
- **Feed** — the signature surface: a TikTok/Reels-style queue that surfaces **one** Needs-Input
  Session at a time, full-screen with its Issue context; you act, it auto-advances to the next
  (oldest-waiting first).

This **supersedes** the earlier framing (in older `ARCHITECTURE.md` / design-index text) of the
"Session Cockpit as the single PRIMARY view and the Kanban Board as an optional per-Project lens."

## Why

The product's job is orchestrating **many concurrent agents** (it is normal to run ~20 Sessions
across ~4 Projects). Each view answers a distinct question: the Board *"what is the state of all my
work?"*, the Cockpit *"what's running?"*, the Feed *"which agent needs me right now?"*. The Feed is
the intended daily driver — it turns "babysitting 20 terminals" into a single triage queue.

## Considered options

- **One board with inline-expanding terminals** — rejected: doesn't scale to triaging ~20 agents and
  buries the "who needs me now" signal that the Feed makes primary.
- **Cockpit-primary, board as an optional lens** (the prior framing) — rejected: undersells the Board
  (which now has a first-class global scope) and predates the Feed.

## Consequences

- Hard-ish to reverse: it shapes the whole frontend and the Session data model (`status`,
  `needs_input_since` for Feed ordering — see [ADR 0005] and `ARCHITECTURE.md`).
- Full surface detail (layout, inputs, outputs, states) lives in
  [`../design-docs/ui-io-spec.md`](../design-docs/ui-io-spec.md).

[ADR 0005]: ./0005-attention-is-best-effort-not-protocol-read.md
