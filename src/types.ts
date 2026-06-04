export interface Project {
  id: number;
  groupId: number | null;
  groupName: string | null;
  name: string;
  path: string;
  gitBacked: boolean;
  defaultRunner: string;
  defaultRunnerId: number | null;
  defaultWorkspaceStrategy: string;
  color: string;
  colorIndex: number;
  linearUrl: string | null;
  linearKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoardColumn {
  id: number;
  projectId: number;
  label: string;
  stateType: StateType;
  position: number;
}

export type StateType = "backlog" | "todo" | "started" | "in-review" | "done" | "canceled";

export interface Issue {
  id: number;
  projectId: number;
  projectName: string;
  projectColor: string;
  projectColorIndex: number;
  title: string;
  description: string;
  stateType: StateType;
  runnerOverride: string | null;
  runnerOverrideId: number | null;
  workspaceStrategy: string;
  linearUrl: string | null;
  linearKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Runner {
  id: number;
  kind: "claude" | "codex" | "generic";
  name: string;
  launchCmd: string;
  resumeCmd: string;
  envJson: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: number;
  issueId: number;
  projectId: number;
  issueTitle: string;
  projectName: string;
  projectColor: string;
  projectColorIndex: number;
  runner: string;
  runnerId: number | null;
  runnerKind: Runner["kind"];
  status: "running" | "needs_input" | "idle" | "exited";
  workspacePath: string;
  issueFilePath: string | null;
  pid: number | null;
  exitCode: number | null;
  resumeToken: string | null;
  needsInputSince: string | null;
  snoozedUntil: string | null;
  startedAt: string;
  exitedAt: string | null;
}

export interface SessionOutputEvent {
  sessionId: number;
  data: string;
}

export interface SessionStatusEvent {
  sessionId: number;
  status: SessionSummary["status"];
  exitCode: number | null;
}

export interface TransitionIssueResult {
  issue: Issue;
  startedSession: SessionSummary | null;
  killedSessions: number;
}

export interface WorkspaceDiff {
  gitBacked: boolean;
  branch: string | null;
  summary: string;
  changedFiles: number;
  insertions: number;
  deletions: number;
}

export interface IssueComment {
  id: number;
  issueId: number;
  sessionId: number | null;
  author: string;
  body: string;
  createdAt: string;
}

export interface ClaudeHookStatus {
  installed: boolean;
  settingsPath: string;
  settingsExists: boolean;
  command: string;
}

export type ViewMode = "board" | "sessions" | "feed";

export interface LinearConnection {
  connected: boolean;
  method: "api_key" | "oauth" | null;
  workspaceName: string | null;
}

export interface LinearProject {
  id: string;
  name: string;
  teamName: string | null;
  teamKey: string | null;
  url: string | null;
}

export interface LinearImportResult {
  imported: number;
}
