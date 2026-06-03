use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
    pub name: String,
    pub path: String,
    pub git_backed: bool,
    pub default_runner: String,
    pub default_runner_id: Option<i64>,
    pub default_workspace_strategy: String,
    pub color: String,
    pub color_index: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: i64,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BoardColumn {
    pub id: i64,
    pub project_id: i64,
    pub label: String,
    pub state_type: String,
    pub position: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Issue {
    pub id: i64,
    pub project_id: i64,
    pub project_name: String,
    pub project_color: String,
    pub project_color_index: i64,
    pub title: String,
    pub description: String,
    pub state_type: String,
    pub runner_override: Option<String>,
    pub runner_override_id: Option<i64>,
    pub workspace_strategy: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct Runner {
    pub id: i64,
    pub kind: String,
    pub name: String,
    pub launch_cmd: String,
    pub resume_cmd: String,
    pub env_json: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SessionSummary {
    pub id: i64,
    pub issue_id: i64,
    pub project_id: i64,
    pub issue_title: String,
    pub project_name: String,
    pub project_color: String,
    pub project_color_index: i64,
    pub runner: String,
    pub runner_id: Option<i64>,
    pub runner_kind: String,
    pub status: String,
    pub workspace_path: String,
    pub issue_file_path: Option<String>,
    pub pid: Option<i64>,
    pub exit_code: Option<i64>,
    pub resume_token: Option<String>,
    pub needs_input_since: Option<String>,
    pub snoozed_until: Option<String>,
    pub started_at: String,
    pub exited_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct IssueComment {
    pub id: i64,
    pub issue_id: i64,
    pub session_id: Option<i64>,
    pub author: String,
    pub body: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDiff {
    pub git_backed: bool,
    pub branch: Option<String>,
    pub summary: String,
    pub changed_files: i64,
    pub insertions: i64,
    pub deletions: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: Option<String>,
    pub path: String,
    pub group_id: Option<i64>,
    pub group_name: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIssueInput {
    pub project_id: i64,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateGroupInput {
    pub name: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListIssuesInput {
    pub project_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListBoardColumnsInput {
    pub project_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListSessionsInput {
    pub project_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartSessionInput {
    pub issue_id: i64,
    pub resume_session_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteSessionInput {
    pub session_id: i64,
    pub data: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResizeSessionInput {
    pub session_id: i64,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionInput {
    pub session_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetSessionStatusInput {
    pub session_id: i64,
    pub status: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionIssueInput {
    pub issue_id: i64,
    pub state_type: String,
    pub cleanup_live_sessions: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TransitionIssueResult {
    pub issue: Issue,
    pub started_session: Option<SessionSummary>,
    pub killed_sessions: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateIssueInput {
    pub issue_id: i64,
    pub title: Option<String>,
    pub description: Option<String>,
    pub state_type: Option<String>,
    pub runner_override_id: Option<Option<i64>>,
    pub workspace_strategy: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRunnerInput {
    pub kind: String,
    pub name: String,
    pub launch_cmd: String,
    pub resume_cmd: Option<String>,
    pub env_json: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRunnerInput {
    pub runner_id: i64,
    pub name: Option<String>,
    pub launch_cmd: Option<String>,
    pub resume_cmd: Option<String>,
    pub env_json: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeleteRunnerInput {
    pub runner_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceDiffInput {
    pub session_id: Option<i64>,
    pub issue_id: Option<i64>,
    pub project_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueCommentsInput {
    pub issue_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateIssueCommentInput {
    pub issue_id: i64,
    pub session_id: Option<i64>,
    pub author: Option<String>,
    pub body: String,
}
