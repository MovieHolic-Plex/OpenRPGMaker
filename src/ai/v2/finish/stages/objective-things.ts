// 목표 글이 가리키는 물건이 맵(이벤트·그림)에 없으면 실제 대상 이벤트 이름으로(2026-10-29 vm6 terra 추리 「단서 정리 책상」).
import type { FinishStage } from "../types";
import { alignObjectiveThings } from "../../mysteryCase";

export const stage: FinishStage = {
  id: "objective-things", phase: "assembly", order: 290,
  run({ env, assembled }) {
    try { assembled.push(...alignObjectiveThings(env.ctx.project)); }
    catch { /* 목표 물건 이름 맞추기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
