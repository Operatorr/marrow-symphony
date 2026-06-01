PRAGMA foreign_keys = ON;

CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER REFERENCES groups(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  git_backed INTEGER NOT NULL DEFAULT 0,
  default_runner TEXT NOT NULL DEFAULT 'claude',
  default_workspace_strategy TEXT NOT NULL DEFAULT 'shared_checkout',
  color TEXT NOT NULL DEFAULT '#2563eb',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE board_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  state_type TEXT NOT NULL CHECK (
    state_type IN ('backlog', 'todo', 'started', 'in-review', 'done', 'canceled')
  ),
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (project_id, state_type),
  UNIQUE (project_id, position)
);

CREATE TABLE issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  state_type TEXT NOT NULL DEFAULT 'todo' CHECK (
    state_type IN ('backlog', 'todo', 'started', 'in-review', 'done', 'canceled')
  ),
  runner_override TEXT,
  workspace_strategy TEXT NOT NULL DEFAULT 'shared_checkout' CHECK (
    workspace_strategy IN ('shared_checkout', 'worktree', 'branch_in_place')
  ),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  issue_id INTEGER NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  runner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (
    status IN ('running', 'needs_input', 'idle', 'exited')
  ),
  workspace_path TEXT NOT NULL,
  issue_file_path TEXT,
  pid INTEGER,
  exit_code INTEGER,
  started_at TEXT NOT NULL DEFAULT (datetime('now')),
  exited_at TEXT,
  last_output_at TEXT
);

CREATE INDEX idx_issues_project_id ON issues(project_id);
CREATE INDEX idx_sessions_issue_id ON sessions(issue_id);
CREATE INDEX idx_sessions_project_id ON sessions(project_id);
CREATE INDEX idx_sessions_status ON sessions(status);
