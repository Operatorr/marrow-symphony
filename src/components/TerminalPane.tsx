import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { listen } from "@tauri-apps/api/event";
import "@xterm/xterm/css/xterm.css";
import { resizeSession, writeToSession } from "@/api";
import type { SessionOutputEvent, SessionSummary } from "@/types";

interface TerminalPaneProps {
  session: SessionSummary;
}

export function TerminalPane({ session }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.15,
      scrollback: 5_000,
      theme: {
        background: "#0f1419",
        foreground: "#d8dee9",
        cursor: "#f8fafc",
        black: "#0f1419",
        blue: "#60a5fa",
        cyan: "#22d3ee",
        green: "#34d399",
        magenta: "#c084fc",
        red: "#f87171",
        white: "#f8fafc",
        yellow: "#fbbf24",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.writeln(`Marrow Session ${session.id} · ${session.runner}`);
    terminal.writeln(`cwd: ${session.workspacePath}`);
    if (session.issueFilePath) {
      terminal.writeln(`MARROW_ISSUE_FILE=${session.issueFilePath}`);
    }
    terminal.writeln("");

    const live = session.status !== "exited";
    const resize = () => {
      try {
        fit.fit();
        if (live) {
          void resizeSession(session.id, terminal.cols, terminal.rows).catch(() => undefined);
        }
      } catch {
        // xterm throws when fit runs before layout is measurable.
      }
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const dataDisposable = terminal.onData((data) => {
      if (live) {
        void writeToSession(session.id, data).catch(() => undefined);
      }
    });

    let unlistenOutput: (() => void) | undefined;
    let disposed = false;
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

    return () => {
      disposed = true;
      unlistenOutput?.();
      dataDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [session.id, session.issueFilePath, session.runner, session.status, session.workspacePath]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-56 overflow-hidden rounded-md border border-slate-800 bg-[#0f1419] p-2"
    />
  );
}
