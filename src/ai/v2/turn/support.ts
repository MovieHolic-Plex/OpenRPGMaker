// 턴 구동기가 같이 쓰는 밑받침 — 켜고 끄는 스위치(환경 변수), 단계 시간 재기, 변경 요약. 2026-11-11 리팩토링 R3: scripts/lib/assistantV2Runtime.ts 에서 옮겼다.
import type { PiAgentRequest } from "../../piAgent/protocol";
import { buildsWholeGame } from "../request/readers";
import type { PiAssistantV2Env } from "../shared/env";
import { summarizeProjectDiff } from "../judge/advisor";

/** 독립 검토자(src/ai/v2/judge/advisor.ts). 끄려면 OPRN_V2_ADVISOR=0 — 비교 실행·장애 때만 쓴다. 읽기 전용 실행에는 돌지 않는다. */
// 설정에서 검토자를 끈 경우(assistantRoles.advisor = "off")도 돌지 않는다. 검토자 모델은 env.advisorChat(따로 고른 칸) → 없으면 주 모델(sideChat).
export const advisorEnabled = (request: PiAgentRequest): boolean => process.env.OPRN_V2_ADVISOR !== "0" && !request.readOnly && request.assistantRoles?.advisor !== "off";

export const advisorChatOf = (env: PiAssistantV2Env) => env.advisorChat ?? env.sideChat;

/** 끝맺음 고리 단계 시간 계측(2026-11-09 monster «terminated» 조사): 2초 넘게 걸린 단계는 이름·시간을 stderr 에 남긴다. 동작은 바꾸지 않는다. */
export const timed = <T>(name: string, fn: () => T): T => { const t0 = Date.now(); try { return fn(); } finally { const ms = Date.now() - t0; if (ms >= 2000) console.error(`[v2-afterMain] ${name} took ${Math.round(ms / 1000)}s`); } };

export const timedAsync = async <T>(name: string, fn: () => Promise<T>): Promise<T> => { const t0 = Date.now(); try { return await fn(); } finally { const ms = Date.now() - t0; if (ms >= 2000) console.error(`[v2-afterMain] ${name} took ${Math.round(ms / 1000)}s`); } };

export const safeDiff = (env: PiAssistantV2Env): string => {
  try { return summarizeProjectDiff(env.request.project, env.ctx.project); } catch (error) { return `(변경 요약 실패: ${error instanceof Error ? error.message : String(error)})`; }
};

/**
 * 화면 검수 고리(src/ai/v2/judge/vqa.ts) — 게임 하나를 짓는 턴에만(게임 하나 요청, 또는 그 게임을 잇는 «계속»), 읽기 전용이 아닐 때만. 끄려면 OPRN_V2_VQA=0.
 * 사용자 규칙(2026-10-25): 최소 한 판, 결함 없는 판이 나오거나 3판을 돌 때까지. 그림 경로가 없는 실행은 «검수 못 함»으로 보고한다.
 */
export const vqaEnabled = (request: PiAgentRequest): boolean => process.env.OPRN_V2_VQA !== "0" && !request.readOnly && buildsWholeGame(request.project, request.task);
