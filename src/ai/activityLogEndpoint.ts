/**
 * DEV 디스크 미러 엔드포인트. `vite.config.ts` 의 AI_ACTIVITY_DISK_ENDPOINT 와 반드시 같은 값이어야 한다.
 *
 * 실측(2026-08-23): 브랜드 리네임 때 미들웨어와 클라이언트가 서로 다른 접두사를 매칭하고 있었다.
 * 404 는 fetch 가 throw 하지 않으므로 미러는
 * 조용히 죽고 `output/ai-activity/` 가 아예 생기지 않았다 — QA/에이전트가 디스크에서 로그를 읽는
 * 경로 전체(list-ai-activity, run-ai-village-lab 의 latest.json)가 같이 죽어 있었다.
 * 정본은 `/__oprn` 이다(다른 window 훅·e2e 라우트가 모두 이 접두사를 쓴다).
 * 문자열을 양쪽에 손으로 적지 말고 이 상수만 쓰고, 드리프트는 test/aiActivityLogEndpoint.test.ts 가 고정한다.
 */
export const AI_ACTIVITY_DISK_ENDPOINT = "/__oprn/ai-activity";
