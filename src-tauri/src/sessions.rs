use crate::models::{
    ResizeSessionInput, SessionInput, SessionSummary, SetSessionStatusInput, StartSessionInput,
    WriteSessionInput,
};
use crate::state::AppState;
use crate::store::get_session_summary;
use crate::workspace::prepare_workspace;
use portable_pty::{native_pty_system, ChildKiller, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Emitter, State};

#[derive(Default, Clone)]
pub struct SessionRegistry {
    inner: Arc<Mutex<HashMap<i64, SessionHandle>>>,
}

struct SessionHandle {
    master: Box<dyn MasterPty + Send>,
    writer: Mutex<Box<dyn Write + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionOutputEvent {
    pub session_id: i64,
    pub data: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionStatusEvent {
    pub session_id: i64,
    pub status: String,
    pub exit_code: Option<i64>,
}

#[tauri::command]
pub async fn start_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: StartSessionInput,
) -> Result<SessionSummary, String> {
    start_session_impl(app, &state, input).await
}

pub async fn start_session_impl(
    app: AppHandle,
    state: &AppState,
    input: StartSessionInput,
) -> Result<SessionSummary, String> {
    let prepared = prepare_workspace(&state.pool, input.issue_id).await?;
    let workspace_path = prepared.workspace_path.to_string_lossy().to_string();
    let issue_file_path = prepared.issue_file_path.to_string_lossy().to_string();
    let branch = current_branch(&prepared.workspace_path).unwrap_or_default();
    let resume_token = match input.resume_session_id {
        Some(session_id) => {
            let row: (Option<String>,) =
                sqlx::query_as("SELECT resume_token FROM sessions WHERE id = ?1")
                    .bind(session_id)
                    .fetch_one(&state.pool)
                    .await
                    .map_err(|err| format!("failed to load resume token: {err}"))?;
            Some(row.0.ok_or_else(|| "Session has no captured resume token".to_string())?)
        }
        None => None,
    };

    let runner_template = if let Some(token) = &resume_token {
        if prepared.issue.resume_cmd.trim().is_empty() {
            return Err(format!(
                "Runner `{}` does not define a resume command",
                prepared.issue.runner
            ));
        }
        interpolate_runner_command(
            &prepared.issue.resume_cmd,
            &workspace_path,
            &issue_file_path,
            &branch,
            token,
        )
    } else {
        interpolate_runner_command(
            &prepared.issue.launch_cmd,
            &workspace_path,
            &issue_file_path,
            &branch,
            "",
        )
    };
    let runner_env = parse_runner_env(&prepared.issue.env_json)?;

    let result = sqlx::query(
        "INSERT INTO sessions (
           issue_id, project_id, runner, runner_id, runner_kind, runner_command, status,
           workspace_path, issue_file_path
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'running', ?7, ?8)",
    )
    .bind(prepared.issue.issue_id)
    .bind(prepared.issue.project_id)
    .bind(&prepared.issue.runner)
    .bind(prepared.issue.runner_id)
    .bind(&prepared.issue.runner_kind)
    .bind(&runner_template)
    .bind(&workspace_path)
    .bind(&issue_file_path)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to create Session row: {err}"))?;

    let session_id = result.last_insert_rowid();
    match spawn_runner(
        app.clone(),
        state.pool.clone(),
        state.sessions.clone(),
        session_id,
        &prepared.issue.runner,
        &prepared.issue.runner_kind,
        &runner_template,
        runner_env,
        &prepared.workspace_path,
        &prepared.issue_file_path,
    ) {
        Ok(pid) => {
            sqlx::query("UPDATE sessions SET pid = ?1 WHERE id = ?2")
                .bind(pid.map(i64::from))
                .bind(session_id)
                .execute(&state.pool)
                .await
                .map_err(|err| format!("failed to record Session pid: {err}"))?;
        }
        Err(err) => {
            sqlx::query(
                "UPDATE sessions
                 SET status = 'exited', exited_at = datetime('now')
                 WHERE id = ?1",
            )
            .bind(session_id)
            .execute(&state.pool)
            .await
            .map_err(|update_err| {
                format!(
                    "failed to mark failed Session exited after spawn error ({err}): {update_err}"
                )
            })?;
            return Err(err);
        }
    }

