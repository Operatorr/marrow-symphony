# The `marrow` sidecar as the agent ↔ Marrow context bus

[ADR 0008] introduced `marrow` as a Tauri `externalBin` that writes to a per-app unix domain socket to
signal **Needs Input**. That same channel is the natural seam for the *missing half* of the product:
getting an Issue's task context **into** an interactive agent, and letting the agent write progress
**back** — and, when a Project is linked to Linear, making **Linear the two-way context bus** the
product is built around. We generalize `marrow` from a notify hint into the agent's whole interface to
Marrow, with **Marrow holding all credentials** and resolving where context lives (the local Issue
today, Linear later). This is Symphony's `linear_graphql` client-side tool (SPEC.md §10.5) re-expressed
for **interactive, Runner-agnostic** Sessions.

## Decision

- **`marrow` is the agent's CLI bridge to Marrow.** It runs inside the Session, addresses the app over
  the per-app unix socket from [ADR 0008] (env retained as `MARROW_NOTIFY_SOCKET` for continuity,
  though it now carries the full bus), and is scoped to the Session via `MARROW_SESSION_ID`. One JSON
  request/response per invocation. The agent *opts in* by calling it — Marrow never parses the agent's
  protocol ([ADR 0002]).
- **Verbs**, all resolved by Marrow (Session → Issue → Project):
  - `marrow notify [--needs-input|--done]` — the [ADR 0008] attention hint.
  - `marrow issue read [--json]` — prints the Issue's task context (title, body/description, State
    Type, acceptance criteria); the same content materialized to `.marrow/issues/<id>.md`, fetchable
    on demand mid-Session, not just at launch.
  - `marrow issue comment "<text>"` — writes context **back** (progress, a summary, a question).
  - `marrow diff` — the Workspace diff summary (shares the `workspace_diff` backend).
  - (room for `marrow handoff` / richer status later.)
- **Marrow owns auth and picks the backend per Project link-state**, with the agent's command line
  **unchanged** either way:
  - **Local-first (default; ships with the UI slice):** reads resolve against the Issue in SQLite +
    the materialized file; `comment` appends to a local **issue activity** store (a new
    `issue_comments` row: `issue_id`, `session_id`, `author`, `body`, `created_at`) surfaced on the
    Issue page.
  - **Linear (when the Project is linked; deferred to the Linear slice):** the same verbs proxy to
    Linear GraphQL using the Project's stored credentials — `issue read` pulls the Linear issue,
    `issue comment` posts a Linear comment. Only Marrow's backend changes.
- **`kind`-keyed MCP option ([ADR 0007] seam).** For MCP-capable kinds (`claude`, `codex`), Marrow MAY
  *additionally* expose the same read/comment/diff operations as an **MCP server** registered into the
  Runner's launch, so the agent calls them as native tools. The `marrow` CLI remains the **universal**
  mechanism for any `kind` (`generic`, Kimi, GLM, …) because "shell out to a command" works everywhere.

## Considered options

- **Hand each agent the Linear API token directly** (env / flat file) — rejected: token sprawl across
  N agents, no scoping or audit, and it isn't Runner-agnostic (every CLI configures creds differently).
  Marrow-mediation keeps one credential store and complements [ADR 0004]'s trust posture.
- **MCP-only bridge** — rejected as the *universal* mechanism: not every CLI speaks MCP. MCP is an
  additive nicety for kinds that support it; the CLI is the floor.
- **Parse the agent's stdout/protocol** to extract its questions and results — rejected by [ADR 0002]
  (couples Marrow to specific agents). An explicit `marrow` call is opt-in and agent-neutral.
- **One-way materialized files only** (the 0001 status quo) — rejected: gives input context but no
  write-back and no live Linear; the vision needs both directions.

## Consequences

- The same socket + `externalBin` from [ADR 0008] now carries **notify and context**; `marrow` grows
  subcommands, but the transport and auth model are unchanged.
- The UI slice ([`0002`]) ships the **local-backed** bus (the seam). The **Linear proxy** is a drop-in
  behind the same verbs, landed by the Linear-integration slice — so "write the prompt in Linear, hand
  it to the agent, agent writes back" becomes a **backend swap, not a UI or agent change**.
- New local backing: an `issue_comments` activity store (schema delta) surfaced on the Issue page; the
  materialized `.marrow/issues/<id>.md` stays the read side.
- Reinforces core belief #1 (knowledge in versioned, agent-legible files) and [ADR 0004] (the agent
  never holds secrets): context flows through one audited path.
- The Runner's non-editable **system env layer** ([ADR 0007]) already carries `MARROW_SESSION_ID` + the
  socket, so no new injection seam is needed.

[ADR 0002]: ./0002-runner-agnostic-interactive-terminals.md
[ADR 0003]: ./0003-local-first-sqlite-with-materialized-context.md
[ADR 0004]: ./0004-trust-posture-inherit-user-permissions.md
[ADR 0005]: ./0005-attention-is-best-effort-not-protocol-read.md
[ADR 0007]: ./0007-runner-registry-kind-keyed-editable-presets.md
[ADR 0008]: ./0008-needs-input-detection-terminal-signals-and-notify-sidecar.md
[`0002`]: ../exec-plans/active/0002-full-functional-ui.md
