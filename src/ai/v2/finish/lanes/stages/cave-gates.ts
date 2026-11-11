// 풀밭 한가운데 투명 동굴 출입구 → 그 위(또는 8걸음 안)에 갱구를 세운다(2026-10-29 vm3 argon jrpg 「마을 밖 동굴 길이 안 보임」) — 갱구가 없는 칩셋은 못 한 것으로 적는다.
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { recordArtGaps, type ArtGap } from "../../../shared/artGap";
import { dressBareCaveGates } from "../../../place/caveGates";

export const stage: FinishStage = {
  id: "cave-gates", phase: "lane-map", order: 40,
  run({ env, session, notes, run }, mapId) {
    const gaps: ArtGap[] = [];
    for (const n of dressBareCaveGates(run, mapId, gaps)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
    recordArtGaps({ env, session }, "cave-gates", gaps);
  },
};
