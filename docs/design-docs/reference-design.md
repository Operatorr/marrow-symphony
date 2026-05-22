# Reference design — Marrow Symphony (Claude Design)

> **Status:** _catalogued, not implemented._ This doc indexes the artifact only — see
> "Known divergences & open decisions" before lifting anything from it.
>
> **Purpose.** Catalogue the clickable design reference in
> [`../../marrow_symphony_reference_design/`](../../marrow_symphony_reference_design) — the concrete
> visual/interaction realization of [`visual-language.md`](./visual-language.md) (the aesthetic) and
> [`ui-io-spec.md`](./ui-io-spec.md) (the surfaces). It is **reference material**, not production code.

## What it is

A set of self-contained HTML mockups produced by **Claude Design** for the three first-class views
(Board · Cockpit · Feed), plus the App Shell and the Issue page. Each `.html` boots React 18 + Babel
**standalone from unpkg** (network required) and renders one or more 1440×900 **artboards** inside a
Figma-like pan/zoom canvas. Styling is inline-style React with one shared CSS token file.

**What it is *not*:** the production stack. Marrow ships on **shadcn/ui + Tailwind in a Tauri webview**
(see `visual-language.md`). Treat this as intent to re-implement — the one directly reusable artifact
is the token file (`styles/colors_and_type.css`).

## Folder map

```
marrow_symphony_reference_design/
├── App Shell.html          → renders src/shell.jsx via canvas-app.jsx
├── Board.html              → src/board.jsx        (Board v1)
├── Board v2.html           → src/board-v2.jsx     (Board v2 — later iteration)
├── Cockpit.html            → src/cockpit.jsx
├── Feed Screen.html        → src/feed-screen.jsx
├── Issue Page.html         → src/issue-page.jsx
├── .design-canvas.state.json   canvas arrangement (order/labels), persisted by the design tool
├── assets/logo.svg
├── screenshots/            two PNG captures of the Issue page
├── styles/
│   └── colors_and_type.css     ★ the design-token source of truth (see below)
└── src/
    ├── shader.jsx              cursor-reactive animated backdrop (the <Shader/> component)
    ├── chrome.jsx              shared topbar + expanded sidebar + atoms + <CFrame/> wrapper
    ├── shell.jsx               standalone App Shell (own chrome + placeholder main; also a 56px collapsed rail)
    ├── board.jsx               Board v1   (BoardView)
    ├── board-v2.jsx            Board v2   (Board2View)
    ├── cockpit.jsx             Cockpit    (CockpitView)
    ├── feed-screen.jsx         Feed       (FeedScreen + FeedInboxZero)
    ├── feed-parts.jsx          Feed sub-components
    ├── feed-context.jsx        Feed state/context
    ├── issue-page.jsx          Issue page (IssuePageRunning + IssuePageNotStarted)
    ├── design-canvas.jsx       the Figma-like canvas harness (NOT part of the app — see below)
    ├── canvas-app.jsx          mounts the App Shell artboards
    ├── feed-canvas-app.jsx     mounts the Feed artboards
    ├── shell-data.js           SHELL_DATA (4 Projects in Work/Ops groups) + SHELL_ICONS
    ├── views-data.js           MS_DATA (projects · issues · sessions) for board/cockpit/issue
    └── feed-data.js            FEED_DATA + FEED_ICONS
```

`design-canvas.jsx` is the **design tool's harness**, not Marrow: a pan/zoom infinite canvas with
draggable/reorderable artboards, a fullscreen focus mode (←/→/Esc), per-artboard PNG/HTML export, and
state persistence to the `.design-canvas.state.json` sidecar. Ignore it when reading for app intent.

## How to view it

Open any `.html` in a browser (needs network for the unpkg React/Babel CDN). Each opens the canvas —
scroll/pinch to zoom, drag the background to pan, click an artboard's expand icon for fullscreen.
`Board v2.html` is the exception: it renders a single scale-to-fit artboard, no canvas.

## Screens & variants

Each file lays its variants out as labeled artboards:

| Screen | File | Variants (artboards) |
| --- | --- | --- |
| **App Shell** | `App Shell.html` | A · Expanded 240px glass sidebar · B · Sidebar hidden, full-bleed main. Persistent chrome over the shader; ⌘B toggles. Main region is a placeholder — the real views live in their own files. |
| **Board v1** | `Board.html` | A · All Projects (global, pooled & color-coded by Project) · B · This Project (webapp, custom column labels) · C · Sidebar collapsed, global. Needs-Input cards get a rainbow outline. |
| **Board v2** | `Board v2.html` | One scene: All Projects with a card mid-drag into **Started** (ghost source slot + amber "Drop to start" rail). The later iteration; switches the alert color to **amber** (see divergences). |
| **Cockpit** | `Cockpit.html` | A · All Projects (11 live · 4 need input), terminal tiles grouped by Project, Needs-Input tiles glow + sort first · B · Filtered to one Project. |
| **Feed** | `Feed Screen.html` | A · Active — one Needs-Input Session in focus, agent waiting on a patch decision · B · Inbox zero. Shader + glass prominent; the terminal itself stays solid. |
| **Issue page** | `Issue Page.html` | A · Live Session · Needs Input · MAR-7 (full terminal, right rail: task / Workspace / Runner / diff) · B · Not yet started, prominent Start CTA · MAR-22. Two PNG captures in `screenshots/`. |

