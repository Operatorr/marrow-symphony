# Runner-agnostic interactive terminals instead of a headless agent protocol

SPEC.md §10 drives a coding agent by spawning a headless subprocess (Codex app-server) and parsing
its JSON event stream to automate turns. Marrow instead spawns the agent's **real interactive CLI**
(`claude` TUI, `codex`, `kilo`, …) inside an **embedded PTY terminal** (xterm.js + the `portable-pty`
crate) and lets the human drive it. The chosen CLI — the **Runner** — is configurable per Issue.

**Decision:** Marrow is Runner-agnostic. It owns workspace + session lifecycle but speaks no agent's
protocol; the agent is an opaque interactive process in a terminal.

**Why:**
- **Subscription billing.** Headless `claude -p` is expected to move out of Claude Max usage limits
  into a separate balance (per product owner, ~June 2026). Running the *interactive* `claude` keeps
  work on the Max subscription. Calling the Anthropic API directly was rejected for the same reason
  (per-token API billing, not the subscription).
- **Tool choice per Issue.** Users can pick the best CLI for a given task rather than being locked to
  one vendor's protocol.

**Consequences:** Marrow cannot programmatically read agent turns/tokens the way Symphony does, so
observability is terminal-centric (session state, scrollback) rather than protocol-derived. Fully
*unattended* dispatch is out of scope by default because interactive CLIs wait for human input — see
the "board-driven lifecycle, human-in-the-loop" model.
