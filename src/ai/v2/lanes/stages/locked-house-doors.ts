// 들어갈 수 없는 집 문 그림에 「잠겨 있다」 한 줄(2026-10-29 vm6 flash·argon jrpg «집 문 무반응»).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { lockBareHouseDoors } from "../../lockedDoors";

export const stage: LaneStage = {
  id: "locked-house-doors", scope: "map", order: 110,
  run({ env, notes, run }, mapId) {
    for (const n of lockBareHouseDoors(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
