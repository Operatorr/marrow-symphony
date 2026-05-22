// Marrow Symphony — Board view (global scope)
// Kanban columns = State Types. In All Projects scope, cards are pooled from
// every Project and color-coded by their Project (only color in the UI). In
// This Project scope, columns become that Project's custom labels (mocked
// for webapp here).
//
// Card density: Linear-style — tight, low-chrome, but readable. Cards with
// live Sessions show a Status pill; Needs-Input cards get a rainbow outline.

const BD = window.MS_DATA;
const BICONS = window.SHELL_ICONS;

const BIcon = ({ d, size = 14, stroke = 'currentColor', strokeWidth = 1.5, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
    style={{ flex: 'none', ...style }}>
    <path d={d} />
  </svg>
);

const B_ICONS = {
  filter:    'M22 3H2l8 9.5V19l4 2v-8.5z',
  sort:      'M3 6h18M6 12h12M10 18h4',
  pr:        'M6 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 18a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v6M18 12V6h-6',
  msg:       'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
  lifecycle: 'M3 12a9 9 0 1 0 9-9M3 4v5h5',
};

// Column accent for State Types — the column-header dot color.
const COL_ACCENT = {
  backlog:    'var(--fg4)',
  todo:       'var(--fg3)',
  started:    'var(--status-needs-input)',
  'in-review':'#a5b4fc',
  done:       'var(--status-running)',
};

// ─── Issue card ─────────────────────────────────────────────────────────────
const BIssueCard = ({ issue }) => {
  const project = BD.projects[issue.project];
  const session = issue.sessionId ? BD.sessions[issue.sessionId] : null;
  const needs = session && session.status === 'needs-input';
  const [hover, setHover] = React.useState(false);

  const wrap = needs ? {
    padding: 1.5,
    borderRadius: 11.5,
    background: 'linear-gradient(135deg,#da8c6b,#d930b1,#8844d8,#4e52f4,#87f3ff)',
    boxShadow:
      '0 4px 16px -6px rgba(217,48,177,0.30), ' +
      '0 4px 16px -6px rgba(78,82,244,0.20)',
    transition: 'box-shadow 220ms var(--ease-out-expo)',
  } : {
    padding: 0,
    borderRadius: 10,
    boxShadow: hover
      ? '0 1px 2px rgba(0,0,0,0.45), 0 8px 24px -10px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)'
      : '0 1px 2px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.04)',
    transition: 'box-shadow 220ms var(--ease-out-expo)',
  };

  return (
    <div style={wrap}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div style={{
        position: 'relative',
        padding: '10px 12px 10px 14px',
        background: '#131316',
        borderRadius: needs ? 10 : 10,
        overflow: 'hidden',
        cursor: 'pointer',
      }}>
        {/* Project color stripe */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: project.color,
          boxShadow: `0 0 14px -2px ${project.color}aa`,
        }} />

        {/* Row 1: project + issue key */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 6,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            font: '500 11px/1 var(--font-sans)',
            color: project.color,
            letterSpacing: '-0.005em',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: 1.5,
              background: project.color,
              boxShadow: `0 0 6px ${project.color}aa`,
            }} />
            {project.name}
          </span>
          <span style={{ flex: 1 }} />
          <span style={{
            font: '500 11px/1 var(--font-mono)',
            color: 'var(--fg4)',
            fontVariantNumeric: 'tabular-nums',
          }}>{issue.id}</span>
        </div>

        {/* Title */}
        <div style={{
          font: '500 13px/18px var(--font-sans)',
          letterSpacing: '-0.005em',
          color: 'var(--fg1)',
          marginBottom: 10,
          textWrap: 'pretty',
        }}>{issue.title}</div>

        {/* Row 3: runner + status / diff */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          minHeight: 18,
        }}>
          {issue.runner && (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              height: 18, padding: '0 6px', borderRadius: 5,
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--fg3)',
              font: '500 10px/1 var(--font-mono)',
            }}>{issue.runner}</span>
          )}

          {session && session.diff.files > 0 && (
            <span style={{
              font: '500 10px/1 var(--font-mono)',
              fontVariantNumeric: 'tabular-nums',
            }}>
              <span style={{ color: '#79fa87' }}>+{session.diff.added}</span>
              <span style={{ margin: '0 3px' }} />
              <span style={{ color: '#fda4af' }}>−{session.diff.removed}</span>
            </span>
          )}

          <span style={{ flex: 1 }} />

          {/* Status pill / state badge */}
          {session ? (
            session.status === 'needs-input' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 18, padding: '0 7px', borderRadius: 5,
                background: 'rgba(0,217,255,0.10)',
                color: 'var(--status-needs-input)',
                font: '500 10px/1 var(--font-sans)',
              }}>
                <span className="ch-attn-dot" style={{ width: 5, height: 5 }} />
                Needs input
              </span>
            ) : session.status === 'running' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 18, padding: '0 7px', borderRadius: 5,
                background: 'rgba(121,250,135,0.10)',
                color: 'var(--status-running)',
                font: '500 10px/1 var(--font-sans)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--status-running)',
                  boxShadow: '0 0 6px var(--status-running-glow)',
                }} />
                Running
              </span>
            ) : session.status === 'idle' ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 18, padding: '0 7px', borderRadius: 5,
                background: 'rgba(139,92,246,0.10)',
                color: 'var(--status-idle-stroke)',
                font: '500 10px/1 var(--font-sans)',
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  border: '1.5px solid var(--status-idle-stroke)',
                  background: 'transparent',
                }} />
                Idle
              </span>
            ) : (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                height: 18, padding: '0 7px', borderRadius: 5,
                background: 'rgba(239,68,68,0.10)',
                color: 'var(--status-exited)',
                font: '500 10px/1 var(--font-sans)',
              }}>Exited</span>
            )
          ) : (
            issue.state === 'done' ? null : null
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Column ─────────────────────────────────────────────────────────────────
const BColumn = ({ column, issues }) => {
  const accent = COL_ACCENT[column.stateType];
  const isStarted = column.stateType === 'started';
  const needsCount = issues.filter((i) =>
    i.sessionId && BD.sessions[i.sessionId]?.status === 'needs-input'
  ).length;

  return (
    <div style={{
      flex: 1, minWidth: 0,
      display: 'flex', flexDirection: 'column',
      background: '#0a0a0a',
      minHeight: 0,
    }}>
      {/* Column header */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '14px 14px 10px',
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: 2,
          background: accent,
          boxShadow: isStarted ? `0 0 8px ${accent}` : 'none',
        }} />
        <span style={{
          font: '600 11px/1 var(--font-sans)',
          color: 'var(--fg2)',
          letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        }}>{column.label}</span>
        <span style={{
          font: '500 11px/1 var(--font-mono)',
          color: 'var(--fg4)', fontVariantNumeric: 'tabular-nums',
        }}>{issues.length}</span>

        {needsCount > 0 && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            height: 16, padding: '0 6px', borderRadius: 4,
            background: 'rgba(0,217,255,0.10)',
            color: 'var(--status-needs-input)',
            font: '500 10px/1 var(--font-sans)',
          }}>
            <CAttentionPip size={5} />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{needsCount}</span>
          </span>
        )}

        <span style={{ flex: 1 }} />

        <button title="Add Issue" style={{
          width: 22, height: 22, padding: 0, border: 0, borderRadius: 5,
          background: 'transparent', color: 'var(--fg4)', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BIcon d={BICONS.plus} size={13} stroke="currentColor" />
        </button>
      </div>

      {/* Cards */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '0 10px 12px',
      }}>
        {issues.map((i) => <BIssueCard key={i.id} issue={i} />)}
        {issues.length === 0 && (
          <div style={{
            padding: '14px 10px', textAlign: 'center',
            font: '400 12px/1.4 var(--font-sans)', color: 'var(--fg4)',
          }}>—</div>
        )}
      </div>

      {/* Started column gets a lifecycle hint */}
      {isStarted && (
        <div style={{
          flex: 'none',
          padding: '8px 12px 12px',
          font: '400 11px/14px var(--font-sans)',
          color: 'var(--fg4)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <BIcon d={B_ICONS.lifecycle} size={11} stroke="var(--fg4)" />
          <span>Drop here → prep Workspace + launch Runner</span>
        </div>
      )}
    </div>
  );
};

// ─── Board body ─────────────────────────────────────────────────────────────
const BoardBody = ({ scope = 'global', selected = 'webapp' }) => {
  const project = scope === 'project' ? BD.projects[selected] : null;
  // For This Project scope, mock webapp's custom column labels (preserves the
  // backing State Type — that's how the lifecycle still works).
  const columns = scope === 'project' && selected === 'webapp' ? [
    { id: 'backlog',   label: 'Triage',      stateType: 'backlog'   },
    { id: 'todo',      label: 'Up Next',     stateType: 'todo'      },
    { id: 'started',   label: 'Doing',       stateType: 'started'   },
    { id: 'in-review', label: 'Code Review', stateType: 'in-review' },
    { id: 'done',      label: 'Shipped',     stateType: 'done'      },
  ] : BD.columns;

  const issues = scope === 'project'
    ? BD.issues.filter((i) => i.project === selected)
    : BD.issues;

  // Within a column, sort: needs-input first → started/running → others by id
  const issuesByCol = React.useMemo(() => {
    const m = {};
    columns.forEach((c) => { m[c.id] = []; });
    issues.forEach((i) => {
      if (m[i.state]) m[i.state].push(i);
    });
    Object.values(m).forEach((arr) => {
      arr.sort((a, b) => {
        const sa = a.sessionId ? BD.sessions[a.sessionId]?.status : null;
        const sb = b.sessionId ? BD.sessions[b.sessionId]?.status : null;
        const ra = sa === 'needs-input' ? 0 : 1;
        const rb = sb === 'needs-input' ? 0 : 1;
        return ra - rb || a.id.localeCompare(b.id);
      });
    });
    return m;
  }, [scope, selected]);

  const totalNeeds = Object.values(BD.sessions).filter((s) => s.status === 'needs-input').length;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Title */}
          {project ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CProjectChip project={project} size={26} fs={13} />
              <h2 style={{
                margin: 0, font: '600 22px/1.1 var(--font-sans)',
                letterSpacing: '-0.015em', color: 'var(--fg1)',
              }}>{project.name}</h2>
            </div>
          ) : (
            <h2 style={{
              margin: 0, font: '600 22px/1.1 var(--font-sans)',
              letterSpacing: '-0.015em', color: 'var(--fg1)',
            }}>All Projects</h2>
          )}
          <span style={{
            font: '400 13px/1 var(--font-sans)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {issues.length} issues
            {totalNeeds > 0 && scope === 'global' &&
              <span style={{ marginLeft: 8, color: 'var(--status-needs-input)' }}>
                · {totalNeeds} need input
              </span>}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Scope toggle — the key control */}
          <div style={{
            display: 'inline-flex', background: 'rgba(0,0,0,0.42)',
            borderRadius: 8, padding: 3,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            {[
              { v: 'project', label: 'This Project' },
              { v: 'global',  label: 'All Projects' },
            ].map((opt) => {
              const active = scope === opt.v;
              return (
                <button key={opt.v} style={{
                  height: 26, padding: '0 12px',
                  background: active ? '#fafafa' : 'transparent',
                  color: active ? '#0a0a0a' : 'var(--fg2)',
                  border: 0, borderRadius: 6, cursor: 'pointer',
                  font: '500 12px/1 var(--font-sans)',
                }}>{opt.label}</button>
              );
            })}
          </div>

          {/* Filter / sort / add */}
          <button title="Filter" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 10px',
            background: 'rgba(0,0,0,0.42)',
            color: 'var(--fg3)', cursor: 'pointer',
            border: 0, borderRadius: 8,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
            font: '500 12px/1 var(--font-sans)',
          }}>
            <BIcon d={B_ICONS.filter} size={12} stroke="currentColor" />
            Filter
          </button>
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 12px',
            background: '#fafafa', color: '#0a0a0a', cursor: 'pointer',
            border: 0, borderRadius: 8,
            font: '600 12px/1 var(--font-sans)',
          }}>
            <BIcon d={BICONS.plus} size={13} stroke="currentColor" strokeWidth={1.8} />
            Add Issue
          </button>
        </div>
      </div>

      {/* Kanban grid — 5 columns separated by hairlines */}
      <div style={{
        flex: 1, minHeight: 0,
        margin: '0 12px 12px',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,0.45)',
        background: 'rgba(255,255,255,0.06)', // becomes the hairline between columns via gap
        display: 'grid',
        gridTemplateColumns: `repeat(${columns.length}, minmax(0,1fr))`,
        gap: 1,
      }}>
        {columns.map((c) => (
          <BColumn key={c.id} column={c} issues={issuesByCol[c.id] || []} />
        ))}
      </div>
    </main>
  );
};

// ─── Mount ──────────────────────────────────────────────────────────────────
const BoardView = ({ sidebarOpen = true, selected = 'webapp', scope = 'global' }) => (
  <CFrame currentView="board" sidebarOpen={sidebarOpen} selected={selected}>
    <BoardBody scope={scope} selected={selected} />
  </CFrame>
);

window.BoardView = BoardView;
