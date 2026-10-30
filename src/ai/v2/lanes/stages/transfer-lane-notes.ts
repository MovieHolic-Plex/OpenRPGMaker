// transfer-lanes 가 옮긴 것·못 옮긴 것을 맵 끝에 적는다.
import type { LaneStage } from "../types";

export const stage: LaneStage = {
  id: "transfer-lane-notes", scope: "map", order: 160,
  run(ctx) {
    const { notes } = ctx;
    const r = ctx.map.lanes;
    if (!r) return;
    for (const m of r.moved) notes.push(`${ctx.map.name}: ${m}`);
    for (const s of r.stuck) notes.push(`${ctx.map.name}: ${s} — 옮길 자리가 없어 그대로 둠`);
  },
};
