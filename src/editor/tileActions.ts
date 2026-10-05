import { store, type ProjectChangeCell } from "@/project/store";
import { brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { commitReliefEdit } from "@/editor/reliefActions";
import { TILE } from "@/project/defaults";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { autotileEditTriggersGroup, autotileGroupLayer, autotileGroupLayerView, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
// Autotile groups: RM-style — painting a group body (e.g. dirt 421, dark wall 366)
// always reshapes edges/corners. Manual autoConnectMode does not suppress that.
import { resolveForestCanopyReplacementExemptTileIds } from "@/editor/tools/forestComposition";
import { repairTreePairsOnMap } from "@/project/lint/repairTreePairs";
import { clearTileStack } from "@/project/mapOverlayTiles";
import { isCombinedTownTileset, isTreeCanopyTileId, isTreeTrunkTileId } from "@/project/tilesetHarness";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import {
  describeHardClusterRejection,
  expandHardClusterPlacement,
  type HardClusterRejection,
  type HardClusterTileEdit,
} from "@/editor/tools/clusterRulePlacement";
import { toast } from "@/util/toast";
import type { AutotileGroup, Command, GameMap, MapId, PassFlag, Project, TilesetDef } from "@/project/types";
import { markUserTileRuntimeMetadata } from "./runtimeTileMetadata";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

/** 밑동 → 수관 (repairTreePairs 와 동일). 지우개 시 짝을 같이 지운다. */
const TRUNK_TO_CANOPY: Readonly<Record<number, number>> = {
  290: 260,
  291: 261,
  292: 262,
  293: 263,
};
const CANOPY_TO_TRUNK: Readonly<Record<number, number>> = {
  260: 290,
  261: 291,
  262: 292,
  263: 293,
};

type EraseStroke = { readonly layer: TileLayer; readonly x: number; readonly y: number };

type RoadPoint = { readonly x: number; readonly y: number };

export type TileLayer = "lower" | "upper";
export type TilePaintOptions = {
  readonly autoConnect?: boolean;
  /** Source stamps keep authored cells without terrain shaping or tree-pair repair. */
  readonly preservePattern?: boolean;
  /** false면 hard 클러스터 동반 타일 확장을 건너뛴다 — 스탬프처럼 "고른 그대로" 찍는 도구용. */
  readonly clusterExpand?: boolean;
  /**
   * 사람이 일부러 골라서 하는 **정확 배치 / 수리** (OPRN-OUT-017).
   *
   * 동반 타일을 강제하지 않고 고른 칸·레이어 하나만 쓴다. 스탬프의 `clusterExpand:false` 와
   * 달리 **안전망은 남는다** — 다른 덧그림 오브젝트나 보호셀을 조용히 덮어쓰지 않는다.
   * 스탬프·AI·구조물킷은 이 옵션을 쓰지 않으므로 그들의 기존 동작은 그대로다.
   */
  readonly exactPlacement?: boolean;
  /**
   * 거부를 토스트로만 말하는 대신 호출부가 받아 복구 경로(정확 배치 버튼)를 제시한다.
   * 넘기지 않으면 지금까지처럼 사유 토스트만 띄운다.
   */
  readonly onRejected?: (rejection: TilePaintRejection) => void;
};

/** 사람이 보는 배치 거부 — 규칙·동반 타일·좌표와 원래 누르려던 칸을 같이 들고 온다. */
export type TilePaintRejection = {
  readonly cluster?: HardClusterRejection;
  readonly layer: TileLayer;
  readonly reason: string;
  /** 사람이 고른 정확 배치가 가능한가 — 보호셀·다른 덧그림이면 그곳도 닫혀 있다. */
  readonly recoverable: boolean;
  readonly tile: number;
  readonly x: number;
  readonly y: number;
};
type LowerTileEdit = {
  readonly layer: TileLayer;
  readonly points: readonly RoadPoint[];
  readonly previousTile: number | undefined;
  readonly nextTile: number;
} & Required<Pick<TilePaintOptions, "autoConnect">>;
type PlannedTileEdit = HardClusterTileEdit;
type TilePaintPlan =
  | { readonly edits: readonly PlannedTileEdit[]; readonly ok: true }
  | { readonly cluster?: HardClusterRejection; readonly ok: false; readonly reason: string; readonly recoverable: boolean };

export type TileStrokeCell = {
  readonly layer: TileLayer;
  readonly x: number;
  readonly y: number;
  readonly tile: number;
};

export function paintTile(mapId: MapId, layer: TileLayer, x: number, y: number, tile: number, options: TilePaintOptions = {}): void {
  paintTilesBulk(mapId, [{ layer, x, y, tile }], options);
}

/**
 * 여러 칸을 **한 번의** map clone + emit + auto-save 스케줄로 칠한다.
 * 브러시/스탬프/도형 드래그가 셀마다 updateMap 하면 structuredClone·repairTree·리스너가 N배.
 */
export function paintTilesBulk(
  mapId: MapId,
  strokes: readonly TileStrokeCell[],
  options: TilePaintOptions = {},
): void {
  if (strokes.length === 0) return;
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  if (!currentMap) return;
  const tileset = current.tilesets[currentMap.tilesetId];
  const autoConnect = options.autoConnect ?? true;
  const exactPlacement = options.exactPlacement === true;
  // 정확 배치는 정의상 동반 확장을 하지 않는다 — 두 토글을 따로 넘겨 어긋나는 경우를 없앤다.
  const clusterExpand = !exactPlacement && options.clusterExpand !== false;

  const planned: PlannedTileEdit[] = [];
  let rejection: TilePaintRejection | null = null;
  for (const stroke of strokes) {
    const targetLayer = effectiveLayer(tileset, stroke.layer, stroke.tile);
    const plan = exactPlacement
      ? planExactPlacement(current, currentMap, targetLayer, stroke.x, stroke.y, stroke.tile)
      : !clusterExpand
        ? { ok: true as const, edits: inMap(currentMap, stroke.x, stroke.y) ? [{ layer: targetLayer, tile: stroke.tile, x: stroke.x, y: stroke.y }] : [] }
        : planManualClusterPaint(current, currentMap, tileset, targetLayer, stroke.x, stroke.y, stroke.tile);
    if (!plan.ok) {
      rejection = {
        layer: targetLayer,
        reason: plan.reason,
        recoverable: plan.recoverable,
        tile: stroke.tile,
        x: stroke.x,
        y: stroke.y,
        ...(plan.cluster ? { cluster: plan.cluster } : {}),
      };
      continue;
    }
    const previous = tileAt(currentMap, targetLayer, stroke.x, stroke.y);
    if (tileset && isCombinedTownTileset(tileset) && !exactPlacement
      && targetLayer === "upper" && previous !== undefined && isTreeCanopyTileId(previous)
      && !isTreeCanopyTileId(stroke.tile)) {
      // Replacing a canopy replaces its tree, just like erasing it. Otherwise
      // pair repair immediately restores the old canopy over the new prop.
      const removed = expandEraseCompanions(currentMap, tileset, [{ layer: targetLayer, x: stroke.x, y: stroke.y }], clusterExpand);
      const lower = new Set(removed.filter((cell) => cell.layer === "lower").map((cell) => `${cell.x},${cell.y}`));
      planned.push(...planEraseWrites(currentMap, tileset, removed, lower));
    }
    planned.push(...plan.edits);
  }
  if (planned.length === 0) {
    if (rejection) reportPaintRejection(rejection, options);
    return;
  }
  if (rejection && planned.length < strokes.length) {
    // 일부만 실패 — 성공분은 적용, 실패 사유는 알림
    reportPaintRejection(rejection, options);
  }

  // 같은 칸 중복: 나중 stroke 우선
  const byKey = new Map<string, PlannedTileEdit>();
  for (const edit of planned) {
    byKey.set(`${edit.layer}:${edit.x},${edit.y}`, edit);
  }
  // 하위 레이어 지형 붓질은 상위 레이어 데이터를 절대 건드리지 않는다.
  // hard 클러스터 확장이 upper companion 을 끼워 넣거나 repairTreePairs 가 수관을 덮어쓰는 경로를 차단.
  const lowerTerrainOnly = strokes.every((stroke) => stroke.layer === "lower" && isLowerTerrainTile(tileset, stroke.tile));
  const edits = lowerTerrainOnly
    ? [...byKey.values()].filter((edit) => edit.layer === "lower")
    : [...byKey.values()];
  if (edits.length === 0) return;

  // Pre-check: any lower stroke that paints/overwrites an autotile trigger must reshape
  // even when UI Manual is on (RM brush contract). Dirty-cell expansion follows.
  const shapeAutotile = !options.preservePattern
    && lowerEditsNeedAutotileShape(currentMap, tileset, edits, autoConnect);
  const lowerGroups = shapeAutotile ? autotileGroupsForTileset(tileset).filter(group=>autotileGroupLayer(group)==='lower'
    && edits.some(edit=>edit.layer==='lower'&&autotileEditTriggersGroup(group,tileAt(currentMap,'lower',edit.x,edit.y),edit.tile))) : [];
  // 바닥 위에 겹치는 투명 오토타일(울타리·주차선)은 상위 붓질에서 모양을 맞춘다.
  const upperGroups = options.preservePattern ? [] : upperAutotileGroupsTriggered(currentMap, tileset, edits);
  // 정확 배치는 나무 짝 보정도 지난다 — 안 그러면 y=0 밑동은 지워지고, 밑동 위 칸에는
  // 수관이 강제로 심겨 "고른 칸만 바꾼다"는 계약이 그 자리에서 깨진다(OPRN-OUT-017).
  const repairTrees = !options.preservePattern && !exactPlacement
    && !lowerTerrainOnly && editsNeedTreePairRepair(edits);

  store.updateMapTiles(mapId, (m) => {
    const lowerPoints: RoadPoint[] = [];
    for (const edit of edits) {
      setTileSafe(m, edit.layer, edit.x, edit.y, edit.tile);
      if (edit.layer === "lower") {
        lowerPoints.push({ x: edit.x, y: edit.y });
      }
    }
    if (lowerPoints.length > 0 && shapeAutotile) {
      for(const group of lowerGroups)shapeAutotileGroupAround(m,group,lowerPoints);
    }
    if (upperGroups.length > 0) {
      const upperPoints = edits.filter((edit) => edit.layer === "upper").map((edit) => ({ x: edit.x, y: edit.y }));
      for (const group of upperGroups) shapeAutotileGroupAround(autotileGroupLayerView(m, group), group, upperPoints);
    }
    if (repairTrees) {
      repairTreePairsOnMap(m, tileset, {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(current),
      });
    }
  }, { cells: changedTileCellsForPlannedEdits(mapId, edits, shapeAutotile || upperGroups.length > 0) });
}

/** 상위 레이어 편집이 건드리는(이전·다음 타일이 트리거인) 겹침 오토타일 그룹. */
function upperAutotileGroupsTriggered(
  map: GameMap,
  tileset: TilesetDef | undefined,
  edits: readonly PlannedTileEdit[],
): AutotileGroup[] {
  const upperEdits = edits.filter((edit) => edit.layer === "upper");
  if (upperEdits.length === 0) return [];
  return autotileGroupsForTileset(tileset).filter((group) => autotileGroupLayer(group) === "upper"
    && upperEdits.some((edit) => autotileEditTriggersGroup(group, tileAt(map, "upper", edit.x, edit.y), edit.tile)));
}

/**
 * 「높이」 붓 한 번 — map.relief 를 원형 붓으로 고친다. 모두 0 이 되면 필드를 지운다(평지 맵은 relief 없음).
 * 바뀐 칸이 없으면 store 를 건드리지 않는다(드래그 중 빈 통지·빈 되돌리기 방지).
 * 포인터 표본마다 불리므로 타일 붓과 같은 싼 경로(updateMapTiles)를 타고 `relief: true` 로 알린다 —
 * 구독자는 맵 전체 재렌더·패널 재조립 대신 절벽 그림만 다시 그린다.
 */
export function paintRelief(
  mapId: MapId,
  x: number,
  y: number,
  mode: ReliefBrushMode,
  opts: { radius?: number; level?: number; flattenTo?: number; topGrass?: boolean } = {},
): boolean {
  const map = store.getCurrent().maps[mapId];
  if (!map || !inMap(map, x, y)) return false;
  // 절벽은 칩셋과 무관하게 렌더러(@/project/relief/render)가 그림으로만 그린다. 타일 층은 「윗면 풀」일 때만 고친다(reliefActions).
  return commitReliefEdit(mapId, (relief) => brushRelief(relief, x, y, mode, opts), { topGrass: opts.topGrass ?? false, label: "높이 붓" });
}

export function toggleCollision(mapId: MapId, x: number, y: number): void {
  store.update((p) => {
    const m = p.maps[mapId];
    if (!m) return;
    if (!inMap(m, x, y)) return;
    const ts = p.tilesets[m.tilesetId];
    if (!ts) return;
    const i = y * m.width + x;
    const upperTile = m.upperTiles[i];
    const lowerTile = m.lowerTiles[i];
    const tileIdx = upperTile >= 0 ? upperTile : lowerTile;
    if (tileIdx < 0 || tileIdx >= ts.passability.length) return;
    const cur = ts.passability[tileIdx];
    const allOpen = cur.up && cur.down && cur.left && cur.right;
    const next: PassFlag = allOpen
      ? { up: false, down: false, left: false, right: false }
      : { up: true, down: true, left: true, right: true };
    ts.passability[tileIdx] = next;
    markUserTileRuntimeMetadata(ts, tileIdx, { passage: allOpen ? "solid" : "passable" });
  });
}

// 지우개 도구용 레이어 선택.
// - 상위 레이어: 상위만 지운다 (하위로 폴백하지 않음 — 상위 모드에서 바닥이 같이 지워지던 UX 방지).
// - 하위 레이어: 하위가 비어 있고 상위가 점유면 상위로 폴백 (하위 모드에서 보이는 장식 제거).
export function eraseVisibleTile(mapId: MapId, preferredLayer: TileLayer, x: number, y: number, options: TilePaintOptions = {}): void {
  eraseVisibleTilesBulk(mapId, preferredLayer, [{ x, y }], options);
}

export function eraseVisibleTilesBulk(
  mapId: MapId,
  preferredLayer: TileLayer,
  points: readonly RoadPoint[],
  options: TilePaintOptions = {},
): void {
  if (points.length === 0) return;
  const map = store.getCurrent().maps[mapId];
  if (!map) return;
  const strokes: EraseStroke[] = [];
  for (const point of points) {
    if (!inMap(map, point.x, point.y)) continue;
    const index = point.y * map.width + point.x;
    const occupied = (layer: TileLayer): boolean =>
      ((layer === "upper" ? map.upperTiles[index] : map.lowerTiles[index]) ?? TILE.EMPTY) !== TILE.EMPTY;
    let layer: TileLayer = preferredLayer;
    if (preferredLayer === "lower" && !occupied("lower") && occupied("upper")) {
      layer = "upper";
    }
    strokes.push({ layer, x: point.x, y: point.y });
  }
  eraseTilesBulk(mapId, strokes, options);
}

export function eraseTile(mapId: MapId, layer: TileLayer, x: number, y: number, options: TilePaintOptions = {}): void {
  eraseTilesBulk(mapId, [{ layer, x, y }], options);
}

export function eraseTilesBulk(
  mapId: MapId,
  strokes: readonly EraseStroke[],
  options: TilePaintOptions = {},
): void {
  if (strokes.length === 0) return;
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  if (!currentMap) return;
  const tileset = current.tilesets[currentMap.tilesetId];
  const autoConnect = options.autoConnect ?? true;
  const valid = strokes.filter((s) => inMap(currentMap, s.x, s.y));
  if (valid.length === 0) return;

  // 지우기 전에 나무 짝·hard 클러스터 동반 칸까지 확장 (안 하면 repairTreePairs가 수관을 복구)
  const expanded = expandEraseCompanions(currentMap, tileset, valid, options.clusterExpand !== false);

  const byKey = new Map<string, EraseStroke>();
  for (const s of expanded) byKey.set(`${s.layer}:${s.x},${s.y}`, s);
  const unique = [...byKey.values()];
  const erasingLower = new Set(
    unique.filter((stroke) => stroke.layer === "lower").map((stroke) => `${stroke.x},${stroke.y}`),
  );
  const writes = planEraseWrites(currentMap, tileset, unique, erasingLower);

  const eraseEdits: PlannedTileEdit[] = writes.map((write) => ({
    layer: write.layer,
    x: write.x,
    y: write.y,
    tile: write.tile,
  }));
  const shapeAutotile = lowerEditsNeedAutotileShape(currentMap, tileset, eraseEdits, autoConnect);
  const upperGroups = upperAutotileGroupsTriggered(currentMap,tileset,eraseEdits);

  store.updateMapTiles(mapId, (m) => {
    const lowerPoints: RoadPoint[] = [];
    let lowerPrevious: number | undefined;
    let lowerNext: number | undefined;
    for (const write of writes) {
      const previousTile = tileAt(m, write.layer, write.x, write.y);
      setTileSafe(m, write.layer, write.x, write.y, write.tile);
      if (write.layer === "lower") {
        lowerPoints.push({ x: write.x, y: write.y });
        if (lowerPrevious === undefined) lowerPrevious = previousTile;
        lowerNext = write.tile;
      }
    }
    if (lowerPoints.length > 0 && shapeAutotile) {
      shapeTerrainAfterLowerEdit(m, tileset, {
        autoConnect: true,
        layer: "lower",
        nextTile: lowerNext ?? TILE.EMPTY,
        points: lowerPoints,
        previousTile: lowerPrevious,
      });
    }
    for(const group of upperGroups)shapeAutotileGroupAround(autotileGroupLayerView(m,group),group,eraseEdits.filter(edit=>edit.layer==='upper'));
    // 의도적으로 짝을 지운 뒤에는 수관을 다시 심지 않도록, 남은 고아 밑동만 정리
    repairTreePairsOnMap(m, tileset, {
      canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(current),
    });
  }, {
    cells: writes.flatMap((write) => changedTileCellsForEdit(mapId, write.layer, [{ x: write.x, y: write.y }], shapeAutotile || upperGroups.length>0)),
  });
}

type EraseWrite = {
  readonly layer: TileLayer;
  readonly x: number;
  readonly y: number;
  readonly tile: number;
};

/**
 * 스프라이트(투명 칩·상위 전용 소품·나무 밑동)가 하위 슬롯을 차지한 채 EMPTY 로
 * 지워지면 에디터 체커/플레이 검정이 드러난다. 지형(잔디·물) 지우기는 구멍을
 * 남기고, 스프라이트 지우기는 주변 지면으로 되돌린다.
 */
function planEraseWrites(
  map: GameMap,
  tileset: TilesetDef | undefined,
  strokes: readonly EraseStroke[],
  erasingLower: ReadonlySet<string>,
): readonly EraseWrite[] {
  const writes: EraseWrite[] = strokes.map((stroke) => {
    const previous = tileAt(map, stroke.layer, stroke.x, stroke.y);
    const restoreGround = stroke.layer === "lower" && isSpriteOccupyingLower(tileset, previous);
    return {
      layer: stroke.layer,
      x: stroke.x,
      y: stroke.y,
      tile: restoreGround
        ? groundTileNear(map, tileset, stroke.x, stroke.y, erasingLower) ?? TILE.GRASS
        : TILE.EMPTY,
    };
  });
  const hasWrite = (layer: TileLayer, x: number, y: number): boolean =>
    writes.some((write) => write.layer === layer && write.x === x && write.y === y);
  for (const stroke of strokes) {
    if (stroke.layer !== "upper") continue;
    const previousUpper = tileAt(map, "upper", stroke.x, stroke.y);
    if (previousUpper === undefined || previousUpper === TILE.EMPTY || previousUpper < 0) continue;
    const lower = tileAt(map, "lower", stroke.x, stroke.y);
    if (lower !== undefined && lower !== TILE.EMPTY && lower >= 0) continue;
    if (hasWrite("lower", stroke.x, stroke.y)) continue;
    const ground = groundTileNear(map, tileset, stroke.x, stroke.y, erasingLower);
    if (ground === null) continue;
    writes.push({
      layer: "lower",
      x: stroke.x,
      y: stroke.y,
      tile: ground,
    });
  }
  return writes;
}

/** 하위 슬롯을 차지하면 안 되는 칩 — 밑동(하위 홈이지만 투명) + 상위 전용 소품. */
function isSpriteOccupyingLower(tileset: TilesetDef | undefined, tile: number | undefined): boolean {
  if (tile === undefined || tile < 0 || tile === TILE.EMPTY) return false;
  if (!tileset) return false;
  if (isCombinedTownTileset(tileset) && isTreeTrunkTileId(tile)) return true;
  return tileLayerHome(tileset, tile) === "upper";
}

function groundTileNear(
  map: GameMap,
  tileset: TilesetDef | undefined,
  x: number,
  y: number,
  skipLower: ReadonlySet<string>,
): number | null {
  const counts = new Map<number, number>();
  const consider = (tx: number, ty: number): void => {
    if (!inMap(map, tx, ty)) return;
    if (skipLower.has(`${tx},${ty}`)) return;
    const tile = map.lowerTiles[ty * map.width + tx];
    if (isSpriteOccupyingLower(tileset, tile)) return;
    if (tile === undefined || tile < 0 || tile === TILE.EMPTY) return;
    counts.set(tile, (counts.get(tile) ?? 0) + 1);
  };
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) consider(x + dx, y + dy);
  if (counts.size === 0) {
    for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) consider(x + dx, y + dy);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [tile, count] of counts) {
    if (count > bestCount) {
      best = tile;
      bestCount = count;
    }
  }
  return best;
}

