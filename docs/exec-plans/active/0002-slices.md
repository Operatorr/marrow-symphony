# 0002 — Tracer-bullet slices

> Issue breakdown for [`0002-full-functional-ui.md`](./0002-full-functional-ui.md). Each slice is a
> thin vertical cut through every layer (schema → command → UI), independently mergeable and
> demoable. **Type:** `AFK` = ready for an autonomous agent (`ready-for-agent`); `HITL` = needs a
> human decision/review (`ready-for-human`).
>
> **Critical path:** 1 → 2 → 3 → 4 → (6, 7, 8, 9 parallel) → 13 → 14.
> **Parallelizable off their blockers:** 5 (`marrow` context bus, [ADR 0009]), 10/11 (Runner registry),
> 12 (shader).
>
> **Note:** the workspace **diff** (Slices 8–9) is *workspace-level* under shared checkout — the whole
> checkout's changes, not per-Issue. Per-Issue diffs become well-defined with worktrees, specced in
> [`0003`](./0003-worktree-isolation.md). Worktree isolation is **opt-in / off by default** by design.
>
> Not yet published to GitHub — this file is the staging ground.

---

## Slice 1 — Reference design tokens + theme foundation

**Type:** AFK · **Blocked by:** None — can start immediately · **Covers:** plan Step 0

### What to build
Port the reference token system (`marrow_symphony_reference_design/styles/colors_and_type.css`) into
the app's theme so every later surface inherits the right look. Bring in the neutral ramp, shell
semantics (`--bg-shell` / `--bg-working` / `--bg-glass*`), the single `--hairline`, the `--project-1…6`
accent palette, the status tokens (running / needs-input / idle / exited, incl. glow), Geist Mono for
code, and the radii / shadow / blur / motion / layout-rail variables. Keep 0001's **light *and* dark**
toggle — author a light-theme variant of the saturated accents/status tokens. Migrate Project color
from a stored hex to a `--project-*` palette index (hex retained as fallback), assigned on project
create.

### Acceptance criteria
- [x] The existing Sidebar/Board/Cockpit/Feed render with the reference tokens in **both** themes; the dark shell matches the reference mood.
- [x] `--project-1…6`, status tokens, Geist Mono, radii/shadow/blur/motion, and `--sidebar-w`/`--topbar-h` rails are all available as theme variables.
- [x] Projects render their accent from a palette index; existing Projects migrate without data loss.
- [x] The theme toggle still flips light/dark; `pnpm tauri dev` boots and the `ping` smoke check is green.

### Blocked by
None — can start immediately.

---

## Slice 2 — App Shell + chrome

**Type:** AFK · **Blocked by:** Slice 1 · **Covers:** plan Step 1

### What to build
The persistent shell: a topbar (logo · `[Board | Cockpit | Feed]` view switch · global Needs-Input
count · search · settings/Linear) and a 240px expanded sidebar (Group filter/accordions · Project
search · Project rows showing live/needs-input counts, a non-git marker, and a Linked-to-Linear badge,
with the selected Project highlighted). `⌘B` toggles the sidebar open/closed only (no mini-rail).
Selecting a Project sets the scope of the main view. Port the shared chrome atoms (status dot,
attention pip, needs pill, project chip, icon button, kbd, logo) as shadcn/Tailwind components.

### Acceptance criteria
- [x] Topbar view switch changes the main view; global Needs-Input count reflects live Sessions.
- [x] Sidebar lists Projects with live/needs counts + non-git/Linear badges; Group filter and search narrow the list.
- [x] `⌘B` collapses/expands the sidebar (open or closed, nothing in between).
- [x] Selecting a Project scopes the main view; `list_groups` (and minimal create/assign on Add Project) backs the Group filter.

### Blocked by
- Slice 1 (design tokens).

---

## Slice 3 — Shared terminal frame + manual Needs-Input override

**Type:** AFK · **Blocked by:** Slice 1 · **Covers:** plan Step 2 (frame)

