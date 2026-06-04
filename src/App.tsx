import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Code2,
  CornerDownLeft,
  ExternalLink,
  FolderGit2,
  FolderPlus,
  Gauge,
  GitBranch,
  Globe,
  Inbox,
  KeyRound,
  Layers3,
  Link2,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Moon,
  MoreVertical,
  PanelLeft,
  Palette,
  Pencil,
  Pin,
  PinOff,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Square,
  Sun,
  Unlink,
  X,
} from "lucide-react";
import { Dialog, DropdownMenu, Popover } from "radix-ui";
import {
  claudeHookStatus,
  createIssue,
  createIssueComment,
  createProject,
  createRunner,
  deleteRunner,
  getSessionScrollback,
  installClaudeHook,
  isTauriRuntime,
  killSession,
  linearAuthorizeUrl,
  linearCompleteOauth,
  linearConnectApiKey,
  linearDisconnect,
  linearImportIssues,
  linearLinkProject,
  linearListProjects,
  linearStatus,
  linearUnlinkProject,
  listBoardColumns,
  listGroups,
  listIssueComments,
  listIssues,
  listProjects,
  listRunners,
  listSessions,
  openExternal,
  openProjectDirectory,
  setSessionStatus,
  snoozeSession,
  startSession,
  transitionIssue,
  uninstallClaudeHook,
  updateIssue,
  updateProject,
  updateRunner,
  workspaceDiff,
} from "@/api";
import { Button } from "@/components/ui/button";
import { Shader } from "@/components/Shader";
import { TerminalPane } from "@/components/TerminalPane";
import { cn } from "@/lib/utils";
import { useUiStore, type AlertTreatment } from "@/store";
import type {
  BoardColumn,
  Group,
  Issue,
  LinearConnection,
  Project,
  Runner,
  SessionStatusEvent,
  SessionSummary,
  StateType,
  ViewMode,
  WorkspaceDiff,
} from "@/types";

const viewLabels: Record<ViewMode, string> = {
  board: "Board",
  sessions: "Sessions",
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
    alertTreatment,
    toggleDark,
    toggleReduceMotion,
    cycleAlertTreatment,
    toggleSidebar,
    selectProject,
    setBoardScope,
    openIssue,
    focusSession,
    setView,
  } = useUiStore();
  const [runnerPanelOpen, setRunnerPanelOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [linearDialogOpen, setLinearDialogOpen] = useState(false);
  const [linkLinearProjectId, setLinkLinearProjectId] = useState<number | null>(null);

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
  const linearStatusQuery = useQuery({ queryKey: ["linear-status"], queryFn: linearStatus });

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
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key.toLowerCase() === "f" || event.key.toLowerCase() === "k")
      ) {
        event.preventDefault();
        setSearchOpen(true);
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
      <Shader disabled={reduceMotion} dark={dark} />
      <TopBar
        dark={dark}
        reduceMotion={reduceMotion}
        alertTreatment={alertTreatment}
        sidebarOpen={sidebarOpen}
        view={view}
        needsCount={activeNeeds.length}
        linearConnection={linearStatusQuery.data ?? null}
        runnerPanelOpen={runnerPanelOpen}
        onOpenSearch={() => setSearchOpen(true)}
        onOpenLinear={() => setLinearDialogOpen(true)}
        onToggleDark={toggleDark}
        onToggleReduceMotion={toggleReduceMotion}
        onCycleAlert={cycleAlertTreatment}
        onToggleSidebar={toggleSidebar}
        onSetView={(nextView) => {
          setView(nextView);
          if (nextView !== "board") openIssue(null);
        }}
        onRefresh={invalidateWork}
        onToggleRunnerPanel={() => setRunnerPanelOpen((value) => !value)}
      />

      <div className="app-body">
        {sidebarOpen && (
          <Sidebar
            projects={projects}
            groups={groups}
            selectedProjectId={selectedProjectId}
            stats={projectStats}
            loading={projectsQuery.isPending}
            error={projectsQuery.isError ? projectsQuery.error : null}
            linearConnected={Boolean(linearStatusQuery.data?.connected)}
            onRetry={() => void projectsQuery.refetch()}
            onSelectProject={(projectId) => {
              selectProject(projectId);
              setView("board");
            }}
            onProjectCreated={(project) => {
              selectProject(project.id);
              setView("board");
              invalidateWork();
            }}
            onProjectChanged={invalidateWork}
            onLinkLinear={(projectId) => setLinkLinearProjectId(projectId)}
          />
        )}

        <main className="main-surface">
          {runnerPanelOpen && (
            <RunnerPanel
              runners={runners}
              projects={projects}
              loading={runnersQuery.isPending}
              error={runnersQuery.isError ? runnersQuery.error : null}
              onRetry={() => void runnersQuery.refetch()}
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
              error={
                issuesQuery.isError
                  ? issuesQuery.error
                  : boardColumnsQuery.isError
                    ? boardColumnsQuery.error
                    : null
              }
              onRetry={() => {
                void issuesQuery.refetch();
                void boardColumnsQuery.refetch();
              }}
              onScopeChange={setBoardScope}
              onIssueCreated={invalidateWork}
              onIssueOpen={(issueId) => openIssue(issueId)}
              onTransitioned={invalidateWork}
            />
          )}

          {view === "sessions" && (
            <SessionsView
              sessions={scopedSessions}
              focusedSessionId={focusedSessionId}
              loading={allSessionsQuery.isPending}
              error={allSessionsQuery.isError ? allSessionsQuery.error : null}
              onRetry={() => void allSessionsQuery.refetch()}
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
              reduceMotion={reduceMotion}
              dark={dark}
              focusedSessionId={focusedSessionId}
              onFocusSession={focusSession}
              onOpenSessions={(sessionId) => {
                focusSession(sessionId);
                setView("sessions");
              }}
              onChanged={invalidateWork}
            />
          )}
        </main>
      </div>

      {searchOpen && (
        <GlobalSearch
          projects={projects}
          issues={allIssues}
          onClose={() => setSearchOpen(false)}
          onPickProject={(projectId) => {
            selectProject(projectId);
            setView("board");
            setSearchOpen(false);
          }}
          onPickIssue={(issueId) => {
            openIssue(issueId);
            setView("board");
            setSearchOpen(false);
          }}
        />
      )}

      <LinearConnectDialog
        open={linearDialogOpen}
        connection={linearStatusQuery.data ?? null}
        onOpenChange={setLinearDialogOpen}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["linear-status"] });
          invalidateWork();
        }}
      />

      <LinearLinkDialog
        project={projects.find((project) => project.id === linkLinearProjectId) ?? null}
        connected={Boolean(linearStatusQuery.data?.connected)}
        onClose={() => setLinkLinearProjectId(null)}
        onConnect={() => {
          setLinkLinearProjectId(null);
          setLinearDialogOpen(true);
        }}
        onChanged={invalidateWork}
      />
    </div>
  );
}

