//! The `marrow` agent context bus (ADR 0008 / ADR 0009).
//!
//! `marrow` is a small CLI (the `marrow` bin in this crate) that the Runner
//! calls from inside a Session. It addresses the app over a per-app unix domain
//! socket (`MARROW_NOTIFY_SOCKET`) and is scoped to the Session via
//! `MARROW_SESSION_ID`. One JSON request / response per invocation. The app
//! resolves Session → Issue → Project and serves the request **locally** here;
//! the Linear proxy behind the same verbs is the seam for the Linear slice.
//!
//! Verbs: `notify [--needs-input|--done]`, `issue read [--json]`,
//! `issue comment "<text>"`, `diff`. The agent never holds any credential — all
//! resolution happens inside Marrow over the socket.

use crate::models::WorkspaceDiffInput;
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarRequest {
    pub session_id: i64,
    pub verb: String,
    #[serde(default)]
    pub needs_input: Option<bool>,
    #[serde(default)]
    pub json: bool,
    #[serde(default)]
    pub body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidecarResponse {
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl SidecarResponse {
    fn ok(text: Option<String>) -> Self {
        Self {
            ok: true,
            text,
            error: None,
        }
    }

    fn err(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            text: None,
            error: Some(message.into()),
        }
    }
}

/// The directory holding the `marrow` sidecar binary. Cargo places it next to
/// the app binary in both `target/<profile>/` (dev) and a bundled layout, so we
/// prepend `current_exe()`'s parent to the Session's PATH. (Production bundling
/// should additionally declare `bundle.externalBin` so the binary is copied
/// beside the app — see docs/exec-plans/active/0002-full-functional-ui.md.)
pub fn marrow_bin_dir() -> Option<PathBuf> {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.to_path_buf()))
}

/// Start the per-app notify/context-bus listener. Unix-only; a no-op elsewhere.
#[cfg(unix)]
pub fn start(app: AppHandle, socket_path: PathBuf) {
    tauri::async_runtime::spawn(async move {
        // Clear any stale socket from a previous run before binding.
        let _ = std::fs::remove_file(&socket_path);
        let listener = match tokio::net::UnixListener::bind(&socket_path) {
            Ok(listener) => listener,
            Err(err) => {
                eprintln!(
                    "marrow: failed to bind notify socket {}: {err}",
                    socket_path.display()
                );
                return;
            }
        };
        loop {
            match listener.accept().await {
                Ok((stream, _addr)) => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(async move {
                        handle_connection(app, stream).await;
                    });
                }
                Err(err) => {
                    eprintln!("marrow: notify socket accept error: {err}");
                    break;
                }
            }
        }
    });
}

#[cfg(unix)]
async fn handle_connection(app: AppHandle, stream: tokio::net::UnixStream) {
    use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

    let (read_half, mut write_half) = stream.into_split();
    let mut reader = BufReader::new(read_half);
    let mut line = String::new();
    // Requests are single-line JSON (serde escapes embedded newlines), so one
    // `read_line` is the whole request.
    if reader.read_line(&mut line).await.is_err() {
        return;
    }
    let response = dispatch(&app, &line).await;
    let mut out = serde_json::to_string(&response)
        .unwrap_or_else(|_| "{\"ok\":false,\"error\":\"serialize\"}".to_string());
    out.push('\n');
    let _ = write_half.write_all(out.as_bytes()).await;
    let _ = write_half.flush().await;
}

#[cfg(unix)]
async fn dispatch(app: &AppHandle, raw: &str) -> SidecarResponse {
    let request: SidecarRequest = match serde_json::from_str(raw.trim()) {
        Ok(request) => request,
        Err(err) => return SidecarResponse::err(format!("invalid request: {err}")),
    };

    let state = app.state::<AppState>();
    let app_state: &AppState = state.inner();

    // Validate the Session exists before doing anything; this is the only scope
    // the agent has, and the agent never supplies anything but its own id.
    let session_exists: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM sessions WHERE id = ?1")
            .bind(request.session_id)
            .fetch_optional(&app_state.pool)
            .await
            .unwrap_or(None);
    if session_exists.is_none() {
        return SidecarResponse::err(format!("unknown Session {}", request.session_id));
    }

    match request.verb.as_str() {
        "notify" => {
            // `--needs-input` (default) raises attention; `--done` clears it back
            // to Running, mirroring the human-acts clear path.
            let status = if request.needs_input.unwrap_or(true) {
                "needs_input"
            } else {
                "running"
            };
            match crate::sessions::set_session_status_impl(
                app,
                &app_state.pool,
                request.session_id,
                status,
            )
            .await
            {
                Ok(()) => SidecarResponse::ok(None),
                Err(err) => SidecarResponse::err(err),
            }
        }
        "issue_read" => match issue_read(&app_state.pool, request.session_id, request.json).await {
            Ok(text) => SidecarResponse::ok(Some(text)),
            Err(err) => SidecarResponse::err(err),
        },
        "issue_comment" => {
            let Some(body) = request.body.as_deref() else {
                return SidecarResponse::err("issue comment requires text");
            };
            match issue_comment(&app_state.pool, request.session_id, body).await {
                Ok(()) => SidecarResponse::ok(None),
                Err(err) => SidecarResponse::err(err),
            }
        }
        "diff" => {
            let input = WorkspaceDiffInput {
                session_id: Some(request.session_id),
                issue_id: None,
                project_id: None,
            };
            match crate::store::workspace_diff_impl(app_state, input).await {
                Ok(diff) => {
                    let branch = diff.branch.unwrap_or_else(|| "(detached)".to_string());
                    let text = format!("Workspace branch: {branch}\n{}", diff.summary);
                    SidecarResponse::ok(Some(text))
                }
                Err(err) => SidecarResponse::err(err),
            }
        }
        other => SidecarResponse::err(format!("unknown verb `{other}`")),
    }
}

