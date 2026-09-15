// 에이전트 레인 — 한 에이전트가 한 묶음을 맡아 **독립적으로** 도는 실행 단위.
//
// 왜 명령 하나로 묶지 않는가(2026-09-15 실측): 지금은 명령 하나 = 병합 하나 = 검토 카드 하나이고,
// 적용 게이트가 **프로젝트 전체 내용 등가**를 요구한다(`applyChangesetToStore.ts` 의 isProposalBaseCurrent).
// 그래서 레인 A 를 적용하는 순간 레인 B 는 stale-base 로 거절된다. 레인은 그 두 단위를 쪼갠다 —
// 실행 하나, 검토 하나, 적용 하나이고, 적용 판정은 **그 레인의 묶음 키**만 본다.
//
// 이 파일은 순수 모듈이다(스토어·네트워크·DOM 없음). 실행 배선은 editor/panels/aiLaneManager.ts 가 맡는다.

import type { MapTreeNode, Project } from "@/project/types";
import { findMapTreeNode, mapBundleIds } from "./mapBundle";
import type { PiAgentStats, PiAgentThinkingLevel } from "./protocol";

export type LaneStatus = "idle" | "running" | "review" | "applied" | "discarded" | "failed" | "stopped";

export interface LaneSpec {
  /** 레인 식별자. 사람이 읽는 이름과 분리한다(이름은 바뀌어도 스레드는 이어진다). */
  readonly id: string;
  /** 사람이 읽는 레인 이름. 기본은 묶음 대표 맵 이름. */
  readonly label: string;
  /** 레인이 소유하는 묶음의 뿌리 맵들(`mapBundleIds` 로 실내·부분 트리까지 확장된다). */
  readonly mapIds: readonly string[];
  readonly agentLabel: string;
  readonly provider: string;
  readonly model: string;
  readonly instruction: string;
  readonly maxTurns?: number;
  readonly thinkingLevel?: PiAgentThinkingLevel;
}

export interface LaneStep {
  readonly kind: "tool" | "assistant" | "system";
  readonly text: string;
}

export interface LaneProgress {
  readonly turns: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly lastLine: string;
}

export interface LaneResult {
  readonly project: Project;
  readonly stats: PiAgentStats;
  readonly changedKeys: readonly string[];
  /** 레인이 묶음 밖에서 바꾼 키 — 적용 때 버려진다. 리뷰 카드가 이걸 보여준다. */
  readonly spills: readonly string[];
  readonly conflicts: readonly string[];
  readonly summary: string;
}

export interface LaneState {
  readonly spec: LaneSpec;
  readonly status: LaneStatus;
  readonly progress: LaneProgress;
  readonly steps: readonly LaneStep[];
  readonly result: LaneResult | null;
  readonly error: string | null;
  /** 이 레인이 출발한 사본. 묶음 충돌 판정과 병합 base 다. */
  readonly base: Project | null;
  /** 시작 시점에 확장해 둔 묶음 구성원. 같은 묶음 중복 실행 락과 적용 판정에 쓴다. */
  readonly bundleIds: readonly string[];
  readonly startedAt: number | null;
  readonly endedAt: number | null;
}

export type LaneEvent =
  | { readonly type: "start"; readonly base: Project; readonly at: number; /** 후속 지시면 갈아 끼울 지시문. */ readonly instruction?: string }
  | { readonly type: "turn"; readonly line: string }
  /** 델타(생각·본문 조각) — 단계 목록이 아니라 마지막 줄만 움직인다. */
  | { readonly type: "line"; readonly line: string }
  | { readonly type: "step"; readonly step: LaneStep }
  | { readonly type: "done"; readonly result: LaneResult; readonly at: number }
  | { readonly type: "error"; readonly message: string; readonly at: number }
  | { readonly type: "stopped"; readonly at: number }
  | { readonly type: "applied" }
  | { readonly type: "discarded" }
  | { readonly type: "reset" };

const STEP_LIMIT = 60;
const LINE_LIMIT = 200;

