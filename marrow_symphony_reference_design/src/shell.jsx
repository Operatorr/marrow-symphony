// Marrow Symphony — App Shell
// A persistent shell: topbar + sidebar (expanded or collapsed rail) + main placeholder.
// Glass chrome on the shader backdrop. No borders. Cmd/Ctrl+B toggles the sidebar.

const D = window.SHELL_DATA;
const SI = window.SHELL_ICONS;

// ─── Atoms ──────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', ...style }}>
    <path d={d} />
  </svg>
);

const Dot = ({ color, size = 8, glow = false, style = {} }) => (
  <span style={{
    width: size, height: size, borderRadius: '50%', flex: 'none',
    background: color,
    boxShadow: glow
      ? `0 0 0 2px ${color}22, 0 0 10px ${color}aa`
      : `0 0 0 1px rgba(0,0,0,0.35) inset`,
    ...style,
  }} />
);

// Saturated, animated cyan attention pip — used as a per-project glance signal.
const AttentionPip = ({ size = 7, style = {} }) => (
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

const Logo = ({ size = 22 }) => (
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

const IconButton = ({ icon, label, onClick, active = false, size = 30, iconSize = 16 }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.10)' : (hover ? 'rgba(255,255,255,0.06)' : 'transparent'),
        border: 0, borderRadius: 8, cursor: 'pointer',
        color: (active || hover) ? 'var(--fg1)' : 'var(--fg3)',
        transition: 'background 120ms var(--ease-toggle), color 120ms',
      }}
    >
      <Icon d={SI[icon]} size={iconSize} />
    </button>
  );
};

// Keyboard hint chip (⌘B)
const Kbd = ({ children }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 18, height: 18, padding: '0 5px',
    borderRadius: 5,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--fg3)',
    font: '500 11px/1 var(--font-mono)',
    boxShadow: 'inset 0 -1px 0 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.05)',
  }}>{children}</span>
);

// ─── Top bar ────────────────────────────────────────────────────────────────
const TopBar = ({ view, onView, onToggleSidebar, sidebarOpen, totalNeeds }) => (
  <div style={{
    height: 'var(--topbar-h)', flex: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 14px',
    background: 'rgb(20 20 22 / 0.55)',
    backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
    boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px -8px rgba(0,0,0,0.55)',
    position: 'relative', zIndex: 12,
  }}>
    {/* Left cluster */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 240 }}>
      <IconButton icon="sidebar" label="Toggle sidebar (⌘B)" onClick={onToggleSidebar} active={!sidebarOpen} />
      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)', margin: '0 6px' }} />
      <Logo />
      <span style={{
        font: '600 14px/1 var(--font-sans)', letterSpacing: '-0.01em',
        color: 'var(--fg1)', marginLeft: 8,
      }}>Marrow Symphony</span>
    </div>

    {/* Center: view switch */}
    <div style={{
      display: 'inline-flex', background: 'rgba(0,0,0,0.42)',
      borderRadius: 10, padding: 3,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
    }}>
      {['Board', 'Cockpit', 'Feed'].map((v) => {
        const key = v.toLowerCase();
        const active = view === key;
        const showAlert = key === 'feed' && totalNeeds > 0 && !active;
        return (
          <button key={key} onClick={() => onView(key)} style={{
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
                <AttentionPip size={6} />
              </span>
            )}
          </button>
        );
      })}
    </div>

    {/* Right cluster — needs status, search, actions */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
      {totalNeeds > 0 && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '5px 10px 5px 8px', borderRadius: 999,
          background: 'rgba(0,217,255,0.10)',
          color: 'var(--status-needs-input)',
          font: '500 12px/1 var(--font-sans)', letterSpacing: '-0.005em',
        }}>
          <AttentionPip size={6} />
          {totalNeeds} need input
        </span>
      )}

      <TopBarSearch />

      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton icon="keyboard" label="Keyboard shortcuts (⌘/)" />
        <IconButton icon="cog" label="Settings" />
        <LinearButton />
      </div>
    </div>
  </div>
);

// ─── Top-bar search ─────────────────────────────────────────────────────────
const TopBarSearch = () => {
  const [focused, setFocused] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  return (
    <label
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 30, padding: '0 10px 0 10px',
        width: 240,
        borderRadius: 8,
        background: 'rgba(0,0,0,0.42)',
        boxShadow: focused
          ? 'inset 0 0 0 1px rgba(0,217,255,0.45), 0 0 0 3px rgba(0,217,255,0.10)'
          : (hover
              ? 'inset 0 0 0 1px rgba(255,255,255,0.08)'
              : 'inset 0 0 0 1px rgba(255,255,255,0.04)'),
        transition: 'box-shadow 120ms var(--ease-toggle)',
      }}
    >
      <Icon d={SI.search} size={13} stroke={focused ? 'var(--fg2)' : 'var(--fg4)'} />
      <input
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Search"
        style={{
          background: 'transparent', border: 0, outline: 0, flex: 1, minWidth: 0,
          color: 'var(--fg1)',
          font: '400 12px/1 var(--font-sans)', letterSpacing: '-0.005em',
        }}
      />
      <Kbd>⌘F</Kbd>
    </label>
  );
};

