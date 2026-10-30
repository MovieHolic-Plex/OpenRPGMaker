// 그림 없는 조사 칸은 가구에 앉히고, 가구 위 조사는 가구 전체에서 받는다(examineSpot.settleFurnitureSpots).
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { alignClueObjects } from "../../clueObjects";
import { settleFurnitureSpots } from "../../examineSpot";
import { refreshRemainingClues } from "../../mysteryCase";

export const stage: FinishStage = {
  id: "furniture-spots", phase: "blueprint", order: 70,
  run({ env, done }) {
    const run = createBuildRun(env.ctx);
    // 단서 대사가 가리키는 물건(«단서는 책장 속에 있다»)과 다음 단서 이벤트 자리를 맞춘다 — 가구에 앉히기 전에(clueObjects.ts).
    const pointed = Object.keys(env.ctx.project.maps).flatMap((mapId) => alignClueObjects(run, mapId));
    if (pointed.length) done.push(`단서 물건 자리: ${pointed.join(" / ").slice(0, 500)}`);
    const settled = Object.keys(env.ctx.project.maps).flatMap((mapId) => settleFurnitureSpots(run, mapId));
    if (settled.length) done.push(`조사 자리: ${settled.join(" / ").slice(0, 500)}`);
    const left = refreshRemainingClues(run);
    if (left.length) done.push(`남은 단서 자리: ${left.join(" / ")}`);
  },
};
