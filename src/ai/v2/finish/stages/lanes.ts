// 출구·이동 칸 마감(session.clearLanes → src/ai/v2/lanes, 한 실행에 한 번) + 길목 뒤 조사 자리 다시 맞추기.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { alignClueObjects } from "../../clueObjects";
import { settleFurnitureSpots } from "../../examineSpot";
import { refreshRemainingClues } from "../../mysteryCase";

export const stage: FinishStage = {
  id: "lanes", phase: "blueprint", order: 80,
  async run({ env, session, done }) {
    if (session.clearLanes && !session.autoLanesDone) {
      session.autoLanesDone = true;
      const lanes = await session.clearLanes();
      if (lanes.length) {
        env.emit({ type: "execution_status", name: "v2.blueprint.auto_lanes", ok: true, summary: `출구·이동 칸 마감 — ${lanes.join(" / ").slice(0, 300)}` });
        done.push(`출구·이동 칸 마감: ${lanes.join(" / ").slice(0, 500)}`);
      }
      // 길목 비우기가 옮긴 조사 이벤트는 넓힌 몸이 옛 가구에 맞춰져 있다 — 새 자리 가구로 다시 맞춘다(examineSpot.staleBody, vm5 argon 방탈출).
      const run = createBuildRun(env.ctx);
      const repointed = Object.keys(env.ctx.project.maps).flatMap((mapId) => alignClueObjects(run, mapId));
      if (repointed.length) done.push(`단서 물건 자리(길목 뒤): ${repointed.join(" / ").slice(0, 400)}`);
      const resettled = Object.keys(env.ctx.project.maps).flatMap((mapId) => settleFurnitureSpots(run, mapId));
      if (resettled.length) done.push(`조사 자리(길목 뒤): ${resettled.join(" / ").slice(0, 400)}`);
      const left = refreshRemainingClues(run);
      if (left.length) done.push(`남은 단서 자리(길목 뒤): ${left.join(" / ")}`);
    }
  },
};
