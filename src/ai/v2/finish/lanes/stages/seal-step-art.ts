// 투명 칸 봉인·제단 단계에 돌 제단 그림(2026-10-29 vm6 terra jrpg «봉인이 어디인지 안 보임»).
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { dressBareSealSteps } from "../../../story/stepArt";

export const stage: FinishStage = {
  id: "seal-step-art", phase: "lane-map", order: 70,
  run({ env, notes, run }, mapId) {
    for (const n of dressBareSealSteps(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
