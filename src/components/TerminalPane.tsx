import { useEffect, useMemo, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen } from "@tauri-apps/api/event";
import {
  Bell,
  Play,
  RotateCcw,
  SkipForward,
  Square,
} from "lucide-react";
import "@xterm/xterm/css/xterm.css";
import {
  getSessionScrollback,
  isTauriRuntime,
  killSession,
  resizeSession,
  restartSession,
  resumeSession,
  setSessionStatus,
  writeToSession,
} from "@/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SessionOutputEvent, SessionSummary } from "@/types";

type TerminalDensity = "bare" | "minimal" | "full";

interface TerminalPaneProps {
  session: SessionSummary;
  density?: TerminalDensity;
  className?: string;
  readOnly?: boolean;
  onSessionChanged?: () => void;
}

export function TerminalPane({
  session,
  density = "full",
  className,
  readOnly = false,
  onSessionChanged,
}: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const live = session.status !== "exited";

  // Hold the latest callback in a ref so the terminal-construction effect below
  // doesn't depend on its identity. The parent passes a fresh `invalidateWork`
  // on every render, and onData fires it on every keystroke; without this the
  // effect would dispose and rebuild the xterm instance constantly.
  const onSessionChangedRef = useRef(onSessionChanged);
  useEffect(() => {
    onSessionChangedRef.current = onSessionChanged;
  }, [onSessionChanged]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const terminal = new Terminal({
      cursorBlink: !readOnly,
      convertEol: true,
      disableStdin: readOnly || !live,
      fontFamily: 'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      fontSize: density === "minimal" ? 11 : 12,
      lineHeight: 1.16,
      scrollback: density === "minimal" ? 800 : 5_000,
      theme: {
        background: "#0e0e10",
        foreground: "#d4d4d8",
        cursor: "#fafafa",
        black: "#0a0a0a",
        blue: "#60a5fa",
        cyan: "#00d9ff",
        green: "#79fa87",
        magenta: "#d946ef",
        red: "#ef4444",
        white: "#fafafa",
        yellow: "#ffb300",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);

    let disposed = false;
    void getSessionScrollback(session.id)
      .then((scrollback) => {
        if (disposed) return;
        if (scrollback) {
          terminal.write(scrollback);
        } else if (density !== "minimal") {
          terminal.writeln(`Marrow Session ${session.id} · ${session.runner}`);
          terminal.writeln(`cwd: ${session.workspacePath}`);
          if (session.issueFilePath) {
            terminal.writeln(`MARROW_ISSUE_FILE=${session.issueFilePath}`);
          }
          terminal.writeln("");
        }
      })
      .catch(() => undefined);

    const resize = () => {
      try {
        fit.fit();
        if (live) {
          void resizeSession(session.id, terminal.cols, terminal.rows).catch(() => undefined);
        }
      } catch {
        // xterm can throw while the pane is hidden or not yet measurable.
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const dataDisposable = terminal.onData((data) => {
      if (live && !readOnly) {
        void writeToSession(session.id, data)
          .then(() => onSessionChangedRef.current?.())
          .catch(() => undefined);
      }
    });

    let unlistenOutput: (() => void) | undefined;
    if (isTauriRuntime()) {
      void listen<SessionOutputEvent>("session-output", (event) => {
        if (event.payload.sessionId === session.id) {
          terminal.write(event.payload.data);
        }
      }).then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          unlistenOutput = unlisten;
        }
      });
    }

    return () => {
      disposed = true;
      unlistenOutput?.();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [
    density,
    live,
    readOnly,
    session.id,
    session.issueFilePath,
    session.runner,
    session.workspacePath,
  ]);

  const chrome = useMemo(() => {
    if (density === "bare") return null;
    return (
      <div className="terminal-chrome">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot status={session.status} />
            <span className="truncate text-[12px] font-medium text-[var(--fg1)]">
              {session.projectName} / {session.issueTitle}
            </span>
          </div>
          {density === "full" && (
            <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--fg3)]">
              {session.runner} · {session.runnerKind} · {session.workspacePath}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Mark Needs Input"
            aria-label="Mark Needs Input"
            onClick={() => runAction(() => setSessionStatus(session.id, "needs_input"))}
            disabled={session.status === "exited"}
          >
            <Bell />
          </Button>
          {density === "full" && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Mark Running"
              aria-label="Mark Running"
              onClick={() => runAction(() => setSessionStatus(session.id, "running"))}
              disabled={session.status === "exited"}
            >
              <Play />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Restart"
            aria-label="Restart"
            onClick={() => runAction(() => restartSession(session.id))}
          >
            <RotateCcw />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Resume"
            aria-label="Resume"
            onClick={() => runAction(() => resumeSession(session.id))}
            disabled={!session.resumeToken}
          >
            <SkipForward />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Kill Session"
            aria-label="Kill Session"
            onClick={() => runAction(() => killSession(session.id))}
            disabled={!live}
          >
            <Square />
          </Button>
        </div>
      </div>
    );
  }, [density, live, session, onSessionChanged]);

  async function runAction(action: () => Promise<unknown>) {
    setActionError(null);
    try {
      await action();
      onSessionChanged?.();
    } catch (err) {
      setActionError(String(err));
    }
  }

  return (
    <div
      className={cn(
        "terminal-frame",
        density === "minimal" && "terminal-frame-minimal",
        session.status === "needs_input" && "terminal-frame-attention",
        className,
      )}
    >
      {chrome}
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden p-2" />
      {actionError && density === "full" && (
        <div className="border-t border-[var(--hairline)] px-3 py-2 text-[12px] text-destructive">
          {actionError}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: SessionSummary["status"] }) {
  return (
    <span
      className={cn(
        "status-dot",
        status === "running" && "status-running",
        status === "idle" && "status-idle",
        status === "needs_input" && "status-needs-input",
        status === "exited" && "status-exited",
      )}
      aria-label={status.replace("_", " ")}
    />
  );
}
