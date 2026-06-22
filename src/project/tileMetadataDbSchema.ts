import type initSqlJs from "sql.js";

const SQLITE_SCHEMA_VERSION = 1;

type SqlDatabase = initSqlJs.Database;

export function migrateTileMetadataDb(db: SqlDatabase): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      schema_version INTEGER NOT NULL,
      current_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS tilesets (
      project_id TEXT NOT NULL,
      tileset_id TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      image_fingerprint TEXT NOT NULL,
      tile_size INTEGER NOT NULL,
      tiles_per_row INTEGER NOT NULL,
      tile_count INTEGER NOT NULL,
      name TEXT NOT NULL,
      PRIMARY KEY(project_id, tileset_id)
    );
    CREATE TABLE IF NOT EXISTS tile_metadata (
      project_id TEXT NOT NULL,
      tileset_id TEXT NOT NULL,
      tile_id INTEGER NOT NULL,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      role TEXT NOT NULL,
      repeatability TEXT NOT NULL,
      default_layer TEXT NOT NULL,
      terrain_tag INTEGER NOT NULL,
      passage TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source TEXT NOT NULL,
      user_locked INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(project_id, tileset_id, tile_id)
    );
    CREATE TABLE IF NOT EXISTS tile_groups (
      project_id TEXT NOT NULL,
      tileset_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      default_layer TEXT NOT NULL,
      description TEXT NOT NULL,
      placement_rules TEXT NOT NULL,
      confidence TEXT NOT NULL,
      source_rect_json TEXT NOT NULL,
      preview_map_json TEXT NOT NULL,
      pattern_grammar_json TEXT NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY(project_id, group_id)
    );
    CREATE TABLE IF NOT EXISTS tile_group_tiles (
      project_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      tile_id INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      PRIMARY KEY(project_id, group_id, tile_id)
    );
    CREATE TABLE IF NOT EXISTS ai_analysis_runs (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      tileset_id TEXT NOT NULL,
      selected_tile_ids_json TEXT NOT NULL,
      prompt_context_json TEXT NOT NULL,
      result_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    PRAGMA user_version = ${SQLITE_SCHEMA_VERSION};
  `);
}
