// 가구·벽 밑에 묻힌 이동 칸은 같은 곳으로 가는 문이 따로 있으면 지운다(2026-10-29 vm4 argon 추리).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { dropBuriedTransfers } from "../../exitDress";

export const stage: LaneStage = {
  id: "buried-transfers", scope: "map", order: 20,
  run({ env, notes, run }, mapId) {
    for (const n of dropBuriedTransfers(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
