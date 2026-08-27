-- AI 로그·대화 테이블에서 anon 의 DELETE 권한을 회수한다.
--
-- 왜: 브라우저는 아직 Supabase auth 없이 anon 키만 보낸다(supabaseProjectSync 의 apikey/Bearer).
-- 20260625 마이그레이션이 rpg_zzu 전체를 anon 에게 SELECT/INSERT/UPDATE/DELETE 로 열어두었고
-- 0709·0713 이 테이블별로 다시 GRANT 했다. 즉 공개 anon 키만 있으면 아무나 남의 프로젝트
-- AI 활동 로그와 대화 기록을 지울 수 있다. RLS 전면 도입(DRAFT_20260706_auth_rls.sql)은
-- 로그인 도입과 함께 가는 별도 컷오버이므로, 그 전까지 최소한 파괴 권한은 없앤다.
--
-- 클라이언트가 쓰는 SELECT/INSERT/UPDATE 는 유지한다. 이 세 테이블에는 브라우저 삭제 경로가
-- 없다 — replaceRows 는 maps/tilesets 만, deleteSupabaseUserSkill 은 user_skills 만 지운다.
--
-- 주의: 20260625 의 ALTER DEFAULT PRIVILEGES 가 여전히 anon 에게 4개 권한을 기본 부여하므로
-- 이후 추가되는 테이블도 같은 회수 또는 RLS 컷오버가 필요하다.

REVOKE DELETE ON rpg_zzu.ai_activity_logs FROM anon;
REVOKE DELETE ON rpg_zzu.ai_conversations FROM anon;
REVOKE DELETE ON rpg_zzu.ai_analysis_runs FROM anon;
