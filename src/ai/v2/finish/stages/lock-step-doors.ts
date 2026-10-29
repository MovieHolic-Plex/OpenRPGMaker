// 단계 순서 문 잠금 — 다음 단계 맵으로 가는 문·계단은 이 맵의 단계를 마친 뒤에만 열린다(2026-10-29 vm5 deepseek jrpg: 검을 뽑기 전에 계단으로 내려가짐).
import type { FinishStage } from "../types";
import { lockStepOrderDoorsIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "lock-step-doors", phase: "assembly", order: 210,
  run({ env, assembled }) {
    try { assembled.push(...lockStepOrderDoorsIn(env.ctx.project)); }
    catch { /* 문 잠금 실패는 끝맺음을 깨지 않는다 */ }
  },
};
