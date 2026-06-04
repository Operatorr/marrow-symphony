import { invoke } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import type {
  BoardColumn,
  ClaudeHookStatus,
  Group,
  Issue,
  IssueComment,
  LinearConnection,
  LinearImportResult,
  LinearProject,
  Project,
  Runner,
  SessionSummary,
  StateType,
  TransitionIssueResult,
  WorkspaceDiff,
} from "@/types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function isTauriRuntime() {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

function unavailable(action: string) {
  return Promise.reject(new Error(`${action} is available in the Tauri app.`));
}

export function openProjectDirectory() {
  if (!isTauriRuntime()) return Promise.resolve(null);
  return invoke<string | string[] | null>("plugin:dialog|open", {
    options: {
      title: "Add Project",
      directory: true,
      multiple: false,
      canCreateDirectories: false,
    },
  }).then((selected) => (Array.isArray(selected) ? (selected[0] ?? null) : selected));
}

export function createProject(input: {
  path: string;
  name?: string;
  groupId?: number | null;
  groupName?: string | null;
}) {
  if (!isTauriRuntime()) return unavailable("Project creation");
  return invoke<Project>("create_project", { input });
}

export function listProjects() {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<Project[]>("list_projects");
}

export function listGroups() {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<Group[]>("list_groups");
}

export function createGroup(input: { name: string }) {
  if (!isTauriRuntime()) return unavailable("Group creation");
  return invoke<Group>("create_group", { input });
}

export function createIssue(input: {
  projectId: number;
  title: string;
  description: string;
}) {
  if (!isTauriRuntime()) return unavailable("Issue creation");
  return invoke<Issue>("create_issue", { input });
}

export function updateIssue(input: {
  issueId: number;
  title?: string;
  description?: string;
  stateType?: StateType;
  runnerOverrideId?: number | null;
  workspaceStrategy?: string;
  linearKey?: string;
  linearUrl?: string;
}) {
  if (!isTauriRuntime()) return unavailable("Issue updates");
  return invoke<Issue>("update_issue", { input });
}

export function updateProject(input: {
  projectId: number;
  name?: string;
  defaultRunnerId?: number;
  defaultWorkspaceStrategy?: string;
  linearKey?: string;
  linearUrl?: string;
}) {
  if (!isTauriRuntime()) return unavailable("Project updates");
  return invoke<Project>("update_project", { input });
}

export function transitionIssue(input: {
  issueId: number;
  stateType: StateType;
  cleanupLiveSessions?: boolean;
}) {
  if (!isTauriRuntime()) return unavailable("Issue transitions");
  return invoke<TransitionIssueResult>("transition_issue", { input });
}

export function listIssues(input: { projectId?: number | null }) {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<Issue[]>("list_issues", { input });
}

export function listBoardColumns(projectId: number) {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<BoardColumn[]>("list_board_columns", { input: { projectId } });
}

export function listSessions(input: { projectId?: number | null }) {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<SessionSummary[]>("list_sessions", { input });
}

export function startSession(issueId: number, resumeSessionId?: number) {
  if (!isTauriRuntime()) return unavailable("Session start");
  return invoke<SessionSummary>("start_session", {
    input: { issueId, resumeSessionId: resumeSessionId ?? null },
  });
}

export function restartSession(sessionId: number) {
  if (!isTauriRuntime()) return unavailable("Session restart");
  return invoke<SessionSummary>("restart_session", { input: { sessionId } });
}

export function resumeSession(sessionId: number) {
  if (!isTauriRuntime()) return unavailable("Session resume");
  return invoke<SessionSummary>("resume_session", { input: { sessionId } });
}

export function writeToSession(sessionId: number, data: string) {
  if (!isTauriRuntime()) return Promise.resolve();
  return invoke<void>("write_to_session", { input: { sessionId, data } });
}

export function resizeSession(sessionId: number, cols: number, rows: number) {
  if (!isTauriRuntime()) return Promise.resolve();
  return invoke<void>("resize_session", { input: { sessionId, cols, rows } });
}

export function killSession(sessionId: number) {
  if (!isTauriRuntime()) return unavailable("Session kill");
  return invoke<void>("kill_session", { input: { sessionId } });
}

export function setSessionStatus(sessionId: number, status: SessionSummary["status"]) {
  if (!isTauriRuntime()) return unavailable("Session status changes");
  return invoke<SessionSummary>("set_session_status", { input: { sessionId, status } });
}

export function snoozeSession(sessionId: number) {
  if (!isTauriRuntime()) return unavailable("Session snooze");
  return invoke<SessionSummary>("snooze_session", { input: { sessionId } });
}

export function getSessionScrollback(sessionId: number) {
  if (!isTauriRuntime()) return Promise.resolve("");
  return invoke<string>("get_session_scrollback", { input: { sessionId } });
}