/**
 * 지우개 동반 확장:
 * - hard 클러스터(침엽수 1×2, 활엽수 2×2, 벤치 등) 전체
 * - 나무 수관↔밑동 짝 (repairTreePairs 복구 방지)
 */
function expandEraseCompanions(
  map: GameMap,
  tileset: TilesetDef | undefined,
  strokes: readonly EraseStroke[],
  clusterExpand: boolean,
): EraseStroke[] {
  const town = tileset !== undefined && isCombinedTownTileset(tileset);
  const out = new Map<string, EraseStroke>();
  const add = (layer: TileLayer, x: number, y: number): void => {
    if (!inMap(map, x, y)) return;
    out.set(`${layer}:${x},${y}`, { layer, x, y });
  };

  for (const stroke of strokes) {
    add(stroke.layer, stroke.x, stroke.y);
    const tile = tileAt(map, stroke.layer, stroke.x, stroke.y);
    if (tile === undefined || tile === TILE.EMPTY || tile < 0) continue;

    // hard 클러스터 동반 칸
    if (clusterExpand && tileset) {
      const expanded = expandHardClusterPlacement({
        map,
        origin: { x: stroke.x, y: stroke.y },
        originLayer: stroke.layer,
        tile,
        tileset,
      });
      if (expanded.ok) {
        for (const edit of expanded.edits) {
          add(edit.layer, edit.x, edit.y);
          // 같은 좌표에 다른 레이어로 깔린 짝 타일도 비움
          const other: TileLayer = edit.layer === "upper" ? "lower" : "upper";
          const otherTile = tileAt(map, other, edit.x, edit.y);
          if (otherTile !== undefined && otherTile !== TILE.EMPTY && otherTile >= 0) {
            if (otherTile === edit.tile || (town && (isTreeTrunkTileId(otherTile) || isTreeCanopyTileId(otherTile)))) {
              add(other, edit.x, edit.y);
            }
          }
        }
      }
    }

    // Foreign authored hard groups above still apply; numeric tree pairs do not.
    if (!town) continue;
    // 나무 짝 명시 (클러스터 규칙이 한쪽만 있어도 복구 방지)
    if (isTreeCanopyTileId(tile) && stroke.layer === "upper") {
      const trunk = CANOPY_TO_TRUNK[tile];
      if (trunk !== undefined && stroke.y + 1 < map.height) {
        const belowLower = map.lowerTiles[(stroke.y + 1) * map.width + stroke.x] ?? TILE.EMPTY;
        const belowUpper = map.upperTiles[(stroke.y + 1) * map.width + stroke.x] ?? TILE.EMPTY;
        if (belowLower === trunk) add("lower", stroke.x, stroke.y + 1);
        if (belowUpper === trunk) add("upper", stroke.x, stroke.y + 1);
        // 활엽수 2×2: 옆 수관·옆 밑동
        if (tile === 262 || tile === 263) {
          const dx = tile === 262 ? 1 : -1;
          const nx = stroke.x + dx;
          if (inMap(map, nx, stroke.y)) {
            const sideCanopy = map.upperTiles[stroke.y * map.width + nx] ?? TILE.EMPTY;
            if (isTreeCanopyTileId(sideCanopy)) add("upper", nx, stroke.y);
            if (stroke.y + 1 < map.height) {
              const sideTrunkL = map.lowerTiles[(stroke.y + 1) * map.width + nx] ?? TILE.EMPTY;
              const sideTrunkU = map.upperTiles[(stroke.y + 1) * map.width + nx] ?? TILE.EMPTY;
              if (isTreeTrunkTileId(sideTrunkL)) add("lower", nx, stroke.y + 1);
              if (isTreeTrunkTileId(sideTrunkU)) add("upper", nx, stroke.y + 1);
            }
          }
        }
      }
    }
    if (isTreeTrunkTileId(tile)) {
      const canopy = TRUNK_TO_CANOPY[tile];
      if (canopy !== undefined && stroke.y > 0) {
        const above = map.upperTiles[(stroke.y - 1) * map.width + stroke.x] ?? TILE.EMPTY;
        if (above === canopy || isTreeCanopyTileId(above)) add("upper", stroke.x, stroke.y - 1);
        // 활엽수 2×2 옆 밑동
        if (tile === 292 || tile === 293) {
          const dx = tile === 292 ? 1 : -1;
          const nx = stroke.x + dx;
          if (inMap(map, nx, stroke.y)) {
            const sideL = map.lowerTiles[stroke.y * map.width + nx] ?? TILE.EMPTY;
            const sideU = map.upperTiles[stroke.y * map.width + nx] ?? TILE.EMPTY;
            if (isTreeTrunkTileId(sideL)) add("lower", nx, stroke.y);
            if (isTreeTrunkTileId(sideU)) add("upper", nx, stroke.y);
            if (stroke.y > 0) {
              const sideCanopy = map.upperTiles[(stroke.y - 1) * map.width + nx] ?? TILE.EMPTY;
              if (isTreeCanopyTileId(sideCanopy)) add("upper", nx, stroke.y - 1);
            }
          }
        }
      }
    }
  }

  return [...out.values()];
}

