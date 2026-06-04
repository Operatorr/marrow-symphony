//! Consented installer for the Claude `Stop` + `Notification` hooks (ADR 0008).
//!
//! For `kind: claude`, Needs-Input detection is sharpest when Claude itself
//! tells us it stopped or is notifying. This is opt-in: the merge into the
//! user's **global** `~/.claude/settings.json` only ever runs after an explicit
//! in-app click. The merge is **purely additive** (existing hooks are
//! preserved), **idempotent** (re-install is a no-op), and **reversible**
//! (uninstall removes only our tagged entries, leaving everything else intact).
//!
//! The injected command runs the `marrow` sidecar by absolute path, shell-guarded
//! so a missing binary can never disrupt the user's non-Marrow Claude usage, and
//! tagged with a unique marker comment so we can find and remove exactly our own
//! entries.

use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

const HOOK_MARKER: &str = "marrow-symphony-hook";
const HOOK_EVENTS: [&str; 2] = ["Stop", "Notification"];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeHookStatus {
    pub installed: bool,
    pub settings_path: String,
    pub settings_exists: bool,
    /// The exact command line that would be / is installed, for the consent UI.
    pub command: String,
}

fn home_dir() -> Result<PathBuf, String> {
    #[cfg(windows)]
    let key = "USERPROFILE";
    #[cfg(not(windows))]
    let key = "HOME";
    std::env::var_os(key)
        .map(PathBuf::from)
        .ok_or_else(|| "could not resolve the home directory".to_string())
}

fn claude_settings_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".claude").join("settings.json"))
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

/// The command line we install into the Claude hooks. Absolute marrow path so
/// it resolves globally; `|| true` so it is a harmless no-op when the binary is
/// missing or env vars are absent; trailing marker so uninstall is exact.
fn hook_command() -> Result<String, String> {
    let dir = crate::sidecar::marrow_bin_dir()
        .ok_or_else(|| "could not locate the marrow sidecar binary".to_string())?;
    let bin = dir.join(if cfg!(windows) { "marrow.exe" } else { "marrow" });
    Ok(format!(
        "{} notify --needs-input >/dev/null 2>&1 || true # {HOOK_MARKER}",
        shell_quote(&bin.to_string_lossy())
    ))
}

/// A command is ours only if the marker is the *trailing comment* we appended —
/// not merely a substring anywhere (which could match an unrelated user hook
/// whose path/comment happens to contain the marker text). This keeps uninstall
/// from ever removing someone else's hook.
fn is_marrow_hook_command(command: &str) -> bool {
    command.trim_end().ends_with(&format!("# {HOOK_MARKER}"))
}

