// 다른 맵에서 들어오는 착지 칸이 돌아가는 문만 닿는 주머니면 맵의 큰 덩어리(돌아가는 문 곁)로 옮긴다(landingPockets.ts;
// 2026-10-30 회귀 sl1 opus jrpg 「동굴에서 마을로 나오면 (0,21)에 갇힘」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { checkLandingPockets } from "../../landingPockets";

export const stage: LaneStage = {
  id: "landing-pockets", scope: "map", order: 118,
  run({ env, notes, run }, mapId) {
    for (const n of checkLandingPockets(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
