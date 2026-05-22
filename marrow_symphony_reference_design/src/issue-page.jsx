// Marrow Symphony — Issue page
// Reached by clicking a card on the Board. Replaces the main view with:
// header (← Board · project ▸ issue · current column · Linear) · main
// terminal(s) with Start / Stop / + New Session · right rail (editable task,
// Workspace, Runner, Diff).
//
// Two variants:
//   IssuePageRunning   — live Needs-Input Session, full terminal, multi-session tabs
//   IssuePageNotStarted — no Session yet, prominent Start CTA, task body visible

const IP = window.MS_DATA;
const IPICONS = window.SHELL_ICONS;

const IpIcon = ({ d, size = 14, stroke = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', ...style }}>
    <path d={d} />
  </svg>
);

const IP_ICONS = {
  back:       'm15 18-6-6 6-6',
  bullet:     'M12 12m-1 0a1 1 0 1 0 2 0 1 1 0 0 0-2 0',
  external:   'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  square:     'M5 5h14v14H5z',
  play:       'M6 4l14 8-14 8z',
  zap:        'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  edit:       'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  copy:       'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z',
  branch:     'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 9v6M18 9a9 9 0 0 1-9 9',
  worktree:   'M3 7h7v10H3zM14 7h7v10h-7z',
  caret:      'm6 9 6 6 6-6',
  feed:       'M4 4h2a14 14 0 0 1 14 14v2M4 11a9 9 0 0 1 9 9M4 18h.01',
  link:       'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  rotate:     'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
};

// Linear-mark glyph (re-used from shell-data, but inline here for clarity)
const IpLinearMark = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
    strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d="M3.5 13l9.5-9.5M5 18.5l13.5-13.5M10.5 21l10.5-10.5" />
  </svg>
);

// The single chromatic accent on this page: the active Project's color.
const PROJECT_ACCENT = '#5b8cff';

// ─── Issue-page header ──────────────────────────────────────────────────────
const IpHeader = ({ issue, project, session, hasSession }) => {
  const stateColumn = {
    backlog:    { label: 'Backlog',   color: 'var(--fg4)' },
    todo:       { label: 'Todo',      color: 'var(--fg3)' },
    started:    { label: 'Started',   color: 'var(--status-needs-input)' },
    'in-review':{ label: 'In Review', color: PROJECT_ACCENT },
    done:       { label: 'Done',      color: 'var(--status-running)' },
  }[issue.state];

  return (
    <div style={{
      flex: 'none',
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 22px',
      borderRadius: 'var(--r-20)',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
      margin: '10px 10px 0 10px',
      position: 'relative', zIndex: 4,
    }}>
      {/* Back to Board */}
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 28, padding: '0 10px 0 8px',
        background: 'rgba(255,255,255,0.04)',
        color: 'var(--fg2)', cursor: 'pointer',
        border: 0, borderRadius: 7,
        font: '500 12px/1 var(--font-sans)',
        flex: 'none',
      }}>
        <IpIcon d={IP_ICONS.back} size={12} stroke="currentColor" />
        Board
      </button>

      <div style={{ width: 1, height: 22, background: 'rgba(255,255,255,0.08)', flex: 'none' }} />

      {/* Project chip + name + issue key + title */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        minWidth: 0, flex: 1,
      }}>
        <CProjectChip project={project} size={26} fs={13} />
        <span style={{
          font: '500 13px/1 var(--font-sans)',
          color: project.color, letterSpacing: '-0.005em', flex: 'none',
        }}>{project.name}</span>
        <span style={{
          color: 'var(--fg4)', font: '400 13px/1 var(--font-sans)', flex: 'none',
        }}>▸</span>
        <span style={{
          font: '500 13px/1 var(--font-mono)', color: 'var(--fg3)',
          fontVariantNumeric: 'tabular-nums', flex: 'none',
        }}>{issue.id}</span>
        <h1 style={{
          margin: 0,
          font: '600 17px/1.2 var(--font-sans)',
          letterSpacing: '-0.015em', color: 'var(--fg1)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          minWidth: 0, marginLeft: 4,
        }}>{issue.title}</h1>
      </div>

      {/* Right cluster: column · session status · linear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 'none' }}>
        {/* Column / State Type dropdown */}
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 28, padding: '0 8px 0 10px',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--fg2)', cursor: 'pointer',
          border: 0, borderRadius: 7,
          font: '500 12px/1 var(--font-sans)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 2,
            background: stateColumn.color,
            boxShadow: issue.state === 'started' ? `0 0 8px ${stateColumn.color}` : 'none',
          }} />
          {stateColumn.label}
          <IpIcon d={IP_ICONS.caret} size={11} stroke="currentColor" />
        </button>

        {/* Needs-input pill */}
        {hasSession && session.status === 'needs-input' && <CNeedsPill size="sm" />}

        {/* Linear link — icon-only */}
        <button title={`Open ${issue.id} in Linear`} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 28, height: 28,
          background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
          cursor: 'pointer', border: 0, borderRadius: 7,
        }}>
          <IpLinearMark size={13} color="currentColor" />
        </button>
      </div>
    </div>
  );
};

