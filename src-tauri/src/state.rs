use crate::sessions::SessionRegistry;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
use sqlx::SqlitePool;
use std::fs;
use tauri::{AppHandle, Manager};

pub struct AppState {
    pub pool: SqlitePool,
    pub sessions: SessionRegistry,
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

        Ok(Self {
            pool,
            sessions: SessionRegistry::default(),
        })
    }
}