function TopBar({
  dark,
  reduceMotion,
  alertTreatment,
  sidebarOpen,
  view,
  needsCount,
  linearConnection,
  runnerPanelOpen,
  onOpenSearch,
  onOpenLinear,
  onToggleDark,
  onToggleReduceMotion,
  onCycleAlert,
  onToggleSidebar,
  onSetView,
  onRefresh,
  onToggleRunnerPanel,
}: {
  dark: boolean;
  reduceMotion: boolean;
  alertTreatment: AlertTreatment;
  sidebarOpen: boolean;
  view: ViewMode;
  needsCount: number;
  linearConnection: LinearConnection | null;
  runnerPanelOpen: boolean;
  onOpenSearch: () => void;
  onOpenLinear: () => void;
  onToggleDark: () => void;
  onToggleReduceMotion: () => void;
  onCycleAlert: () => void;
  onToggleSidebar: () => void;
  onSetView: (view: ViewMode) => void;
  onRefresh: () => void;
  onToggleRunnerPanel: () => void;
}) {
  const linearConnected = Boolean(linearConnection?.connected);
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

      <div className="view-switch" role="group" aria-label="View">
        {(Object.keys(viewLabels) as ViewMode[]).map((candidate) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={view === candidate}
            className={cn("view-switch-button", view === candidate && "active")}
            onClick={() => onSetView(candidate)}
          >
            {viewLabels[candidate]}
            {candidate === "feed" && needsCount > 0 && view !== "feed" && <AttentionPip />}
          </button>
        ))}
      </div>

      <div className="topbar-cluster min-w-0 flex-1 justify-end">
        <span className="sr-only" role="status" aria-live="polite">
          {needsCount > 0 ? `${needsCount} sessions need input` : "No sessions need input"}
        </span>
        {needsCount > 0 && (
          <span className="needs-pill">
            <AttentionPip />
            {needsCount} need input
          </span>
        )}
        <button
          type="button"
          className="topbar-search hidden lg:flex"
          onClick={onOpenSearch}
          aria-label="Search Issues, Projects, and prompts"
          title="Search Issues, Projects, and prompts"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="flex-1 truncate text-left">Search</span>
          <Kbd>⌘K</Kbd>
        </button>
        <Button variant="ghost" size="icon-sm" onClick={onOpenSearch} aria-label="Search" title="Search" className="lg:hidden">
          <Search />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onRefresh} aria-label="Refresh data" title="Refresh data">
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
          onClick={onCycleAlert}
          aria-label={`Alert color: ${alertTreatment}. Click to cycle.`}
          title={`Alert color: ${alertTreatment} (click to cycle)`}
        >
          <Palette />
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
        <button
          type="button"
          className={cn("linear-badge", linearConnected ? "online" : "offline")}
          onClick={onOpenLinear}
          title={
            linearConnected
              ? `Linear connected${linearConnection?.workspaceName ? ` — ${linearConnection.workspaceName}` : ""} (click to manage)`
              : "Connect Linear to link Projects and import Issues"
          }
        >
          <span className={cn("status-dot", linearConnected ? "status-running" : "status-exited")} />
          {linearConnected ? linearConnection?.workspaceName ?? "Linear" : "Connect Linear"}
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  projects,
  groups,
  selectedProjectId,
  stats,
  loading,
  error,
  linearConnected,
  onRetry,
  onSelectProject,
  onProjectCreated,
  onProjectChanged,
  onLinkLinear,
}: {
  projects: Project[];
  groups: Group[];
  selectedProjectId: number | null;
  stats: Map<number, { live: number; needs: number }>;
  loading: boolean;
  error: unknown;
  linearConnected: boolean;
  onRetry: () => void;
  onSelectProject: (projectId: number | null) => void;
  onProjectCreated: (project: Project) => void;
  onProjectChanged: () => void;
  onLinkLinear: (projectId: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<number | "ungrouped" | "pinned">>(new Set());
  const [pinned, setPinned] = useState<Set<number>>(() => loadPinnedProjects());
  const [renamingId, setRenamingId] = useState<number | null>(null);

  const renameMutation = useMutation({
    mutationFn: (vars: { projectId: number; name: string }) => updateProject(vars),
    onSuccess: () => {
      setRenamingId(null);
      onProjectChanged();
    },
    onError: () => setRenamingId(null),
  });

  const togglePin = (projectId: number) =>
    setPinned((current) => {
      const next = new Set(current);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      savePinnedProjects(next);
      return next;
    });

  // Pinned Projects float into a dedicated bucket at the top and are removed
  // from their normal Group bucket so they appear exactly once.
  const pinnedProjects = projects.filter((project) => pinned.has(project.id));
  const rest = projects.filter((project) => !pinned.has(project.id));

  const buckets: Array<{ key: number | "ungrouped" | "pinned"; name: string; projects: Project[] }> = [];
  if (pinnedProjects.length > 0) buckets.push({ key: "pinned", name: "Pinned", projects: pinnedProjects });
  for (const group of groups) {
    const groupProjects = rest.filter((project) => project.groupId === group.id);
    if (groupProjects.length > 0) buckets.push({ key: group.id, name: group.name, projects: groupProjects });
  }
  const ungrouped = rest.filter((project) => project.groupId === null);
  if (ungrouped.length > 0) buckets.push({ key: "ungrouped", name: "Ungrouped", projects: ungrouped });

  const aggregate = (group: Project[]) =>
    group.reduce(
      (acc, project) => {
        const counts = stats.get(project.id) ?? { live: 0, needs: 0 };
        return { live: acc.live + counts.live, needs: acc.needs + counts.needs };
      },
      { live: 0, needs: 0 },
    );

  const toggleGroup = (key: number | "ungrouped" | "pinned") =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="label-caps">Projects</div>
        <AddProjectMenu groups={groups} onCreated={onProjectCreated} />
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

        {error ? (
          <div className="px-1 py-2">
            <QueryError error={error} onRetry={onRetry} label="Couldn't load Projects" />
          </div>
        ) : loading ? (
          <div className="px-1 py-2">
            <SkeletonRows rows={4} h={46} />
          </div>
        ) : buckets.length === 0 ? (
          <div className="empty-panel mx-1 my-2">No Projects yet — add one with +.</div>
        ) : (
          buckets.map((bucket) => {
            const isCollapsed = collapsed.has(bucket.key);
            const agg = aggregate(bucket.projects);
            return (
              <section key={bucket.key} className="sidebar-group">
                <button
                  type="button"
                  className="sidebar-group-header"
                  onClick={() => toggleGroup(bucket.key)}
                >
                  <span className="flex min-w-0 items-center gap-1">
                    {isCollapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    {bucket.key === "pinned" && <Pin className="size-3 text-[var(--fg4)]" />}
                    <span className="truncate">{bucket.name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    {agg.live > 0 && <span className="count-pill">{agg.live}</span>}
                    {agg.needs > 0 && <AttentionPip />}
                  </span>
                </button>
                {!isCollapsed &&
                  bucket.projects.map((project) => (
                    <ProjectRow
                      key={project.id}
                      project={project}
                      selected={selectedProjectId === project.id}
                      counts={stats.get(project.id) ?? { live: 0, needs: 0 }}
                      pinned={pinned.has(project.id)}
                      renaming={renamingId === project.id}
                      linearConnected={linearConnected}
                      onSelect={() => onSelectProject(project.id)}
                      onTogglePin={() => togglePin(project.id)}
                      onStartRename={() => setRenamingId(project.id)}
                      onCommitRename={(name) => renameMutation.mutate({ projectId: project.id, name })}
                      onCancelRename={() => setRenamingId(null)}
                      onLinkLinear={() => onLinkLinear(project.id)}
                    />
                  ))}
              </section>
            );
          })
        )}
      </div>
    </aside>
  );
}

function ProjectRow({
  project,
  selected,
  counts,
  pinned,
  renaming,
  linearConnected,
  onSelect,
  onTogglePin,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onLinkLinear,
}: {
  project: Project;
  selected: boolean;
  counts: { live: number; needs: number };
  pinned: boolean;
  renaming: boolean;
  linearConnected: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
  onStartRename: () => void;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onLinkLinear: () => void;
}) {
  if (renaming) {
    return (
      <div className={cn("project-row project-row--menu", selected && "selected")}>
        <ProjectChip project={project} />
        <RenameInput initial={project.name} onCommit={onCommitRename} onCancel={onCancelRename} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "project-row project-row--menu",
        selected && "selected",
        counts.needs > 0 && "attention",
      )}
    >
      <button type="button" className="project-row-main" onClick={onSelect}>
        <ProjectChip project={project} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="block truncate font-medium">{project.name}</span>
            {pinned && <Pin className="size-3 shrink-0 text-[var(--fg4)]" />}
            <LinearChip linearKey={project.linearKey} linearUrl={project.linearUrl} />
          </span>
          <span className="block truncate text-[11px] text-[var(--fg4)]">
            {project.gitBacked ? "git" : "non-git"}
          </span>
        </span>
        <span className="flex items-center gap-1">
          {!project.gitBacked && <AlertCircle className="size-3.5 text-[var(--status-exited)]" />}
          {counts.live > 0 && <span className="count-pill">{counts.live}</span>}
          {counts.needs > 0 && <AttentionPip />}
        </span>
      </button>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className="row-menu-trigger" aria-label={`Actions for ${project.name}`}>
            <MoreVertical className="size-3.5" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="menu-content" align="end" sideOffset={4}>
            <DropdownMenu.Item className="menu-item" onSelect={onTogglePin}>
              {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
              {pinned ? "Unpin" : "Pin"}
            </DropdownMenu.Item>
            <DropdownMenu.Item className="menu-item" onSelect={onStartRename}>
              <Pencil className="size-3.5" />
              Rename
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="menu-separator" />
            {project.linearUrl && (
              <DropdownMenu.Item
                className="menu-item"
                onSelect={() => void openExternal(project.linearUrl as string)}
              >
                <ExternalLink className="size-3.5" />
                Open in Linear
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item className="menu-item" onSelect={onLinkLinear}>
              <Link2 className="size-3.5" />
              {project.linearKey
                ? "Manage Linear link…"
                : linearConnected
                  ? "Link to Linear…"
                  : "Connect Linear…"}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

/** Inline single-field rename for a Project row. Commits on Enter/blur, cancels on Escape. */
function RenameInput({
  initial,
  onCommit,
  onCancel,
}: {
  initial: string;
  onCommit: (name: string) => void;
  onCancel: () => void;
}) {
  const done = useRef(false);
  const finish = (raw: string) => {
    if (done.current) return;
    done.current = true;
    const next = raw.trim();
    if (next && next !== initial) onCommit(next);
    else onCancel();
  };
  return (
    <input
      className="field h-7 flex-1 text-[13px]"
      defaultValue={initial}
      autoFocus
      aria-label="Rename Project"
      onFocus={(event) => event.currentTarget.select()}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          finish(event.currentTarget.value);
        } else if (event.key === "Escape") {
          event.preventDefault();
          done.current = true;
          onCancel();
        }
      }}
      onBlur={(event) => finish(event.currentTarget.value)}
    />
  );
}

/** The `+` button in the sidebar header; opens the Add-Project form in a popover. */
function AddProjectMenu({ groups, onCreated }: { groups: Group[]; onCreated: (project: Project) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Add Project" title="Add Project">
          <Plus />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="popover-content" align="end" sideOffset={6}>
          <AddProjectForm
            groups={groups}
            onCreated={(project) => {
              setOpen(false);
              onCreated(project);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function AddProjectForm({
  groups,
  onCreated,
}: {
  groups: Group[];
  onCreated: (project: Project) => void;
}) {
  const [groupId, setGroupId] = useState<number | "none" | "new">("none");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      setGroupName("");
      setGroupId("none");
      setError(null);
      onCreated(project);
    },
    onError: (err) => setError(String(err)),
  });

  const browse = async () => {
    setError(null);
    const selected = await openProjectDirectory();
    if (!selected) return;
    // The folder is the Project; the backend derives the name from its basename.
    mutation.mutate({
      path: selected,
      groupId: typeof groupId === "number" ? groupId : null,
      groupName: groupId === "new" ? groupName.trim() || null : null,
    });
  };

  return (
    <div className="space-y-2">
      <div className="label-caps">Add Project</div>
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
        aria-label="Group for the new Project"
      >
        <option value="none">No Group</option>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
        <option value="new">New Group…</option>
      </select>
      {groupId === "new" && (
        <input
          value={groupName}
          onChange={(event) => setGroupName(event.target.value)}
          placeholder="Group name"
          className="field"
          aria-label="New Group name"
        />
      )}
      <Button type="button" className="w-full" onClick={() => void browse()} disabled={mutation.isPending}>
        <FolderPlus />
        {mutation.isPending ? "Adding…" : "Browse for folder…"}
      </Button>
      {error && <div className="text-[12px] text-destructive">{error}</div>}
    </div>
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
  error,
  onRetry,
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
  error: unknown;
  onRetry: () => void;
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
        <div className="segmented" role="group" aria-label="Board scope">
          <button
            type="button"
            aria-pressed={scope === "project"}
            className={cn(scope === "project" && "active")}
            onClick={() => onScopeChange("project")}
            disabled={!selectedProject}
          >
            This Project
          </button>
          <button
            type="button"
            aria-pressed={scope === "global"}
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

      {error ? (
        <QueryError error={error} onRetry={onRetry} label="Couldn't load the Board" />
      ) : loading ? (
        <div className="board-grid">
          {columns.map((column) => (
            <section key={column.stateType} className="board-column">
              <div className="board-column-header">
                <span>{column.label}</span>
              </div>
              <SkeletonRows rows={2} h={64} />
            </section>
          ))}
        </div>
      ) : issues.length === 0 ? (
        <div className="empty-panel">No Issues yet — add one above.</div>
      ) : null}
      {!error && !loading && (
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
      )}
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

function SessionPreview({ session }: { session: SessionSummary }) {
  // A lightweight, throttled static preview from the persisted ring buffer —
  // not a live xterm — so a fleet of tiles stays cheap (Slice 7).
  const scrollbackQuery = useQuery({
    queryKey: ["scrollback", session.id],
    queryFn: () => getSessionScrollback(session.id),
    refetchInterval: session.status === "exited" ? false : 4000,
  });
  const text = useMemo(() => previewText(scrollbackQuery.data ?? ""), [scrollbackQuery.data]);
  return <pre className="tile-preview">{text || "…"}</pre>;
}

function SessionsView({
  sessions,
  focusedSessionId,
  loading,
  error,
  onRetry,
  onFocusSession,
  onOpenFeed,
  onChanged,
}: {
  sessions: SessionSummary[];
  focusedSessionId: number | null;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  onFocusSession: (sessionId: number | null) => void;
  onOpenFeed: (sessionId: number) => void;
  onChanged: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<SessionSummary["status"] | "all">("all");
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [order, setOrder] = useState<number[]>(() => loadCockpitOrder());
  const liveSessions = sessions.filter((session) => session.status !== "exited");
  const filtered =
    statusFilter === "all"
      ? liveSessions
      : liveSessions.filter((session) => session.status === statusFilter);
  const groups = useMemo(() => groupSessionsByProject(filtered), [filtered]);

  const orderedGroups = useMemo(() => {
    const rank = (projectId: number) => {
      const index = order.indexOf(projectId);
      return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...groups].sort(
      (a, b) => rank(a.projectId) - rank(b.projectId) || a.projectName.localeCompare(b.projectName),
    );
  }, [groups, order]);

  const moveGroup = (projectId: number, direction: -1 | 1) => {
    const ids = orderedGroups.map((group) => group.projectId);
    const from = ids.indexOf(projectId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    setOrder(ids);
    saveCockpitOrder(ids);
  };

  return (
    <section className="view-surface">
      <div className="surface-header">
        <div>
          <div className="label-caps">Sessions</div>
          <h2>Sessions</h2>
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

      {error ? (
        <QueryError error={error} onRetry={onRetry} label="Couldn't load Sessions" />
      ) : loading ? (
        <SkeletonRows rows={3} h={150} />
      ) : liveSessions.length === 0 ? (
        <div className="empty-panel">Nothing running</div>
      ) : null}

      <div className="space-y-5">
        {orderedGroups.map((group, index) => {
          const isCollapsed = collapsed.has(group.projectId);
          const attention = group.sessions.filter((session) => session.status === "needs_input").length;
          return (
            <section key={group.projectId} className="fleet-group">
              <div className="fleet-group-header">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent text-left"
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(group.projectId)) next.delete(group.projectId);
                      else next.add(group.projectId);
                      return next;
                    })
                  }
                >
                  {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
                  <span className="truncate">{group.projectName}</span>
                </button>
                <span className="flex items-center gap-2">
                  {group.sessions.length} live
                  {attention > 0 && <span className="needs-pill small">{attention} need input</span>}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Move group up"
                    aria-label="Move group up"
                    disabled={index === 0}
                    onClick={() => moveGroup(group.projectId, -1)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    title="Move group down"
                    aria-label="Move group down"
                    disabled={index === orderedGroups.length - 1}
                    onClick={() => moveGroup(group.projectId, 1)}
                  >
                    <ArrowDown />
                  </Button>
                </span>
              </div>
              {!isCollapsed && (
                <div className="cockpit-grid">
                  {sortSessions(group.sessions).map((session) => {
                    const expanded = focusedSessionId === session.id;
                    const needsInput = session.status === "needs_input";
                    return (
                      <article
                        key={session.id}
                        className={cn("session-tile", needsInput && "attention", expanded && "expanded")}
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
                              title={needsInput ? "Open in Feed" : "Only Needs-Input Sessions enter the Feed"}
                              aria-label="Open in Feed"
                              disabled={!needsInput}
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
                          {expanded ? (
                            <TerminalPane session={session} density="full" onSessionChanged={onChanged} />
                          ) : (
                            <SessionPreview session={session} />
                          )}
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
  reduceMotion,
  dark,
  focusedSessionId,
  onFocusSession,
  onOpenSessions,
  onChanged,
}: {
  sessions: SessionSummary[];
  issues: Issue[];
  reduceMotion: boolean;
  dark: boolean;
  focusedSessionId: number | null;
  onFocusSession: (sessionId: number | null) => void;
  onOpenSessions: (sessionId: number) => void;
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

  const advance = useCallback(() => {
    onFocusSession(null);
    setCursor((value) => Math.min(Math.max(queue.length - 2, 0), value));
    onChanged();
  }, [onFocusSession, onChanged, queue.length]);

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
      if (event.key === "Enter" && session) {
        event.preventDefault();
        void setSessionStatus(session.id, "idle").then(advance);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [queue.length, session, advance]);

  useEffect(() => {
    if (focusedSessionId !== null && !queue.some((candidate) => candidate.id === focusedSessionId)) {
      onFocusSession(null);
    }
  }, [focusedSessionId, onFocusSession, queue]);

  if (!session) {
    return (
      <section className="feed-empty">
        <Shader disabled={reduceMotion} subtle dark={dark} />
        <div className="empty-hero">
          <Inbox className="size-10" />
          <h2>Inbox zero</h2>
          <p>No Session needs input.</p>
          <p className="mt-1 text-[12px] text-[var(--fg4)]">
            Agents that need you will appear here, oldest first.
          </p>
        </div>
      </section>
    );
  }

  const upNext = queue.filter((candidate) => candidate.id !== session.id).length;

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
            <DiffPanel
              data={diffQuery.data}
              isPending={diffQuery.isPending}
              isError={diffQuery.isError}
              error={diffQuery.error}
              onRetry={() => void diffQuery.refetch()}
            />
          </section>
          <div className="mt-auto space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[var(--fg4)]">
              <span>{upNext > 0 ? `${upNext} more waiting` : "Last in queue"}</span>
              <span className="flex items-center gap-1">
                <Kbd>⌘↵</Kbd> done · <Kbd>⌘↑</Kbd>
                <Kbd>⌘↓</Kbd> revisit
              </span>
            </div>
            <div className="feed-actions">
              <Button variant="outline" onClick={() => setCursor((value) => Math.min(queue.length - 1, value + 1))}>
                <ChevronDown />
                Skip
              </Button>
              <Button variant="outline" onClick={() => void snoozeSession(session.id).then(advance)}>
                <Clock />
                Snooze
              </Button>
              <Button variant="outline" onClick={() => onOpenSessions(session.id)}>
                <Gauge />
                Open in Sessions
              </Button>
              <Button onClick={() => void setSessionStatus(session.id, "idle").then(advance)}>
                <Check />
                Done
              </Button>
            </div>
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
  const [linearKey, setLinearKey] = useState(issue?.linearKey ?? "");
  const [linearUrl, setLinearUrl] = useState(issue?.linearUrl ?? "");
  const [commentDraft, setCommentDraft] = useState("");

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
    setLinearKey(issue.linearKey ?? "");
    setLinearUrl(issue.linearUrl ?? "");
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
  const boardColumnsQuery = useQuery({
    queryKey: ["board-columns", issue?.projectId],
    queryFn: () => listBoardColumns(issue?.projectId as number),
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
  const commentMutation = useMutation({
    mutationFn: (body: string) =>
      createIssueComment({ issueId: issue?.id as number, body, author: "you" }),
    onSuccess: () => {
      setCommentDraft("");
      void commentsQuery.refetch();
    },
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
  const latestSession = sessions.reduce<SessionSummary | null>(
    (latest, session) => (latest === null || session.id > latest.id ? session : latest),
    null,
  );
  const crashed = latestSession?.status === "exited" && (latestSession.exitCode ?? 0) !== 0;
  const degraded = !gitBacked || crashed;
  const columnLabel =
    boardColumnsQuery.data?.find((column) => column.stateType === stateType)?.label ??
    canonicalColumns.find((column) => column.stateType === stateType)?.label ??
    stateType;

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
            <LinearChip linearKey={issue.linearKey} linearUrl={issue.linearUrl} />
            {degraded && (
              <span className="degraded-pill" title={crashed ? "A Session exited with an error" : "Non-git Workspace (degraded)"}>
                <AlertCircle className="size-3" />
                Degraded
              </span>
            )}
          </div>
          <p>
            {issue.projectName} · {columnLabel} · {stateType}
          </p>
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
            <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <input
                value={linearKey}
                onChange={(event) => setLinearKey(event.target.value)}
                placeholder="LIN-123"
                className="field font-mono"
                aria-label="Linear key"
              />
              <input
                value={linearUrl}
                onChange={(event) => setLinearUrl(event.target.value)}
                placeholder="Linear URL (display only)"
                className="field"
                aria-label="Linear URL"
              />
            </div>
            <Button
              onClick={() =>
                saveMutation.mutate({
                  issueId: issue.id,
                  title,
                  description,
                  stateType,
                  runnerOverrideId: runnerOverrideId === "default" ? null : runnerOverrideId,
                  workspaceStrategy,
                  linearKey,
                  linearUrl,
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
            <DiffPanel
              data={diffQuery.data}
              isPending={diffQuery.isPending}
              isError={diffQuery.isError}
              error={diffQuery.error}
              onRetry={() => void diffQuery.refetch()}
            />
          </section>

          <section className="tool-panel space-y-2">
            <div className="label-caps">Comments</div>
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (commentDraft.trim()) commentMutation.mutate(commentDraft.trim());
              }}
            >
              <input
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                placeholder="Add a comment…"
                className="field"
              />
              <Button type="submit" size="sm" disabled={!commentDraft.trim() || commentMutation.isPending}>
                <MessageSquare />
                Post
              </Button>
            </form>
            {commentsQuery.isError ? (
              <QueryError
                error={commentsQuery.error}
                onRetry={() => void commentsQuery.refetch()}
                label="Couldn't load comments"
              />
            ) : commentsQuery.isPending ? (
              <SkeletonRows rows={2} h={28} />
            ) : (commentsQuery.data ?? []).length === 0 ? (
              <div className="text-[12px] text-[var(--fg4)]">No comments yet.</div>
            ) : (
              (commentsQuery.data ?? []).slice(0, 8).map((comment) => (
                <div key={comment.id} className="comment-row">
                  <MessageSquare className="size-3.5" />
                  <span className="min-w-0">
                    <span className="mr-1.5 font-medium text-[var(--fg2)]">{comment.author}</span>
                    {comment.body}
                  </span>
                </div>
              ))
            )}
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
  error: loadError,
  onRetry,
  onChanged,
  onClose,
}: {
  runners: Runner[];
  projects: Project[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
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
  const [reassignTo, setReassignTo] = useState<number | "">("");
  const [deleting, setDeleting] = useState(false);

  const reset = () => {
    setEditing(null);
    setKind("generic");
    setName("");
    setLaunchCmd("");
    setResumeCmd("");
    setEnvJson("{}");
    setError(null);
    setReassignTo("");
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      editing
        ? updateRunner({ runnerId: editing.id, name, launchCmd, resumeCmd, envJson })
        : createRunner({ kind, name, launchCmd, resumeCmd, envJson }),
    onSuccess: () => {
      reset();
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });

  const usedAsDefault = new Set(projects.map((project) => project.defaultRunnerId).filter(Boolean));
  const affected = editing ? projects.filter((project) => project.defaultRunnerId === editing.id) : [];
  const otherRunners = runners.filter((runner) => runner.id !== editing?.id);
  const isLastRunner = runners.length <= 1;

  // Reassign affected Projects' default Runner (server enforces ON DELETE
  // RESTRICT) before deleting one that is in use, instead of just surfacing the
  // raw refusal.
  const handleDelete = async () => {
    if (!editing) return;
    setError(null);
    setDeleting(true);
    try {
      if (affected.length > 0) {
        const target = reassignTo === "" ? otherRunners[0]?.id : reassignTo;
        if (!target) {
          setError("Add another Runner before deleting this default.");
          return;
        }
        for (const project of affected) {
          await updateProject({ projectId: project.id, defaultRunnerId: target });
        }
      }
      await deleteRunner(editing.id);
      reset();
      onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(false);
    }
  };

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

      {loadError ? (
        <QueryError error={loadError} onRetry={onRetry} label="Couldn't load Runners" />
      ) : loading ? (
        <SkeletonRows rows={3} h={34} />
      ) : (
        <div className="space-y-2">
          {runners.map((runner) => (
            <button
              key={runner.id}
              type="button"
              className={cn("runner-row", editing?.id === runner.id && "active")}
              onClick={() => {
                setEditing(runner);
                setKind(runner.kind);
                setName(runner.name);
                setLaunchCmd(runner.launchCmd);
                setResumeCmd(runner.resumeCmd);
                setEnvJson(runner.envJson);
                setReassignTo("");
                setError(null);
              }}
            >
              <span className="runner-kind">{runner.kind}</span>
              <span className="min-w-0 flex-1 truncate">{runner.name}</span>
              {usedAsDefault.has(runner.id) && <span className="count-pill">default</span>}
            </button>
          ))}
        </div>
      )}

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
          title={editing ? "kind is immutable once a Runner is created" : undefined}
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
          placeholder="Env JSON (MARROW_*/TERM are reserved)"
        />
        <div className="flex flex-wrap gap-1.5">
          {["{{workspace}}", "{{issueFile}}", "{{branch}}", "{{resumeToken}}"].map((token) => (
            <span key={token} className="token-hint" title="Shell-escaped before launch">
              {token}
            </span>
          ))}
        </div>
        {error && <div className="text-[12px] text-destructive">{error}</div>}
        <div className="flex flex-wrap gap-2">
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
              onClick={() => void handleDelete()}
              disabled={deleting || isLastRunner}
              title={isLastRunner ? "Can't delete the last Runner" : undefined}
            >
              Delete
            </Button>
          )}
        </div>
        {editing && affected.length > 0 && (
          <div className="degraded-note space-y-2">
            <div>
              Default Runner for {affected.length} Project{affected.length > 1 ? "s" : ""}:{" "}
              {affected.map((project) => project.name).join(", ")}. Reassign before deleting:
            </div>
            <select
              value={reassignTo}
              onChange={(event) => setReassignTo(event.target.value === "" ? "" : Number(event.target.value))}
              className="field"
            >
              <option value="">{otherRunners[0] ? `Reassign to ${otherRunners[0].name}` : "No other Runner"}</option>
              {otherRunners.map((runner) => (
                <option key={runner.id} value={runner.id}>
                  Reassign to {runner.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </form>

      <ClaudeHookManager />
    </aside>
  );
}

function ClaudeHookManager() {
  const statusQuery = useQuery({ queryKey: ["claude-hook"], queryFn: claudeHookStatus });
  const [error, setError] = useState<string | null>(null);
  const install = useMutation({
    mutationFn: installClaudeHook,
    onSuccess: () => {
      setError(null);
      void statusQuery.refetch();
    },
    onError: (err) => setError(String(err)),
  });
  const remove = useMutation({
    mutationFn: uninstallClaudeHook,
    onSuccess: () => {
      setError(null);
      void statusQuery.refetch();
    },
    onError: (err) => setError(String(err)),
  });
  const status = statusQuery.data;

  return (
    <section className="hook-panel mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-3.5 text-[var(--status-running)]" />
        <div className="label-caps">Claude attention hook</div>
        {status?.installed && <span className="count-pill">installed</span>}
      </div>
      <p className="text-[12px] text-[var(--fg3)]">
        Optionally add an additive <code className="token-hint">Stop</code> +{" "}
        <code className="token-hint">Notification</code> hook to your global Claude config so Claude
        Sessions auto-signal Needs Input. Nothing is written until you click Install; removing it
        leaves the rest of your config untouched.
      </p>
      {status && (
        <div className="truncate text-[11px] text-[var(--fg4)]" title={status.settingsPath}>
          {status.settingsPath}
        </div>
      )}
      {status && <pre className="hook-command">{status.command}</pre>}
      {error && <div className="text-[12px] text-destructive">{error}</div>}
      <div className="flex gap-2">
        {status?.installed ? (
          <Button variant="outline" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
            Remove hook
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => install.mutate()}
            disabled={install.isPending || statusQuery.isPending}
          >
            <ShieldCheck />
            Install hook
          </Button>
        )}
      </div>
    </section>
  );
}

type SearchResult = {
  kind: "project" | "issue";
  id: number;
  title: string;
  subtitle: string;
  snippet?: string;
};

/** Return a short window of `text` around the first match of `query`, ellipsized. */
function matchSnippet(text: string, query: string): string | undefined {
  if (!text) return undefined;
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return undefined;
  const start = Math.max(0, idx - 24);
  const end = Math.min(text.length, idx + query.length + 48);
  return `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
}

/**
 * Global command-palette search (⌘K / ⌘F) over Projects and Issues — including
 * the prompt/details text written into an Issue's description. Client-side over
 * already-loaded data; selecting a result navigates to it.
 */
function GlobalSearch({
  projects,
  issues,
  onClose,
  onPickProject,
  onPickIssue,
}: {
  projects: Project[];
  issues: Issue[];
  onClose: () => void;
  onPickProject: (projectId: number) => void;
  onPickIssue: (issueId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const trimmed = query.trim().toLowerCase();

  const results = useMemo<SearchResult[]>(() => {
    if (!trimmed) return [];
    const out: SearchResult[] = [];
    for (const project of projects) {
      if (`${project.name} ${project.path}`.toLowerCase().includes(trimmed)) {
        out.push({ kind: "project", id: project.id, title: project.name, subtitle: project.path });
      }
    }
    for (const issue of issues) {
      if (`${issue.title} ${issue.description} ${issue.projectName}`.toLowerCase().includes(trimmed)) {
        out.push({
          kind: "issue",
          id: issue.id,
          title: issue.title,
          subtitle: `${issue.projectName} · ${issue.stateType}`,
          snippet: matchSnippet(issue.description, trimmed),
        });
      }
    }
    return out.slice(0, 40);
  }, [trimmed, projects, issues]);

  useEffect(() => {
    setActive(0);
  }, [trimmed]);

  const choose = (result: SearchResult) => {
    if (result.kind === "project") onPickProject(result.id);
    else onPickIssue(result.id);
  };
  const optionId = (result: SearchResult) => `gsr-${result.kind}-${result.id}`;

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel search-palette" aria-describedby={undefined}>
          <Dialog.Title className="sr-only">Search Issues, Projects, and prompts</Dialog.Title>
          <div className="search-palette-input">
            <Search className="size-4 shrink-0 text-[var(--fg4)]" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search Issues, Projects, and prompts…"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="global-search-results"
              aria-activedescendant={results[active] ? optionId(results[active]) : undefined}
              aria-label="Search Issues, Projects, and prompts"
              onKeyDown={(event) => {
                // Keep our nav keys from leaking to FeedView's window keydown
                // listener (which is a native listener outside React's root).
                if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter") {
                  event.nativeEvent.stopPropagation();
                }
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (results.length === 0) return;
                  setActive((value) => Math.min(results.length - 1, value + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  if (results.length === 0) return;
                  setActive((value) => Math.max(0, value - 1));
                } else if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
                  event.preventDefault();
                  const result = results[active];
                  if (result) choose(result);
                }
              }}
            />
            <Kbd>esc</Kbd>
          </div>
          <span className="sr-only" aria-live="polite">
            {trimmed ? `${results.length} result${results.length === 1 ? "" : "s"}` : ""}
          </span>
          <div className="search-palette-results" id="global-search-results" role="listbox" aria-label="Search results">
            {!trimmed ? (
              <div className="search-hint">
                Search across Issue titles, prompts &amp; details, and Project names.
              </div>
            ) : results.length === 0 ? (
              <div className="search-hint">No matches for “{query.trim()}”.</div>
            ) : (
              results.map((result, index) => (
                <button
                  key={`${result.kind}-${result.id}`}
                  id={optionId(result)}
                  role="option"
                  aria-selected={index === active}
                  type="button"
                  className={cn("search-result", index === active && "active")}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(result)}
                >
                  <span className="search-result-icon">
                    {result.kind === "project" ? (
                      <FolderGit2 className="size-4" />
                    ) : (
                      <Inbox className="size-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium text-[var(--fg1)]">{result.title}</span>
                      <span className="search-result-kind">{result.kind}</span>
                    </span>
                    <span className="block truncate text-[11px] text-[var(--fg4)]">{result.subtitle}</span>
                    {result.snippet && (
                      <span className="block truncate text-[11px] text-[var(--fg3)]">{result.snippet}</span>
                    )}
                  </span>
                  <CornerDownLeft className="enter-hint size-3.5 shrink-0 text-[var(--fg4)]" />
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// The fixed loopback redirect the user registers on their Linear OAuth app.
// With no embedded server we read the `code` back by manual paste (see dialog).
const LINEAR_OAUTH_REDIRECT = "http://localhost:3939/callback";

/** Connect / manage the workspace-level Linear connection (API key or OAuth). */
function LinearConnectDialog({
  open,
  connection,
  onOpenChange,
  onChanged,
}: {
  open: boolean;
  connection: LinearConnection | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [method, setMethod] = useState<"api_key" | "oauth">("api_key");
  const [apiKey, setApiKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const connected = Boolean(connection?.connected);

  // Don't carry a failed attempt's error or half-typed secrets into the next open.
  useEffect(() => {
    if (!open) {
      setApiKey("");
      setClientSecret("");
      setCode("");
      setError(null);
    }
  }, [open]);

  const connectApiKey = useMutation({
    mutationFn: () => linearConnectApiKey(apiKey.trim()),
    onSuccess: () => {
      setApiKey("");
      setError(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });
  const completeOauth = useMutation({
    mutationFn: () =>
      linearCompleteOauth({ clientId: clientId.trim(), clientSecret: clientSecret.trim(), code: code.trim() }),
    onSuccess: () => {
      setCode("");
      setClientSecret("");
      setError(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });
  const disconnect = useMutation({
    mutationFn: linearDisconnect,
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });

  const authorize = async () => {
    setError(null);
    try {
      const url = await linearAuthorizeUrl({ clientId: clientId.trim() });
      await openExternal(url);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel linear-dialog" aria-describedby={undefined}>
          <div className="modal-head">
            <div className="flex items-center gap-2">
              <LinearGlyph />
              <Dialog.Title className="modal-title">Linear</Dialog.Title>
              {connected && <span className="count-pill">connected</span>}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>

          {connected ? (
            <div className="space-y-3">
              <div className="context-row">
                <Globe className="size-3.5" />
                {connection?.workspaceName ?? "Linear workspace"}
              </div>
              <div className="text-[12px] text-[var(--fg3)]">
                Connected via {connection?.method === "oauth" ? "OAuth" : "API key"}. Link a Project to a Linear
                Project from its sidebar menu to import Issues.
              </div>
              {error && <div className="text-[12px] text-destructive">{error}</div>}
              <Button variant="destructive" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
                <Unlink />
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="segmented w-full" role="group" aria-label="Connection method">
                <button
                  type="button"
                  aria-pressed={method === "api_key"}
                  className={cn("flex-1", method === "api_key" && "active")}
                  onClick={() => setMethod("api_key")}
                >
                  API key
                </button>
                <button
                  type="button"
                  aria-pressed={method === "oauth"}
                  className={cn("flex-1", method === "oauth" && "active")}
                  onClick={() => setMethod("oauth")}
                >
                  OAuth (browser)
                </button>
              </div>

              {method === "api_key" ? (
                <form
                  className="space-y-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (apiKey.trim()) connectApiKey.mutate();
                  }}
                >
                  <p className="text-[12px] text-[var(--fg3)]">
                    Create a personal API key in Linear → Settings → Security &amp; access → Personal API keys, then
                    paste it here. Stored locally on this machine only.
                  </p>
                  <label className="search-field linear-key-field">
                    <KeyRound className="size-3.5" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      placeholder="lin_api_…"
                      aria-label="Linear API key"
                    />
                  </label>
                  {error && <div className="text-[12px] text-destructive">{error}</div>}
                  <Button type="submit" disabled={!apiKey.trim() || connectApiKey.isPending}>
                    {connectApiKey.isPending ? <LoaderCircle className="animate-spin" /> : <Plug />}
                    Connect
                  </Button>
                </form>
              ) : (
                <div className="space-y-2">
                  <p className="text-[12px] text-[var(--fg3)]">
                    Create an OAuth application in Linear → Settings → API → OAuth applications with redirect URI{" "}
                    <code className="token-hint">{LINEAR_OAUTH_REDIRECT}</code>, then authorize below. After approving,
                    copy the <em>entire URL</em> from the address bar (it carries the code and a one-time security
                    token) and paste it below.
                  </p>
                  <input
                    value={clientId}
                    onChange={(event) => setClientId(event.target.value)}
                    placeholder="Client ID"
                    className="field font-mono"
                    aria-label="Linear OAuth client ID"
                  />
                  <Button variant="outline" onClick={() => void authorize()} disabled={!clientId.trim()}>
                    <ExternalLink />
                    Authorize in browser
                  </Button>
                  <input
                    value={clientSecret}
                    onChange={(event) => setClientSecret(event.target.value)}
                    placeholder="Client secret"
                    type="password"
                    className="field font-mono"
                    aria-label="Linear OAuth client secret"
                  />
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Paste the full redirect URL"
                    className="field font-mono"
                    aria-label="Linear redirect URL"
                  />
                  {error && <div className="text-[12px] text-destructive">{error}</div>}
                  <Button
                    onClick={() => completeOauth.mutate()}
                    disabled={!clientId.trim() || !clientSecret.trim() || !code.trim() || completeOauth.isPending}
                  >
                    {completeOauth.isPending ? <LoaderCircle className="animate-spin" /> : <Check />}
                    Complete connection
                  </Button>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Link a single Project to a Linear Project and import its Issues. */
function LinearLinkDialog({
  project,
  connected,
  onClose,
  onConnect,
  onChanged,
}: {
  project: Project | null;
  connected: boolean;
  onClose: () => void;
  onConnect: () => void;
  onChanged: () => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number | null>(null);
  const open = project !== null;

  const projectsQuery = useQuery({
    queryKey: ["linear-projects"],
    queryFn: linearListProjects,
    enabled: open && connected,
  });
  const linearProjects = projectsQuery.data ?? [];

  useEffect(() => {
    if (open) {
      setSelected("");
      setError(null);
      setImported(null);
    }
  }, [open, project?.id]);

  const linkAndImport = useMutation({
    mutationFn: async () => {
      if (!project) return { imported: 0 };
      const chosen = linearProjects.find((candidate) => candidate.id === selected);
      await linearLinkProject({
        projectId: project.id,
        linearProjectId: selected,
        linearProjectName: chosen?.name ?? null,
        linearKey: chosen?.teamKey ?? chosen?.name ?? null,
        linearUrl: chosen?.url ?? null,
      });
      return linearImportIssues({ projectId: project.id });
    },
    onSuccess: (result) => {
      setImported(result.imported);
      setError(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });
  const reimport = useMutation({
    mutationFn: () => linearImportIssues({ projectId: project?.id as number }),
    onSuccess: (result) => {
      setImported(result.imported);
      setError(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });
  const unlink = useMutation({
    mutationFn: () => linearUnlinkProject({ projectId: project?.id as number }),
    onSuccess: () => {
      setError(null);
      setImported(null);
      onChanged();
    },
    onError: (err) => setError(String(err)),
  });

  const alreadyLinked = Boolean(project?.linearKey || project?.linearUrl);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="modal-overlay" />
        <Dialog.Content className="modal-panel linear-dialog" aria-describedby={undefined}>
          <div className="modal-head">
            <div className="flex min-w-0 items-center gap-2">
              <LinearGlyph />
              <Dialog.Title className="modal-title truncate">
                Linear · {project?.name ?? "Project"}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>

          {!connected ? (
            <div className="space-y-3">
              <p className="text-[12px] text-[var(--fg3)]">
                Connect your Linear workspace first, then link this Project to a Linear Project and import its Issues.
              </p>
              <Button onClick={onConnect}>
                <Plug />
                Connect Linear
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {alreadyLinked && (
                <div className="context-row">
                  <Link2 className="size-3.5" />
                  Linked to {project?.linearKey ?? project?.linearUrl}
                </div>
              )}
              {projectsQuery.isError ? (
                <QueryError
                  error={projectsQuery.error}
                  onRetry={() => void projectsQuery.refetch()}
                  label="Couldn't load Linear Projects"
                />
              ) : projectsQuery.isPending ? (
                <SkeletonRows rows={3} h={32} />
              ) : (
                <select
                  value={selected}
                  onChange={(event) => setSelected(event.target.value)}
                  className="field"
                  aria-label="Linear Project"
                >
                  <option value="">Select a Linear Project…</option>
                  {linearProjects.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.teamName ? `${candidate.teamName} · ` : ""}
                      {candidate.name}
                    </option>
                  ))}
                </select>
              )}
              {imported !== null && (
                <div className="text-[12px] text-[var(--status-running)]">
                  Synced {imported} Issue(s) from Linear.
                </div>
              )}
              {error && <div className="text-[12px] text-destructive">{error}</div>}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => linkAndImport.mutate()}
                  disabled={!selected || linkAndImport.isPending}
                >
                  {linkAndImport.isPending ? <LoaderCircle className="animate-spin" /> : <Link2 />}
                  Link &amp; import Issues
                </Button>
                {alreadyLinked && (
                  <Button variant="outline" onClick={() => reimport.mutate()} disabled={reimport.isPending}>
                    {reimport.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                    Re-import
                  </Button>
                )}
                {alreadyLinked && (
                  <Button variant="destructive" onClick={() => unlink.mutate()} disabled={unlink.isPending}>
                    <Unlink />
                    Unlink
                  </Button>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Small Linear-style glyph for the connect dialogs. */
function LinearGlyph() {
  return (
    <span className="linear-glyph" aria-hidden>
      <svg viewBox="0 0 100 100" width="14" height="14">
        <path
          fill="currentColor"
          d="M1.2 61.4a1 1 0 0 1 1.7-.5l36.2 36.2a1 1 0 0 1-.5 1.7C20.6 95.6 4.4 79.4 1.2 61.4Zm-.9-15.8a1 1 0 0 0 .3.8l53 53a1 1 0 0 0 .8.3 49.6 49.6 0 0 0 8.9-1.7 1 1 0 0 0 .4-1.7L3.7 36.3a1 1 0 0 0-1.7.4 49.6 49.6 0 0 0-1.7 8.9ZM6.7 26a1 1 0 0 0 .2 1.2l65.9 65.9a1 1 0 0 0 1.2.2 50.3 50.3 0 0 0 6.5-4.2 1 1 0 0 0 .1-1.5L12.4 19.3a1 1 0 0 0-1.5.1 50.3 50.3 0 0 0-4.2 6.5ZM21 12a1 1 0 0 0 0 1.4l65.6 65.6a1 1 0 0 0 1.4 0A50 50 0 0 0 21 12Z"
        />
      </svg>
    </span>
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

function Skeleton({ h = 14, w = "100%" }: { h?: number; w?: number | string }) {
  return <div className="skeleton" style={{ height: h, width: w } as CSSProperties} aria-hidden />;
}

function SkeletonRows({ rows = 3, h = 44 }: { rows?: number; h?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} h={h} />
      ))}
    </div>
  );
}

function QueryError({
  error,
  onRetry,
  label = "Couldn't load",
}: {
  error: unknown;
  onRetry: () => void;
  label?: string;
}) {
  return (
    <div className="query-error" role="alert">
      <span className="flex min-w-0 items-center gap-1.5">
        <AlertCircle className="size-3.5 shrink-0" />
        <span className="truncate">
          {label}: {String((error as Error)?.message ?? error)}
        </span>
      </span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" />
        Retry
      </Button>
    </div>
  );
}

function DiffPanel({
  data,
  isPending,
  isError,
  error,
  onRetry,
}: {
  data?: WorkspaceDiff;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  if (isError) return <QueryError error={error} onRetry={onRetry} label="Couldn't load diff" />;
  if (isPending) return <Skeleton h={72} />;
  if (!data) return null;
  if (!data.gitBacked) {
    return <div className="degraded-note">Not a git Workspace — diff is unavailable.</div>;
  }
  return (
    <>
      <pre className="diff-block">{data.summary}</pre>
      <div className="mt-2 flex gap-2 font-mono text-[11px]">
        <span>{data.changedFiles} files</span>
        <span className="text-[var(--status-running)]">+{data.insertions}</span>
        <span className="text-[var(--status-exited)]">-{data.deletions}</span>
      </div>
    </>
  );
}

/** Compact one-line representation of a Linear key as a (display-only) chip. */
function LinearChip({ linearKey, linearUrl }: { linearKey: string | null; linearUrl: string | null }) {
  if (!linearKey && !linearUrl) return null;
  const label = linearKey ?? "Linear";
  if (linearUrl) {
    return (
      <a className="linear-chip" href={linearUrl} target="_blank" rel="noreferrer" title={linearUrl}>
        {label}
      </a>
    );
  }
  return <span className="linear-chip">{label}</span>;
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

const COCKPIT_ORDER_KEY = "marrow:cockpit-order";

function loadCockpitOrder(): number[] {
  try {
    const raw = localStorage.getItem(COCKPIT_ORDER_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [];
  } catch {
    return [];
  }
}

function saveCockpitOrder(order: number[]) {
  try {
    localStorage.setItem(COCKPIT_ORDER_KEY, JSON.stringify(order));
  } catch {
    // localStorage may be unavailable; ordering is a nicety, not load-bearing.
  }
}

const PINNED_PROJECTS_KEY = "marrow:pinned-projects";

function loadPinnedProjects(): Set<number> {
  try {
    const raw = localStorage.getItem(PINNED_PROJECTS_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((value): value is number => typeof value === "number") : [],
    );
  } catch {
    return new Set();
  }
}

function savePinnedProjects(pinned: Set<number>) {
  try {
    localStorage.setItem(PINNED_PROJECTS_KEY, JSON.stringify([...pinned]));
  } catch {
    // localStorage may be unavailable; pinning is a nicety, not load-bearing.
  }
}

/** Strip ANSI/control noise from raw PTY scrollback and keep the last lines. */
function previewText(raw: string): string {
  const clean = raw
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "") // OSC sequences
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "") // CSI sequences
    .replace(/\u001b[@-Z\\-_]/g, "") // other escape sequences
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ""); // stray control bytes (keep \n, \t)
  const lines = clean.split("\n").map((line) => line.replace(/\s+$/g, ""));
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines.slice(-14).join("\n");
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
