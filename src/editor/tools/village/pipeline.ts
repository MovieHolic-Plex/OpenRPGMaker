// editor/tools/village/pipeline.ts
// 파이프라인 지원 — 맵 상태 스냅샷/재시도 정리 기준선, plan→build 인자 병합.
// (runVillagePipeline 본문은 VILLAGE_TOOLS 순환 의존 때문에 builder.ts에 있다.)

import { cloneJson } from "@/project/io/guards";
import type { MapTreeNode, Project } from "@/project/types";
import { resolveWorldGenRules } from "@/project/worldGenRules";
import { ToolError } from "../types";
import {
  loadVillagePlan,
  normalizeVillagePlan,
  storeVillagePlan,
  villagePlanToBuildArgs,
} from "../villagePlan";

export interface ProjectMapsBaseline {
  readonly mapIds: ReadonlySet<string>;
  readonly mapTree: MapTreeNode;
  readonly startMapId: string;
  readonly startPos: { readonly x: number; readonly y: number };
}

/** 파이프라인 진입 시점의 맵 상태 스냅샷 — wipeAttemptMaps의 보존 기준선. */
export function snapshotProjectMaps(draft: Project): ProjectMapsBaseline {
  return {
    mapIds: new Set(Object.keys(draft.maps)),
    mapTree: cloneJson<MapTreeNode>(draft.mapTree),
    startMapId: draft.startMapId,
    startPos: { ...draft.startPos },
  };
}

/**
 * 재시도 전 정리 — 이전 attempt가 만든 맵(마을+실내)만 지운다.
 * 기준선에 있던 맵·트리·시작점은 그대로 복원한다. (예전 wipeProjectMaps는
 * draft.maps={}로 무관한 기존 맵까지 전부 삭제했다 — 절대 되살리지 말 것.)
 */
export function wipeAttemptMaps(draft: Project, baseline: ProjectMapsBaseline): void {
  for (const id of Object.keys(draft.maps)) {
    if (!baseline.mapIds.has(id)) delete draft.maps[id];
  }
  draft.mapTree = cloneJson<MapTreeNode>(baseline.mapTree);
  (draft as { startMapId: string }).startMapId = baseline.startMapId;
  draft.startPos = { ...baseline.startPos };
}

/** planId / plan 객체를 build_village 인자로 펼친다. */
export function mergePlanIntoBuildArgs(draft: Project, args: Record<string, unknown>): Record<string, unknown> {
  let fromPlan: Record<string, unknown> = {};
  if (typeof args.plan === "object" && args.plan !== null && !Array.isArray(args.plan)) {
    const { plan, ok, issues } = normalizeVillagePlan(
      args.plan,
      typeof args.seed === "number" ? args.seed : 1,
      resolveWorldGenRules(draft.system.worldGen),
    );
    if (!ok) {
      throw new ToolError(
        `plan 검증 실패: ${issues.filter((i) => i.severity === "error").map((i) => i.message).join(" / ")}`,
        { code: "invalid-plan" },
      );
    }
    storeVillagePlan(draft, plan);
    fromPlan = villagePlanToBuildArgs(plan);
  } else if (typeof args.planId === "string" && args.planId.trim()) {
    const stored = loadVillagePlan(draft, args.planId.trim());
    if (!stored) {
      throw new ToolError(
        `planId '${args.planId}' 계획을 찾을 수 없다. 같은 턴/초안에서 plan_village를 먼저 호출하라.`,
        { code: "plan-not-found" },
      );
    }
    fromPlan = villagePlanToBuildArgs(stored);
  }
  // 명시 인자가 plan 기본값을 덮어쓴다.
  return { ...fromPlan, ...args };
}
