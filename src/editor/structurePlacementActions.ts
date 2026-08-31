// editor/structurePlacementActions.ts
// 맵에 찍힌 구조물 배치의 store 배선 — 기록(사람 스탬프) · 지우기(before 복원) · 재시공.
//
// 왜 여기서 갈라지는가:
//  - 찍기/재시공은 **페인트 경로**(paintTilesBulk)를 탄다. 사람이 팔레트로 찍는 것과 같은 그림이 나와야 하고,
//    그 경로가 오토타일 성형을 하므로 afterHash 는 반드시 찍은 **뒤에 맵을 되읽어** 계산한다.
//  - 지우기(복원)는 **날것 대입**만 쓴다. 페인트 경로를 다시 타면 오토타일이 원본과 다른 그림을 만든다.
//
// 재시공은 배치별 수동만이다 — 킷을 고쳤을 때 기존 배치로 자동 전파하지 않는다.

import { paintTilesBulk } from "@/editor/tileActions";
import { builtinHouseStructureKitsFor } from "@/editor/harnessSuggestion/builtinHouseStructureKits";
import { structureKitSize, structureKitUnitCells } from "@/editor/harnessSuggestion/structureKitModel";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import type { PaletteStamp } from "@/editor/tilePaletteStamp";
import {
  evaluatePlacementConditions,
  mapSurfaceProbe,
  type PlacementSurfaceVerdict,
} from "@/project/placementSurface";
import {
  captureStructureTiles,
  cellsOwnedByLaterPlacements,
  clipStructureRectToMap,
  makeStructurePlacement,
  pushStructurePlacement,
  restoreStructurePlacementTiles,
  removeStructurePlacement,
  replaceStructurePlacement,
  structurePlacementIsOverpainted,
  structurePlacementsBlockingGrowth,
  structurePlacementsOf,
  structureRectFitsMap,
  structureTilesHash,
  type StructureRect,
  type StructureTiles,
} from "@/project/structurePlacements";
import { store } from "@/project/store";
import type { GameMap, MapId, StructureKitDef, StructurePlacement, TilesetDef } from "@/project/types";

/**
 * 이 타일셋에서 "구조물 킷"으로 인정되는 것 전부 — 내장 파라메트릭 킷 + 등록 킷.
 * 데이터베이스 구조물 탭의 albumEntries 와 같은 규약이며, 세 번째 갈래인 **실내 오브젝트는 제외**한다.
 * 실내 오브젝트(bed_h 등)도 PaletteStamp.kitId 를 채우지만 구조물이 아니라 배치 기록 대상이 아니다.
 */
export function structureKitsForTileset(tileset: TilesetDef | undefined): readonly StructureKitDef[] {
  if (!tileset) return [];
  return [...builtinHouseStructureKitsFor(tileset), ...(tileset.structureKits ?? [])];
}

/** kitId 화이트리스트 조회. 실내 오브젝트 id 나 삭제된 킷은 undefined. */
export function findStructureKit(tileset: TilesetDef | undefined, kitId: string): StructureKitDef | undefined {
  return structureKitsForTileset(tileset).find((kit) => kit.id === kitId);
}

export function structureKitForPlacement(
  project: { readonly maps: Record<string, GameMap>; readonly tilesets: Record<string, TilesetDef> },
  mapId: MapId,
  placement: StructurePlacement,
): StructureKitDef | undefined {
  const map = project.maps[mapId];
  if (!map) return undefined;
  return findStructureKit(project.tilesets[map.tilesetId], placement.kitId);
}

/** 킷이 사라진 배치(고아). 지우기는 되고 재시공만 막힌다. */
export function structurePlacementIsOrphan(mapId: MapId, placement: StructurePlacement): boolean {
  return structureKitForPlacement(store.getCurrent(), mapId, placement) === undefined;
}

/**
 * 킷의 배치 조건(`kit.ai.placement`)을 이 자리에 대고 검사한다 — **찍기 전** 지형을 본다.
 *
 * 조건이 없으면 빈 판정이라 기존 킷은 전부 그대로 통과한다(하위 호환).
 * rect 가 맵을 벗어나면 clip 하지 않고 **원래 rect 로** 검사한다 — 맵 밖은 벽으로 세므로
 * "경계에 등을 댔다"가 성립해야 하고, clip 하면 발밑 줄이 엉뚱한 행으로 올라간다.
 */
