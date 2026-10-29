// 가장자리 출구가 풀밭 한가운데면 맵의 길로 잇는다(2026-10-29 vm3 argon jrpg 「마을 밖으로 나가는 길이 안 보임」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { roadToEdgeExits } from "../../edgeExitRoads";

export const stage: LaneStage = {
  id: "edge-exit-roads", scope: "map", order: 60,
  run({ env, notes, run }, mapId) {
    for (const n of roadToEdgeExits(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
