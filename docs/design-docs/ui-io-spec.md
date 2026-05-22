# Marrow Symphony — UI / Screen + IO Spec

> **Status:** _all surfaces drafted; the core information architecture is resolved. A handful of
> micro-decisions remain open — see "Open questions & caveats" at the end._
>
> **Purpose.** Implementation-agnostic description of every user-facing surface — its layout, the
> **inputs** the user acts on, and the **outputs** (data + states) it shows — detailed enough to hand
> to a visual design tool (e.g. Claude Design) as context. This is *not* a style guide and *not* the
> data/IPC contract; for domain vocabulary see [`../../CONTEXT.md`](../../CONTEXT.md), for the system
> map [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md).
>
> Uses the canonical nouns from `CONTEXT.md` exactly: **Group, Project, Issue, Workspace, Session,
> Runner, State Type**. The terminal is the UI surface that *shows* a Session.

## How each surface is documented

For every surface below:

- **Purpose / when shown** — what job it does and how the user gets here.
- **Layout** — regions and their arrangement.
- **Inputs** — controls, gestures, forms, shortcuts the user acts on.
- **Outputs** — the data displayed and the states it can be in.
- **States** — empty / loading / error / degraded variants.
- **Navigation in & out** — how you arrive and where you can go.

---

## 0. Global shell  _(resolved)_

A single desktop window (Tauri). Two persistent regions plus a switchable main view. Designed for
**scale**: it is normal to run ~20 live Sessions across ~4 Projects at once.

```
┌──────────┬────────────────────────────────────────────┐
│ [Group ▾]│  top bar:  [ Board | Cockpit | Feed ]  …acts│
│ search…  ├────────────────────────────────────────────┤
│ • proj A │                                              │
│ • proj B │   MAIN VIEW = one of:                        │
│ • proj C │     • Board   (scope: This Project | All)    │
│          │     • Cockpit (fleet: all live Sessions)     │
│ [+ Proj] │     • Feed    (one attention-needing Session │
│ [⌘B]     │                at a time; advance to next)   │
└──────────┴────────────────────────────────────────────┘
```

- **Sidebar** — left, persistent, **collapsible via `⌘B`**. A **flat list of Projects** with a
  **Group filter** and search; Issues are not shown here (you work with them in the main view). See §1.
- **Main view** — exactly one of **three distinct views** at a time:
  - **Board** — Kanban over Issues, scope toggle **This Project** vs **All Projects (global)**.
    *"What is the state of all my work?"*
  - **Cockpit** — the fleet: all live Sessions (embedded terminals) across Projects, attention-
    highlighted; scan and jump to any. *"Show me everything running."*
  - **Feed** — guided attention queue: surfaces **one** Session that needs action at a time,
    full-screen; handle it and the next slides up (TikTok / Reels style). *"Just feed me the next
    agent that needs me."*
- **View switch** — `[ Board | Cockpit | Feed ]` toggle (top bar). _(placement/behaviour: pending)_

> The three views answer three different questions. A desktop **notification** (Session enters its
> attention state) deep-links into the **Feed**, focused on that Session. _(linkage: pending)_

---

## 1. Sidebar  _(resolved)_

**Purpose / when shown** — always present unless collapsed (`⌘B`); the primary navigator and
scope-setter for the main view.

**Layout** — top→bottom: Group filter control, Project search, the flat Project list, an
"+ Add Project" affordance. Issues are **not** listed here.

**Inputs**
- **Group filter** — segment/dropdown filtering the Project list to one Group (or "All"). Groups are
  organizational only; a Project belongs to at most one.
- **Project search** — filter the list by name.
- **Select a Project** — sets the main-view **scope**: Board shows that Project's Issues; Cockpit/Feed
  filter to its Sessions.
- **Add Project** — opens the Add Project dialog (§7). Inline add/rename/assign-Group — placement
  pending.
- **Collapse** — `⌘B`.

