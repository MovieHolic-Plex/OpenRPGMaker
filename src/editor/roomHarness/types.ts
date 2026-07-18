/**
 * Room Harness 공통 타입 — 실내(villager-room-v1)/던전(dungeon-room-v1) 등
 * 절차 방 하네스가 공유하는 킷 인터페이스와 세션 상태.
 *
 * 킷은 이 인터페이스만 구현하면 공유 엔진(engine.ts)에서 start/advance/run/evaluate/list
 * 세션 흐름을 자동 획득한다. 툴 이름은 키트별로 유지하고 속만 엔진을 호출한다.
 */
import type { GameMap, Project } from "@/project/types";

export type RoomLayerState = "open" | "done" | "failed";

export type RoomLayerResult = {
  readonly map: GameMap;
  readonly ok: boolean;
  readonly summary: string;
  readonly warnings: readonly string[];
};

export type RoomPipelineResult = {
  readonly map: GameMap;
  readonly log: readonly string[];
  readonly warnings: readonly string[];
  readonly ok: boolean;
};

/**
 * 평가 리포트 공통 계약(실내 InteriorRoomLookReport 정렬). 핵심 3필드만 강제하고
 * 킷별 추가 필드(metrics/feedbackForLlm 등)는 구조적으로 허용된다(엔진은 리포트를
 * data로 그대로 통과시킨다).
 */
export type RoomEvalReport = {
  readonly ok: boolean;
  readonly score: number;
  readonly issues: readonly string[];
};

/**
 * 절차 방 하네스 킷. Plan은 킷별 플랜 타입(InteriorRoomPlan / DungeonRoomPlan 등).
 * buildOrder[0]은 항상 "plan"이며 세션 시작 시 done 처리된다.
 */
export interface RoomHarnessKit<Plan = unknown> {
  readonly kitId: string;
  readonly themes: readonly string[];
  /** ["plan", …레이어…, "critique"] — 세션 체크리스트/advance 순서. */
  readonly buildOrder: readonly string[];
  readonly demoPlans: readonly Plan[];

  /** 타일셋에 하네스 팩이 시드됐는지 보장. */
  ensureHarness(project: Project): boolean;
  /** 툴 args → 플랜(검증 포함, 실패 시 ToolError throw). */
  parsePlan(args: Record<string, unknown>): Plan;
  mapIdOf(plan: Plan): string;
  nameOf(plan: Plan): string;
  createEmptyMap(plan: Plan): GameMap;
  /** 레이어 1개 시공(맵 사본 반환). */
  applyLayer(map: GameMap, plan: Plan, layer: string): RoomLayerResult;
  /** 원샷: 모든 레이어를 순서대로 시공. */
  runPipeline(plan: Plan): RoomPipelineResult;
  /** 완성 맵 평가(선택). */
  evaluate?(map: GameMap, plan: Plan, attempt: number): RoomEvalReport;
  /** 데모 식별자(테마명 등) → 데모 플랜. 미구현 시 엔진이 demoPlans에서 테마로 찾는다. */
  demoMatch?(demo: string): Plan | undefined;
  /** 세션 시작 로그 첫 줄(선택). */
  startLog?(plan: Plan): string;
}

export interface RoomSession<Plan = unknown> {
  id: string;
  kitId: string;
  plan: Plan;
  checklist: Record<string, RoomLayerState>;
  mapId: string;
  log: string[];
}

/** 세션이 얹히는 프로젝트 확장(통합 bag). */
export type RoomHarnessBag = {
  roomHarnessSessions?: Record<string, RoomSession>;
};
