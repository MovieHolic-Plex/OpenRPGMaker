// 들어오는 길도 이벤트도 없는 빈 사본·끊긴 맵을 치운다.
import type { LaneStage } from "../types";
import { retireOrphanMaps } from "../../blankStart";

export const stage: LaneStage = {
  id: "orphan-maps", scope: "project", order: 70,
  run({ notes, run, env }) {
    // 요청 시작 때 있던 맵은 지우지 않는다(지우면 맵 소실 확인 카드 — blankStart.retireOrphanMaps 머리말).
    notes.push(...retireOrphanMaps(run, new Set(Object.keys(env.request.project.maps ?? {}))));
  },
};
