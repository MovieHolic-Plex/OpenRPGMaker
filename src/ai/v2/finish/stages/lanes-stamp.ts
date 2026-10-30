// 마감을 돈 맵 지문을 남긴다 — 뒤 차례에서 장소를 다시 지으면 마감을 다시 돈다(finish/lanesStamp.ts).
import type { FinishStage } from "../types";
import { lanesStamp } from "../lanesStamp";

export const stage: FinishStage = {
  id: "lanes-stamp", phase: "blueprint", order: 90,
  run({ env, session }) {
    if (session.autoLanesDone) session.lanesStamp = lanesStamp(env.ctx.project);
  },
};
