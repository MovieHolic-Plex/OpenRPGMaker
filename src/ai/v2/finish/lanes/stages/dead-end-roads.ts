// 출구 없이 가장자리에서 끊긴 길에 「막힌 길」 표지(2026-10-29 vm6 flash jrpg «동쪽 길은 (41,18)에서 막혔다»).
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { markDeadEndRoads } from "../../../place/deadEndRoads";

export const stage: FinishStage = {
  id: "dead-end-roads", phase: "lane-map", order: 80,
  run({ env, notes, run }, mapId) {
    for (const n of markDeadEndRoads(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
