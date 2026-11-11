// 출구·이동 칸 마감 — 끝맺음 단계 lanes(finish/stages/lanes.ts)가 session.clearLanes 로 부른다(createV2Tools 가 건다).
// 단계 하나 = lanes/stages/<id>.ts 하나(형은 끝맺음과 같은 FinishStage — { id, phase: "lane-project" | "lane-map", order, run }), 목록 = lanes/stages/index.ts(한 줄에 하나).
// 순서: lane-project 단계 전부(order 순) → 맵마다(그 시점 Object.keys(maps) 순) lane-map 단계 전부(order 순).
import type { PiAssistantV2Env } from "../../env";
import type { V2Session } from "../../turn/session";
import type { RecordingBuildRun } from "../../buildRun";
import type { FinishCtx, FinishStage } from "../types";
import { orderedStages } from "../stageOrder";
import * as registered from "./stages";
import { recordStageWrites } from "../../stageWrites";

/** 맵마다 합산해 2초 넘은 단계만 stderr 에 남긴다(2026-11-09 monster 조사, 동작 불변). */
const laneMs = new Map<string, number>();
// 마감은 동기로 돈다(clearLanes 가 기록·체크포인트하기 전에 끝나야 한다) — 약속을 돌려주는 단계는 던진다.
const timedLane = (id: string, run: () => void | Promise<void>): void => { const t0 = Date.now(); try { if (run()) throw new Error(`마감 단계 ${id} 가 약속을 돌려줬다 — lane-* 묶음은 동기 단계만`); } finally { laneMs.set(id, (laneMs.get(id) ?? 0) + Date.now() - t0); } };

const LANE_STAGES: readonly FinishStage[] = orderedStages(Object.values(registered), ["lane-project", "lane-map"]);

/** 마감 단계를 모두 돌고 한 일 목록을 돌려준다(기록·체크포인트는 부르는 쪽). */
export function runLaneStages(env: PiAssistantV2Env, session: V2Session, run: RecordingBuildRun): string[] {
  return recordStageWrites(() => env.ctx.project, session.stageWrites, () => runLaneStagesRecorded(env, session, run));
}

function runLaneStagesRecorded(env: PiAssistantV2Env, session: V2Session, run: RecordingBuildRun): string[] {
  const ctx: FinishCtx = { env, session, run, notes: [], map: {}, done: [], assembled: [], walked: [] };
  laneMs.clear();
  for (const stage of LANE_STAGES) if (stage.phase === "lane-project") timedLane(stage.id, () => stage.run(ctx, ""));
  const perMap = LANE_STAGES.filter((s) => s.phase === "lane-map");
  for (const mapId of Object.keys(env.ctx.project.maps)) {
    ctx.map = {};
    for (const stage of perMap) timedLane(stage.id, () => stage.run(ctx, mapId));
  }
  for (const [id, ms] of laneMs) if (ms >= 2000) console.error(`[v2-lane] ${id} took ${Math.round(ms / 1000)}s in total`);
  return ctx.notes;
}
