// 들어오는 길도 이벤트도 없는 빈 사본·끊긴 맵을 치운다.
import type { LaneStage } from "../types";
import { retireOrphanMaps } from "../../blankStart";

export const stage: LaneStage = {
  id: "orphan-maps", scope: "project", order: 70,
  run({ notes, run }) {
    notes.push(...retireOrphanMaps(run));
  },
};
