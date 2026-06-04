---
status: active
slice: full-functional-ui
created: 2026-06-02
---

# 0002 — Full functional UI (shell + Board + Cockpit + Feed + Issue page)

## Goal

Turn the unstyled tracer-bullet UI from [`0001`](./0001-scaffold-and-first-slice.md) into the real
product surface: the **App Shell** (sidebar + topbar + view switch), and all four content
surfaces — **Board**, **Cockpit**, **Feed**, **Issue page** — realized from the design reference and
**wired to live data**, not mockups.

> "Full functional" was chosen deliberately (over a pure visual skin): every surface is backed by real
> Tauri commands, including the pieces 0001 left out — `board_columns`, issue transitions that fire
> lifecycle automation, Groups, global scope, `update_issue`, a **Runner registry**, **multiple
> Sessions per Issue**, **workspace diff summaries**, and the **cursor-reactive shader**.

Builds directly on the existing `src/App.tsx` views and the `src-tauri` store/commands. See
[`docs/design-docs/ui-io-spec.md`](../../design-docs/ui-io-spec.md) (the surface spec),
[`visual-language.md`](../../design-docs/visual-language.md) (the aesthetic),
[`reference-design.md`](../../design-docs/reference-design.md) (the catalogued mockups +
"apply these" decisions), and the artifact in
[`marrow_symphony_reference_design/`](../../../marrow_symphony_reference_design). Honors ADRs
[0005](../../adr/0005-attention-is-best-effort-not-protocol-read.md) (attention is best-effort) and
[0006](../../adr/0006-three-view-ia-with-attention-feed.md) (three-view IA), and **records two new
calls** crystallized while planning this slice:
[0007](../../adr/0007-runner-registry-kind-keyed-editable-presets.md) (Runner registry shape) and
[0008](../../adr/0008-needs-input-detection-terminal-signals-and-notify-sidecar.md) (Needs-Input
detection).

## Definition of done

In a freshly built app a user can: switch between **Board / Cockpit / Feed** from the topbar; filter
Projects by **Group** and search; **drag an Issue card** between columns in both **This Project** and
**All Projects (global)** scopes, with a drop into a `started`-typed column launching a Session and
`done`/`canceled` offering cleanup; open an **Issue page**, edit its task (persisted to
`.marrow/issues/<id>.md`), pick/override its **Runner**, **Start/Stop/+New Session** (multiple
Sessions per Issue), and see a **diff summary**; scan the **Cockpit** fleet with Needs-Input tiles
glowing and sorted first; triage the **Feed** one Needs-Input Session at a time with Skip/Snooze/Done
and an inbox-zero rest state. The whole shell renders with the **reference design tokens in both light
and dark**, a **cursor-reactive shader** behind shell surfaces (off working surfaces, killed by a
reduce-motion toggle), and the chosen **alert color** applied. The `ping`/smoke check stays green and
`pnpm tauri dev` boots cleanly.

## Decision log (choices settled for this slice)

| Area | Choice | Why |
|------|--------|-----|
| Scope | **Full functional UI** (live data on every surface) | Chosen over a visual-only skin; surfaces back onto real commands |
| Theme | **Keep light + dark toggle**, adopt the reference token **values** | We keep 0001's toggle; author a matching light palette from `colors_and_type.css` semantics |
| Project color | Migrate to a `--project-1…6` palette index (hex kept as fallback) | reference-design.md decision #2 — curated tokens are canonical, demo hexes are wrong |
| Board look | **v2 base + amber "Started" column**, keep **v1's rainbow outline** on Needs-Input cards (outline only) | reference-design.md decision #4 |
| Sidebar | **Open or closed only** (`⌘B`); no mini/collapsed rail | reference-design.md decision #5 |
| Alert color | **Undecided → resolved inside this slice** via 3 sample treatments (Neon Cyan / animated rainbow / warm amber) | reference-design.md decision #1 |
| Runner | **`runners` registry keyed by an immutable `kind`** (ADR 0007); Projects/Issues ref by **FK**, Sessions **snapshot** name/kind/command + `resume_token`; shell-string commands with shell-escaped interpolation | Issue/§7 picker needs real presets + custom + resume; `kind` is the Runner-agnostic integration seam |
| Multi-session | Allowed via **multiple PTYs in the shared checkout**; Strategy override UI shown but Worktree/Branch-in-place **impl still deferred** (git-gated/degraded) | Keeps multi-session in-scope without building worktrees |
| Diff | Read-only **`git diff --stat`-style summary**, **workspace-level** under shared checkout (it's the whole checkout's changes, not per-Issue); degrade gracefully on non-git Projects | Feed/Issue context panels need it; per-Issue diffs become well-defined only with worktrees ([`0003`]) |
| Needs Input | **OSC 9/777 + BEL parse + `marrow notify` sidecar + manual override** (ADR 0008); `needs_input_since` orders the Feed; quiet-PTY/regex *tuning* still deferred | ADR 0005/0008; cmux-style terminal signals, never the agent protocol |
| Resume | **Capture the CLI-printed resume token** (per-`kind` output regex) into `sessions.resume_token`; Resume re-runs `resume_cmd` with `{{resumeToken}}` → new Session | Token-free `--continue` resumes the *wrong* conversation under multi-session shared checkout |
| Context bus | The **`marrow` sidecar** is the agent↔Marrow bridge ([ADR 0009]): `notify` + `issue read` / `issue comment` / `diff`. **Local-backed** in this slice; the **Linear proxy** behind the same verbs is the seam for the Linear slice | Realizes the Linear vision (prompt in → context back) without the agent ever holding credentials; works for any `kind` |
| Scrollback | Per-Session **output ring buffer** (last N KB) in the PTY reader + a `get_session_scrollback` command | Powers Cockpit/Feed previews without a live attach, and replays scrollback on terminal remount |
| Shader | Port `shader.jsx`; **shell/empty/Feed ambiance only**, never behind terminals/Board grid/Cockpit tiles; reduce-motion kills it | visual-language.md principles 3–5 |

