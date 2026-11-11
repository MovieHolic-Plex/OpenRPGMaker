// 들어갈 수 없는 건물 입구에 「들어갈 수 없다」 한 줄(2026-10-29 vm6 flash·argon jrpg «집 문 무반응») — 입구는 칩셋 키트가 적어 둔 것.
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { laidOf } from "../../../place/laid";
import { lockBareHouseDoors } from "../../../place/lockedDoors";

export const stage: FinishStage = {
  id: "locked-house-doors", phase: "lane-map", order: 110,
  run({ env, notes, run, session }, mapId) {
    for (const n of lockBareHouseDoors(run, mapId, laidOf(session.placeOf(mapId)?.spec))) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
