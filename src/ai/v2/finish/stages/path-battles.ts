// 길 위 전투를 이어 싸워도 전멸하지 않는 예산·전투당 턴 상한·상징 적 수 상한·시작 회복약으로(2026-10-29 vm4 argon·flash jrpg).
import type { FinishStage } from "../types";
import { fitPathBattlesIn } from "../../pathBattleBudget";

export const stage: FinishStage = {
  id: "path-battles", phase: "assembly", order: 150,
  run({ env, assembled }) {
    try { assembled.push(...fitPathBattlesIn(env.ctx.project)); }
    catch { /* 맞추기 실패는 끝맺음을 깨지 않는다 */ }
  },
};