### What to build
Refactor the xterm.js `TerminalPane` into the one shared terminal frame used everywhere, with an
optional chrome bar (status badge · Project ▸ Issue · Runner · elapsed) over the canvas and three
chrome densities (minimal for Cockpit tiles, full for Feed/Issue). Lifecycle controls: Kill, Restart,
Resume (Resume is fully wired in Slice 11; render it now). Add a manual **"mark Needs Input"** override
backed by a new `set_session_status` command (the reliable fallback required by ADR 0005), which flips
the status token + Needs-Input glow. Persist a per-Session **output ring buffer** (last N KB) in the
PTY reader and add a `get_session_scrollback` command so re-mounting the frame **replays recent
scrollback** — and so Cockpit/Feed previews can render without a live attach (Slices 7, 8).

### Acceptance criteria
- [x] One terminal component renders at all three chrome densities, host-selected.
- [x] Kill works against the existing command; Restart/Resume controls are present.
- [x] The manual override flips a Session to Needs Input (and back) and updates the accent/glow live.
- [x] Status is rendered from the new status/glow tokens.
- [x] A per-Session ring buffer retains recent output; `get_session_scrollback` replays it on remount.

### Blocked by
- Slice 1 (design tokens).

---

## Slice 4 — Automatic Needs-Input detection (terminal signals)

**Type:** AFK · **Blocked by:** Slice 3 · **Covers:** plan Step 2 + ADR 0008 §1

### What to build
Make a Session flip to Needs Input on its own, terminal-centrically (never by parsing the agent
protocol). The PTY output reader scans each chunk for **OSC 9 / OSC 777** notification sequences and
the **terminal bell (BEL)** and sets `needs_input`. Add a `needs_input_since` timestamp column (set on
entry, nulled on clear) to order the Feed oldest-waiting-first. Needs Input **clears when the human
acts** (`write_to_session` → Running).

### Acceptance criteria
- [x] A real `claude`/`codex` Session that emits an OSC/BEL notification flips to Needs Input automatically.
- [x] Typing into the terminal clears Needs Input back to Running.
- [x] `needs_input_since` is set on entry and cleared on resolution; it is queryable for Feed ordering.
- [x] Manual override (Slice 3) and auto-detection cooperate without flicker.

### Blocked by
- Slice 3 (shared terminal frame).

---

## Slice 5 — `marrow` sidecar: notifications + agent context bus ⭐

**Type:** AFK · **Blocked by:** Slice 4 · **Covers:** plan Step 2 + ADR 0008 §2 + **ADR 0009**

### What to build
The `marrow` external binary as the agent's whole bridge to Marrow — the seam that realizes the Linear
vision (prompt in → context back). Ship `marrow` as a Tauri `externalBin`, PATH-injected into the
Session, addressing the app over a per-app **unix domain socket**; the app resolves the Session via the
injected `MARROW_SESSION_ID`. Verbs:
- `marrow notify [--needs-input|--done]` — re-emits the existing `session-status` event so the
  Feed/sidebar update instantly. For `kind: claude`, offer a **one-time, explicitly consented**
  additive `Stop` + `Notification` hook in the user's global `~/.claude/settings.json`. `marrow`
  **no-ops when its env vars are absent**, so non-Marrow Claude usage is unaffected.
- `marrow issue read [--json]` — prints the Issue's task context (title/body/State Type/acceptance
  criteria; same content as the materialized `.marrow/issues/<id>.md`).
- `marrow issue comment "<text>"` — writes context **back**, appended to a new local **`issue_comments`**
  store (`issue_id`, `session_id`, `author`, `body`, `created_at`), surfaced on the Issue page (Slice 9).
- `marrow diff` — reuses the `workspace_diff` backend (Slice 8).

