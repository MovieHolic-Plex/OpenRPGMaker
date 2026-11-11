// 조사·대화 대상 앞(아래 칸)을 막는 의자 하나를 치운다(2026-10-29 VM deepseek mystery: 「의자 때문에 NPC 앞으로 못 간다」).
import type { FinishStage } from "../../types";
import { clearTargetFronts } from "../../../place/reachRepairs";

export const stage: FinishStage = {
  id: "target-fronts", phase: "lane-map", order: 130,
  run(ctx, mapId) {
    const { notes, run } = ctx;
    for (const n of clearTargetFronts(run, mapId)) notes.push(`${ctx.map.name}: ${n}`);
  },
};
