ALTER TABLE rpg_zzu.project_commits
  ADD COLUMN IF NOT EXISTS summary text NULL,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS author_id text NULL,
  ADD COLUMN IF NOT EXISTS author_label text NULL,
  ADD COLUMN IF NOT EXISTS author_kind text NULL,
  ADD COLUMN IF NOT EXISTS agent_name text NULL;

ALTER TABLE rpg_zzu.project_commits
  ADD CONSTRAINT project_commits_review_status_check
  CHECK (review_status IN ('approved', 'direct')) NOT VALID;

ALTER TABLE rpg_zzu.project_commits
  ADD CONSTRAINT project_commits_author_kind_check
  CHECK (author_kind IS NULL OR author_kind IN ('human', 'agent')) NOT VALID;

CREATE INDEX IF NOT EXISTS project_commits_project_status_created_idx
  ON rpg_zzu.project_commits(project_id, review_status, created_at DESC);
