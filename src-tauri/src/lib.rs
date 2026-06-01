mod models;
mod sessions;
mod state;
mod store;
mod workspace;

use state::AppState;
use tauri::{Manager, WindowEvent};

/// Tracer-bullet IPC probe: the frontend invokes this to prove the
/// React → Tauri → Rust round trip works end to end (Step 0 of the
/// scaffold slice). Returns a value the UI can render verbatim.
#[tauri::command]
fn ping() -> String {
    format!(
        "pong from Rust — Marrow Symphony backend v{}",
        env!("CARGO_PKG_VERSION")
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = tauri::async_runtime::block_on(AppState::new(app.handle()))
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
            app.manage(state);
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.try_state::<AppState>() {
                    state.sessions.kill_all();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            ping,
            store::create_project,
            store::list_projects,
            store::list_groups,
            store::create_group,
            store::create_issue,
            store::update_issue,
            store::transition_issue,
            store::list_issues,
            store::list_board_columns,
            store::list_sessions,
            store::list_runners,
            store::create_runner,
            store::update_runner,
            store::delete_runner,
            store::workspace_diff,
            store::list_issue_comments,
            store::create_issue_comment,
            sessions::start_session,
            sessions::restart_session,
            sessions::resume_session,
            sessions::write_to_session,
            sessions::resize_session,
            sessions::kill_session,
            sessions::set_session_status,
            sessions::snooze_session,
            sessions::get_session_scrollback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::ping;

    #[test]
    fn ping_smoke_returns_backend_value() {
        assert!(ping().contains("pong from Rust"));
    }
}
