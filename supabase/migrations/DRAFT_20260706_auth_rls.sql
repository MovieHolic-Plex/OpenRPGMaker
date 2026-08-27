-- DRAFT ONLY: Phase 8 Supabase Auth/RLS migration sketch.
-- Do not apply directly to production. Validate in a disposable Supabase project first.
-- Static validation performed locally without psql: balanced dollar quotes/parentheses and
-- semicolon-terminated statements only. PostgreSQL/Supabase runtime semantics are not verified here.

CREATE TABLE IF NOT EXISTS rpg_zzu.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rpg_zzu.project_members (
  membership_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id text NOT NULL REFERENCES rpg_zzu.projects(project_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS project_members_user_project_idx
  ON rpg_zzu.project_members(user_id, project_id);

CREATE OR REPLACE FUNCTION rpg_zzu.is_project_member(_project_id text, _min_role text DEFAULT 'viewer')
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = rpg_zzu, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM rpg_zzu.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = auth.uid()
      AND CASE pm.role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
      END >= CASE _min_role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 999
      END
  );
$$;

ALTER TABLE rpg_zzu.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.tilesets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.terrain_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.map_edit_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.project_commits ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.project_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.ai_analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.sync_verification_runs ENABLE ROW LEVEL SECURITY;
-- 0709 · 0713 에서 추가된 테이블 — 이 초안보다 나중에 생겼으므로 목록에 늦게 붙었다.
-- 빠뜨리면 대화 전문(entries_json) · 툴 호출 로그(payload_json) 가 모든 authenticated 사용자에게 열린다.
ALTER TABLE rpg_zzu.ai_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE rpg_zzu.user_skills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_visible ON rpg_zzu.profiles;
CREATE POLICY profiles_select_visible ON rpg_zzu.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM rpg_zzu.project_members self_member
      JOIN rpg_zzu.project_members peer_member
        ON peer_member.project_id = self_member.project_id
      WHERE self_member.user_id = auth.uid()
        AND peer_member.user_id = profiles.user_id
    )
  );

DROP POLICY IF EXISTS profiles_insert_self ON rpg_zzu.profiles;
CREATE POLICY profiles_insert_self ON rpg_zzu.profiles
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self ON rpg_zzu.profiles;
CREATE POLICY profiles_update_self ON rpg_zzu.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_delete_self ON rpg_zzu.profiles;
CREATE POLICY profiles_delete_self ON rpg_zzu.profiles
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS project_members_select_member ON rpg_zzu.project_members;
CREATE POLICY project_members_select_member ON rpg_zzu.project_members
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS project_members_insert_owner ON rpg_zzu.project_members;
CREATE POLICY project_members_insert_owner ON rpg_zzu.project_members
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'owner'));

DROP POLICY IF EXISTS project_members_update_owner ON rpg_zzu.project_members;
CREATE POLICY project_members_update_owner ON rpg_zzu.project_members
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'owner'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'owner'));

DROP POLICY IF EXISTS project_members_delete_owner ON rpg_zzu.project_members;
CREATE POLICY project_members_delete_owner ON rpg_zzu.project_members
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'owner'));

