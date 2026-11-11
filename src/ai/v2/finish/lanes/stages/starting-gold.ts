// 시작 돈(ensureStartingGold).
import type { FinishStage } from "../../types";
import { ensureStartingGold } from "../../../story/healingAccess";

export const stage: FinishStage = {
  id: "starting-gold", phase: "lane-project", order: 50,
  run({ notes, run }) {
    try { notes.push(...ensureStartingGold(run)); } catch { /* 시작 돈 실패는 끝맺음을 깨지 않는다 */ }
  },
};
