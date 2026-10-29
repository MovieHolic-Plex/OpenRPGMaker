// 싸우는 단계가 아닌데 보스 전투로 감싼 페이지는 푼다(2026-10-29 vm7 argon jrpg: 촌장이 말 걸자마자 용과 싸움).
import type { FinishStage } from "../types";
import { ungateTalkStepBattlesIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "ungate-talk-battles", phase: "assembly", order: 180,
  run({ env, assembled }) {
    try { assembled.push(...ungateTalkStepBattlesIn(env.ctx.project)); }
    catch { /* 전투 풀기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
