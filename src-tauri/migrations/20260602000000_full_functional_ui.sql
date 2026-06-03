PRAGMA foreign_keys = ON;

CREATE TABLE runners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('claude', 'codex', 'generic')),
  name TEXT NOT NULL UNIQUE,
  launch_cmd TEXT NOT NULL,
  resume_cmd TEXT NOT NULL DEFAULT '',
  env_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO runners (kind, name, launch_cmd, resume_cmd, env_json)
VALUES
  ('claude', 'Claude', 'claude', 'claude --resume {{resumeToken}}', '{}'),
  ('codex', 'Codex', 'codex', 'codex resume {{resumeToken}}', '{}'),
  ('generic', 'Kilo', 'kilo', '', '{}')
ON CONFLICT(name) DO NOTHING;

ALTER TABLE projects ADD COLUMN color_index INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN default_runner_id INTEGER REFERENCES runners(id) ON DELETE RESTRICT;

UPDATE projects
SET color_index = ((id - 1) % 6) + 1
WHERE color_index IS NULL OR color_index < 1 OR color_index > 6;

UPDATE projects
SET default_runner_id = (
  SELECT id FROM runners
  WHERE lower(name) = lower(projects.default_runner)
  ORDER BY id
  LIMIT 1
)
WHERE default_runner_id IS NULL;

UPDATE projects
SET default_runner_id = (SELECT id FROM runners WHERE kind = 'claude' ORDER BY id LIMIT 1)
WHERE default_runner_id IS NULL;

ALTER TABLE issues ADD COLUMN runner_override_id INTEGER REFERENCES runners(id) ON DELETE SET NULL;

UPDATE issues
SET runner_override_id = (
  SELECT id FROM runners
  WHERE lower(name) = lower(issues.runner_override)
  ORDER BY id
  LIMIT 1
)
WHERE runner_override IS NOT NULL AND runner_override_id IS NULL;

ALTER TABLE sessions ADD COLUMN runner_id INTEGER REFERENCES runners(id) ON DELETE SET NULL;
ALTER TABLE sessions ADD COLUMN runner_kind TEXT NOT NULL DEFAULT 'generic';
ALTER TABLE sessions ADD COLUMN runner_command TEXT NOT NULL DEFAULT '';
ALTER TABLE sessions ADD COLUMN resume_token TEXT;
ALTER TABLE sessions ADD COLUMN needs_input_since TEXT;
ALTER TABLE sessions ADD COLUMN snoozed_until TEXT;
ALTER TABLE sessions ADD COLUMN output_scrollback TEXT NOT NULL DEFAULT '';

UPDATE sessions
SET runner_kind = COALESCE(
  (SELECT kind FROM runners WHERE lower(name) = lower(sessions.runner) LIMIT 1),
  'generic'
)
WHERE runner_kind = 'generic';

UPDATE sessions
SET runner_id = (
  SELECT id FROM runners
  WHERE lower(name) = lower(sessions.runner)
  LIMIT 1
)
WHERE runner_id IS NULL;

CREATE TABLE issue_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  session_id INTEGER REFERENCES sessions(id) ON DELETE SET NULL,
  author TEXT NOT NULL DEFAULT 'agent',
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_projects_group_id ON projects(group_id);
CREATE INDEX idx_issues_state_type ON issues(state_type);
CREATE INDEX idx_sessions_needs_input_since ON sessions(needs_input_since);
CREATE INDEX idx_sessions_snoozed_until ON sessions(snoozed_until);
CREATE INDEX idx_issue_comments_issue_id ON issue_comments(issue_id);
