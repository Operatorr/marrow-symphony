// Marrow Symphony — shared chrome
// Topbar + collapsible sidebar + the atoms each view reuses (Icon, Logo,
// AttentionPip, Kbd, NeedsPill, project glyph chip, project breadcrumb).
//
// Exposes everything on window so view files can pick them up without
// having to import. Reads window.SHELL_DATA / SHELL_ICONS (shell-data.js).

const CD = window.SHELL_DATA;
const CI = window.SHELL_ICONS;

// ─── Atoms ──────────────────────────────────────────────────────────────────
const CIcon = ({ d, size = 16, stroke = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', ...style }}>
    <path d={d} />
  </svg>
);

const CKbd = ({ children, style = {} }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px', borderRadius: 5,
    background: 'rgba(255,255,255,0.06)', color: 'var(--fg3)',
    font: '500 11px/1 var(--font-mono)',
    boxShadow: 'inset 0 -1px 0 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
    ...style,
  }}>{children}</span>
);

// Saturated cyan attention pip, animated.
const CAttentionPip = ({ size = 7, style = {} }) => (
  <span style={{
    position: 'relative', width: size, height: size, flex: 'none', display: 'inline-block', ...style,
  }}>
    <span style={{
      position: 'absolute', inset: 0, borderRadius: '50%',
      background: 'var(--status-needs-input)',
      boxShadow: '0 0 0 1px rgba(0,217,255,0.18), 0 0 12px 1px rgba(0,217,255,0.85)',
      animation: 'shell-pulse 1.4s ease-in-out infinite',
    }} />
  </span>
);

// Needs Input pill — rainbow border, dark fill, animated dot.
const CNeedsPill = ({ size = 'md', style = {} }) => {
  const h = size === 'sm' ? 22 : 26;
  const px = size === 'sm' ? 10 : 12;
  const fs = size === 'sm' ? 11 : 12;
  return (
    <span className="ch-needs-pill" style={{
      position: 'relative',
      display: 'inline-flex', alignItems: 'center', gap: 7,
      height: h, padding: `0 ${px}px`, borderRadius: 8,
      border: '2px solid transparent',
      background: `linear-gradient(#1a1a1f,#1a1a1f) padding-box,
        linear-gradient(135deg,#da8c6b,#d930b1,#8844d8,#4e52f4,#87f3ff) border-box`,
      color: '#fafafa', font: `500 ${fs}px/1 var(--font-sans)`,
      whiteSpace: 'nowrap', flex: 'none',
      boxShadow: '0 4px 16px -6px rgba(217,48,177,0.35), 0 4px 16px -6px rgba(78,82,244,0.20)',
      ...style,
    }}>
      <span className="ch-attn-dot" />
      Needs input
    </span>
  );
};

// Project mark — small square chip with project color stroke + glyph.
const CProjectChip = ({ project, size = 22, fs = 12, style = {} }) => (
  <span style={{
    width: size, height: size, borderRadius: 6,
    background: 'rgba(0,0,0,0.35)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: `inset 0 0 0 1.25px ${project.color}, 0 0 14px -2px ${project.color}88`,
    color: '#fafafa', font: `600 ${fs}px/1 var(--font-mono)`,
    textTransform: 'uppercase', flex: 'none', ...style,
  }}>{project.glyph}</span>
);

// Status indicator dot — solid dot + glow ring tinted by status.
const CStatusDot = ({ status = 'running', size = 8, style = {} }) => {
  const map = {
    running: { c: 'var(--status-running)', glow: 'var(--status-running-glow)', filled: true },
    'needs-input': { c: 'var(--status-needs-input)', glow: 'var(--status-needs-input-glow)', filled: true, pulse: true },
    idle:    { c: 'var(--status-idle-stroke)', glow: 'transparent', filled: false },
    exited:  { c: 'var(--status-exited)', glow: 'var(--status-exited-glow)', filled: false, x: true },
  };
  const m = map[status];
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%', flex: 'none',
      background: m.filled ? m.c : 'transparent',
      boxShadow: m.filled
        ? `0 0 0 1px rgba(0,0,0,0.35) inset, 0 0 10px ${m.glow}`
        : `inset 0 0 0 1.5px ${m.c}`,
      animation: m.pulse ? 'shell-pulse 1.4s ease-in-out infinite' : 'none',
      position: 'relative',
      ...style,
    }}>
      {m.x && (
        <span style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: m.c, font: '700 10px/1 var(--font-mono)',
        }}>×</span>
      )}
    </span>
  );
};

