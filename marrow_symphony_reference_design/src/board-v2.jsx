// Marrow Symphony — Board v2
// Brief: All Projects (global) scope. Glass cards on a calm backdrop. Per-Project
// color is the ONLY chroma (left-edge stripe + tiny dot + faint tint). Cards show
// Issue key + title, Project badge, runner chip, and Session Status (warm amber
// "Needs input" pill OR a quiet green Running dot). Key interaction shown:
// one card lifted mid-drag, hovering over the Started column.

// ─── Seed data ──────────────────────────────────────────────────────────────
const B2_PROJECTS = {
  webapp: { name: 'webapp', color: '#5b8cff', dim: '#1a2540' },
  api:    { name: 'api',    color: '#79fa87', dim: '#16271c' },
  docs:   { name: 'docs',   color: '#ffb300', dim: '#2a200b' },
  infra:  { name: 'infra',  color: '#9d7bff', dim: '#221a3c' },
};

// Warm amber — the only semantic chroma in the working surface. Per brief.
const B2_AMBER = '#f5a524';
const B2_AMBER_GLOW = 'rgba(245,165,36,0.55)';
const B2_AMBER_BG = 'rgba(245,165,36,0.10)';
const B2_GREEN = '#79fa87'; // running dot (deliberately the same hue as api — quiet, doesn't shout)

const B2_COLUMNS = [
  { id: 'backlog',    label: 'Backlog' },
  { id: 'todo',       label: 'Todo' },
  { id: 'started',    label: 'Started' },
  { id: 'in-review',  label: 'In Review' },
  { id: 'done',       label: 'Done' },
];

const B2_ISSUES = {
  backlog: [
    { id: 'API-9',  project: 'api',    title: 'Paginate search results',          runner: 'claude' },
    { id: 'WEB-4',  project: 'webapp', title: 'Dark-mode polish',                 runner: 'claude' },
  ],
  todo: [
    { id: 'DOC-1',  project: 'docs',   title: 'Rewrite the quickstart',           runner: 'claude' },
    { id: 'INF-5',  project: 'infra',  title: 'Terraform state migration',        runner: 'claude' },
  ],
  started: [
    { id: 'MAR-7',  project: 'webapp', title: 'Fix auth retry logic',             runner: 'claude', status: 'needs-input', mins: 14, files: 2, add: 24, rem: 3 },
    { id: 'AP-3',   project: 'api',    title: 'Rate-limit ingest endpoint',       runner: 'claude', status: 'needs-input', mins: 23, files: 1, add: 11, rem: 0 },
    { id: 'MAR-2',  project: 'webapp', title: 'Cache user lookups',               runner: 'claude', status: 'running',     mins: 4,  files: 3, add: 38, rem: 12 },
  ],
  'in-review': [
    { id: 'INF-2',  project: 'infra',  title: 'Bump CI runner image',             runner: 'codex',  status: 'idle', files: 1, add: 6, rem: 2 },
  ],
  done: [
    { id: 'WEB-1',  project: 'webapp', title: 'Set up CI',                        runner: 'claude' },
    { id: 'DOC-0',  project: 'docs',   title: 'Docs scaffold',                    runner: 'claude' },
  ],
};

// The card lifted mid-drag — INF-5 leaving Todo, hovering over the Started column.
// Its slot in Todo becomes a dashed placeholder; Started shows a "drop here" rail.
const B2_DRAG = {
  issue: B2_ISSUES.todo[1], // INF-5 Terraform state migration
  fromColumn: 'todo',
  overColumn: 'started',
};

// ─── Atoms ──────────────────────────────────────────────────────────────────
const B2Stripe = ({ color }) => (
  <span style={{
    position: 'absolute', left: 0, top: 8, bottom: 8, width: 3,
    background: color, borderRadius: 2,
    boxShadow: `0 0 10px -1px ${color}cc, 0 0 2px 0 ${color}`,
  }} />
);

const B2ProjectBadge = ({ project }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 16, padding: '0 6px 0 5px', borderRadius: 4,
    background: 'rgba(255,255,255,0.04)',
    font: '500 10.5px/1 var(--font-sans)', letterSpacing: '-0.005em',
    color: 'var(--fg2)',
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: project.color,
      boxShadow: `0 0 6px ${project.color}aa`,
    }} />
    {project.name}
  </span>
);

