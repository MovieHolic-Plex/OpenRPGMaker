// 두 줄 길 위·곁 출구는 길 폭 전체로(2026-10-29 vm7 flash jrpg: 오른쪽 줄로 걸어 출구를 지나쳐 길 끝 가장자리에서 막혔다). 출구를 그림 칸으로 옮기는 출하 기본값·문 잠금 뒤에.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { widenRoadExits } from "../../edgeExitRoads";

export const stage: FinishStage = {
  id: "widen-road-exits", phase: "assembly", order: 270,
  run({ env, assembled }) {
    try { const run = createBuildRun(env.ctx); for (const mapId of Object.keys(env.ctx.project.maps)) assembled.push(...widenRoadExits(run, mapId).map((n) => `${env.ctx.project.maps[mapId]?.name ?? mapId}: ${n}`)); }
    catch { /* 출구 넓히기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
