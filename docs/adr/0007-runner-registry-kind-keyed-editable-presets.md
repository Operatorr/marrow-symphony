# Runner registry: editable presets keyed by an immutable `kind` adapter

0001 hardcoded a single `claude` command string in `projects.default_runner`. The Issue/§7 picker
needs real presets (`claude` / `codex` / `kilo`) plus custom Runners with launch/resume commands and
env. We store Runners in a `runners` table whose **only immutable field is `kind`** — the agent-CLI
adapter — while name, launch command, resume command, and env are user-editable; Projects and Issues
reference a Runner by **foreign key**, and Sessions **snapshot** what actually ran.

## Decision

- **Table:** `runners(id, kind, name, launch_cmd, resume_cmd, env_json)`. `kind ∈ {claude, codex,
  generic}` is immutable and selects runner-specific integration code — the attention-activation hook
  ([ADR 0008]) and the resume-token capture regex (below). Everything else is editable.
- **References by FK:** `projects.default_runner_id` (`NOT NULL`, `ON DELETE RESTRICT`) and
  `issues.runner_override_id` (nullable, `ON DELETE SET NULL`). Resolution is the existing
  `COALESCE(override, default)`.
- **Sessions snapshot, never live-reference.** A Session row records the resolved runner **name +
  kind + launch command** and the captured **`resume_token`**; it keeps a nullable soft `runner_id`
  (`ON DELETE SET NULL`) for "link back to the preset" only. Display, chrome, and resume read the
  snapshot — because Runners are editable and a Session is a historical record of what was launched.
- **Commands are shell strings** run via the user's login shell ([ADR 0004]), with
  `{{workspace}}` / `{{issueFile}}` / `{{branch}}` / `{{resumeToken}}` interpolated using
  **shell-escaped** values, so a path or token can't break the line or inject.
- **System env layer.** `MARROW_ISSUE_FILE`, `MARROW_SESSION_ID`, `MARROW_NOTIFY_SOCKET` are injected
  by Marrow *beneath* the Runner's editable `env_json` and cannot be edited or shadowed.
- **Resume token capture.** The `kind` adapter may define an output regex run in the PTY reader that
  scrapes the resume command the CLI prints (e.g. `claude --resume <uuid>`) into `sessions.resume_token`;
  Resume re-runs `resume_cmd` with `{{resumeToken}}` filled, in the same Workspace, as a new Session.

## Considered options

- **Reference Runners by name string** (status quo extended) — rejected: renames orphan references and
  there's no referential integrity.
- **Live FK on sessions** — rejected: editing a Runner would retroactively rewrite what past Sessions
  "ran," breaking faithful history and resume.
- **argv arrays instead of shell strings** — rejected: loses login-shell PATH/profile resolution and
  power-user shell features; shell-escaping the interpolated values closes the quoting/injection hole
  without that cost.
- **An `is_builtin` flag to protect presets** — rejected: `kind` already carries adapter behavior and
  `ON DELETE RESTRICT` already protects in-use Runners, so presets can be ordinary editable/deletable
  rows (with a guard against deleting the last one).

## Consequences

- `kind` is the seam that lets Marrow integrate tightly with specific CLIs (hooks, token capture) while
  staying **Runner-agnostic** ([ADR 0002]): integration is keyed on `kind`, never on parsing the agent
  protocol.
- Deleting a Runner that is a Project's default is blocked until reassigned; deleting one used only as
  an Issue override silently clears that override.
- A migration converts the `default_runner` / `runner_override` string columns to FKs and seeds the
  preset rows.

[ADR 0002]: ./0002-runner-agnostic-interactive-terminals.md
[ADR 0004]: ./0004-trust-posture-inherit-user-permissions.md
[ADR 0008]: ./0008-needs-input-detection-terminal-signals-and-notify-sidecar.md
