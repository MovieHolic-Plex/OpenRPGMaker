// 잠긴 조사 대사가 먼저 할 일(그 조건을 켜는 이벤트와 자리)을 말하게(2026-10-29 vm3 argon 추리 열린 창문·deepseek jrpg 계단). 맵 이름을 뜻 낱말로 바꾼 뒤.
import type { FinishStage } from "../types";
import { pointLockedPagesIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "point-locked-pages", phase: "assembly", order: 220,
  run({ env, assembled }) {
    try { assembled.push(...pointLockedPagesIn(env.ctx.project)); }
    catch { /* 잠김 대사 보충 실패는 끝맺음을 깨지 않는다 */ }
  },
};
