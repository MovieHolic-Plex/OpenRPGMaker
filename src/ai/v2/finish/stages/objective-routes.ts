// 목표 꼬리 「(<맵> 입구: 방위)」를 마지막 연결로 다시 쓴다 — 목표가 걸리는 자리에서 본 첫 출구 방위·그 뒤 대상(2026-10-29 vm2 jrpg 길 못 찾음).
import type { FinishStage } from "../types";
import { refreshObjectiveRoutes } from "../../discoverability";

export const stage: FinishStage = {
  id: "objective-routes", phase: "assembly", order: 250,
  run({ env, assembled }) {
    try { const n = refreshObjectiveRoutes(env.ctx.project); if (n) assembled.push(`목표 길 안내 ${n}곳`); }
    catch (error) { env.emit({ type: "execution_status", name: "v2.assembly", ok: false, summary: `목표 길 안내를 다시 쓰지 못했다: ${error instanceof Error ? error.message : String(error)}` }); }
  },
};
