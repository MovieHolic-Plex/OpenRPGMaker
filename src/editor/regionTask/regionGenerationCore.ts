import type { MapId, Project, TilesetDef } from "@/project/types";
import { formatMaterialLabelHint } from "@/ai/turnGuide";
import { validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import { assertHouseProtection, captureHouseProtection, newlyBuiltHouseSnapshots } from "@/editor/tools/houseProtection";
import { clipMapCellsToRegion, inRegion, type RegionRect } from "./clipToRegion";
import { analyzeRegionBlend, describeBlendBreak, describeBlockedEntrance, expandRegion, polishRegionSeams } from "./regionBlend";
import { reviewRegionDraft } from "./harnessReview";
import { ensureBuildPaletteTileGroups } from "./buildPaletteTileGroups";
import { buildRegionPolishMessage } from "./regionPolish";
import { analyzeRegionSurroundings } from "./regionSurroundings";

export interface RegionGenerationOptions {
  mapId: MapId;
  region: RegionRect;
  mode: "task" | "polish";
  instruction: string;
}

/** Captured project only; no UI, pending slot, preference calls or persistence. */
export function prepareRegionGeneration(base: Project, opts: RegionGenerationOptions) {
  const working = structuredClone(base);
  const map = working.maps[opts.mapId];
  const tileset = working.tilesets[map.tilesetId];
  if (tileset) ensureBuildPaletteTileGroups(tileset);
  const message = opts.mode === "polish"
    ? buildRegionPolishMessage({ ...opts, mapName: map.name,
        surroundings: analyzeRegionSurroundings(base, opts.mapId, opts.region),
        materialHint: formatMaterialLabelHint(tileset), extraGuides: [] })
    : buildRegionTaskMessage(opts.instruction, map.name, opts.mapId, opts.region, tileset);
  return { working, message };
}

/** proposed에 생기고 base에 없는 맵 수. */
export function countAddedMaps(base: Project, proposed: Project): number {
  let added = 0;
  for (const id of Object.keys(proposed.maps)) {
    if (!base.maps[id]) added += 1;
  }
  return added;
}

// aiChatPanel.contextFooter와 동일한 [컨텍스트] 라인 포맷(buildSpec.ts의 정규식이 파싱).
// 이 라인이 있어야 세션이 선택 영역을 이번 턴의 암묵적 명세로 인식한다.
// 사용자 발화 + 사실(현재 맵·선택 영역·재료 라벨 예)만 싣는다. 도구 규칙은 툴 설명에, 영역 경계는 세션이
// 스코프 인자(sendUserMessage opts.scope)로 받아 의도 선언에 맞춰 붙인다.
export function buildRegionTaskMessage(
  instruction: string,
  mapName: string,
  mapId: MapId,
  region: RegionRect,
  tileset?: TilesetDef,
): string {
  const material = tileset ? ` · ${formatMaterialLabelHint(tileset).replace(/^- /, "")}` : "";
  const footer = `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (${region.x},${region.y}) ${region.width}×${region.height}${material}`;
  return `${instruction.trim()}\n\n${footer}`;
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

/** 영역 안 이벤트(NPC 등) 추가·삭제·이동·이름 변경 수. */
export function countInRegionChangedEvents(base: Project, next: Project, mapId: MapId, region: RegionRect): number {
  const baseMap = base.maps[mapId];
  const nextMap = next.maps[mapId];
  if (!baseMap || !nextMap) return 0;
  const baseInside = (baseMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const nextInside = (nextMap.events ?? []).filter((event) => inRegion(event.x, event.y, region));
  const baseById = new Map(baseInside.map((event) => [event.id, event]));
  const nextById = new Map(nextInside.map((event) => [event.id, event]));
  let changed = 0;
  for (const [id, event] of nextById) {
    const prev = baseById.get(id);
    if (!prev) {
      changed += 1;
      continue;
    }
    const prevName = prev.pages?.[0]?.name;
    const nextName = event.pages?.[0]?.name;
    if (prev.x !== event.x || prev.y !== event.y || prevName !== nextName) changed += 1;
  }
  for (const id of baseById.keys()) {
    if (!nextById.has(id)) changed += 1;
  }
  return changed;
}

export function reviewRegionGeneration(input: RegionGenerationOptions & { base: Project; project: Project; toolNames: string[] }) {
  const { base, project, mode, instruction, toolNames } = input;
  const opts = input;
  const map = base.maps[opts.mapId];
  const scopeRegion = mode === "polish"
    ? expandRegion(opts.region, 1, map)
    : opts.region;
  const blendBefore = mode === "polish"
    ? analyzeRegionBlend({ project: base, mapId: opts.mapId, region: opts.region })
    : null;
  let seamCells = 0;
  let candidate = project;
  if (mode === "polish") {
    const seams = polishRegionSeams(candidate, opts.mapId, opts.region);
    candidate = seams.project;
    seamCells = seams.seamCells;
  }
  const harness = reviewRegionDraft({
    base,
    draft: candidate,
    mapId: opts.mapId,
    region: opts.region,
    scopeRegion,
  });
  const layoutIssues = validateLayoutPlacement(harness.project, {
    mapId: opts.mapId,
    region: { x: opts.region.x, y: opts.region.y, width: opts.region.width, height: opts.region.height },
    instruction,
    toolNames,
  });
  const structuredLayoutIssues = layoutIssues.map((issue) => ({
    code: issue.code,
    severity: issue.severity === "error" ? "error" as const : "warning" as const,
    message: issue.message,
    ...(issue.mapId ? { mapId: issue.mapId } : {}),
    ...(issue.x === undefined ? {} : { x: issue.x }),
    ...(issue.y === undefined ? {} : { y: issue.y }),
  }));
  // 어울림은 **경고만** 이다 — blockers 에 넣지 않는다. 경계가 조금 어긋난 초안조차 적용을
  // 막으면 사용자가 아무것도 못 하게 된다. 사실을 보여 주고 결정은 사람이 한다.
  // (배치 규칙 error 도 같은 이유로 blockers 에 넣지 않는다 — 영역작업 검증게이트 배제, 2026-08-30.)
  const blend = mode === "polish"
    ? analyzeRegionBlend({ project: harness.project, mapId: opts.mapId, region: opts.region, base })
    : null;
  const blendIssues = blend
    ? [
        ...blend.brokenCrossings.slice(0, 3).map((point) => ({
          code: "region-blend-break",
          severity: "warning" as const,
          message: describeBlendBreak(point),
          mapId: opts.mapId,
          x: point.x,
          y: point.y,
        })),
        ...blend.newlyBlockedEntrances.slice(0, 2).map((point) => ({
          code: "region-blend-entrance-blocked",
          severity: "warning" as const,
          message: describeBlockedEntrance(point),
          mapId: opts.mapId,
          x: point.x,
          y: point.y,
        })),
      ]
    : [];
  return {
    seamCells,
    project: harness.project,
    report: {
      ...harness.report,
      issues: [...harness.report.issues, ...structuredLayoutIssues, ...blendIssues],
      metrics: {
        ...harness.report.metrics,
        ...(blend
          ? {
              blendScore: blend.score,
              brokenCrossings: blend.brokenCrossings.length,
              blockedEntrances: blend.newlyBlockedEntrances.length,
              seamCells,
              ...(blendBefore ? { blendScoreBefore: blendBefore.score } : {}),
            }
          : {}),
      },
    },
  };
}

/** Seal houses BEFORE clipping or advisory review, including a newly built north ridge. */
export function finalizeRegionGeneration(base: Project, proposed: Project, opts: RegionGenerationOptions, toolNames: string[]) {
  const beforeHouses = captureHouseProtection(base);
  const completedHouses = newlyBuiltHouseSnapshots(proposed, beforeHouses);
  const clipped = clipMapCellsToRegion(base, proposed, opts.mapId, opts.region);
  const hasChanges = countInRegionChangedCells(base, clipped.project, opts.mapId, opts.region) > 0
    || countInRegionChangedEvents(base, clipped.project, opts.mapId, opts.region) > 0
    || countAddedMaps(base, clipped.project) > 0;
  // Foreground parity: a no-op proposal must not opportunistically polish existing terrain.
  const reviewed = hasChanges
    ? reviewRegionGeneration({ ...opts, base, project: clipped.project, toolNames })
    : { project: clipped.project, report: undefined, seamCells: 0 };
  assertHouseProtection(beforeHouses, reviewed.project, completedHouses);
  return { ...reviewed, clippedCells: clipped.clippedCells,
    changedCells: countInRegionChangedCells(base, reviewed.project, opts.mapId, opts.region),
    changedEvents: countInRegionChangedEvents(base, reviewed.project, opts.mapId, opts.region),
    mapsAdded: countAddedMaps(base, reviewed.project), completedHouses };
}

export type RegionGenerationProposal = ReturnType<typeof finalizeRegionGeneration>;
