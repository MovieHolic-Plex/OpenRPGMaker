// 가장자리 길 끝 출구를 길 폭 전체로(edgeExitRoads.widenRoadExits) — 장면·고치기 요청에도.
// 왜(2026-10-30 씬 벤치 sc-1030s-b2 opus river-village r1·r3): 새 어촌의 「→ 버들마을」 출구가 두 칸 폭 포석 길의 왼쪽 칸 (27,0)·(22,0)에만 있었고,
// 판정자는 오른쪽 줄 (28,0)·(23,0)로 올라가 가장자리에서 막혔다 — 「표지판은 있는데 맵 전환이 일어나지 않는다」. 같은 고침(끝맺음 widen-road-exits)은
// 게임 전체 요청의 조립 묶음(assembly)에서만 돌아 장면 판에는 닿지 않았다. 이 단계는 출구·이동 칸 마감 안에서 맵마다 같은 함수를 돈다(되풀이 안전 — 앞 사본을 걷고 다시 잰다).
import { mapLabel, type LaneStage } from "../types";
import { widenRoadExits } from "../../edgeExitRoads";

export const stage: LaneStage = {
  id: "widen-road-exits", scope: "map", order: 165,
  run(ctx, mapId) {
    const { notes, run } = ctx;
    for (const n of widenRoadExits(run, mapId)) notes.push(`${mapLabel(ctx.env, mapId)}: ${n}`);
  },
};
