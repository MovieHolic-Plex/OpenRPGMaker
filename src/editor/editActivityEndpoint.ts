/**
 * DEV 디스크 미러 엔드포인트(편집 행위 로그). `vite.config.ts` 의 EDIT_ACTIVITY_DISK_ENDPOINT 와
 * 반드시 같은 값이어야 한다.
 *
 * AI 활동 로그(`/__oprn/ai-activity`)와 **채널을 나눈 이유**: AI 로그는 턴 단위(분당 1건 수준)인데
 * 편집 행위는 스트로크 단위(분당 수십 건)다. 같은 activity.jsonl 에 섞으면 QA·에이전트가 읽는
 * AI 턴 기록이 편집 노이즈에 묻힌다(`scripts/list-ai-activity.mjs` 가 그 파일을 읽는다).
 *
 * 접두사 `/__oprn` 은 정본이다 — 다른 window 훅·e2e 라우트가 모두 이 접두사를 쓴다.
 * 드리프트는 test/editActivityEndpoint.test.ts 가 고정한다.
 */
export const EDIT_ACTIVITY_DISK_ENDPOINT = "/__oprn/edit-activity";
