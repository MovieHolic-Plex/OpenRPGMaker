// 안내 글을 실제 자리에 맞춘다: 목표 줄의 그림 없는 대상에 기댈 곳을 붙이고, 대사의 「누가 어디에서」가 틀리면 말하는 이에서 본 방위로(guideTexts.ts;
// 2026-10-30 회귀 sl1 terra 「용사의 보급품 얻는 곳 안내 없음」·sl3 opus 「촌장님이 광장에서」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { checkGuideTexts } from "../../guideTexts";

export const stage: LaneStage = {
  id: "guide-texts", scope: "map", order: 157,
  run({ env, notes, run }, mapId) {
    for (const n of checkGuideTexts(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