export function evaluateKitPlacementConditions(input: {
  readonly mapId: MapId;
  readonly kit: StructureKitDef;
  readonly rect: StructureRect;
}): PlacementSurfaceVerdict {
  const project = store.getCurrent();
  const map = project.maps[input.mapId];
  if (!map) return { blocked: [], warnings: [] };
  return evaluatePlacementConditions({
    conditions: input.kit.ai?.placement,
    probe: mapSurfaceProbe(project, map),
    rect: input.rect,
  });
}

/**
 * 사람이 팔레트 스탬프로 찍기 직전 조건 검사. 구조물 킷 스탬프가 아니면 null(검사 대상 아님).
 * 좌표는 스탬프 좌상단이고 크기는 스탬프 크기 — `beginKitStampCapture` 와 같은 사각을 본다.
 */
export function checkKitStampConditions(
  mapId: MapId,
  stamp: PaletteStamp,
  x: number,
  y: number,
): { readonly kit: StructureKitDef; readonly verdict: PlacementSurfaceVerdict } | null {
  const kitId = stamp.kitId;
  if (!kitId) return null;
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return null;
  const kit = findStructureKit(project.tilesets[map.tilesetId], kitId);
  if (!kit) return null;
  if ((kit.ai?.placement ?? []).length === 0) return null;
  return {
    kit,
    verdict: evaluateKitPlacementConditions({ kit, mapId, rect: { x, y, w: stamp.width, h: stamp.height } }),
  };
}

export interface KitStampCapture {
  readonly mapId: MapId;
  readonly kitId: string;
  readonly rect: StructureRect;
  readonly before: StructureTiles;
}

/**
 * 사람이 팔레트 스탬프로 킷을 찍기 **직전**에 부른다.
 * - `stamp.kitId` 가 없으면(일반 드래그 스탬프) null — 드래그로 배치가 수십 개 생기는 것을 막는 1차 관문은
 *   호출자(스트로크 첫 타일에서만 부른다)이고, 여기서는 킷 스탬프만 통과시킨다.
 * - kitId 가 구조물 킷이 아니면(실내 오브젝트) null.
 */
export function beginKitStampCapture(
  mapId: MapId,
  stamp: PaletteStamp,
  x: number,
  y: number,
): KitStampCapture | null {
  const kitId = stamp.kitId;
  if (!kitId) return null;
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map) return null;
  if (!findStructureKit(project.tilesets[map.tilesetId], kitId)) return null;
  const rect = clipStructureRectToMap({ x, y, w: stamp.width, h: stamp.height }, map);
  if (!rect) return null;
  return { mapId, kitId, rect, before: captureStructureTiles(map, rect) };
}

/** 찍은 **직후**에 부른다 — afterHash 를 실제로 써진 맵 타일에서 되읽는다. */
export function commitKitStampCapture(capture: KitStampCapture): StructurePlacement | null {
  const stamped = store.getCurrent().maps[capture.mapId];
  if (!stamped) return null;
  const placement = makeStructurePlacement(stamped, {
    kitId: capture.kitId,
    rect: capture.rect,
    before: capture.before,
  });
  store.updateMap(capture.mapId, (map) => pushStructurePlacement(map, placement));
  return placement;
}

export type EraseStructurePlacementResult =
  | { readonly kind: "not-found" }
  | { readonly kind: "erased"; readonly restored: number; readonly skipped: number };

/** 배치 지우기 — 찍기 전 타일을 날것으로 복원하고 기록을 뺀다. 나중 배치가 덮은 칸은 건너뛴다. */
export function eraseStructurePlacement(mapId: MapId, placementId: string): EraseStructurePlacementResult {
  const map = store.getCurrent().maps[mapId];
  const placement = map ? structurePlacementsOf(map).find((entry) => entry.id === placementId) : undefined;
  if (!map || !placement) return { kind: "not-found" };
  const skipCells = cellsOwnedByLaterPlacements(map, placementId);
  recordProjectSnapshot("구조물 지우기", mapId, { kind: "map" });
  const counts = { restored: 0, skipped: 0 };
  store.updateMap(mapId, (draft) => {
    const result = restoreStructurePlacementTiles(draft, placement, { skipCells });
    counts.restored = result.restored;
    counts.skipped = result.skipped;
    removeStructurePlacement(draft, placementId);
  });
  return { kind: "erased", restored: counts.restored, skipped: counts.skipped };
}

