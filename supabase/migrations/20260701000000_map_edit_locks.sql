CREATE TABLE IF NOT EXISTS rpg_zzu.map_edit_locks (
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  map_id text NOT NULL,
  map_name text NOT NULL,
  owner_session_id text NOT NULL,
  owner_label text NOT NULL,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, map_id)
);

CREATE INDEX IF NOT EXISTS map_edit_locks_expires_idx
  ON rpg_zzu.map_edit_locks(expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON rpg_zzu.map_edit_locks TO anon, authenticated, authenticator, service_role;
