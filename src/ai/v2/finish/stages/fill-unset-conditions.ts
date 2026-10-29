// 어디서도 안 켜지는 단계 조건을 앞 단계가 켜게(2026-10-29 vm3 argon mystery 「사건 조사 시작」).
import type { FinishStage } from "../types";
import { fillUnsetStepConditions } from "../../blueprint";

export const stage: FinishStage = {
  id: "fill-unset-conditions", phase: "assembly", order: 170,
  run({ env, assembled }) {
    try { assembled.push(...fillUnsetStepConditions(env.ctx.project)); }
    catch { /* 켜기 보충 실패는 끝맺음을 깨지 않는다 */ }
  },
};