/// Render the addressed Session's Issue task context — the same content
/// materialized to `.marrow/issues/<id>.md`, fetchable on demand mid-Session.
pub(crate) async fn issue_read(
    pool: &sqlx::SqlitePool,
    session_id: i64,
    json: bool,
) -> Result<String, String> {
    let row: (String, String, String, String) = sqlx::query_as(
        "SELECT i.title, i.description, i.state_type, p.name
         FROM sessions s
         JOIN issues i ON i.id = s.issue_id
         JOIN projects p ON p.id = i.project_id
         WHERE s.id = ?1",
    )
    .bind(session_id)
    .fetch_one(pool)
    .await
    .map_err(|err| format!("failed to read Issue context: {err}"))?;
    let (title, description, state_type, project) = row;

    if json {
        let value = serde_json::json!({
            "title": title,
            "description": description,
            "stateType": state_type,
            "project": project,
        });
        return Ok(value.to_string());
    }

    let body = if description.trim().is_empty() {
        "_No description provided._"
    } else {
        description.trim()
    };
    Ok(format!(
        "# {}\n\nProject: {}\nState Type: {}\n\n## Task\n\n{}\n",
        title.trim(),
        project,
        state_type,
        body
    ))
}

/// Write context back: append an `issue_comments` row tied to the Session.
pub(crate) async fn issue_comment(
    pool: &sqlx::SqlitePool,
    session_id: i64,
    body: &str,
) -> Result<(), String> {
    let body = body.trim();
    if body.is_empty() {
        return Err("comment body is required".to_string());
    }
    let (issue_id,): (i64,) = sqlx::query_as("SELECT issue_id FROM sessions WHERE id = ?1")
        .bind(session_id)
        .fetch_one(pool)
        .await
        .map_err(|err| format!("failed to resolve Session Issue: {err}"))?;
    sqlx::query(
        "INSERT INTO issue_comments (issue_id, session_id, author, body)
         VALUES (?1, ?2, 'agent', ?3)",
    )
    .bind(issue_id)
    .bind(session_id)
    .bind(body)
    .execute(pool)
    .await
    .map_err(|err| format!("failed to write Issue comment: {err}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{issue_comment, issue_read};
    use sqlx::sqlite::SqlitePoolOptions;

    async fn seed_pool() -> sqlx::SqlitePool {
        // A single shared in-memory connection so migrations + inserts persist.
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect("sqlite::memory:")
            .await
            .expect("open in-memory sqlite");
        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("run migrations");
        sqlx::query(
            "INSERT INTO projects (name, path, git_backed, default_runner, default_runner_id,
                                   default_workspace_strategy, color, color_index)
             VALUES ('Demo', '/tmp/demo', 0, 'Claude',
                     (SELECT id FROM runners WHERE kind = 'claude'),
                     'shared_checkout', '#5318c9', 1)",
        )
        .execute(&pool)
        .await
        .expect("insert project");
        sqlx::query(
            "INSERT INTO issues (project_id, title, description, state_type, workspace_strategy)
             VALUES (1, 'Fix the parser', 'Handle empty input gracefully', 'started', 'shared_checkout')",
        )
        .execute(&pool)
        .await
        .expect("insert issue");
        sqlx::query(
            "INSERT INTO sessions (issue_id, project_id, runner, runner_kind, runner_command,
                                   status, workspace_path)
             VALUES (1, 1, 'Claude', 'claude', 'claude', 'running', '/tmp/demo')",
        )
        .execute(&pool)
        .await
        .expect("insert session");
        pool
    }

    #[tokio::test]
    async fn issue_read_renders_task_context() {
        let pool = seed_pool().await;
        let text = issue_read(&pool, 1, false).await.expect("read");
        assert!(text.contains("Fix the parser"));
        assert!(text.contains("Handle empty input gracefully"));
        assert!(text.contains("State Type: started"));

        let json = issue_read(&pool, 1, true).await.expect("read json");
        assert!(json.contains("\"title\":\"Fix the parser\""));
        assert!(json.contains("\"stateType\":\"started\""));
    }

    #[tokio::test]
    async fn issue_comment_persists_tied_to_session() {
        let pool = seed_pool().await;
        issue_comment(&pool, 1, "Made progress on the parser")
            .await
            .expect("comment");
        let row: (i64, i64, String, String) = sqlx::query_as(
            "SELECT issue_id, session_id, author, body FROM issue_comments WHERE issue_id = 1",
        )
        .fetch_one(&pool)
        .await
        .expect("load comment");
        assert_eq!(row.0, 1);
        assert_eq!(row.1, 1);
        assert_eq!(row.2, "agent");
        assert_eq!(row.3, "Made progress on the parser");
    }

    #[tokio::test]
    async fn issue_comment_rejects_empty_body() {
        let pool = seed_pool().await;
        assert!(issue_comment(&pool, 1, "   ").await.is_err());
    }
}
