// 앞 단계 없이 열리는 단계를 앞 단계 뒤에만 열리게 — 대화만 하는 앞 단계는 「마침」 스위치를 켜게(2026-10-29 vm3 deepseek 추리: 덕수·말순 건너뜀). 출하 기본값보다 먼저 — 새로 켜는 스위치에 다음 목표가 붙게.
import type { FinishStage } from "../types";
import { gateOpenSteps } from "../../story/blueprintRepair";
import { chainFightStepsIn, endAfterFinalFightIn } from "../../story/fightStepChain";

export const stage: FinishStage = {
  id: "gate-open-steps", phase: "assembly", order: 120,
  run({ env, assembled }) {
    try { assembled.push(...gateOpenSteps(env.ctx.project)); }
    catch { /* 단계 잠금 실패는 끝맺음을 깨지 않는다 */ }
    // 싸우는 단계도 앞 단계 뒤에만 열리고, 마지막 싸움은 이기면 엔딩을 부른다(story/fightStepChain.ts).
    try { assembled.push(...chainFightStepsIn(env.ctx.project), ...endAfterFinalFightIn(env.ctx.project)); }
    catch { /* 싸움 단계 잇기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