const B2RunnerChip = ({ runner }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    height: 16, padding: '0 6px', borderRadius: 4,
    background: 'rgba(255,255,255,0.03)',
    font: '500 10px/1 var(--font-mono)', color: 'var(--fg3)',
    letterSpacing: '0.01em',
  }}>
    <span style={{
      width: 4, height: 4, borderRadius: 1,
      background: 'var(--fg3)',
    }} />
    {runner}
  </span>
);

// Warm amber "Needs input" pill — single chromatic semantic color in the system.
const B2NeedsPill = () => (
  <span className="b2-needs" style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 18, padding: '0 7px 0 6px', borderRadius: 5,
    background: B2_AMBER_BG,
    boxShadow: `inset 0 0 0 1px ${B2_AMBER}66, 0 0 0 1px transparent`,
    color: B2_AMBER, font: '600 10.5px/1 var(--font-sans)',
    letterSpacing: '-0.005em', whiteSpace: 'nowrap',
  }}>
    <span style={{
      width: 5, height: 5, borderRadius: '50%',
      background: B2_AMBER,
      boxShadow: `0 0 8px ${B2_AMBER_GLOW}`,
    }} />
    Needs input
  </span>
);

const B2RunningDot = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 18, padding: '0 6px', borderRadius: 5,
    color: 'var(--fg3)', font: '500 10.5px/1 var(--font-sans)',
  }}>
    <span className="b2-run" style={{
      width: 6, height: 6, borderRadius: '50%',
      background: B2_GREEN,
      boxShadow: `0 0 8px ${B2_GREEN}99`,
    }} />
    Running
  </span>
);

const B2IdleDot = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 5,
    height: 18, padding: '0 6px', borderRadius: 5,
    color: 'var(--fg4)', font: '500 10.5px/1 var(--font-sans)',
  }}>
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: 'transparent',
      boxShadow: 'inset 0 0 0 1.25px var(--fg4)',
    }} />
    Idle
  </span>
);

const B2Diff = ({ add, rem }) => (
  <span style={{
    font: '500 10px/1 var(--font-mono)',
    fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
  }}>
    <span style={{ color: '#79fa87' }}>+{add}</span>
    <span style={{ margin: '0 3px', color: 'var(--fg4)' }}>/</span>
    <span style={{ color: '#fda4af' }}>−{rem}</span>
  </span>
);

// ─── Card ───────────────────────────────────────────────────────────────────
const B2Card = ({ issue, dragging = false, ghost = false, dimmed = false }) => {
  const project = B2_PROJECTS[issue.project];
  const needs = issue.status === 'needs-input';
  const running = issue.status === 'running';
  const idle = issue.status === 'idle';

  // Glass cards: translucent dark, blurred, rounded, no borders.
  // Needs-input gets an amber hairline + outer glow (warm color).
  const cardBg = needs
    ? 'rgba(38, 28, 12, 0.62)'      // amber-tinted glass
    : 'rgba(22, 22, 26, 0.62)';     // neutral glass

  return (
    <div style={{
      position: 'relative',
      borderRadius: 10,
      padding: '9px 10px 9px 13px',
      background: cardBg,
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
      boxShadow: dragging
        ? `0 24px 60px -12px rgba(0,0,0,0.75),
           0 6px 18px -4px rgba(0,0,0,0.55),
           inset 0 0 0 1px rgba(255,255,255,0.10),
           inset 0 1px 0 0 rgba(255,255,255,0.06)`
        : needs
          ? `0 0 0 1px ${B2_AMBER}55,
             0 0 18px -4px ${B2_AMBER_GLOW},
             0 4px 14px -8px rgba(0,0,0,0.5),
             inset 0 1px 0 0 rgba(255,255,255,0.03)`
          : `0 1px 2px 0 rgba(0,0,0,0.45),
             inset 0 0 0 1px rgba(255,255,255,0.045),
             inset 0 1px 0 0 rgba(255,255,255,0.035)`,
      opacity: dimmed ? 0.35 : 1,
      cursor: dragging ? 'grabbing' : 'grab',
      transition: 'box-shadow 220ms var(--ease-out-expo)',
    }}>
      <B2Stripe color={project.color} />

      {/* Row 1: project badge + spacer + issue key */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5,
      }}>
        <B2ProjectBadge project={project} />
        <span style={{ flex: 1 }} />
        <span style={{
          font: '500 10.5px/1 var(--font-mono)', color: 'var(--fg4)',
          fontVariantNumeric: 'tabular-nums', letterSpacing: '0.01em',
        }}>{issue.id}</span>
      </div>

      {/* Title */}
      <div style={{
        font: '500 13px/17px var(--font-sans)',
        letterSpacing: '-0.005em', color: 'var(--fg1)',
        marginBottom: 8, textWrap: 'pretty',
      }}>{issue.title}</div>

      {/* Row 3: runner + (diff) + spacer + status */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, minHeight: 18,
      }}>
        {issue.runner && <B2RunnerChip runner={issue.runner} />}
        {issue.add != null && issue.rem != null && !needs && (
          <B2Diff add={issue.add} rem={issue.rem} />
        )}
        <span style={{ flex: 1 }} />
        {needs && <B2NeedsPill />}
        {running && <B2RunningDot />}
        {idle && <B2IdleDot />}
      </div>
    </div>
  );
};

