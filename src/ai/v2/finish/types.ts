// 끝맺음 단계의 공용 형 — 단계 하나 = 파일 하나(finish/stages/<id>.ts · finish/lanes/stages/<id>.ts), 형은 FinishStage 하나다.
// 목록은 finish/stages/index.ts 와 finish/lanes/stages/index.ts, 순서는 묶음(phase) → 각 단계의 order(finish/stageOrder.ts).
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../turn/session";
import type { BlueprintBlocker } from "../blueprint";
import type { RecordingBuildRun } from "../buildRun";
import type { ReachRepair } from "../place/reachRepairs";

/**
 * 단계의 묶음.
 * 끝맺음 실행기(finish/index.ts runFinishAutoBuild)가 도는 셋 — 묶음마다 조건을 본다:
 * - blueprint: 청사진이 있을 때만. 한 일은 ctx.done → 조수에게 줄 「[자동으로 지음]」 글.
 * - assembly: 게임 전체 요청(wantsWholeGame)일 때만. 한 일은 ctx.assembled → v2.assembly 기록 + 체크포인트 blueprint_assembly.
 * - reload: 맨 끝(저장 → 다시 읽기 관문). 단계가 조건을 스스로 본다.
 * 출구·이동 칸 마감(finish/lanes/index.ts runLaneStages — blueprint 의 lanes 단계가 session.clearLanes 로 부른다)이 도는 둘:
 * - lane-project: 맵 돌기 전에 한 번(빈 시작 맵 치우기·방탈출 봉인·상점·은신처·얼굴 자리 …).
 * - lane-map: 맵마다(Object.keys(project.maps) 를 돌기 시작할 때 한 번 읽은 순서) — 출구 마감·길·그림·사람 자리 … 한 일은 ctx.notes. 동기로만 돈다.
 */
export type FinishPhase = "blueprint" | "assembly" | "reload" | "lane-project" | "lane-map";

export interface FinishCtx {
  readonly env: PiAssistantV2Env;
  readonly session: V2Session;
  /** blueprint 묶음이 한 일(조수에게 줄 목록 한 줄씩). */
  readonly done: string[];
  /** assembly 묶음이 한 일(v2.assembly 요약). */
  readonly assembled: string[];
  /** 청사진 걷기 막힘 — walk-blueprint 단계가 채우고 장소 짓기가 다시 걷는다. */
  walked: BlueprintBlocker[];
  /** 조수에게 돌려줄 글(blueprint 묶음 뒤 실행기가 만들고 reload 단계가 덧붙인다). */
  autoPath?: string;
  /** 빌드 실행 — 마감 묶음에서는 createV2Tools 의 것(도구들과 같은 기록)이다. */
  readonly run: RecordingBuildRun;
  /** 마감 묶음이 한 일 목록 — clearLanes 가 돌려주고 기록·체크포인트한다. */
  readonly notes: string[];
  /** 마감이 맵 하나를 도는 동안의 공유 자리(맵마다 새로). transfer-lanes 가 채우고 transfer-lane-notes 가 쓴다. */
  map: { name?: string; lanes?: ReachRepair };
}

export interface FinishStage {
  /** 단계 이름(파일 이름과 같게). */
  readonly id: string;
  readonly phase: FinishPhase;
  /** 같은 묶음 안 실행 순서(작을수록 먼저, 겹치면 안 된다). 사이에 끼우려면 소수도 된다(예: 135). */
  readonly order: number;
  /** 이번 턴에 지은 것만 만지는 단계 — 게임을 짓는 턴이 아니어도(작은 요청) 돈다. 없으면 게임을 짓는 턴에만 돈다(finish/index.ts blueprintTurn). blueprint 묶음만 본다. */
  readonly ownWork?: true;
  /** mapId 는 lane-map 묶음에서만 뜻이 있다(다른 묶음은 ""). */
  run(ctx: FinishCtx, mapId: string): void | Promise<void>;
}

/** 기록 줄 앞의 맵 이름(지금 프로젝트에서 — 앞 단계가 맵을 지웠으면 id). */
export const mapLabel = (env: PiAssistantV2Env, mapId: string): string => env.ctx.project.maps[mapId]?.name ?? mapId;
