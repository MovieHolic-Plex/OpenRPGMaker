// 위 단계(fillUnsetStepConditions·orderStepBattles)가 이정표를 새로 만들면(조건 스위치를 켜는 갈래) 다음 목표를 다시 건다
// (2026-10-29 vm5 argon 추리: 「모든 단서」를 켜게 된 상인 오언이 다음 목표를 안 바꿔 출하 검사 objective-missing).
import type { FinishStage } from "../types";
import { fillStaleObjectives } from "../../shipDefaults";

export const stage: FinishStage = {
  id: "stale-objectives", phase: "assembly", order: 240,
  run({ env, assembled }) {
    try { assembled.push(...fillStaleObjectives(env.ctx.project)); }
    catch { /* 목표 보충 실패는 끝맺음을 깨지 않는다 */ }
  },
};
