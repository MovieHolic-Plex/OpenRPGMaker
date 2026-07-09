-- AI 활동 로그: 채팅 턴 / 영역 작업 / 기타 AI 실행마다 1행.
-- payload_json 에 toolCalls·audit·uiEvents·result 등 진단 페이로드를 통째로 담는다.

CREATE TABLE IF NOT EXISTS rpg_zzu.ai_activity_logs (
  log_id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  channel text NOT NULL,
  instruction text NOT NULL,
  map_id text NULL,
  payload_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (char_length(channel) > 0),
  CHECK (char_length(instruction) >= 0)
);

CREATE INDEX IF NOT EXISTS ai_activity_logs_project_created_idx
  ON rpg_zzu.ai_activity_logs(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ai_activity_logs_channel_created_idx
  ON rpg_zzu.ai_activity_logs(project_id, channel, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON rpg_zzu.ai_activity_logs TO anon, authenticated, authenticator, service_role;