Seed data (`shell-data.js` / `views-data.js`): Projects **webapp · api · docs** (Group _Work_) and
**infra** (Group _Ops_, non-git, shared checkout); Issues like **MAR-7 "Fix auth retry logic"**; Runners
`claude` / `codex`; Session statuses across needs-input / running / idle / exited.

## Design tokens — `styles/colors_and_type.css`

The most reusable output. A complete dark-theme token set (CSS custom properties), faithfully
matching the `visual-language.md` direction:

- **Neutral ramp** `--neutral-0…950` + shell semantics: `--bg-shell` (under the shader),
  `--bg-working` (terminals/columns), `--bg-glass*` (translucent chrome), `--fg1…4`, and a single
  `--hairline` ("the only border in the system").
- **Per-Project accents** `--project-1…6` (a curated saturated palette) — the chromatic layer.
- **Status** tokens for running / needs-input / idle / exited (color + glow + bg each).
- **Type:** pins the fonts to **Geist / Geist Mono** (loaded from Google Fonts) and ships semantic
  classes `.t-display/.t-h1…h4/.t-body/.t-ui/.t-meta/.t-caps/.t-code`.
- **Spacing** (4px base), **radii**, **shadows** (incl. `--shadow-needs-input`), **motion** easings/
  durations, **blur** (`--blur-glass`, with a reduced-motion fallback), and **layout rails**
  (`--sidebar-w: 240px`, `--topbar-h: 44px`).
- A `@media (prefers-reduced-motion: reduce)` block thins the glass blur and bumps opacity.

## Shared components / atoms (`chrome.jsx`)

Reused across Board v1/v2, Cockpit, and Issue page via `<CFrame/>` (shader backdrop → topbar →
expanded sidebar → main slot): `CTopBar` (logo, Board/Cockpit/Feed view switch, needs-input count,
search, settings/Linear), `CSidebarExpanded` (Group accordions + Project rows with live/needs counts),
`CStatusDot`, `CAttentionPip`, `CNeedsPill`, `CProjectChip`, `CIconButton`, `CKbd`, `CLogo`.

## Decisions & cleanup

These divergences were found in the reference and reviewed; each now has a call (2026-05-23). Apply
them when this reference is implemented — do **not** lift the reference verbatim where it conflicts.

1. **Alert color — undecided; choose by eye via 3 sample pages.** The reference disagrees with itself:
   `colors_and_type.css` / `chrome.jsx` / Cockpit / Feed use **Neon Cyan `#00d9ff`** plus an animated
   **rainbow** attention dot/pill, while **Board v2** uses **warm amber `#f5a524`**.
   **Action (not yet built):** produce **3 sample pages, one per alert treatment — (a) Neon Cyan,
   (b) animated rainbow, (c) warm amber** — so the choice can be made visually. _Interacts with #4:_
   #4 already fixes the Board card treatment (rainbow outline + amber Started column); this choice
   governs the alert color on the other surfaces (Cockpit, Feed, shell counts/pills).
2. **Project colors → follow the `--project-*` tokens.** The hard-coded demo hues in `shell-data.js` /
   `board-v2.jsx` (webapp `#5b8cff`, api `#79fa87`, docs `#ffb300`, infra `#7c4dff`/`#9d7bff`) are
   **wrong**. The curated `--project-1…6` palette in `colors_and_type.css` is canonical.
3. **Missing README — ignore.** There is no `README.md`; the dangling "see README.md (§ VISUAL
   FOUNDATIONS)" comment in `colors_and_type.css` can be ignored (drop it if/when we adopt the file).
4. **Board = v2 base + v1's rainbow outline (outline only).** Carry forward **Board v2** for
   everything — **including the amber background on the "Started" column** — but keep **v1's rainbow
   outline** on Needs-Input cards. Only the outline is taken from v1; nothing else.
5. **No collapsed / mini sidebar rail.** There is no smaller version of the left sidebar. The 56px
   rail in `shell.jsx` (`SidebarCollapsed`, and the `.design-canvas.state.json` "Collapsed rail" label)
   is a mistake — the sidebar is simply **open or closed** (⌘B), nothing in between.

## Relationship to the design docs

- Realizes the aesthetic in [`visual-language.md`](./visual-language.md) — monochrome glass shell,
  cursor-reactive shader, chromatic per-Project accents, solid high-contrast working surfaces (the
  reference correctly keeps shaders/heavy blur off the Board grid, Cockpit tiles, and terminals).
- Realizes the surfaces in [`ui-io-spec.md`](./ui-io-spec.md) — global shell, Board (both scopes),
  Cockpit, Feed, and the Issue page, with the empty/active states the spec calls for.
