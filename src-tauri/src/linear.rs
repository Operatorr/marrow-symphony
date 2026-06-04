//! Linear integration: a workspace-level connection (personal API key *or* OAuth
//! access token) plus per-Project linking and Issue import.
//!
//! Marrow stays local-first: the credential lives only in this machine's SQLite
//! (`linear_connection`), and the agent never sees it — import pulls Issues into
//! the local board. Linear's GraphQL API is reached over HTTPS via `reqwest`.
//!
//! Auth header convention (per Linear docs): a personal API key is sent verbatim
//! in `Authorization`; an OAuth access token is sent as `Bearer <token>`.

use crate::state::AppState;
use crate::models::Project;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::SqlitePool;
use tauri::State;

const GRAPHQL_URL: &str = "https://api.linear.app/graphql";
const TOKEN_URL: &str = "https://api.linear.app/oauth/token";
const AUTHORIZE_URL: &str = "https://linear.app/oauth/authorize";
// Must match LINEAR_OAUTH_REDIRECT in the frontend. With no embedded server the
// user copies the `code` back by hand after authorizing.
const REDIRECT_URI: &str = "http://localhost:3939/callback";
const SCOPE: &str = "read,write";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinearConnectionView {
    pub connected: bool,
    pub method: Option<String>,
    pub workspace_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinearProjectView {
    pub id: String,
    pub name: String,
    pub team_name: Option<String>,
    pub team_key: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinearImportResult {
    pub imported: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectApiKeyInput {
    pub api_key: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthorizeUrlInput {
    pub client_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteOauthInput {
    pub client_id: String,
    pub client_secret: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkProjectInput {
    pub project_id: i64,
    pub linear_project_id: String,
    /// Human-readable Linear Project name (stored in linear_links). Distinct from
    /// `linear_key` (the short team key) which feeds the Project's display chip.
    pub linear_project_name: Option<String>,
    pub linear_key: Option<String>,
    pub linear_url: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UnlinkProjectInput {
    pub project_id: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportIssuesInput {
    pub project_id: i64,
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("marrow-symphony")
        .build()
        .map_err(|err| format!("failed to build HTTP client: {err}"))
}

fn auth_header(method: &str, token: &str) -> String {
    if method == "oauth" {
        format!("Bearer {token}")
    } else {
        token.to_string()
    }
}

/// A short, char-boundary-safe slice of a response body for error messages.
fn body_snippet(body: &str) -> String {
    let trimmed = body.trim();
    let snippet: String = trimmed.chars().take(200).collect();
    if trimmed.chars().count() > 200 {
        format!("{snippet}…")
    } else {
        snippet
    }
}

/// Tolerate a user pasting the whole `…/callback?code=…&state=…` redirect URL
/// instead of just the authorization code.
fn extract_oauth_code(raw: &str) -> String {
    if let Ok(url) = reqwest::Url::parse(raw) {
        if let Some((_, value)) = url.query_pairs().find(|(key, _)| key == "code") {
            return value.into_owned();
        }
    }
    raw.to_string()
}

/// Run a GraphQL operation against Linear and return its `data` payload.
async fn graphql(method: &str, token: &str, body: serde_json::Value) -> Result<serde_json::Value, String> {
    let client = http_client()?;
    let response = client
        .post(GRAPHQL_URL)
        .header(reqwest::header::AUTHORIZATION, auth_header(method, token))
        .json(&body)
        .send()
        .await
        .map_err(|err| format!("Linear request failed: {err}"))?;
    let status = response.status();
    // Read as text first so a non-JSON error body (proxy/gateway HTML, empty 401)
    // surfaces the real HTTP status instead of a generic parse error.
    let body = response
        .text()
        .await
        .map_err(|err| format!("failed to read Linear response: {err}"))?;
    let payload: serde_json::Value = serde_json::from_str(&body).map_err(|err| {
        if status.is_success() {
            format!("failed to parse Linear response: {err}")
        } else {
            format!("Linear API returned HTTP {} — {}", status.as_u16(), body_snippet(&body))
        }
    })?;
    if let Some(errors) = payload.get("errors") {
        if !errors.is_null() {
            return Err(format!("Linear API error: {errors}"));
        }
    }
    if !status.is_success() {
        return Err(format!("Linear API returned HTTP {}", status.as_u16()));
    }
    payload
        .get("data")
        .cloned()
        .ok_or_else(|| "Linear response had no data".to_string())
}

async fn get_connection(pool: &SqlitePool) -> Result<Option<(String, String, Option<String>)>, String> {
    sqlx::query_as::<_, (String, String, Option<String>)>(
        "SELECT method, access_token, workspace_name FROM linear_connection WHERE id = 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|err| format!("failed to read Linear connection: {err}"))
}

async fn require_connection(pool: &SqlitePool) -> Result<(String, String), String> {
    get_connection(pool)
        .await?
        .map(|(method, token, _)| (method, token))
        .ok_or_else(|| "Linear is not connected".to_string())
}

async fn save_connection(
    pool: &SqlitePool,
    method: &str,
    token: &str,
    workspace_name: Option<&str>,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO linear_connection (id, method, access_token, workspace_name)
         VALUES (1, ?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET
           method = excluded.method,
           access_token = excluded.access_token,
           workspace_name = excluded.workspace_name",
    )
    .bind(method)
    .bind(token)
    .bind(workspace_name)
    .execute(pool)
    .await
    .map_err(|err| format!("failed to save Linear connection: {err}"))?;
    Ok(())
}

async fn current_status(pool: &SqlitePool) -> Result<LinearConnectionView, String> {
    Ok(match get_connection(pool).await? {
        Some((method, _, workspace_name)) => LinearConnectionView {
            connected: true,
            method: Some(method),
            workspace_name,
        },
        None => LinearConnectionView {
            connected: false,
            method: None,
            workspace_name: None,
        },
    })
}

/// Validate a credential by reading the connected organization's name.
async fn fetch_workspace_name(method: &str, token: &str) -> Result<Option<String>, String> {
    let data = graphql(method, token, json!({ "query": "{ organization { name } }" })).await?;
    Ok(data
        .get("organization")
        .and_then(|org| org.get("name"))
        .and_then(|name| name.as_str())
        .map(|name| name.to_string()))
}

/// Map a Linear workflow-state type to a Marrow State Type.
fn map_state(linear_type: &str) -> &'static str {
    match linear_type {
        "backlog" | "triage" => "backlog",
        "unstarted" => "todo",
        "started" => "started",
        "completed" => "done",
        "canceled" => "canceled",
        _ => "todo",
    }
}

#[tauri::command]
pub async fn linear_status(state: State<'_, AppState>) -> Result<LinearConnectionView, String> {
    current_status(&state.pool).await
}

#[tauri::command]
pub async fn linear_connect_api_key(
    state: State<'_, AppState>,
    input: ConnectApiKeyInput,
) -> Result<LinearConnectionView, String> {
    let key = input.api_key.trim().to_string();
    if key.is_empty() {
        return Err("An API key is required".to_string());
    }
    // Round-trips to Linear, so an invalid key fails here before we store it.
    let workspace = fetch_workspace_name("api_key", &key).await?;
    save_connection(&state.pool, "api_key", &key, workspace.as_deref()).await?;
    current_status(&state.pool).await
}

#[tauri::command]
pub async fn linear_authorize_url(
    _state: State<'_, AppState>,
    input: AuthorizeUrlInput,
) -> Result<String, String> {
    let client_id = input.client_id.trim();
    if client_id.is_empty() {
        return Err("A Client ID is required".to_string());
    }
    let url = reqwest::Url::parse_with_params(
        AUTHORIZE_URL,
        &[
            ("client_id", client_id),
            ("redirect_uri", REDIRECT_URI),
            ("response_type", "code"),
            ("scope", SCOPE),
            ("prompt", "consent"),
        ],
    )
    .map_err(|err| format!("failed to build authorize URL: {err}"))?;
    Ok(url.to_string())
}

#[tauri::command]
pub async fn linear_complete_oauth(
    state: State<'_, AppState>,
    input: CompleteOauthInput,
) -> Result<LinearConnectionView, String> {
    let client = http_client()?;
    let code = extract_oauth_code(input.code.trim());
    let response = client
        .post(TOKEN_URL)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code.as_str()),
            ("redirect_uri", REDIRECT_URI),
            ("client_id", input.client_id.trim()),
            ("client_secret", input.client_secret.trim()),
        ])
        .send()
        .await
        .map_err(|err| format!("Linear token request failed: {err}"))?;
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|err| format!("failed to read Linear token response: {err}"))?;
    let payload: serde_json::Value = serde_json::from_str(&body).unwrap_or(serde_json::Value::Null);
    if !status.is_success() {
        let message = payload
            .get("error_description")
            .or_else(|| payload.get("error"))
            .and_then(|value| value.as_str())
            .map(str::to_string)
            .unwrap_or_else(|| body_snippet(&body));
        return Err(format!("Linear OAuth error: {message}"));
    }
    let token = payload
        .get("access_token")
        .and_then(|value| value.as_str())
        .ok_or_else(|| "Linear did not return an access token".to_string())?
        .to_string();
    let workspace = fetch_workspace_name("oauth", &token).await?;
    save_connection(&state.pool, "oauth", &token, workspace.as_deref()).await?;
    current_status(&state.pool).await
}

#[tauri::command]
pub async fn linear_disconnect(state: State<'_, AppState>) -> Result<LinearConnectionView, String> {
    sqlx::query("DELETE FROM linear_connection")
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to disconnect Linear: {err}"))?;
    current_status(&state.pool).await
}

#[tauri::command]
pub async fn linear_list_projects(state: State<'_, AppState>) -> Result<Vec<LinearProjectView>, String> {
    let (method, token) = require_connection(&state.pool).await?;
    let data = graphql(
        &method,
        &token,
        json!({
            "query": "query { projects(first: 100) { nodes { id name url teams(first: 1) { nodes { key name } } } } }"
        }),
    )
    .await?;

    let nodes = data
        .get("projects")
        .and_then(|projects| projects.get("nodes"))
        .and_then(|nodes| nodes.as_array())
        .cloned()
        .unwrap_or_default();

    let projects = nodes
        .iter()
        .filter_map(|node| {
            let id = node.get("id")?.as_str()?.to_string();
            let name = node
                .get("name")
                .and_then(|value| value.as_str())
                .unwrap_or("Untitled")
                .to_string();
            let url = node.get("url").and_then(|value| value.as_str()).map(str::to_string);
            let team = node
                .get("teams")
                .and_then(|teams| teams.get("nodes"))
                .and_then(|nodes| nodes.as_array())
                .and_then(|nodes| nodes.first());
            let team_key = team
                .and_then(|team| team.get("key"))
                .and_then(|value| value.as_str())
                .map(str::to_string);
            let team_name = team
                .and_then(|team| team.get("name"))
                .and_then(|value| value.as_str())
                .map(str::to_string);
            Some(LinearProjectView {
                id,
                name,
                team_name,
                team_key,
                url,
            })
        })
        .collect();
    Ok(projects)
}

#[tauri::command]
pub async fn linear_link_project(
    state: State<'_, AppState>,
    input: LinkProjectInput,
) -> Result<Project, String> {
    let linear_project_id = input.linear_project_id.trim();
    if linear_project_id.is_empty() {
        return Err("A Linear Project is required".to_string());
    }
    sqlx::query(
        "INSERT INTO linear_links
           (project_id, linear_project_id, linear_project_name, linear_project_url)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(project_id) DO UPDATE SET
           linear_project_id = excluded.linear_project_id,
           linear_project_name = excluded.linear_project_name,
           linear_project_url = excluded.linear_project_url,
           updated_at = datetime('now')",
    )
    .bind(input.project_id)
    .bind(linear_project_id)
    .bind(input.linear_project_name.as_deref())
    .bind(input.linear_url.as_deref())
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to link Linear Project: {err}"))?;

    // Mirror onto the Project's display chip (existing linear_key / linear_url).
    sqlx::query(
        "UPDATE projects SET linear_key = ?1, linear_url = ?2, updated_at = datetime('now') WHERE id = ?3",
    )
    .bind(input.linear_key.as_deref())
    .bind(input.linear_url.as_deref())
    .bind(input.project_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to update Project: {err}"))?;

    crate::store::get_project(&state.pool, input.project_id).await
}

#[tauri::command]
pub async fn linear_unlink_project(
    state: State<'_, AppState>,
    input: UnlinkProjectInput,
) -> Result<Project, String> {
    sqlx::query("DELETE FROM linear_links WHERE project_id = ?1")
        .bind(input.project_id)
        .execute(&state.pool)
        .await
        .map_err(|err| format!("failed to unlink Linear Project: {err}"))?;
    sqlx::query(
        "UPDATE projects SET linear_key = NULL, linear_url = NULL, updated_at = datetime('now') WHERE id = ?1",
    )
    .bind(input.project_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to update Project: {err}"))?;
    crate::store::get_project(&state.pool, input.project_id).await
}

#[tauri::command]
pub async fn linear_import_issues(
    state: State<'_, AppState>,
    input: ImportIssuesInput,
) -> Result<LinearImportResult, String> {
    let (method, token) = require_connection(&state.pool).await?;
    let link: Option<(String,)> =
        sqlx::query_as("SELECT linear_project_id FROM linear_links WHERE project_id = ?1")
            .bind(input.project_id)
            .fetch_optional(&state.pool)
            .await
            .map_err(|err| format!("failed to read Linear link: {err}"))?;
    let linear_project_id = link
        .map(|(id,)| id)
        .ok_or_else(|| "This Project is not linked to a Linear Project".to_string())?;

    let query = "query($id: String!, $after: String) { \
        project(id: $id) { issues(first: 50, after: $after) { \
            pageInfo { hasNextPage endCursor } \
            nodes { id identifier title description url state { type } } } } }";

    let mut after: Option<String> = None;
    let mut imported = 0i64;
    loop {
        let data = graphql(
            &method,
            &token,
            json!({ "query": query, "variables": { "id": linear_project_id, "after": after } }),
        )
        .await?;
        let issues = data.get("project").and_then(|project| project.get("issues"));
        let nodes = issues
            .and_then(|issues| issues.get("nodes"))
            .and_then(|nodes| nodes.as_array())
            .cloned()
            .unwrap_or_default();

        for node in &nodes {
            let Some(linear_id) = node.get("id").and_then(|value| value.as_str()) else {
                continue;
            };
            let title = node
                .get("title")
                .and_then(|value| value.as_str())
                .unwrap_or("Untitled")
                .to_string();
            let description = node
                .get("description")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .to_string();
            let identifier = node.get("identifier").and_then(|value| value.as_str());
            let url = node.get("url").and_then(|value| value.as_str());
            let state_type = node
                .get("state")
                .and_then(|state| state.get("type"))
                .and_then(|value| value.as_str())
                .map(map_state)
                .unwrap_or("todo");

            sqlx::query(
                "INSERT INTO issues
                   (project_id, title, description, state_type, linear_key, linear_url, linear_issue_id)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                 ON CONFLICT(linear_issue_id) WHERE linear_issue_id IS NOT NULL DO UPDATE SET
                   title = excluded.title,
                   description = excluded.description,
                   state_type = excluded.state_type,
                   linear_key = excluded.linear_key,
                   linear_url = excluded.linear_url,
                   updated_at = datetime('now')",
            )
            .bind(input.project_id)
            .bind(title)
            .bind(description)
            .bind(state_type)
            .bind(identifier)
            .bind(url)
            .bind(linear_id)
            .execute(&state.pool)
            .await
            .map_err(|err| format!("failed to import Issue: {err}"))?;
            imported += 1;
        }

        let page_info = issues.and_then(|issues| issues.get("pageInfo"));
        let has_next = page_info
            .and_then(|info| info.get("hasNextPage"))
            .and_then(|value| value.as_bool())
            .unwrap_or(false);
        let end_cursor = page_info
            .and_then(|info| info.get("endCursor"))
            .and_then(|value| value.as_str())
            .map(str::to_string);
        if has_next && end_cursor.is_some() {
            after = end_cursor;
        } else {
            break;
        }
    }

    Ok(LinearImportResult { imported })
}

#[cfg(test)]
mod tests {
    use super::{auth_header, map_state};

    #[test]
    fn api_key_sent_verbatim_oauth_uses_bearer() {
        assert_eq!(auth_header("api_key", "lin_abc"), "lin_abc");
        assert_eq!(auth_header("oauth", "tok123"), "Bearer tok123");
    }

    #[test]
    fn linear_state_types_map_to_marrow_state_types() {
        assert_eq!(map_state("backlog"), "backlog");
        assert_eq!(map_state("triage"), "backlog");
        assert_eq!(map_state("unstarted"), "todo");
        assert_eq!(map_state("started"), "started");
        assert_eq!(map_state("completed"), "done");
        assert_eq!(map_state("canceled"), "canceled");
        assert_eq!(map_state("something-new"), "todo");
    }
}
