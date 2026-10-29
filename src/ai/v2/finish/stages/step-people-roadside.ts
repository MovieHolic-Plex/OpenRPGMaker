// 단계 사람이 길·광장·눈에 띄는 것에서 먼 맨바닥에 서 있으면 6칸 안 길가로(stepPeopleRoadside.ts; 2026-10-29 vm8 terra jrpg «경고 전할 마을 사람을 못 찾음»).
// 단계 주인공(투명 칸 → 사람)과 길 놓기(lanes) 뒤에.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { standStepPeopleByRoads } from "../../stepPeopleRoadside";

export const stage: FinishStage = {
  id: "step-people-roadside", phase: "blueprint", order: 95,
  run({ env, done }) {
    try { const notes = standStepPeopleByRoads(createBuildRun(env.ctx)); if (notes.length) done.push(`단계 사람 길가로: ${notes.join(" / ").slice(0, 300)}`); }
    catch { /* 자리 옮기기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
