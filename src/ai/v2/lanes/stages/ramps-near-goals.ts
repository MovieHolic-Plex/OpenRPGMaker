// 목표 바로 곁 절벽(한 칸 위·아래인데 멀리 돌아가야 함)에 계단 경사로(2026-10-29 vm4 deepseek jrpg 「동굴 입구가 보이는데 못 닿음」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { rampNearGoals } from "../../reliefShortcut";

export const stage: LaneStage = {
  id: "ramps-near-goals", scope: "map", order: 50,
  run({ env, notes, run }, mapId) {
    for (const n of rampNearGoals(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