const CLogo = ({ size = 22 }) => (
  <span style={{
    width: size, height: size, borderRadius: 6, background: '#0a0a0a',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
    flex: 'none',
  }}>
    <svg viewBox="0 0 64 64" width={size - 8} height={size - 8} fill="none">
      <g stroke="#fafafa" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 42 V24 Q14 20 18 20 Q22 20 22 24 V42 M22 28 Q22 24 26 24 Q30 24 30 28 V42" />
        <path d="M48 26 Q44 22 39 22 Q34 22 34 27 Q34 31 39 32 Q44 33 44 38 Q44 43 38 43 Q34 43 32 41" />
      </g>
    </svg>
  </span>
);

const CIconButton = ({ icon, label, active = false, size = 30, iconSize = 16 }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button title={label} aria-label={label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.10)' : (hover ? 'rgba(255,255,255,0.06)' : 'transparent'),
        border: 0, borderRadius: 8, cursor: 'pointer',
        color: (active || hover) ? 'var(--fg1)' : 'var(--fg3)',
        transition: 'background 120ms var(--ease-toggle), color 120ms',
      }}>
      <CIcon d={CI[icon]} size={iconSize} />
    </button>
  );
};

// ─── Top bar ────────────────────────────────────────────────────────────────
const CTopBar = ({ currentView = 'board', sidebarOpen = true, onToggleSidebar }) => {
  const totalNeeds = CD.projects.reduce((n, p) => n + p.needs, 0);
  return (
    <div style={{
      height: 44, flex: 'none', position: 'relative', zIndex: 12,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 14px',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.55)',
    }}>
      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 240 }}>
        <CIconButton icon="sidebar" label="Toggle sidebar (⌘B)" active={!sidebarOpen} />
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 6px' }} />
        <CLogo />
        <span style={{
          font: '600 14px/1 var(--font-sans)', letterSpacing: '-0.01em',
          color: 'var(--fg1)', marginLeft: 8,
        }}>Marrow Symphony</span>
      </div>

      {/* View switch */}
      <div style={{
        display: 'inline-flex', background: 'rgba(0,0,0,0.42)',
        borderRadius: 10, padding: 3,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      }}>
        {['Board', 'Cockpit', 'Feed'].map((v) => {
          const key = v.toLowerCase();
          const active = currentView === key;
          const showAlert = key === 'feed' && totalNeeds > 0 && !active;
          return (
            <button key={key} style={{
              position: 'relative', height: 28, padding: '0 18px',
              background: active ? '#fafafa' : 'transparent',
              color: active ? '#0a0a0a' : 'var(--fg2)',
              border: 0, borderRadius: 8, cursor: 'pointer',
              font: '500 13px/1 var(--font-sans)', letterSpacing: '-0.005em',
              transition: 'background 220ms var(--ease-out-expo), color 220ms',
            }}>
              {v}
              {showAlert && (
                <span style={{ position: 'absolute', top: 5, right: 7 }}>
                  <CAttentionPip size={6} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
        {totalNeeds > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 10px 5px 8px', borderRadius: 999,
            background: 'rgba(0,217,255,0.10)',
            color: 'var(--status-needs-input)',
            font: '500 12px/1 var(--font-sans)', letterSpacing: '-0.005em',
          }}>
            <CAttentionPip size={6} />
            {totalNeeds} need input
          </span>
        )}
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 10px', width: 240, borderRadius: 8,
          background: 'rgba(0,0,0,0.42)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
        }}>
          <CIcon d={CI.search} size={13} stroke="var(--fg4)" />
          <span style={{ flex: 1, color: 'var(--fg4)', font: '400 12px/1 var(--font-sans)' }}>Search</span>
          <CKbd>⌘F</CKbd>
        </label>
        <CIconButton icon="keyboard" label="Keyboard shortcuts (⌘/)" />
        <CIconButton icon="cog" label="Settings" />
      </div>
    </div>
  );
};