export function fillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number, options: TilePaintOptions = {}): void {
  const fillPlan = planFillTile(mapId, layer, x, y, newTile);
  const current = store.getCurrent();
  const currentMap = current.maps[mapId];
  const tileset = currentMap ? current.tilesets[currentMap.tilesetId] : undefined;
  const autoConnect = options.autoConnect ?? true;
  const prevAtStart =
    currentMap && fillPlan.points[0]
      ? tileAt(currentMap, fillPlan.layer, fillPlan.points[0]!.x, fillPlan.points[0]!.y)
      : undefined;
  const shapeAutotile =
    fillPlan.layer === "lower"
    && (
      autoConnect
      || editTriggersAnyAutotile(tileset, prevAtStart, newTile)
    );
  const upperGroups=fillPlan.layer==='upper'?autotileGroupsForTileset(tileset).filter(group=>autotileGroupLayer(group)==='upper'&&autotileEditTriggersGroup(group,prevAtStart,newTile)):[];
  store.updateMapTiles(mapId, (m) => {
    if (!inMap(m, x, y)) return;
    const targetLayer = effectiveLayer(tileset, layer, newTile);
    const targetArr = targetLayer === "lower" ? m.lowerTiles : m.upperTiles;
    const startIdx = y * m.width + x;
    const target = targetArr[startIdx];
    const queue = [startIdx];
    const seen = new Set<number>([startIdx]);
    const changedPoints: RoadPoint[] = [];
    for (let head = 0; head < queue.length; head += 1) {
      const idx = queue[head]!;
      const cx = idx % m.width;
      const cy = Math.floor(idx / m.width);
      setTileSafe(m, targetLayer, cx, cy, newTile);
      changedPoints.push({ x: cx, y: cy });
      const neighbors = [
        [cx - 1, cy],
        [cx + 1, cy],
        [cx, cy - 1],
        [cx, cy + 1],
      ] as const;
      for (const [nx, ny] of neighbors) {
        if (!inMap(m, nx, ny)) continue;
        const ni = ny * m.width + nx;
        if (seen.has(ni)) continue;
        if (targetArr[ni] !== target) continue;
        seen.add(ni);
        queue.push(ni);
      }
    }
    shapeTerrainAfterLowerEdit(m, tileset, {
      layer: targetLayer,
      points: changedPoints,
      previousTile: target,
      nextTile: newTile,
      autoConnect: shapeAutotile,
    });
    for(const group of upperGroups)shapeAutotileGroupAround(autotileGroupLayerView(m,group),group,changedPoints);
    // 하위 지형 채우기는 상위(수관 등)를 재작성하지 않는다.
    if (targetLayer === "upper" || !isLowerTerrainTile(tileset, newTile)) {
      repairTreePairsOnMap(m, tileset, {
        canopyReplacementExemptTileIds: resolveForestCanopyReplacementExemptTileIds(current),
      });
    }
  }, {
    cells: changedTileCellsForEdit(mapId, fillPlan.layer, fillPlan.points, shapeAutotile || upperGroups.length>0),
  });
}

