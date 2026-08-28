-- AI 활동 로그에 런 식별자(run_id)를 붙인다.
--
-- 왜: 지금 "방금 끝난 내 턴"을 물을 수 있는 저장소가 디스크 미러(output/ai-activity/latest.json)뿐이다.
-- DB 에는 런/세션/호스트 식별자가 없어서 `order=created_at.desc&limit=1` 이 **옆 워크트리의 턴**을 준다
-- (2026-08-29 실측: 같은 머신에서 워크트리 5개 dev 서버가 전부 같은 project_id 로 쓰고 있고,
-- rpg-zzu-dungeon-example 2,566턴 · rpg-zzu-house-template-gallery 2,553턴이 e2e 픽스처가 찍은 것이라
-- 사람이 친 9턴은 최신 정렬에서 절대 안 보인다). cwd 가 공짜 격리 키였고, 그게 디스크 미러가
-- 존재하는 유일한 정당한 근거였다.
--
-- run_id 는 브라우저 부팅 1회당 UUID 하나(src/ai/activityRunId.ts)다. 이 컬럼이 생기면
-- `?run_id=eq.<내 런>&order=created_at.desc&limit=1` 로 디스크와 같은 질문을 DB 에 할 수 있다.
--
-- NULL 을 허용한다: 기존 12,735행에는 런 정보가 없고, 소급 채울 근거도 없다.
-- 조회 측은 run_id 가 없는 행을 "런 불명"으로 다루면 된다.

ALTER TABLE rpg_zzu.ai_activity_logs
  ADD COLUMN IF NOT EXISTS run_id uuid NULL;

-- 런별 최신 턴 1건 조회용. project_id 를 선행 키로 두어 기존 조회 패턴과 같은 축을 쓴다.
CREATE INDEX IF NOT EXISTS ai_activity_logs_run_created_idx
  ON rpg_zzu.ai_activity_logs(project_id, run_id, created_at DESC);
