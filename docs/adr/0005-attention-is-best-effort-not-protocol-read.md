# Session attention is best-effort, not protocol-read

Because Marrow stays **Runner-agnostic** and never speaks an agent's protocol ([ADR 0002]), a
Session's **Needs Input** status is *inferred* from terminal signals — a quiet PTY, prompt-like
output matched against per-Runner `needs_input_patterns`, and opt-in OSC / `marrow notify` hints — not
read from the agent. We accept this is **best-effort** (false positives and misses are possible) and
therefore require a **manual override** as the reliable fallback: the user can force a Session to
Needs Input and can mute/dismiss false positives. This is why every attention surface (desktop
notifications, the Feed, status badges) treats the auto-signal as advisory and always offers manual
control.

## Considered options

- **Parse each agent's protocol / JSON stream** to know definitively when it wants input — rejected:
  it would couple Marrow to specific agents and break the Runner-agnostic contract ([ADR 0002]), which
  is a core belief.
- **Best-effort heuristics + manual override** (chosen) — keeps Marrow agnostic; honest about its
  limits.

## Consequences

- The four-state model (Running / Needs Input / Idle / Exited) cannot perfectly distinguish **Needs
  Input** from **Idle**; the UI must not pretend otherwise.
- Detection signals and their tuning are an engineering concern still to be settled; if they grow
  non-trivial, record the chosen mechanism in a follow-up ADR.

[ADR 0002]: ./0002-runner-agnostic-interactive-terminals.md