    get_session_summary(&state, session_id).await
}

#[tauri::command]
pub async fn write_to_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: WriteSessionInput,
) -> Result<(), String> {
    state
        .sessions
        .write(input.session_id, input.data.as_bytes())?;
    let updated = sqlx::query(
        "UPDATE sessions
         SET status = 'running', needs_input_since = NULL, snoozed_until = NULL
         WHERE id = ?1 AND status = 'needs_input'",
    )
    .bind(input.session_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to clear Needs Input: {err}"))?;
    if updated.rows_affected() > 0 {
        let _ = app.emit(
            "session-status",
            SessionStatusEvent {
                session_id: input.session_id,
                status: "running".to_string(),
                exit_code: None,
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn resize_session(
    state: State<'_, AppState>,
    input: ResizeSessionInput,
) -> Result<(), String> {
    state
        .sessions
        .resize(input.session_id, input.cols, input.rows)
}

#[tauri::command]
pub async fn kill_session(state: State<'_, AppState>, input: SessionInput) -> Result<(), String> {
    state.sessions.kill(input.session_id)
}

#[tauri::command]
pub async fn restart_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SessionInput,
) -> Result<SessionSummary, String> {
    let (issue_id,): (i64,) = sqlx::query_as("SELECT issue_id FROM sessions WHERE id = ?1")
        .bind(input.session_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to load Session for restart: {err}"))?;
    // Restart replaces the existing Session — terminate it (and free its PTY)
    // before spawning a new one in the same reused Workspace.
    let _ = state.sessions.kill(input.session_id);
    start_session_impl(
        app,
        &state,
        StartSessionInput {
            issue_id,
            resume_session_id: None,
        },
    )
    .await
}

#[tauri::command]
pub async fn resume_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SessionInput,
) -> Result<SessionSummary, String> {
    let (issue_id,): (i64,) = sqlx::query_as("SELECT issue_id FROM sessions WHERE id = ?1")
        .bind(input.session_id)
        .fetch_one(&state.pool)
        .await
        .map_err(|err| format!("failed to load Session for resume: {err}"))?;
    // Resuming hands the source Session's captured token to a fresh process; the
    // old one (if still live) must be terminated so we don't run two agents in
    // the same Workspace. The persisted row keeps its resume_token after the kill.
    let _ = state.sessions.kill(input.session_id);
    start_session_impl(
        app,
        &state,
        StartSessionInput {
            issue_id,
            resume_session_id: Some(input.session_id),
        },
    )
    .await
}

#[tauri::command]
pub async fn set_session_status(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SetSessionStatusInput,
) -> Result<SessionSummary, String> {
    set_session_status_impl(&app, &state.pool, input.session_id, &input.status).await?;
    get_session_summary(&state, input.session_id).await
}

#[tauri::command]
pub async fn snooze_session(
    app: AppHandle,
    state: State<'_, AppState>,
    input: SessionInput,
) -> Result<SessionSummary, String> {
    sqlx::query(
        "UPDATE sessions
         SET snoozed_until = datetime('now', '+15 minutes')
         WHERE id = ?1 AND status = 'needs_input'",
    )
    .bind(input.session_id)
    .execute(&state.pool)
    .await
    .map_err(|err| format!("failed to snooze Session: {err}"))?;
    let summary = get_session_summary(&state, input.session_id).await?;
    let _ = app.emit(
        "session-status",
        SessionStatusEvent {
            session_id: input.session_id,
            status: summary.status.clone(),
            exit_code: summary.exit_code,
        },
    );
    Ok(summary)
}

#[tauri::command]
pub async fn get_session_scrollback(
    state: State<'_, AppState>,
    input: SessionInput,
) -> Result<String, String> {
    let (scrollback,): (String,) =
        sqlx::query_as("SELECT output_scrollback FROM sessions WHERE id = ?1")
            .bind(input.session_id)
            .fetch_one(&state.pool)
            .await
            .map_err(|err| format!("failed to load Session scrollback: {err}"))?;
    Ok(scrollback)
}

impl SessionRegistry {
    fn insert(&self, session_id: i64, handle: SessionHandle) -> Result<(), String> {
        self.inner
            .lock()
            .map_err(|_| "Session registry lock poisoned".to_string())?
            .insert(session_id, handle);
        Ok(())
    }

    fn remove(&self, session_id: i64) {
        if let Ok(mut sessions) = self.inner.lock() {
            sessions.remove(&session_id);
        }
    }

    pub fn write(&self, session_id: i64, data: &[u8]) -> Result<(), String> {
        let sessions = self
            .inner
            .lock()
            .map_err(|_| "Session registry lock poisoned".to_string())?;
        let handle = sessions
            .get(&session_id)
            .ok_or_else(|| format!("Session {session_id} is not live"))?;
        let mut writer = handle
            .writer
            .lock()
            .map_err(|_| format!("Session {session_id} writer lock poisoned"))?;
        writer
            .write_all(data)
            .map_err(|err| format!("failed to write to Session {session_id}: {err}"))?;
        writer
            .flush()
            .map_err(|err| format!("failed to flush Session {session_id}: {err}"))
    }

    pub fn resize(&self, session_id: i64, cols: u16, rows: u16) -> Result<(), String> {
        let sessions = self
            .inner
            .lock()
            .map_err(|_| "Session registry lock poisoned".to_string())?;
        let handle = sessions
            .get(&session_id)
            .ok_or_else(|| format!("Session {session_id} is not live"))?;
        handle
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|err| format!("failed to resize Session {session_id}: {err}"))
    }

    pub fn kill(&self, session_id: i64) -> Result<(), String> {
        let sessions = self
            .inner
            .lock()
            .map_err(|_| "Session registry lock poisoned".to_string())?;
        let handle = sessions
            .get(&session_id)
            .ok_or_else(|| format!("Session {session_id} is not live"))?;
        let mut killer = handle
            .killer
            .lock()
            .map_err(|_| format!("Session {session_id} killer lock poisoned"))?;
        killer
            .kill()
            .map_err(|err| format!("failed to kill Session {session_id}: {err}"))
    }

    pub fn kill_all(&self) {
        if let Ok(sessions) = self.inner.lock() {
            for handle in sessions.values() {
                if let Ok(mut killer) = handle.killer.lock() {
                    let _ = killer.kill();
                }
            }
        }
    }
}

/// A unit of work for the per-session scrollback consumer. Chunks and the final
/// exit marker flow through the same channel so the consumer writes them to the
/// DB in strict reader order (see `spawn_runner`).
enum ScrollbackMsg {
    Chunk {
        data: String,
        needs_input: bool,
        resume_token: Option<String>,
    },
    Exited {
        exit_code: Option<i64>,
    },
}

fn spawn_runner(
    app: AppHandle,
    pool: sqlx::SqlitePool,
    registry: SessionRegistry,
    session_id: i64,
    runner: &str,
    runner_kind: &str,
    runner_command: &str,
    runner_env: HashMap<String, String>,
    workspace_path: &Path,
    issue_file_path: &Path,
) -> Result<Option<u32>, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|err| format!("failed to open PTY: {err}"))?;

    let mut command = shell_command(runner_command);
    command.cwd(workspace_path.as_os_str());
    for (key, value) in runner_env {
        command.env(key, value);
    }
    command.env("MARROW_ISSUE_FILE", issue_file_path.as_os_str());
    command.env("MARROW_SESSION_ID", session_id.to_string());
    command.env("MARROW_NOTIFY_SOCKET", "");
    command.env("TERM", "xterm-256color");

    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|err| format!("failed to spawn Runner `{runner}`: {err}"))?;
    let pid = child.process_id();
    let killer = child.clone_killer();
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|err| format!("failed to clone PTY reader: {err}"))?;
    let writer = pair
        .master
        .take_writer()
        .map_err(|err| format!("failed to take PTY writer: {err}"))?;

    registry.insert(
        session_id,
        SessionHandle {
            master: pair.master,
            writer: Mutex::new(writer),
            killer: Mutex::new(killer),
        },
    )?;

    // A single consumer task drains this channel and performs every scrollback
    // write sequentially, so persistence happens in strict reader order even
    // though the pool hands out several connections. Spawning a task per chunk
    // (the previous design) let later chunks land before earlier ones.
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<ScrollbackMsg>();
    let consumer_pool = pool.clone();
    let consumer_app = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match msg {
                ScrollbackMsg::Chunk {
                    data,
                    needs_input,
                    resume_token,
                } => {
                    let _ = sqlx::query(
                        "UPDATE sessions
                         SET output_scrollback = substr(COALESCE(output_scrollback, '') || ?1, -?2),
                             last_output_at = datetime('now'),
                             resume_token = COALESCE(?3, resume_token)
                         WHERE id = ?4",
                    )
                    .bind(&data)
                    .bind(96_000_i64)
                    .bind(resume_token)
                    .bind(session_id)
                    .execute(&consumer_pool)
                    .await;

                    if needs_input {
                        let updated = sqlx::query(
                            "UPDATE sessions
                             SET status = 'needs_input',
                                 needs_input_since = COALESCE(needs_input_since, datetime('now')),
                                 snoozed_until = NULL
                             WHERE id = ?1 AND status != 'exited'",
                        )
                        .bind(session_id)
                        .execute(&consumer_pool)
                        .await;
                        if updated.map(|done| done.rows_affected() > 0).unwrap_or(false) {
                            let _ = consumer_app.emit(
                                "session-status",
                                SessionStatusEvent {
                                    session_id,
                                    status: "needs_input".to_string(),
                                    exit_code: None,
                                },
                            );
                        }
                    }
                }
                ScrollbackMsg::Exited { exit_code } => {
                    // Sequenced after every scrollback write, so the exit state
                    // is persisted only once all output is durable. Persisting
                    // before notifying also keeps the React listener's refetch
                    // of list_sessions from reading a stale `running` status.
                    let _ = sqlx::query(
                        "UPDATE sessions
                         SET status = 'exited', exit_code = ?1, exited_at = datetime('now'),
                             needs_input_since = NULL, snoozed_until = NULL
                         WHERE id = ?2",
                    )
                    .bind(exit_code)
                    .bind(session_id)
                    .execute(&consumer_pool)
                    .await;
                    let _ = consumer_app.emit(
                        "session-status",
                        SessionStatusEvent {
                            session_id,
                            status: "exited".to_string(),
                            exit_code,
                        },
                    );
                }
            }
        }
    });

    let output_app = app.clone();
    let output_runner_kind = runner_kind.to_string();
    let reader_tx = tx.clone();
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    // Emit synchronously, in reader order, so the live terminal
                    // stays instant and is unaffected by DB write latency.
                    let _ = output_app.emit(
                        "session-output",
                        SessionOutputEvent {
                            session_id,
                            data: data.clone(),
                        },
                    );
                    let needs_input = detects_attention_signal(&data);
                    let resume_token = capture_resume_token(&output_runner_kind, &data);
                    // `send` is synchronous and non-blocking, so it is safe to
                    // call from this blocking reader thread. An error means the
                    // consumer is gone, so there is nothing left to persist.
                    if reader_tx
                        .send(ScrollbackMsg::Chunk {
                            data,
                            needs_input,
                            resume_token,
                        })
                        .is_err()
                    {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });

    let exit_tx = tx;
    thread::spawn(move || {
        let exit_status = child.wait();
        let exit_code = exit_status
            .as_ref()
            .ok()
            .map(|status| i64::from(status.exit_code()));
        registry.remove(session_id);
        let _ = exit_tx.send(ScrollbackMsg::Exited { exit_code });
    });

    Ok(pid)
}

