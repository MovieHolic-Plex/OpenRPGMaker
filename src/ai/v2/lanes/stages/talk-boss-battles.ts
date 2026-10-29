// 말을 거는 보스가 싸우지 않으면 같은 맵의 그 보스 전투를 대사 뒤에 붙인다(bossTalkBattles.ts; 2026-10-30 씬 벤치 terra boss-room 「결판을 내자.」만 반복).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { talkBossBattles } from "../../bossTalkBattles";

export const stage: LaneStage = {
  id: "talk-boss-battles", scope: "map", order: 105,
  run({ env, notes, run }, mapId) {
    for (const n of talkBossBattles(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
