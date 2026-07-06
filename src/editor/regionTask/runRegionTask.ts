// 영역 지정 AI 작업 오케스트레이션. 기존 AssistantSession을 그대로 재사용하되,
// 메시지에 표준 [컨텍스트] 선택 영역 footer를 붙여(스펙 게이트 구간 격리 활성화)
// 지시를 보내고, 제안을 clipMapCellsToRegion으로 사각형에 하드-클립한 뒤,
// 스냅샷 1개 + store.replace로 적용한다(undo 1개).
//
// store/세션 싱글턴 의존을 deps로 분리해 단위 테스트가 가능하다.
import { AssistantSession, type SessionEvent, type TurnResult } from "@/ai/assistantSession";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { MapId, Project } from "@/project/types";
import { clipMapCellsToRegion, type RegionRect } from "./clipToRegion";

export interface RegionTaskSessionLike {
  sendUserMessage(text: string, onEvent?: (event: SessionEvent) => void): Promise<TurnResult>;
  getProposedProject(): Project;
}

export interface RegionTaskDeps {
  getProject(): Project;
  applyProject(project: Project, label: string, mapId: MapId): void;
  createSession(project: Project, mapId: MapId): RegionTaskSessionLike;
}

export interface RegionTaskOptions {
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly instruction: string;
  readonly onEvent?: (event: SessionEvent) => void;
}

export interface RegionTaskResult {
  readonly ok: boolean;
  readonly applied: boolean;
  readonly changedCells: number; // 영역 안에서 실제 바뀐 셀 수.
  readonly clippedCells: number; // 영역 밖에서 되돌린(막은) 셀 수.
  readonly proposedCalls: number;
  readonly assistantText: string;
  readonly error?: string;
}

const defaultDeps: RegionTaskDeps = {
  getProject: () => store.getCurrent(),
  applyProject: (project, label, mapId) => {
    recordProjectSnapshot(label, mapId);
    store.replace(project);
  },
  createSession: (project, mapId) => new AssistantSession(project, { contextOptions: { currentMapId: mapId } }),
};

// aiChatPanel.contextFooter와 동일한 [컨텍스트] 라인 포맷(buildSpec.ts의 정규식이 파싱).
// 이 라인이 있어야 세션이 선택 영역을 이번 턴의 암묵적 명세로 인식한다.
export function buildRegionTaskMessage(instruction: string, mapName: string, mapId: MapId, region: RegionRect): string {
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}`;
  return `${instruction.trim()}\n\n이 작업은 아래 선택 영역 안에서만 수행하라. 영역 밖의 타일은 절대 수정하지 마라.\n${footer}`;
}

function inRegion(x: number, y: number, region: RegionRect): boolean {
  return x >= region.x && y >= region.y && x < region.x + region.width && y < region.y + region.height;
}

// 영역 안에서 base 대비 lower/upper가 바뀐 셀 수(적용 여부 판단·요약용).
export function countInRegionChangedCells(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  if (baseMap.width !== nextMap.width || baseMap.height !== nextMap.height) return 0;
  const { width, height } = baseMap;
  let changed = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!inRegion(x, y, region)) continue;
      const i = y * width + x;
      if (nextMap.lowerTiles[i] !== baseMap.lowerTiles[i] || nextMap.upperTiles[i] !== baseMap.upperTiles[i]) changed += 1;
    }
  }
  return changed;
}

export async function runRegionTask(
  opts: RegionTaskOptions,
  deps: RegionTaskDeps = defaultDeps,
): Promise<RegionTaskResult> {
  const empty = { ok: false, applied: false, changedCells: 0, clippedCells: 0, proposedCalls: 0, assistantText: "" };
  const instruction = opts.instruction.trim();
  if (!instruction) return { ...empty, error: "지시 내용이 비어 있습니다." };

  const base = deps.getProject();
  const map = base.maps[opts.mapId];
  if (!map) return { ...empty, error: "맵을 찾을 수 없습니다." };

  const session = deps.createSession(base, opts.mapId);
  const message = buildRegionTaskMessage(instruction, map.name, opts.mapId, opts.region);

  let turn: TurnResult;
  try {
    turn = await session.sendUserMessage(message, opts.onEvent);
  } catch (cause) {
    const error = cause instanceof Error ? cause.message : String(cause);
    return { ...empty, error };
  }

  if (turn.stoppedReason === "error") {
    return { ...empty, proposedCalls: turn.proposedCalls.length, assistantText: turn.assistantText, error: turn.error ?? "AI 처리 오류" };
  }

  const proposed = session.getProposedProject();
  const { project: clipped, clippedCells } = clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
  const changedCells = countInRegionChangedCells(base, clipped, opts.mapId, opts.region);

  if (changedCells === 0) {
    // 영역 안 변경이 없으면 적용하지 않는다(스냅샷/replace 생략).
    return { ok: true, applied: false, changedCells: 0, clippedCells, proposedCalls: turn.proposedCalls.length, assistantText: turn.assistantText };
  }

  deps.applyProject(clipped, `영역 작업: ${instruction.slice(0, 40)}`, opts.mapId);
  return { ok: true, applied: true, changedCells, clippedCells, proposedCalls: turn.proposedCalls.length, assistantText: turn.assistantText };
}