function planFillTile(mapId: MapId, layer: TileLayer, x: number, y: number, newTile: number): { readonly layer: TileLayer; readonly points: readonly RoadPoint[] } {
  const project = store.getCurrent();
  const map = project.maps[mapId];
  if (!map || !inMap(map, x, y)) return { layer, points: [] };
  const targetLayer = effectiveLayer(project.tilesets[map.tilesetId], layer, newTile);
  const targetArr = targetLayer === "lower" ? map.lowerTiles : map.upperTiles;
  const startIdx = y * map.width + x;
  const target = targetArr[startIdx];
  const queue = [startIdx];
  const seen = new Set<number>([startIdx]);
  const points: RoadPoint[] = [];
  for (let head = 0; head < queue.length; head += 1) {
    const idx = queue[head]!;
    const cx = idx % map.width;
    const cy = Math.floor(idx / map.width);
    points.push({ x: cx, y: cy });
    const neighbors = [
      [cx - 1, cy],
      [cx + 1, cy],
      [cx, cy - 1],
      [cx, cy + 1],
    ] as const;
    for (const [nx, ny] of neighbors) {
      if (!inMap(map, nx, ny)) continue;
      const ni = ny * map.width + nx;
      if (seen.has(ni)) continue;
      if (targetArr[ni] !== target) continue;
      seen.add(ni);
      queue.push(ni);
    }
  }
  return { layer: targetLayer, points };
}