// Linear connection button — distinct, with brand-mark icon
const LinearButton = () => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Linear — open connection settings"
      aria-label="Linear"
      style={{
        position: 'relative',
        width: 30, height: 30, marginLeft: 2,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'rgba(99,102,241,0.16)' : 'rgba(99,102,241,0.10)',
        border: 0, borderRadius: 8, cursor: 'pointer',
        color: '#a5b4fc',
        transition: 'background 120ms var(--ease-toggle)',
      }}
    >
      <Icon d={SI.linear} size={14} />
      {/* connected status pip */}
      <span style={{
        position: 'absolute', right: 4, bottom: 4,
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--status-running)',
        boxShadow: '0 0 0 1.5px #0a0a0a, 0 0 6px var(--status-running-glow)',
      }} />
    </button>
  );
};

// ─── Sidebar — expanded ─────────────────────────────────────────────────────
const refIconFor = (kind) => ({ pr: 'gitPr', branch: 'gitBranch', folder: 'folder' })[kind] || 'gitBranch';

const ProjectRow = ({ p, selected, onSelect }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={() => onSelect(p.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gridTemplateRows: 'auto auto',
        columnGap: 10, rowGap: 2,
        padding: '7px 10px 8px',
        background: selected ? 'rgba(255,255,255,0.07)' : (hover ? 'rgba(255,255,255,0.035)' : 'transparent'),
        border: 0, borderRadius: 10, cursor: 'pointer', textAlign: 'left',
        color: selected ? 'var(--fg1)' : 'var(--fg2)',
        transition: 'background 120ms var(--ease-toggle)',
      }}
    >
      {/* Selected accent bar */}
      {selected && (
        <span style={{
          position: 'absolute', left: 0, top: 8, bottom: 8, width: 2,
          borderRadius: 2, background: p.color,
          boxShadow: `0 0 10px ${p.color}aa`,
        }} />
      )}

      {/* Row 1: project chip, name, live count */}
      <span style={{ gridColumn: '1', gridRow: '1', alignSelf: 'center', display: 'inline-flex' }}>
        <span style={{
          width: 4, height: 4, borderRadius: 0, flex: 'none',
          background: p.color,
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
            font: '500 10px/1 var(--font-sans)',
            color: 'var(--fg4)',
            padding: '2px 5px',
            borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
          }}>non-git</span>
        )}
      </span>
      <span style={{
        gridColumn: '3', gridRow: '1', alignSelf: 'center',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {p.needs > 0 && <AttentionPip size={7} />}
        <span style={{
          font: '500 11px/1 var(--font-mono)',
          color: p.needs > 0 ? 'var(--status-needs-input)' : 'var(--fg3)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 12, textAlign: 'right',
        }}>{p.live}</span>
      </span>

      {/* Row 2: branch / PR / folder reference */}
      <span style={{
        gridColumn: '2 / span 2', gridRow: '2',
        display: 'inline-flex', alignItems: 'center', gap: 6,
        color: p.ref.kind === 'pr' ? '#a5b4fc' : 'var(--fg4)',
        font: `400 11px/1 ${p.ref.kind === 'folder' ? 'var(--font-sans)' : 'var(--font-mono)'}`,
        overflow: 'hidden',
      }}>
        <Icon d={SI[refIconFor(p.ref.kind)]} size={11} stroke="currentColor" strokeWidth={1.6} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.ref.label}
        </span>
      </span>
    </button>
  );
};

// Group accordion header
const GroupHeader = ({ name, open, onToggle, live, needs, count }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        width: '100%',
        height: 28, padding: '0 8px 0 4px',
        background: hover ? 'rgba(255,255,255,0.035)' : 'transparent',
        border: 0, borderRadius: 8, cursor: 'pointer', textAlign: 'left',
        color: 'var(--fg3)',
        transition: 'background 120ms',
      }}
    >
      <span style={{
        width: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--fg4)',
        transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
        transition: 'transform 180ms var(--ease-out-expo)',
      }}>
        <Icon d={SI.chevD} size={12} stroke="currentColor" />
      </span>
      <span style={{
        flex: 1,
        font: '600 11px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        color: 'var(--fg2)',
      }}>{name}</span>
      <span style={{
        font: '500 10px/1 var(--font-mono)',
        color: 'var(--fg4)', fontVariantNumeric: 'tabular-nums',
      }}>{count}</span>
      {needs > 0 && <AttentionPip size={6} />}
      <span style={{
        font: '500 11px/1 var(--font-mono)',
        color: 'var(--fg3)', fontVariantNumeric: 'tabular-nums',
        minWidth: 12, textAlign: 'right',
      }}>{live}</span>
    </button>
  );
};