DROP POLICY IF EXISTS projects_select_member ON rpg_zzu.projects;
CREATE POLICY projects_select_member ON rpg_zzu.projects
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS projects_insert_editor ON rpg_zzu.projects;
CREATE POLICY projects_insert_editor ON rpg_zzu.projects
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS projects_update_editor ON rpg_zzu.projects;
CREATE POLICY projects_update_editor ON rpg_zzu.projects
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS projects_delete_editor ON rpg_zzu.projects;
CREATE POLICY projects_delete_editor ON rpg_zzu.projects
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS maps_select_member ON rpg_zzu.maps;
CREATE POLICY maps_select_member ON rpg_zzu.maps
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS maps_insert_editor ON rpg_zzu.maps;
CREATE POLICY maps_insert_editor ON rpg_zzu.maps
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS maps_update_editor ON rpg_zzu.maps;
CREATE POLICY maps_update_editor ON rpg_zzu.maps
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS maps_delete_editor ON rpg_zzu.maps;
CREATE POLICY maps_delete_editor ON rpg_zzu.maps
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS tilesets_select_member ON rpg_zzu.tilesets;
CREATE POLICY tilesets_select_member ON rpg_zzu.tilesets
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS tilesets_insert_editor ON rpg_zzu.tilesets;
CREATE POLICY tilesets_insert_editor ON rpg_zzu.tilesets
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS tilesets_update_editor ON rpg_zzu.tilesets;
CREATE POLICY tilesets_update_editor ON rpg_zzu.tilesets
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS tilesets_delete_editor ON rpg_zzu.tilesets;
CREATE POLICY tilesets_delete_editor ON rpg_zzu.tilesets
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS terrain_templates_select_member ON rpg_zzu.terrain_templates;
CREATE POLICY terrain_templates_select_member ON rpg_zzu.terrain_templates
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS terrain_templates_insert_editor ON rpg_zzu.terrain_templates;
CREATE POLICY terrain_templates_insert_editor ON rpg_zzu.terrain_templates
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS terrain_templates_update_editor ON rpg_zzu.terrain_templates;
CREATE POLICY terrain_templates_update_editor ON rpg_zzu.terrain_templates
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS terrain_templates_delete_editor ON rpg_zzu.terrain_templates;
CREATE POLICY terrain_templates_delete_editor ON rpg_zzu.terrain_templates
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS map_edit_locks_select_member ON rpg_zzu.map_edit_locks;
CREATE POLICY map_edit_locks_select_member ON rpg_zzu.map_edit_locks
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS map_edit_locks_insert_editor ON rpg_zzu.map_edit_locks;
CREATE POLICY map_edit_locks_insert_editor ON rpg_zzu.map_edit_locks
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS map_edit_locks_update_editor ON rpg_zzu.map_edit_locks;
CREATE POLICY map_edit_locks_update_editor ON rpg_zzu.map_edit_locks
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS map_edit_locks_delete_editor ON rpg_zzu.map_edit_locks;
CREATE POLICY map_edit_locks_delete_editor ON rpg_zzu.map_edit_locks
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS project_commits_select_member ON rpg_zzu.project_commits;
CREATE POLICY project_commits_select_member ON rpg_zzu.project_commits
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS project_commits_insert_editor ON rpg_zzu.project_commits;
CREATE POLICY project_commits_insert_editor ON rpg_zzu.project_commits
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS project_commits_update_editor ON rpg_zzu.project_commits;
CREATE POLICY project_commits_update_editor ON rpg_zzu.project_commits
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS project_commits_delete_editor ON rpg_zzu.project_commits;
CREATE POLICY project_commits_delete_editor ON rpg_zzu.project_commits
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS project_changes_select_member ON rpg_zzu.project_changes;
CREATE POLICY project_changes_select_member ON rpg_zzu.project_changes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rpg_zzu.project_commits pc
      WHERE pc.commit_id = project_changes.commit_id
        AND rpg_zzu.is_project_member(pc.project_id, 'viewer')
    )
  );

DROP POLICY IF EXISTS project_changes_insert_editor ON rpg_zzu.project_changes;
CREATE POLICY project_changes_insert_editor ON rpg_zzu.project_changes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM rpg_zzu.project_commits pc
      WHERE pc.commit_id = project_changes.commit_id
        AND rpg_zzu.is_project_member(pc.project_id, 'editor')
    )
  );

DROP POLICY IF EXISTS project_changes_update_editor ON rpg_zzu.project_changes;
CREATE POLICY project_changes_update_editor ON rpg_zzu.project_changes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rpg_zzu.project_commits pc
      WHERE pc.commit_id = project_changes.commit_id
        AND rpg_zzu.is_project_member(pc.project_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM rpg_zzu.project_commits pc
      WHERE pc.commit_id = project_changes.commit_id
        AND rpg_zzu.is_project_member(pc.project_id, 'editor')
    )
  );

DROP POLICY IF EXISTS project_changes_delete_editor ON rpg_zzu.project_changes;
CREATE POLICY project_changes_delete_editor ON rpg_zzu.project_changes
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM rpg_zzu.project_commits pc
      WHERE pc.commit_id = project_changes.commit_id
        AND rpg_zzu.is_project_member(pc.project_id, 'editor')
    )
  );