**Outputs (per Project row)**
- Name + a **non-git/degraded** marker when the Project isn't a git repo.
- **Live-Session indicator** — a count/dot when the Project has running Sessions, plus an **attention**
  accent when any of them needs input (feeds §8).
- **Linked-to-Linear** badge when applicable.
- Selected Project highlighted.

**States** — Empty (no Projects → prominent "Add your first Project" CTA); Loading / Error standard (§9).

**Navigation in & out** — selecting a Project scopes the main view; the Board's scope toggle can
override to **All Projects (global)**, which clears the single-Project highlight.

> Resolved: flat Project list + **Groups as a filter** (not tree nodes); Issues never in the sidebar.

## 2. Board view  _(resolved)_

**Purpose / when shown** — the state overview of Issues. Entered from the top-bar `Board` toggle, with
a scope toggle **This Project | All Projects (global)**.

**Layout**
- **This Project** — the Project's own **custom column labels** (e.g. "Doing", "Code Review"), each
  backed by a **State Type**.
- **All Projects (global)** — columns are the **canonical State Types**: Backlog · Todo · Started ·
  In Review · Done · Canceled. Issues from every Project are pooled into these columns. *Nothing new is
  invented — the global board just groups by the State Type each Project's columns already carry.*

Every Issue card is **color-coded by its Project** (a per-Project color), with a Project badge — the
primary way to disambiguate cards in the pooled global columns. (Same Project color is reused as the
sidebar dot and Cockpit group accent.)

```
[ This Project | All Projects ]
Backlog   Todo    Started     In Review   Done
┌──────┐ ┌─────┐ ┌────────┐  ┌──────┐
│🟦 web│ │🟩api│ │🟦 web ⚠│  │🟧doc │      🟦=webapp 🟩=api
│🟩 api│ │     │ │🟪 infra│  │      │      🟧=docs  🟪=infra
└──────┘ └─────┘ └────────┘  └──────┘
```

**Inputs**
- **Scope toggle** — This Project / All Projects.
- **Drag a card between columns** — sets the Issue's **State Type**; this fires lifecycle automation:
  into a `started`-typed column → prep Workspace + launch the Runner (a new Session); `done`/`canceled`
  → offer cleanup. Identical in both scopes. (Board-driven lifecycle, keyed off State Type — never the
  label.)
- **Add Issue** — opens the Add Issue form (§7) into the current Project (or pick a Project in global).
- **Open a card** — Issue detail; if it has a live Session, route to Cockpit/Feed.
- Optional column/Project filters and search.

**Outputs (per card)** — Issue title; **Project color + badge**; **Session Status** indicator if a
Session is live; Runner; optional Workspace branch / Linear-link badge.

**States**
- **Empty** — no Issues: "Add your first Issue."
- **Degraded** — a non-git Project still boards normally; only its Workspace-Strategy options are
  limited (surfaced in the Add Issue form, not the board). See §9.
- Loading / Error standard (§9).

**Navigation in & out** — a card with a live Session hands off to the Cockpit (§3) / Feed (§4);
dropping into a `started` column launches a Session.

## 3. Cockpit view (fleet overview)  _(resolved)_

**Purpose / when shown** — the fleet: see everything running at a glance and jump to any one Session.
Entered from the top-bar `Cockpit` toggle. Shows Sessions across all Projects by default; selecting a
Project in the sidebar filters to that Project's Sessions.

**Layout** — a scrollable area of **Project groups**. Each group: a header (Project name · live-Session
count · attention count) over a **responsive grid of Session tiles**.

```
webapp ───── 3 live · 1 ⚠ ──────   api ───── 2 live · 1 ⚠ ──
┌───────┐┌───────┐┌───────┐        ┌───────┐┌───────┐
│ MAR-7⚠│┌ MAR-2 │┌ MAR-9 │        │ AP-3 ⚠│┌ AP-1  │
│ term… ││ term… ││ term… │        │ term… ││ term… │
└───────┘└───────┘└───────┘        └───────┘└───────┘
```

