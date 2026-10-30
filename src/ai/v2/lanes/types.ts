// 출구·이동 칸 마감(session.clearLanes, 끝맺음 단계 lanes) 의 공용 형 — 단계 하나 = lanes/stages/<id>.ts 하나, 목록 lanes/stages/index.ts.
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../verbs";
import type { RecordingBuildRun } from "../buildRun";
import type { ReachRepair } from "../eventReach";

export interface LaneCtx {
  readonly env: PiAssistantV2Env;
  readonly session: V2Session;
  /** createV2Tools 의 빌드 실행(도구들과 같은 것). */
  readonly run: RecordingBuildRun;
  /** 한 일 목록 — clearLanes 가 돌려주고 기록·체크포인트한다. */
  readonly notes: string[];
  /** 맵 하나를 도는 동안의 공유 자리(맵마다 새로). transfer-lanes 가 채우고 transfer-lane-notes 가 쓴다. */
  map: { name?: string; lanes?: ReachRepair };
}

/**
 * scope:
 * - project: 맵 돌기 전에 한 번(빈 시작 맵 치우기·방탈출 봉인·상점·은신처·얼굴 자리 …).
 * - map: 맵마다(Object.keys(project.maps) 를 돌기 시작할 때 한 번 읽은 순서) — 출구 마감·길·그림·사람 자리 …
 */
export type LaneScope = "project" | "map";

export interface LaneStage {
  readonly id: string;
  readonly scope: LaneScope;
  /** 같은 scope 안 실행 순서(작을수록 먼저, 겹치면 안 된다). 사이에 끼우려면 소수도 된다. */
  readonly order: number;
  run(ctx: LaneCtx, mapId: string): void;
}

/** 기록 줄 앞의 맵 이름(지금 프로젝트에서 — 앞 단계가 맵을 지웠으면 id). */
export const mapLabel = (env: PiAssistantV2Env, mapId: string): string => env.ctx.project.maps[mapId]?.name ?? mapId;
