// Marrow Symphony — shared issue/session data for Board, Cockpit, Issue page.
//
// Project palette matches src/shell-data.js. Each issue has a stateType (one
// of the canonical State Types) and an optional sessionId referencing a live
// Session. Sessions carry status (running/needs-input/idle/exited), runner,
// elapsed time, recent diff, and short scrollback for the Cockpit preview.

window.MS_DATA = {
  projects: {
    webapp: { id: 'webapp', name: 'webapp', color: '#5b8cff', glyph: 'w' },
    api:    { id: 'api',    name: 'api',    color: '#79fa87', glyph: 'a' },
    docs:   { id: 'docs',   name: 'docs',   color: '#ffb300', glyph: 'd' },
    infra:  { id: 'infra',  name: 'infra',  color: '#7c4dff', glyph: 'i' },
  },

  columns: [
    { id: 'backlog',   label: 'Backlog',   stateType: 'backlog'   },
    { id: 'todo',      label: 'Todo',      stateType: 'todo'      },
    { id: 'started',   label: 'Started',   stateType: 'started'   },
    { id: 'in-review', label: 'In Review', stateType: 'in-review' },
    { id: 'done',      label: 'Done',      stateType: 'done'      },
  ],

  // ─── Issues ───────────────────────────────────────────────────────────────
  issues: [
    // webapp ─────────────────────────────────────────────────────────────────
    { id: 'MAR-7',  project: 'webapp', title: 'Fix auth retry logic',                state: 'started',   sessionId: 's-2147', runner: 'claude' },
    { id: 'MAR-12', project: 'webapp', title: 'Session token refresh race condition', state: 'started',   sessionId: 's-2150', runner: 'kilo'   },
    { id: 'MAR-15', project: 'webapp', title: 'Memoize Issue card derived state',     state: 'started',   sessionId: 's-2161', runner: 'claude' },
    { id: 'MAR-18', project: 'webapp', title: 'Replace toast lib with custom hook',   state: 'in-review', sessionId: 's-2153', runner: 'codex'  },
    { id: 'MAR-22', project: 'webapp', title: 'Onboarding tour for first-run',        state: 'todo'                                              },
    { id: 'MAR-23', project: 'webapp', title: 'Persist sidebar collapsed state',      state: 'todo'                                              },
    { id: 'MAR-3',  project: 'webapp', title: 'Migrate router to v7 data APIs',       state: 'backlog'                                           },
    { id: 'MAR-4',  project: 'webapp', title: 'Audit bundle size, drop polyfills',    state: 'backlog'                                           },
    { id: 'MAR-1',  project: 'webapp', title: 'Light-mode theme tokens',              state: 'done'                                              },

    // api ────────────────────────────────────────────────────────────────────
    { id: 'AP-3',   project: 'api',    title: 'GraphQL pagination cursor — Relay vs offset',  state: 'started',   sessionId: 's-2148', runner: 'codex'  },
    { id: 'AP-7',   project: 'api',    title: 'Bun runtime for the worker pool',              state: 'started',   sessionId: 's-2162', runner: 'claude' },
    { id: 'AP-9',   project: 'api',    title: 'Add OpenTelemetry to the request pipeline',     state: 'started',   sessionId: 's-2163', runner: 'claude' },
    { id: 'AP-11',  project: 'api',    title: 'Pin pnpm version in CI',                       state: 'in-review', sessionId: 's-2154', runner: 'codex'  },
    { id: 'AP-1',   project: 'api',    title: 'Switch from sqlx to drizzle',                  state: 'todo'                                              },
    { id: 'AP-5',   project: 'api',    title: 'Rate-limit middleware on /v1/auth',            state: 'todo'                                              },
    { id: 'AP-2',   project: 'api',    title: 'Replace bull with bullmq',                     state: 'backlog'                                           },
    { id: 'AP-0',   project: 'api',    title: 'Webhook fan-out reliability',                  state: 'done'                                              },

    // docs ───────────────────────────────────────────────────────────────────
    { id: 'DC-12',  project: 'docs',   title: 'Rewrite "Getting started" for the new CLI shape', state: 'started',   sessionId: 's-2149', runner: 'claude' },
    { id: 'DC-9',   project: 'docs',   title: 'Mermaid diagrams for the runner lifecycle',      state: 'in-review', sessionId: 's-2155', runner: 'claude' },
    { id: 'DC-4',   project: 'docs',   title: 'Glossary page from CONTEXT.md',                   state: 'todo'                                              },
    { id: 'DC-2',   project: 'docs',   title: 'Migrate to MDX 3',                                state: 'backlog'                                           },

    // infra ──────────────────────────────────────────────────────────────────
    { id: 'IN-5',   project: 'infra',  title: 'Tauri 2 auto-updater wiring',                    state: 'started',   sessionId: 's-2151', runner: 'codex'  },
    { id: 'IN-8',   project: 'infra',  title: 'Codesign + notarize the macOS bundle',           state: 'started',   sessionId: 's-2152', runner: 'kilo'   },
    { id: 'IN-3',   project: 'infra',  title: 'GitHub Actions matrix for win/mac/linux',        state: 'todo'                                              },
    { id: 'IN-1',   project: 'infra',  title: 'Rust toolchain pinned via rust-toolchain.toml',  state: 'done'                                              },
    { id: 'IN-2',   project: 'infra',  title: 'Crash reporter — Sentry or in-house',            state: 'backlog'                                           },
  ],

  // ─── Sessions ────────────────────────────────────────────────────────────
  // Keyed by session id; referenced by issues[].sessionId.
  sessions: {
    // ── Needs Input ────────────────────────────────────────────────────────
    's-2147': {
      issueId: 'MAR-7', runner: 'claude', status: 'needs-input',
      startedMinsAgo: 14, waitingMs: 122 * 1000,
      tokensIn: 18420, tokensOut: 3104,
      diff: { added: 24, removed: 3, files: 2 },
      branch: 'mar-7-auth-retry',
      strategy: 'worktree',
      preview: [
        { kind: 'agent',  text: '  └─ widen retryable: 5xx + ECONNRESET + ETIMEDOUT' },
        { kind: 'agent',  text: '  └─ budget 5 tries / 5s cap, jittered backoff' },
        { kind: 'agent',  text: '' },
        { kind: 'agent',  text: 'Diff is small — 24 add / 3 remove across retry.ts + test.' },
        { kind: 'prompt', text: 'Apply this patch to src/auth/retry.ts? (y/n)' },
      ],
    },
    's-2148': {
      issueId: 'AP-3', runner: 'codex', status: 'needs-input',
      startedMinsAgo: 23, waitingMs: 348 * 1000,
      tokensIn: 22110, tokensOut: 4032,
      diff: { added: 0, removed: 0, files: 0 },
      branch: 'ap-3-cursor-pagination',
      strategy: 'worktree',
      preview: [
        { kind: 'agent',  text: 'Two viable shapes:' },
        { kind: 'agent',  text: '  1. Relay-style — opaque base64 cursor, before/after' },
        { kind: 'agent',  text: '  2. Offset + limit — simpler, breaks under inserts' },
        { kind: 'agent',  text: 'Relay is what every consumer expects.' },
        { kind: 'prompt', text: 'Pick (1) Relay or (2) offset?' },
      ],
    },
    's-2149': {
      issueId: 'DC-12', runner: 'claude', status: 'needs-input',
      startedMinsAgo: 41, waitingMs: 612 * 1000,
      tokensIn: 9200, tokensOut: 1840,
      diff: { added: 84, removed: 132, files: 4 },
      branch: 'dc-12-getting-started',
      strategy: 'worktree',
      preview: [
        { kind: 'agent',  text: 'Restructured around the new CLI verbs:' },
        { kind: 'agent',  text: '  marrow init · marrow add · marrow run' },
        { kind: 'agent',  text: 'Old "configure step" page is orphaned now.' },
        { kind: 'prompt', text: 'Delete docs/configure.mdx and redirect → init?' },
      ],
    },
    's-2150': {
      issueId: 'MAR-12', runner: 'kilo', status: 'needs-input',
      startedMinsAgo: 86, waitingMs: 1280 * 1000,
      tokensIn: 30210, tokensOut: 6840,
      diff: { added: 47, removed: 12, files: 3 },
      branch: 'mar-12-token-race',
      strategy: 'worktree',
      preview: [
        { kind: 'agent',  text: 'Two concurrent refreshes race when the tab is hidden.' },
        { kind: 'agent',  text: 'Single-flight via a module-scoped Promise fixes it.' },
        { kind: 'prompt', text: 'Apply patch to session.ts? (y/n)' },
      ],
    },

    // ── Running ────────────────────────────────────────────────────────────
    's-2161': {
      issueId: 'MAR-15', runner: 'claude', status: 'running',
      startedMinsAgo: 4, waitingMs: 0,
      tokensIn: 4200, tokensOut: 520,
      diff: { added: 11, removed: 7, files: 1 },
      branch: 'mar-15-memo-card',
      strategy: 'worktree',
      preview: [
        { kind: 'sys',   text: '› profiling renders…' },
        { kind: 'agent', text: 'IssueCard re-renders on every column scroll (parent maps inline).' },
        { kind: 'agent', text: 'Hoisting the comparator + memo on the card cuts it from 240→8.' },
        { kind: 'agent', text: 'Writing the fix now.' },
      ],
    },
    's-2162': {
      issueId: 'AP-7', runner: 'claude', status: 'running',
      startedMinsAgo: 11, waitingMs: 0,
      tokensIn: 12080, tokensOut: 1740,
      diff: { added: 32, removed: 21, files: 2 },
      branch: 'ap-7-bun-worker',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'pnpm exec bun --version → 1.1.34' },
        { kind: 'sys',   text: '› bun run worker:dev' },
        { kind: 'agent', text: 'worker pool up · 4 workers · cold start 38ms (was 410ms node)' },
        { kind: 'agent', text: 'Smoke-test passing. Checking memory under load.' },
      ],
    },
    's-2163': {
      issueId: 'AP-9', runner: 'claude', status: 'running',
      startedMinsAgo: 7, waitingMs: 0,
      tokensIn: 7900, tokensOut: 940,
      diff: { added: 58, removed: 4, files: 5 },
      branch: 'ap-9-otel',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'Wiring @opentelemetry/sdk-node with OTLP exporter.' },
        { kind: 'agent', text: 'Spans on: http-in, db-query, queue-publish.' },
        { kind: 'sys',   text: '› pnpm test pipeline.test.ts' },
        { kind: 'sys',   text: '  ✓ 14 passed (208ms)' },
      ],
    },
    's-2151': {
      issueId: 'IN-5', runner: 'codex', status: 'running',
      startedMinsAgo: 18, waitingMs: 0,
      tokensIn: 14200, tokensOut: 2410,
      diff: { added: 19, removed: 4, files: 3 },
      branch: 'in-5-autoupdate',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'Tauri 2 updater plugin added; endpoint signed by ed25519.' },
        { kind: 'agent', text: 'Generated pubkey; staged the .pem next to tauri.conf.json.' },
        { kind: 'sys',   text: '› cargo tauri build --target universal-apple-darwin' },
        { kind: 'sys',   text: '  Compiling marrow-symphony v0.1.0' },
      ],
    },

    // ── Idle ───────────────────────────────────────────────────────────────
    's-2153': {
      issueId: 'MAR-18', runner: 'codex', status: 'idle',
      startedMinsAgo: 32, waitingMs: 0,
      tokensIn: 6240, tokensOut: 980,
      diff: { added: 91, removed: 104, files: 6 },
      branch: 'mar-18-toast',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'Replaced react-hot-toast with useToast() hook.' },
        { kind: 'agent', text: 'All 14 call-sites migrated. Awaiting review.' },
        { kind: 'sys',   text: '  · idle 6m' },
      ],
    },
    's-2154': {
      issueId: 'AP-11', runner: 'codex', status: 'idle',
      startedMinsAgo: 12, waitingMs: 0,
      tokensIn: 2100, tokensOut: 410,
      diff: { added: 4, removed: 2, files: 1 },
      branch: 'ap-11-pin-pnpm',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'pnpm pinned to 9.12.3 in package.json + corepack.' },
        { kind: 'sys',   text: '  · idle 2m' },
      ],
    },
    's-2155': {
      issueId: 'DC-9', runner: 'claude', status: 'idle',
      startedMinsAgo: 55, waitingMs: 0,
      tokensIn: 5800, tokensOut: 1240,
      diff: { added: 0, removed: 0, files: 0 },
      branch: 'dc-9-mermaid',
      strategy: 'shared',
      preview: [
        { kind: 'agent', text: 'Drafted 3 sequence diagrams + 1 state chart.' },
        { kind: 'sys',   text: '  · idle 11m' },
      ],
    },

    // ── Exited ─────────────────────────────────────────────────────────────
    's-2152': {
      issueId: 'IN-8', runner: 'kilo', status: 'exited',
      startedMinsAgo: 64, waitingMs: 0,
      tokensIn: 19200, tokensOut: 3120,
      diff: { added: 38, removed: 9, files: 4 },
      branch: 'in-8-codesign',
      strategy: 'worktree',
      preview: [
        { kind: 'agent', text: 'notarytool submit · request UUID a3c…b91' },
        { kind: 'sys',   text: '  status: Accepted' },
        { kind: 'sys',   text: '✓ exited 0 · 64m' },
      ],
    },
  },
};

// Helpers
window.MS_ISSUE = (id) => window.MS_DATA.issues.find((i) => i.id === id);
window.MS_PROJECT = (id) => window.MS_DATA.projects[id];
window.MS_SESSION = (id) => window.MS_DATA.sessions[id];

// Format a wait-time-ish ms span into a compact "2m 02s" / "21m" / "1h 02m".
window.MS_FMT = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
};
