import { FormEvent, useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  FolderGit2,
  FolderPlus,
  Gauge,
  GitBranch,
  Inbox,
  Layers3,
  Maximize2,
  MessageSquare,
  Moon,
  PanelLeft,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Square,
  Sun,
  X,
} from "lucide-react";
import {
  createIssue,
  createProject,
  createRunner,
  deleteRunner,
  isTauriRuntime,
  killSession,
  listBoardColumns,
  listGroups,
  listIssueComments,
  listIssues,
  listProjects,
  listRunners,
  listSessions,
  openProjectDirectory,
  ping,
  setSessionStatus,
  snoozeSession,
  startSession,
  transitionIssue,
  updateIssue,
  updateRunner,
  workspaceDiff,
} from "@/api";
import { Button } from "@/components/ui/button";
import { TerminalPane } from "@/components/TerminalPane";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store";
import type {
  BoardColumn,
  Group,
  Issue,
  Project,
  Runner,
  SessionStatusEvent,
  SessionSummary,
  StateType,
  ViewMode,
} from "@/types";

const viewLabels: Record<ViewMode, string> = {
  board: "Board",
  cockpit: "Cockpit",
  feed: "Feed",
};

const canonicalColumns: Array<{ label: string; stateType: StateType }> = [
  { label: "Backlog", stateType: "backlog" },
  { label: "Todo", stateType: "todo" },
  { label: "Started", stateType: "started" },
  { label: "In Review", stateType: "in-review" },
  { label: "Done", stateType: "done" },
  { label: "Canceled", stateType: "canceled" },
];

