// 가장자리 아닌 출구(굴 입구 등)를 지나쳐 이어지는 남는 길 줄은 출구 앞에서 끝낸다(edgeExitRoads.trimRoadStubs; 2026-10-29 vm7 flash jrpg 「오른쪽 줄 막다른 길」).
// 출구를 그림 칸으로 옮기는 출하 기본값 뒤, 가장자리 출구 길 폭 사본 앞에.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { trimRoadStubs } from "../../edgeExitRoads";

export const stage: FinishStage = {
  id: "trim-road-stubs", phase: "assembly", order: 265,
  run({ env, assembled }) {
    try { const run = createBuildRun(env.ctx); for (const mapId of Object.keys(env.ctx.project.maps)) assembled.push(...trimRoadStubs(run, mapId).map((n) => `${env.ctx.project.maps[mapId]?.name ?? mapId}: ${n}`)); }
    catch { /* 남는 길 다듬기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
