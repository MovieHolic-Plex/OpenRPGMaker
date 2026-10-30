// 끝맺음 자동 단계(finish) 의 공용 형 — 단계 하나 = finish/stages/<id>.ts 하나. 순서는 각 단계의 order, 목록은 finish/stages/index.ts.
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../verbs";
import type { BlueprintBlocker } from "../blueprint";

/**
 * 단계의 묶음. 실행기(finish/index.ts runFinishAutoBuild)가 묶음마다 조건을 본다.
 * - blueprint: 청사진이 있을 때만. 한 일은 ctx.done → 조수에게 줄 「[자동으로 지음]」 글.
 * - assembly: 게임 전체 요청(wantsWholeGame)일 때만. 한 일은 ctx.assembled → v2.assembly 기록 + 체크포인트 blueprint_assembly.
 * - reload: 맨 끝(저장 → 다시 읽기 관문). 단계가 조건을 스스로 본다.
 */
export type FinishPhase = "blueprint" | "assembly" | "reload";

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
}

export interface FinishStage {
  /** 단계 이름(파일 이름과 같게). */
  readonly id: string;
  readonly phase: FinishPhase;
  /** 같은 묶음 안 실행 순서(작을수록 먼저, 겹치면 안 된다). 사이에 끼우려면 소수도 된다(예: 135). */
  readonly order: number;
  run(ctx: FinishCtx): void | Promise<void>;
}
