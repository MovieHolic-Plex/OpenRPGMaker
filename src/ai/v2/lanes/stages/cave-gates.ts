// 풀밭 한가운데 투명 동굴 출입구 → 그 위(또는 8걸음 안)에 갱구를 세운다(2026-10-29 vm3 argon jrpg 「마을 밖 동굴 길이 안 보임」).
import type { LaneStage } from "../types";
import { mapLabel } from "../types";
import { dressBareCaveGates } from "../../caveGates";

export const stage: LaneStage = {
  id: "cave-gates", scope: "map", order: 40,
  run({ env, notes, run }, mapId) {
    for (const n of dressBareCaveGates(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
