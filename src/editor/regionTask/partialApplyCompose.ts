// 부분 적용: base 위에 clipped 의 선택된 청크 셀만 덮어쓴 병합 프로젝트를 만든다.
// runRegionTask.applyProject(merged) 가 이 결과를 store.replace + undo 스냅샷으로 건넨다.
// 순수 함수 — store 의존 없음. 유닛 테스트 대상.
import { ensureBuildPaletteTileGroups } from "@/editor/panels/buildPaletteCore";
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import type { RegionChangeGroups, RegionChunk } from "./regionChangeGroups";
import { groupRegionChanges } from "./regionChangeGroups";
export interface ComposePartialArgs {
  readonly base: Project;
  readonly clipped: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  /** 선택된 청크 id 목록. groups(lower+upper 합침)의 chunk.id 와 비교. */
  readonly selectedChunkIds: readonly string[];
  /** groupRegionChanges 결과 — 주지 않으면 재계산하지 않고 clipped 전체를 그대로 복사. */
  readonly groups?: RegionChangeGroups;
}

/** base 를 깊은 복사한 뒤, 선택된 청크 셀만 clipped 값으로 덮어쓴다.
 *  선택된 청크가 없으면 base 의 복사본을 반환(아무 변경 없음). */
export function composePartialProject(args: ComposePartialArgs): Project {
  const { base, clipped, mapId, region, selectedChunkIds } = args;
  const merged: Project = structuredClone(base);
  const mergedMap = merged.maps[mapId];
  const clippedMap = clipped.maps[mapId];
  if (!mergedMap || !clippedMap) return merged;

  const selected = new Set(selectedChunkIds);
  if (selected.size === 0) return merged;

  const groups = args.groups ?? collectAllChunks(base, clipped, mapId, region);
  for (const chunk of groups.lower) {
    if (!selected.has(chunk.id)) continue;
    writeChunkLayer(mergedMap, clippedMap, "lower", chunk);
  }
  for (const chunk of groups.upper) {
    if (!selected.has(chunk.id)) continue;
    writeChunkLayer(mergedMap, clippedMap, "upper", chunk);
  }
  // 승인 지문은 프로젝트 전체를 비교한다. clipped 후보는 세션 작업본에서 그대로
  // 이어받아 결정론적 하네스 파생 데이터(건축 팔레트 타일 그룹/오토타일)를 품고
  // 있지만 base 복제본에는 그것이 없다. runRegionTask 가 세션 시작 전에 작업본
  // 타일셋에 적용하는 것과 같은 준비(ensureRegionPlacementHarness ->
  // ensureBuildPaletteTileGroups, 멱등·결정론)를 합성 후보의 대상 맵 타일셋에도
  // 적용해 파생 데이터를 정합시킨다. authored 타일 셀은 여전히 선택된 청크만
  // clipped 값으로 덮어쓰고, base/clipped 의 다른 authored 필드는 손대지 않는다.
  // 따라서 맵 authored 편집이 승인 후보와 정확히 일치할 때만 지문이 일치하고,
  // 타일셋을 손댄 후보나 선택 범위를 벗어난 미검수 후보는 그대로 거부된다.
  const mergedTileset = merged.tilesets[mergedMap.tilesetId];
  if (mergedTileset) ensureBuildPaletteTileGroups(mergedTileset);
  return merged;
}

function writeChunkLayer(
  dst: Project["maps"][string],
  src: Project["maps"][string],
  layer: "lower" | "upper",
  chunk: RegionChunk,
): void {
  const dstTiles = layer === "lower" ? dst.lowerTiles : dst.upperTiles;
  const srcTiles = layer === "lower" ? src.lowerTiles : src.upperTiles;
  const field = layer === "lower" ? "lowerTileStacks" : "upperTileStacks";
  const stacks = dst[field] ?? {};
  for (const cell of chunk.cells) {
    dstTiles[cell.index] = srcTiles[cell.index]!;
    const stack = src[field]?.[cell.index];
    if (stack) stacks[cell.index] = [...stack];
    else delete stacks[cell.index];
  }
  if (Object.keys(stacks).length > 0) dst[field] = stacks;
  else delete dst[field];
}

function collectAllChunks(
  base: Project,
  clipped: Project,
  mapId: MapId,
  region: RegionRect,
): RegionChangeGroups {
  return groupRegionChanges(base, clipped, mapId, region);
}
