mod hooks;
mod linear;
mod models;
mod sessions;
mod sidecar;
mod state;
mod store;
mod workspace;

use state::AppState;
use tauri::{Manager, WindowEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let state = tauri::async_runtime::block_on(AppState::new(app.handle()))
                .map_err(|err| std::io::Error::new(std::io::ErrorKind::Other, err))?;
            let notify_socket_path = state.notify_socket_path.clone();
            app.manage(state);
            // Start the `marrow` context-bus listener (ADR 0008/0009). Unix-only;
            // elsewhere `notify_socket_path` is None and the sidecar is inert.
            #[cfg(unix)]
            if let Some(path) = notify_socket_path {
                sidecar::start(app.handle().clone(), std::path::PathBuf::from(path));
            }
            #[cfg(not(unix))]
            let _ = notify_socket_path;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, WindowEvent::CloseRequested { .. }) {
                if let Some(state) = window.try_state::<AppState>() {
                    state.sessions.kill_all();
                    // Best-effort: remove the notify socket so it doesn't linger.
                    if let Some(path) = &state.notify_socket_path {
                        let _ = std::fs::remove_file(path);
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            store::create_project,
            store::list_projects,
            store::list_groups,
            store::create_group,
            store::create_issue,
            store::update_issue,
            store::update_project,
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
            hooks::claude_hook_status,
            hooks::install_claude_hook,
            hooks::uninstall_claude_hook,
            linear::linear_status,
            linear::linear_connect_api_key,
            linear::linear_authorize_url,
            linear::linear_complete_oauth,
            linear::linear_disconnect,
            linear::linear_list_projects,
            linear::linear_link_project,
            linear::linear_unlink_project,
            linear::linear_import_issues,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