// Ghost slot — where the dragged card came from. Dashed outline + label.
const B2GhostSlot = ({ height = 84, label = 'Moving…' }) => (
  <div style={{
    position: 'relative',
    height,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.012)',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
    backgroundImage: `repeating-linear-gradient(135deg,
      rgba(255,255,255,0.025) 0 6px, transparent 6px 12px)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--fg4)', font: '500 11px/1 var(--font-sans)',
  }}>{label}</div>
);

// Drop rail — where the card would land. Amber-warm to imply "agent will launch".
const B2DropRail = ({ height = 84 }) => (
  <div style={{
    position: 'relative',
    height,
    borderRadius: 10,
    background: 'rgba(245,165,36,0.05)',
    boxShadow: `inset 0 0 0 1.5px ${B2_AMBER}55, 0 0 24px -10px ${B2_AMBER_GLOW}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: B2_AMBER, font: '500 11px/1 var(--font-sans)', letterSpacing: '-0.005em',
  }}>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={B2_AMBER} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
      Drop to start — launches claude in a new Workspace
    </span>
  </div>
);

// ─── Column header (cards passed as siblings below it) ─────────────────────
const B2ColumnHeader = ({ column, count, needsCount, isDropTarget = false }) => (
  <div style={{
    flex: 'none',
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '14px 12px 10px',
  }}>
    <span style={{
      font: '600 11.5px/1 var(--font-sans)',
      letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
      color: isDropTarget ? B2_AMBER : 'var(--fg2)',
    }}>{column.label}</span>
    <span style={{
      font: '500 11px/1 var(--font-mono)',
      fontVariantNumeric: 'tabular-nums',
      color: 'var(--fg4)',
    }}>{count}</span>
    {needsCount > 0 && (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        height: 15, padding: '0 5px', borderRadius: 4,
        background: B2_AMBER_BG, color: B2_AMBER,
        font: '600 10px/1 var(--font-sans)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{
          width: 4, height: 4, borderRadius: '50%',
          background: B2_AMBER, boxShadow: `0 0 6px ${B2_AMBER_GLOW}`,
        }} />
        {needsCount}
      </span>
    )}
    <span style={{ flex: 1 }} />
    <button title="Add Issue" style={{
      width: 20, height: 20, padding: 0, border: 0, borderRadius: 4,
      background: 'transparent', color: 'var(--fg4)', cursor: 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  </div>
);

// ─── The lifted drag card — absolutely positioned over the board ────────────
const B2DraggingCard = ({ issue, x, y, width = 252 }) => (
  <div className="b2-drag-host" style={{
    position: 'absolute', left: x, top: y, width,
    pointerEvents: 'none',
    zIndex: 50,
    filter: 'drop-shadow(0 24px 36px rgba(0,0,0,0.55))',
  }}>
    <B2Card issue={issue} dragging />
    {/* cursor / grip indicator on the corner */}
    <div style={{
      position: 'absolute', right: -10, top: -10,
      width: 24, height: 24, borderRadius: '50%',
      background: 'rgba(20,20,22,0.85)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.12)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--fg2)',
    }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.3" /><circle cx="15" cy="6" r="1.3" />
        <circle cx="9" cy="12" r="1.3" /><circle cx="15" cy="12" r="1.3" />
        <circle cx="9" cy="18" r="1.3" /><circle cx="15" cy="18" r="1.3" />
      </svg>
    </div>
  </div>
);

// ─── Board body ─────────────────────────────────────────────────────────────
const B2Body = () => {
  return (
    <main style={{
      flex: 1, margin: '10px 10px 10px 10px',
      borderRadius: 20, overflow: 'hidden',
      // Calm backdrop: nearly opaque so the shader's churn doesn't compete
      // with dense card content. Faint warm gradient toward Started column.
      background: `
        radial-gradient(120% 80% at 50% 0%, rgba(245,165,36,0.04) 0%, transparent 55%),
        linear-gradient(180deg, rgba(14,14,16,0.92) 0%, rgba(10,10,12,0.94) 100%)`,
      backdropFilter: 'blur(28px) saturate(120%)',
      WebkitBackdropFilter: 'blur(28px) saturate(120%)',
      boxShadow: '0 8px 32px -4px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.04)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', zIndex: 4,
    }}>
      {/* View header */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
      }}>
        {/* Left: title */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          <h2 style={{
            margin: 0, font: '600 20px/1.1 var(--font-sans)',
            letterSpacing: '-0.015em', color: 'var(--fg1)',
          }}>All Projects</h2>
          <span style={{
            font: '400 13px/1 var(--font-sans)', color: 'var(--fg3)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            10 issues
            <span style={{ margin: '0 7px', color: 'var(--fg5,#3a3a40)' }}>·</span>
            <span style={{ color: B2_AMBER }}>2 need input</span>
            <span style={{ margin: '0 7px', color: 'var(--fg5,#3a3a40)' }}>·</span>
            <span style={{ color: 'var(--fg3)' }}>across 4 Projects</span>
          </span>
        </div>

        {/* Right: scope toggle + filter + add */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Scope toggle — prominent */}
          <div style={{
            display: 'inline-flex', background: 'rgba(0,0,0,0.45)',
            borderRadius: 9, padding: 3,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.045)',
          }}>
            {[
              { v: 'project', label: 'This Project' },
              { v: 'all',     label: 'All Projects' },
            ].map((opt) => {
              const active = opt.v === 'all';
              return (
                <button key={opt.v} style={{
                  height: 28, padding: '0 14px',
                  background: active ? '#fafafa' : 'transparent',
                  color: active ? '#0a0a0a' : 'var(--fg2)',
                  border: 0, borderRadius: 6, cursor: 'pointer',
                  font: active ? '600 12.5px/1 var(--font-sans)' : '500 12.5px/1 var(--font-sans)',
                  letterSpacing: '-0.005em',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}>
                  {active && (
                    <span style={{
                      width: 5, height: 5, borderRadius: '50%',
                      background: '#0a0a0a',
                    }} />
                  )}
                  {opt.label}
                </button>
              );
            })}
          </div>

          {/* Filter chip */}
          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 11px',
            background: 'rgba(0,0,0,0.42)',
            color: 'var(--fg2)', cursor: 'pointer',
            border: 0, borderRadius: 8,
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.045)',
            font: '500 12px/1 var(--font-sans)',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 3H2l8 9.5V19l4 2v-8.5z" />
            </svg>
            Filter
            <span style={{
              marginLeft: 4, color: 'var(--fg4)',
              font: '500 11px/1 var(--font-mono)',
            }}>2</span>
          </button>

          <button style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            height: 30, padding: '0 12px',
            background: '#fafafa', color: '#0a0a0a', cursor: 'pointer',
            border: 0, borderRadius: 8,
            font: '600 12.5px/1 var(--font-sans)', letterSpacing: '-0.005em',
            boxShadow: '0 1px 2px rgba(0,0,0,0.45), inset 0 -1px 0 rgba(0,0,0,0.08)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add Issue
            <span style={{
              marginLeft: 2, padding: '2px 4px', borderRadius: 4,
              background: 'rgba(0,0,0,0.10)', color: 'rgba(10,10,10,0.55)',
              font: '500 10px/1 var(--font-mono)',
            }}>C</span>
          </button>
        </div>
      </div>

      {/* Project legend strip */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '0 22px 14px',
      }}>
        {Object.entries(B2_PROJECTS).map(([id, p]) => (
          <span key={id} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: 'var(--fg3)', font: '500 11.5px/1 var(--font-sans)',
            letterSpacing: '-0.005em',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: 2,
              background: p.color,
              boxShadow: `0 0 8px ${p.color}88`,
            }} />
            {p.name}
          </span>
        ))}
        <span style={{ flex: 1 }} />
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          color: 'var(--fg4)', font: '400 11.5px/1 var(--font-sans)',
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: B2_AMBER,
            boxShadow: `0 0 6px ${B2_AMBER_GLOW}`,
          }} />
          warm pill = agent is waiting on you
        </span>
      </div>

      {/* Kanban grid */}
      <div style={{
        flex: 1, minHeight: 0,
        margin: '0 12px 12px',
        borderRadius: 14, overflow: 'hidden',
        background: 'rgba(0,0,0,0.32)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.035)',
        display: 'grid',
        gridTemplateColumns: 'repeat(5, minmax(0,1fr))',
        gap: 1, position: 'relative',
      }}>
        {/* Column-separator hairlines via the background showing through gaps */}
        {B2_COLUMNS.map((col) => {
          const baseIssues = B2_ISSUES[col.id] || [];
          const isDropTarget = col.id === B2_DRAG.overColumn;
          const needsCount = baseIssues.filter((i) => i.status === 'needs-input').length;

          const cards = baseIssues.map((iss) => {
            // Hide the dragged card from its source — replaced with ghost.
            if (iss.id === B2_DRAG.issue.id && col.id === B2_DRAG.fromColumn) {
              return <B2GhostSlot key={`ghost-${iss.id}`} label="INF-5 · moving" />;
            }
            return <B2Card key={iss.id} issue={iss} />;
          });

          const list = isDropTarget ? [<B2DropRail key="drop" />, ...cards] : cards;

          return (
            <div key={col.id} style={{
              position: 'relative',
              background: isDropTarget
                ? 'linear-gradient(180deg, rgba(245,165,36,0.07) 0%, rgba(245,165,36,0.02) 40%, transparent 100%)'
                : 'rgba(10,10,12,0.35)',
              display: 'flex', flexDirection: 'column',
              minWidth: 0, minHeight: 0,
            }}>
              <B2ColumnHeader column={col} count={baseIssues.length}
                needsCount={needsCount} isDropTarget={isDropTarget} />
              <div style={{
                flex: 1, minHeight: 0,
                display: 'flex', flexDirection: 'column', gap: 7,
                padding: '0 10px 12px',
                overflow: 'hidden',
              }}>
                {list}
              </div>
            </div>
          );
        })}

        {/* The lifted dragging card — positioned over the Started column */}
        {/* Started is column index 2 of 5 → center ≈ 50%. Offset so card hovers
            with a slight upward lift, with cursor near its grip handle. */}
        <B2DraggingCard
          issue={B2_DRAG.issue}
          x={'calc(40% + 8px)'}
          y={132}
          width={258}
        />

        {/* drag motion trail — soft amber breadcrumb from Todo column to drag */}
        <svg width="100%" height="100%" viewBox="0 0 1380 720" preserveAspectRatio="none"
          style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            opacity: 0.4, zIndex: 1,
          }}>
          <defs>
            <linearGradient id="trail" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={B2_AMBER} stopOpacity="0" />
              <stop offset="60%" stopColor={B2_AMBER} stopOpacity="0.35" />
              <stop offset="100%" stopColor={B2_AMBER} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M 360 200 Q 460 170 540 175" stroke="url(#trail)"
            strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
        </svg>
      </div>

      {/* Bottom legend — keyboard hints */}
      <div style={{
        flex: 'none',
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '0 22px 14px',
        color: 'var(--fg4)', font: '400 11px/1 var(--font-sans)',
      }}>
        <span>Drag a card to change its state — moving into <span style={{ color: B2_AMBER }}>Started</span> launches a Runner.</span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <kbd style={kbd}>N</kbd> new issue
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <kbd style={kbd}>F</kbd> filter
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <kbd style={kbd}>⌘</kbd><kbd style={kbd}>K</kbd> command bar
        </span>
      </div>
    </main>
  );
};

const kbd = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 16, height: 16, padding: '0 4px', borderRadius: 3,
  background: 'rgba(255,255,255,0.05)', color: 'var(--fg3)',
  font: '500 10px/1 var(--font-mono)',
  boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.04)',
};

// ─── Mount ──────────────────────────────────────────────────────────────────
const Board2View = ({ sidebarOpen = true, selected = 'webapp' }) => (
  <CFrame currentView="board" sidebarOpen={sidebarOpen} selected={selected}>
    <B2Body />
  </CFrame>
);

window.Board2View = Board2View;