## What 0001 already gives us (build on, don't rebuild)
- Working (unstyled) Sidebar, Board, Cockpit, Feed in `src/App.tsx`; `TerminalPane` (xterm.js).
- Commands: `ping`, `create_project`, `list_projects`, `create_issue`, `list_issues`,
  `list_sessions`, `start_session` (preps Workspace + launches Runner + writes `.marrow/issues/<id>.md`),
  `write_to_session`, `resize_session`, `kill_session`.
- Schema: `groups`, `projects`, `board_columns` (with `state_type`), `issues`, `sessions`.
- Default shadcn neutral tokens + light/dark in `src/index.css`; Geist (UI) installed.

**Backend gaps this slice fills:** no `board_columns` seeding/listing, no issue transition/move, no
`groups` list, no `update_issue`, no global-scope shapes, no Runner registry, no multi-session listing
per Issue, no diff command, no manual status override/snooze.

## Steps (each keeps the app working and is independently mergeable)

### Step 0 — Design tokens + theme foundation (light + dark)
- Port `marrow_symphony_reference_design/styles/colors_and_type.css` semantics into `src/index.css`'s
  `@theme`/`:root`/`.dark`: neutral ramp + `--bg-shell`/`--bg-working`/`--bg-glass*`, single
  `--hairline`, `--project-1…6`, status tokens (running/needs-input/idle/exited incl. glow), Geist Mono
  for code, radii/shadows/blur/motion, `--sidebar-w: 240px` / `--topbar-h: 44px`. Author a **light**
  variant of the saturated accents/status tokens so both themes read well.
- Migrate `projects.color` usage to a `--project-*` index (keep hex column as fallback); seed an index
  on `create_project`.
- **DoD:** existing views render with the new tokens in **both** themes; the dark shell matches the
  reference mood; `⌘`-toggle still flips themes.

### Step 1 — App Shell + chrome (sidebar, topbar, view switch, ⌘B)
- Build the persistent **topbar** (logo · `[Board | Cockpit | Feed]` switch · global Needs-Input count ·
  search · settings/Linear) and the **240px expanded sidebar** (Group accordions/filter + Project search
  + Project rows with live/needs counts, non-git marker, Linear badge, selected highlight). `⌘B`
  toggles open/closed (no mini-rail). Port the shared atoms from `chrome.jsx`
  (`StatusDot`/`AttentionPip`/`NeedsPill`/`ProjectChip`/`IconButton`/`Kbd`/`Logo`) as shadcn/Tailwind.
- Backend: `list_groups` (+ minimal `create_group`/assign on Add Project); selecting a Project scopes
  the main view; Group filter + search wired.
- **DoD:** shell matches the App Shell reference; `⌘B` works; group filter + search filter the list;
  selecting a Project scopes the view.

### Step 2 — Embedded terminal frame (shared component, 3 chrome densities)
- Refactor `TerminalPane` into the §6 frame: optional chrome bar (status badge · Project ▸ Issue ·
  Runner · elapsed) + canvas, with **Kill / Restart / Resume** and a manual **"mark Needs Input"**
  override. Status tokens + Needs-Input glow. Host sets chrome density (minimal in Cockpit, full in
  Feed/Issue).
