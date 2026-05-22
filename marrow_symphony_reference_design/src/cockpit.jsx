// Marrow Symphony — Cockpit view
// The fleet at a glance: every live Session as a terminal tile, grouped
// under Project headers. Needs-Input tiles glow and sort to the front of
// their group. Glass chrome on the topbar/sidebar/group headers; solid
// dark on the terminal bodies so 20 of them on screen stay cheap.

const CK = window.MS_DATA;
const CKICONS = window.SHELL_ICONS;

// Statuses in the order they should sort within a Project group.
const CK_STATUS_RANK = { 'needs-input': 0, running: 1, idle: 2, exited: 3 };

const CkActionIcon = ({ d, size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
    <path d={d} />
  </svg>
);

const CK_ICONS = {
  square:   'M5 5h14v14H5z',
  play:     'M6 4l14 8-14 8z',
  external: 'M15 3h6v6M10 14 21 3M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5',
  more:     'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM19 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM5 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  bolt:     'M13 2 3 14h9l-1 8 10-12h-9l1-8z',
  feed:     'M4 4h2a14 14 0 0 1 14 14v2M4 11a9 9 0 0 1 9 9M4 18h.01',
};

const CkTileAction = ({ d, label }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button title={label} aria-label={label}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 22, height: 22, borderRadius: 6, border: 0,
        background: hover ? 'rgba(255,255,255,0.07)' : 'transparent',
        color: hover ? 'var(--fg1)' : 'var(--fg3)',
        cursor: 'pointer', display: 'inline-flex',
        alignItems: 'center', justifyContent: 'center',
        transition: 'background 120ms var(--ease-toggle), color 120ms',
      }}>
      <CkActionIcon d={d} />
    </button>
  );
};

