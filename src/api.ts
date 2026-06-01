import { invoke } from "@tauri-apps/api/core";
import type {
  BoardColumn,
  Group,
  Issue,
  IssueComment,
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

export function ping() {
  if (!isTauriRuntime()) return Promise.resolve("browser preview");
  return invoke<string>("ping");
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
}) {
  if (!isTauriRuntime()) return unavailable("Issue updates");
  return invoke<Issue>("update_issue", { input });
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
