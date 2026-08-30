/**
 * 대화 SQLite 미러 엔드포인트. `vite.config.ts` 의 AI_CONVERSATION_DISK_ENDPOINT 와 반드시 같은 값이어야 한다.
 *
 * 활동 로그 미러(`activityLogEndpoint.ts`)와 같은 함정을 공유한다 — 404 는 fetch 가 throw 하지
 * 않으므로 접두사가 어긋나면 미러가 무증상으로 죽는다. 접두사 정본은 `/__oprn` 이고, 양쪽에
 * 문자열을 손으로 적지 말고 이 상수만 쓴다. 드리프트는 test/aiConversationSqliteMirror.test.ts 가 고정한다.
 */
export const AI_CONVERSATION_DISK_ENDPOINT = "/__oprn/ai-conversation";