function changedTileCellsForEdit(mapId: MapId, layer: TileLayer, points: readonly RoadPoint[], autoConnect: boolean): readonly ProjectChangeCell[] {
  const map = store.getCurrent().maps[mapId];
  const cells = new Map<string, ProjectChangeCell>();
  const add = (x: number, y: number): void => {
    if (map && !inMap(map, x, y)) return;
    cells.set(`${layer}:${x},${y}`, { x, y, layer });
  };
  for (const point of points) {
    add(point.x, point.y);
    if (layer !== "lower" || !autoConnect) continue;
    add(point.x, point.y - 1);
    add(point.x, point.y + 1);
    add(point.x - 1, point.y);
    add(point.x + 1, point.y);
  }
  return [...cells.values()];
}

function changedTileCellsForPlannedEdits(mapId: MapId, edits: readonly PlannedTileEdit[], autoConnect: boolean): readonly ProjectChangeCell[] {
  const cells = new Map<string, ProjectChangeCell>();
  for (const edit of edits) {
    for (const cell of changedTileCellsForEdit(mapId, edit.layer, [{ x: edit.x, y: edit.y }], autoConnect)) {
      cells.set(`${cell.layer}:${cell.x},${cell.y}`, cell);
    }
  }
  return [...cells.values()];
}