**Inputs**
- **Click a tile** — enlarge to drive it inline, or **Open in Feed**. _(enlarge-inline vs route-to-Feed
  default: pending.)_
- **Per-tile actions** — focus/type, kill Session, Open in Feed.
- **Collapse / reorder Project groups**; optional **filter by Session Status**.
- Sidebar Project selection filters the fleet to one Project.

**Outputs (per tile)** — a live (throttled) **terminal** preview; **Issue** label; **Session Status**
badge; **Runner**; elapsed/running time. **Needs Input** tiles get a glowing border and **sort to the
front of their Project group**; group headers count attention.

**States**
- **Empty** — no live Sessions: "Nothing running — start an Issue from the Board." 
- Loading / Error standard (§9).

**Navigation in & out** — a tile hands off to the **Feed** (§4) or enlarges in place; a group header can
jump to that Project's **Board** (§2).

## 4. Feed view (attention queue)  _(resolved)_

**Purpose / when shown** — hands-light triage of the agents that need you. The product's signature
surface: surfaces **one** Needs-Input Session at a time, full-screen, with enough context to act
immediately. Entered from the top-bar `Feed` toggle or by clicking a desktop notification (deep-links
to that Session).

**Layout** — one card at a time, vertically paged:

```
┌──────────────────────────────────────────────┐
│ webapp ▸ MAR-7 "Fix auth retry"  claude  2m ⚠ │  header
├───────────────────────────────┬──────────────┤
│                               │ Issue task    │
│   terminal (focus — type here)│  (.marrow/    │
│   > apply this patch? (y/n)   │   issues/…)   │  context
│                               │ branch: mar-7 │  panel
│                               │ diff: +24 −3  │
├───────────────────────────────┴──────────────┤
│  [Skip]  [Snooze]  [Open in Cockpit]  [✓ done]│  action bar
└──────────────────────────────────────────────┘
            ▲ swipe / ⌘↑↓ to revisit · "3 more waiting"
```

**Inputs**
- **Type into the terminal** — the primary action; resolves the agent's prompt.
- **Skip** — move on without acting; stays in queue.
- **Snooze** — drop it out of the Feed for a while (re-enqueues later). _(duration model: pending.)_
- **Swipe / scroll ↑↓ (or ⌘↑/⌘↓)** — revisit the previous card or peek ahead without losing place.
- **Open in Cockpit** — jump to the fleet view focused on this Session.
- **Mark reviewed / done** — for an **Exited** Session surfaced for review _(whether Exited enters the
  Feed: pending — see §8)_.
- **Manual "needs me"** override available (per §8).

**Outputs**
- Header: **Project ▸ Issue** title · **Runner** · **waiting-for** elapsed · **Session Status** badge.
- Context panel: the **Issue task** (materialized `.marrow/issues/<id>.md`), the **Workspace** branch,
  a **recent diff** summary.
- The live terminal (see §6).
- **Queue position / count remaining** ("3 more waiting").

**Advance loop** — _resolved:_ act → the Session leaves **Needs Input** (you typed → Running) **or**
you Skip/Snooze → the next **Needs Input** Session auto-slides up. Ordered **oldest-waiting first**. If
a Session returns to Needs Input later, it re-enters the queue.

**States**
- **Inbox zero** (empty) — "No agents need you" celebratory rest state; the Feed's healthy default.
- Single-card (normal); Loading; the Snoozed list. (Standard error → §9.)

**Navigation in & out** — from the `Feed` toggle or a notification; "Open in Cockpit" hands off to §3
focused on the same Session.

## 5. Issue page  _(resolved)_

**Purpose / when shown** — the home for a single Issue: read/edit its task, manage its Workspace, and
drive its Session(s). Reached by **clicking a card** on the Board; **replaces the main view**, with a
back affordance to the Board.

**Layout** — a header (Issue title · Project color/badge · current column & State Type · Linear link)
over a split: **main = the Session terminal(s)**; **right rail = context**.