const SidebarExpanded = ({ selected, onSelect }) => {
  // Group projects by their group field, preserving first-seen order
  const groupOrder = [];
  const byGroup = {};
  D.projects.forEach((p) => {
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
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 6px 10px 6px',
      }}>
        <span style={{
          font: '600 11px/1 var(--font-sans)',
          letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
          color: 'var(--fg3)',
        }}>Workspace</span>
        <span style={{
          font: '400 11px/1 var(--font-sans)',
          color: 'var(--fg4)',
        }}>{D.projects.length} projects</span>
      </div>

      {/* Group accordions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflow: 'auto', minHeight: 0 }}>
        {groupOrder.map((g) => {
          const projects = byGroup[g];
          const groupLive = projects.reduce((n, p) => n + p.live, 0);
          const groupNeeds = projects.reduce((n, p) => n + p.needs, 0);
          const open = openGroups[g];
          return (
            <div key={g} style={{ display: 'flex', flexDirection: 'column' }}>
              <GroupHeader
                name={g} open={open} onToggle={() => toggle(g)}
                live={groupLive} needs={groupNeeds} count={projects.length}
              />
              {open && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingTop: 2, paddingBottom: 4 }}>
                  {projects.map((p) => (
                    <ProjectRow key={p.id} p={p} selected={selected === p.id} onSelect={onSelect} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: 2, paddingTop: 10,
        boxShadow: '0 -1px 0 0 rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 8px',
          background: 'transparent', border: 0, borderRadius: 8, cursor: 'pointer',
          textAlign: 'left',
          color: 'var(--fg3)', font: '500 13px/1 var(--font-sans)',
        }}>
          <Icon d={SI.plus} size={14} stroke="var(--fg3)" />
          Add Project
        </button>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 8px',
          font: '400 11px/1 var(--font-sans)', color: 'var(--fg4)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--status-running)',
            boxShadow: '0 0 8px var(--status-running-glow)',
          }} />
          {D.projects.reduce((n, p) => n + p.live, 0)} live · {D.projects.reduce((n, p) => n + p.needs, 0)} need input
        </div>
      </div>
    </aside>
  );
};

// ─── Sidebar — collapsed rail ───────────────────────────────────────────────
const RailButton = ({ p, selected, onSelect }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={() => onSelect(p.id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={`${p.name} · ${p.live} live${p.needs ? ` · ${p.needs} need input` : ''}`}
      style={{
        position: 'relative',
        width: 36, height: 36, borderRadius: 10,
        background: selected ? 'rgba(255,255,255,0.09)' : (hover ? 'rgba(255,255,255,0.045)' : 'transparent'),
        border: 0, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms var(--ease-toggle)',
      }}
    >
      {/* Selected indicator: left bar */}
      {selected && (
        <span style={{
          position: 'absolute', left: -8, top: 8, bottom: 8, width: 3,
          borderRadius: 2, background: p.color,
          boxShadow: `0 0 10px ${p.color}aa`,
        }} />
      )}
      <span style={{
        width: 22, height: 22, borderRadius: 7,
        background: 'rgba(0,0,0,0.35)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `inset 0 0 0 1px ${p.color}55`,
        color: p.color,
        font: '600 12px/1 var(--font-mono)',
        textTransform: 'uppercase',
        letterSpacing: '-0.02em',
      }}>{p.glyph}</span>

      {/* Live count badge */}
      <span style={{
        position: 'absolute', right: -2, bottom: -2,
        minWidth: 16, height: 16, padding: '0 4px',
        borderRadius: 999,
        background: '#0a0a0a',
        color: 'var(--fg2)',
        font: '600 10px/16px var(--font-mono)',
        textAlign: 'center', fontVariantNumeric: 'tabular-nums',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), 0 1px 2px rgba(0,0,0,0.4)',
      }}>{p.live}</span>

      {/* Attention pip */}
      {p.needs > 0 && (
        <span style={{
          position: 'absolute', right: -3, top: -3,
          width: 9, height: 9, borderRadius: '50%',
          background: 'var(--status-needs-input)',
          boxShadow: '0 0 0 2px #0a0a0a, 0 0 10px rgba(0,217,255,0.85)',
          animation: 'shell-pulse 1.4s ease-in-out infinite',
        }} />
      )}
    </button>
  );
};

