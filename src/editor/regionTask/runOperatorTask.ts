// editor/regionTask/runOperatorTask.ts
// 생성기 모드의 실행 경로 — LLM 을 부르지 않고 오퍼레이터가 직접 타일을 만든다.
//
// 왜 별도 경로인가(2026-09-01): 조수 경로(runRegionTask)는 모델 왕복·스펙 게이트·볼륨 계약을
// 위해 존재한다. 오퍼레이터는 그 전부가 필요 없다 — 입력이 (영역, 파라미터, 시드) 뿐이라
// 검증할 자연어가 없고, 산출물은 정의상 영역 안에 있다. 그래서 조수 경로를 건드리지 않고
// 나란히 둔다. **모드를 나누는 실체가 이 파일이다.**
//
// 다만 "만든 뒤" 는 완전히 같아야 한다 — 사용자가 초안을 보고 적용/버리기를 고르는 계약은
// 하나뿐이어야 하기 때문이다. 그래서 AI 없이 도는 기존 선례(runDirectInteriorRoomDraft)와
// 똑같이 reviewRegionDraft → setPendingRegionApply 로 흘려보낸다. 승인 UI·undo·고스트
// 미리보기·완료 스트립은 조수 경로와 1:1 로 같은 것을 쓴다.

import { clearAgentGhostPreview, setAgentGhostPreviewHidden } from "@/editor/agentGhostPreview";
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { getOperator } from "@/editor/operators/operatorRegistry";
import { clampOperatorParams, type OperatorParamValues, type OperatorWrite } from "@/editor/operators/operatorTypes";
import { resolveMaterialSlots } from "@/editor/operators/materialSlots";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { inRegion, type RegionRect } from "./clipToRegion";
import { reviewRegionDraft } from "./harnessReview";
import { getPendingRegionApply, setPendingRegionApply } from "./pendingRegionApply";
import { dispatchRegionTaskStatus } from "./regionTaskStatus";
import {
  applyRegionProjectWithHistory,
  countAddedMaps,
  countInRegionChangedCells,
  countInRegionChangedEvents,
  type RegionTaskResult,
} from "./runRegionTask";

export interface OperatorTaskOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly operatorId: string;
  readonly params?: OperatorParamValues;
  /** 생략하면 무작위 — "다시 만들기" 는 새 시드를 뽑는 것과 같다. */
  readonly seed?: number;
}

export interface OperatorTaskDeps {
  getProject(): Project;
  applyProject(project: Project, label: string, mapId: MapId): void;
}

const DEFAULT_DEPS: OperatorTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: applyRegionProjectWithHistory,
};

export interface OperatorTaskResult extends RegionTaskResult {
  /** 실제로 쓰인 시드 — UI 가 그대로 보여 주고 재현에 쓴다. */
  readonly seed?: number;
}

/** 영역 밖 쓰기는 애초에 나오지 않지만, 계약을 코드로 못 박아 둔다(오퍼레이터 버그 차단). */
function applyWritesInRegion(
  project: Project,
  mapId: MapId,
  region: RegionRect,
  writes: readonly OperatorWrite[],
): number {
  const map = project.maps[mapId];
  if (!map) return 0;
  let applied = 0;
  for (const write of writes) {
    if (!inRegion(write.x, write.y, region)) continue;
    if (write.x < 0 || write.y < 0 || write.x >= map.width || write.y >= map.height) continue;
    const index = write.y * map.width + write.x;
    if (index < 0 || index >= map.lowerTiles.length) continue;
    if (write.layer === "upper") map.upperTiles[index] = write.tile;
    else map.lowerTiles[index] = write.tile;
    applied += 1;
  }
  return applied;
}

export function randomOperatorSeed(): number {
  return Math.floor(Math.random() * 1_000_000_000);
}

/**
 * 오퍼레이터 한 번 실행 → 승인 대기 초안 등록. 맵에 즉시 반영하지 않는다(조수 경로와 동일).
 * 적용은 반환된 `pending.apply()` 또는 승인 UI 버튼이 한다.
 */
export function runOperatorTask(
  options: OperatorTaskOptions,
  deps: OperatorTaskDeps = DEFAULT_DEPS,
): OperatorTaskResult {
  const empty = {
    applied: false,
    changedCells: 0,
    changedEvents: 0,
    mapsAdded: 0,
    clippedCells: 0,
    proposedCalls: 0,
    assistantText: "",
  } as const;
  let pendingRegistered = false;
  dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: true });
  try {
    const def = getOperator(options.operatorId);
    if (!def) return { ...empty, ok: false, error: `알 수 없는 생성기입니다: ${options.operatorId}` };

    const base = deps.getProject();
    const sourceMap = base.maps[options.mapId];
    if (!sourceMap) return { ...empty, ok: false, error: "선택한 맵을 찾을 수 없습니다." };
    if (options.region.width <= 0 || options.region.height <= 0) {
      return { ...empty, ok: false, error: "영역이 비어 있습니다." };
    }

    getPendingRegionApply()?.discard();

    const params = clampOperatorParams(def, options.params);
    const seed = Number.isFinite(options.seed) ? Math.trunc(options.seed as number) : randomOperatorSeed();
    // 재료는 그 맵의 타일셋에서 유도한다 — 오퍼레이터가 타일 번호를 직접 아는 일이 없게.
    const slots = resolveMaterialSlots(base.tilesets[sourceMap.tilesetId]);
    const built = def.build(sourceMap, options.region, params, seed, slots);

    const draft = cloneDetachedDraft(base);
    const written = applyWritesInRegion(draft, options.mapId, options.region, built.writes);
    if (written === 0) {
      return {
        ...empty,
        ok: true,
        seed,
        assistantText: `${def.label} 생성기가 이 영역에서 바꿀 칸을 찾지 못했습니다 — 지면이 아닌 칸(집·벽·물)만 있거나 파라미터가 0입니다.`,
      };
    }

    const reviewProject = (project: Project) => reviewRegionDraft({
      base,
      draft: project,
      mapId: options.mapId,
      region: options.region,
    });
    const reviewed = reviewProject(draft);
    const changedCells = countInRegionChangedCells(base, reviewed.project, options.mapId, options.region);
    const changedEvents = countInRegionChangedEvents(base, reviewed.project, options.mapId, options.region);
    const mapsAdded = countAddedMaps(base, reviewed.project);
    const instruction = `생성기 · ${def.label} (시드 ${seed})`;
    const label = `${def.label} 생성기`;

    const pending = setPendingRegionApply({
      baseProject: base,
      clippedProject: reviewed.project,
      mapId: options.mapId,
      region: options.region,
      changedCells,
      changedEvents,
      instruction,
      report: reviewed.report,
      getCurrentProject: deps.getProject,
      reviewProject,
      onApply: (project) => deps.applyProject(project, label, options.mapId),
      onDiscard: () => undefined,
      onSettle: () => {
        setAgentGhostPreviewHidden(false);
        clearAgentGhostPreview();
        dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: false });
      },
    });
    pendingRegistered = true;
    dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: true, phase: "pending" });
    return {
      ok: true,
      applied: false,
      changedCells,
      changedEvents,
      mapsAdded,
      clippedCells: 0,
      proposedCalls: 0,
      assistantText: `${def.label} · ${built.note} · 시드 ${seed}`,
      review: reviewed.report,
      pending,
      seed,
    };
  } catch (cause) {
    clearAgentGhostPreview();
    return { ...empty, ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  } finally {
    if (!pendingRegistered) {
      dispatchRegionTaskStatus({ mapId: options.mapId, region: options.region, running: false });
    }
  }
}