```
← Board   webapp ▸ MAR-7 "Fix auth retry"   [Started ▾]   ⤴Linear
┌──────────────────────────────────┬───────────────────┐
│ Session: claude  ● Needs Input    │ Task (editable →   │
│ ┌──────────────────────────────┐ │  .marrow/issues/…) │
│ │  terminal                    │ │ Workspace:         │
│ │  > apply patch? (y/n)        │ │  worktree · mar-7  │
│ └──────────────────────────────┘ │ Runner: claude ▾   │
│ [Start] [Stop] [+ New Session]    │ Diff: +24 −3       │
└──────────────────────────────────┴───────────────────┘
```

**Inputs**
- **Edit the task** — saved to the materialized `.marrow/issues/<id>.md`.
- **Start** — preps the Workspace per the Issue's Workspace Strategy and launches the Runner (a new
  Session). **Stop / Kill** a Session. **+ New Session** — another terminal in the same Workspace (an
  Issue may own multiple Sessions → tabs/stack).
- **Override Runner**; **override Workspace Strategy** (Worktree / Branch-in-place gated to git-backed
  Projects); **change column / State Type** (mirrors a board drag — fires the same lifecycle).
- **Open in Cockpit / Feed**; **back to Board**.

**Outputs** — the task; the **Workspace** (strategy · branch · path); the list of **Session(s)** with
**Session Status**; live terminal(s) (§6); a recent **diff**; Linear link when applicable.

**States**
- **Not yet started** — no Session: prominent **Start** CTA, task visible.
- **Running** — live terminal; **multiple Sessions** → tabs.
- **Degraded** — non-git Project: Strategy locked to Shared checkout; git-only controls hidden (§9).
- Loading / Error standard (§9).

**Navigation in & out** — from a Board card; back to the Board; a live Session is equally reachable
from the Cockpit (§3) / Feed (§4).

## 6. Embedded terminal frame  _(resolved — shared component)_

**Purpose / when shown** — the visual surface that *shows* a Session (xterm.js). Reused, with varying
chrome, inside Cockpit tiles (§3, minimal), Feed cards (§4, full), and the Issue page (§5, full).

**Layout** — an optional chrome bar (**Session Status** badge · Project ▸ Issue label · Runner ·
elapsed) above the terminal canvas. Chrome density is set by the host.

