// Marrow Symphony — Feed view, part 2
// Right context panel (Issue task, branch, diff), bottom action bar with
// "3 more waiting" stack, vertical pager hint.

const FdI = window.FdIcon;
const FdK = window.FdKbd;
const FIc = window.FEED_ICONS;
const fW = window.fmtWait;

// ─── Context panel — glass, right side ──────────────────────────────────────
const FdSection = ({ icon, label, right, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      font: '500 11px/1 var(--font-sans)',
      letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
      color: 'var(--fg3)',
    }}>
      {icon && <FdI d={icon} size={12} stroke="var(--fg4)" strokeWidth={1.6} />}
      <span>{label}</span>
      <span style={{ flex: 1 }} />
      {right}
    </div>
    {children}
  </div>
);

const FdDiffBar = ({ added, removed, total = 12 }) => {
  // Render up to `total` cells of +/- with a hairline; tabular and crisp.
  const sum = added + removed;
  const aCells = Math.max(1, Math.round((added / sum) * total));
  const rCells = total - aCells;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{
        color: '#79fa87', font: '500 12px/1 var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}>+{added}</span>
      <span style={{ display: 'inline-flex', gap: 2 }}>
        {Array.from({ length: aCells }).map((_, i) => (
          <span key={`a${i}`} style={{ width: 6, height: 8, background: '#79fa87', borderRadius: 1 }} />
        ))}
        {Array.from({ length: rCells }).map((_, i) => (
          <span key={`r${i}`} style={{ width: 6, height: 8, background: '#fda4af', borderRadius: 1 }} />
        ))}
      </span>
      <span style={{
        color: '#fda4af', font: '500 12px/1 var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}>−{removed}</span>
    </div>
  );
};

const FdContextPanel = ({ entry }) => {
  const { issue, workspace } = entry;
  return (
    <aside style={{
      width: 340, flex: 'none',
      display: 'flex', flexDirection: 'column', gap: 20,
      padding: '20px 22px',
      borderRadius: 'var(--r-20)',
      background: 'rgb(20 20 22 / 0.55)',
      backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
      boxShadow: 'var(--shadow-glass)',
      overflow: 'auto', minHeight: 0,
    }}>
      {/* Issue */}
      <FdSection icon={FIc.layers} label="Issue" right={
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          font: '500 11px/1 var(--font-sans)', color: 'var(--fg4)',
        }}>
          <FdI d={FIc.external} size={11} />
          Linear
        </span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            font: '600 17px/22px var(--font-sans)', color: 'var(--fg1)',
            letterSpacing: '-0.01em', textWrap: 'pretty',
          }}>{issue.title}</div>
          <div style={{
            font: '400 13px/20px var(--font-sans)', color: 'var(--fg2)',
            whiteSpace: 'pre-wrap',
          }}>
            {issue.body.map((l, i) => {
              if (l === '') return <br key={i} />;
              const isBullet = l.startsWith('—');
              return (
                <div key={i} style={{
                  display: 'flex', gap: 8,
                  color: isBullet ? 'var(--fg2)' : 'var(--fg3)',
                }}>
                  {isBullet ? (
                    <>
                      <span style={{ color: 'var(--fg4)' }}>—</span>
                      <span>{l.slice(2)}</span>
                    </>
                  ) : <span>{l}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </FdSection>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

      {/* Workspace / branch */}
      <FdSection icon={FIc.gitBranch} label="Workspace" right={
        <span style={{
          font: '500 11px/1 var(--font-sans)', color: 'var(--fg4)',
        }}>{workspace.strategy}</span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            font: '500 13px/1 var(--font-mono)', color: 'var(--fg1)',
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ color: 'var(--fg2)' }}>{workspace.branch}</span>
            <span style={{ color: 'var(--fg4)' }}>←</span>
            <span style={{ color: 'var(--fg4)' }}>{workspace.baseBranch}</span>
          </div>
          <div style={{
            font: '400 12px/1 var(--font-sans)', color: 'var(--fg4)',
          }}>worktree at <span style={{ font: '400 12px/1 var(--font-mono)' }}>~/code/webapp-mar-7-auth-retry</span></div>
        </div>
      </FdSection>

      {/* Diff */}
      <FdSection icon={FIc.zap} label="Proposed diff" right={
        <span style={{
          font: '500 11px/1 var(--font-sans)', color: 'var(--fg4)',
          fontVariantNumeric: 'tabular-nums',
        }}>{workspace.diff.files} files</span>
      }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <FdDiffBar added={workspace.diff.added} removed={workspace.diff.removed} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {workspace.files.map((f) => (
              <div key={f.path} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 6,
                background: 'rgba(255,255,255,0.025)',
              }}>
                <FdI d={FIc.file} size={11} stroke="var(--fg4)" strokeWidth={1.6} />
                <span style={{
                  flex: 1, minWidth: 0,
                  font: '500 12px/1 var(--font-mono)', color: 'var(--fg2)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{f.path}</span>
                <span style={{
                  font: '500 11px/1 var(--font-mono)', color: '#79fa87',
                  fontVariantNumeric: 'tabular-nums',
                }}>+{f.added}</span>
                {f.removed > 0 && (
                  <span style={{
                    font: '500 11px/1 var(--font-mono)', color: '#fda4af',
                    fontVariantNumeric: 'tabular-nums',
                  }}>−{f.removed}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </FdSection>
    </aside>
  );
};

// ─── Action bar — bottom, glass ─────────────────────────────────────────────
const FdActionBtn = ({ icon, label, kbd, onClick, variant = 'ghost' }) => {
  const [hover, setHover] = React.useState(false);
  const bg = variant === 'secondary'
    ? (hover ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)')
    : (hover ? 'rgba(255,255,255,0.06)' : 'transparent');
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        height: 34, padding: kbd ? '0 8px 0 12px' : '0 14px',
        background: bg,
        border: 0, borderRadius: 8, cursor: 'pointer',
        color: variant === 'secondary' ? 'var(--fg1)' : 'var(--fg2)',
        font: '500 13px/1 var(--font-sans)', letterSpacing: '-0.005em',
        transition: 'background 120ms var(--ease-toggle)',
      }}
    >
      {icon && <FdI d={icon} size={14} />}
      <span>{label}</span>
      {kbd && <FdK style={{ marginLeft: 2 }}>{kbd}</FdK>}
    </button>
  );
};

const FdRainbowDone = ({ onClick }) => (
  <button onClick={onClick} className="fd-rainbow" style={{
    position: 'relative',
    display: 'inline-flex', alignItems: 'center', gap: 8,
    height: 38, padding: '0 16px 0 14px',
    borderRadius: 10,
    border: '3px solid transparent',
    background:
      'linear-gradient(#1a1a1f,#1a1a1f) padding-box,' +
      'conic-gradient(from var(--ms-angle, 0deg), #da8c6b, #d930b1, #8844d8, #4e52f4, #87f3ff, #da8c6b) border-box',
    color: '#fafafa',
    font: '600 13px/1 var(--font-sans)', letterSpacing: '-0.005em',
    cursor: 'pointer',
  }}>
    <FdI d={FIc.check} size={15} strokeWidth={2.2} />
    Mark done
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 20, height: 20, padding: '0 5px',
      borderRadius: 5,
      background: 'rgba(0,0,0,0.45)',
      color: 'var(--fg2)',
      font: '500 11px/1 var(--font-mono)',
      marginLeft: 4,
    }}>⌘⏎</span>
  </button>
);

const FdUpNextPreview = ({ queue, queueIdx }) => {
  const upcoming = queue.slice(queueIdx + 1, queueIdx + 4);
  const remaining = queue.length - queueIdx - 1;
  if (remaining <= 0) return null;
  const next = upcoming[0];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '6px 12px 6px 8px', height: 34,
      borderRadius: 999,
      background: 'rgba(255,255,255,0.04)',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
      cursor: 'pointer',
    }}>
      <span style={{
        font: '500 10px/1 var(--font-sans)',
        letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
        color: 'var(--fg4)',
      }}>Up next</span>

      {/* Stacked project glyphs (up to 3) */}
      <span style={{ display: 'inline-flex', alignItems: 'center' }}>
        {upcoming.map((q, i) => (
          <span key={q.id} style={{
            width: 18, height: 18, borderRadius: 5,
            background: 'rgba(0,0,0,0.55)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `inset 0 0 0 1.25px ${q.project.color}, 0 0 8px -2px ${q.project.color}88, 0 0 0 1.5px #0a0a0a`,
            color: '#fafafa',
            font: '600 10px/1 var(--font-mono)',
            textTransform: 'uppercase',
            marginLeft: i === 0 ? 0 : -6,
            zIndex: 10 - i,
          }}>{q.project.glyph}</span>
        ))}
      </span>

      {/* Next item key + title preview */}
      <span style={{
        display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0,
        font: '500 12px/1 var(--font-sans)', color: 'var(--fg2)',
      }}>
        <span style={{
          font: '500 11px/1 var(--font-mono)', color: 'var(--fg3)',
        }}>{next.issue.key}</span>
        <span style={{
          color: 'var(--fg2)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: 220,
        }}>{next.issue.title}</span>
      </span>

      <span style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        color: 'var(--fg3)', font: '500 12px/1 var(--font-sans)',
      }}>
        <span className="fd-attn-dot" style={{ width: 6, height: 6 }} />
        <span style={{
          color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums',
        }}>{remaining}</span>
        <span style={{ color: 'var(--fg3)' }}>more waiting</span>
        <FdK style={{ marginLeft: 4 }}>⌘↓</FdK>
      </span>
    </div>
  );
};

