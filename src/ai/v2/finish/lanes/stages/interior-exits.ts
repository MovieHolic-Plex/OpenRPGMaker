// 실내 출구·공허 마감(막다른 남쪽 틈 메우기·문 그림·남색 공허 칸) — 화면 검수 장부 builder-exit/builder-tiles.
// 방으로 깔린 맵에만 돈다 — 이번 턴에 지은 장소면 그 기록의 종류를 넘긴다(바깥 거리는 방 키트가 있는 칩셋이어도 건드리지 않는다).
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { dressInteriorExits } from "../../../place/exitDress";
import { laidOf } from "../../../place/laid";

export const stage: FinishStage = {
  id: "interior-exits", phase: "lane-map", order: 10,
  run({ env, session, notes, run }, mapId) {
    for (const n of dressInteriorExits(run, mapId, laidOf(session.placeOf(mapId)?.spec)).notes) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
