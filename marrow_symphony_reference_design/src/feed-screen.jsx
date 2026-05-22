// Marrow Symphony — Feed view, assembled.
//
// Two scenes:
//   FeedScreen      — active state, one Needs-Input session in focus
//   FeedInboxZero   — healthy default, "no agents need you"

const FD2 = window.FEED_DATA;
const FIc2 = window.FEED_ICONS;

const FeedFrame = ({ children }) => (
  <div style={{
    position: 'absolute', inset: 0,
    display: 'flex', flexDirection: 'column',
    background: '#050505',
    overflow: 'hidden',
    fontFamily: 'var(--font-sans)',
    color: 'var(--fg1)',
  }}>
    {/* Shader backdrop */}
    <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
      <Shader reduce={false} />
    </div>
    {/* Soft warm bloom near the center to lift the focus card off the shader */}
    <div style={{
      position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
      background:
        'radial-gradient(70% 50% at 40% 60%, rgba(0,217,255,0.08), transparent 60%),' +
        'radial-gradient(60% 40% at 80% 30%, rgba(217,48,177,0.06), transparent 60%)',
    }} />
    {children}
  </div>
);

// ─── Active Feed screen ─────────────────────────────────────────────────────
const FeedScreen = () => {
  const queue = FD2.queue;
  const current = queue[0];
  const totalWaiting = queue.length;

  return (
    <FeedFrame>
      <FdTopBar waiting={totalWaiting} />

      {/* Feed body — single centered column */}
      <div style={{
        position: 'relative', zIndex: 4,
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', gap: 14,
        padding: '14px 14px 14px 14px',
      }}>
        <FdSlimHeader entry={current} />

        <div style={{
          flex: 1, minHeight: 0,
          display: 'flex', gap: 14,
        }}>
          <FdTerminal entry={current} />
          <FdContextPanel entry={current} />
        </div>

        <FdActionBar entry={current} queueIdx={0} queue={queue} />
      </div>
    </FeedFrame>
  );
};

// ─── Inbox zero — healthy default ───────────────────────────────────────────
const FeedInboxZero = () => (
  <FeedFrame>
    <FdTopBar waiting={0} />

    <div style={{
      position: 'relative', zIndex: 4,
      flex: 1, minHeight: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: 480, padding: '40px 40px 36px',
        borderRadius: 'var(--r-20)',
        background: 'rgb(20 20 22 / 0.55)',
        backdropFilter: 'var(--blur-glass)', WebkitBackdropFilter: 'var(--blur-glass)',
        boxShadow: 'var(--shadow-glass-lifted)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        textAlign: 'center',
      }}>
        <span style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--fg2)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
        }}>
          <FdIcon d={FIc2.inbox} size={26} strokeWidth={1.4} />
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{
            font: '600 22px/1.2 var(--font-sans)', letterSpacing: '-0.02em', color: 'var(--fg1)',
          }}>No agents need you.</div>
          <div style={{
            font: '400 13px/20px var(--font-sans)', color: 'var(--fg3)',
            maxWidth: 360,
          }}>
            12 Sessions running across 4 Projects — they'll bring you back in when
            they hit a decision point.
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginTop: 4,
          font: '500 12px/1 var(--font-sans)', color: 'var(--fg4)',
        }}>
          <FdKbd>⌘B</FdKbd>
          <span>open Board</span>
          <span style={{ margin: '0 4px' }}>·</span>
          <FdKbd>⌘C</FdKbd>
          <span>open Cockpit</span>
        </div>

        {/* Live fleet strip */}
        <div style={{
          width: '100%', marginTop: 14,
          padding: '14px 16px',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.30)',
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            font: '500 11px/1 var(--font-sans)',
            letterSpacing: 'var(--tracking-caps)', textTransform: 'uppercase',
            color: 'var(--fg3)',
          }}>
            <span>Live fleet</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              color: 'var(--fg2)', textTransform: 'none', letterSpacing: 0,
              font: '500 11px/1 var(--font-sans)',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--status-running)',
                boxShadow: '0 0 8px var(--status-running-glow)',
              }} />
              12 running
            </span>
          </div>
          {[
            { id: 'webapp', color: '#5b8cff', name: 'webapp', live: 5, glyph: 'w' },
            { id: 'api',    color: '#79fa87', name: 'api',    live: 4, glyph: 'a' },
            { id: 'docs',   color: '#ffb300', name: 'docs',   live: 1, glyph: 'd' },
            { id: 'infra',  color: '#7c4dff', name: 'infra',  live: 2, glyph: 'i' },
          ].map((p) => (
            <div key={p.id} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              font: '500 12px/1 var(--font-sans)', color: 'var(--fg2)',
            }}>
              <span style={{
                width: 18, height: 18, borderRadius: 5,
                background: 'rgba(0,0,0,0.35)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: `inset 0 0 0 1.25px ${p.color}, 0 0 10px -2px ${p.color}88`,
                color: '#fafafa',
                font: '600 11px/1 var(--font-mono)', textTransform: 'uppercase',
              }}>{p.glyph}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>{p.name}</span>
              <span style={{
                font: '500 12px/1 var(--font-mono)', color: 'var(--fg3)',
                fontVariantNumeric: 'tabular-nums',
              }}>{p.live} live</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </FeedFrame>
);

window.FeedScreen = FeedScreen;
window.FeedInboxZero = FeedInboxZero;