**Inputs** — keystrokes forwarded to the PTY; resize reflows the PTY; scrollback scroll; copy / paste;
find; **lifecycle: Kill · Restart · Resume** (via the Runner's resume token); clear; font size; the
manual **"mark Needs Input"** override (§8).

**Outputs** — streamed PTY output; the Session Status badge; a resume/reconnect notice; persisted
scrollback.

**States** — Running (streaming) · Needs Input (accent/glow) · Idle · **Exited** (dimmed, with
Restart/Resume) · resuming/reconnecting · spawn error.

## 7. Forms & dialogs — Add Project, Add Issue, Runner picker  _(resolved)_

Fields map directly onto `CONTEXT.md`; nothing here invents new concepts.

- **Add Project** — folder picker (Tauri dialog; **any** folder allowed). **Auto-detects git-backed**
  (gates Worktree / Branch-in-place, branches, PRs, Linear-branch features). Inputs: name (defaults to
  folder), optional **Group**, **default Runner**, **default Workspace Strategy** (Shared checkout
  always; the others only if git), optional **Linear link**.
- **Add Issue** — title; **description** (becomes the materialized `.marrow/issues/<id>.md` task);
  **target column / State Type** (defaults to a non-`started` type, so creating an Issue does **not**
  auto-launch); **Runner override** and **Workspace Strategy override** (both default from the
  Project; Strategy options gated by git).
- **Runner picker / editor** — lists editable presets (`claude` / `codex` / `kilo`) plus custom
  Runners. Per Runner: **launch command**, **resume command**, **env injection** (incl.
  `MARROW_ISSUE_FILE`), with `{{workspace}}` / `{{issueFile}}` / `{{branch}}` interpolation. Sets the
  Project default; an Issue can override.

**States** — field validation; a non-git folder shows an informational "degraded mode" note (allowed,
not an error).

## 8. Notifications & the Session attention model  _(partially resolved)_

**Session Status** (see `CONTEXT.md`) is the data behind every attention surface — sidebar accents,
Cockpit badges, the Feed queue, and desktop notifications. Four states:

| Status | Meaning | Drives |
|--------|---------|--------|
| **Running** | agent producing output | neutral |
| **Needs Input** | appears blocked on the human (inferred, best-effort) | **desktop notification + Feed queue** |
| **Idle** | alive but quiet, no prompt detected | soft accent only |
| **Exited** | Runner process ended (clean or crashed) | review/cleanup cue _(detail pending)_ |

- **Manual override (required).** Because Needs Input is inferred (ADR 0002), the user can force a
  Session to Needs Input and can mute/dismiss false positives. Auto-detection is best-effort.
- **Desktop notification** — fires when a Session enters **Needs Input**; names **Project ▸ Issue ▸
  Session**; clicking it deep-links into the **Feed** focused on that Session. _(grouping/coalescing
  of many simultaneous alerts: pending.)_

_Pending: notification copy/grouping, the in-UI highlight treatment, and the mute model._

## 9. Cross-cutting states — empty / loading / error / degraded  _(resolved)_

- **Empty** — per-surface CTAs: Add your first Project (sidebar) · Add your first Issue (board) ·
  "Nothing running" (Cockpit) · "Inbox zero — no agents need you" (Feed).
- **Loading** — skeletons; data is local SQLite so loads are brief.
- **Error** — a failed Tauri command surfaces inline with **retry** (server-state model via TanStack
  Query); the Rust backend remains source of truth.
- **Degraded (non-git Project)** — a clear badge wherever the Project appears; Workspace Strategy locked
  to **Shared checkout**; git-only affordances (Worktree, Branch-in-place, branches, PRs, Linear-branch)
  hidden or disabled with a short explanation.
- **Offline** — everything works (local-first); only **Linear sync** is affected → a subtle
  sync-status indicator, never a blocking error.

---

## Open questions & caveats

1. **"Needs Input" detection vs Runner-agnosticism.** _Decision: keep the precise 4-state model
   (Running / Needs Input / Idle / Exited)._ Marrow never speaks an agent's protocol
   ([`ADR 0002`](../adr/0002-runner-agnostic-interactive-terminals.md)), so distinguishing **Needs
   Input** from **Idle** is a *heuristic* (prompt-like output / quiet PTY), not read from the agent.
   Mitigation, agreed and required by the design: a **manual override** (force-set Needs Input; mute
   false positives) and treating auto-detection as best-effort. Still open at the engineering layer:
   the actual detection signals and their tuning — likely worth its own ADR once implemented.

2. **Remaining UI micro-decisions** (low-risk, easy to settle later; flagged inline above):
   - **View-switch** placement/behaviour in the top bar (§0).
   - **Cockpit** tile click default — enlarge inline vs route straight to the Feed (§3).
   - Whether **Exited** Sessions also enter the **Feed** as a review queue, or only **Needs Input** (§4/§8).
   - **Snooze** duration model (§4).
   - **Notification** grouping/coalescing when many fire at once; in-UI highlight treatment; mute model (§8).

3. **Doc-consistency conflict — _resolved._** The earlier "Session Cockpit is the single PRIMARY view,
   Kanban is an optional per-Project lens" framing has been superseded by the **three first-class
   views** (Board / Cockpit / Feed), with the **Board carrying a global scope** and the **Feed** as the
   signature daily-driver. Reconciled across `ARCHITECTURE.md`, the design-docs index, `CONTEXT.md`,
   and `AGENTS.md`; ADR 0006 records the rationale.
