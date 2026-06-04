//! `marrow` — the agent's CLI bridge to Marrow (ADR 0008 / ADR 0009).
//!
//! Runs inside a Session, reads `MARROW_NOTIFY_SOCKET` + `MARROW_SESSION_ID`
//! from its environment, sends one JSON request to the app over the unix socket,
//! and prints the response. It **no-ops cleanly** when those env vars are absent,
//! so non-Marrow agent usage is completely unaffected.
//!
//! Verbs:
//!   marrow notify [--needs-input | --done]
//!   marrow issue read [--json]
//!   marrow issue comment "<text>"
//!   marrow diff

use serde_json::{json, Value};

fn main() {
    let socket = std::env::var("MARROW_NOTIFY_SOCKET").unwrap_or_default();
    let session_id = std::env::var("MARROW_SESSION_ID")
        .ok()
        .and_then(|raw| raw.parse::<i64>().ok());

    // Not inside a Marrow Session → silent success, so the same Runner command
    // works outside Marrow.
    if !should_run(&socket, session_id) {
        return;
    }
    let session_id = session_id.expect("guarded by should_run");

    let args: Vec<String> = std::env::args().skip(1).collect();
    if matches!(args.first().map(String::as_str), Some("help" | "-h" | "--help")) {
        print_usage();
        return;
    }

    let request = match build_request(session_id, &args) {
        Ok(request) => request,
        Err(message) => {
            eprintln!("marrow: {message}");
            print_usage();
            std::process::exit(2);
        }
    };

    match send(&socket, &request) {
        Ok(response) => {
            if let Some(text) = response.get("text").and_then(Value::as_str) {
                if !text.is_empty() {
                    println!("{text}");
                }
            }
            let ok = response.get("ok").and_then(Value::as_bool).unwrap_or(false);
            if !ok {
                let error = response
                    .get("error")
                    .and_then(Value::as_str)
                    .unwrap_or("request failed");
                eprintln!("marrow: {error}");
                std::process::exit(1);
            }
        }
        Err(err) => {
            eprintln!("marrow: {err}");
            std::process::exit(1);
        }
    }
}

fn should_run(socket: &str, session_id: Option<i64>) -> bool {
    !socket.is_empty() && session_id.is_some()
}

fn build_request(session_id: i64, args: &[String]) -> Result<Value, String> {
    let verb = args.first().ok_or("missing verb")?.as_str();
    match verb {
        "notify" => {
            let needs_input = match args.get(1).map(String::as_str) {
                None | Some("--needs-input") => true,
                Some("--done") => false,
                Some(other) => return Err(format!("unknown notify flag `{other}`")),
            };
            Ok(json!({ "sessionId": session_id, "verb": "notify", "needsInput": needs_input }))
        }
        "issue" => {
            let sub = args.get(1).map(String::as_str).ok_or("issue needs a subcommand")?;
            match sub {
                "read" => {
                    let want_json = matches!(args.get(2).map(String::as_str), Some("--json"));
                    Ok(json!({ "sessionId": session_id, "verb": "issue_read", "json": want_json }))
                }
                "comment" => {
                    let body = args[2..].join(" ");
                    if body.trim().is_empty() {
                        return Err("issue comment requires text".to_string());
                    }
                    Ok(json!({ "sessionId": session_id, "verb": "issue_comment", "body": body }))
                }
                other => Err(format!("unknown issue subcommand `{other}`")),
            }
        }
        "diff" => Ok(json!({ "sessionId": session_id, "verb": "diff" })),
        other => Err(format!("unknown verb `{other}`")),
    }
}

fn print_usage() {
    eprintln!(
        "marrow — agent bridge to Marrow\n\
         \n\
         Usage:\n\
         \x20 marrow notify [--needs-input | --done]   signal attention state\n\
         \x20 marrow issue read [--json]               print this Issue's task context\n\
         \x20 marrow issue comment \"<text>\"            write progress back to the Issue\n\
         \x20 marrow diff                              print the Workspace diff summary"
    );
}

#[cfg(unix)]
fn send(socket: &str, request: &Value) -> Result<Value, String> {
    use std::io::{Read, Write};
    use std::os::unix::net::UnixStream;

    let mut stream =
        UnixStream::connect(socket).map_err(|err| format!("cannot reach Marrow: {err}"))?;
    let mut line = serde_json::to_string(request).map_err(|err| err.to_string())?;
    line.push('\n');
    stream
        .write_all(line.as_bytes())
        .map_err(|err| format!("write failed: {err}"))?;
    stream.flush().ok();
    let mut buf = String::new();
    stream
        .read_to_string(&mut buf)
        .map_err(|err| format!("read failed: {err}"))?;
    serde_json::from_str(buf.trim()).map_err(|err| format!("bad response: {err}"))
}

#[cfg(not(unix))]
fn send(_socket: &str, _request: &Value) -> Result<Value, String> {
    Err("the marrow socket bridge is only supported on Unix".to_string())
}

#[cfg(test)]
mod tests {
    use super::{build_request, should_run};

    #[test]
    fn no_ops_without_env() {
        assert!(!should_run("", Some(7)));
        assert!(!should_run("/tmp/x.sock", None));
        assert!(should_run("/tmp/x.sock", Some(7)));
    }

    #[test]
    fn builds_notify_requests() {
        let needs = build_request(5, &["notify".into()]).unwrap();
        assert_eq!(needs["verb"], "notify");
        assert_eq!(needs["needsInput"], true);
        assert_eq!(needs["sessionId"], 5);

        let done = build_request(5, &["notify".into(), "--done".into()]).unwrap();
        assert_eq!(done["needsInput"], false);
    }

    #[test]
    fn builds_issue_and_diff_requests() {
        let read = build_request(1, &["issue".into(), "read".into(), "--json".into()]).unwrap();
        assert_eq!(read["verb"], "issue_read");
        assert_eq!(read["json"], true);

        let comment = build_request(
            1,
            &["issue".into(), "comment".into(), "made".into(), "progress".into()],
        )
        .unwrap();
        assert_eq!(comment["verb"], "issue_comment");
        assert_eq!(comment["body"], "made progress");

        let diff = build_request(1, &["diff".into()]).unwrap();
        assert_eq!(diff["verb"], "diff");
    }

    #[test]
    fn rejects_unknown_and_empty() {
        assert!(build_request(1, &["frobnicate".into()]).is_err());
        assert!(build_request(1, &[]).is_err());
        assert!(build_request(1, &["issue".into(), "comment".into()]).is_err());
    }
}