function App() {
  const queryClient = useQueryClient();
  const {
    dark,
    reduceMotion,
    sidebarOpen,
    selectedProjectId,
    boardScope,
    openedIssueId,
    focusedSessionId,
    view,
    toggleDark,
    toggleReduceMotion,
    toggleSidebar,
    selectProject,
    setBoardScope,
    openIssue,
    focusSession,
    setView,
  } = useUiStore();
  const [projectSearch, setProjectSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<number | "all">("all");
  const [runnerPanelOpen, setRunnerPanelOpen] = useState(false);

  const pingQuery = useQuery({ queryKey: ["ping"], queryFn: ping });
  const projectsQuery = useQuery({ queryKey: ["projects"], queryFn: listProjects });
  const groupsQuery = useQuery({ queryKey: ["groups"], queryFn: listGroups });
  const issuesQuery = useQuery({
    queryKey: ["issues", boardScope, selectedProjectId],
    queryFn: () =>
      listIssues({
        projectId: boardScope === "project" ? selectedProjectId : null,
      }),
  });
  const allIssuesQuery = useQuery({
    queryKey: ["issues", "all"],
    queryFn: () => listIssues({ projectId: null }),
  });
  const allSessionsQuery = useQuery({
    queryKey: ["sessions", "all"],
    queryFn: () => listSessions({ projectId: null }),
  });
  const boardColumnsQuery = useQuery({
    queryKey: ["board-columns", selectedProjectId],
    queryFn: () => listBoardColumns(selectedProjectId as number),
    enabled: boardScope === "project" && selectedProjectId !== null,
  });
  const runnersQuery = useQuery({ queryKey: ["runners"], queryFn: listRunners });

  useEffect(() => {
    if (!isTauriRuntime()) return undefined;
    let unlisten: (() => void) | undefined;
    void listen<SessionStatusEvent>("session-status", () => {
      void queryClient.invalidateQueries({ queryKey: ["sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["issues"] });
    }).then((nextUnlisten) => {
      unlisten = nextUnlisten;
    });
    return () => unlisten?.();
  }, [queryClient]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const projects = projectsQuery.data ?? [];
  const groups = groupsQuery.data ?? [];
  const issues = issuesQuery.data ?? [];
  const allIssues = allIssuesQuery.data ?? [];
  const allSessions = allSessionsQuery.data ?? [];
  const runners = runnersQuery.data ?? [];
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? null;
  const scopedSessions =
    selectedProjectId === null
      ? allSessions
      : allSessions.filter((session) => session.projectId === selectedProjectId);

  const activeNeeds = useMemo(
    () => allSessions.filter((session) => sessionNeedsInput(session)),
    [allSessions],
  );
  const projectStats = useMemo(() => buildProjectStats(allSessions), [allSessions]);

  const invalidateWork = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["issues"] });
    void queryClient.invalidateQueries({ queryKey: ["sessions"] });
    void queryClient.invalidateQueries({ queryKey: ["board-columns"] });
  }, [queryClient]);

  return (
    <div className="app-shell">
      <Shader disabled={reduceMotion} />
      <TopBar
        dark={dark}
        reduceMotion={reduceMotion}
        sidebarOpen={sidebarOpen}
        view={view}
        needsCount={activeNeeds.length}
        pingText={pingQuery.data ?? (pingQuery.isError ? "ping failed" : "pinging")}
        runnerPanelOpen={runnerPanelOpen}
        onToggleDark={toggleDark}
        onToggleReduceMotion={toggleReduceMotion}
        onToggleSidebar={toggleSidebar}
        onSetView={(nextView) => {
          setView(nextView);
          if (nextView !== "board") openIssue(null);
        }}
        onRefresh={() => {
          void pingQuery.refetch();
          invalidateWork();
        }}
        onToggleRunnerPanel={() => setRunnerPanelOpen((value) => !value)}
      />

      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            projects={projects}
            groups={groups}
            selectedProjectId={selectedProjectId}
            groupFilter={groupFilter}
            search={projectSearch}
            stats={projectStats}
            loading={projectsQuery.isPending}
            onGroupFilter={setGroupFilter}
            onSearch={setProjectSearch}
            onSelectProject={(projectId) => {
              selectProject(projectId);
              setView("board");
            }}
            onProjectCreated={(project) => {
              selectProject(project.id);
              setView("board");
              invalidateWork();
            }}
          />
        )}

        <main className="main-surface">
          {runnerPanelOpen && (
            <RunnerPanel
              runners={runners}
              projects={projects}
              loading={runnersQuery.isPending}
              onChanged={() => {
                void queryClient.invalidateQueries({ queryKey: ["runners"] });
                invalidateWork();
              }}
              onClose={() => setRunnerPanelOpen(false)}
            />
          )}

          {view === "board" && openedIssueId !== null ? (
            <IssuePage
              issue={allIssues.find((issue) => issue.id === openedIssueId) ?? null}
              project={projects.find(
                (project) =>
                  project.id ===
                  (allIssues.find((issue) => issue.id === openedIssueId)?.projectId ?? -1),
              )}
              sessions={allSessions.filter((session) => session.issueId === openedIssueId)}
              runners={runners}
              onBack={() => openIssue(null)}
              onChanged={invalidateWork}
            />
          ) : null}

          {view === "board" && openedIssueId === null && (
            <BoardView
              projects={projects}
              selectedProject={selectedProject}
              scope={boardScope}
              columns={
                boardScope === "project" && selectedProjectId !== null
                  ? normalizeColumns(boardColumnsQuery.data)
                  : canonicalColumns
              }
              issues={issues}
              allSessions={allSessions}
              loading={
                issuesQuery.isPending ||
                (boardScope === "project" &&
                  selectedProjectId !== null &&
                  boardColumnsQuery.isPending)
              }
              onScopeChange={setBoardScope}
              onIssueCreated={invalidateWork}
              onIssueOpen={(issueId) => openIssue(issueId)}
              onTransitioned={invalidateWork}
            />
          )}

          {view === "cockpit" && (
            <CockpitView
              sessions={scopedSessions}
              focusedSessionId={focusedSessionId}
              loading={allSessionsQuery.isPending}
              onFocusSession={focusSession}
              onOpenFeed={(sessionId) => {
                focusSession(sessionId);
                setView("feed");
              }}
              onChanged={invalidateWork}
            />
          )}

          {view === "feed" && (
            <FeedView
              sessions={scopedSessions}
              issues={allIssues}
              focusedSessionId={focusedSessionId}
              onFocusSession={focusSession}
              onOpenCockpit={(sessionId) => {
                focusSession(sessionId);
                setView("cockpit");
              }}
              onChanged={invalidateWork}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function TopBar({
  dark,
  reduceMotion,
  sidebarOpen,
  view,
  needsCount,
  pingText,
  runnerPanelOpen,
  onToggleDark,
  onToggleReduceMotion,
  onToggleSidebar,
  onSetView,
  onRefresh,
  onToggleRunnerPanel,
}: {
  dark: boolean;
  reduceMotion: boolean;
  sidebarOpen: boolean;
  view: ViewMode;
  needsCount: number;
  pingText: string;
  runnerPanelOpen: boolean;
  onToggleDark: () => void;
  onToggleReduceMotion: () => void;
  onToggleSidebar: () => void;
  onSetView: (view: ViewMode) => void;
  onRefresh: () => void;
  onToggleRunnerPanel: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-cluster min-w-0 flex-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar"
          className={cn(!sidebarOpen && "bg-muted")}
        >
          <PanelLeft />
        </Button>
        <div className="topbar-divider" />
        <Logo />
        <div className="truncate text-[13px] font-semibold text-[var(--fg1)]">
          Marrow Symphony
        </div>
      </div>

      <div className="view-switch" role="tablist" aria-label="View">
        {(Object.keys(viewLabels) as ViewMode[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            className={cn("view-switch-button", view === candidate && "active")}
            onClick={() => onSetView(candidate)}
          >
            {viewLabels[candidate]}
            {candidate === "feed" && needsCount > 0 && view !== "feed" && <AttentionPip />}
          </button>
        ))}
      </div>

      <div className="topbar-cluster min-w-0 flex-1 justify-end">
        {needsCount > 0 && (
          <span className="needs-pill">
            <AttentionPip />
            {needsCount} need input
          </span>
        )}
        <div className="topbar-search hidden lg:flex">
          <Search className="size-3.5" />
          <span className="truncate">Search</span>
          <Kbd>⌘F</Kbd>
        </div>
        <code className="hidden max-w-44 truncate font-mono text-[11px] text-[var(--fg4)] xl:block">
          {pingText}
        </code>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh" title="Refresh">
          <RefreshCw />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleReduceMotion}
          aria-label="Toggle motion"
          title={reduceMotion ? "Enable shader" : "Disable shader"}
        >
          <Sparkles className={cn(reduceMotion && "opacity-40")} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleRunnerPanel}
          aria-label="Runner settings"
          title="Runner settings"
          className={cn(runnerPanelOpen && "bg-muted")}
        >
          <Settings />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleDark}
          aria-label={dark ? "Use light mode" : "Use dark mode"}
          title={dark ? "Use light mode" : "Use dark mode"}
        >
          {dark ? <Sun /> : <Moon />}
        </Button>
        <span className="linear-badge">Linear</span>
      </div>
    </header>
  );
}

