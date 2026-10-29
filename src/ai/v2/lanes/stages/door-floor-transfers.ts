// 바닥 한가운데 투명 이동 칸 → 가장 가까운 외벽에 문(북벽 문 그림·남벽 틈)을 내고 그 앞으로(2026-10-29 vm3 deepseek 탈출 「희미한 빛 위를 걷는 방 이동」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { doorFloorTransfers } from "../../exitDress";

export const stage: LaneStage = {
  id: "door-floor-transfers", scope: "map", order: 30,
  run({ env, notes, run }, mapId) {
    for (const n of doorFloorTransfers(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