// Cropped terminal — last 6-7 lines of agent output. Solid background; no
// shader peeks through. Needs-Input tiles end with an animated prompt caret.
const CkTerminal = ({ session, project }) => {
  const styles = {
    sys:    { color: 'var(--fg4)', fontWeight: 400 },
    agent:  { color: 'var(--fg2)', fontWeight: 400 },
    prompt: { color: 'var(--fg1)', fontWeight: 500 },
  };
  return (
    <div style={{
      flex: 1, minHeight: 0, overflow: 'hidden',
      padding: '10px 12px 8px',
      background: '#0a0a0a',
      font: '400 12px/18px var(--font-mono)',
      fontFeatureSettings: '"ss01" on',
      fontVariantNumeric: 'tabular-nums slashed-zero',
      position: 'relative',
    }}>
      {/* Fade out the top so cropped scrollback feels intentional */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: 0, height: 16,
        background: 'linear-gradient(to bottom, #0a0a0a, rgba(10,10,10,0))',
        pointerEvents: 'none', zIndex: 2,
      }} />
      {session.preview.map((line, i) => {
        if (line.kind === 'prompt') {
          return (
            <div key={i} style={{
              ...styles.prompt, whiteSpace: 'nowrap',
              overflow: 'hidden', textOverflow: 'ellipsis',
              paddingTop: 2,
            }}>
              <span style={{ color: 'var(--status-needs-input)' }}>{'> '}</span>
              {line.text}
              <span className="ck-caret" />
            </div>
          );
        }
        return (
          <div key={i} style={{
            ...styles[line.kind], whiteSpace: 'nowrap',
            overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{line.text || '\u00A0'}</div>
        );
      })}
    </div>
  );
};

// ─── Tile ───────────────────────────────────────────────────────────────────
const CkTile = ({ session, issue, project }) => {
  const needs = session.status === 'needs-input';
  const exited = session.status === 'exited';
  const [hover, setHover] = React.useState(false);

  // Status label string for the header status pip
  const statusLabel = {
    'needs-input': 'Needs input',
    running: 'Running',
    idle: 'Idle',
    exited: 'Exited',
  }[session.status];

  // Outer wrapper — needs-input variant gets a rainbow gradient border using
  // padding-box / border-box masking (same trick the Feed NeedsPill uses).
  const wrap = needs ? {
    padding: 1.5,
    borderRadius: 14,
    background: 'linear-gradient(135deg,#da8c6b,#d930b1,#8844d8,#4e52f4,#87f3ff)',
    boxShadow: '0 0 0 1px rgba(217,48,177,0.20), 0 8px 32px -8px rgba(78,82,244,0.35), 0 8px 28px -10px rgba(217,48,177,0.40)',
    transition: 'box-shadow 220ms var(--ease-out-expo)',
  } : {
    padding: 0,
    borderRadius: 12,
    background: 'transparent',
    boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
    transition: 'box-shadow 220ms var(--ease-out-expo)',
  };

  return (
    <div style={wrap}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{
        display: 'flex', flexDirection: 'column',
        background: '#0e0e10',
        borderRadius: needs ? 12.5 : 12,
        overflow: 'hidden',
        height: 196,
        opacity: exited ? 0.62 : 1,
        cursor: 'pointer',
      }}>
        {/* Header */}
        <div style={{
          flex: 'none',
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 10px 8px 12px',
          background: 'rgba(255,255,255,0.02)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Status pip */}
          <CStatusDot status={session.status} size={8} />

          {/* Issue key */}
          <span style={{
            font: '500 11px/1 var(--font-mono)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums', flex: 'none',
          }}>{issue.id}</span>

          {/* Title — single-line ellipsis */}
          <span style={{
            font: '500 12px/1 var(--font-sans)', color: 'var(--fg1)',
            letterSpacing: '-0.005em',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
          }}>{issue.title}</span>

          {/* Runner pill */}
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            height: 18, padding: '0 6px', borderRadius: 5,
            background: 'rgba(255,255,255,0.05)',
            color: 'var(--fg2)',
            font: '500 10px/1 var(--font-mono)',
            flex: 'none',
          }}>{session.runner}</span>
        </div>

        {/* Terminal */}
        <CkTerminal session={session} project={project} />

        {/* Footer */}
        <div style={{
          flex: 'none', height: 28,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 8px 0 12px',
          background: '#0a0a0a',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}>
          {/* Status / wait time — when the rainbow border already says
              "Needs input", drop the redundant label and just show how long
              the agent has been waiting. */}
          <span style={{
            font: '500 11px/1 var(--font-sans)',
            color: session.status === 'running' ? 'var(--fg2)' : 'var(--fg4)',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {needs ? (
              <>
                <span style={{ color: 'var(--fg4)' }}>Waiting</span>
                <span style={{
                  color: 'var(--fg2)', font: '500 11px/1 var(--font-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}>{MS_FMT(session.waitingMs)}</span>
              </>
            ) : statusLabel}
          </span>

          <span style={{ flex: 1 }} />

          {/* Diff hint */}
          {session.diff.files > 0 && (
            <span style={{
              font: '500 10px/1 var(--font-mono)', color: 'var(--fg4)',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }}>
              <span style={{ color: '#79fa87' }}>+{session.diff.added}</span>
              <span style={{ margin: '0 4px' }} />
              <span style={{ color: '#fda4af' }}>−{session.diff.removed}</span>
            </span>
          )}

          {/* Actions */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 1,
            opacity: hover || needs ? 1 : 0.6,
            transition: 'opacity 120ms',
            marginLeft: 2,
          }}>
            {needs
              ? <CkTileAction d={CK_ICONS.feed}     label="Open in Feed" />
              : <CkTileAction d={CK_ICONS.external} label="Open Issue" />
            }
            {session.status === 'exited'
              ? <CkTileAction d={CK_ICONS.play}   label="Restart" />
              : <CkTileAction d={CK_ICONS.square} label="Stop" />
            }
            <CkTileAction d={CK_ICONS.more} label="More" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Group header ───────────────────────────────────────────────────────────
const CkGroupHeader = ({ project, sessions, collapsed, onToggle }) => {
  const live = sessions.length;
  const needs = sessions.filter((s) => s.status === 'needs-input').length;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 10px 6px 8px',
      borderRadius: 'var(--r-12)',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
    }}>
      {/* Collapse chevron */}
      <button onClick={onToggle} style={{
        width: 24, height: 24, padding: 0, border: 0, borderRadius: 6,
        background: 'transparent', cursor: 'pointer', color: 'var(--fg3)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
        transition: 'transform 180ms var(--ease-out-expo)',
      }}>
        <CIcon d={CKICONS.chevD} size={13} />
      </button>

      {/* Project color square + name */}
      <span style={{
        width: 8, height: 8, borderRadius: 2,
        background: project.color,
        boxShadow: `0 0 8px ${project.color}aa`,
        flex: 'none',
      }} />
      <span style={{
        font: '600 14px/1 var(--font-sans)', color: 'var(--fg1)',
        letterSpacing: '-0.01em',
      }}>{project.name}</span>

      {/* Counts */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)',
      }}>
        <span style={{
          width: 5, height: 5, borderRadius: '50%',
          background: 'var(--status-running)',
          boxShadow: '0 0 6px var(--status-running-glow)',
        }} />
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--fg2)' }}>{live}</span>
        live
      </span>

      {needs > 0 && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '3px 8px 3px 6px', borderRadius: 999,
          background: 'rgba(0,217,255,0.10)',
          color: 'var(--status-needs-input)',
          font: '500 12px/1 var(--font-sans)',
        }}>
          <CAttentionPip size={6} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{needs}</span> need input
        </span>
      )}

      <span style={{ flex: 1 }} />

      {/* Group actions */}
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 24, padding: '0 10px',
        background: 'transparent', border: 0, borderRadius: 7,
        color: 'var(--fg3)', cursor: 'pointer',
        font: '500 12px/1 var(--font-sans)',
      }}>
        <CIcon d={CKICONS.plus} size={13} stroke="var(--fg3)" />
        New Session
      </button>
      <button style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        height: 24, padding: '0 10px',
        background: 'transparent', border: 0, borderRadius: 7,
        color: 'var(--fg3)', cursor: 'pointer',
        font: '500 12px/1 var(--font-sans)',
      }}>Open Board →</button>
    </div>
  );
};