// ─── Session tab strip (above the terminal) ─────────────────────────────────
// One real Session tab (`claude` active) + a quiet `+ New Session` button.
// Start / Stop sit on the right of the strip, hugging the terminal.
// A `← Board` chip lives at the leftmost edge — the page header that used
// to live above this is gone; identity moved to the right panel.
const IpBackToBoard = ({ style }) => (
  <button title="Back to Board (esc)" style={{
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: 26, padding: '0 10px 0 8px',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--fg2)', cursor: 'pointer',
    border: 0, borderRadius: 7,
    font: '500 12px/1 var(--font-sans)',
    flex: 'none',
    ...style,
  }}>
    <IpIcon d={IP_ICONS.back} size={12} stroke="currentColor" />
    Board
  </button>
);

const IpSessionTabs = ({ sessions, activeIdx = 0, sessionLive = true }) => (
  <div style={{
    flex: 'none',
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 10px 0',
    background: '#0e0e10',
  }}>
    <IpBackToBoard style={{ alignSelf: 'flex-end', marginBottom: 6 }} />
    <span style={{
      width: 1, height: 18, background: 'rgba(255,255,255,0.08)',
      alignSelf: 'flex-end', marginBottom: 10, flex: 'none',
    }} />
    {sessions.map((s, i) => {
      const active = i === activeIdx;
      return (
        <button key={i} style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 14px 0 12px',
          border: 0, borderRadius: '8px 8px 0 0',
          background: active ? '#0a0a0a' : 'transparent',
          color: active ? 'var(--fg1)' : 'var(--fg3)',
          cursor: 'pointer',
          font: '500 12px/1 var(--font-sans)',
          letterSpacing: '-0.005em',
          boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.06)' : 'none',
        }}>
          <CStatusDot status={s.status} size={7} />
          <span style={{ font: '500 12px/1 var(--font-mono)' }}>{s.runner}</span>
          <span style={{ color: 'var(--fg4)', font: '500 11px/1 var(--font-mono)' }}>
            · {s.id}
          </span>
        </button>
      );
    })}

    <button title="Start a second Session on this Issue" style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      height: 30, padding: '0 12px 0 10px',
      border: 0, borderRadius: '8px 8px 0 0',
      background: 'transparent', color: 'var(--fg3)', cursor: 'pointer',
      font: '500 12px/1 var(--font-sans)',
      marginLeft: 2,
    }}>
      <IpIcon d={IPICONS.plus} size={12} stroke="currentColor" />
      New Session
    </button>

    <span style={{ flex: 1 }} />

    {/* Session action bar — Start · Stop sit just above the terminal */}
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '0 4px 6px 0', alignSelf: 'flex-end',
    }}>
      <button title={sessionLive ? 'Already running' : 'Start Session'} disabled={sessionLive} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 24, padding: '0 10px',
        background: 'transparent',
        color: sessionLive ? 'var(--fg4)' : 'var(--fg2)',
        opacity: sessionLive ? 0.55 : 1,
        border: 0, borderRadius: 6,
        cursor: sessionLive ? 'default' : 'pointer',
        font: '500 12px/1 var(--font-sans)',
      }}>
        <IpIcon d={IP_ICONS.play} size={10} strokeWidth={1.8} />
        Start
      </button>
      <span style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.08)' }} />
      <button title="Stop Session" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 24, padding: '0 10px',
        background: 'transparent',
        color: 'var(--fg2)',
        border: 0, borderRadius: 6, cursor: 'pointer',
        font: '500 12px/1 var(--font-sans)',
      }}>
        <IpIcon d={IP_ICONS.square} size={10} strokeWidth={1.8} />
        Stop
      </button>
    </div>
  </div>
);

// ─── Big terminal (full, with the agent's full output) ──────────────────────
const ipTerminalLines = [
  { kind: 'sys',     text: 'claude · session 0a3f · cwd ~/code/webapp/.marrow/worktrees/mar-7-auth-retry' },
  { kind: 'sys',     text: 'workspace: worktree · branch mar-7-auth-retry · base main' },
  { kind: 'sys',     text: '' },
  { kind: 'agent',   text: '> Read CONTEXT, read src/auth/retry.ts and its test, then read the' },
  { kind: 'agent',   text: '  Linear ticket. Propose the smallest patch that fixes the 5% retry' },
  { kind: 'agent',   text: '  failure described in MAR-7.' },
  { kind: 'agent',   text: '' },
  { kind: 'agent',   text: 'I traced the failure to retry.ts:42 — the catch swallows ECONNRESET' },
  { kind: 'agent',   text: 'and returns null, which the caller then treats as success. Plan:' },
  { kind: 'bullet',  text: '· widen the retryable predicate to {5xx, ECONNRESET, ETIMEDOUT}' },
  { kind: 'bullet',  text: '· move the budget into config (5 tries / 5s cap), jittered backoff' },
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
];

