import { FormEvent, useEffect, useMemo, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Circle,
  FolderPlus,
  Moon,
  Play,
  Plus,
  RefreshCw,
  Square,
  Sun,
} from "lucide-react";
import {
  createIssue,
  createProject,
  killSession,
  listIssues,
  listProjects,
  listSessions,
  openProjectDirectory,
  ping,
  startSession,
} from "@/api";
import { Button } from "@/components/ui/button";
import { TerminalPane } from "@/components/TerminalPane";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store";
import type { Issue, Project, SessionStatusEvent, SessionSummary, ViewMode } from "@/types";

const viewLabels: Record<ViewMode, string> = {
  board: "Board",
  cockpit: "Cockpit",
  feed: "Feed",
};

function App() {
  const queryClient = useQueryClient();
  const { dark, selectedProjectId, selectProject, toggleDark, view, setView } = useUiStore();

  const pingQuery = useQuery({ queryKey: ["ping"], queryFn: ping });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const issuesQuery = useQuery({
    queryKey: ["issues", selectedProjectId],
    queryFn: () => listIssues({ projectId: selectedProjectId }),
  });
  const allSessionsQuery = useQuery({
    queryKey: ["sessions", "all"],
    queryFn: () => listSessions({ projectId: null }),
  });
  const sessionsQuery = useQuery({
    queryKey: ["sessions", selectedProjectId],
    queryFn: () => listSessions({ projectId: selectedProjectId }),
  });

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void listen<SessionStatusEvent>("session-status", () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });
    return () => unlisten?.();
  }, [queryClient]);

  const projects = projectsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const allSessions = allSessionsQuery.data ?? [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  const sessionCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const session of allSessions) {
      if (session.status !== "exited") {
        counts.set(session.projectId, (counts.get(session.projectId) ?? 0) + 1);
      }
    }
    return counts;
  }, [allSessions]);

  return (
    <div className="flex h-svh min-w-0 bg-background text-foreground">
      <Sidebar
        projects={projects}
        selectedProjectId={selectedProjectId}
        sessionCounts={sessionCounts}
        loading={projectsQuery.isPending}
        onSelectProject={selectProject}
        onProjectCreated={(project) => {
          selectProject(project.id);
          setView("board");
          void queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4">
          <div className="flex min-w-0 items-center gap-2">
            {(Object.keys(viewLabels) as ViewMode[]).map((candidate) => (
              <Button
                key={candidate}
                variant={view === candidate ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(candidate)}
              >
                {viewLabels[candidate]}
              </Button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <code className="hidden max-w-80 truncate rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground md:block">
              {pingQuery.data ?? (pingQuery.isError ? "ping failed" : "pinging")}
            </code>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => pingQuery.refetch()}
              aria-label="Refresh ping"
              title="Refresh ping"
            >
              <RefreshCw />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleDark}
              aria-label={dark ? "Use light mode" : "Use dark mode"}
              title={dark ? "Use light mode" : "Use dark mode"}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
          </div>
        </header>

        {view === "board" && (
          <BoardView
            project={selectedProject}
            issues={issues}
            loading={issuesQuery.isPending}
            onIssueCreated={() => {
              void queryClient.invalidateQueries({ queryKey: ["issues"] });
            }}
            onStart={() => {
              setView("cockpit");
              void queryClient.invalidateQueries({ queryKey: ["sessions"] });
            }}
          />
        )}
        {view === "cockpit" && (
          <CockpitView
            sessions={sessions}
            loading={sessionsQuery.isPending}
            onKilled={() => {
              void queryClient.invalidateQueries({ queryKey: ["sessions"] });
            }}
          />
        )}
        {view === "feed" && <FeedView sessions={sessions} />}
      </main>
    </div>
  );
}

interface SidebarProps {
  projects: Project[];
  selectedProjectId: number | null;
  sessionCounts: Map<number, number>;
  loading: boolean;
  onSelectProject: (projectId: number | null) => void;
  onProjectCreated: (project: Project) => void;
}

function Sidebar({
  projects,
  selectedProjectId,
  sessionCounts,
  loading,
  onSelectProject,
  onProjectCreated,
}: SidebarProps) {
  return (
    <aside className="flex w-80 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center border-b px-4">
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold">Marrow Symphony</h1>
          <p className="truncate text-xs text-muted-foreground">Local Projects</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3">
        <AddProjectForm onCreated={onProjectCreated} />

        <div className="mt-4 space-y-1">
          <button
            type="button"
            onClick={() => onSelectProject(null)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
              selectedProjectId === null
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "hover:bg-sidebar-accent/70",
            )}
          >
            <span className="size-2.5 shrink-0 rounded-full bg-muted-foreground" />
            <span className="min-w-0 flex-1 font-medium">All Projects</span>
          </button>
          {loading && <div className="px-2 py-3 text-sm text-muted-foreground">Loading</div>}
          {!loading && projects.length === 0 && (
            <div className="px-2 py-3 text-sm text-muted-foreground">No Projects</div>
          )}
          {projects.map((project) => {
            const selected = selectedProjectId === project.id;
            const liveCount = sessionCounts.get(project.id) ?? 0;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onSelectProject(project.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
                  selected ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/70",
                )}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{project.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {project.gitBacked ? "git-backed" : "non-git"}
                  </span>
                </span>
                {liveCount > 0 && (
                  <span className="rounded-md bg-background px-1.5 py-0.5 text-xs">
                    {liveCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function AddProjectForm({ onCreated }: { onCreated: (project: Project) => void }) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      setPath("");
      setName("");
      setError(null);
      onCreated(project);
    },
    onError: (err) => setError(String(err)),
  });

  const chooseFolder = async () => {
    setError(null);
    const selected = await openProjectDirectory();
    if (!selected) return;
    setPath(selected);
    if (!name.trim()) {
      const segments = selected.split(/[\\/]/).filter(Boolean);
      setName(segments[segments.length - 1] ?? "");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ path, name: name.trim() || undefined });
  };

  return (
    <form className="space-y-2 rounded-md border bg-background p-3" onSubmit={submit}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium uppercase text-muted-foreground">Add Project</div>
        <Button type="button" size="icon-sm" variant="ghost" onClick={chooseFolder} title="Choose folder">
          <FolderPlus />
        </Button>
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-ring"
      />
      <input
        value={path}
        onChange={(event) => setPath(event.target.value)}
        placeholder="Folder path"
        className="h-8 w-full rounded-md border bg-background px-2 text-sm outline-none focus:border-ring"
      />
      {error && <div className="text-xs text-destructive">{error}</div>}
      <Button type="submit" className="w-full" disabled={!path.trim() || mutation.isPending}>
        <Plus />
        Add
      </Button>
    </form>
  );
}

interface BoardViewProps {
  project: Project | null;
  issues: Issue[];
  loading: boolean;
  onIssueCreated: () => void;
  onStart: () => void;
}

function BoardView({ project, issues, loading, onIssueCreated, onStart }: BoardViewProps) {
  return (
    <section className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{project?.name ?? "Board"}</h2>
          <p className="truncate text-sm text-muted-foreground">
            {project?.path ?? "Select a Project"}
          </p>
        </div>
      </div>

      {project ? (
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <AddIssueForm projectId={project.id} onCreated={onIssueCreated} />
          <div className="grid auto-rows-min gap-3 md:grid-cols-2 xl:grid-cols-3">
            {loading && <div className="text-sm text-muted-foreground">Loading</div>}
            {!loading && issues.length === 0 && (
              <div className="text-sm text-muted-foreground">No Issues</div>
            )}
            {issues.map((issue) => (
              <IssueCard key={issue.id} issue={issue} project={project} onStart={onStart} />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No Project selected</div>
      )}
    </section>
  );
}

function AddIssueForm({
  projectId,
  onCreated,
}: {
  projectId: number;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setError(null);
      onCreated();
    },
    onError: (err) => setError(String(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate({ projectId, title, description });
  };

  return (
    <form className="space-y-3 rounded-md border p-4" onSubmit={submit}>
      <div className="text-xs font-medium uppercase text-muted-foreground">Add Issue</div>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-ring"
      />
      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="Description"
        rows={8}
        className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
      />
      {error && <div className="text-sm text-destructive">{error}</div>}
      <Button type="submit" disabled={!title.trim() || mutation.isPending}>
        <Plus />
        Add Issue
      </Button>
    </form>
  );
}

function IssueCard({
  issue,
  project,
  onStart,
}: {
  issue: Issue;
  project: Project;
  onStart: () => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => startSession(issue.id),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      onStart();
    },
    onError: (err) => setError(String(err)),
  });

  return (
    <article className="flex min-h-40 flex-col rounded-md border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="size-2.5 rounded-full" style={{ backgroundColor: project.color }} />
        <span className="text-xs font-medium uppercase text-muted-foreground">
          {issue.stateType}
        </span>
      </div>
      <h3 className="line-clamp-2 font-medium">{issue.title}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
        {issue.description || "No description"}
      </p>
      {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
      <div className="mt-4 flex justify-end">
        <Button size="sm" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          <Play />
          Start
        </Button>
      </div>
    </article>
  );
}

function CockpitView({
  sessions,
  loading,
  onKilled,
}: {
  sessions: SessionSummary[];
  loading: boolean;
  onKilled: () => void;
}) {
  const grouped = useMemo(() => groupSessionsByProject(sessions), [sessions]);

  return (
    <section className="min-h-0 flex-1 overflow-auto p-5">
      <div className="mb-5">
        <h2 className="text-xl font-semibold">Cockpit</h2>
        <p className="text-sm text-muted-foreground">{sessions.length} Sessions</p>
      </div>
      {loading && <div className="text-sm text-muted-foreground">Loading</div>}
      {!loading && grouped.length === 0 && (
        <div className="text-sm text-muted-foreground">No Sessions</div>
      )}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.projectId}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-medium">{group.projectName}</h3>
              <span className="text-xs text-muted-foreground">{group.sessions.length}</span>
            </div>
            <div className="grid gap-4 xl:grid-cols-2">
              {group.sessions.map((session) => (
                <SessionTile key={session.id} session={session} onKilled={onKilled} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SessionTile({
  session,
  onKilled,
}: {
  session: SessionSummary;
  onKilled: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => killSession(session.id),
    onSuccess: () => {
      setError(null);
      onKilled();
    },
    onError: (err) => setError(String(err)),
  });

  const live = session.status !== "exited";

  return (
    <article
      className={cn(
        "min-w-0 rounded-md border bg-card p-3 text-card-foreground",
        session.status === "needs_input" && "border-amber-400",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusDot status={session.status} />
            <h4 className="truncate text-sm font-medium">{session.issueTitle}</h4>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {session.runner} · {session.workspacePath}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => mutation.mutate()}
          disabled={!live || mutation.isPending}
          title="Kill Session"
          aria-label="Kill Session"
        >
          <Square />
        </Button>
      </div>
      <div className="h-72 min-h-72">
        <TerminalPane session={session} />
      </div>
      {error && <div className="mt-2 text-xs text-destructive">{error}</div>}
      {session.exitCode !== null && (
        <div className="mt-2 text-xs text-muted-foreground">exit {session.exitCode}</div>
      )}
    </article>
  );
}

function FeedView({ sessions }: { sessions: SessionSummary[] }) {
  const next = sessions.find((session) => session.status === "needs_input");
  return (
    <section className="min-h-0 flex-1 p-5">
      <h2 className="mb-5 text-xl font-semibold">Feed</h2>
      {next ? (
        <div className="grid h-[calc(100svh-8rem)] gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <TerminalPane session={next} />
          <aside className="rounded-md border p-4">
            <div className="text-sm font-medium">{next.projectName}</div>
            <div className="mt-1 text-lg font-semibold">{next.issueTitle}</div>
            <div className="mt-3 text-sm text-muted-foreground">{next.issueFilePath}</div>
          </aside>
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">No Sessions need input</div>
      )}
    </section>
  );
}

function StatusDot({ status }: { status: SessionSummary["status"] }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Circle
        className={cn(
          "size-3 fill-current",
          status === "running" && "text-emerald-500",
          status === "idle" && "text-sky-500",
          status === "needs_input" && "text-amber-500",
          status === "exited" && "text-muted-foreground",
        )}
      />
      {status.replace("_", " ")}
    </span>
  );
}

function groupSessionsByProject(sessions: SessionSummary[]) {
  const groups = new Map<
    number,
    { projectId: number; projectName: string; sessions: SessionSummary[] }
  >();
  for (const session of sessions) {
    const group = groups.get(session.projectId) ?? {
      projectId: session.projectId,
      projectName: session.projectName,
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(session.projectId, group);
  }
  return Array.from(groups.values());
}

export default App;
