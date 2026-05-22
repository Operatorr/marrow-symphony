// Marrow Symphony — Feed view
// The signature surface: a TikTok/Reels-style attention queue.
// One Needs-Input Session at a time, full-screen, with Issue context
// alongside. Glass cards on the shader; the terminal stays solid.

const FD = window.FEED_DATA;
const FI = window.FEED_ICONS;

// ─── Atoms ──────────────────────────────────────────────────────────────────
const FdIcon = ({ d, size = 16, stroke = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', ...style }}>
    <path d={d} />
  </svg>
);

const FdKbd = ({ children, style = {} }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--fg3)',
    font: '500 11px/1 var(--font-mono)',
    boxShadow: 'inset 0 -1px 0 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
    ...style,
  }}>{children}</span>
);

// "Needs Input" pill — rainbow-border, gray body, animated dot.
// Lifted from the design system's terminal-frame component.
const FdNeedsPill = ({ size = 'md' }) => {
  const h = size === 'sm' ? 22 : 26;
  const px = size === 'sm' ? 10 : 12;
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span className="fd-needs-pill" style={{
      position: 'relative',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      height: h, padding: `0 ${px}px`,
      borderRadius: 8,
      border: '2px solid transparent',
      background: `linear-gradient(#1a1a1f,#1a1a1f) padding-box,
        linear-gradient(135deg,#da8c6b,#d930b1,#8844d8,#4e52f4,#87f3ff) border-box`,
      color: '#fafafa',
      font: `500 ${fs}px/1 var(--font-sans)`,
      whiteSpace: 'nowrap', flex: 'none',
      boxShadow: '0 4px 16px -6px rgba(217,48,177,0.35), 0 4px 16px -6px rgba(78,82,244,0.20)',
    }}>
      <span className="fd-attn-dot" />
      Needs input
    </span>
  );
};

