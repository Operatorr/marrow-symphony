// Tauri command surface for Marrow Symphony.
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

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
        .invoke_handler(tauri::generate_handler![ping])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
