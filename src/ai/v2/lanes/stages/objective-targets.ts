// 목표 표시(빛무리·화살표)가 가리키는 대상 이벤트가 걸어 닿고 누르면 반응하는가 — 닿지 않으면 옮기고, 아무 명령이 없으면 적는다.
// 왜·규칙은 objectiveTargets.ts 머리글(2026-10-30 씬 벤치 terra ending 「동굴의 흔적」).
import { mapLabel, type LaneStage } from "../types";
import { checkObjectiveTargets } from "../../objectiveTargets";

export const stage: LaneStage = {
  id: "objective-targets", scope: "map", order: 155,
  run(ctx, mapId) {
    const { notes, run } = ctx;
    for (const n of checkObjectiveTargets(run, mapId)) notes.push(`${mapLabel(ctx.env, mapId)}: ${n}`);
  },
};
