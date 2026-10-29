// 붙어 선 사람 사이에서 한 면만 열린 사람은 둘레가 열린 칸으로(2026-10-29 vm3 flash 추리: 갈색 머리 손님이 위에서만 말이 걸렸다).
// 실내에서 문 곁·가구의 하나뿐인 접근 칸·다른 사람 바로 위아래·큰 양탄자 위에 선 사람도(personSpotCost — room-vig6 tavern, 탈출·추리 인물 포함).
import type { LaneStage } from "../types";
import { spreadCrowdedPeople } from "../../eventReach";

export const stage: LaneStage = {
  id: "spread-people", scope: "map", order: 140,
  run(ctx, mapId) {
    const { notes, run } = ctx;
    for (const n of spreadCrowdedPeople(run, mapId)) notes.push(`${ctx.map.name}: ${n}`);
  },
};