const FdActionBar = ({ entry, queueIdx, queue }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12,
    padding: '10px 14px 10px 18px',
    borderRadius: 'var(--r-20)',
    background: 'rgb(20 20 22 / 0.62)',
    backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
    boxShadow: 'var(--shadow-glass)',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <FdActionBtn icon={FIc.chevUp}    label="Previous"        kbd="⌘↑" />
      <FdActionBtn icon={FIc.skip}      label="Skip"            kbd="J" />
      <FdActionBtn icon={FIc.snooze}    label="Snooze"          kbd="Z" />
      <FdActionBtn icon={FIc.terminal}  label="Open in Cockpit" variant="secondary" />
    </div>

    {/* Center: up-next preview */}
    <FdUpNextPreview queue={queue} queueIdx={queueIdx} />

    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{
        font: '500 12px/1 var(--font-sans)', color: 'var(--fg3)',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{
          color: 'var(--fg1)', fontVariantNumeric: 'tabular-nums',
          font: '500 13px/1 var(--font-mono)',
        }}>{queueIdx + 1}</span>
        <span style={{ color: 'var(--fg4)' }}>/</span>
        <span style={{
          fontVariantNumeric: 'tabular-nums',
          font: '500 13px/1 var(--font-mono)',
        }}>{queue.length}</span>
      </span>
      <FdRainbowDone />
    </div>
  </div>
);

