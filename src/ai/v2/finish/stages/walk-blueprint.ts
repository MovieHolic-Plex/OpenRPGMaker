// 청사진 걷기 막힘을 ctx.walked 에 — 아래 장소·경로 짓기가 본다.
import type { FinishStage } from "../types";
import { walkBlueprint } from "../../blueprint";

export const stage: FinishStage = {
  id: "walk-blueprint", phase: "blueprint", order: 20,
  run(ctx) {
    ctx.walked = walkBlueprint(ctx.env.ctx.project).blockers;
  },
};
