# Needs-Input detection via terminal signals and a `marrow notify` sidecar

[ADR 0005] settled that Session attention is best-effort with a required manual override, but left the
detection *mechanism* open ("if [signals] grow non-trivial, record the chosen mechanism in a follow-up
ADR"). This is that follow-up. A Session enters **Needs Input** from three sources, all
terminal-centric and none of which parse the agent's protocol.

## Decision

1. **Terminal signals from the PTY stream.** The existing output-reader thread scans for **OSC 9 /
   OSC 777** notification sequences and the **terminal bell (BEL)** and flips the Session to
   `needs_input`. This is the same byte stream we already decode per chunk.
2. **An explicit `marrow notify` sidecar** the Runner calls from its hooks. `marrow` ships as a Tauri
   `externalBin`, PATH-injected into the Session; it writes one JSON line to a per-app **unix domain
   socket** the app listens on; the app resolves the Session via the injected `MARROW_SESSION_ID` and
   **re-emits the existing `session-status` event** (same path as the exit handler), so the Feed/ring
   update instantly. For `kind: claude`, activation is a one-time, **consented** `Stop` + `Notification`
   hook added to the user's global `~/.claude/settings.json` — hook layers *merge*, and `marrow notify`
   **no-ops when its env vars are absent**, so the user's non-Marrow Claude usage is unaffected.
3. **Manual override** (`set_session_status`) — the reliable fallback required by [ADR 0005].

Needs Input **clears when the human acts** (`write_to_session` → Running). A **`needs_input_since`**
timestamp (set on entry, nulled on clear) orders the Feed oldest-waiting-first ([ADR 0006]); there was
no backing column for that ordering before.

## Considered options

- **Parse each agent's JSON protocol / event stream** to know definitively when it wants input —
  rejected by [ADR 0002] (couples Marrow to specific agents).
- **A quiet-PTY timer as the primary signal** — rejected as primary: it also fires while the agent is
  merely thinking (high false-positive rate). Kept as a *deferred* universal fallback for Runners that
  emit no signal at all.

## Consequences

- Output-scraping (OSC/BEL here, plus the per-`kind` resume-token regex in [ADR 0007]) is the
  **terminal-centric observability** [ADR 0002] already anticipates — explicitly *not* protocol-speaking.
- Activation mutates the user's **global** Claude config; it is gated behind one explicit consent and is
  purely additive.
- The notify path needs `MARROW_SESSION_ID` + `MARROW_NOTIFY_SOCKET` in the Session's non-editable
  system env layer ([ADR 0007]).
- **Deferred to a later tuning ADR:** the quiet-PTY fallback timer and per-Runner prompt-regex
  `needs_input_patterns`.

[ADR 0002]: ./0002-runner-agnostic-interactive-terminals.md
[ADR 0005]: ./0005-attention-is-best-effort-not-protocol-read.md
[ADR 0006]: ./0006-three-view-ia-with-attention-feed.md
[ADR 0007]: ./0007-runner-registry-kind-keyed-editable-presets.md