async fn set_session_status_impl(
    app: &AppHandle,
    pool: &sqlx::SqlitePool,
    session_id: i64,
    status: &str,
) -> Result<(), String> {
    validate_status(status)?;
    match status {
        "needs_input" => {
            sqlx::query(
                "UPDATE sessions
                 SET status = 'needs_input',
                     needs_input_since = COALESCE(needs_input_since, datetime('now')),
                     snoozed_until = NULL
                 WHERE id = ?1 AND status != 'exited'",
            )
            .bind(session_id)
            .execute(pool)
            .await
            .map_err(|err| format!("failed to set Session status: {err}"))?;
        }
        "running" | "idle" => {
            sqlx::query(
                "UPDATE sessions
                 SET status = ?1, needs_input_since = NULL, snoozed_until = NULL
                 WHERE id = ?2 AND status != 'exited'",
            )
            .bind(status)
            .bind(session_id)
            .execute(pool)
            .await
            .map_err(|err| format!("failed to set Session status: {err}"))?;
        }
        "exited" => {
            sqlx::query(
                "UPDATE sessions
                 SET status = 'exited',
                     needs_input_since = NULL,
                     snoozed_until = NULL,
                     exited_at = COALESCE(exited_at, datetime('now'))
                 WHERE id = ?1",
            )
            .bind(session_id)
            .execute(pool)
            .await
            .map_err(|err| format!("failed to set Session status: {err}"))?;
        }
        _ => unreachable!(),
    }
    let _ = app.emit(
        "session-status",
        SessionStatusEvent {
            session_id,
            status: status.to_string(),
            exit_code: None,
        },
    );
    Ok(())
}