const SidebarCollapsed = ({ selected, onSelect }) => (
  <aside style={{
    width: 56, flex: 'none',
    margin: '10px 0 10px 10px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    padding: '12px 0',
    borderRadius: 'var(--r-20)',
    background: 'rgb(20 20 22 / 0.58)',
    backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
    boxShadow: 'var(--shadow-glass)',
    position: 'relative', zIndex: 5,
  }}>
    {/* Project glyphs grouped by group */}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', flex: 1, paddingTop: 2 }}>
      {(() => {
        const groupOrder = [];
        const byGroup = {};
        D.projects.forEach((p) => {
          if (!byGroup[p.group]) { byGroup[p.group] = []; groupOrder.push(p.group); }
          byGroup[p.group].push(p);
        });
        return groupOrder.map((g, gi) => (
          <React.Fragment key={g}>
            {gi > 0 && (
              <div style={{ height: 1, alignSelf: 'stretch', margin: '0 14px', background: 'rgba(255,255,255,0.06)' }} />
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }} title={g}>
              {byGroup[g].map((p) => (
                <RailButton key={p.id} p={p} selected={selected === p.id} onSelect={onSelect} />
              ))}
            </div>
          </React.Fragment>
        ));
      })()}
      <button title="Add Project" style={{
        width: 36, height: 36, borderRadius: 10,
        background: 'transparent', border: '1px dashed rgba(255,255,255,0.10)',
        cursor: 'pointer', color: 'var(--fg4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginTop: 4,
      }}>
        <Icon d={SI.plus} size={14} stroke="var(--fg4)" />
      </button>
    </div>

    {/* Footer: live count pip */}
    <div title={`${D.projects.reduce((n, p) => n + p.live, 0)} live`} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
      paddingBottom: 2,
      font: '500 10px/1 var(--font-mono)', color: 'var(--fg3)',
      fontVariantNumeric: 'tabular-nums',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: 'var(--status-running)',
        boxShadow: '0 0 8px var(--status-running-glow)',
      }} />
      {D.projects.reduce((n, p) => n + p.live, 0)}
    </div>
  </aside>
);

// ─── Empty placeholder — the main view area ────────────────────────────────
const MainPlaceholder = ({ view }) => (
  <main style={{
    flex: 1, margin: 10,
    borderRadius: 'var(--r-20)',
    overflow: 'hidden',
    background: 'rgb(10 10 12 / 0.40)',
    backdropFilter: 'blur(20px) saturate(120%)',
    WebkitBackdropFilter: 'blur(20px) saturate(120%)',
    boxShadow: 'var(--shadow-glass)',
    position: 'relative', zIndex: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  }}>
    {/* Subtle dot grid */}
    <div style={{
      position: 'absolute', inset: 0,
      backgroundImage: 'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)',
      backgroundSize: '24px 24px',
      maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 80%)',
      pointerEvents: 'none',
    }} />
    <div style={{
      textAlign: 'center', position: 'relative',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        font: '500 10px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        color: 'var(--fg4)',
      }}>Main view · placeholder</span>
      <span style={{
        font: '600 28px/1 var(--font-sans)', letterSpacing: '-0.02em',
        color: 'var(--fg2)', textTransform: 'capitalize',
      }}>{view}</span>
      <span style={{
        font: '400 12px/1.5 var(--font-sans)', color: 'var(--fg4)',
        maxWidth: 320,
      }}>The shell holds. Swap this region for Board, Cockpit, or Feed.</span>
    </div>
  </main>
);

// ─── App Shell ──────────────────────────────────────────────────────────────
const AppShell = ({ initialOpen = true, initialView = 'board' }) => {
  const [open, setOpen] = React.useState(initialOpen);
  const [view, setView] = React.useState(initialView);
  const [selected, setSelected] = React.useState('webapp');
  const totalNeeds = D.projects.reduce((n, p) => n + p.needs, 0);

  // ⌘B / Ctrl+B toggle
  React.useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      background: '#050505',
      overflow: 'hidden',
      fontFamily: 'var(--font-sans)',
      color: 'var(--fg1)',
    }}>
      {/* Shader backdrop (sits behind everything) */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <Shader reduce={false} />
      </div>

      <TopBar
        view={view}
        onView={setView}
        sidebarOpen={open}
        onToggleSidebar={() => setOpen((v) => !v)}
        totalNeeds={totalNeeds}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative', zIndex: 2 }}>
        {open && <SidebarExpanded selected={selected} onSelect={setSelected} />}
        <MainPlaceholder view={view} />
      </div>
    </div>
  );
};

Object.assign(window, { AppShell, TopBar, SidebarExpanded, SidebarCollapsed, MainPlaceholder });