**Marrow holds all credentials** and resolves the backend per Project link-state: **local-backed in this
slice** (Issue in SQLite + materialized file + `issue_comments`); the **Linear proxy** behind the same
verbs is **deferred to the Linear slice** (the agent's command line never changes). For MCP-capable
kinds (`claude`/`codex`), exposing the same read/comment/diff ops as an **MCP server** is an optional
follow-on; the CLI is the universal mechanism for any `kind`.

### Acceptance criteria
- [x] `marrow notify` flips the addressed Session to Needs Input and the UI reacts immediately.
- [x] The Claude hook installs only after explicit in-app consent and is purely additive (existing hooks merged); declining/removing leaves the global config untouched.
- [x] With `MARROW_SESSION_ID` / `MARROW_NOTIFY_SOCKET` absent, `marrow` exits cleanly with no effect.
- [x] `marrow issue read` prints the resolved Issue's task context; `marrow issue comment` persists a row to `issue_comments` tied to the Session.
- [x] The agent never receives any credential; all resolution happens inside Marrow over the socket.

### Blocked by
- Slice 4 (Needs-Input status plumbing + socket/event). `marrow diff` reuses Slice 8's `workspace_diff`; surfacing comments uses the Issue page (Slice 9).

---

## Slice 6 — Board: both scopes + drag-to-transition lifecycle

**Type:** AFK · **Blocked by:** Slices 1, 2 · **Covers:** plan Step 3

### What to build
The Kanban Board in both scopes. **This Project** renders the Project's custom column labels; **All
Projects (global)** pools every Project's Issues into the canonical State-Type columns, color-coded by
`--project-*` with a Project badge. Look = v2 base + amber "Started" column + v1's rainbow outline on
Needs-Input cards. Includes the Add Issue form. Dragging a card sets its State Type and fires
**idempotent** lifecycle automation: a drop into a `started`-typed column launches a Session **only if
the Issue has no live Session**; `done`/`canceled` **offers** cleanup (kills live Sessions only on
confirm, never automatically); other transitions are state-only.

### Acceptance criteria
- [x] Both scopes render correctly; global pools Issues into canonical State Types, color-coded + badged.
- [x] Dragging a card persists its State Type via `transition_issue`; into `started` launches a Session iff none is live (no duplicates).
- [x] `done`/`canceled` prompts before any cleanup; declining leaves Sessions running.
- [x] Default `board_columns` are seeded on project create; `list_board_columns` and global `list_issues(null)` (with Project info) back the views.
- [x] Empty and non-git/degraded states render per the spec.

### Blocked by
- Slice 1 (tokens), Slice 2 (shell scope).

---

## Slice 7 — Cockpit (fleet overview)

**Type:** AFK · **Blocked by:** Slices 3, 4 · **Covers:** plan Step 4

### What to build
The fleet view: a scrollable set of Project groups (header: name · live count · attention count) over a
responsive grid of Session tiles with throttled terminal previews. Needs-Input tiles **glow and sort to
the front** of their group; group headers count attention. Support filtering by Session Status,
collapsing/reordering groups, and a tile click that **enlarges inline** with an explicit **Open in
Feed** action.

### Acceptance criteria
- [x] Live Sessions are grouped by Project with accurate live/attention counts.
- [x] Needs-Input tiles glow and sort first within their group.
- [x] Status filter and group collapse/reorder work; the empty state ("Nothing running") renders.
- [x] Tile click enlarges inline; Open in Feed routes to the Feed focused on that Session.

### Blocked by
- Slice 3 (terminal frame), Slice 4 (attention status/ordering).

---

## Slice 8 — Feed (attention queue) + workspace diff + snooze

**Type:** AFK · **Blocked by:** Slices 3, 4 · **Covers:** plan Step 5

### What to build
The signature surface: one Needs-Input Session at a time, full-screen, vertically paged. Header
(Project ▸ Issue · Runner · waiting elapsed · status), a context panel (the materialized task · the
Workspace branch · a **diff summary**), the focused terminal, and an action bar (Skip · Snooze · Open
in Cockpit · ✓ done). The advance loop is **oldest-waiting-first** (ordered by `needs_input_since`) and
excludes snoozed Sessions; `⌘↑/⌘↓` revisit. Inbox-zero is the celebratory rest state. Backend:
`workspace_diff` (a `git diff --stat`-style summary, degrading gracefully on non-git Projects) and a
minimal `snoozed_until` column (fixed default duration for now).

### Acceptance criteria
- [x] The Feed shows one Needs-Input Session, oldest-waiting first, excluding snoozed ones.
- [x] Acting (typing), Skip, and Snooze each advance to the next card; the queue count updates.
- [x] The context panel shows the task, branch, and a diff summary (or a clean degraded note on non-git).
- [x] Inbox-zero renders when nothing needs input.

### Blocked by
- Slice 3 (terminal frame), Slice 4 (`needs_input_since`).

---

## Slice 9 — Issue page

**Type:** AFK · **Blocked by:** Slices 3, 6 · **Covers:** plan Step 6

### What to build
The home for a single Issue, reached by clicking a Board card (replaces the main view, back-to-Board
affordance). Header (title · Project color/badge · column & State Type · Linear link) over a split:
main = the Session terminal(s), right rail = context (editable task, Workspace strategy/branch/path,
Runner ▾, diff). `update_issue` writes the task to SQLite (source of truth) and **full-rewrites** the
git-excluded `.marrow/issues/<id>.md` whenever the Workspace dir exists (so edits land even before the
first Session). Start / Stop / **+ New Session** supports **multiple Sessions per Issue** as tabs (extra
PTYs in the shared checkout). Override Runner / Workspace Strategy (git-only options gated) / column.

### Acceptance criteria
- [x] Clicking a Board card opens the Issue page; back returns to the Board.
- [x] Editing the task persists to SQLite and rewrites `.marrow/issues/<id>.md`.
- [x] Start/Stop and **+ New Session** create multiple concurrent Sessions shown as tabs.
- [x] Runner / Strategy / column overrides work; git-only Strategy options are gated on non-git Projects.
- [x] Not-started, Running, and degraded states render per the spec.

### Blocked by
- Slice 3 (terminal frame), Slice 6 (Board card navigation + transition).

---

## Slice 10 — Runner registry (table, migration, CRUD, picker/editor, generalized start)

**Type:** AFK · **Blocked by:** Slice 2 · **Covers:** plan Step 7 + ADR 0007 (core)

### What to build
Replace the hardcoded `claude` command with a real registry. A `runners(id, kind, name, launch_cmd,
resume_cmd, env_json)` table where `kind ∈ {claude, codex, generic}` is **immutable** (it selects
runner-specific integration code) and everything else is editable; seed presets `claude` / `codex` /
`kilo` plus custom. Migrate `projects.default_runner` → `default_runner_id` FK (`NOT NULL`,
`ON DELETE RESTRICT`) and `issues.runner_override` → `runner_override_id` FK (nullable,
`ON DELETE SET NULL`); add to `sessions` a soft `runner_id` (`ON DELETE SET NULL`), `runner_kind`, and
`resume_token` columns. CRUD commands + a picker/editor UI (presets + custom). Commands are shell
strings (user login shell) with **shell-escaped** `{{workspace}}` / `{{issueFile}}` / `{{branch}}` /
`{{resumeToken}}`; a non-editable **system env layer** (`MARROW_ISSUE_FILE`, `MARROW_SESSION_ID`,
`MARROW_NOTIFY_SOCKET`) injects beneath the Runner's `env_json`. Generalize `start_session` to resolve
(`COALESCE(override, default)`) and **snapshot** name/kind/command onto the Session row. Guard against
deleting the last Runner or a Project's default (reassign prompt).

### Acceptance criteria
- [x] Presets are seeded; a user can create/edit/delete custom Runners; `kind` is fixed once created.
- [x] The migration converts the string columns to FKs and backfills existing data without loss.
- [x] Starting a Session resolves the Runner and snapshots name/kind/command onto the Session.
- [x] Interpolated values are shell-escaped; the system env layer cannot be edited or shadowed by `env_json`.
- [x] Deleting a Runner used as a Project default is refused with a reassign prompt; the last Runner can't be deleted.

### Blocked by
- Slice 2 (shell — the picker/editor surface).

---

## Slice 11 — Runner resume-token capture + Resume action

**Type:** AFK · **Blocked by:** Slices 10, 4 · **Covers:** plan Step 7 + ADR 0007 (resume)

### What to build
Capture the resume token the CLI prints (e.g. `claude --resume <uuid>`) via a per-`kind` output regex
run in the PTY reader, storing it in `sessions.resume_token`. The **Resume** control re-runs the
Runner's `resume_cmd` with `{{resumeToken}}` filled, in the same Workspace, as a new Session;
**Restart** always re-runs a fresh `launch_cmd`. This avoids token-free `--continue` resuming the wrong
conversation under multi-session shared checkout.

### Acceptance criteria
- [x] A `kind`-specific regex scrapes the resume token from PTY output into `sessions.resume_token`.
- [x] Resume launches a new Session via `resume_cmd` with the captured token; Restart launches a fresh `launch_cmd`.
- [x] Resume is disabled/hidden when no token was captured; Restart is always available.

### Blocked by
- Slice 10 (registry + snapshot columns), Slice 4 (shared PTY output scanning).

---

## Slice 12 — Cursor-reactive shader + reduce-motion toggle

**Type:** AFK · **Blocked by:** Slices 1, 2 · **Covers:** plan Step 8

### What to build
Port the reference `shader.jsx` as a `<Shader/>` backdrop behind **shell / empty / Feed-ambiance**
surfaces only — never behind terminals, the Board grid, or Cockpit tiles (those stay solid and
high-contrast). Add a first-class **reduce-motion / disable-shader** setting with a reduced-motion CSS
fallback (thinned glass blur).

### Acceptance criteria
- [x] The shader animates behind shell/empty/Feed-ambiance surfaces and is absent on working surfaces.
- [x] The reduce-motion/disable-shader toggle fully stops the shader; the app stays calm and usable with it off.
- [x] `prefers-reduced-motion` is respected by default.

### Blocked by
- Slice 1 (tokens), Slice 2 (shell placement).

---

## Slice 13 — Alert-color decision (3 sample treatments)

**Type:** HITL · **Blocked by:** Slices 7, 8 · **Covers:** plan Step 9 (decision)

### What to build
Resolve the one undecided visual: the alert color. Produce three sample treatments — (a) Neon Cyan,
(b) animated rainbow, (c) warm amber — rendered on the real Cockpit/Feed/shell attention surfaces so the
choice can be made **by eye**. The Board card treatment is already fixed (rainbow outline + amber Started
column); this governs the alert color everywhere else.

### Acceptance criteria
- [x] Three toggleable alert-color samples exist on real attention surfaces (Cockpit/Feed/shell).
- [x] A human selects the alert color; the choice is recorded (decision-log/ADR note).

### Blocked by
- Slice 7 (Cockpit), Slice 8 (Feed) — surfaces to sample on.

---

## Slice 14 — Cross-cutting states + final verification pass

**Type:** AFK · **Blocked by:** Slice 13 · **Covers:** plan Step 9 (polish)

### What to build
Apply the chosen alert color across Cockpit / Feed / shell counts & pills, then sweep the cross-cutting
states from the spec — empty, loading (skeletons), error (inline + retry), degraded (non-git), and
offline (Linear-only impact) — across every surface. Run the manual verification checklist and confirm
the full demo flow.

### Acceptance criteria
- [x] The chosen alert color is applied consistently across all non-Board attention surfaces.
- [x] Empty / loading / error / degraded / offline states render correctly on every surface.
- [x] The full demo flow (add Project → Issue → Board drag → Session → Cockpit/Feed → Issue page) works end-to-end.
- [x] `pnpm tauri dev` boots and the `ping` smoke check is green.

### Blocked by
- Slice 13 (alert-color decision).
</content>
