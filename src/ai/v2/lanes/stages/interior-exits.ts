// 실내 출구·공허 마감(막다른 남쪽 틈 메우기·문 그림·남색 공허 칸) — 화면 검수 장부 builder-exit/builder-tiles.
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { dressInteriorExits } from "../../exitDress";

export const stage: LaneStage = {
  id: "interior-exits", scope: "map", order: 10,
  run({ env, notes, run }, mapId) {
    for (const n of dressInteriorExits(run, mapId).notes) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
