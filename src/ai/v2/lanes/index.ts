// 출구·이동 칸 마감 — 끝맺음 단계 lanes(finish/stages/lanes.ts)가 session.clearLanes 로 부른다(createV2Tools 가 건다).
// 단계 하나 = lanes/stages/<id>.ts 하나({ id, scope, order, run }), 목록 = lanes/stages/index.ts(한 줄에 하나).
// 순서: project 단계 전부(order 순) → 맵마다(그 시점 Object.keys(maps) 순) map 단계 전부(order 순).
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../verbs";
import type { RecordingBuildRun } from "../buildRun";
import type { LaneCtx, LaneScope, LaneStage } from "./types";
import * as registered from "./stages";
import { recordStageWrites } from "../stageWrites";

export type { LaneCtx, LaneScope, LaneStage } from "./types";

/** scope → order 순 단계 목록. 같은 scope 안 order·id 가 겹치면 모듈을 읽을 때 던진다. */
export function orderedLaneStages(stages: readonly LaneStage[] = Object.values(registered)): LaneStage[] {
  const out: LaneStage[] = [];
  for (const scope of ["project", "map"] as const satisfies readonly LaneScope[]) {
    const list = stages.filter((s) => s.scope === scope).sort((a, b) => a.order - b.order);
    for (let i = 1; i < list.length; i++) if (list[i]!.order === list[i - 1]!.order) throw new Error(`마감 단계 order 겹침: ${scope} ${list[i - 1]!.id}·${list[i]!.id} = ${list[i]!.order}`);
    out.push(...list);
  }
  const ids = new Set<string>();
  for (const s of out) { if (ids.has(s.id)) throw new Error(`마감 단계 id 겹침: ${s.id}`); ids.add(s.id); }
  if (out.length !== stages.length) throw new Error("마감 단계 scope 가 알 수 없는 값이다");
  return out;
}

/** 맵마다 합산해 2초 넘은 단계만 stderr 에 남긴다(2026-11-09 monster 조사, 동작 불변). */
const laneMs = new Map<string, number>();
const timedLane = (id: string, run: () => void): void => { const t0 = Date.now(); try { run(); } finally { laneMs.set(id, (laneMs.get(id) ?? 0) + Date.now() - t0); } };

export const LANE_STAGES: readonly LaneStage[] = orderedLaneStages();

/** 마감 단계를 모두 돌고 한 일 목록을 돌려준다(기록·체크포인트는 부르는 쪽). */
export function runLaneStages(env: PiAssistantV2Env, session: V2Session, run: RecordingBuildRun): string[] {
  return recordStageWrites(() => env.ctx.project, session.stageWrites, () => runLaneStagesRecorded(env, session, run));
}

function runLaneStagesRecorded(env: PiAssistantV2Env, session: V2Session, run: RecordingBuildRun): string[] {
  const ctx: LaneCtx = { env, session, run, notes: [], map: {} };
  laneMs.clear();
  for (const stage of LANE_STAGES) if (stage.scope === "project") timedLane(stage.id, () => stage.run(ctx, ""));
  const perMap = LANE_STAGES.filter((s) => s.scope === "map");
  for (const mapId of Object.keys(env.ctx.project.maps)) {
    ctx.map = {};
    for (const stage of perMap) timedLane(stage.id, () => stage.run(ctx, mapId));
  }
  for (const [id, ms] of laneMs) if (ms >= 2000) console.error(`[v2-lane] ${id} took ${Math.round(ms / 1000)}s in total`);
  return ctx.notes;
}
