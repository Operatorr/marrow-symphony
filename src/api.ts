import { invoke } from "@tauri-apps/api/core";
import type { Issue, Project, SessionSummary } from "@/types";

export function ping() {
  return invoke<string>("ping");
}

export function openProjectDirectory() {
  return invoke<string | string[] | null>("plugin:dialog|open", {
    options: {
      title: "Add Project",
      directory: true,
      multiple: false,
      canCreateDirectories: false,
    },
  }).then((selected) => (Array.isArray(selected) ? (selected[0] ?? null) : selected));
}

export function createProject(input: { path: string; name?: string }) {
  return invoke<Project>("create_project", { input });
}

export function listProjects() {
  return invoke<Project[]>("list_projects");
}

export function createIssue(input: {
  projectId: number;
  title: string;
  description: string;
}) {
  return invoke<Issue>("create_issue", { input });
}

export function listIssues(input: { projectId?: number | null }) {
  return invoke<Issue[]>("list_issues", { input });
}

export function listSessions(input: { projectId?: number | null }) {
  return invoke<SessionSummary[]>("list_sessions", { input });
}

export function startSession(issueId: number) {
  return invoke<SessionSummary>("start_session", { input: { issueId } });
}

export function writeToSession(sessionId: number, data: string) {
  return invoke<void>("write_to_session", { input: { sessionId, data } });
}

export function resizeSession(sessionId: number, cols: number, rows: number) {
  return invoke<void>("resize_session", { input: { sessionId, cols, rows } });
}

export function killSession(sessionId: number) {
  return invoke<void>("kill_session", { input: { sessionId } });
}
