-- anon 이 실제로 쓰지 않는 파괴 권한을 회수한다. RLS 전면 도입(DRAFT_20260706_auth_rls.sql)은
-- 로그인 도입과 함께 가는 별도 컷오버이고, 그때까지 anon 키가 곧 자격증명이다.
--
-- 20260827 이 AI 로그 3개 테이블의 DELETE 만 걷어냈다. 나머지는 여전히 20260625 의
-- `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES` 상태다. 브라우저 코드를 전수 조사한
-- 결과(2026-08-29) 클라이언트의 DELETE 경로는 정확히 3곳뿐이다:
--
--   supabaseProjectSync.ts deleteProjectRows  → maps, tilesets (replaceRows 경유)
--   supabaseProjectSync.ts deleteMapRows      → maps
--   mapEditLocks.ts                           → map_edit_locks (락 해제)
--
-- 그 세 테이블만 DELETE 를 남기고 나머지는 회수한다.
REVOKE DELETE ON rpg_zzu.projects               FROM anon;
REVOKE DELETE ON rpg_zzu.project_commits        FROM anon;
REVOKE DELETE ON rpg_zzu.project_changes        FROM anon;
REVOKE DELETE ON rpg_zzu.terrain_templates      FROM anon;
REVOKE DELETE ON rpg_zzu.sync_verification_runs FROM anon;
REVOKE DELETE ON rpg_zzu.user_skills            FROM anon;

-- 커밋 로그는 브라우저에서 append-only 다 — insertRows(supabaseTableInsertUrl) 만 쓰고
-- upsert(merge-duplicates) 를 쓰지 않는다. 즉 UPDATE 는 필요 없는데 열려 있어서,
-- 공개 anon 키만 있으면 누구나 4,007행짜리 커밋 이력을 덮어쓸 수 있다.
-- (maps/tilesets/projects/ai_* 는 upsert 라 UPDATE 가 실제로 필요하므로 손대지 않는다.)
REVOKE UPDATE ON rpg_zzu.project_commits FROM anon;
REVOKE UPDATE ON rpg_zzu.project_changes FROM anon;

-- 20260625 의 ALTER DEFAULT PRIVILEGES 때문에 **이후 추가되는 모든 테이블**이 자동으로
-- anon 에게 DELETE 까지 열린 상태로 태어났다(0827 의 마지막 주석이 지적한 구멍).
-- 기본값에서 DELETE 를 빼서 새 테이블이 조용히 같은 구멍을 만들지 못하게 한다.
-- SELECT/INSERT/UPDATE 기본값은 유지한다 — 지금 클라이언트가 로그인 없이 쓰는 표면이다.
ALTER DEFAULT PRIVILEGES IN SCHEMA rpg_zzu
  REVOKE DELETE ON TABLES FROM anon;
