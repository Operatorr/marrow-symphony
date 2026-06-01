use crate::models::{
    CreateIssueInput, CreateProjectInput, Issue, ListIssuesInput, ListSessionsInput, Project,
    SessionSummary,
};
use crate::state::AppState;
use std::path::{Path, PathBuf};
use tauri::State;

const PROJECT_COLORS: [&str; 8] = [
    "#2563eb", "#059669", "#d97706", "#7c3aed", "#dc2626", "#0891b2", "#4f46e5", "#be123c",
];

const DEFAULT_COLUMNS: [(&str, &str); 6] = [
    ("Backlog", "backlog"),
    ("Todo", "todo"),
    ("Started", "started"),
    ("In Review", "in-review"),
    ("Done", "done"),
    ("Canceled", "canceled"),
];

pub async fn create_project_impl(
    state: &AppState,
    input: CreateProjectInput,
) -> Result<Project, String> {
    let path = canonical_project_path(&input.path)?;
    let name = normalize_project_name(input.name, &path)?;
    let git_backed = path.join(".git").exists();

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects")
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to count Projects: {err}"))?;
    let color = PROJECT_COLORS[(count.0 as usize) % PROJECT_COLORS.len()];

    let result = sqlx::query(
        "INSERT INTO projects (name, path, git_backed, default_runner, default_workspace_strategy, color)
         VALUES (?1, ?2, ?3, 'claude', 'shared_checkout', ?4)",
    )
    .bind(&name)
    .bind(path.to_string_lossy().to_string())
    .bind(git_backed)
    .bind(color)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Project: {err}"))?;

    let project_id = result.last_insert_rowid();
    for (position, (label, state_type)) in DEFAULT_COLUMNS.iter().enumerate() {
        sqlx::query(
            "INSERT INTO board_columns (project_id, label, state_type, position)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(project_id)
        .bind(label)
        .bind(state_type)
        .bind(position as i64)
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to create default board columns: {err}"))?;
    }

    get_project(&state.pool, project_id).await
}

pub async fn list_projects_impl(state: &AppState) -> Result<Vec<Project>, String> {
    sqlx::query_as::<_, Project>(
        "SELECT id, name, path, git_backed, default_runner, default_workspace_strategy, color,
                created_at, updated_at
         FROM projects
         ORDER BY created_at DESC, id DESC",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|err| format!("failed to list Projects: {err}"))
}

pub async fn create_issue_impl(state: &AppState, input: CreateIssueInput) -> Result<Issue, String> {
    let title = input.title.trim();
    if title.is_empty() {
        return Err("Issue title is required".to_string());
    }

    sqlx::query("SELECT id FROM projects WHERE id = ?1")
        .bind(input.project_id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|err| format!("failed to check Project: {err}"))?
        .ok_or_else(|| format!("Project {} does not exist", input.project_id))?;

    let result = sqlx::query(
        "INSERT INTO issues (project_id, title, description, state_type, workspace_strategy)
         VALUES (?1, ?2, ?3, 'todo', 'shared_checkout')",
    )
    .bind(input.project_id)
    .bind(title)
    .bind(input.description.trim())
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Issue: {err}"))?;

    get_issue(&state.pool, result.last_insert_rowid()).await
}

pub async fn list_issues_impl(
    state: &AppState,
    input: ListIssuesInput,
) -> Result<Vec<Issue>, String> {
    match input.project_id {
        Some(project_id) => sqlx::query_as::<_, Issue>(
            "SELECT id, project_id, title, description, state_type, runner_override,
                    workspace_strategy, created_at, updated_at
             FROM issues
             WHERE project_id = ?1
             ORDER BY created_at DESC, id DESC",
        )
        .bind(project_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|err| format!("failed to list Issues: {err}")),
        None => sqlx::query_as::<_, Issue>(
            "SELECT id, project_id, title, description, state_type, runner_override,
                    workspace_strategy, created_at, updated_at
             FROM issues
             ORDER BY created_at DESC, id DESC",
        )
        .fetch_all(&state.pool)
        .await
        .map_err(|err| format!("failed to list Issues: {err}")),
    }
}

pub async fn list_sessions_impl(
    state: &AppState,
    input: ListSessionsInput,
) -> Result<Vec<SessionSummary>, String> {
    match input.project_id {
        Some(project_id) => sqlx::query_as::<_, SessionSummary>(SESSION_SELECT_BY_PROJECT)
            .bind(project_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|err| format!("failed to list Sessions: {err}")),
        None => sqlx::query_as::<_, SessionSummary>(SESSION_SELECT_ALL)
            .fetch_all(&state.pool)
            .await
            .map_err(|err| format!("failed to list Sessions: {err}")),
    }
}

pub async fn get_session_summary(
    state: &AppState,
    session_id: i64,
) -> Result<SessionSummary, String> {
    sqlx::query_as::<_, SessionSummary>(SESSION_SELECT_BY_ID)
        .bind(session_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to load Session {session_id}: {err}"))
}

#[tauri::command]
pub async fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<Project, String> {
    create_project_impl(&state, input).await
}

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    list_projects_impl(&state).await
}

#[tauri::command]
pub async fn create_issue(
    state: State<'_, AppState>,
    input: CreateIssueInput,
) -> Result<Issue, String> {
    create_issue_impl(&state, input).await
}

#[tauri::command]
pub async fn list_issues(
    state: State<'_, AppState>,
    input: ListIssuesInput,
) -> Result<Vec<Issue>, String> {
    list_issues_impl(&state, input).await
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
    input: ListSessionsInput,
) -> Result<Vec<SessionSummary>, String> {
    list_sessions_impl(&state, input).await
}

async fn get_project(pool: &sqlx::SqlitePool, id: i64) -> Result<Project, String> {
    sqlx::query_as::<_, Project>(
        "SELECT id, name, path, git_backed, default_runner, default_workspace_strategy, color,
                created_at, updated_at
         FROM projects
         WHERE id = ?1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to load Project {id}: {err}"))
}

async fn get_issue(pool: &sqlx::SqlitePool, id: i64) -> Result<Issue, String> {
    sqlx::query_as::<_, Issue>(
        "SELECT id, project_id, title, description, state_type, runner_override,
                workspace_strategy, created_at, updated_at
         FROM issues
         WHERE id = ?1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to load Issue {id}: {err}"))
}

fn canonical_project_path(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim();
    if trimmed.is_empty() {
        return Err("Project path is required".to_string());
    }

    let path = Path::new(trimmed);
    let metadata = path
        .metadata()
        .map_err(|err| format!("Project path {trimmed} is not readable: {err}"))?;
    if !metadata.is_dir() {
        return Err(format!("Project path {trimmed} is not a directory"));
    }

    path.canonicalize()
        .map_err(|err| format!("failed to resolve Project path {trimmed}: {err}"))
}

fn normalize_project_name(raw_name: Option<String>, path: &Path) -> Result<String, String> {
    if let Some(name) = raw_name {
        let name = name.trim();
        if !name.is_empty() {
            return Ok(name.to_string());
        }
    }

    path.file_name()
        .and_then(|name| name.to_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Project name is required".to_string())
}

const SESSION_SELECT_ALL: &str = "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, s.runner, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
ORDER BY
  CASE s.status
    WHEN 'needs_input' THEN 0
    WHEN 'running' THEN 1
    WHEN 'idle' THEN 2
    ELSE 3
  END,
  s.started_at DESC,
  s.id DESC";

const SESSION_SELECT_BY_PROJECT: &str =
    "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, s.runner, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
WHERE s.project_id = ?1
ORDER BY
  CASE s.status
    WHEN 'needs_input' THEN 0
    WHEN 'running' THEN 1
    WHEN 'idle' THEN 2
    ELSE 3
  END,
  s.started_at DESC,
  s.id DESC";

const SESSION_SELECT_BY_ID: &str = "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, s.runner, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
WHERE s.id = ?1
ORDER BY
  CASE s.status
    WHEN 'needs_input' THEN 0
    WHEN 'running' THEN 1
    WHEN 'idle' THEN 2
    ELSE 3
  END,
  s.started_at DESC,
  s.id DESC";
