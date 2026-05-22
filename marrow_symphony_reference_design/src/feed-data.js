// Feed view data — the attention queue.
// Each entry is a Session that needs Input, with enough Issue/project context
// to render a Feed card without any further lookups.

window.FEED_DATA = {
  queue: [
    {
      id: 's-2147',
      project: { id: 'webapp', name: 'webapp', color: '#5b8cff', glyph: 'w' },
      issue: {
        key: 'MAR-7',
        title: 'Fix auth retry logic',
        state: 'In Progress',
        body: [
          'Login fails ~5% of the time on flaky networks; the existing retry',
          'gives up after 1 attempt and surfaces a raw 502 to the user.',
          '',
          '— back off exponentially (250ms → 4s, max 5 tries)',
          '— treat 5xx, network and timeout errors as retryable',
          '— bubble a typed `AuthRetryExhausted` only after the budget',
        ],
        linear: 'MAR-7 · Linear',
      },
      workspace: {
        strategy: 'worktree',
        branch: 'mar-7-auth-retry',
        baseBranch: 'main',
        diff: { added: 24, removed: 3, files: 2 },
        files: [
          { path: 'src/auth/retry.ts',          added: 22, removed: 3 },
          { path: 'src/auth/retry.test.ts',     added: 2,  removed: 0 },
        ],
      },
      runner: { name: 'claude', tokensIn: 18420, tokensOut: 3104 },
      session: {
        status: 'Needs Input',
        waitingMs: 122 * 1000,         // 2m 02s
        startedMinsAgo: 14,
      },
      terminal: [
        { kind: 'sys',     text: 'claude · session 0a3f · cwd ~/code/webapp-mar-7-auth-retry' },
        { kind: 'sys',     text: '' },
        { kind: 'agent',   text: 'I traced the failure to retry.ts:42 — the catch swallows ECONNRESET' },
        { kind: 'agent',   text: 'and returns null, which the caller then treats as success. Plan:' },
        { kind: 'bullet',  text: '· widen the retryable predicate to {5xx, ECONNRESET, ETIMEDOUT}' },
        { kind: 'bullet',  text: '· move the budget into config (5 tries / 5s cap), tabulate jitter' },
        { kind: 'bullet',  text: '· throw AuthRetryExhausted on budget exhaustion so callers can branch' },
        { kind: 'agent',   text: '' },
        { kind: 'agent',   text: 'Diff is small — 24 add / 3 remove across retry.ts + its test.' },
        { kind: 'diff-h',  text: 'src/auth/retry.ts' },
        { kind: 'diff-rm', text: '-   if (err.code === 502) return retry(req, n - 1);' },
        { kind: 'diff-rm', text: '-   return null;' },
        { kind: 'diff-ad', text: '+   if (isRetryable(err) && n > 0) {' },
        { kind: 'diff-ad', text: '+     await sleep(backoff(attempt, jitter));' },
        { kind: 'diff-ad', text: '+     return retry(req, n - 1, attempt + 1);' },
        { kind: 'diff-ad', text: '+   }' },
        { kind: 'diff-ad', text: '+   throw new AuthRetryExhausted(req, attempt);' },
        { kind: 'agent',   text: '' },
        { kind: 'prompt',  text: 'Apply this patch to src/auth/retry.ts? (y/n)' },
      ],
    },
    {
      id: 's-2148',
      project: { id: 'api', name: 'api', color: '#79fa87', glyph: 'a' },
      issue: { key: 'AP-3', title: 'GraphQL pagination cursor — Relay vs offset' },
      runner: { name: 'codex' },
      session: { waitingMs: 348 * 1000 },
    },
    {
      id: 's-2149',
      project: { id: 'docs', name: 'docs', color: '#ffb300', glyph: 'd' },
      issue: { key: 'DC-12', title: 'Rewrite "Getting started" for the new CLI shape' },
      runner: { name: 'claude' },
      session: { waitingMs: 612 * 1000 },
    },
    {
      id: 's-2150',
      project: { id: 'webapp', name: 'webapp', color: '#5b8cff', glyph: 'w' },
      issue: { key: 'MAR-12', title: 'Session token refresh race condition' },
      runner: { name: 'kilo' },
      session: { waitingMs: 1280 * 1000 },
    },
  ],
};

window.FEED_ICONS = {
  // Lucide-shaped 24x24 path strings (1.5px stroke, no fill).
  chevUp:     'm18 15-6-6-6 6',
  chevDown:   'm6 9 6 6 6-6',
  chevLeft:   'm15 18-6-6 6-6',
  chevRight:  'm9 18 6-6-6-6',
  check:      'M20 6 9 17l-5-5',
  x:          'M18 6 6 18M6 6l12 12',
  skip:       'm5 4 10 8-10 8zM19 5v14',          // skip-forward
  snooze:     'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  external:   'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  gitBranch:  'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6M18 9a9 9 0 0 1-9 9',
  file:       'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
  clock:      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  zap:        'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  layers:     'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  terminal:   'm4 17 6-6-6-6M12 19h8',
  inbox:      'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  sparkle:    'm12 3 1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z',
  search:     'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
  cog:        'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9 1.65 1.65 0 0 0 4.27 7.18l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.36.15.68.39.95.69',
  sidebar:    'M3 5h18v14H3zM10 5v14',
};