fn validate_status(status: &str) -> Result<(), String> {
    match status {
        "running" | "needs_input" | "idle" | "exited" => Ok(()),
        _ => Err(format!("Invalid Session status `{status}`")),
    }
}

fn shell_command(command_string: &str) -> CommandBuilder {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut command = CommandBuilder::new(shell);
        command.arg("-lc");
        command.arg(command_string);
        command
    }

    #[cfg(windows)]
    {
        let mut command = CommandBuilder::new("cmd.exe");
        command.arg("/C");
        command.arg(command_string);
        command
    }
}

fn interpolate_runner_command(
    template: &str,
    workspace: &str,
    issue_file: &str,
    branch: &str,
    resume_token: &str,
) -> String {
    template
        .replace("{{workspace}}", &shell_escape(workspace))
        .replace("{{issueFile}}", &shell_escape(issue_file))
        .replace("{{branch}}", &shell_escape(branch))
        .replace("{{resumeToken}}", &shell_escape(resume_token))
}

fn shell_escape(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn parse_runner_env(raw: &str) -> Result<HashMap<String, String>, String> {
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|err| format!("Runner env_json is invalid JSON: {err}"))?;
    let mut env = HashMap::new();
    let Some(object) = value.as_object() else {
        return Err("Runner env_json must be an object".to_string());
    };
    for (key, value) in object {
        if key.starts_with("MARROW_") || key == "TERM" {
            continue;
        }
        if let Some(value) = value.as_str() {
            env.insert(key.clone(), value.to_string());
        }
    }
    Ok(env)
}

fn current_branch(workspace_path: &Path) -> Option<String> {
    let output = std::process::Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(workspace_path)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn detects_attention_signal(data: &str) -> bool {
    data.contains('\u{0007}') || data.contains("\u{001b}]9;") || data.contains("\u{001b}]777;")
}

fn capture_resume_token(kind: &str, data: &str) -> Option<String> {
    let markers: &[&str] = match kind {
        "claude" => &["claude --resume ", "claude resume "],
        "codex" => &["codex resume ", "codex --resume "],
        _ => &["--resume ", "resume "],
    };
    for marker in markers {
        if let Some(start) = data.find(marker) {
            let rest = &data[start + marker.len()..];
            let token = rest
                .split_whitespace()
                .next()
                .unwrap_or_default()
                .trim_matches(|c: char| {
                    matches!(c, '"' | '\'' | '`' | ',' | ';' | ')' | ']' | '}')
                });
            if !token.is_empty() {
                return Some(token.to_string());
            }
        }
    }
    None
}
