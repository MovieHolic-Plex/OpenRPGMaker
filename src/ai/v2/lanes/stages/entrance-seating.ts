// 「동굴 입구」 같은 투명 단계 칸을 맵에 그려진 굴 입구(거목 밑동 굴 문·갱구)의 들어가는 칸으로(2026-10-29 vm7 flash jrpg «나무 구멍 무반응»).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { seatEntranceSteps } from "../../stepArt";

export const stage: LaneStage = {
  id: "entrance-seating", scope: "map", order: 90,
  run({ env, notes, run }, mapId) {
    for (const n of seatEntranceSteps(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
