// 단계 순서 보호 — 앞 단계 전엔 길을 막는 보스가 안 나타나고, 잠김 대사가 앞 단계 이벤트를 가리킨다(2026-10-29 vm3 terra jrpg). 경로를 다시 짓지 않는 판에도.
// 시작 파티로 못 이기는 길목 보스를 맞춘 사본으로 — 경로를 다시 짓지 않는 판에도(2026-10-29 vm3 flash jrpg 리치).
import type { FinishStage } from "../types";
import { fitUnwinnableStepBattlesIn } from "../../blueprintPath";

export const stage: FinishStage = {
  id: "fit-unwinnable-battles", phase: "assembly", order: 140,
  run({ env, assembled }) {
    try { assembled.push(...fitUnwinnableStepBattlesIn(env.ctx.project)); }
    catch { /* 맞추기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
