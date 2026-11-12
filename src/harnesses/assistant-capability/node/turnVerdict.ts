// 턴 기록(session/turns/NNN.json)을 읽는 모델 없는 판정 — 무거운 것을 불러오지 않는다(CI 테스트가 이것만 읽는다).
// small-jobs(smallJobs/run.ts)와 맵 깔기(mapVqa/lay.ts)가 같이 쓴다.

/**
 * 입력이 조수에 닿지 않은 턴 — 모델 호출 0 · 도구 0 · done 없음인 채 «settled» 로 적힌 것. 모델의 결과가 아니라 기반 오류다.
 * 2026-11-12 Haiku 깔기: 20초 만에 이렇게 끝난 요청 다섯이 «아무것도 안 깔림» 으로 세어졌다.
 */
export const neverStarted = (turns: readonly any[]): boolean =>
  turns.length > 0 && turns.every(turn => !(turn.requests ?? []).length && !(turn.toolCalls ?? []).length && !(turn.done ?? []).length);

/**
 * 마지막 턴이 사용자에게 묻는 것으로 끝났다(ask_user 성공) — 그런 턴은 설계상 최종 보고(v2.todo.final)를 내지 않는다(src/ai/v2/turn/finishTurn.ts).
 * «v2Final 없음» 을 깨진 턴으로 읽지 않게 따로 적는다.
 */
export const endedOnQuestion = (turns: readonly any[]): boolean => {
  const last = turns.at(-1);
  return !!last && !(last.v2Final ?? []).length && (last.toolCalls ?? []).some((call: any) => call.name === 'ask_user' && call.ok !== false);
};
export const QUESTION_NOTE = '질문으로 끝남 — 사용자 답을 기다린다(질문으로 끝난 턴은 최종 보고를 내지 않는다)';

export type LayStatus = 'laid' | 'nothing' | 'timeout' | 'infra';
/** 맵 깔기 한 요청의 판정. 입력이 조수에 닿지 않은 턴은 «아무것도 안 깔림» 이 아니라 기반 오류다 — 모델의 결과로 세지 않는다. */
export function layStatus(input: { maps: number; turns: readonly any[]; errors: number; toolCalls: number; timedOut: boolean }): { status: LayStatus; unsent: boolean } {
  const unsent = !input.maps && neverStarted(input.turns);
  const status: LayStatus = unsent || (!input.maps && input.errors > 0 && input.toolCalls === 0) ? 'infra' : input.timedOut ? 'timeout' : input.maps ? 'laid' : 'nothing';
  return { status, unsent };
}