// ─── Next-up rail — vertical strip of upcoming feed cards ──────────────────
const FdNextRail = ({ queue, currentIdx }) => {
  // Show up to 3 upcoming entries as compact, tilted preview tiles.
  const upcoming = queue.slice(currentIdx + 1, currentIdx + 4);
  return (
    <div style={{
      width: 200, flex: 'none',
      display: 'flex', flexDirection: 'column', gap: 12,
      minHeight: 0,
    }}>
      {/* Pager hint */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        padding: '14px 16px',
        borderRadius: 'var(--r-20)',
        background: 'rgb(20 20 22 / 0.55)',
        backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
        boxShadow: 'var(--shadow-glass)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          font: '500 11px/1 var(--font-sans)',
          letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
          color: 'var(--fg3)',
        }}>
          <FdI d={FIc.inbox} size={12} stroke="var(--fg4)" strokeWidth={1.6} />
          Up next
        </div>
        <div style={{
          font: '500 13px/1 var(--font-sans)', color: 'var(--fg2)',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            font: '600 18px/1 var(--font-sans)', color: 'var(--fg1)',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.02em',
          }}>{queue.length - currentIdx - 1}</span>
          <span style={{ color: 'var(--fg3)' }}>more waiting</span>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          font: '400 11px/1 var(--font-sans)', color: 'var(--fg4)',
          marginTop: 2,
        }}>
          <FdK>⌘↓</FdK>
          <span>next</span>
          <span style={{ margin: '0 2px' }}>·</span>
          <FdK>⌘↑</FdK>
          <span>back</span>
        </div>
      </div>

      {/* Stack of upcoming tiles */}
      <div style={{
        position: 'relative',
        display: 'flex', flexDirection: 'column', gap: 10,
        flex: 1, minHeight: 0,
      }}>
        {upcoming.map((q, i) => (
          <FdNextTile key={q.id} entry={q} idx={i} />
        ))}
        {/* fade-out tail */}
        <div style={{
          position: 'absolute', left: -10, right: -10, bottom: -10, height: 80,
          background: 'linear-gradient(to bottom, transparent, rgba(5,5,5,0.85))',
          pointerEvents: 'none',
        }} />
      </div>
    </div>
  );
};

