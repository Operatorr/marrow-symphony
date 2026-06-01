export interface Project {
  id: number;
  name: string;
  path: string;
  gitBacked: boolean;
  defaultRunner: string;
  defaultWorkspaceStrategy: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface Issue {
  id: number;
  projectId: number;
  title: string;
  description: string;
  stateType: string;
  runnerOverride: string | null;
  workspaceStrategy: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  id: number;
  issueId: number;
  projectId: number;
  issueTitle: string;
  projectName: string;
  runner: string;
  status: "running" | "needs_input" | "idle" | "exited";
  workspacePath: string;
  issueFilePath: string | null;
  pid: number | null;
  exitCode: number | null;
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

export type ViewMode = "board" | "cockpit" | "feed";
