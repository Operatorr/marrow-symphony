# Design docs index

Deeper design notes for Marrow Symphony. Create a doc here lazily — only when there's something real
to write. Link new docs from this index with a one-line description and a status.

## Beliefs & decisions

- [core-beliefs.md](./core-beliefs.md) — agent-first operating principles for this repo. _stable_
- [`../adr/`](../adr/) — architecture decision records (`0001`–`0010`). _stable_
  Recent: `0007` Runner registry · `0008` Needs-Input detection · `0009` `marrow` context bus ·
  `0010` Workspace lifecycle hooks.

## UI

- [ui-io-spec.md](./ui-io-spec.md) — screen + IO spec for every user-facing surface (context for
  design tools). _all surfaces drafted; core IA resolved_
- [visual-language.md](./visual-language.md) — the aesthetic direction (Terax-inspired: B&W +
  cursor-reactive shaders, glass cards, rounded/borderless, monochrome shell + per-Project accents).
  _draft_
- [reference-design.md](./reference-design.md) — catalogue of the clickable Claude Design reference in
  [`marrow_symphony_reference_design/`](../../marrow_symphony_reference_design): screens, variants,
  tokens, and known divergences. _reference, not implemented_

## Integrations

- [linear-integration.md](./linear-integration.md) — Linear auth (API key + OAuth), field mapping,
  two-way sync phasing, and the last-write-wins conflict policy. _draft_

## Resolved (captured in CONTEXT.md / ADRs)

- Domain hierarchy: Group → Project → Issue → Workspace → Session, Runner, State Type — `CONTEXT.md`
- Agent driver: Runner-agnostic interactive terminals (embedded PTYs) — ADR 0002
- Persistence: local-first SQLite + materialized in-Workspace context — ADR 0003
- Workspace Strategy: Shared checkout | Worktree | Branch-in-place (last two git-only), per-Project
  default + per-Issue override — `CONTEXT.md`
- Automation: board-driven lifecycle, keyed off State Type
- Linear: optional, per-Project, two-way sync (phased); auth via API key + OAuth; last-write-wins
  conflicts with a sync log — see [linear-integration.md](./linear-integration.md)
- UI: three first-class views — Board (per-Project + global scope) · Cockpit (live-Session fleet) ·
  Feed (signature attention queue); reached via top-bar switch, Issue page on card click — ADR 0006,
  [ui-io-spec.md](./ui-io-spec.md)
- Session attention: best-effort inferred status (Running / Needs Input / Idle / Exited) with manual
  override, since Marrow is Runner-agnostic — ADR 0005, `CONTEXT.md`
- Session durability: GUI-owned PTYs + Runner resume tokens (no daemon)
- Non-git Projects: allowed in degraded mode (Shared checkout only); git-backed Projects unlock all
  strategies + branches/PRs/sync — `CONTEXT.md`
- Trust posture: Runners inherit user permissions; agent CLI approvals are the control; no sandbox —
  ADR 0004
- Concurrency: no hard cap; surface CPU/RAM + a soft, configurable warning threshold (human is the
  throttle)

## Open questions

The original architecture-level open questions are all resolved (see above). Remaining open items:

- **UI micro-decisions** — a few low-risk items remain (snooze duration, notification grouping,
  Cockpit tile-click default, whether Exited Sessions enter the Feed); tracked inline in
  [ui-io-spec.md](./ui-io-spec.md) under "Open questions & caveats".
- **Linear change-detection transport** — webhooks vs polling vs delta sync; see
  [linear-integration.md](./linear-integration.md).