- Backend (**ADR 0008**): `set_session_status` (manual override); **OSC 9/777 + BEL scanning** in the
  PTY reader → `needs_input`; the **`marrow notify`** sidecar (Tauri `externalBin`, unix-socket →
  re-emit the existing `session-status` event) with `MARROW_SESSION_ID` / `MARROW_NOTIFY_SOCKET`
  injected; the consented Claude `Stop`+`Notification` hook install; add **`needs_input_since`** (Feed
  ordering) and **clear on `write_to_session`** (you typed → Running). Also persist a per-Session
  **output ring buffer** (last N KB) in the PTY reader + a **`get_session_scrollback`** command
  (replays scrollback on remount; feeds Cockpit/Feed previews without a live attach). The sidecar is
  **widened (Slice 5 / [ADR 0009])** into the agent **context bus** — `issue read` / `issue comment` /
  `diff`, local-backed here, with the Linear proxy deferred to the Linear slice.
- **DoD:** one terminal component reused at all three densities; manual override flips status + accent;
  a real `claude`/`codex` Session entering its prompt flips to Needs Input on its own; re-mounting a
  terminal replays recent scrollback.

### Step 3 — Board (both scopes) + drag-to-transition lifecycle
- **This Project**: render the Project's custom column labels; **All Projects (global)**: canonical
  State-Type columns pooling every Project's Issues, color-coded by `--project-*` + Project badge.
  Board = **v2 base + amber Started column + v1 rainbow outline** on Needs-Input cards. Add Issue form
  (§7). Drag a card → set State Type; into `started` fires `start_session` **only if the Issue has no
  live Session** (idempotent — extra Sessions come from the Issue page's explicit *+ New Session*);
  `done`/`canceled` **offers** cleanup (kill live Sessions on confirm — never auto-kills); other
  transitions are state-only.
- Backend: seed default `board_columns` on `create_project`; `list_board_columns`; `transition_issue`
  (state change + idempotent lifecycle hooks keyed on target State Type); `update_issue`; global
  `list_issues(projectId: null)` returning Project info.
- **DoD:** drag works in both scopes and fires the lifecycle; cards color-coded; empty/degraded states.

### Step 4 — Cockpit (fleet overview)
- Scrollable **Project groups** (header: name · live · attention) over a responsive **tile grid** with
  throttled terminal previews; Needs-Input tiles **glow + sort first**; group attention counts; filter
  by status; collapse/reorder groups. Tile click default: **enlarge inline**, with explicit **Open in
  Feed** (resolves the §3 pending micro-decision).
- **DoD:** matches the Cockpit reference; Needs-Input sorts first; jump to Feed/Board.

### Step 5 — Feed (attention queue)
- One card at a time, vertically paged: header (Project ▸ Issue · Runner · waiting elapsed · status);
  context panel (task from `.marrow/issues/<id>.md` · Workspace branch · **diff summary**); focused
  terminal; action bar (**Skip / Snooze / Open in Cockpit / ✓ done**); advance loop **oldest-waiting
  first**; `⌘↑/⌘↓` revisit; **inbox-zero** rest state.
- Backend: `workspace_diff` (git stat summary; degrade on non-git); minimal **snooze** via a
  `sessions.snoozed_until` column (fixed default duration — model still open). The Feed query orders by
  **`needs_input_since`** (oldest-waiting first, ADR 0006) and excludes snoozed Sessions.
- **DoD:** act/skip/snooze advances to the next Needs-Input Session; inbox zero shows the rest state.

### Step 6 — Issue page
- Header (title · Project color/badge · column & State Type · Linear link) over split **main =
  Session terminal(s)** + **right rail** (editable task → `.marrow/issues/<id>.md`, Workspace
  strategy · branch · path, Runner ▾, diff). **Start / Stop / + New Session** with **multi-session
  tabs**; override Runner / Workspace Strategy (git-only options gated) / column. States: Not-started
  (Start CTA) · Running · Degraded. Reached from a Board card; replaces main view with back-to-Board.
- Backend: `update_issue` writes the task to SQLite (source of truth, ADR 0003) and **full-rewrites**
  the git-excluded `.marrow/issues/<id>.md` whenever the Workspace dir exists (always true for shared
  checkout, so edits land even pre-first-Session); list Sessions per Issue; multi-PTY start in the
  shared checkout.
- **DoD:** open card → Issue page; task edits persist to the file; Start/Stop/+New Session with tabs.

### Step 7 — Runner registry (picker / editor) — see **ADR 0007**
- `runners(id, kind, name, launch_cmd, resume_cmd, env_json)` + CRUD commands
  (`list`/`create`/`update`/`delete`); `kind ∈ {claude, codex, generic}` is **immutable** (drives
  integration: the attention hook + the resume-token regex), the rest editable; seed presets
  `claude` / `codex` / `kilo` + custom; **guard deleting the last Runner**.
- **Schema delta (migration):** migrate `projects.default_runner` → **`default_runner_id`** FK
  (`NOT NULL`, `ON DELETE RESTRICT`) and `issues.runner_override` → **`runner_override_id`** FK
  (nullable, `ON DELETE SET NULL`); add to `sessions` a soft **`runner_id`** (`ON DELETE SET NULL`),
  **`runner_kind`**, and **`resume_token`** (also `needs_input_since` + `snoozed_until` from Steps 2/5).
  Resolution stays `COALESCE(override, default)`.
- Commands are **shell strings** (user login shell, ADR 0004) with **shell-escaped** `{{workspace}}` /
  `{{issueFile}}` / `{{branch}}` / `{{resumeToken}}`; the non-editable **system env layer**
  (`MARROW_ISSUE_FILE`, `MARROW_SESSION_ID`, `MARROW_NOTIFY_SOCKET`) injects *beneath* the Runner's
  `env_json`. The per-`kind` resume-token regex scrapes e.g. `claude --resume <uuid>` from PTY output.
- Generalize `start_session` to resolve **and snapshot** the Runner (name/kind/command) onto the
  Session row; **Resume** re-runs `resume_cmd` (`{{resumeToken}}` filled) → new Session; **Restart**
  (fresh `launch_cmd`) always available; `{{branch}}` = current git HEAD or empty (shared checkout).
- **DoD:** pick/edit Runners; Start uses the resolved Runner; the resume path is exercised via a
  captured token; deleting a Runner that is a Project default is refused with a reassign prompt.

### Step 8 — Cursor-reactive shader + reduce-motion
- Port `shader.jsx` as a `<Shader/>` backdrop behind shell / empty / Feed-ambiance surfaces only;
  **never** behind terminals, the Board grid, or Cockpit tiles. First-class **reduce-motion /
  disable-shader** toggle; reduced-motion CSS fallback (thin blur).
- **DoD:** shader animates on the shell, is absent on working surfaces, and the toggle fully disables
  it; the app is calm and fully usable with shaders off.

### Step 9 — Alert-color decision + cross-cutting states + verification
- Produce **3 alert treatments** — (a) Neon Cyan, (b) animated rainbow, (c) warm amber — pick by eye,
  then apply the choice across **Cockpit / Feed / shell counts/pills** (the Board card treatment is
  already fixed by decision #4). Pass the §9 cross-cutting states (empty / loading / error / degraded /
  offline). Manual verification checklist; keep the `ping`/smoke check green.
- **DoD:** alert color chosen + applied; every surface matches the reference; the full demo flow works.

## Explicitly deferred (NOT in this slice)
Linear **two-way sync** (display-only badges/links here; the **context-bus Linear proxy** + opt-in
sync land with the Linear slice — the `marrow issue` verbs are **local-backed** in 0002, [ADR 0009]) ·
**Worktree & Branch-in-place** Workspace-Strategy *implementation* (override UI shown but
git-gated/degraded — now specced in [`0003`](./0003-worktree-isolation.md) with repo-owned **Workspace
setup hooks**, [ADR 0010]) ·
**"Needs Input" detection *tuning*** — the quiet-PTY fallback timer + per-Runner prompt-regex
`needs_input_patterns` (the baseline mechanism is settled in **ADR 0008**; the tuning gets its own
follow-up ADR) · concurrency soft-warning threshold + CPU/RAM telemetry · notification
**grouping/coalescing** & mute model · a richer **Snooze duration** model.

## Open questions touching this slice
- **Alert color** — *resolved within this slice* (Step 9, 3 samples).
- **View-switch** placement/behaviour — default to the reference topbar segmented control.
- **Cockpit tile-click** — *resolved:* enlarge inline; Open-in-Feed is explicit (Step 4).
- **Exited Sessions in the Feed** — *default:* no; only Needs Input enters the Feed; Exited is handled
  on the Cockpit/Issue page.
- **Snooze duration** — fixed default for now; model still open.
- **Light-mode `--project-*`** — saturated accents may need light-theme variants (Step 0).

## Verification & legibility (agent-first)
This is a UI-heavy slice, so it's worth a stronger agent-driving investment than 0001: keep
`pnpm tauri dev` booting fast, keep `ping`/smoke green, keep terminal scrollback inspectable, and
consider screenshot/DOM-driving so an agent can verify each surface. Push any new vocabulary into
`CONTEXT.md` and record genuinely architectural calls (Runner registry shape, attention detection) as
ADRs when they crystallize.

## Progress log
- 2026-06-02 — Plan created. Scope settled as **full functional UI**; theme = **keep light/dark** with
  reference token values; key reference-design decisions (#2 project colors, #4 Board look, #5 no
  mini-rail) folded into the decision log; alert color (#1) scheduled for resolution in Step 9. No
  steps started yet.
- 2026-06-02 — **Grilled the plan against CONTEXT.md + ADRs.** The two flagged areas crystallized into
  **ADR 0007** (Runner registry: immutable `kind`, FK refs, session snapshot, shell-escaped
  interpolation, system env layer) and **ADR 0008** (Needs-Input: OSC/BEL + `marrow notify` sidecar over
  a unix socket + consented Claude hook + manual override). Also pinned: **resume-token capture** into
  `sessions.resume_token` (cmux-style; the user's `claude --resume <uuid>` catch killed the token-free
  `--continue` plan), idempotent drag-into-`started` (no duplicate Sessions) + offer-don't-auto-kill
  cleanup, and the schema deltas (`needs_input_since`, `snoozed_until`, runner FKs, session snapshot
  columns). CONTEXT.md updated (Needs-Input mechanism; the Runner's system-context env layer). No steps
  started yet.
- 2026-06-02 — **Studied superset.sh for backend ideas.** Folded in: (1) the `marrow` sidecar widens
  from notify → **agent context bus** (**ADR 0009**) — `issue read` / `issue comment` / `diff`,
  local-backed here, with the Linear proxy as the seam for the Linear slice; this is the Linear-vision
  unlock. (2) Per-Session **scrollback ring buffer** + `get_session_scrollback` (Step 2 / Slices 3–4).
  (3) Honest call that the diff is **workspace-level under shared checkout**; per-Issue diffs need
  worktrees. Worktree isolation stays **opt-in / off by default** by design, specced in
  [`0003`](./0003-worktree-isolation.md); repo-owned **Workspace setup hooks** captured in **ADR 0010**
  (impl in 0003). No steps started yet.
- 2026-06-03 — **Slice fully implemented end to end.** A gap audit found Steps 0–4, 6 and the Runner
  registry/resume (Steps 7) already built on `master`; this pass closed the remainder. **Step 5 (marrow
  sidecar)** built from scratch: a per-app unix-socket context bus (`src-tauri/src/sidecar.rs`) + the
  `marrow` CLI bin (`src-tauri/src/bin/marrow.rs`, on the Session `PATH`) with `notify` / `issue read` /
  `issue comment` / `diff` verbs, local-backed, no-op when env vars are absent; plus a **consented,
  additive `Stop`+`Notification` Claude hook installer** (`src-tauri/src/hooks.rs`) that merges into
  `~/.claude/settings.json` only on explicit in-app click and removes cleanly. **Step 8** swapped the
  CSS-gradient placeholder for a real WebGL `<Shader/>` port (theme-aware, reduce-motion 2D fallback).
  **Step 9 / alert color resolved → warm amber** (`--status-needs-input` amber in both themes), with all
  three treatments (amber / cyan / animated-rainbow) shipped as a live topbar toggle. Cross-cutting
  states landed across every surface: `.skeleton` loaders, inline error+retry on all data queries, and
  a Linear offline indicator. Filled the smaller gaps too: display-only **Linear** link fields on
  Projects + Issues (schema + `update_project`), sidebar **Group accordions**, **Cockpit** static
  scrollback previews + group reorder + needs-input-gated *Open in Feed*, **Issue page** degraded state +
  board-column label + human comment composer, **Runner** reassign-before-delete flow + interpolation
  hints, **Feed** ⌘↵-done + degraded/skeleton diff + "N more waiting", Geist Mono, and detection
  hardening (split-read carry + unit tests). `cargo test` (22 tests) and `pnpm build` are green.
  **Deviation:** `projects.default_runner_id` stays nullable (with `ON DELETE RESTRICT` + app-side
  non-null enforcement) rather than a fragile table-rebuild migration to add `NOT NULL`; the `marrow`
  bin is PATH-injected as a same-crate cargo bin (production bundling should additionally declare it as
  a Tauri `bundle.externalBin`).
