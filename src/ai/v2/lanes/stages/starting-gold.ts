// 시작 돈(ensureStartingGold).
import type { LaneStage } from "../types";
import { ensureStartingGold } from "../../healingAccess";

export const stage: LaneStage = {
  id: "starting-gold", scope: "project", order: 50,
  run({ notes, run }) {
    try { notes.push(...ensureStartingGold(run)); } catch { /* 시작 돈 실패는 끝맺음을 깨지 않는다 */ }
  },
};
