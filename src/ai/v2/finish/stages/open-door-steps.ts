// 연 문은 열려 보이게(2026-10-29 vm7 argon jrpg: 열쇠로 연 쇠창살이 그대로라 문을 지났는지 몰랐다).
import type { FinishStage } from "../types";
import { openDoorSteps } from "../../stepArt";

export const stage: FinishStage = {
  id: "open-door-steps", phase: "assembly", order: 280,
  run({ env, assembled }) {
    try { assembled.push(...openDoorSteps(env.ctx.project)); }
    catch { /* 문 열기 그림 실패는 끝맺음을 깨지 않는다 */ }
  },
};
