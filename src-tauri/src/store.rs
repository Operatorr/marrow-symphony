use crate::models::{
    BoardColumn, CreateGroupInput, CreateIssueCommentInput, CreateIssueInput, CreateProjectInput,
    CreateRunnerInput, DeleteRunnerInput, Group, Issue, IssueComment, IssueCommentsInput,
    ListBoardColumnsInput, ListIssuesInput, ListSessionsInput, Project, Runner, SessionSummary,
    StartSessionInput, TransitionIssueInput, TransitionIssueResult, UpdateIssueInput,
    UpdateProjectInput, UpdateRunnerInput, WorkspaceDiff, WorkspaceDiffInput,
};
use crate::state::AppState;
use crate::workspace::prepare_workspace;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, State};

const PROJECT_COLORS: [&str; 6] = [
    "#5318c9", "#79fa87", "#d946ef", "#671b4d", "#ffb300", "#00d9ff",
];

const DEFAULT_COLUMNS: [(&str, &str); 6] = [
    ("Backlog", "backlog"),
    ("Todo", "todo"),
    ("Started", "started"),
    ("In Review", "in-review"),
    ("Done", "done"),
    ("Canceled", "canceled"),
];

const VALID_STATES: [&str; 6] = ["backlog", "todo", "started", "in-review", "done", "canceled"];

pub async fn create_project_impl(
    state: &AppState,
    input: CreateProjectInput,
) -> Result<Project, String> {
    let path = canonical_project_path(&input.path)?;
    let name = normalize_project_name(input.name, &path)?;
    let git_backed = path.join(".git").exists();
    let group_id = resolve_group_id(&state.pool, input.group_id, input.group_name).await?;
    let default_runner_id = default_runner_id(&state.pool).await?;

    let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM projects")
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to count Projects: {err}"))?;
    let color_index = (count.0 % PROJECT_COLORS.len() as i64) + 1;
    let color = PROJECT_COLORS[(color_index - 1) as usize];

    let result = sqlx::query(
        "INSERT INTO projects (
           group_id, name, path, git_backed, default_runner, default_runner_id,
           default_workspace_strategy, color, color_index
         )
         VALUES (?1, ?2, ?3, ?4, 'Claude', ?5, 'shared_checkout', ?6, ?7)",
    )
    .bind(group_id)
    .bind(&name)
    .bind(path.to_string_lossy().to_string())
    .bind(git_backed)
    .bind(default_runner_id)
    .bind(color)
    .bind(color_index)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Project: {err}"))?;

    let project_id = result.last_insert_rowid();
    seed_default_columns(&state.pool, project_id).await?;
    get_project(&state.pool, project_id).await
}

pub async fn list_projects_impl(state: &AppState) -> Result<Vec<Project>, String> {
    sqlx::query_as::<_, Project>(PROJECT_SELECT_ALL)
        .fetch_all(&state.pool)
        .await
        .map_err(|err| format!("failed to list Projects: {err}"))
}

pub async fn list_groups_impl(state: &AppState) -> Result<Vec<Group>, String> {
    sqlx::query_as::<_, Group>(
        "SELECT id, name, created_at, updated_at FROM groups ORDER BY lower(name), id",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|err| format!("failed to list Groups: {err}"))
}

pub async fn create_group_impl(state: &AppState, input: CreateGroupInput) -> Result<Group, String> {
    let name = input.name.trim();
    if name.is_empty() {
        return Err("Group name is required".to_string());
    }

    sqlx::query("INSERT OR IGNORE INTO groups (name) VALUES (?1)")
        .bind(name)
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to create Group: {err}"))?;

    sqlx::query_as::<_, Group>(
        "SELECT id, name, created_at, updated_at FROM groups WHERE name = ?1",
    )
    .bind(name)
    .fetch_one(&state.pool)
    .await
    .map_err(|err| format!("failed to load Group: {err}"))
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

    let issue_id = result.last_insert_rowid();
    prepare_workspace(&state.pool, issue_id).await?;
    get_issue(&state.pool, issue_id).await
}