function planManualClusterPaint(
  project: Project,
  map: GameMap,
  tileset: TilesetDef | undefined,
  layer: TileLayer,
  x: number,
  y: number,
  tile: number
): TilePaintPlan {
  if (!inMap(map, x, y)) return { ok: true, edits: [] };
  if (!tileset) return { ok: true, edits: [{ layer, tile, x, y }] };
  const expansion = expandHardClusterPlacement({
    map,
    origin: { x, y },
    originLayer: layer,
    tile,
    tileset,
  });
  if (!expansion.ok) return clusterRejected(project, map, layer, x, y, tile, expansion.rejection, expansion.reason);
  if (expansion.autoTiles === 0) return { ok: true, edits: expansion.edits };
  const protectedExpansion = expandHardClusterPlacement({
    blocked: protectedClusterCells(project, map),
    map,
    origin: { x, y },
    originLayer: layer,
    tile,
    tileset,
  });
  if (!protectedExpansion.ok) {
    return clusterRejected(project, map, layer, x, y, tile, protectedExpansion.rejection, protectedExpansion.reason);
  }
  return { ok: true, edits: protectedExpansion.edits };
}

/**
 * 보조 배치가 거부됐을 때의 계획 결과. 사유는 규칙·동반 타일·좌표를 다 말하고,
 * 그 자리에 **정확 배치**가 가능한지를 같은 안전망으로 미리 계산해 붙인다 — 누를 수 없는
 * 복구 버튼을 보여 주는 것은 또 다른 막다른 길이다.
 */
