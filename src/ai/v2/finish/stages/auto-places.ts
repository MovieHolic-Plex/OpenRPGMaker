// 청사진 장소가 없거나 닿지 않으면 장소를 짓는다(session.buildPlaces, 한 실행에 한 번).
import type { FinishStage } from "../types";
import { walkBlueprint } from "../../blueprint";

export const stage: FinishStage = {
  id: "auto-places", phase: "blueprint", order: 30,
  async run(ctx) {
    const { env, session, done } = ctx;
    if (session.buildPlaces && !session.autoPlacesDone && ctx.walked.some((b) => b.id === "blueprint-place-missing" || b.id === "blueprint-place-unreachable")) {
      session.autoPlacesDone = true;
      const notes = await session.buildPlaces();
      env.emit({ type: "execution_status", name: "v2.blueprint.auto_places", ok: true, summary: `청사진 장소 자동 짓기 — ${notes.join(" / ").slice(0, 300)}` });
      if (notes.length) done.push(`장소: ${notes.join(" / ").slice(0, 700)}`);
      ctx.walked = walkBlueprint(env.ctx.project).blockers;
    }
  },
};