pub async fn update_issue_impl(state: &AppState, input: UpdateIssueInput) -> Result<Issue, String> {
    let existing = get_issue(&state.pool, input.issue_id).await?;
    let title = input
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&existing.title)
        .to_string();
    let description = input
        .description
        .as_deref()
        .map(str::trim)
        .unwrap_or(&existing.description)
        .to_string();
    let state_type = input.state_type.unwrap_or(existing.state_type);
    validate_state_type(&state_type)?;
    let workspace_strategy = input.workspace_strategy.unwrap_or(existing.workspace_strategy);
    validate_workspace_strategy(&workspace_strategy)?;

    let (project_path, git_backed) = project_path_and_git(&state.pool, existing.project_id).await?;
    // Git-only Strategies are gated in the backend, not just the UI: a non-git
    // Project can only ever run the Shared checkout strategy (CONTEXT.md).
    ensure_strategy_allowed(&workspace_strategy, git_backed)?;

    let runner_override_id = input
        .runner_override_id
        .unwrap_or(existing.runner_override_id);
    let runner_override_name = match runner_override_id {
        Some(id) => Some(get_runner(&state.pool, id).await?.name),
        None => None,
    };

    // Display-only Linear link fields (sync deferred): an explicit empty string
    // clears the field, `None` leaves it untouched.
    let linear_url = match input.linear_url {
        Some(value) => nullable_text(&value),
        None => existing.linear_url.clone(),
    };
    let linear_key = match input.linear_key {
        Some(value) => nullable_text(&value),
        None => existing.linear_key.clone(),
    };

    sqlx::query(
        "UPDATE issues
         SET title = ?1, description = ?2, state_type = ?3, runner_override = ?4,
             runner_override_id = ?5, workspace_strategy = ?6, linear_url = ?7,
             linear_key = ?8, updated_at = datetime('now')
         WHERE id = ?9",
    )
    .bind(title)
    .bind(description)
    .bind(state_type)
    .bind(runner_override_name)
    .bind(runner_override_id)
    .bind(workspace_strategy)
    .bind(linear_url)
    .bind(linear_key)
    .bind(input.issue_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to update Issue: {err}"))?;

    // Re-materialize `.marrow/issues/<id>.md` whenever the Workspace dir exists
    // (always true for shared checkout), so edits land even before the first
    // Session. If the Project folder is missing, skip rather than failing the
    // metadata update — the file only matters once a Session runs there.
    if Path::new(&project_path).is_dir() {
        prepare_workspace(&state.pool, input.issue_id).await?;
    }
    get_issue(&state.pool, input.issue_id).await
}

pub async fn update_project_impl(
    state: &AppState,
    input: UpdateProjectInput,
) -> Result<Project, String> {
    let existing = get_project(&state.pool, input.project_id).await?;

    let name = input
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&existing.name)
        .to_string();

    let default_workspace_strategy = input
        .default_workspace_strategy
        .unwrap_or(existing.default_workspace_strategy);
    validate_workspace_strategy(&default_workspace_strategy)?;
    ensure_strategy_allowed(&default_workspace_strategy, existing.git_backed)?;

    // Reassigning the default Runner is how a Project frees a Runner that is
    // about to be deleted (ON DELETE RESTRICT is enforced app-side here).
    let default_runner_id = match input.default_runner_id {
        Some(id) => id,
        None => existing
            .default_runner_id
            .ok_or_else(|| "Project has no default Runner".to_string())?,
    };
    let default_runner_name = get_runner(&state.pool, default_runner_id).await?.name;

    let linear_url = match input.linear_url {
        Some(value) => nullable_text(&value),
        None => existing.linear_url.clone(),
    };
    let linear_key = match input.linear_key {
        Some(value) => nullable_text(&value),
        None => existing.linear_key.clone(),
    };

    sqlx::query(
        "UPDATE projects
         SET name = ?1, default_runner_id = ?2, default_runner = ?3,
             default_workspace_strategy = ?4, linear_url = ?5, linear_key = ?6,
             updated_at = datetime('now')
         WHERE id = ?7",
    )
    .bind(name)
    .bind(default_runner_id)
    .bind(default_runner_name)
    .bind(default_workspace_strategy)
    .bind(linear_url)
    .bind(linear_key)
    .bind(input.project_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to update Project: {err}"))?;

    get_project(&state.pool, input.project_id).await
}

