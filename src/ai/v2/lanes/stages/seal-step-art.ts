// 투명 칸 봉인·제단 단계에 돌 제단 그림(2026-10-29 vm6 terra jrpg «봉인이 어디인지 안 보임»).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { dressBareSealSteps } from "../../stepArt";

export const stage: LaneStage = {
  id: "seal-step-art", scope: "map", order: 70,
  run({ env, notes, run }, mapId) {
    for (const n of dressBareSealSteps(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