function clusterRejected(
  project: Project,
  map: GameMap,
  layer: TileLayer,
  x: number,
  y: number,
  tile: number,
  cluster: HardClusterRejection | undefined,
  fallbackReason: string | undefined
): TilePaintPlan {
  const exact = planExactPlacement(project, map, layer, x, y, tile);
  return {
    ok: false,
    reason: cluster ? describeHardClusterRejection(cluster) : fallbackReason ?? "동반 타일 배치 불가",
    recoverable: exact.ok && exact.edits.length > 0,
    ...(cluster ? { cluster } : {}),
  };
}

/**
 * 거부를 사람에게 돌려준다. 호출부가 복구 경로를 붙일 수 있으면(`onRejected`) 그쪽이 UI 를
 * 소유하고, 아니면 예전처럼 사유 토스트만 띄운다. 조용한 무동작은 이제 어느 쪽에서도 없다.
 */
function reportPaintRejection(rejection: TilePaintRejection, options: TilePaintOptions): void {
  if (options.onRejected) {
    options.onRejected(rejection);
    return;
  }
  if (typeof document === "undefined") return;
  toast(`클러스터 규칙 때문에 배치할 수 없습니다: ${rejection.reason}`, "error");
}

/**
 * 정확 배치 계획 — 고른 칸·레이어 하나만. 동반 타일을 만들지 않으므로 hard 규칙 위반이
 * 남을 수 있고, 그건 lint(`cluster-rule:adjacency:<group>`) 가 규칙·좌표와 함께 계속 보여 준다.
 * 대신 두 가지는 정확 배치에서도 절대 암묵적으로 깨지지 않는다.
 *   1. 보호셀(시작 지점·이벤트·장소이동 대상)은 덮지 않는다.
 *   2. 다른 덧그림 오브젝트(지붕·수관 등)를 조용히 치우지 않는다.
 * 둘 다 거부되면 복구 불가(`recoverable:false`) — 사용자가 먼저 그 칸을 치워야 한다.
 */
function planExactPlacement(
  project: Project,
  map: GameMap,
  layer: TileLayer,
  x: number,
  y: number,
  tile: number
): TilePaintPlan {
  if (!inMap(map, x, y)) return { ok: true, edits: [] };
  if (computeProtectedClusterCells(project, map).has(coordKey(x, y))) {
    return {
      ok: false,
      reason: `(${x},${y})는 보호셀입니다 — 시작 지점·이벤트·장소이동 대상은 정확 배치로도 덮지 않습니다`,
      recoverable: false,
    };
  }
  if (layer === "upper" && tile !== TILE.EMPTY) {
    const existing = tileAt(map, "upper", x, y) ?? TILE.EMPTY;
    if (existing !== TILE.EMPTY && existing >= 0 && existing !== tile) {
      return {
        ok: false,
        reason: `(${x},${y})의 상위에 다른 오브젝트(${existing})가 있습니다 — 먼저 지우고 배치하세요`,
        recoverable: false,
      };
    }
  }
  return { ok: true, edits: [{ layer, tile, x, y }] };
}

// 보호 셀 집합은 이벤트/시작점에서만 유도되고 타일 값과 무관하다. 페인트 드래그는 셀마다
// 이 함수를 타므로, 전 맵 이벤트 순회를 매 셀 반복하지 않도록 캐시한다.
// 무효화: 타일 전용 변경(scope map + cells)이 아닌 모든 store 변경.
let protectedCellsCache: { readonly mapId: MapId; readonly cells: ReadonlySet<string> } | null = null;
let protectedCellsInvalidatorInstalled = false;

function installProtectedCellsInvalidator(): void {
  if (protectedCellsInvalidatorInstalled) return;
  protectedCellsInvalidatorInstalled = true;
  store.subscribe((_project, change) => {
    if (change.scope === "map" && (change.cells?.length || change.relief)) return;
    protectedCellsCache = null;
  });
}

function protectedClusterCells(project: Project, map: GameMap): ReadonlySet<string> {
  installProtectedCellsInvalidator();
  if (protectedCellsCache?.mapId === map.id) return protectedCellsCache.cells;
  const blocked = computeProtectedClusterCells(project, map);
  protectedCellsCache = { cells: blocked, mapId: map.id };
  return blocked;
}

/**
 * 캐시를 **읽지도 쓰지도 않는** 보호셀 계산. 정확 배치는 페인트 드래그처럼 셀마다 돌지 않고
 * (한 칸씩 의도적으로 누르는 행동), 거부 시 복구 가능 여부를 미리 볼 때도 쓴다. 그 미리보기가
 * 캐시를 채우면 이후의 실제 배치가 **오래된 보호셀 집합**을 보게 된다 —
 * 실측: 캐시를 태우자 직접 map.events 를 밀어 넣은 회귀 테스트에서 보호셀 거부가 사라졌다.
 */