const IpTerminalLine = ({ line }) => {
  const styles = {
    sys:       { color: 'var(--fg4)', font: '400 13px/22px var(--font-mono)' },
    agent:     { color: 'var(--fg2)', font: '400 13px/22px var(--font-mono)' },
    bullet:    { color: 'var(--fg2)', font: '400 13px/22px var(--font-mono)', paddingLeft: 14 },
    'diff-h':  { color: 'var(--fg4)', font: '500 12px/24px var(--font-mono)', paddingTop: 6 },
    'diff-ad': { color: '#79fa87', font: '400 13px/22px var(--font-mono)',
                 background: 'rgba(121,250,135,0.06)', display: 'block' },
    'diff-rm': { color: '#fda4af', font: '400 13px/22px var(--font-mono)',
                 background: 'rgba(244,63,94,0.06)', display: 'block' },
    prompt:    { color: 'var(--fg1)', font: '500 13px/24px var(--font-mono)', paddingTop: 4 },
  };
  if (line.kind === 'prompt') {
    return (
      <div style={styles.prompt}>
        <span style={{ color: 'var(--status-needs-input)' }}>{'> '}</span>
        {line.text}
        <span className="ip-caret" />
      </div>
    );
  }
  return (
    <div style={{
      ...styles[line.kind],
      whiteSpace: 'pre',
      fontFeatureSettings: '"ss01" on',
      fontVariantNumeric: 'tabular-nums slashed-zero',
    }}>{line.text || '\u00A0'}</div>
  );
};

const IpTerminal = ({ needs = true }) => (
  <div style={{
    flex: 1, minWidth: 0, minHeight: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    background: '#0a0a0a',
  }}>
    {/* Scrollback */}
    <div style={{
      flex: 1, minHeight: 0, overflow: 'auto',
      padding: '14px 20px 18px',
    }}>
      {ipTerminalLines.map((line, i) => <IpTerminalLine key={i} line={line} />)}
    </div>

    {/* Composer */}
    <div style={{
      flex: 'none',
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '10px 16px 12px 20px',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      background: '#0a0a0a',
    }}>
      {needs ? (
        <>
          <span style={{ color: 'var(--fg4)', font: '500 12px/1 var(--font-sans)' }}>Reply:</span>
          <CKbd>y</CKbd>
          <span style={{ color: 'var(--fg4)', font: '500 12px/1 var(--font-sans)' }}>Yes, apply</span>
          <span style={{ color: 'var(--fg4)', margin: '0 2px' }}>·</span>
          <CKbd>n</CKbd>
          <span style={{ color: 'var(--fg4)', font: '500 12px/1 var(--font-sans)' }}>No, refine</span>
          <span style={{ color: 'var(--fg4)', margin: '0 2px' }}>·</span>
          <span style={{ color: 'var(--fg4)', font: '500 12px/1 var(--font-sans)' }}>or type a message</span>
          <CKbd>⏎</CKbd>
        </>
      ) : (
        <>
          <span style={{ color: 'var(--fg4)', font: '500 12px/1 var(--font-sans)' }}>›</span>
          <span style={{
            flex: 1, color: 'var(--fg4)',
            font: '400 13px/1 var(--font-mono)',
          }}>type to send to the agent…</span>
        </>
      )}
    </div>
  </div>
);

// ─── Right rail: task / workspace / runner / diff ───────────────────────────
const IpRailSection = ({ label, action, children, padded = true }) => (
  <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: padded ? '0 2px' : 0,
    }}>
      <span style={{
        font: '600 11px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        color: 'var(--fg3)',
      }}>{label}</span>
      {action}
    </div>
    {children}
  </section>
);

