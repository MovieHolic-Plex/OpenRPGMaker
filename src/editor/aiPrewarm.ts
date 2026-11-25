// editor/aiPrewarm.ts
// 조수 세션을 미리 만들라는 창 사건 — 이벤트 편집기를 열 때 보낸다(aiChatPanel 이 듣는다).
// 실측(2026-11-25 fast-apply, 10MB 프로젝트 CPU 프로파일): 세션 만들기 4.4초가 엔터 뒤에 걸렸다.
export const AI_PREWARM_EVENT = "oprn:ai-prewarm";