fn group_has_marker(group: &Value) -> bool {
    group
        .get("hooks")
        .and_then(Value::as_array)
        .map(|hooks| {
            hooks.iter().any(|hook| {
                hook.get("command")
                    .and_then(Value::as_str)
                    .map(is_marrow_hook_command)
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

/// True if our hook is present in either event list.
fn hook_installed(settings: &Value) -> bool {
    let Some(hooks) = settings.get("hooks").and_then(Value::as_object) else {
        return false;
    };
    HOOK_EVENTS.iter().any(|event| {
        hooks
            .get(*event)
            .and_then(Value::as_array)
            .map(|groups| groups.iter().any(group_has_marker))
            .unwrap_or(false)
    })
}

/// Additively merge our hook into `Stop` + `Notification`. Returns true if the
/// settings changed. Idempotent: a second call is a no-op.
fn ensure_hook(settings: &mut Value, command: &str) -> bool {
    if !settings.is_object() {
        // Only ever merge into an object; the caller guards against clobbering.
        return false;
    }
    let mut changed = false;
    let hooks = settings
        .as_object_mut()
        .unwrap()
        .entry("hooks")
        .or_insert_with(|| json!({}));
    if !hooks.is_object() {
        return false;
    }
    let hooks = hooks.as_object_mut().unwrap();
    for event in HOOK_EVENTS {
        let groups = hooks.entry(event).or_insert_with(|| json!([]));
        let Some(groups) = groups.as_array_mut() else {
            continue;
        };
        if groups.iter().any(group_has_marker) {
            continue;
        }
        groups.push(json!({
            "matcher": "",
            "hooks": [ { "type": "command", "command": command } ],
        }));
        changed = true;
    }
    changed
}

/// Remove only our tagged hook entries. Returns true if anything was removed.
/// Preserves all other hooks; prunes containers that become empty.
fn remove_hook(settings: &mut Value) -> bool {
    let Some(root) = settings.as_object_mut() else {
        return false;
    };
    let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut) else {
        return false;
    };
    let mut changed = false;
    for event in HOOK_EVENTS {
        let Some(groups) = hooks.get_mut(event).and_then(Value::as_array_mut) else {
            continue;
        };
        let before = groups.len();
        for group in groups.iter_mut() {
            if let Some(inner) = group.get_mut("hooks").and_then(Value::as_array_mut) {
                inner.retain(|hook| {
                    !hook
                        .get("command")
                        .and_then(Value::as_str)
                        .map(is_marrow_hook_command)
                        .unwrap_or(false)
                });
            }
        }
        // Drop groups whose inner hook list is now empty (ours were single-entry).
        groups.retain(|group| {
            group
                .get("hooks")
                .and_then(Value::as_array)
                .map(|inner| !inner.is_empty())
                .unwrap_or(true)
        });
        if groups.len() != before {
            changed = true;
        }
    }
    // Tidy empty event arrays and an empty hooks object.
    let empty_events: Vec<String> = hooks
        .iter()
        .filter(|(_, value)| value.as_array().map(|a| a.is_empty()).unwrap_or(false))
        .map(|(key, _)| key.clone())
        .collect();
    for key in empty_events {
        hooks.remove(&key);
    }
    if hooks.is_empty() {
        root.remove("hooks");
    }
    changed
}

fn read_settings(path: &PathBuf) -> Result<Value, String> {
    if !path.exists() {
        return Ok(json!({}));
    }
    let raw = fs::read_to_string(path)
        .map_err(|err| format!("failed to read {}: {err}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(json!({}));
    }
    let value: Value = serde_json::from_str(&raw).map_err(|err| {
        format!(
            "{} is not valid JSON ({err}); refusing to modify it",
            path.display()
        )
    })?;
    if !value.is_object() {
        return Err(format!(
            "{} is not a JSON object; refusing to modify it",
            path.display()
        ));
    }
    Ok(value)
}

fn write_settings(path: &PathBuf, settings: &Value) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|err| format!("failed to create {}: {err}", parent.display()))?;
    }
    // Keep a one-time backup before the first modification.
    let backup = path.with_extension("json.marrow-backup");
    if path.exists() && !backup.exists() {
        let _ = fs::copy(path, &backup);
    }
    let mut body = serde_json::to_string_pretty(settings).map_err(|err| err.to_string())?;
    body.push('\n');
    fs::write(path, body).map_err(|err| format!("failed to write {}: {err}", path.display()))
}

fn status_for(path: &PathBuf) -> Result<ClaudeHookStatus, String> {
    let exists = path.exists();
    let installed = if exists {
        hook_installed(&read_settings(path)?)
    } else {
        false
    };
    Ok(ClaudeHookStatus {
        installed,
        settings_path: path.to_string_lossy().to_string(),
        settings_exists: exists,
        command: hook_command()?,
    })
}

#[tauri::command]
pub fn claude_hook_status() -> Result<ClaudeHookStatus, String> {
    let path = claude_settings_path()?;
    status_for(&path)
}

#[tauri::command]
pub fn install_claude_hook() -> Result<ClaudeHookStatus, String> {
    let path = claude_settings_path()?;
    let mut settings = read_settings(&path)?;
    let command = hook_command()?;
    if ensure_hook(&mut settings, &command) {
        write_settings(&path, &settings)?;
    }
    status_for(&path)
}

#[tauri::command]
pub fn uninstall_claude_hook() -> Result<ClaudeHookStatus, String> {
    let path = claude_settings_path()?;
    if path.exists() {
        let mut settings = read_settings(&path)?;
        if remove_hook(&mut settings) {
            write_settings(&path, &settings)?;
        }
    }
    status_for(&path)
}

#[cfg(test)]
mod tests {
    use super::{ensure_hook, hook_installed, remove_hook, HOOK_MARKER};
    use serde_json::json;

    fn command() -> String {
        format!("'/app/marrow' notify --needs-input >/dev/null 2>&1 || true # {HOOK_MARKER}")
    }

    #[test]
    fn merge_is_additive_and_idempotent() {
        // Pre-existing unrelated hook must survive.
        let mut settings = json!({
            "model": "opus",
            "hooks": {
                "Stop": [
                    { "matcher": "", "hooks": [ { "type": "command", "command": "echo keep-me" } ] }
                ]
            }
        });
        assert!(ensure_hook(&mut settings, &command()));
        assert!(hook_installed(&settings));
        // Unrelated config + hook preserved.
        assert_eq!(settings["model"], "opus");
        let stop = settings["hooks"]["Stop"].as_array().unwrap();
        assert!(stop
            .iter()
            .any(|g| g["hooks"][0]["command"] == "echo keep-me"));
        // Notification was created too.
        assert!(settings["hooks"]["Notification"].is_array());
        // Idempotent: a second merge changes nothing.
        assert!(!ensure_hook(&mut settings, &command()));
    }

    #[test]
    fn uninstall_removes_only_ours_and_restores_shape() {
        let original = json!({
            "model": "opus",
            "hooks": {
                "Stop": [
                    { "matcher": "", "hooks": [ { "type": "command", "command": "echo keep-me" } ] }
                ]
            }
        });
        let mut settings = original.clone();
        ensure_hook(&mut settings, &command());
        assert!(hook_installed(&settings));
        assert!(remove_hook(&mut settings));
        assert!(!hook_installed(&settings));
        // The user's own hook is untouched; our created Notification array pruned.
        assert_eq!(settings, original);
    }

    #[test]
    fn no_hook_reported_when_absent() {
        assert!(!hook_installed(&json!({})));
        assert!(!hook_installed(&json!({ "hooks": { "Stop": [] } })));
    }

    #[test]
    fn unrelated_hook_containing_marker_substring_is_left_alone() {
        // A user hook that merely *mentions* the marker (in a path or comment)
        // must never be matched as ours — only the exact trailing-comment form is.
        let original = json!({
            "hooks": {
                "Stop": [
                    {
                        "matcher": "",
                        "hooks": [
                            { "type": "command", "command": "/opt/marrow-symphony-hook-helper/run.sh # not ours" }
                        ]
                    }
                ]
            }
        });
        let mut settings = original.clone();
        assert!(!hook_installed(&settings));
        // Install ours, then remove ours — the user's lookalike hook must remain.
        ensure_hook(&mut settings, &command());
        assert!(remove_hook(&mut settings));
        assert_eq!(settings, original);
    }
}
