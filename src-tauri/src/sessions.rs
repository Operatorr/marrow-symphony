use crate::models::{
    ResizeSessionInput, SessionInput, SessionSummary, StartSessionInput, WriteSessionInput,
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
    let prepared = prepare_workspace(&state.pool, input.issue_id).await?;
    let workspace_path = prepared.workspace_path.to_string_lossy().to_string();
    let issue_file_path = prepared.issue_file_path.to_string_lossy().to_string();

    let result = sqlx::query(
        "INSERT INTO sessions (issue_id, project_id, runner, status, workspace_path, issue_file_path)
         VALUES (?1, ?2, ?3, 'running', ?4, ?5)",
    )
    .bind(prepared.issue.issue_id)
    .bind(prepared.issue.project_id)
    .bind(&prepared.issue.runner)
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
    state: State<'_, AppState>,
    input: WriteSessionInput,
) -> Result<(), String> {
    state
        .sessions
        .write(input.session_id, input.data.as_bytes())
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

fn spawn_runner(
    app: AppHandle,
    pool: sqlx::SqlitePool,
    registry: SessionRegistry,
    session_id: i64,
    runner: &str,
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

    let mut command = runner_command(runner);
    command.cwd(workspace_path.as_os_str());
    command.env("MARROW_ISSUE_FILE", issue_file_path.as_os_str());
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

    let output_app = app.clone();
    let output_pool = pool.clone();
    thread::spawn(move || {
        let mut buffer = [0_u8; 8192];
        loop {
            match reader.read(&mut buffer) {
                Ok(0) => break,
                Ok(size) => {
                    let data = String::from_utf8_lossy(&buffer[..size]).to_string();
                    let _ =
                        output_app.emit("session-output", SessionOutputEvent { session_id, data });
                    let pool = output_pool.clone();
                    tauri::async_runtime::spawn(async move {
                        let _ = sqlx::query(
                            "UPDATE sessions SET last_output_at = datetime('now') WHERE id = ?1",
                        )
                        .bind(session_id)
                        .execute(&pool)
                        .await;
                    });
                }
                Err(_) => break,
            }
        }
    });

    let status_app = app;
    thread::spawn(move || {
        let exit_status = child.wait();
        let exit_code = exit_status
            .as_ref()
            .ok()
            .map(|status| i64::from(status.exit_code()));
        registry.remove(session_id);
        let pool_for_update = pool.clone();
        tauri::async_runtime::spawn(async move {
            // Persist the exit state before notifying so the React listener's
            // refetch of list_sessions can't race ahead and read a stale
            // `running` status.
            let _ = sqlx::query(
                "UPDATE sessions
                 SET status = 'exited', exit_code = ?1, exited_at = datetime('now')
                 WHERE id = ?2",
            )
            .bind(exit_code)
            .bind(session_id)
            .execute(&pool_for_update)
            .await;
            let _ = status_app.emit(
                "session-status",
                SessionStatusEvent {
                    session_id,
                    status: "exited".to_string(),
                    exit_code,
                },
            );
        });
    });

    Ok(pid)
}

fn runner_command(runner: &str) -> CommandBuilder {
    #[cfg(unix)]
    {
        let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
        let mut command = CommandBuilder::new(shell);
        command.arg("-lc");
        command.arg(runner);
        command
    }

    #[cfg(windows)]
    {
        let mut command = CommandBuilder::new("cmd.exe");
        command.arg("/C");
        command.arg(runner);
        command
    }
}
