// 지면 안 되는 이벤트 전투(보스)에 지면 시작 마을이 아니라 그 맵 입구(보스 방 앞)에서 회복해 다시(bossTalkBattles.bossDefeatReturns;
// 2026-10-30 씬 벤치 boss-room «패배하면 먼 마을로, 재도전 길이 멂»). 출구·이동 칸 마감(말 거는 보스에 전투 붙이기) 뒤에.
import type { FinishStage } from "../types";
import { createBuildRun } from "../../buildRun";
import { bossDefeatReturns } from "../../bossTalkBattles";

export const stage: FinishStage = {
  id: "boss-defeat-returns", phase: "blueprint", order: 97,
  run({ env, done }) {
    try { const notes = bossDefeatReturns(createBuildRun(env.ctx)); if (notes.length) done.push(`패배 뒤 돌아올 자리: ${notes.join(" / ").slice(0, 400)}`); }
    catch { /* 돌아올 자리 실패는 끝맺음을 깨지 않는다 */ }
  },
};
