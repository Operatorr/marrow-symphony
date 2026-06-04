PRAGMA foreign_keys = ON;

-- Workspace-level Linear credential. Single row (id = 1). The token is either a
-- personal API key (method 'api_key', sent verbatim) or an OAuth access token
-- (method 'oauth', sent as a Bearer token). Stored locally only.
CREATE TABLE linear_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  method TEXT NOT NULL CHECK (method IN ('api_key', 'oauth')),
  access_token TEXT NOT NULL,
  workspace_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-Project link to a Linear Project. The Project's display chip continues to
-- use projects.linear_key / linear_url; this table holds the stable Linear id
-- needed to import that Project's Issues.
CREATE TABLE linear_links (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  linear_project_id TEXT NOT NULL,
  linear_project_name TEXT,
  linear_project_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Track the originating Linear issue so re-import updates in place rather than
-- duplicating. Partial-unique so locally-created Issues (NULL) are unconstrained.
ALTER TABLE issues ADD COLUMN linear_issue_id TEXT;
CREATE UNIQUE INDEX idx_issues_linear_issue_id
  ON issues(linear_issue_id) WHERE linear_issue_id IS NOT NULL;