const IpKV = ({ k, v, mono = true, accent }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '88px 1fr', gap: 10,
    font: '500 12px/16px var(--font-sans)',
  }}>
    <span style={{ color: 'var(--fg4)' }}>{k}</span>
    <span style={{
      color: accent || 'var(--fg2)',
      font: mono ? '500 12px/16px var(--font-mono)' : '500 12px/16px var(--font-sans)',
      fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>{v}</span>
  </div>
);

// ─── Agent context / session-usage gauges ───────────────────────────────────
// `IpContextRing`  — SVG circular progress with a centered % readout.
// `IpUsageBar`     — horizontal progress for the rolling-window session quota.
// `IpAgentPanel`   — composes both, slots into the rail above Task.
// `IpRailCollapsed` — slim 56px strip shown when the rail is collapsed via ⌘].

const ipTintFor = (pct) =>
  pct > 0.9 ? 'var(--status-needs-input)'
    : pct > 0.75 ? '#f5a524'
    : PROJECT_ACCENT;

const IpContextRing = ({ pct, size = 56, stroke = 4 }) => {
  const p = Math.min(1, Math.max(0, pct));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - p);
  const tint = ipTintFor(p);
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={tint} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          style={{
            filter: `drop-shadow(0 0 4px ${tint}66)`,
            transition: 'stroke-dashoffset 320ms var(--ease-out-expo)',
          }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        font: `600 ${Math.round(size * 0.27)}px/1 var(--font-mono)`,
        color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
      }}>
        {Math.round(p * 100)}<span style={{
          color: 'var(--fg4)',
          font: `500 ${Math.round(size * 0.18)}px/1 var(--font-mono)`,
          marginLeft: 1,
        }}>%</span>
      </div>
    </div>
  );
};