function computeProtectedClusterCells(project: Project, map: GameMap): ReadonlySet<string> {
  const blocked = new Set<string>();
  if (project.startMapId === map.id) blocked.add(coordKey(project.startPos.x, project.startPos.y));
  for (const event of map.events) {
    blocked.add(coordKey(event.x, event.y));
    collectTransferTargets(event.commands, map.id, blocked);
    for (const page of event.pages ?? []) collectTransferTargets(page.commands, map.id, blocked);
  }
  for (const sourceMap of Object.values(project.maps)) {
    if (sourceMap.id === map.id) continue;
    for (const event of sourceMap.events) {
      collectTransferTargets(event.commands, map.id, blocked);
      for (const page of event.pages ?? []) collectTransferTargets(page.commands, map.id, blocked);
    }
  }
  for (const commonEvent of project.commonEvents) collectTransferTargets(commonEvent.commands, map.id, blocked);
  return blocked;
}

function collectTransferTargets(commands: readonly Command[], mapId: string, blocked: Set<string>): void {
  for (const command of commands) {
    switch (command.kind) {
      case "transfer":
        if (command.mapId === mapId) blocked.add(coordKey(command.x, command.y));
        break;
      case "choices":
        for (const option of command.options) collectTransferTargets(option.branch, mapId, blocked);
        collectTransferTargets(command.cancelBranch ?? [], mapId, blocked);
        break;
      case "presentItem":
        for (const branch of presentItemBranchLists(command)) collectTransferTargets(branch, mapId, blocked);
        break;
      case "fork":
        collectTransferTargets(command.then, mapId, blocked);
        collectTransferTargets(command.else ?? [], mapId, blocked);
        break;
      case "loop":
        collectTransferTargets(command.body, mapId, blocked);
        break;
      default:
        break;
    }
  }
}


/** 하위 레이어 지형 타일 — 나무/상위 전용 소품 제외. */
function isLowerTerrainTile(tileset: TilesetDef | undefined, tile: number): boolean {
  if (tile === TILE.EMPTY || tile < 0) return true;
  if (isTreeTrunkTileId(tile) || isTreeCanopyTileId(tile)) return false;
  if (!tileset) return true;
  const home = tileLayerHome(tileset, tile);
  return home === "lower" || home === "both";
}

/** 나무 수관 보정이 필요한 편집인지 — 상위/나무 타일 쓰기일 때만 true. */
function editsNeedTreePairRepair(edits: readonly PlannedTileEdit[]): boolean {
  return edits.some((edit) =>
    edit.layer === "upper"
    || isTreeTrunkTileId(edit.tile)
    || isTreeCanopyTileId(edit.tile)
  );
}

function effectiveLayer(tileset: TilesetDef | undefined, requestedLayer: TileLayer, tile: number): TileLayer {
  if (!tileset) return requestedLayer;
  // RM2K3식 엄격 분류: 타일의 홈 레이어(하네스 그룹 → priority)가 단일 판정되면
  // 요청 레이어와 무관하게 그 레이어에 놓는다. mixed 그룹/미분류 타일셋만 요청을 따른다.
  // stackable 소품(울타리 등)은 tileLayerHome이 상위로 판정해 아래 지면을 보존한다
  // (upper가 solid면 collision 합성에서 그대로 통행을 막으므로 차단도 유지된다).
  const home = tileLayerHome(tileset, tile);
  return home === "both" ? requestedLayer : home;
}

function inMap(m: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < m.width && y < m.height;
}

function setTileSafe(m: GameMap, layer: TileLayer, x: number, y: number, tile: number): void {
  if (!inMap(m, x, y)) return;
  const i = y * m.width + x;
  clearTileStack(m, layer, i);
  if (layer === "lower") {
    m.lowerTiles[i] = tile;
  } else {
    m.upperTiles[i] = tile;
  }
}

function tileAt(m: GameMap, layer: TileLayer, x: number, y: number): number | undefined {
  if (!inMap(m, x, y)) return undefined;
  const i = y * m.width + x;
  return layer === "lower" ? m.lowerTiles[i] : m.upperTiles[i];
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

// lower 레이어 편집 후 오토타일 그룹(타일셋 정의 또는 내장 기본값)을 재계산한다.
function shapeTerrainAfterLowerEdit(m: GameMap, tileset: TilesetDef | undefined, edit: LowerTileEdit): void {
  if (!edit.autoConnect) return;
  if (edit.layer !== "lower") return;
  const groups: readonly AutotileGroup[] = autotileGroupsForTileset(tileset).filter((group) => autotileGroupLayer(group) === "lower");
  for (const group of groups) {
    if (autotileEditTriggersGroup(group, edit.previousTile, edit.nextTile)) {
      shapeAutotileGroupAround(m, group, edit.points);
    }
  }
}

/** True when previous or next tile is an autotile group trigger/member. */
function editTriggersAnyAutotile(
  tileset: TilesetDef | undefined,
  previousTile: number | undefined,
  nextTile: number,
): boolean {
  for (const group of autotileGroupsForTileset(tileset)) {
    if (autotileEditTriggersGroup(group, previousTile, nextTile)) return true;
  }
  return false;
}

/**
 * RM-style: painting/erasing an autotile brush (dirt body, sand, interior dark wall 366…)
 * always reshapes, even if the palette Auto/Manual toggle is Manual.
 * Manual only skips reshape for non-autotile strokes (exact single-tile placement).
 */
function lowerEditsNeedAutotileShape(
  map: GameMap,
  tileset: TilesetDef | undefined,
  edits: readonly PlannedTileEdit[],
  autoConnectRequested: boolean,
): boolean {
  if (autoConnectRequested) return true;
  for (const edit of edits) {
    if (edit.layer !== "lower") continue;
    const previous = tileAt(map, "lower", edit.x, edit.y);
    if (editTriggersAnyAutotile(tileset, previous, edit.tile)) return true;
  }
  return false;
}
