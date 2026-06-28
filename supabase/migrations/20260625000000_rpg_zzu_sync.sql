CREATE SCHEMA IF NOT EXISTS rpg_zzu;

CREATE TABLE IF NOT EXISTS rpg_zzu.projects (
  project_id text PRIMARY KEY,
  title text NOT NULL,
  schema_version integer NOT NULL,
  current_json jsonb NOT NULL,
  current_sha256 text NOT NULL,
  map_count integer NOT NULL,
  tileset_count integer NOT NULL,
  terrain_template_count integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpg_zzu.project_commits (
  commit_id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  parent_commit_id uuid NULL REFERENCES rpg_zzu.project_commits(commit_id) ON DELETE SET NULL,
  message text NOT NULL,
  current_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpg_zzu.project_changes (
  change_id bigserial PRIMARY KEY,
  commit_id uuid NOT NULL REFERENCES rpg_zzu.project_commits(commit_id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  operation text NOT NULL,
  patch_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpg_zzu.maps (
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  map_id text NOT NULL,
  name text NOT NULL,
  width integer NOT NULL,
  height integer NOT NULL,
  tileset_id text NOT NULL,
  lower_sha256 text NOT NULL,
  upper_sha256 text NOT NULL,
  lower_tile_count integer NOT NULL,
  upper_tile_count integer NOT NULL,
  map_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, map_id),
  CHECK (width > 0),
  CHECK (height > 0),
  CHECK (lower_tile_count = width * height),
  CHECK (upper_tile_count = width * height)
);

CREATE TABLE IF NOT EXISTS rpg_zzu.tilesets (
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  tileset_id text NOT NULL,
  name text NOT NULL,
  tile_count integer NOT NULL,
  tileset_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, tileset_id),
  CHECK (tile_count > 0)
);

CREATE TABLE IF NOT EXISTS rpg_zzu.terrain_templates (
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  tileset_id text NOT NULL,
  template_id text NOT NULL,
  name text NOT NULL,
  category text NULL,
  template_json jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(project_id, tileset_id, template_id)
);

CREATE TABLE IF NOT EXISTS rpg_zzu.sync_verification_runs (
  run_id uuid PRIMARY KEY,
  project_id text NOT NULL,
  commit_id uuid NOT NULL,
  local_sha256 text NOT NULL,
  remote_sha256 text NOT NULL,
  map_count integer NOT NULL,
  tileset_count integer NOT NULL,
  terrain_template_count integer NOT NULL,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpg_zzu.ai_analysis_runs (
  run_id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  tileset_id text NOT NULL,
  selected_tile_ids_json jsonb NOT NULL,
  prompt_context_json jsonb NOT NULL,
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_commits_project_created_idx
  ON rpg_zzu.project_commits(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS project_changes_commit_entity_idx
  ON rpg_zzu.project_changes(commit_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS maps_project_name_idx
  ON rpg_zzu.maps(project_id, name);

CREATE INDEX IF NOT EXISTS terrain_templates_project_tileset_idx
  ON rpg_zzu.terrain_templates(project_id, tileset_id);

CREATE INDEX IF NOT EXISTS ai_analysis_runs_project_created_idx
  ON rpg_zzu.ai_analysis_runs(project_id, created_at DESC);

GRANT USAGE ON SCHEMA rpg_zzu TO anon, authenticated, authenticator, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rpg_zzu TO anon, authenticated, authenticator, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rpg_zzu TO anon, authenticated, authenticator, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, authenticator, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, authenticator, service_role;
