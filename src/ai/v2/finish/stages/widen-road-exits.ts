// 맵 가장자리 길 끝 출구는 길 폭 전체로 — 가장자리 칸·길 폭 방향만, 다른 칸을 막으면 안 둔다(edgeExitRoads.widenRoadExits; 2026-10-29 vm7 flash jrpg, 몬스터 새순 마을 회귀 뒤 좁힘). 출구를 그림 칸으로 옮기는 출하 기본값·문 잠금 뒤에.
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
