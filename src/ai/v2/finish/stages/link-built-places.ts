// 이번 실행에 지은 장소가 시작에서 닿지 않으면 요청 속 맵과 잇는다(session.linkBuiltPlaces, 한 실행에 한 번).
// 왜·규칙은 verbs.ts session.linkBuiltPlaces 머리글(2026-10-30 씬 벤치 river-village 「지금 마을과 이어 줘」).
import type { FinishStage } from "../types";
import { walkBlueprint } from "../../blueprint";

export const stage: FinishStage = {
  id: "link-built-places", phase: "blueprint", order: 32,
  async run(ctx) {
    const { env, session, done } = ctx;
    if (!session.linkBuiltPlaces || session.linkBuiltDone) return;
    session.linkBuiltDone = true;
    const notes = await session.linkBuiltPlaces();
    if (!notes.length) return;
    env.emit({ type: "execution_status", name: "v2.link_built_places", ok: true, summary: notes.join(" / ").slice(0, 300) });
    done.push(`지은 장소 잇기: ${notes.join(" / ").slice(0, 700)}`);
    ctx.walked = walkBlueprint(env.ctx.project).blockers;
  },
};
