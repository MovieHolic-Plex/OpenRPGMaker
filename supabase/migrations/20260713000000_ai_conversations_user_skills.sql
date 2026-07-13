-- AI 대화 기록 + 사용자 정의 스킬 원격 미러.
-- 로컬(localStorage)이 정본이고 여기는 기기 간 복원/검색용 미러다 —
-- 쓰기는 클라이언트 fire-and-forget upsert, 읽기는 복원·검색 시 조회.

CREATE TABLE IF NOT EXISTS rpg_zzu.ai_conversations (
  conversation_id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  title text NOT NULL,
  model text NOT NULL,
  project_context_key text NULL,
  entries_json jsonb NOT NULL,
  saved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(conversation_id) > 0),
  CHECK (char_length(title) > 0)
);

CREATE INDEX IF NOT EXISTS ai_conversations_project_saved_idx
  ON rpg_zzu.ai_conversations(project_id, saved_at DESC);

-- 제목 부분일치 검색(ilike)용.
CREATE INDEX IF NOT EXISTS ai_conversations_title_idx
  ON rpg_zzu.ai_conversations(project_id, title);

CREATE TABLE IF NOT EXISTS rpg_zzu.user_skills (
  skill_id text NOT NULL,
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  icon text NOT NULL DEFAULT '⭐',
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  template text NOT NULL,
  skill_json jsonb NULL, -- params/needsSelection 등 확장 필드(스키마 진화 대비 원본 통째)
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, skill_id),
  CHECK (char_length(skill_id) > 0),
  CHECK (char_length(name) > 0)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON rpg_zzu.ai_conversations TO anon, authenticated, authenticator, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON rpg_zzu.user_skills TO anon, authenticated, authenticator, service_role;
