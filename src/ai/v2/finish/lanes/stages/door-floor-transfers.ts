// 바닥 한가운데 투명 이동 칸 → 가장 가까운 외벽에 문(북벽 문 그림·남벽 틈)을 내고 그 앞으로(2026-10-29 vm3 deepseek 탈출 「희미한 빛 위를 걷는 방 이동」).
// 방으로 깔린 맵에만 돈다(interior-exits 와 같은 판정). 칩셋이 문을 적어 두지 않은 방은 못 한 것으로 적는다.
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { doorFloorTransfers } from "../../../place/exitTransfers";
import { laidOf } from "../../../place/laid";
import { recordArtGaps, type ArtGap } from "../../../shared/artGap";

export const stage: FinishStage = {
  id: "door-floor-transfers", phase: "lane-map", order: 30,
  run({ env, session, notes, run }, mapId) {
    const gaps: ArtGap[] = [];
    for (const n of doorFloorTransfers(run, mapId, laidOf(session.placeOf(mapId)?.spec), gaps)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
    recordArtGaps({ env, session }, "door-floor-transfers", gaps);
  },
};
