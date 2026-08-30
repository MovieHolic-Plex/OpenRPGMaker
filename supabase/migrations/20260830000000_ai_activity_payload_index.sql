-- AI 활동 로그 payload 색인 — "이벤트 툴을 부른 턴", "되감기를 누른 세션" 을 SQL 로 찾는다.
--
-- 왜 필요한가 (실측 2026-08-30): 진단 정보가 전부 payload_json 안에만 있어서, "set_event 를
-- 호출한 턴" 을 알아내려고 169KB payload 를 클라이언트로 받아 grep 해야 했다. 15,044행에서는
-- 그게 조회가 아니라 덤프다. 그래서 buildAiActivityLogRecord 가 payload 최상위에 평탄 색인
-- (index.toolNames / failedToolNames / uiActions / commitIds / mapIds / userTexts)을 함께 쓰고,
-- 이 인덱스가 그 키들을 jsonb containment 로 짚는다:
--
--   /ai_activity_logs?payload_json=cs.{"index":{"toolNames":["set_event"]}}
--   /ai_activity_logs?channel=eq.ui&payload_json=cs.{"index":{"uiActions":["turn-rewind"]}}
--
-- ⚠️ 반드시 **컬럼 전체**에 `cs.` 를 걸어야 한다. 보기 좋은
-- `payload_json->index->toolNames=cs.["set_event"]` 는 결과는 같지만 좌변이 표현식이라
-- 이 인덱스를 타지 못하고 15,000행 seq scan 으로 떨어진다.
--
-- 연산자 클래스: jsonb_path_ops. 기본 jsonb_ops 보다 인덱스가 훨씬 작고 `@>`(= PostgREST 의
-- `cs.`) 에 특화돼 있다. 키 존재 검사(`?`, `?|`)는 지원하지 않지만 이 테이블에서 그 질의는 쓰지
-- 않는다 — 색인 배열은 항상 존재하고 우리가 묻는 것은 «그 안에 이 값이 있는가» 다.
--
-- ⚠️ CONCURRENTLY 는 트랜잭션 블록 안에서 실행할 수 없다. 이 파일은 **트랜잭션 밖에서** 돌려야
-- 한다. supabase CLI 가 마이그레이션을 트랜잭션으로 감싸면 psql 로 직접 실행할 것:
--   psql "$DATABASE_URL" -f supabase/migrations/20260830000000_ai_activity_payload_index.sql
-- 대상이 15,000행 이상이고 payload 가 크므로(행당 수십~수백 KB) 빌드에 수 분이 걸릴 수 있다.
-- CONCURRENTLY 는 그동안 쓰기를 막지 않는다 — 공유 DB 라 그게 조건이다.
--
-- channel 컬럼에는 CHECK 제약이 없다. 그래서 새 채널 값("ui")에는 스키마 변경이 필요 없다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_activity_logs_payload_gin_idx
  ON rpg_zzu.ai_activity_logs USING gin (payload_json jsonb_path_ops);

-- 프론트 액션 행("ui" 채널)은 채널+시간으로도 훑는다. 기존 channel_created_idx 가 project_id
-- 를 선행 키로 갖고 있어, 프로젝트를 가리지 않고 "최근 ui 행" 을 보는 질의를 못 태운다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ai_activity_logs_channel_time_idx
  ON rpg_zzu.ai_activity_logs(channel, created_at DESC);