function Sidebar({
  projects,
  groups,
  selectedProjectId,
  groupFilter,
  search,
  stats,
  loading,
  onGroupFilter,
  onSearch,
  onSelectProject,
  onProjectCreated,
}: {
  projects: Project[];
  groups: Group[];
  selectedProjectId: number | null;
  groupFilter: number | "all";
  search: string;
  stats: Map<number, { live: number; needs: number }>;
  loading: boolean;
  onGroupFilter: (groupId: number | "all") => void;
  onSearch: (value: string) => void;
  onSelectProject: (projectId: number | null) => void;
  onProjectCreated: (project: Project) => void;
}) {
  const filtered = projects.filter((project) => {
    const matchesGroup = groupFilter === "all" || project.groupId === groupFilter;
    const matchesSearch =
      search.trim().length === 0 ||
      project.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesGroup && matchesSearch;
  });

  return (
    <aside className="sidebar">
      <div className="space-y-3 p-3">
        <select
          value={groupFilter}
          onChange={(event) =>
            onGroupFilter(event.target.value === "all" ? "all" : Number(event.target.value))
          }
          className="field h-8"
        >
          <option value="all">All Groups</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <label className="search-field">
          <Search className="size-3.5" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Projects"
          />
        </label>
        <AddProjectForm groups={groups} onCreated={onProjectCreated} />
      </div>

      <div className="sidebar-list">
        <button
          type="button"
          onClick={() => onSelectProject(null)}
          className={cn("project-row", selectedProjectId === null && "selected")}
        >
          <span className="project-chip neutral">A</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">All Projects</span>
            <span className="block truncate text-[11px] text-[var(--fg4)]">global scope</span>
          </span>
          <Layers3 className="size-3.5 text-[var(--fg4)]" />
        </button>

        {loading && <div className="px-2 py-3 text-[12px] text-[var(--fg3)]">Loading</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty-panel mx-1 my-2">No Projects</div>
        )}
        {filtered.map((project) => {
          const selected = selectedProjectId === project.id;
          const counts = stats.get(project.id) ?? { live: 0, needs: 0 };
          return (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={cn("project-row", selected && "selected", counts.needs > 0 && "attention")}
            >
              <ProjectChip project={project} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{project.name}</span>
                <span className="block truncate text-[11px] text-[var(--fg4)]">
                  {project.groupName ?? "Ungrouped"} · {project.gitBacked ? "git" : "non-git"}
                </span>
              </span>
              <span className="flex items-center gap-1">
                {!project.gitBacked && <AlertCircle className="size-3.5 text-[var(--status-exited)]" />}
                {counts.live > 0 && <span className="count-pill">{counts.live}</span>}
                {counts.needs > 0 && <AttentionPip />}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function AddProjectForm({
  groups,
  onCreated,
}: {
  groups: Group[];
  onCreated: (project: Project) => void;
}) {
  const [path, setPath] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState<number | "none" | "new">("none");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      setPath("");
      setName("");
      setGroupName("");
      setGroupId("none");
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
    mutation.mutate({
      path,
      name: name.trim() || undefined,
      groupId: typeof groupId === "number" ? groupId : null,
      groupName: groupId === "new" ? groupName : null,
    });
  };

  return (
    <form className="tool-panel space-y-2" onSubmit={submit}>
      <div className="flex items-center justify-between gap-2">
        <div className="label-caps">Add Project</div>
        <Button type="button" size="icon-xs" variant="ghost" onClick={chooseFolder} title="Choose folder">
          <FolderPlus />
        </Button>
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Name"
        className="field"
      />
      <input
        value={path}
        onChange={(event) => setPath(event.target.value)}
        placeholder="Folder path"
        className="field"
      />
      <select
        value={groupId}
        onChange={(event) =>
          setGroupId(
            event.target.value === "none"
              ? "none"
              : event.target.value === "new"
                ? "new"
                : Number(event.target.value),
          )
        }
        className="field"
      >
        <option value="none">No Group</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
        <option value="new">New Group</option>
      </select>
      {groupId === "new" && (
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Group name"
          className="field"
        />
      )}
      {error && <div className="text-[12px] text-destructive">{error}</div>}
      <Button type="submit" className="w-full" disabled={!path.trim() || mutation.isPending}>
        <Plus />
        Add
      </Button>
    </form>
  );
}

function BoardView({
  projects,
  selectedProject,
  scope,
  columns,
  issues,
  allSessions,
  loading,
  onScopeChange,
  onIssueCreated,
  onIssueOpen,
  onTransitioned,
}: {
  projects: Project[];
  selectedProject: Project | null;
  scope: "project" | "global";
  columns: Array<{ label: string; stateType: StateType }>;
  issues: Issue[];
  allSessions: SessionSummary[];
  loading: boolean;
  onScopeChange: (scope: "project" | "global") => void;
  onIssueCreated: () => void;
  onIssueOpen: (issueId: number) => void;
  onTransitioned: () => void;
}) {
  const [dragIssueId, setDragIssueId] = useState<number | null>(null);
  const sessionsByIssue = useMemo(() => latestSessionsByIssue(allSessions), [allSessions]);

  const transitionMutation = useMutation({
    mutationFn: transitionIssue,
    onSuccess: onTransitioned,
  });

  const handleDrop = (stateType: StateType) => {
    if (dragIssueId === null) return;
    const issue = issues.find((candidate) => candidate.id === dragIssueId);
    const liveSessions = allSessions.filter(
      (session) => session.issueId === dragIssueId && session.status !== "exited",
    );
    const cleanupLiveSessions =
      issue &&
      (stateType === "done" || stateType === "canceled") &&
      liveSessions.length > 0 &&
      window.confirm(`Kill ${liveSessions.length} live Session(s) for this Issue?`);
    transitionMutation.mutate({
      issueId: dragIssueId,
      stateType,
      cleanupLiveSessions: cleanupLiveSessions || false,
    });
    setDragIssueId(null);
  };

  return (
    <section className="view-surface">
      <div className="surface-header">
        <div className="min-w-0">
          <div className="label-caps">Board</div>
          <h2>{scope === "project" ? selectedProject?.name ?? "This Project" : "All Projects"}</h2>
          <p>{scope === "project" ? selectedProject?.path ?? "Select a Project" : "Global State Type board"}</p>
        </div>
        <div className="segmented">
          <button
            type="button"
            className={cn(scope === "project" && "active")}
            onClick={() => onScopeChange("project")}
            disabled={!selectedProject}
          >
            This Project
          </button>
          <button
            type="button"
            className={cn(scope === "global" && "active")}
            onClick={() => onScopeChange("global")}
          >
            All Projects
          </button>
        </div>
      </div>

      <div className="mb-4">
        <AddIssueForm
          projects={projects}
          projectId={scope === "project" ? selectedProject?.id ?? null : null}
          onCreated={onIssueCreated}
        />
      </div>

      {loading && <div className="empty-panel">Loading Board</div>}
      {!loading && issues.length === 0 && <div className="empty-panel">No Issues</div>}
      <div className="board-grid">
        {columns.map((column) => {
          const columnIssues = issues.filter((issue) => issue.stateType === column.stateType);
          return (
            <section
              key={column.stateType}
              className={cn("board-column", column.stateType === "started" && "started")}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(column.stateType)}
            >
              <div className="board-column-header">
                <span>{column.label}</span>
                <span>{columnIssues.length}</span>
              </div>
              <div className="space-y-2">
                {columnIssues.map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    session={sessionsByIssue.get(issue.id)}
                    draggable
                    onDragStart={() => setDragIssueId(issue.id)}
                    onOpen={() => onIssueOpen(issue.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
      {transitionMutation.isError && (
        <div className="mt-3 text-[12px] text-destructive">{String(transitionMutation.error)}</div>
      )}
    </section>
  );
}

function AddIssueForm({
  projects,
  projectId,
  onCreated,
}: {
  projects: Project[];
  projectId: number | null;
  onCreated: () => void;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | "">(
    projectId ?? projects[0]?.id ?? "",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectId !== null) setSelectedProjectId(projectId);
  }, [projectId]);

  const mutation = useMutation({
    mutationFn: createIssue,
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setOpen(false);
      setError(null);
      onCreated();
    },
    onError: (err) => setError(String(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedProjectId) return;
    mutation.mutate({ projectId: Number(selectedProjectId), title, description });
  };

  return (
    <div className="tool-panel">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="label-caps">Add Issue</span>
        {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
      </button>
      {open && (
        <form className="mt-3 grid gap-2 md:grid-cols-[180px_minmax(0,1fr)_minmax(0,1.4fr)_auto]" onSubmit={submit}>
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(Number(event.target.value))}
            className="field"
            disabled={projectId !== null}
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
            className="field"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Task"
            className="field"
          />
          <Button type="submit" disabled={!title.trim() || !selectedProjectId || mutation.isPending}>
            <Plus />
            Add
          </Button>
          {error && <div className="text-[12px] text-destructive md:col-span-4">{error}</div>}
        </form>
      )}
    </div>
  );
}

function IssueCard({
  issue,
  session,
  draggable = false,
  onDragStart,
  onOpen,
}: {
  issue: Issue;
  session?: SessionSummary;
  draggable?: boolean;
  onDragStart?: () => void;
  onOpen: () => void;
}) {
  const needs = session?.status === "needs_input";
  return (
    <article
      draggable={draggable}
      onDragStart={onDragStart}
      className={cn("issue-card", needs && "needs")}
      style={projectStyle(issue.projectColorIndex, issue.projectColor)}
    >
      <button type="button" className="block w-full text-left" onClick={onOpen}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="project-badge">
            <span className="project-dot" />
            {issue.projectName}
          </span>
          <span className="font-mono text-[10.5px] text-[var(--fg4)]">#{issue.id}</span>
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.description || "No description"}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="runner-chip">{issue.runnerOverride ?? "default"}</span>
          {session ? <SessionStatusPill status={session.status} /> : <span className="state-chip">{issue.stateType}</span>}
        </div>
      </button>
    </article>
  );
}

function CockpitView({
  sessions,
  focusedSessionId,
  loading,
  onFocusSession,
  onOpenFeed,
  onChanged,
}: {
  sessions: SessionSummary[];
  focusedSessionId: number | null;
  loading: boolean;
  onFocusSession: (sessionId: number | null) => void;
  onOpenFeed: (sessionId: number) => void;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<SessionSummary["status"] | "all">("all");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const liveSessions = sessions.filter((session) => session.status !== "exited");
  const filtered =
    statusFilter === "all"
      ? liveSessions
      : liveSessions.filter((session) => session.status === statusFilter);
  const groups = useMemo(() => groupSessionsByProject(filtered), [filtered]);

  return (
    <section className="view-surface">
      <div className="surface-header">
        <div>
          <div className="label-caps">Cockpit</div>
          <h2>Session fleet</h2>
          <p>{liveSessions.length} live Sessions</p>
        </div>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as SessionSummary["status"] | "all")}
          className="field w-40"
        >
          <option value="all">All statuses</option>
          <option value="needs_input">Needs Input</option>
          <option value="running">Running</option>
          <option value="idle">Idle</option>
          <option value="exited">Exited</option>
        </select>
      </div>

      {loading && <div className="empty-panel">Loading Sessions</div>}
      {!loading && liveSessions.length === 0 && <div className="empty-panel">Nothing running</div>}

      <div className="space-y-5">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.projectId);
          const attention = group.sessions.filter((session) => session.status === "needs_input").length;
          return (
            <section key={group.projectId} className="fleet-group">
              <button
                type="button"
                className="fleet-group-header"
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(group.projectId)) next.delete(group.projectId);
                    else next.add(group.projectId);
                    return next;
                  })
                }
              >
                <span>{group.projectName}</span>
                <span className="flex items-center gap-2">
                  {group.sessions.length} live
                  {attention > 0 && <span className="needs-pill small">{attention} need input</span>}
                  {isCollapsed ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
                </span>
              </button>
              {!isCollapsed && (
                <div className="cockpit-grid">
                  {sortSessions(group.sessions).map((session) => {
                    const expanded = focusedSessionId === session.id;
                    return (
                      <article
                        key={session.id}
                        className={cn("session-tile", session.status === "needs_input" && "attention", expanded && "expanded")}
                        style={projectStyle(session.projectColorIndex, session.projectColor)}
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            className="min-w-0 text-left"
                            onClick={() => onFocusSession(expanded ? null : session.id)}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <StatusDot status={session.status} />
                              <h3 className="truncate text-[13px] font-medium">{session.issueTitle}</h3>
                            </div>
                            <div className="truncate font-mono text-[11px] text-[var(--fg4)]">
                              {session.runner} · {elapsedLabel(session.startedAt)}
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Open in Feed"
                              aria-label="Open in Feed"
                              onClick={() => onOpenFeed(session.id)}
                            >
                              <Maximize2 />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              title="Kill"
                              aria-label="Kill"
                              onClick={() => void killSession(session.id).then(onChanged)}
                            >
                              <Square />
                            </Button>
                          </div>
                        </div>
                        <div className={cn("tile-terminal", expanded && "expanded")}>
                          <TerminalPane
                            session={session}
                            density={expanded ? "full" : "minimal"}
                            readOnly={!expanded}
                            onSessionChanged={onChanged}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function FeedView({
  sessions,
  issues,
  focusedSessionId,
  onFocusSession,
  onOpenCockpit,
  onChanged,
}: {
  sessions: SessionSummary[];
  issues: Issue[];
  focusedSessionId: number | null;
  onFocusSession: (sessionId: number | null) => void;
  onOpenCockpit: (sessionId: number) => void;
  onChanged: () => void;
}) {
  const queue = sortSessions(sessions.filter(sessionNeedsInput));
  const focused = queue.find((session) => session.id === focusedSessionId);
  const [cursor, setCursor] = useState(0);
  const session = focused ?? queue[Math.min(cursor, Math.max(queue.length - 1, 0))] ?? null;
  const issue = session ? issues.find((candidate) => candidate.id === session.issueId) ?? null : null;
  const diffQuery = useQuery({
    queryKey: ["workspace-diff", session?.id],
    queryFn: () => workspaceDiff({ sessionId: session?.id }),
    enabled: Boolean(session),
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setCursor((value) => Math.min(queue.length - 1, value + 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setCursor((value) => Math.max(0, value - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queue.length]);

  useEffect(() => {
    if (focusedSessionId !== null && !queue.some((candidate) => candidate.id === focusedSessionId)) {
      onFocusSession(null);
    }
  }, [focusedSessionId, onFocusSession, queue]);

  if (!session) {
    return (
      <section className="feed-empty">
        <Shader disabled={false} subtle />
        <div className="empty-hero">
          <Inbox className="size-10" />
          <h2>Inbox zero</h2>
          <p>No Session needs input.</p>
        </div>
      </section>
    );
  }

  const advance = () => {
    onFocusSession(null);
    setCursor((value) => Math.min(Math.max(queue.length - 2, 0), value));
    onChanged();
  };

  return (
    <section className="feed-surface">
      <div className="feed-header">
        <div className="min-w-0">
          <div className="label-caps">Feed</div>
          <h2 className="truncate">
            {session.projectName} / {session.issueTitle}
          </h2>
          <p>
            {session.runner} · waiting {waitingLabel(session.needsInputSince ?? session.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SessionStatusPill status={session.status} />
          <span className="count-pill">{queue.length} waiting</span>
        </div>
      </div>

      <div className="feed-layout">
        <div className="feed-terminal">
          <TerminalPane session={session} density="full" onSessionChanged={advance} />
        </div>
        <aside className="feed-context">
          <section>
            <div className="label-caps">Task</div>
            <h3>{issue?.title ?? session.issueTitle}</h3>
            <p>{issue?.description || "No description"}</p>
          </section>
          <section>
            <div className="label-caps">Workspace</div>
            <div className="context-row">
              <GitBranch className="size-3.5" />
              {diffQuery.data?.branch ?? "unknown"}
            </div>
            <div className="context-row">
              <Code2 className="size-3.5" />
              {session.workspacePath}
            </div>
          </section>
          <section>
            <div className="label-caps">Diff</div>
            <pre className="diff-block">{diffQuery.data?.summary ?? "Loading diff"}</pre>
            {diffQuery.data && (
              <div className="mt-2 flex gap-2 font-mono text-[11px]">
                <span>{diffQuery.data.changedFiles} files</span>
                <span className="text-[var(--status-running)]">+{diffQuery.data.insertions}</span>
                <span className="text-[var(--status-exited)]">-{diffQuery.data.deletions}</span>
              </div>
            )}
          </section>
          <div className="feed-actions">
            <Button variant="outline" onClick={() => setCursor((value) => Math.min(queue.length - 1, value + 1))}>
              <ChevronDown />
              Skip
            </Button>
            <Button
              variant="outline"
              onClick={() => void snoozeSession(session.id).then(advance)}
            >
              <Clock />
              Snooze
            </Button>
            <Button variant="outline" onClick={() => onOpenCockpit(session.id)}>
              <Gauge />
              Cockpit
            </Button>
            <Button onClick={() => void setSessionStatus(session.id, "idle").then(advance)}>
              <Check />
              Done
            </Button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function IssuePage({
  issue,
  project,
  sessions,
  runners,
  onBack,
  onChanged,
}: {
  issue: Issue | null;
  project?: Project;
  sessions: SessionSummary[];
  runners: Runner[];
  onBack: () => void;
  onChanged: () => void;
}) {
  const [activeSessionId, setActiveSessionId] = useState<number | null>(sessions[0]?.id ?? null);
  const [title, setTitle] = useState(issue?.title ?? "");
  const [description, setDescription] = useState(issue?.description ?? "");
  const [stateType, setStateType] = useState<StateType>(issue?.stateType ?? "todo");
  const [runnerOverrideId, setRunnerOverrideId] = useState<number | "default">(
    issue?.runnerOverrideId ?? "default",
  );
  const [workspaceStrategy, setWorkspaceStrategy] = useState(issue?.workspaceStrategy ?? "shared_checkout");

  useEffect(() => {
    setActiveSessionId((current) => current ?? sessions[0]?.id ?? null);
  }, [sessions]);

  useEffect(() => {
    if (!issue) return;
    setTitle(issue.title);
    setDescription(issue.description);
    setStateType(issue.stateType);
    setRunnerOverrideId(issue.runnerOverrideId ?? "default");
    setWorkspaceStrategy(issue.workspaceStrategy);
  }, [issue]);

  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null;
  const diffQuery = useQuery({
    queryKey: ["workspace-diff", "issue", issue?.id, activeSession?.id],
    queryFn: () =>
      workspaceDiff(activeSession ? { sessionId: activeSession.id } : { issueId: issue?.id }),
    enabled: Boolean(issue),
  });
  const commentsQuery = useQuery({
    queryKey: ["issue-comments", issue?.id],
    queryFn: () => listIssueComments(issue?.id as number),
    enabled: Boolean(issue),
  });

  const saveMutation = useMutation({
    mutationFn: updateIssue,
    onSuccess: onChanged,
  });
  const startMutation = useMutation({
    mutationFn: () => startSession(issue?.id as number),
    onSuccess: onChanged,
  });

  if (!issue) {
    return (
      <section className="view-surface">
        <div className="empty-panel">Issue not found</div>
      </section>
    );
  }

  const liveSessions = sessions.filter((session) => session.status !== "exited");
  const gitBacked = project?.gitBacked ?? true;

  return (
    <section className="issue-page">
      <div className="issue-header">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronDown className="rotate-90" />
          Board
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <ProjectChip projectLike={issue} />
            <h2 className="truncate">{issue.title}</h2>
          </div>
          <p>{issue.projectName} · {stateType}</p>
        </div>
        <Button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          <Play />
          Start
        </Button>
        <Button
          variant="outline"
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          <Plus />
          New Session
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            for (const session of liveSessions) void killSession(session.id).then(onChanged);
          }}
          disabled={liveSessions.length === 0}
        >
          <Square />
          Stop
        </Button>
      </div>

      <div className="issue-layout">
        <main className="issue-main">
          {sessions.length > 0 ? (
            <>
              <div className="session-tabs">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    className={cn(activeSession?.id === session.id && "active")}
                    onClick={() => setActiveSessionId(session.id)}
                  >
                    <StatusDot status={session.status} />
                    #{session.id}
                  </button>
                ))}
              </div>
              {activeSession && (
                <TerminalPane session={activeSession} density="full" onSessionChanged={onChanged} />
              )}
            </>
          ) : (
            <div className="empty-panel grow">
              <Play className="mx-auto mb-3 size-7" />
              Not started
            </div>
          )}
        </main>

        <aside className="issue-rail">
          <section className="tool-panel space-y-2">
            <div className="label-caps">Task</div>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="field" />
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="field min-h-32 resize-y py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={stateType}
                onChange={(event) => setStateType(event.target.value as StateType)}
                className="field"
              >
                {canonicalColumns.map((column) => (
                  <option key={column.stateType} value={column.stateType}>
                    {column.label}
                  </option>
                ))}
              </select>
              <select
                value={runnerOverrideId}
                onChange={(event) =>
                  setRunnerOverrideId(event.target.value === "default" ? "default" : Number(event.target.value))
                }
                className="field"
              >
                <option value="default">Default Runner</option>
                {runners.map((runner) => (
                  <option key={runner.id} value={runner.id}>
                    {runner.name}
                  </option>
                ))}
              </select>
            </div>
            <select
              value={workspaceStrategy}
              onChange={(event) => setWorkspaceStrategy(event.target.value)}
              className="field"
            >
              <option value="shared_checkout">Shared checkout</option>
              <option value="worktree" disabled={!gitBacked}>
                Worktree
              </option>
              <option value="branch_in_place" disabled={!gitBacked}>
                Branch in place
              </option>
            </select>
            {!gitBacked && <div className="degraded-note">Git-only Workspace Strategy options are unavailable.</div>}
            <Button
              onClick={() =>
                saveMutation.mutate({
                  issueId: issue.id,
                  title,
                  description,
                  stateType,
                  runnerOverrideId: runnerOverrideId === "default" ? null : runnerOverrideId,
                  workspaceStrategy,
                })
              }
              disabled={saveMutation.isPending}
            >
              <Check />
              Save
            </Button>
            {saveMutation.isError && <div className="text-[12px] text-destructive">{String(saveMutation.error)}</div>}
          </section>

          <section className="tool-panel space-y-2">
            <div className="label-caps">Workspace</div>
            <div className="context-row">
              <FolderGit2 className="size-3.5" />
              {project?.path ?? issue.projectName}
            </div>
            <div className="context-row">
              <GitBranch className="size-3.5" />
              {diffQuery.data?.branch ?? "unknown"}
            </div>
          </section>

          <section className="tool-panel space-y-2">
            <div className="label-caps">Diff</div>
            <pre className="diff-block">{diffQuery.data?.summary ?? "Loading diff"}</pre>
          </section>

          <section className="tool-panel space-y-2">
            <div className="label-caps">Comments</div>
            {(commentsQuery.data ?? []).length === 0 && (
              <div className="text-[12px] text-[var(--fg4)]">No comments</div>
            )}
            {(commentsQuery.data ?? []).slice(0, 5).map((comment) => (
              <div key={comment.id} className="comment-row">
                <MessageSquare className="size-3.5" />
                <span>{comment.body}</span>
              </div>
            ))}
          </section>
        </aside>
      </div>
    </section>
  );
}

function RunnerPanel({
  runners,
  projects,
  loading,
  onChanged,
  onClose,
}: {
  runners: Runner[];
  projects: Project[];
  loading: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<Runner | null>(null);
  const [kind, setKind] = useState<Runner["kind"]>("generic");
  const [name, setName] = useState("");
  const [launchCmd, setLaunchCmd] = useState("");
  const [resumeCmd, setResumeCmd] = useState("");
  const [envJson, setEnvJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEditing(null);
    setKind("generic");
    setName("");
    setLaunchCmd("");
    setResumeCmd("");
    setEnvJson("{}");
    setError(null);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateRunner({
            runnerId: editing.id,
            name,
            launchCmd,
            resumeCmd,
            envJson,
          })
        : createRunner({ kind, name, launchCmd, resumeCmd, envJson }),
    onSuccess: () => {
      reset();
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });

  const usedAsDefault = new Set(projects.map((project) => project.defaultRunnerId).filter(Boolean));

  return (
    <aside className="runner-panel">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="label-caps">Runners</div>
          <h3>Registry</h3>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close Runners">
          <X />
        </Button>
      </div>

      {loading && <div className="empty-panel">Loading Runners</div>}
      <div className="space-y-2">
        {runners.map((runner) => (
          <button
            key={runner.id}
            type="button"
            className="runner-row"
            onClick={() => {
              setEditing(runner);
              setKind(runner.kind);
              setName(runner.name);
              setLaunchCmd(runner.launchCmd);
              setResumeCmd(runner.resumeCmd);
              setEnvJson(runner.envJson);
            }}
          >
            <span className="runner-kind">{runner.kind}</span>
            <span className="min-w-0 flex-1 truncate">{runner.name}</span>
            {usedAsDefault.has(runner.id) && <span className="count-pill">default</span>}
          </button>
        ))}
      </div>

      <form
        className="mt-4 space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          saveMutation.mutate();
        }}
      >
        <div className="label-caps">{editing ? "Edit Runner" : "New Runner"}</div>
        <select
          value={kind}
          onChange={(event) => setKind(event.target.value as Runner["kind"])}
          className="field"
          disabled={Boolean(editing)}
        >
          <option value="claude">claude</option>
          <option value="codex">codex</option>
          <option value="generic">generic</option>
        </select>
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" className="field" />
        <input
          value={launchCmd}
          onChange={(event) => setLaunchCmd(event.target.value)}
          placeholder="Launch command"
          className="field font-mono"
        />
        <input
          value={resumeCmd}
          onChange={(event) => setResumeCmd(event.target.value)}
          placeholder="Resume command"
          className="field font-mono"
        />
        <textarea
          value={envJson}
          onChange={(event) => setEnvJson(event.target.value)}
          className="field min-h-20 font-mono"
        />
        {error && <div className="text-[12px] text-destructive">{error}</div>}
        <div className="flex gap-2">
          <Button type="submit" disabled={!name.trim() || !launchCmd.trim() || saveMutation.isPending}>
            <Check />
            Save
          </Button>
          {editing && (
            <Button type="button" variant="outline" onClick={reset}>
              Clear
            </Button>
          )}
          {editing && (
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                void deleteRunner(editing.id)
                  .then(() => {
                    reset();
                    onChanged();
                  })
                  .catch((err) => setError(String(err)))
              }
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </aside>
  );
}

function Logo() {
  return (
    <span className="logo-mark">
      <svg viewBox="0 0 64 64" width="16" height="16" fill="none">
        <g stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 43V23q0-5 5-5t5 5v20m0-14q0-5 5-5t5 5v14" />
          <path d="M49 25q-4-4-10-4-6 0-6 6 0 5 7 6 7 1 7 7 0 6-8 6-5 0-8-3" />
        </g>
      </svg>
    </span>
  );
}

function AttentionPip() {
  return <span className="attention-pip" />;
}

function Kbd({ children }: { children: string }) {
  return <span className="kbd">{children}</span>;
}

function ProjectChip({
  project,
  projectLike,
}: {
  project?: Project;
  projectLike?: Pick<Issue, "projectColorIndex" | "projectColor" | "projectName">;
}) {
  const colorIndex = project?.colorIndex ?? projectLike?.projectColorIndex ?? 1;
  const color = project?.color ?? projectLike?.projectColor ?? "#5318c9";
  const label = project?.name ?? projectLike?.projectName ?? "P";
  return (
    <span className="project-chip" style={projectStyle(colorIndex, color)}>
      {label.slice(0, 1)}
    </span>
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
    />
  );
}

function SessionStatusPill({ status }: { status: SessionSummary["status"] }) {
  return (
    <span className={cn("status-pill", status === "needs_input" && "needs")}>
      <StatusDot status={status} />
      {status.replace("_", " ")}
    </span>
  );
}

function Shader({ disabled, subtle = false }: { disabled: boolean; subtle?: boolean }) {
  const [pos, setPos] = useState({ x: 50, y: 30 });
  useEffect(() => {
    if (disabled) return undefined;
    const onPointerMove = (event: PointerEvent) => {
      setPos({
        x: (event.clientX / window.innerWidth) * 100,
        y: (event.clientY / window.innerHeight) * 100,
      });
    };
    window.addEventListener("pointermove", onPointerMove);
    return () => window.removeEventListener("pointermove", onPointerMove);
  }, [disabled]);
  if (disabled) return <div className="shader-fallback" />;
  return (
    <div
      className={cn("shader", subtle && "subtle")}
      style={{
        "--shader-x": `${pos.x}%`,
        "--shader-y": `${pos.y}%`,
      } as CSSProperties}
    />
  );
}

function normalizeColumns(columns?: BoardColumn[]) {
  if (!columns || columns.length === 0) return canonicalColumns;
  return columns.map((column) => ({ label: column.label, stateType: column.stateType }));
}

function latestSessionsByIssue(sessions: SessionSummary[]) {
  const map = new Map<number, SessionSummary>();
  for (const session of sessions) {
    const existing = map.get(session.issueId);
    if (!existing || session.id > existing.id) map.set(session.issueId, session);
  }
  return map;
}

function buildProjectStats(sessions: SessionSummary[]) {
  const stats = new Map<number, { live: number; needs: number }>();
  for (const session of sessions) {
    if (session.status === "exited") continue;
    const current = stats.get(session.projectId) ?? { live: 0, needs: 0 };
    current.live += 1;
    if (sessionNeedsInput(session)) current.needs += 1;
    stats.set(session.projectId, current);
  }
  return stats;
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
  return Array.from(groups.values()).sort((a, b) => a.projectName.localeCompare(b.projectName));
}

function sortSessions(sessions: SessionSummary[]) {
  return [...sessions].sort((a, b) => {
    const aNeeds = a.status === "needs_input" ? 0 : 1;
    const bNeeds = b.status === "needs_input" ? 0 : 1;
    if (aNeeds !== bNeeds) return aNeeds - bNeeds;
    return Date.parse(a.needsInputSince ?? a.startedAt) - Date.parse(b.needsInputSince ?? b.startedAt);
  });
}

function sessionNeedsInput(session: SessionSummary) {
  if (session.status !== "needs_input") return false;
  if (!session.snoozedUntil) return true;
  return Date.parse(session.snoozedUntil) <= Date.now();
}

function elapsedLabel(startedAt: string) {
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(startedAt)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  return `${Math.round(minutes / 60)}h`;
}

function waitingLabel(startedAt: string) {
  return elapsedLabel(startedAt);
}

function projectStyle(colorIndex: number, fallback: string) {
  return {
    "--project-color": `var(--project-${colorIndex}, ${fallback})`,
  } as CSSProperties;
}

export default App;
