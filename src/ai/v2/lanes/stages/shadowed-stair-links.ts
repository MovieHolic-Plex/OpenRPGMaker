// 들어오는 길도 이벤트도 없는 빈 사본·끊긴 맵(봉인 뒤 「밀실 뒷방」)을 치운다 — 가려진 계단 연결 먼저.
import type { LaneStage } from "../types";
import { dropShadowedStairLinks } from "../../blankStart";

export const stage: LaneStage = {
  id: "shadowed-stair-links", scope: "project", order: 60,
  run({ notes, run }) {
    notes.push(...dropShadowedStairLinks(run));
  },
};
