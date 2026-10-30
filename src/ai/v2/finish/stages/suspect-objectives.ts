// 추리 용의자 대화의 목표는 다 듣기 전엔 「아직 이야기 안 한 용의자」, 다 들은 뒤에만 지목 자리로 — 위 단계들이 건 목표까지 감싸도록 조립 묶음 맨 끝에.
import type { FinishStage } from "../types";
import { gateSuspectObjectives } from "../../mysteryCase";

export const stage: FinishStage = {
  id: "suspect-objectives", phase: "assembly", order: 300,
  run({ env, assembled }) {
    try { assembled.push(...gateSuspectObjectives(env.ctx.project)); }
    catch { /* 용의자 목표 갈래 실패는 끝맺음을 깨지 않는다 */ }
  },
};