const FdNextTile = ({ entry, idx }) => {
  const { project, issue, runner, session } = entry;
  // Subtle depth: each card progressively dimmer.
  const dim = 1 - idx * 0.18;
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 14,
      background: `rgb(20 20 22 / ${0.42 - idx * 0.06})`,
      backdropFilter: 'blur(20px) saturate(130%)',
      WebkitBackdropFilter: 'blur(20px) saturate(130%)',
      boxShadow: `0 ${4 + idx * 2}px ${18 - idx * 4}px -8px rgba(0,0,0,${0.4 - idx * 0.08}), inset 0 1px 0 rgba(255,255,255,0.04)`,
      opacity: dim,
      transform: `translateX(${idx * 4}px)`,
      display: 'flex', flexDirection: 'column', gap: 8,
      cursor: 'pointer',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 16, height: 16, borderRadius: 4,
          background: 'rgba(0,0,0,0.35)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 0 0 1px ${project.color}, 0 0 8px -2px ${project.color}88`,
          color: '#fafafa',
          font: '600 10px/1 var(--font-mono)',
          textTransform: 'uppercase',
        }}>{project.glyph}</span>
        <span style={{
          font: '500 11px/1 var(--font-sans)', color: project.color,
        }}>{project.name}</span>
        <span style={{ color: 'var(--fg4)', font: '400 11px/1 var(--font-sans)' }}>▸</span>
        <span style={{
          font: '500 11px/1 var(--font-mono)', color: 'var(--fg3)',
          flex: 1, minWidth: 0,
        }}>{issue.key}</span>
        <span className="fd-attn-dot" style={{ width: 6, height: 6 }} />
      </div>
      <div style={{
        font: '500 12px/16px var(--font-sans)', color: 'var(--fg2)',
        letterSpacing: '-0.005em',
        overflow: 'hidden', textOverflow: 'ellipsis',
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
      }}>{issue.title}</div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        font: '500 11px/1 var(--font-sans)', color: 'var(--fg4)',
      }}>
        <span style={{ font: '500 11px/1 var(--font-mono)' }}>{runner.name}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <FdI d={FIc.clock} size={10} stroke="var(--fg4)" strokeWidth={1.6} />
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fW(session.waitingMs)}</span>
        </span>
      </div>
    </div>
  );
};

window.FdContextPanel = FdContextPanel;
window.FdActionBar    = FdActionBar;
window.FdNextRail     = FdNextRail;