pub async fn list_issues_impl(
    state: &AppState,
    input: ListIssuesInput,
) -> Result<Vec<Issue>, String> {
    match input.project_id {
        Some(project_id) => sqlx::query_as::<_, Issue>(ISSUE_SELECT_BY_PROJECT)
            .bind(project_id)
            .fetch_all(&state.pool)
            .await
            .map_err(|err| format!("failed to list Issues: {err}")),
        None => sqlx::query_as::<_, Issue>(ISSUE_SELECT_ALL)
            .fetch_all(&state.pool)
            .await
            .map_err(|err| format!("failed to list Issues: {err}")),
    }
}

pub async fn list_board_columns_impl(
    state: &AppState,
    input: ListBoardColumnsInput,
) -> Result<Vec<BoardColumn>, String> {
    seed_default_columns(&state.pool, input.project_id).await?;
    sqlx::query_as::<_, BoardColumn>(
        "SELECT id, project_id, label, state_type, position
         FROM board_columns
         WHERE project_id = ?1
         ORDER BY position, id",
    )
    .bind(input.project_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|err| format!("failed to list board columns: {err}"))
}

pub async fn transition_issue_impl(
    app: AppHandle,
    state: &AppState,
    input: TransitionIssueInput,
) -> Result<TransitionIssueResult, String> {
    validate_state_type(&input.state_type)?;
    sqlx::query("UPDATE issues SET state_type = ?1, updated_at = datetime('now') WHERE id = ?2")
        .bind(&input.state_type)
        .bind(input.issue_id)
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to transition Issue: {err}"))?;

    let mut started_session = None;
    let mut killed_sessions = 0;

    if input.state_type == "started" {
        let live_count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM sessions
             WHERE issue_id = ?1 AND status IN ('running', 'idle', 'needs_input')",
        )
        .bind(input.issue_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to check live Sessions: {err}"))?;

        if live_count.0 == 0 {
            started_session = Some(
                crate::sessions::start_session_impl(
                    app,
                    state,
                    StartSessionInput {
                        issue_id: input.issue_id,
                        resume_session_id: None,
                    },
                )
                .await?,
            );
        }
    }

    if matches!(input.state_type.as_str(), "done" | "canceled")
        && input.cleanup_live_sessions.unwrap_or(false)
    {
        let live_sessions = sqlx::query_as::<_, (i64,)>(
            "SELECT id FROM sessions
             WHERE issue_id = ?1 AND status IN ('running', 'idle', 'needs_input')",
        )
        .bind(input.issue_id)
        .fetch_all(&state.pool)
        .await
        .map_err(|err| format!("failed to list live Sessions for cleanup: {err}"))?;
        for (session_id,) in live_sessions {
            if state.sessions.kill(session_id).is_ok() {
                killed_sessions += 1;
            }
        }
    }

    prepare_workspace(&state.pool, input.issue_id).await?;
    let issue = get_issue(&state.pool, input.issue_id).await?;
    Ok(TransitionIssueResult {
        issue,
        started_session,
        killed_sessions,
    })
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

pub async fn list_runners_impl(state: &AppState) -> Result<Vec<Runner>, String> {
    sqlx::query_as::<_, Runner>(
        "SELECT id, kind, name, launch_cmd, resume_cmd, env_json, created_at, updated_at
         FROM runners
         ORDER BY
           CASE kind WHEN 'claude' THEN 0 WHEN 'codex' THEN 1 WHEN 'generic' THEN 2 ELSE 3 END,
           lower(name)",
    )
    .fetch_all(&state.pool)
    .await
    .map_err(|err| format!("failed to list Runners: {err}"))
}

pub async fn create_runner_impl(state: &AppState, input: CreateRunnerInput) -> Result<Runner, String> {
    validate_runner_kind(&input.kind)?;
    let name = input.name.trim();
    let launch_cmd = input.launch_cmd.trim();
    if name.is_empty() {
        return Err("Runner name is required".to_string());
    }
    if launch_cmd.is_empty() {
        return Err("Runner launch command is required".to_string());
    }
    let env_json = normalize_env_json(input.env_json.as_deref().unwrap_or("{}"))?;

    let result = sqlx::query(
        "INSERT INTO runners (kind, name, launch_cmd, resume_cmd, env_json)
         VALUES (?1, ?2, ?3, ?4, ?5)",
    )
    .bind(input.kind)
    .bind(name)
    .bind(launch_cmd)
    .bind(input.resume_cmd.unwrap_or_default())
    .bind(env_json)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Runner: {err}"))?;

    get_runner(&state.pool, result.last_insert_rowid()).await
}

pub async fn update_runner_impl(state: &AppState, input: UpdateRunnerInput) -> Result<Runner, String> {
    let existing = get_runner(&state.pool, input.runner_id).await?;
    let name = input
        .name
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&existing.name)
        .to_string();
    let launch_cmd = input
        .launch_cmd
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(&existing.launch_cmd)
        .to_string();
    let resume_cmd = input.resume_cmd.unwrap_or(existing.resume_cmd);
    let env_json = match input.env_json {
        Some(raw) => normalize_env_json(&raw)?,
        None => existing.env_json,
    };

    sqlx::query(
        "UPDATE runners
         SET name = ?1, launch_cmd = ?2, resume_cmd = ?3, env_json = ?4, updated_at = datetime('now')
         WHERE id = ?5",
    )
    .bind(name)
    .bind(launch_cmd)
    .bind(resume_cmd)
    .bind(env_json)
    .bind(input.runner_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to update Runner: {err}"))?;

    get_runner(&state.pool, input.runner_id).await
}

pub async fn delete_runner_impl(state: &AppState, input: DeleteRunnerInput) -> Result<(), String> {
    let runner_count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM runners")
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to count Runners: {err}"))?;
    if runner_count.0 <= 1 {
        return Err("Cannot delete the last Runner".to_string());
    }

    let project_defaults: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM projects WHERE default_runner_id = ?1")
            .bind(input.runner_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|err| format!("failed to check Project defaults: {err}"))?;
    if project_defaults.0 > 0 {
        return Err("Cannot delete a Runner used as a Project default".to_string());
    }

    sqlx::query("DELETE FROM runners WHERE id = ?1")
        .bind(input.runner_id)
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to delete Runner: {err}"))?;
    Ok(())
}

pub async fn workspace_diff_impl(
    state: &AppState,
    input: WorkspaceDiffInput,
) -> Result<WorkspaceDiff, String> {
    let workspace = resolve_diff_workspace(&state.pool, input).await?;
    if !workspace.git_backed {
        return Ok(WorkspaceDiff {
            git_backed: false,
            branch: None,
            summary: "Workspace is not git-backed.".to_string(),
            changed_files: 0,
            insertions: 0,
            deletions: 0,
        });
    }

    let branch = git_output(&workspace.path, ["rev-parse", "--abbrev-ref", "HEAD"]).ok();
    // Compare against HEAD so staged edits show up too; fall back to the index
    // when there is no commit yet (unborn HEAD).
    let diff_ref = if git_output(&workspace.path, ["rev-parse", "--verify", "HEAD"]).is_ok() {
        "HEAD"
    } else {
        "--cached"
    };
    let stat = git_output(&workspace.path, ["diff", diff_ref, "--stat"]).unwrap_or_default();
    let shortstat = git_output(&workspace.path, ["diff", diff_ref, "--shortstat"]).unwrap_or_default();
    let (changed_files, insertions, deletions) = parse_shortstat(&shortstat);
    let summary = if stat.trim().is_empty() {
        "No uncommitted changes.".to_string()
    } else {
        stat.trim().to_string()
    };

    Ok(WorkspaceDiff {
        git_backed: true,
        branch: branch.map(|value| value.trim().to_string()),
        summary,
        changed_files,
        insertions,
        deletions,
    })
}

pub async fn list_issue_comments_impl(
    state: &AppState,
    input: IssueCommentsInput,
) -> Result<Vec<IssueComment>, String> {
    sqlx::query_as::<_, IssueComment>(
        "SELECT id, issue_id, session_id, author, body, created_at
         FROM issue_comments
         WHERE issue_id = ?1
         ORDER BY created_at DESC, id DESC",
    )
    .bind(input.issue_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|err| format!("failed to list Issue comments: {err}"))
}

pub async fn create_issue_comment_impl(
    state: &AppState,
    input: CreateIssueCommentInput,
) -> Result<IssueComment, String> {
    let body = input.body.trim();
    if body.is_empty() {
        return Err("Comment body is required".to_string());
    }
    let author = input.author.unwrap_or_else(|| "agent".to_string());
    let result = sqlx::query(
        "INSERT INTO issue_comments (issue_id, session_id, author, body)
         VALUES (?1, ?2, ?3, ?4)",
    )
    .bind(input.issue_id)
    .bind(input.session_id)
    .bind(author)
    .bind(body)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Issue comment: {err}"))?;

    sqlx::query_as::<_, IssueComment>(
        "SELECT id, issue_id, session_id, author, body, created_at
         FROM issue_comments
         WHERE id = ?1",
    )
    .bind(result.last_insert_rowid())
    .fetch_one(&state.pool)
    .await
    .map_err(|err| format!("failed to load Issue comment: {err}"))
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
pub async fn list_groups(state: State<'_, AppState>) -> Result<Vec<Group>, String> {
    list_groups_impl(&state).await
}

#[tauri::command]
pub async fn create_group(
    state: State<'_, AppState>,
    input: CreateGroupInput,
) -> Result<Group, String> {
    create_group_impl(&state, input).await
}

#[tauri::command]
pub async fn create_issue(
    state: State<'_, AppState>,
    input: CreateIssueInput,
) -> Result<Issue, String> {
    create_issue_impl(&state, input).await
}

#[tauri::command]
pub async fn update_issue(
    state: State<'_, AppState>,
    input: UpdateIssueInput,
) -> Result<Issue, String> {
    update_issue_impl(&state, input).await
}

#[tauri::command]
pub async fn update_project(
    state: State<'_, AppState>,
    input: UpdateProjectInput,
) -> Result<Project, String> {
    update_project_impl(&state, input).await
}

#[tauri::command]
pub async fn transition_issue(
    app: AppHandle,
    state: State<'_, AppState>,
    input: TransitionIssueInput,
) -> Result<TransitionIssueResult, String> {
    transition_issue_impl(app, &state, input).await
}

#[tauri::command]
pub async fn list_issues(
    state: State<'_, AppState>,
    input: ListIssuesInput,
) -> Result<Vec<Issue>, String> {
    list_issues_impl(&state, input).await
}

#[tauri::command]
pub async fn list_board_columns(
    state: State<'_, AppState>,
    input: ListBoardColumnsInput,
) -> Result<Vec<BoardColumn>, String> {
    list_board_columns_impl(&state, input).await
}

#[tauri::command]
pub async fn list_sessions(
    state: State<'_, AppState>,
    input: ListSessionsInput,
) -> Result<Vec<SessionSummary>, String> {
    list_sessions_impl(&state, input).await
}

#[tauri::command]
pub async fn list_runners(state: State<'_, AppState>) -> Result<Vec<Runner>, String> {
    list_runners_impl(&state).await
}

#[tauri::command]
pub async fn create_runner(
    state: State<'_, AppState>,
    input: CreateRunnerInput,
) -> Result<Runner, String> {
    create_runner_impl(&state, input).await
}

#[tauri::command]
pub async fn update_runner(
    state: State<'_, AppState>,
    input: UpdateRunnerInput,
) -> Result<Runner, String> {
    update_runner_impl(&state, input).await
}

#[tauri::command]
pub async fn delete_runner(
    state: State<'_, AppState>,
    input: DeleteRunnerInput,
) -> Result<(), String> {
    delete_runner_impl(&state, input).await
}

#[tauri::command]
pub async fn workspace_diff(
    state: State<'_, AppState>,
    input: WorkspaceDiffInput,
) -> Result<WorkspaceDiff, String> {
    workspace_diff_impl(&state, input).await
}

#[tauri::command]
pub async fn list_issue_comments(
    state: State<'_, AppState>,
    input: IssueCommentsInput,
) -> Result<Vec<IssueComment>, String> {
    list_issue_comments_impl(&state, input).await
}

#[tauri::command]
pub async fn create_issue_comment(
    state: State<'_, AppState>,
    input: CreateIssueCommentInput,
) -> Result<IssueComment, String> {
    create_issue_comment_impl(&state, input).await
}

pub async fn get_project(pool: &sqlx::SqlitePool, id: i64) -> Result<Project, String> {
    sqlx::query_as::<_, Project>(PROJECT_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to load Project {id}: {err}"))
}

pub async fn get_issue(pool: &sqlx::SqlitePool, id: i64) -> Result<Issue, String> {
    sqlx::query_as::<_, Issue>(ISSUE_SELECT_BY_ID)
        .bind(id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to load Issue {id}: {err}"))
}

pub async fn get_runner(pool: &sqlx::SqlitePool, id: i64) -> Result<Runner, String> {
    sqlx::query_as::<_, Runner>(
        "SELECT id, kind, name, launch_cmd, resume_cmd, env_json, created_at, updated_at
         FROM runners
         WHERE id = ?1",
    )
    .bind(id)
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to load Runner {id}: {err}"))
}

async fn seed_default_columns(pool: &sqlx::SqlitePool, project_id: i64) -> Result<(), String> {
    for (position, (label, state_type)) in DEFAULT_COLUMNS.iter().enumerate() {
        sqlx::query(
            "INSERT OR IGNORE INTO board_columns (project_id, label, state_type, position)
             VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(project_id)
        .bind(label)
        .bind(state_type)
        .bind(position as i64)
        .execute(pool)
        .await
        .map_err(|err| format!("failed to seed default board columns: {err}"))?;
    }
    Ok(())
}

async fn resolve_group_id(
    pool: &sqlx::SqlitePool,
    group_id: Option<i64>,
    group_name: Option<String>,
) -> Result<Option<i64>, String> {
    if let Some(id) = group_id {
        return Ok(Some(id));
    }

    let Some(group_name) = group_name else {
        return Ok(None);
    };
    let name = group_name.trim();
    if name.is_empty() {
        return Ok(None);
    }

    sqlx::query("INSERT OR IGNORE INTO groups (name) VALUES (?1)")
        .bind(name)
        .execute(pool)
        .await
        .map_err(|err| format!("failed to create Group: {err}"))?;

    let (id,): (i64,) = sqlx::query_as("SELECT id FROM groups WHERE name = ?1")
        .bind(name)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to load Group: {err}"))?;
    Ok(Some(id))
}

async fn default_runner_id(pool: &sqlx::SqlitePool) -> Result<i64, String> {
    let (id,): (i64,) = sqlx::query_as(
        "SELECT id FROM runners
         ORDER BY CASE kind WHEN 'claude' THEN 0 WHEN 'codex' THEN 1 ELSE 2 END, id
         LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to resolve default Runner: {err}"))?;
    Ok(id)
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

fn validate_state_type(state_type: &str) -> Result<(), String> {
    if VALID_STATES.contains(&state_type) {
        Ok(())
    } else {
        Err(format!("Invalid State Type `{state_type}`"))
    }
}

fn validate_workspace_strategy(strategy: &str) -> Result<(), String> {
    match strategy {
        "shared_checkout" | "worktree" | "branch_in_place" => Ok(()),
        _ => Err(format!("Invalid Workspace Strategy `{strategy}`")),
    }
}

/// Worktree and Branch-in-place require a git repo; a non-git Project is limited
/// to the Shared checkout strategy (CONTEXT.md). Enforced server-side so the
/// gating is not merely a UI affordance.
fn ensure_strategy_allowed(strategy: &str, git_backed: bool) -> Result<(), String> {
    if !git_backed && matches!(strategy, "worktree" | "branch_in_place") {
        return Err(format!(
            "Workspace Strategy `{strategy}` requires a git-backed Project"
        ));
    }
    Ok(())
}

/// Trim, treating an empty string as a cleared (NULL) value.
fn nullable_text(value: &str) -> Option<String> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

async fn project_path_and_git(
    pool: &sqlx::SqlitePool,
    project_id: i64,
) -> Result<(String, bool), String> {
    sqlx::query_as::<_, (String, bool)>("SELECT path, git_backed FROM projects WHERE id = ?1")
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to load Project {project_id}: {err}"))
}

fn validate_runner_kind(kind: &str) -> Result<(), String> {
    match kind {
        "claude" | "codex" | "generic" => Ok(()),
        _ => Err(format!("Invalid Runner kind `{kind}`")),
    }
}

fn normalize_env_json(raw: &str) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|err| format!("Runner env_json is invalid JSON: {err}"))?;
    let object = value
        .as_object()
        .ok_or_else(|| "Runner env_json must be an object".to_string())?;
    let mut normalized = serde_json::Map::new();
    for (key, value) in object {
        if key.starts_with("MARROW_") || key == "TERM" {
            continue;
        }
        let Some(value) = value.as_str() else {
            return Err("Runner env_json values must be strings".to_string());
        };
        normalized.insert(key.clone(), serde_json::Value::String(value.to_string()));
    }
    Ok(serde_json::Value::Object(normalized).to_string())
}

struct DiffWorkspace {
    path: PathBuf,
    git_backed: bool,
}

async fn resolve_diff_workspace(
    pool: &sqlx::SqlitePool,
    input: WorkspaceDiffInput,
) -> Result<DiffWorkspace, String> {
    if let Some(session_id) = input.session_id {
        let row: (String, bool) = sqlx::query_as(
            "SELECT s.workspace_path, p.git_backed
             FROM sessions s
             JOIN projects p ON p.id = s.project_id
             WHERE s.id = ?1",
        )
        .bind(session_id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to resolve Session workspace: {err}"))?;
        return Ok(DiffWorkspace {
            path: PathBuf::from(row.0),
            git_backed: row.1,
        });
    }

    if let Some(issue_id) = input.issue_id {
        let row: (String, bool) = sqlx::query_as(
            "SELECT p.path, p.git_backed
             FROM issues i
             JOIN projects p ON p.id = i.project_id
             WHERE i.id = ?1",
        )
        .bind(issue_id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to resolve Issue workspace: {err}"))?;
        return Ok(DiffWorkspace {
            path: PathBuf::from(row.0),
            git_backed: row.1,
        });
    }

    if let Some(project_id) = input.project_id {
        let row: (String, bool) = sqlx::query_as(
            "SELECT path, git_backed FROM projects WHERE id = ?1",
        )
        .bind(project_id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to resolve Project workspace: {err}"))?;
        return Ok(DiffWorkspace {
            path: PathBuf::from(row.0),
            git_backed: row.1,
        });
    }

    Err("workspace_diff requires sessionId, issueId, or projectId".to_string())
}

fn git_output<const N: usize>(cwd: &Path, args: [&str; N]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .output()
        .map_err(|err| format!("failed to run git: {err}"))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }
    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_shortstat(shortstat: &str) -> (i64, i64, i64) {
    let mut changed_files = 0;
    let mut insertions = 0;
    let mut deletions = 0;
    let normalized = shortstat.replace(',', "");
    let parts: Vec<&str> = normalized.split_whitespace().collect();
    for window in parts.windows(2) {
        let Ok(value) = window[0].parse::<i64>() else {
            continue;
        };
        // git renders the units as `files`, `insertions(+)`, and `deletions(-)`,
        // so match on the prefix rather than the exact token.
        let unit = window[1];
        if unit.starts_with("file") {
            changed_files = value;
        } else if unit.starts_with("insertion") {
            insertions = value;
        } else if unit.starts_with("deletion") {
            deletions = value;
        }
    }
    (changed_files, insertions, deletions)
}

const PROJECT_SELECT_ALL: &str = "SELECT p.id, p.group_id, g.name AS group_name,
       p.name, p.path, p.git_backed,
       COALESCE(r.name, p.default_runner) AS default_runner,
       p.default_runner_id,
       p.default_workspace_strategy, p.color, p.color_index,
       p.linear_url, p.linear_key,
       p.created_at, p.updated_at
FROM projects p
LEFT JOIN groups g ON g.id = p.group_id
LEFT JOIN runners r ON r.id = p.default_runner_id
ORDER BY COALESCE(g.name, ''), lower(p.name), p.id";

const PROJECT_SELECT_BY_ID: &str = "SELECT p.id, p.group_id, g.name AS group_name,
       p.name, p.path, p.git_backed,
       COALESCE(r.name, p.default_runner) AS default_runner,
       p.default_runner_id,
       p.default_workspace_strategy, p.color, p.color_index,
       p.linear_url, p.linear_key,
       p.created_at, p.updated_at
FROM projects p
LEFT JOIN groups g ON g.id = p.group_id
LEFT JOIN runners r ON r.id = p.default_runner_id
WHERE p.id = ?1";

const ISSUE_SELECT_ALL: &str = "SELECT i.id, i.project_id,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       i.title, i.description, i.state_type,
       COALESCE(ro.name, i.runner_override) AS runner_override,
       i.runner_override_id, i.workspace_strategy, i.linear_url, i.linear_key,
       i.created_at, i.updated_at
FROM issues i
JOIN projects p ON p.id = i.project_id
LEFT JOIN runners ro ON ro.id = i.runner_override_id
ORDER BY
  CASE i.state_type
    WHEN 'started' THEN 0
    WHEN 'todo' THEN 1
    WHEN 'backlog' THEN 2
    WHEN 'in-review' THEN 3
    WHEN 'done' THEN 4
    ELSE 5
  END,
  i.updated_at DESC,
  i.id DESC";

const ISSUE_SELECT_BY_PROJECT: &str = "SELECT i.id, i.project_id,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       i.title, i.description, i.state_type,
       COALESCE(ro.name, i.runner_override) AS runner_override,
       i.runner_override_id, i.workspace_strategy, i.linear_url, i.linear_key,
       i.created_at, i.updated_at
FROM issues i
JOIN projects p ON p.id = i.project_id
LEFT JOIN runners ro ON ro.id = i.runner_override_id
WHERE i.project_id = ?1
ORDER BY
  CASE i.state_type
    WHEN 'started' THEN 0
    WHEN 'todo' THEN 1
    WHEN 'backlog' THEN 2
    WHEN 'in-review' THEN 3
    WHEN 'done' THEN 4
    ELSE 5
  END,
  i.updated_at DESC,
  i.id DESC";

const ISSUE_SELECT_BY_ID: &str = "SELECT i.id, i.project_id,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       i.title, i.description, i.state_type,
       COALESCE(ro.name, i.runner_override) AS runner_override,
       i.runner_override_id, i.workspace_strategy, i.linear_url, i.linear_key,
       i.created_at, i.updated_at
FROM issues i
JOIN projects p ON p.id = i.project_id
LEFT JOIN runners ro ON ro.id = i.runner_override_id
WHERE i.id = ?1";

const SESSION_SELECT_ALL: &str = "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       s.runner, s.runner_id, s.runner_kind, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.resume_token, s.needs_input_since, s.snoozed_until,
       s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
ORDER BY
  CASE
    WHEN s.status = 'needs_input' AND (s.snoozed_until IS NULL OR s.snoozed_until <= datetime('now')) THEN 0
    WHEN s.status = 'running' THEN 1
    WHEN s.status = 'idle' THEN 2
    ELSE 3
  END,
  COALESCE(s.needs_input_since, s.started_at) ASC,
  s.id DESC";

const SESSION_SELECT_BY_PROJECT: &str = "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       s.runner, s.runner_id, s.runner_kind, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.resume_token, s.needs_input_since, s.snoozed_until,
       s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
WHERE s.project_id = ?1
ORDER BY
  CASE
    WHEN s.status = 'needs_input' AND (s.snoozed_until IS NULL OR s.snoozed_until <= datetime('now')) THEN 0
    WHEN s.status = 'running' THEN 1
    WHEN s.status = 'idle' THEN 2
    ELSE 3
  END,
  COALESCE(s.needs_input_since, s.started_at) ASC,
  s.id DESC";

const SESSION_SELECT_BY_ID: &str = "SELECT s.id, s.issue_id, s.project_id, i.title AS issue_title,
       p.name AS project_name, p.color AS project_color, p.color_index AS project_color_index,
       s.runner, s.runner_id, s.runner_kind, s.status, s.workspace_path, s.issue_file_path,
       s.pid, s.exit_code, s.resume_token, s.needs_input_since, s.snoozed_until,
       s.started_at, s.exited_at
FROM sessions s
JOIN issues i ON i.id = s.issue_id
JOIN projects p ON p.id = s.project_id
WHERE s.id = ?1";

#[cfg(test)]
mod tests {
    use super::parse_shortstat;

    #[test]
    fn parses_full_shortstat() {
        assert_eq!(
            parse_shortstat(" 2 files changed, 19 insertions(+), 3 deletions(-)"),
            (2, 19, 3)
        );
    }

    #[test]
    fn parses_singular_and_partial_shortstat() {
        assert_eq!(parse_shortstat(" 1 file changed, 1 insertion(+)"), (1, 1, 0));
        assert_eq!(
            parse_shortstat(" 1 file changed, 2 deletions(-)"),
            (1, 0, 2)
        );
    }

    #[test]
    fn empty_shortstat_is_zero() {
        assert_eq!(parse_shortstat(""), (0, 0, 0));
        assert_eq!(parse_shortstat("   \n"), (0, 0, 0));
    }
}