// ─── Sidebar ────────────────────────────────────────────────────────────────
const refIconFor = (kind) => ({ pr: 'gitPr', branch: 'gitBranch', folder: 'folder' })[kind] || 'gitBranch';

const ProjectRow = ({ p, selected }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'grid', gridTemplateColumns: 'auto 1fr auto', gridTemplateRows: 'auto auto',
        columnGap: 10, rowGap: 2,
        padding: '7px 10px 8px',
        background: selected ? 'rgba(255,255,255,0.07)' : (hover ? 'rgba(255,255,255,0.035)' : 'transparent'),
        border: 0, borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        color: selected ? 'var(--fg1)' : 'var(--fg2)',
        transition: 'background 120ms var(--ease-toggle)',
      }}>
      {selected && (
        <span style={{
          position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
          borderRadius: 2, background: p.color, boxShadow: `0 0 10px ${p.color}aa`,
        }} />
      )}
      <span style={{ gridColumn: '1', gridRow: '1', alignSelf: 'center' }}>
        <span style={{
          width: 4, height: 4, flex: 'none', background: p.color,
          display: 'inline-block',
          boxShadow: `0 0 0 1px ${p.color}55, 0 0 8px ${p.color}aa`,
        }} />
      </span>
      <span style={{
        gridColumn: '2', gridRow: '1', alignSelf: 'center',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        font: '500 13px/1 var(--font-sans)', letterSpacing: '-0.005em',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {p.name}
        {!p.gitBacked && (
          <span style={{
            font: '500 10px/1 var(--font-sans)', color: 'var(--fg4)',
            padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.04)',
          }}>non-git</span>
        )}
      </span>
      <span style={{
        gridColumn: '3', gridRow: '1', alignSelf: 'center',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {p.needs > 0 && <CAttentionPip size={7} />}
        <span style={{
          font: '500 11px/1 var(--font-mono)',
          color: p.needs > 0 ? 'var(--status-needs-input)' : 'var(--fg3)',
          fontVariantNumeric: 'tabular-nums', minWidth: 12, textAlign: 'right',
        }}>{p.live}</span>
      </span>
      <span style={{
        gridColumn: '2 / span 2', gridRow: '2',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: p.ref.kind === 'pr' ? '#a5b4fc' : 'var(--fg4)',
        font: `400 11px/1 ${p.ref.kind === 'folder' ? 'var(--font-sans)' : 'var(--font-mono)'}`,
        overflow: 'hidden',
      }}>
        <CIcon d={CI[refIconFor(p.ref.kind)]} size={11} stroke="currentColor" strokeWidth={1.6} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.ref.label}
        </span>
      </span>
    </button>
  );
};

const GroupHeader = ({ name, open, onToggle, live, needs, count }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button onClick={onToggle}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        height: 28, padding: '0 8px 0 4px',
        background: hover ? 'rgba(255,255,255,0.035)' : 'transparent',
        border: 0, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        color: 'var(--fg3)', transition: 'background 120ms',
      }}>
      <span style={{
        width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg4)',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 180ms var(--ease-out-expo)',
      }}><CIcon d={CI.chevD} size={12} stroke="currentColor" /></span>
      <span style={{
        flex: 1, font: '600 11px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--fg2)',
      }}>{name}</span>
      <span style={{
        font: '500 10px/1 var(--font-mono)', color: 'var(--fg4)', fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
      {needs > 0 && <CAttentionPip size={6} />}
      <span style={{
        font: '500 11px/1 var(--font-mono)', color: 'var(--fg3)',
        fontVariantNumeric: 'tabular-nums', minWidth: 12, textAlign: 'right',
      }}>{live}</span>
    </button>
  );
};

