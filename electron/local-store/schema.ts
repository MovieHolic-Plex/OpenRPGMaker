/** 2: `project.current_json` 의 타일셋을 `tileset_blobs` 로 접는다. 접힌 행을 쓸 때 올린다 — 이전 빌드는 열기를 거절한다. */
export const LOCAL_STORE_FORMAT_VERSION = 2;

export const PROJECT_STORE_FILE = "project.sqlite";
export const ASSETS_DIR = "assets";
export const BACKUPS_DIR = "backups";

/**
 * 타일셋 본문 내용 주소 저장소. `project.current_json` 의 타일셋 칸은 `{"$blob":"<sha256>"}` 로 접혀 있고,
 * 본문(`JSON.stringify(tileset)`)은 여기 한 번만 있다. 문서 해시·내보내기는 펼친 글 기준이다(store.ts `foldProjectText`).
 * 실측(2026-09-27, 82MB 프로젝트): 문서의 80.7MB 가 타일셋이고 전부 앱 번들·공용 카탈로그의 사본이었다.
 * 행을 끝어 쓰면 저장마다 81MB 를 다시 쓰고, 접으면 바뀐 타일셋만 쓴다.
 * 낡은 저장소(마커 없는 행)는 그대로 읽히고 다음 저장에서 접힌다.
 */
export const TILESET_BLOBS_DDL = `
CREATE TABLE IF NOT EXISTS tileset_blobs (
  sha256 TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;

export const STORE_DDL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS project (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  project_id TEXT NOT NULL,
  title TEXT,
  document_version INTEGER NOT NULL,
  current_json TEXT NOT NULL,
  current_sha256 TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS maps (
  project_id TEXT NOT NULL,
  map_id TEXT NOT NULL,
  name TEXT,
  width INTEGER,
  height INTEGER,
  tileset_id TEXT,
  map_json TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (project_id, map_id)
);
CREATE TABLE IF NOT EXISTS commits (
  commit_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  parent_commit_id TEXT,
  created_at TEXT NOT NULL,
  message TEXT,
  summary TEXT,
  review_status TEXT,
  author_id TEXT,
  author_kind TEXT,
  author_label TEXT,
  agent_name TEXT,
  current_sha256 TEXT,
  diff_json TEXT,
  tool_names_json TEXT,
  edit_activity_json TEXT
);
CREATE TABLE IF NOT EXISTS changes (
  change_id INTEGER PRIMARY KEY AUTOINCREMENT,
  commit_id TEXT NOT NULL REFERENCES commits(commit_id) ON DELETE CASCADE,
  entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  patch_json TEXT
);
CREATE TABLE IF NOT EXISTS ai_activity_logs (
  log_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  run_id TEXT,
  channel TEXT NOT NULL,
  instruction TEXT NOT NULL,
  map_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_conversations (
  conversation_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  model TEXT,
  project_context_key TEXT,
  entries_json TEXT NOT NULL,
  saved_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ai_analysis_runs (
  run_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  tileset_id TEXT,
  selected_tile_ids_json TEXT,
  prompt_context_json TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS assets (
  sha256 TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  extension TEXT NOT NULL,
  original_name TEXT,
  kind TEXT,
  created_at TEXT NOT NULL
);
${TILESET_BLOBS_DDL}
CREATE INDEX IF NOT EXISTS commits_recent ON commits (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_recent ON ai_activity_logs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_recent ON ai_conversations (project_id, saved_at DESC);
`;

export const META_KEYS = {
  formatVersion: "format_version",
  projectId: "project_id",
  createdAt: "created_at",
  appVersion: "app_version",
} as const;
