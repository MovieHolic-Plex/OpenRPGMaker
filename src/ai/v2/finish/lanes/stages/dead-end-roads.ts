// 출구 없이 가장자리에서 끊긴 길에 「막힌 길」 표지(2026-10-29 vm6 flash jrpg «동쪽 길은 (41,18)에서 막혔다»).
import type { FinishStage } from "../../types";
import { mapLabel } from "../../types";
import { markDeadEndRoads } from "../../../place/deadEndRoads";
import { pullBackEdgeStubs } from "../../../place/roadStubs";

export const stage: FinishStage = {
  id: "dead-end-roads", phase: "lane-map", order: 80,
  run({ env, notes, run }, mapId) {
    // 먼저 출구 없는 가장자리 길을 마지막 집·사람·시작 자리까지 당긴다(place/roadStubs.ts) — 멈출 데가 없는 길에만 「막힌 길」 표지가 선다
    for (const n of pullBackEdgeStubs(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
    for (const n of markDeadEndRoads(run, mapId)) notes.push(`${mapLabel(env, mapId)}: ${n}`);
  },
};