export function listRunners() {
  if (!isTauriRuntime()) {
    return Promise.resolve([
      {
        id: 1,
        kind: "claude" as const,
        name: "Claude",
        launchCmd: "claude",
        resumeCmd: "claude --resume {{resumeToken}}",
        envJson: "{}",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: 2,
        kind: "codex" as const,
        name: "Codex",
        launchCmd: "codex",
        resumeCmd: "codex resume {{resumeToken}}",
        envJson: "{}",
        createdAt: "",
        updatedAt: "",
      },
    ]);
  }
  return invoke<Runner[]>("list_runners");
}

export function createRunner(input: {
  kind: Runner["kind"];
  name: string;
  launchCmd: string;
  resumeCmd?: string;
  envJson?: string;
}) {
  if (!isTauriRuntime()) return unavailable("Runner creation");
  return invoke<Runner>("create_runner", { input });
}

export function updateRunner(input: {
  runnerId: number;
  name?: string;
  launchCmd?: string;
  resumeCmd?: string;
  envJson?: string;
}) {
  if (!isTauriRuntime()) return unavailable("Runner updates");
  return invoke<Runner>("update_runner", { input });
}

export function deleteRunner(runnerId: number) {
  if (!isTauriRuntime()) return unavailable("Runner deletion");
  return invoke<void>("delete_runner", { input: { runnerId } });
}

export function workspaceDiff(input: {
  sessionId?: number | null;
  issueId?: number | null;
  projectId?: number | null;
}) {
  if (!isTauriRuntime()) {
    return Promise.resolve({
      gitBacked: false,
      branch: null,
      summary: "Workspace diff is available in the Tauri app.",
      changedFiles: 0,
      insertions: 0,
      deletions: 0,
    });
  }
  return invoke<WorkspaceDiff>("workspace_diff", { input });
}

export function listIssueComments(issueId: number) {
  if (!isTauriRuntime()) return Promise.resolve([]);
  return invoke<IssueComment[]>("list_issue_comments", { input: { issueId } });
}

export function createIssueComment(input: {
  issueId: number;
  sessionId?: number | null;
  author?: string;
  body: string;
}) {
  if (!isTauriRuntime()) return unavailable("Issue comments");
  return invoke<IssueComment>("create_issue_comment", { input });
}

const NO_HOOK: ClaudeHookStatus = {
  installed: false,
  settingsPath: "~/.claude/settings.json",
  settingsExists: false,
  command: "marrow notify --needs-input",
};

export function claudeHookStatus() {
  if (!isTauriRuntime()) return Promise.resolve(NO_HOOK);
  return invoke<ClaudeHookStatus>("claude_hook_status");
}

export function installClaudeHook() {
  if (!isTauriRuntime()) return unavailable("Installing the Claude hook");
  return invoke<ClaudeHookStatus>("install_claude_hook");
}

export function uninstallClaudeHook() {
  if (!isTauriRuntime()) return unavailable("Removing the Claude hook");
  return invoke<ClaudeHookStatus>("uninstall_claude_hook");
}

/** Open a URL in the user's default browser (Tauri opener plugin). */
export function openExternal(url: string) {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return Promise.resolve();
  }
  return openUrl(url);
}

const DISCONNECTED: LinearConnection = { connected: false, method: null, workspaceName: null };

export function linearStatus() {
  if (!isTauriRuntime()) return Promise.resolve(DISCONNECTED);
  return invoke<LinearConnection>("linear_status");
}

export function linearConnectApiKey(apiKey: string) {
  if (!isTauriRuntime()) return unavailable("Connecting Linear");
  return invoke<LinearConnection>("linear_connect_api_key", { input: { apiKey } });
}

export function linearAuthorizeUrl(input: { clientId: string }) {
  if (!isTauriRuntime()) return unavailable("Linear OAuth");
  return invoke<string>("linear_authorize_url", { input });
}

export function linearCompleteOauth(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}) {
  if (!isTauriRuntime()) return unavailable("Linear OAuth");
  return invoke<LinearConnection>("linear_complete_oauth", { input });
}

export function linearDisconnect() {
  if (!isTauriRuntime()) return unavailable("Disconnecting Linear");
  return invoke<LinearConnection>("linear_disconnect");
}

export function linearListProjects() {
  if (!isTauriRuntime()) return Promise.resolve([] as LinearProject[]);
  return invoke<LinearProject[]>("linear_list_projects");
}

export function linearLinkProject(input: {
  projectId: number;
  linearProjectId: string;
  linearProjectName: string | null;
  linearKey: string | null;
  linearUrl: string | null;
}) {
  if (!isTauriRuntime()) return unavailable("Linking a Linear Project");
  return invoke<Project>("linear_link_project", { input });
}

export function linearUnlinkProject(input: { projectId: number }) {
  if (!isTauriRuntime()) return unavailable("Unlinking a Linear Project");
  return invoke<Project>("linear_unlink_project", { input });
}

export function linearImportIssues(input: { projectId: number }) {
  if (!isTauriRuntime()) return unavailable("Importing Linear Issues");
  return invoke<LinearImportResult>("linear_import_issues", { input });
}
