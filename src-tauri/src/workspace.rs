use sqlx::FromRow;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, FromRow)]
pub struct IssueWorkspace {
    pub issue_id: i64,
    pub project_id: i64,
    pub project_name: String,
    pub project_path: String,
    pub issue_title: String,
    pub issue_description: String,
    pub runner_id: Option<i64>,
    pub runner: String,
    pub runner_kind: String,
    pub launch_cmd: String,
    pub resume_cmd: String,
    pub env_json: String,
    pub workspace_strategy: String,
}

pub struct PreparedWorkspace {
    pub issue: IssueWorkspace,
    pub workspace_path: PathBuf,
    pub issue_file_path: PathBuf,
}

pub async fn prepare_workspace(
    pool: &sqlx::SqlitePool,
    issue_id: i64,
) -> Result<PreparedWorkspace, String> {
    let issue = sqlx::query_as::<_, IssueWorkspace>(
        "SELECT i.id AS issue_id, i.project_id, p.name AS project_name, p.path AS project_path,
                i.title AS issue_title, i.description AS issue_description,
                COALESCE(ro.id, rd.id) AS runner_id,
                COALESCE(ro.name, rd.name, i.runner_override, p.default_runner) AS runner,
                COALESCE(ro.kind, rd.kind, 'generic') AS runner_kind,
                COALESCE(ro.launch_cmd, rd.launch_cmd, i.runner_override, p.default_runner) AS launch_cmd,
                COALESCE(ro.resume_cmd, rd.resume_cmd, '') AS resume_cmd,
                COALESCE(ro.env_json, rd.env_json, '{}') AS env_json,
                i.workspace_strategy
         FROM issues i
         JOIN projects p ON p.id = i.project_id
         LEFT JOIN runners ro ON ro.id = i.runner_override_id
         LEFT JOIN runners rd ON rd.id = p.default_runner_id
         WHERE i.id = ?1",
    )
    .bind(issue_id)
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to load Issue {issue_id}: {err}"))?;

    let workspace_path = PathBuf::from(&issue.project_path);
    if !workspace_path.is_dir() {
        return Err(format!(
            "Workspace path {} is not a directory",
            workspace_path.display()
        ));
    }

    let marrow_dir = workspace_path.join(".marrow");
    let issues_dir = marrow_dir.join("issues");
    fs::create_dir_all(&issues_dir).map_err(|err| {
        format!(
            "failed to create materialized Issue directory {}: {err}",
            issues_dir.display()
        )
    })?;

    ensure_marrow_git_excluded(&workspace_path)?;

    let issue_file_path = issues_dir.join(format!("{}.md", issue.issue_id));
    fs::write(&issue_file_path, render_issue_file(&issue)).map_err(|err| {
        format!(
            "failed to write materialized Issue file {}: {err}",
            issue_file_path.display()
        )
    })?;

    Ok(PreparedWorkspace {
        issue,
        workspace_path,
        issue_file_path,
    })
}

fn render_issue_file(issue: &IssueWorkspace) -> String {
    let description = if issue.issue_description.trim().is_empty() {
        "_No description provided._"
    } else {
        issue.issue_description.trim()
    };

    format!(
        "# {}\n\nProject: {}\nIssue ID: {}\nWorkspace Strategy: {}\nRunner: {}\n\n## Task\n\n{}\n",
        issue.issue_title.trim(),
        issue.project_name,
        issue.issue_id,
        issue.workspace_strategy,
        issue.runner,
        description
    )
}

fn ensure_marrow_git_excluded(workspace_path: &Path) -> Result<(), String> {
    let Some(git_dir) = resolve_git_dir(workspace_path)? else {
        return Ok(());
    };

    let info_dir = git_dir.join("info");
    fs::create_dir_all(&info_dir).map_err(|err| {
        format!(
            "failed to create git exclude directory {}: {err}",
            info_dir.display()
        )
    })?;

    let exclude_path = info_dir.join("exclude");
    let existing = fs::read_to_string(&exclude_path).unwrap_or_default();
    if existing.lines().any(|line| line.trim() == ".marrow/") {
        return Ok(());
    }

    let mut next = existing;
    if !next.is_empty() && !next.ends_with('\n') {
        next.push('\n');
    }
    next.push_str(".marrow/\n");
    fs::write(&exclude_path, next).map_err(|err| {
        format!(
            "failed to update git exclude file {}: {err}",
            exclude_path.display()
        )
    })
}

fn resolve_git_dir(workspace_path: &Path) -> Result<Option<PathBuf>, String> {
    let dot_git = workspace_path.join(".git");
    if dot_git.is_dir() {
        return Ok(Some(dot_git));
    }

    if dot_git.is_file() {
        let content = fs::read_to_string(&dot_git)
            .map_err(|err| format!("failed to read {}: {err}", dot_git.display()))?;
        if let Some(raw_path) = content.strip_prefix("gitdir:") {
            let raw_path = raw_path.trim();
            let git_dir = PathBuf::from(raw_path);
            return Ok(Some(if git_dir.is_absolute() {
                git_dir
            } else {
                workspace_path.join(git_dir)
            }));
        }
    }

    Ok(None)
}
