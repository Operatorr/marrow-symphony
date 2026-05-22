# Trust posture: Runners inherit user permissions; the agent CLI's approvals are the control

SPEC.md §15 requires every implementation to state its trust boundary explicitly. Marrow Symphony is
a single-user local desktop tool that hosts interactive, Runner-agnostic agent CLIs
([ADR 0002](./0002-runner-agnostic-interactive-terminals.md)).

**Decision:** Runners run with the **user's own OS permissions** — the trust boundary is the user's
account, exactly as if they ran the CLI by hand. The safety control is the **agent CLI's own approval
mechanism** (e.g. claude's permission mode, codex's approval policy), surfaced in the interactive
terminal where the human can see and answer it. Marrow adds **no sandbox, container, or path
restriction** of its own.

**Why:** It is honest about what the tool is, matches SPEC §15's "high-trust" example, preserves the
interactive UX, and reflects that most agent CLIs expect full filesystem/network access. This ADR is
the §15 documentation of that posture.

**Consequences:**
- A confused or malicious agent can do anything the user can. The mitigations are the CLI's approval
  prompts plus a human watching the terminal — Marrow is **human-in-the-loop by default** and does
  not run unattended ([ADR 0002](./0002-runner-agnostic-interactive-terminals.md)).
- **Shipped Runner presets MUST NOT default to blanket auto-approve flags** (e.g.
  `--dangerously-skip-permissions`); a user may opt into them per Runner, knowingly.
- Sandboxing is a deliberately deferred future option, most relevant only if Marrow ever grows an
  unattended mode.