const IpUsageBar = ({ pct }) => {
  const p = Math.min(1, Math.max(0, pct));
  const tint = ipTintFor(p);
  return (
    <div style={{
      position: 'relative', height: 6, borderRadius: 999,
      background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${p * 100}%`,
        background: tint,
        boxShadow: `0 0 8px ${tint}aa`,
        borderRadius: 999,
        transition: 'width 320ms var(--ease-out-expo)',
      }} />
    </div>
  );
};

const IpAgentPanel = ({ runner, context, sessionUsage }) => (
  <IpRailSection
    label="Agent"
    action={
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: '400 11px/1 var(--font-mono)', color: 'var(--fg4)',
      }}>
        {runner} · {(context.cap / 1000).toFixed(0)}k ctx
      </span>
    }>
    <div style={{
      padding: '14px 14px 14px',
      borderRadius: 10,
      background: 'rgba(0,0,0,0.30)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Context ring */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <IpContextRing pct={context.pct} size={56} stroke={4} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ font: '500 12px/16px var(--font-sans)', color: 'var(--fg2)' }}>
            Context
          </span>
          <span style={{
            font: '500 12px/16px var(--font-mono)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {(context.used / 1000).toFixed(0)}k <span style={{ color: 'var(--fg4)' }}>of</span> {(context.cap / 1000).toFixed(0)}k tok
          </span>
          <span style={{
            font: '400 11px/14px var(--font-sans)', color: 'var(--fg4)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {((context.cap - context.used) / 1000).toFixed(0)}k remaining · compact ⌘K
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

      {/* Session usage */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ font: '500 12px/1 var(--font-sans)', color: 'var(--fg2)' }}>
            Session limit
          </span>
          <span style={{
            font: '500 12px/1 var(--font-mono)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {sessionUsage.used}<span style={{ color: 'var(--fg4)' }}>/</span>{sessionUsage.cap}<span style={{ color: 'var(--fg4)' }}> msgs</span>
          </span>
        </div>
        <IpUsageBar pct={sessionUsage.used / sessionUsage.cap} />
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          font: '400 11px/14px var(--font-sans)', color: 'var(--fg4)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          <span>{sessionUsage.window} window</span>
          <span>resets in {sessionUsage.resetIn}</span>
        </div>
      </div>
    </div>
  </IpRailSection>
);

// Pill used in the collapsed rail (mini context ring + label below).
const IpCollapsedGauge = ({ title, pct, size = 38, stroke = 3.5, sub }) => (
  <div title={title} style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
  }}>
    <IpContextRing pct={pct} size={size} stroke={stroke} />
    {sub && (
      <span style={{
        font: '500 10px/1 var(--font-mono)', color: 'var(--fg4)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: 'var(--tracking-caps)',
        textTransform: 'uppercase',
      }}>{sub}</span>
    )}
  </div>
);

const IpRailCollapsed = ({ hasSession, project, issue, context, sessionUsage, diff, onExpand }) => (
  <aside style={{
    width: 56, flex: 'none',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 12, padding: '12px 8px',
    background: 'rgb(20 20 22 / 0.55)',
    backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
    boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.05)',
    overflow: 'hidden',
  }}>
    <button onClick={onExpand}
      title="Show context (⌘])"
      style={{
        width: 32, height: 32, padding: 0, border: 0, borderRadius: 8,
        background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flex: 'none',
      }}>
      <IpIcon d={IP_ICONS.back} size={14} style={{ transform: 'rotate(180deg)' }} />
    </button>

    {/* Project chip + issue id (vertical) — the identity that used to live in the page header */}
    {project && (
      <div title={`${project.name} ▸ ${issue.id}`} style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <CProjectChip project={project} size={24} fs={12} />
        <span style={{
          font: '500 10px/1 var(--font-mono)', color: 'var(--fg3)',
          fontVariantNumeric: 'tabular-nums',
        }}>{issue.id}</span>
      </div>
    )}

    <div style={{ height: 1, width: 24, background: 'rgba(255,255,255,0.06)' }} />

    {hasSession ? (
      <>
        <IpCollapsedGauge title={`Context · ${Math.round(context.pct * 100)}%`}
          pct={context.pct} size={38} stroke={3.5} sub="ctx" />
        <IpCollapsedGauge title={`Session limit · ${sessionUsage.used}/${sessionUsage.cap}`}
          pct={sessionUsage.used / sessionUsage.cap} size={34} stroke={3} sub="ses" />

        {diff && diff.files > 0 && (
          <div title={`Diff · +${diff.added} −${diff.removed} · ${diff.files} files`}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              padding: '6px 6px', borderRadius: 8,
              background: 'rgba(0,0,0,0.30)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
              font: '500 10px/1.2 var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}>
            <span style={{ color: '#79fa87' }}>+{diff.added}</span>
            <span style={{ color: '#fda4af' }}>−{diff.removed}</span>
          </div>
        )}
      </>
    ) : (
      <span style={{
        writingMode: 'vertical-rl', transform: 'rotate(180deg)',
        font: '500 10px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        color: 'var(--fg4)', marginTop: 8,
      }}>
        Context
      </span>
    )}

    <span style={{ flex: 1 }} />

    <CKbd style={{ marginBottom: 2 }}>⌘]</CKbd>
  </aside>
);

// ─── Right-rail issue identity ─────────────────────────────────────────────
// What used to be the top page header now lives at the top of the right rail
// — Project chip + ID, full title, current column, Linear, Needs Input, and
// the collapse-panel control.
const IpIssueHeader = ({ issue, project, session, hasSession, onCollapse }) => {
  const stateColumn = {
    backlog:    { label: 'Backlog',   color: 'var(--fg4)' },
    todo:       { label: 'Todo',      color: 'var(--fg3)' },
    started:    { label: 'Started',   color: PROJECT_ACCENT },
    'in-review':{ label: 'In Review', color: PROJECT_ACCENT },
    done:       { label: 'Done',      color: 'var(--status-running)' },
  }[issue.state];

  return (
    <header style={{
      flex: 'none',
      display: 'flex', flexDirection: 'column', gap: 12,
      padding: '0 2px 14px',
      margin: '-2px -4px 0',
      boxShadow: '0 1px 0 rgba(255,255,255,0.06)',
    }}>
      {/* Top row: project crumb · collapse */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
      }}>
        <CProjectChip project={project} size={22} fs={11} />
        <span style={{
          font: '500 12px/1 var(--font-sans)', color: project.color,
          letterSpacing: '-0.005em', flex: 'none',
        }}>{project.name}</span>
        <span style={{
          color: 'var(--fg4)', font: '400 12px/1 var(--font-sans)', flex: 'none',
        }}>▸</span>
        <span style={{
          font: '500 12px/1 var(--font-mono)', color: 'var(--fg3)',
          fontVariantNumeric: 'tabular-nums', flex: 'none',
        }}>{issue.id}</span>
        <span style={{ flex: 1 }} />
        <button onClick={onCollapse}
          title="Hide context (⌘])"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 24, padding: '0 4px 0 8px',
            background: 'transparent', color: 'var(--fg3)',
            cursor: 'pointer', border: 0, borderRadius: 6,
            font: '500 11px/1 var(--font-sans)',
          }}>
          <CKbd>⌘]</CKbd>
          <IpIcon d={IP_ICONS.back} size={12} stroke="currentColor" />
        </button>
      </div>

      {/* Title */}
      <h1 style={{
        margin: 0,
        font: '600 17px/1.25 var(--font-sans)',
        letterSpacing: '-0.015em', color: 'var(--fg1)',
        textWrap: 'pretty',
      }}>{issue.title}</h1>

      {/* State + Linear + Needs Input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
      }}>
        <button style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 26, padding: '0 8px 0 10px',
          background: 'rgba(255,255,255,0.04)',
          color: 'var(--fg2)', cursor: 'pointer',
          border: 0, borderRadius: 7,
          font: '500 12px/1 var(--font-sans)',
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 2,
            background: stateColumn.color,
            boxShadow: issue.state === 'started' ? `0 0 8px ${stateColumn.color}` : 'none',
          }} />
          {stateColumn.label}
          <IpIcon d={IP_ICONS.caret} size={11} stroke="currentColor" />
        </button>

        <button title={`Open ${issue.id} in Linear`} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26,
          background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
          cursor: 'pointer', border: 0, borderRadius: 7,
        }}>
          <IpLinearMark size={13} color="currentColor" />
        </button>

        <span style={{ flex: 1 }} />

        {hasSession && session && session.status === 'needs-input' && (
          <CNeedsPill size="sm" />
        )}
      </div>
    </header>
  );
};

const IpRail = ({ issue, project, session, hasSession, onCollapse, agentData }) => {
  const taskBody = [
    "Login fails ~5% of the time on flaky networks; the existing retry gives up after 1 attempt and surfaces a raw 502 to the user.",
    "",
    "— back off exponentially (250ms → 4s, max 5 tries)",
    "— treat 5xx, network and timeout errors as retryable",
    "— bubble a typed `AuthRetryExhausted` only after the budget",
  ];

  return (
    <aside style={{
      width: 340, flex: 'none',
      display: 'flex', flexDirection: 'column',
      gap: 16, padding: '14px 18px 18px',
      overflow: 'auto',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'inset 1px 0 0 rgba(255,255,255,0.04)',
    }}>
      {/* Issue identity (what used to be the page header) */}
      <IpIssueHeader
        issue={issue} project={project} session={session} hasSession={hasSession}
        onCollapse={onCollapse}
      />

      {/* Agent — context fill + session usage */}
      {hasSession && agentData && (
        <IpAgentPanel
          runner={agentData.runner}
          context={agentData.context}
          sessionUsage={agentData.sessionUsage}
        />
      )}
      {/* Task */}
      <IpRailSection
        label="Task"
        action={
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            font: '400 11px/1 var(--font-mono)', color: 'var(--fg4)',
          }}>
            .marrow/issues/{issue.id.toLowerCase()}.md
            <button title="Edit" style={{
              width: 20, height: 20, padding: 0, border: 0, borderRadius: 4,
              background: 'transparent', cursor: 'pointer', color: 'var(--fg3)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IpIcon d={IP_ICONS.edit} size={11} stroke="currentColor" />
            </button>
          </span>
        }>
        <div style={{
          padding: '12px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.30)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          font: '400 13px/19px var(--font-sans)',
          color: 'var(--fg2)',
          letterSpacing: '-0.005em',
          textWrap: 'pretty',
        }}>
          {taskBody.map((p, i) => (
            <div key={i} style={{ minHeight: p === '' ? 6 : undefined }}>
              {p === '' ? '\u00A0' : p}
            </div>
          ))}
        </div>
      </IpRailSection>

      {/* Workspace */}
      <IpRailSection label="Workspace">
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.30)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <IpKV k="Strategy" mono={false}
            v={
              <>
                <IpIcon d={IP_ICONS.worktree} size={11} stroke="currentColor" />
                worktree
              </>
            } />
          <IpKV k="Branch" accent={PROJECT_ACCENT}
            v={
              <>
                <IpIcon d={IP_ICONS.branch} size={11} stroke={PROJECT_ACCENT} />
                {hasSession ? session.branch : 'mar-22-onboarding-wip'}
              </>
            } />
          <IpKV k="Base" v="main" />
          <IpKV k="Path" v={`~/code/webapp/.marrow/worktrees/${hasSession ? session.branch : 'mar-22-onboarding-wip'}`} />
        </div>
      </IpRailSection>

      {/* Runner */}
      <IpRailSection
        label="Runner"
        action={
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 18, padding: '0 6px', borderRadius: 4,
            background: 'transparent', color: 'var(--fg3)',
            cursor: 'pointer', border: 0,
            font: '500 11px/1 var(--font-sans)',
          }}>
            Override
            <IpIcon d={IP_ICONS.caret} size={10} stroke="currentColor" />
          </button>
        }>
        <div style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.30)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <IpKV k="Runner" v={hasSession ? session.runner : (issue.runner || 'claude')} />
          {hasSession && (
            <>
              <IpKV k="Tokens" v={`${session.tokensIn.toLocaleString()} in · ${session.tokensOut.toLocaleString()} out`} />
              <IpKV k="Elapsed" v={`${session.startedMinsAgo}m`} />
              {session.status === 'needs-input' && (
                <IpKV k="Waiting" accent="var(--status-needs-input)"
                  v={MS_FMT(session.waitingMs)} />
              )}
            </>
          )}
        </div>
      </IpRailSection>

      {/* Diff */}
      {hasSession && session.diff.files > 0 && (
        <IpRailSection
          label="Diff"
          action={
            <span style={{
              font: '500 11px/1 var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: '#79fa87' }}>+{session.diff.added}</span>
              <span style={{ margin: '0 4px', color: 'var(--fg4)' }}>·</span>
              <span style={{ color: '#fda4af' }}>−{session.diff.removed}</span>
              <span style={{ margin: '0 4px', color: 'var(--fg4)' }}>·</span>
              <span style={{ color: 'var(--fg3)' }}>{session.diff.files} files</span>
            </span>
          }>
          <div style={{
            padding: '8px 4px',
            borderRadius: 10,
            background: 'rgba(0,0,0,0.30)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            display: 'flex', flexDirection: 'column',
          }}>
            {[
              { path: 'src/auth/retry.ts',      added: 22, removed: 3 },
              { path: 'src/auth/retry.test.ts', added: 2,  removed: 0 },
            ].map((f) => {
              const total = f.added + f.removed;
              const adds = Math.max(1, Math.round((f.added / total) * 8));
              const rems = Math.max(0, 8 - adds);
              return (
                <button key={f.path} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  alignItems: 'center', gap: 10,
                  width: '100%', padding: '6px 10px',
                  background: 'transparent', border: 0, borderRadius: 6,
                  cursor: 'pointer', textAlign: 'left',
                  font: '500 12px/1 var(--font-mono)', color: 'var(--fg2)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  <span style={{
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    minWidth: 0,
                  }}>{f.path}</span>
                  <span style={{
                    color: 'var(--fg4)', font: '500 11px/1 var(--font-mono)',
                  }}>
                    <span style={{ color: '#79fa87' }}>+{f.added}</span>
                    {' '}
                    <span style={{ color: '#fda4af' }}>−{f.removed}</span>
                  </span>
                  <span style={{ display: 'inline-flex', gap: 2, flex: 'none' }}>
                    {Array.from({ length: adds }).map((_, i) => (
                      <span key={`a${i}`} style={{ width: 6, height: 8, background: '#79fa87', borderRadius: 1 }} />
                    ))}
                    {Array.from({ length: rems }).map((_, i) => (
                      <span key={`r${i}`} style={{ width: 6, height: 8, background: '#fda4af', borderRadius: 1 }} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 26, padding: '0 10px',
            background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
            cursor: 'pointer', border: 0, borderRadius: 6,
            font: '500 12px/1 var(--font-sans)',
            alignSelf: 'flex-start',
          }}>
            <IpIcon d={IP_ICONS.external} size={11} stroke="currentColor" />
            Open PR draft
          </button>
        </IpRailSection>
      )}

      {/* Cross-links */}
      <div style={{
        marginTop: 'auto', paddingTop: 14,
        boxShadow: '0 -1px 0 rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 6,
      }}>
        {hasSession && session.status === 'needs-input' && (
          <button style={{
            display: 'flex', alignItems: 'center', gap: 8,
            height: 32, padding: '0 12px',
            background: 'rgba(91,140,255,0.12)',
            color: PROJECT_ACCENT,
            cursor: 'pointer', border: 0, borderRadius: 7,
            font: '500 12px/1 var(--font-sans)',
          }}>
            <IpIcon d={IP_ICONS.feed} size={13} stroke="currentColor" />
            Open in Feed
            <span style={{ flex: 1 }} />
            <CKbd>⌘↑</CKbd>
          </button>
        )}
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 32, padding: '0 12px',
          background: 'transparent', color: 'var(--fg3)',
          cursor: 'pointer', border: 0, borderRadius: 7,
          font: '500 12px/1 var(--font-sans)',
        }}>
          <IpIcon d={IP_ICONS.zap} size={13} stroke="currentColor" />
          Open in Cockpit
        </button>
      </div>
    </aside>
  );
};

// ─── Main body (running case) ───────────────────────────────────────────────
// Mock agent telemetry — context fill and the rolling-window session quota.
// In production these come from the Session over IPC.
const IP_AGENT_DATA = {
  runner: 'claude',
  context:      { used: 128000, cap: 200000, pct: 0.64 },
  sessionUsage: { used: 47, cap: 250, window: '5h', resetIn: '3h 14m' },
};

// Shared hook: ⌘] / Ctrl-] toggles the right-side context panel.
const useContextPanelShortcut = (setCollapsed) => {
  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ']') {
        e.preventDefault();
        setCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCollapsed]);
};

const IpRunningBody = ({ issue, project, session }) => {
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  useContextPanelShortcut(setRailCollapsed);

  // The Issue currently has one live Session. A second can be spawned via
  // the `+ New Session` button in the tab strip.
  const sessions = [
    { id: '0a3f', runner: session.runner, status: session.status },
  ];

  return (
    <main style={{
      flex: 1, minHeight: 0,
      display: 'flex', gap: 0,
      margin: '10px 10px 10px 10px',
      borderRadius: 'var(--r-20)',
      overflow: 'hidden',
      background: 'rgb(8 8 10 / 0.55)',
      backdropFilter: 'blur(20px) saturate(120%)',
      WebkitBackdropFilter: 'blur(20px) saturate(120%)',
      boxShadow: 'var(--shadow-glass)',
      position: 'relative', zIndex: 4,
    }}>
      {/* Terminal column */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        background: '#0e0e10',
      }}>
        <IpSessionTabs sessions={sessions} activeIdx={0} />
        <IpTerminal needs={session.status === 'needs-input'} />
      </div>

      {/* Right rail — collapsible via ⌘] */}
      {railCollapsed ? (
        <IpRailCollapsed
          hasSession={true}
          project={project}
          issue={issue}
          context={IP_AGENT_DATA.context}
          sessionUsage={IP_AGENT_DATA.sessionUsage}
          diff={session.diff}
          onExpand={() => setRailCollapsed(false)}
        />
      ) : (
        <IpRail
          issue={issue} project={project} session={session}
          hasSession={true}
          agentData={IP_AGENT_DATA}
          onCollapse={() => setRailCollapsed(true)}
        />
      )}
    </main>
  );
};

// ─── Main body (not-yet-started case) ───────────────────────────────────────
const IpNotStartedBody = ({ issue, project }) => {
  const [railCollapsed, setRailCollapsed] = React.useState(false);
  useContextPanelShortcut(setRailCollapsed);
  return (
  <main style={{
    flex: 1, minHeight: 0,
    display: 'flex', gap: 0,
    margin: '10px 10px 10px 10px',
    borderRadius: 'var(--r-20)',
    overflow: 'hidden',
    background: 'rgb(8 8 10 / 0.55)',
    backdropFilter: 'blur(20px) saturate(120%)',
    WebkitBackdropFilter: 'blur(20px) saturate(120%)',
    boxShadow: 'var(--shadow-glass)',
    position: 'relative', zIndex: 4,
  }}>
    {/* Start CTA + dotted grid placeholder */}
    <div style={{
      flex: 1, minWidth: 0,
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#0e0e10',
    }}>
      {/* Back-to-Board chip — sits over the empty state since there's no tab strip */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 2,
      }}>
        <IpBackToBoard />
      </div>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
        padding: 32, maxWidth: 480, textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14,
          background: 'rgba(255,255,255,0.04)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
          color: 'var(--fg2)',
        }}>
          <IpIcon d={IP_ICONS.zap} size={26} strokeWidth={1.4} />
        </div>
        <div>
          <div style={{
            font: '600 22px/1.2 var(--font-sans)', letterSpacing: '-0.02em',
            color: 'var(--fg1)', marginBottom: 8,
          }}>No Session yet</div>
          <div style={{
            font: '400 13px/20px var(--font-sans)', color: 'var(--fg3)',
            maxWidth: 400,
          }}>
            Start prepares the Workspace per the Issue's Strategy and launches a Runner.
            You can override either from the right rail.
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 16px',
            background: '#fafafa', color: '#0a0a0a',
            border: 0, borderRadius: 8, cursor: 'pointer',
            font: '600 13px/1 var(--font-sans)',
            boxShadow: '0 4px 16px -6px rgba(255,255,255,0.25)',
          }}>
            <IpIcon d={IP_ICONS.play} size={13} stroke="#0a0a0a" strokeWidth={1.8} />
            Start
            <CKbd style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(10,10,10,0.6)', boxShadow: 'none' }}>⏎</CKbd>
          </button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 36, padding: '0 14px',
            background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
            border: 0, borderRadius: 8, cursor: 'pointer',
            font: '500 13px/1 var(--font-sans)',
          }}>
            Edit task first
          </button>
        </div>
        <div style={{
          marginTop: 8,
          font: '400 12px/1.5 var(--font-mono)', color: 'var(--fg4)',
        }}>
          worktree · branch {issue.id.toLowerCase()}-wip · runner {issue.runner || 'claude'}
        </div>
      </div>
    </div>

    {/* Right rail — collapsible via ⌘] (no Agent data yet — no Session) */}
    {railCollapsed ? (
      <IpRailCollapsed
        hasSession={false}
        project={project}
        issue={issue}
        onExpand={() => setRailCollapsed(false)}
      />
    ) : (
      <IpRail
        issue={issue} project={project}
        hasSession={false}
        onCollapse={() => setRailCollapsed(true)}
      />
    )}
  </main>
  );
};

// ─── Page wrappers ──────────────────────────────────────────────────────────
const IpPageBody = ({ children }) => (
  <div style={{
    flex: 1, minWidth: 0, minHeight: 0,
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
  }}>{children}</div>
);

const IssuePageRunning = () => {
  const issue = MS_ISSUE('MAR-7');
  const project = MS_PROJECT(issue.project);
  const session = MS_SESSION(issue.sessionId);
  return (
    <CFrame currentView="board" sidebarOpen={true} selected={project.id} reduceShader={true}>
      <IpPageBody>
        <IpRunningBody issue={issue} project={project} session={session} />
      </IpPageBody>
    </CFrame>
  );
};

const IssuePageNotStarted = () => {
  const issue = MS_ISSUE('MAR-22');
  const project = MS_PROJECT(issue.project);
  return (
    <CFrame currentView="board" sidebarOpen={true} selected={project.id} reduceShader={true}>
      <IpPageBody>
        <IpNotStartedBody issue={issue} project={project} />
      </IpPageBody>
    </CFrame>
  );
};

Object.assign(window, { IssuePageRunning, IssuePageNotStarted });