// ─── Top bar (slim app shell version, Feed selected) ────────────────────────
const FdTopBar = ({ waiting }) => (
  <div style={{
    height: 44, flex: 'none', position: 'relative', zIndex: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 14px',
    background: 'rgb(20 20 22 / 0.55)',
    backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.55)',
  }}>
    {/* Left: logo + workspace */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 240 }}>
      <span style={{
        width: 22, height: 22, borderRadius: 6, background: '#0a0a0a',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}>
        <svg viewBox="0 0 64 64" width={14} height={14} fill="none">
          <g stroke="#fafafa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 42 V24 Q14 20 18 20 Q22 20 22 24 V42 M22 28 Q22 24 26 24 Q30 24 30 28 V42" />
            <path d="M48 26 Q44 22 39 22 Q34 22 34 27 Q34 31 39 32 Q44 33 44 38 Q44 43 38 43 Q34 43 32 41" />
          </g>
        </svg>
      </span>
      <span style={{
        font: '600 14px/1 var(--font-sans)', letterSpacing: '-0.01em', color: 'var(--fg1)',
      }}>Marrow Symphony</span>
    </div>

    {/* Center: view switch */}
    <div style={{
      display: 'inline-flex', background: 'rgba(0,0,0,0.42)',
      borderRadius: 10, padding: 3,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {['Board', 'Cockpit', 'Feed'].map((v) => {
        const active = v === 'Feed';
        return (
          <button key={v} style={{
            position: 'relative', height: 28, padding: '0 18px',
            background: active ? '#fafafa' : 'transparent',
            color: active ? '#0a0a0a' : 'var(--fg2)',
            border: 0, borderRadius: 8, cursor: 'pointer',
            font: '500 13px/1 var(--font-sans)', letterSpacing: '-0.005em',
          }}>{v}</button>
        );
      })}
    </div>

    {/* Right: queue counter + search + settings */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', minWidth: 240 }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 9px 4px 7px', borderRadius: 999,
        background: 'rgba(0,217,255,0.08)',
        color: 'var(--status-needs-input)',
        font: '500 12px/1 var(--font-sans)',
      }}>
        <span className="fd-attn-dot" style={{ width: 6, height: 6 }} />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{waiting}</span> need input
      </span>
      <label style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 28, padding: '0 10px', width: 200,
        borderRadius: 8,
        background: 'rgba(0,0,0,0.42)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        <FdIcon d={FI.search} size={13} stroke="var(--fg4)" />
        <span style={{ flex: 1, color: 'var(--fg4)', font: '400 12px/1 var(--font-sans)' }}>Search</span>
        <FdKbd>⌘F</FdKbd>
      </label>
      <button style={{
        width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent', border: 0, borderRadius: 8, cursor: 'pointer', color: 'var(--fg3)',
      }}>
        <FdIcon d={FI.cog} size={15} />
      </button>
    </div>
  </div>
);

// ─── Slim Feed header — Issue context above the terminal ────────────────────
const fmtWait = (ms) => {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const FdSlimHeader = ({ entry }) => {
  const { project, issue, runner, session } = entry;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, padding: '14px 20px',
      borderRadius: 'var(--r-20)',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
    }}>
      {/* Left: breadcrumb + title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
        {/* project mark */}
        <span style={{
          width: 22, height: 22, borderRadius: 6,
          background: 'rgba(0,0,0,0.35)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 0 0 1.25px ${project.color}, 0 0 14px -2px ${project.color}88`,
          color: '#fafafa',
          font: '600 12px/1 var(--font-mono)',
          textTransform: 'uppercase',
          flex: 'none',
        }}>{project.glyph}</span>

        {/* breadcrumb */}
        <span style={{
          font: '500 13px/1 var(--font-sans)',
          color: project.color, letterSpacing: '-0.005em', flex: 'none',
        }}>{project.name}</span>
        <span style={{ color: 'var(--fg4)', font: '400 13px/1 var(--font-sans)', flex: 'none' }}>▸</span>
        <span style={{
          font: '500 13px/1 var(--font-mono)', color: 'var(--fg2)',
          fontVariantNumeric: 'tabular-nums', flex: 'none',
        }}>{issue.key}</span>

        {/* title */}
        <span style={{
          font: '500 15px/1 var(--font-sans)', color: 'var(--fg1)',
          letterSpacing: '-0.01em', marginLeft: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
        }}>{issue.title}</span>
      </div>

      {/* Right: runner / wait / status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          height: 22, padding: '0 8px', borderRadius: 6,
          background: 'rgba(255,255,255,0.04)', color: 'var(--fg3)',
          font: '500 11px/1 var(--font-sans)',
        }}>
          <span style={{ color: 'var(--fg4)' }}>Runner</span>
          <span style={{ color: 'var(--fg1)', font: '500 11px/1 var(--font-mono)' }}>{runner.name}</span>
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--fg3)', font: '500 12px/1 var(--font-sans)',
        }}>
          <FdIcon d={FI.clock} size={12} stroke="var(--fg4)" />
          waiting <span style={{
            color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums',
          }}>{fmtWait(session.waitingMs)}</span>
        </span>
        <FdNeedsPill />
      </div>
    </div>
  );
};

// ─── Terminal — solid, high-contrast working surface ────────────────────────
const FdTerminalLine = ({ line }) => {
  const styles = {
    sys:     { color: 'var(--fg4)', font: '400 13px/20px var(--font-mono)' },
    agent:   { color: 'var(--fg2)', font: '400 13px/20px var(--font-mono)' },
    bullet:  { color: 'var(--fg2)', font: '400 13px/20px var(--font-mono)', paddingLeft: 14 },
    'diff-h':  { color: 'var(--fg4)', font: '500 12px/22px var(--font-mono)',
                 paddingTop: 6, letterSpacing: 0 },
    'diff-ad': { color: '#79fa87', font: '400 13px/20px var(--font-mono)',
                 background: 'rgba(121,250,135,0.06)', display: 'block' },
    'diff-rm': { color: '#fda4af', font: '400 13px/20px var(--font-mono)',
                 background: 'rgba(244,63,94,0.06)', display: 'block' },
    prompt:  { color: 'var(--fg1)', font: '500 13px/22px var(--font-mono)', paddingTop: 4 },
  };
  if (line.kind === 'prompt') {
    return (
      <div style={styles.prompt}>
        <span style={{ color: 'var(--status-needs-input)' }}>{'> '}</span>
        {line.text}
        <span className="fd-caret" />
      </div>
    );
  }
  return (
    <div style={{
      ...styles[line.kind],
      whiteSpace: 'pre',
      fontFeatureSettings: '"ss01" on',
      fontVariantNumeric: 'tabular-nums slashed-zero',
    }}>
      {line.text || '\u00A0'}
    </div>
  );
};

const FdTerminal = ({ entry }) => {
  const { project, issue, runner, terminal, session } = entry;
  return (
    <div style={{
      flex: 1, minWidth: 0, minHeight: 0,
      display: 'flex', flexDirection: 'column',
      borderRadius: 14,
      overflow: 'hidden',
      background: '#0a0a0a',
      // Subtle needs-input outer glow on the terminal — pulls the eye in.
      boxShadow: '0 1px 2px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,217,255,0.18), 0 0 56px -10px rgba(0,217,255,0.45)',
    }}>
      {/* Terminal body */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: '18px 20px 20px 20px',
        background: '#0a0a0a',
      }}>
        {terminal.map((line, i) => <FdTerminalLine key={i} line={line} />)}
      </div>

      {/* Bottom bar — inline answer hint + session telemetry */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px 12px 20px',
        background: '#0a0a0a',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)',
      }}>
        <span style={{ color: 'var(--fg4)' }}>Reply:</span>
        <FdKbd>y</FdKbd>
        <span style={{ color: 'var(--fg4)' }}>Yes, apply</span>
        <span style={{ color: 'var(--fg4)', margin: '0 2px' }}>·</span>
        <FdKbd>n</FdKbd>
        <span style={{ color: 'var(--fg4)' }}>No, refine</span>
        <span style={{ color: 'var(--fg4)', margin: '0 2px' }}>·</span>
        <span style={{ color: 'var(--fg4)' }}>or type a message</span>
        <FdKbd>⏎</FdKbd>

        <span style={{ flex: 1 }} />

        {/* Session telemetry — runner · tokens · elapsed */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          font: '500 11px/1 var(--font-mono)', color: 'var(--fg3)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--status-needs-input)',
            boxShadow: '0 0 8px var(--status-needs-input-glow)',
          }} />
          {runner.name}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
        <span style={{
          font: '500 11px/1 var(--font-mono)', color: 'var(--fg4)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {(runner.tokensIn + runner.tokensOut).toLocaleString()} tok
        </span>
        <span style={{ color: 'rgba(255,255,255,0.08)' }}>|</span>
        <span style={{
          font: '500 11px/1 var(--font-mono)', color: 'var(--fg4)',
          fontVariantNumeric: 'tabular-nums',
        }}>{session.startedMinsAgo}m elapsed</span>
      </div>
    </div>
  );
};

window.FdIcon = FdIcon; window.FdKbd = FdKbd; window.FdNeedsPill = FdNeedsPill;
window.FdTopBar = FdTopBar; window.FdSlimHeader = FdSlimHeader;
window.FdTerminal = FdTerminal; window.fmtWait = fmtWait;