// ─── Cockpit body ───────────────────────────────────────────────────────────
const CockpitBody = ({ scope = 'all' }) => {
  // Pull sessions + map to their issues + project, then group by project.
  const sessionsByProject = React.useMemo(() => {
    const m = {};
    Object.entries(CK.sessions).forEach(([sid, s]) => {
      const issue = CK.issues.find((i) => i.id === s.issueId);
      if (!issue) return;
      (m[issue.project] ||= []).push({ session: { ...s, id: sid }, issue });
    });
    // Sort within each group: needs-input first, then running, idle, exited.
    Object.values(m).forEach((arr) =>
      arr.sort((a, b) =>
        (CK_STATUS_RANK[a.session.status] - CK_STATUS_RANK[b.session.status])
        || (a.issue.id.localeCompare(b.issue.id))
      )
    );
    return m;
  }, []);

  // Project display order: webapp, api, docs, infra
  const projectOrder = ['webapp', 'api', 'docs', 'infra'];
  const groups = projectOrder
    .filter((id) => scope === 'all' || id === scope)
    .map((id) => ({ project: CK.projects[id], sessions: sessionsByProject[id] || [] }))
    .filter((g) => g.sessions.length);

  const [collapsed, setCollapsed] = React.useState({});
  const toggle = (id) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const totalLive = Object.values(CK.sessions).length;
  const totalNeeds = Object.values(CK.sessions).filter((s) => s.status === 'needs-input').length;

  return (
    <main style={{
      flex: 1, margin: '10px 10px 10px 10px',
      borderRadius: 'var(--r-20)',
      overflow: 'hidden',
      background: 'rgb(8 8 10 / 0.55)',
      backdropFilter: 'blur(20px) saturate(120%)',
      WebkitBackdropFilter: 'blur(20px) saturate(120%)',
      boxShadow: 'var(--shadow-glass)',
      position: 'relative', zIndex: 4,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* View header */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 22px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{
            margin: 0, font: '600 22px/1.1 var(--font-sans)',
            letterSpacing: '-0.015em', color: 'var(--fg1)',
          }}>Cockpit</h2>
          <span style={{
            font: '400 13px/1 var(--font-sans)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums',
          }}>{totalLive} live · {totalNeeds} need input</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* + New Session — surfaced in the view header when filtered to one
              Project (the group header is hidden in that case). */}
          {scope !== 'all' && (
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              height: 30, padding: '0 12px',
              background: 'rgba(255,255,255,0.04)', color: 'var(--fg2)',
              border: 0, borderRadius: 8, cursor: 'pointer',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
              font: '500 12px/1 var(--font-sans)',
            }}>
              <CIcon d={CKICONS.plus} size={13} stroke="currentColor" />
              New Session
            </button>
          )}

          {/* Scope toggle */}
          <div style={{
            display: 'inline-flex', background: 'rgba(0,0,0,0.42)',
            borderRadius: 8, padding: 2,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            {['All Projects', 'webapp'].map((v, i) => (
              <button key={v} style={{
                height: 24, padding: '0 10px',
                background: i === 0 ? '#fafafa' : 'transparent',
                color: i === 0 ? '#0a0a0a' : 'var(--fg3)',
                border: 0, borderRadius: 6, cursor: 'pointer',
                font: '500 12px/1 var(--font-sans)',
              }}>{v}</button>
            ))}
          </div>

          {/* Filter pills */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '0 4px', height: 28, borderRadius: 8,
            background: 'rgba(0,0,0,0.42)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            <span style={{
              font: '500 11px/1 var(--font-sans)', color: 'var(--fg4)',
              padding: '0 6px',
            }}>Show</span>
            {[
              { label: 'Needs input', active: true, color: 'var(--status-needs-input)' },
              { label: 'Running',     active: true, color: 'var(--status-running)' },
              { label: 'Idle',        active: true, color: 'var(--status-idle-stroke)' },
              { label: 'Exited',      active: false, color: 'var(--status-exited)' },
            ].map((f) => (
              <button key={f.label} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 20, padding: '0 7px', borderRadius: 5,
                border: 0, cursor: 'pointer',
                background: f.active ? 'rgba(255,255,255,0.06)' : 'transparent',
                color: f.active ? 'var(--fg2)' : 'var(--fg4)',
                font: '500 11px/1 var(--font-sans)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: f.color,
                  opacity: f.active ? 1 : 0.5,
                }} />
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Groups */}
      <div style={{
        flex: 1, overflow: 'auto',
        padding: '0 14px 14px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {groups.map(({ project, sessions }) => (
          <section key={project.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scope === 'all' && (
              <CkGroupHeader project={project} sessions={sessions}
                collapsed={!!collapsed[project.id]} onToggle={() => toggle(project.id)} />
            )}
            {(scope !== 'all' || !collapsed[project.id]) && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 10,
              }}>
                {sessions.map(({ session, issue }) => (
                  <CkTile key={session.id} session={session} issue={issue} project={project} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
};

// ─── Mount point ────────────────────────────────────────────────────────────
const CockpitView = ({ sidebarOpen = true, selected = 'webapp', scope = 'all' }) => (
  <CFrame currentView="cockpit" sidebarOpen={sidebarOpen} selected={selected}>
    <CockpitBody scope={scope} />
  </CFrame>
);

window.CockpitView = CockpitView;