DROP POLICY IF EXISTS ai_analysis_runs_select_member ON rpg_zzu.ai_analysis_runs;
CREATE POLICY ai_analysis_runs_select_member ON rpg_zzu.ai_analysis_runs
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS ai_analysis_runs_insert_editor ON rpg_zzu.ai_analysis_runs;
CREATE POLICY ai_analysis_runs_insert_editor ON rpg_zzu.ai_analysis_runs
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_analysis_runs_update_editor ON rpg_zzu.ai_analysis_runs;
CREATE POLICY ai_analysis_runs_update_editor ON rpg_zzu.ai_analysis_runs
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_analysis_runs_delete_editor ON rpg_zzu.ai_analysis_runs;
CREATE POLICY ai_analysis_runs_delete_editor ON rpg_zzu.ai_analysis_runs
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS sync_verification_runs_select_member ON rpg_zzu.sync_verification_runs;
CREATE POLICY sync_verification_runs_select_member ON rpg_zzu.sync_verification_runs
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS sync_verification_runs_insert_editor ON rpg_zzu.sync_verification_runs;
CREATE POLICY sync_verification_runs_insert_editor ON rpg_zzu.sync_verification_runs
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS sync_verification_runs_update_editor ON rpg_zzu.sync_verification_runs;
CREATE POLICY sync_verification_runs_update_editor ON rpg_zzu.sync_verification_runs
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS sync_verification_runs_delete_editor ON rpg_zzu.sync_verification_runs;
CREATE POLICY sync_verification_runs_delete_editor ON rpg_zzu.sync_verification_runs
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_activity_logs_select_member ON rpg_zzu.ai_activity_logs;
CREATE POLICY ai_activity_logs_select_member ON rpg_zzu.ai_activity_logs
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS ai_activity_logs_insert_editor ON rpg_zzu.ai_activity_logs;
CREATE POLICY ai_activity_logs_insert_editor ON rpg_zzu.ai_activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_activity_logs_update_editor ON rpg_zzu.ai_activity_logs;
CREATE POLICY ai_activity_logs_update_editor ON rpg_zzu.ai_activity_logs
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_activity_logs_delete_owner ON rpg_zzu.ai_activity_logs;
CREATE POLICY ai_activity_logs_delete_owner ON rpg_zzu.ai_activity_logs
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'owner'));

DROP POLICY IF EXISTS ai_conversations_select_member ON rpg_zzu.ai_conversations;
CREATE POLICY ai_conversations_select_member ON rpg_zzu.ai_conversations
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS ai_conversations_insert_editor ON rpg_zzu.ai_conversations;
CREATE POLICY ai_conversations_insert_editor ON rpg_zzu.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS ai_conversations_update_editor ON rpg_zzu.ai_conversations;
CREATE POLICY ai_conversations_update_editor ON rpg_zzu.ai_conversations
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

-- 대화 기록 삭제는 프로젝트 소유자만 — 에디터 UI 의 대화 삭제는 로컬 정본에만 작용한다.
DROP POLICY IF EXISTS ai_conversations_delete_owner ON rpg_zzu.ai_conversations;
CREATE POLICY ai_conversations_delete_owner ON rpg_zzu.ai_conversations
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'owner'));

DROP POLICY IF EXISTS user_skills_select_member ON rpg_zzu.user_skills;
CREATE POLICY user_skills_select_member ON rpg_zzu.user_skills
  FOR SELECT TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'viewer'));

DROP POLICY IF EXISTS user_skills_insert_editor ON rpg_zzu.user_skills;
CREATE POLICY user_skills_insert_editor ON rpg_zzu.user_skills
  FOR INSERT TO authenticated
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

DROP POLICY IF EXISTS user_skills_update_editor ON rpg_zzu.user_skills;
CREATE POLICY user_skills_update_editor ON rpg_zzu.user_skills
  FOR UPDATE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'))
  WITH CHECK (rpg_zzu.is_project_member(project_id, 'editor'));

-- 사용자 정의 스킬은 에디터 UI 에 삭제 경로가 있다(deleteSupabaseUserSkill).
DROP POLICY IF EXISTS user_skills_delete_editor ON rpg_zzu.user_skills;
CREATE POLICY user_skills_delete_editor ON rpg_zzu.user_skills
  FOR DELETE TO authenticated
  USING (rpg_zzu.is_project_member(project_id, 'editor'));

GRANT USAGE ON SCHEMA rpg_zzu TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rpg_zzu TO authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rpg_zzu TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION rpg_zzu.is_project_member(text, text) TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated, service_role;

-- 적용 시점 주의:
-- The following anon revokes are the switch-over cutover. Do not run them during the
-- dual-mode rollout while the browser still sends Authorization: Bearer <anon key>.
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA rpg_zzu FROM anon;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA rpg_zzu FROM anon;
REVOKE USAGE ON SCHEMA rpg_zzu FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  REVOKE USAGE, SELECT ON SEQUENCES FROM anon;
