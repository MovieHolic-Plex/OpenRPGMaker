// 물건을 얻는 투명 단계 칸은 보물상자로(2026-10-29 vm7 terra jrpg «용사의 검이 어느 건물에 있는지 모름» — 검은 촌장 옆 길 위 투명 칸이었다).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { dressPickupSteps } from "../../stepArt";

export const stage: LaneStage = {
  id: "pickup-chests", scope: "map", order: 100,
  run({ env, notes, run }, mapId) {
    for (const n of dressPickupSteps(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