export type RestampStructurePlacementResult =
  | { readonly kind: "not-found" }
  | { readonly kind: "kit-missing"; readonly kitId: string }
  | { readonly kind: "cancelled" }
  | { readonly kind: "out-of-bounds"; readonly rect: StructureRect }
  | { readonly kind: "blocked"; readonly rect: StructureRect; readonly blockedBy: readonly StructurePlacement[] }
  | { readonly kind: "restamped"; readonly placement: StructurePlacement; readonly resized: boolean };

export interface RestampStructurePlacementDeps {
  /** 덧칠이 감지됐을 때 확인을 받는다. **무음 차단이 아니라 soft hint** — 사용자가 승낙하면 덮어쓴다. */
  readonly confirmOverpaint: (input: {
    readonly placement: StructurePlacement;
    readonly kit: StructureKitDef;
  }) => Promise<boolean>;
}

/**
 * 배치를 킷의 현재 모습으로 다시 찍는다.
 * - 크기가 변한 킷은 **원점(좌상단) 유지**. 새 크기가 맵을 벗어나거나 이웃 배치와 겹치면 건너뛰고 보고한다.
 * - 배치가 찍힌 뒤 누군가 덧칠했으면 확인을 받는다(차단하지 않는다).
 */
export async function restampStructurePlacement(
  mapId: MapId,
  placementId: string,
  deps: RestampStructurePlacementDeps,
): Promise<RestampStructurePlacementResult> {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  const placement = map ? structurePlacementsOf(map).find((entry) => entry.id === placementId) : undefined;
  if (!map || !placement) return { kind: "not-found" };
  const kit = findStructureKit(project.tilesets[map.tilesetId], placement.kitId);
  if (!kit) return { kind: "kit-missing", kitId: placement.kitId };

  const size = structureKitSize(kit);
  const rect: StructureRect = { x: placement.x, y: placement.y, w: size.width, h: size.height };
  const resized = rect.w !== placement.w || rect.h !== placement.h;
  if (!structureRectFitsMap(rect, map)) return { kind: "out-of-bounds", rect };
  const blockedBy = structurePlacementsBlockingGrowth(map, placement, rect, placement.id);
  if (blockedBy.length > 0) return { kind: "blocked", rect, blockedBy };

  if (structurePlacementIsOverpainted(map, placement)) {
    const proceed = await deps.confirmOverpaint({ placement, kit });
    if (!proceed) return { kind: "cancelled" };
    // 확인 대기 중(모달이 떠 있는 동안) 배치가 지워졌을 수 있다 — 사라졌으면 아무것도 하지 않는다.
    const latest = store.getCurrent().maps[mapId];
    if (!latest || !structurePlacementsOf(latest).some((entry) => entry.id === placementId)) {
      return { kind: "not-found" };
    }
  }

  recordProjectSnapshot("구조물 다시 찍기", mapId, { kind: "map" });

  // 1) 기존 그림을 날것으로 되돌린다(페인트 경로 금지). 나중 배치가 덮은 칸은 남긴다.
  const skipCells = cellsOwnedByLaterPlacements(map, placementId);
  store.updateMap(mapId, (draft) => {
    restoreStructurePlacementTiles(draft, placement, { skipCells });
  });

  // 2) 새 before 는 "이 시공 직전 그 자리" — 복원 뒤, 새 rect 기준으로 뜬다.
  const restoredMap = store.getCurrent().maps[mapId];
  if (!restoredMap) return { kind: "not-found" };
  const before = captureStructureTiles(restoredMap, rect);

  // 3) 킷의 현재 셀을 사람이 찍는 것과 같은 페인트 경로로 시공한다.
  paintTilesBulk(
    mapId,
    structureKitUnitCells(kit).map((cell) => ({
      layer: cell.layer,
      x: rect.x + cell.dx,
      y: rect.y + cell.dy,
      tile: cell.tile,
    })),
    { autoConnect: false, clusterExpand: false },
  );

  // 4) afterHash 는 킷 정의가 아니라 실제로 써진 타일에서 되읽는다.
  const stampedMap = store.getCurrent().maps[mapId];
  if (!stampedMap) return { kind: "not-found" };
  const next: StructurePlacement = {
    ...placement,
    x: rect.x,
    y: rect.y,
    w: rect.w,
    h: rect.h,
    stampedAt: new Date().toISOString(),
    before: { lower: [...before.lower], upper: [...before.upper] },
    afterHash: structureTilesHash(captureStructureTiles(stampedMap, rect)),
  };
  store.updateMap(mapId, (draft) => {
    replaceStructurePlacement(draft, next);
  });
  return { kind: "restamped", placement: next, resized };
}
