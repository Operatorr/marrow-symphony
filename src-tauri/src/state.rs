use crate::sessions::SessionRegistry;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub pool: SqlitePool,
    pub sessions: SessionRegistry,
    /// The per-app `marrow` notify/context-bus socket path, injected into each
    /// Session as `MARROW_NOTIFY_SOCKET`. `None` on platforms without unix
    /// domain sockets, where the sidecar transport is unavailable.
    pub notify_socket_path: Option<String>,
    /// The unguessable `state` value generated for the in-flight Linear OAuth
    /// authorization, verified once when the callback is completed (CSRF guard).
    /// `None` when no authorization is pending; consumed on a successful match.
    pub oauth_state: Mutex<Option<String>>,
}

impl AppState {
    pub async fn new(app: &AppHandle) -> Result<Self, String> {
        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|err| format!("failed to resolve app data dir: {err}"))?;
        fs::create_dir_all(&app_data_dir).map_err(|err| {
            format!(
                "failed to create app data dir {}: {err}",
                app_data_dir.display()
            )
        })?;

        let db_path = app_data_dir.join("marrow-symphony.sqlite3");
        let options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(options)
            .await
            .map_err(|err| {
                format!(
                    "failed to open SQLite database {}: {err}",
                    db_path.display()
                )
            })?;

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .map_err(|err| format!("failed to run SQLite migrations: {err}"))?;

        sqlx::query(
            "UPDATE sessions
             SET status = 'exited', exited_at = COALESCE(exited_at, datetime('now'))
             WHERE status IN ('running', 'idle', 'needs_input')",
        )
        .execute(&pool)
        .await
        .map_err(|err| format!("failed to reconcile stale sessions: {err}"))?;

        let notify_socket_path = if cfg!(unix) {
            Some(
                app_data_dir
                    .join("marrow-notify.sock")
                    .to_string_lossy()
                    .to_string(),
            )
        } else {
            None
        };

        Ok(Self {
            pool,
            sessions: SessionRegistry::default(),
            notify_socket_path,
            oauth_state: Mutex::new(None),
        })
    }
}
