PRAGMA foreign_keys = ON;

-- Display-only Linear link fields (two-way sync is deferred to the Linear slice;
-- 0002 only surfaces a badge/link when these are populated). Nullable, no default.
ALTER TABLE projects ADD COLUMN linear_url TEXT;
ALTER TABLE projects ADD COLUMN linear_key TEXT;

ALTER TABLE issues ADD COLUMN linear_url TEXT;
ALTER TABLE issues ADD COLUMN linear_key TEXT;
