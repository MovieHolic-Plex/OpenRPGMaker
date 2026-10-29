// 이동 칸(착지·문) 앞을 막는 이벤트를 옆으로 옮긴다. 기록 줄은 transfer-lane-notes 가 맵 끝에 쓴다(옛 순서 그대로). 이 뒤 단계의 맵 이름은 ctx.map.name.
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { clearTransferLanes } from "../../eventReach";

export const stage: LaneStage = {
  id: "transfer-lanes", scope: "map", order: 120,
  run(ctx, mapId) {
    const { env, run } = ctx;
    ctx.map.lanes = clearTransferLanes(run, mapId);
    ctx.map.name = mapLabel(env, mapId);
  },
};
