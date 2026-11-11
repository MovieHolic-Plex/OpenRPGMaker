// 투명 칸 봉인·제단 단계에 돌 제단 그림(2026-10-29 vm6 terra jrpg «봉인이 어디인지 안 보임») — 제단 조각이 없는 칩셋은 못 한 것으로 적는다.
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { recordArtGaps, type ArtGap } from "../../../shared/artGap";
import { dressBareSealSteps } from "../../../story/stepArt";

export const stage: FinishStage = {
  id: "seal-step-art", phase: "lane-map", order: 70,
  run({ env, session, notes, run }, mapId) {
    const gaps: ArtGap[] = [];
    for (const n of dressBareSealSteps(run, mapId, gaps)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
    recordArtGaps({ env, session }, "seal-step-art", gaps);
  },
};