const CSidebarExpanded = ({ selected }) => {
  const groupOrder = []; const byGroup = {};
  CD.projects.forEach((p) => {
    if (!byGroup[p.group]) { byGroup[p.group] = []; groupOrder.push(p.group); }
    byGroup[p.group].push(p);
  });
  const [openGroups, setOpenGroups] = React.useState(() => {
    const init = {}; groupOrder.forEach((g) => { init[g] = true; }); return init;
  });
  const toggle = (g) => setOpenGroups((o) => ({ ...o, [g]: !o[g] }));

  return (
    <aside style={{
      width: 248, flex: 'none',
      margin: '10px 0 10px 10px',
      display: 'flex', flexDirection: 'column',
      padding: '12px 10px',
      borderRadius: 'var(--r-20)',
      background: 'rgb(20 20 22 / 0.58)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
      position: 'relative', zIndex: 5,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 6px 10px 6px',
      }}>
        <span style={{
          font: '600 11px/1 var(--font-sans)',
          letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase', color: 'var(--fg3)',
        }}>Workspace</span>
        <span style={{ font: '400 11px/1 var(--font-sans)', color: 'var(--fg4)' }}>
          {CD.projects.length} projects
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {groupOrder.map((g) => {
          const projects = byGroup[g];
          const groupLive = projects.reduce((n, p) => n + p.live, 0);
          const groupNeeds = projects.reduce((n, p) => n + p.needs, 0);
          const open = openGroups[g];
          return (
            <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
              <GroupHeader name={g} open={open} onToggle={() => toggle(g)}
                live={groupLive} needs={groupNeeds} count={projects.length} />
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 2, paddingBottom: 4 }}>
                  {projects.map((p) => (
                    <ProjectRow key={p.id} p={p} selected={selected === p.id} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: 2, paddingTop: 10,
        boxShadow: '0 -1px 0 0 rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 8px',
          background: 'transparent', border: 0, borderRadius: 8, cursor: 'pointer',
          textAlign: 'left', color: 'var(--fg3)', font: '500 13px/1 var(--font-sans)',
        }}>
          <CIcon d={CI.plus} size={14} stroke="var(--fg3)" />
          Add Project
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px',
          font: '400 11px/1 var(--font-sans)', color: 'var(--fg4)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--status-running)',
            boxShadow: '0 0 8px var(--status-running-glow)',
          }} />
          {CD.projects.reduce((n, p) => n + p.live, 0)} live · {CD.projects.reduce((n, p) => n + p.needs, 0)} need input
        </div>
      </div>
    </aside>
  );
};

// ─── Frame: shader backdrop + topbar + (sidebar) + main slot ────────────────
const CFrame = ({ currentView, sidebarOpen = true, selected = 'webapp', reduceShader = false, children }) => {
  const [open, setOpen] = React.useState(sidebarOpen);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#050505', overflow: 'hidden',
      fontFamily: 'var(--font-sans)', color: 'var(--fg1)',
    }}>
      {/* Shader backdrop */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Shader reduce={reduceShader} />
      </div>

      <CTopBar currentView={currentView} sidebarOpen={open} onToggleSidebar={() => setOpen(v => !v)} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', zIndex: 2 }}>
        {open && <CSidebarExpanded selected={selected} />}
        {children}
      </div>
    </div>
  );
};

Object.assign(window, {
  CIcon, CKbd, CAttentionPip, CNeedsPill, CProjectChip, CStatusDot, CLogo,
  CIconButton, CTopBar, CSidebarExpanded, CFrame,
});