export function createLane(spec: LaneSpec): LaneState {
  return {
    spec,
    status: "idle",
    progress: { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" },
    steps: [],
    result: null,
    error: null,
    base: null,
    bundleIds: [...spec.mapIds],
    startedAt: null,
    endedAt: null,
  };
}

/** 레인의 묶음 구성원(맵 + 실내 + 부분 트리). 시작 시점 프로젝트로 확장한다. */
export function laneBundleIds(project: Project, spec: LaneSpec): string[] {
  const ids = new Set<string>();
  for (const mapId of spec.mapIds) {
    for (const id of mapBundleIds(project, mapId)) ids.add(id);
  }
  for (const mapId of spec.mapIds) ids.add(mapId);
  return [...ids].sort();
}

export function reduceLane(state: LaneState, event: LaneEvent): LaneState {
  switch (event.type) {
    case "start":
      return {
        ...state,
        spec: event.instruction === undefined ? state.spec : { ...state.spec, instruction: event.instruction },
        status: "running",
        base: event.base,
        bundleIds: laneBundleIds(event.base, state.spec),
        progress: { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" },
        steps: [],
        result: null,
        error: null,
        startedAt: event.at,
        endedAt: null,
      };
    case "turn":
      return { ...state, progress: { ...state.progress, turns: state.progress.turns + 1, lastLine: event.line.slice(0, LINE_LIMIT) } };
    case "line":
      return { ...state, progress: { ...state.progress, lastLine: event.line.slice(0, LINE_LIMIT) } };
    case "step": {
      const steps = [...state.steps, event.step];
      const progress = event.step.kind === "tool"
        ? { ...state.progress, toolCalls: state.progress.toolCalls + 1, lastLine: event.step.text.slice(0, LINE_LIMIT) }
        : { ...state.progress, lastLine: event.step.text.slice(0, LINE_LIMIT) };
      return { ...state, steps: steps.length > STEP_LIMIT ? steps.slice(-STEP_LIMIT) : steps, progress };
    }
    case "done":
      return { ...state, status: "review", result: event.result, error: null, endedAt: event.at };
    case "error":
      return { ...state, status: "failed", error: event.message, endedAt: event.at };
    case "stopped":
      // 이미 결과를 받은 레인을 중단해도 결과는 남긴다 — 사람이 버릴지 정한다.
      return { ...state, status: state.status === "review" ? "review" : "stopped", endedAt: event.at };
    case "applied":
      return { ...state, status: "applied", result: null };
    case "discarded":
      return { ...state, status: "discarded", result: null, error: null };
    case "reset":
      return { ...state, status: "idle", result: null, error: null, steps: [], progress: { turns: 0, toolCalls: 0, toolErrors: 0, lastLine: "" } };
    default:
      return state;
  }
}

/** 도구 오류를 진행 카운터에만 반영한다(단계 목록은 step 이벤트가 갖는다). */
export function countToolError(state: LaneState): LaneState {
  return { ...state, progress: { ...state.progress, toolErrors: state.progress.toolErrors + 1 } };
}

export function laneIsActive(state: LaneState): boolean {
  return state.status === "running";
}

export function laneElapsedMs(state: LaneState, now: number): number | null {
  if (state.startedAt === null) return null;
  return (state.endedAt ?? now) - state.startedAt;
}

export const LANE_STATUS_LABEL: Record<LaneStatus, string> = {
  idle: "대기",
  running: "실행 중",
  review: "검토 대기",
  applied: "적용됨",
  discarded: "버림",
  failed: "실패",
  stopped: "중단",
};

/**
 * 두 레인이 같은 맵을 동시에 주장하는가. 같은 묶음에 둘을 붙이면 둘 다 병합 전 사본에서
 * 출발해 늦게 끝난 쪽이 맵을 통째로 덮어쓴다 — 팀 런타임이 계약으로 막은 그 사고다
 * (`teamAssignments.ts` 의 in-flight 락). 레인 매니저도 같은 규칙을 쓴다.
 */
export function lanesOverlap(a: { readonly bundleIds: readonly string[] }, b: { readonly bundleIds: readonly string[] }): string[] {
  const right = new Set(b.bundleIds);
  return a.bundleIds.filter((id) => right.has(id));
}

function subtreeNodeJson(project: Project, mapId: string): string {
  return JSON.stringify(findMapTreeNode(project.mapTree as MapTreeNode | undefined, mapId) ?? null);
}

/**
 * 레인 묶음 **안에서** 달라진 키. 레인이 출발한 사본과 지금 프로젝트를 비교한다.
 *
 * 이 함수가 이 설계의 요점이다: 묶음 **밖** 변경(다른 레인이 적용된 것, 사람이 다른 맵을 고친 것)은
 * 여기에 잡히지 않으므로 레인 B 는 레인 A 적용 뒤에도 그대로 적용된다. 반대로 같은 묶음이
 * 움직였으면(사람이 그 맵을 손댔거나, 지켜지지 않은 락을 뚫고 다른 레인이 왔거나) 덮어쓰지 않고
 * 재실행을 요구한다 — 조용한 유실보다 시끄러운 거절이 낫다.
 */
export function laneBundleChangedKeys(base: Project, current: Project, mapIds: readonly string[]): string[] {
  const changed: string[] = [];
  const bundle = new Set<string>();
  for (const mapId of mapIds) {
    for (const id of mapBundleIds(base, mapId)) bundle.add(id);
    for (const id of mapBundleIds(current, mapId)) bundle.add(id);
    bundle.add(mapId);
  }
  for (const id of [...bundle].sort()) {
    if (JSON.stringify(base.maps?.[id]) !== JSON.stringify(current.maps?.[id])) changed.push(`maps.${id}`);
  }
  for (const mapId of mapIds) {
    // 뿌리 노드 비교가 자식(실내) 추가·이동까지 잡는다.
    if (subtreeNodeJson(base, mapId) !== subtreeNodeJson(current, mapId)) changed.push(`mapTree.${mapId}`);
  }
  return changed;
}
