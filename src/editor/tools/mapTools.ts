import { isMapLoop, mapLoopLabel, mapLoopsX, mapLoopsY, MAP_LOOP_VALUES } from "@/project/mapLoop";
import { ensureDocumentedTileset } from "@/project/defaults/dungeonSheetTilesets";
import { isCombinedTownCompatibleTileset } from "@/project/tilesetHarness";
import { defaultOutdoorTilesetId } from "@/project/defaults/forestHarmony";
import { validateMapClimateInput } from "./combatAuthoringValidation";
import { mapClimateSchema } from "./combatAuthoringSchemas";
import { normalizeMapClimate } from "@/project/mapClimate";
// editor/tools/mapTools.ts
// 맵 생성/타일 페인팅/도로/구조물/시작위치 쓰기 툴.

import { isPassable } from "@/project/collision";
import { normalizeCloudShadowParams } from "@/player/cloudShadows";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { exceedsMapDimensionLimit, MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { DIRT_ROAD_TILE, SAND_TILE } from "@/project/defaults/chipsetMapping";
import { autotileGroupsForTileset, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { autotileLayerView, shapeAutotileGroupAround } from "@/project/defaults/autotileEngine";
import { applyMapDeletion, planMapDeletion } from "@/project/mapDeletion";
import { collectMapLinkStats } from "@/project/mapLinkStats";
import { reachableMapIdsFromStart } from "@/project/mapInspection";
import { cloneGameMap } from "@/project/mapClone";
import {
  appendToTree,
  canReparentMap,
  dissolveFolderKeepChildren,
  extractTreeNode,
  findParentMapId,
  findTreeNode,
  insertTreeNode,
  isMapTreeFolder,
  siblingIndex,
} from "@/project/mapTree";
import { markUserTileRuntimeMetadata } from "@/editor/runtimeTileMetadata";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { stampRectHouseKit } from "@/editor/houseKit";
import { resizedTileStacks } from "@/project/mapOverlayTiles";
import { EXTRA_LAYER_KEYS, compactMapLayers, cropExtraLayers, layerTileAt, setLayerTileAt, setShadowAt, shadowAt, type TileLayerNo } from "@/project/mapLayers";
import { stampTownCityPlot, type TownCityPlotStyle } from "@/project/defaults/townHousePatterns";
import { kitIdForSmallHouseMaterial, type SmallHouseMaterial } from "@/editor/content/dbExtractedHouseTemplate";
import { recommendMapBgm } from "@/assets/bgmThemeRecommendation";
import { genId } from "@/util/id";
import { resolveWikiCombatMode } from "@/ai/projectWikiContext";
import { MAP_BACKGROUND_SCROLL_LIMIT, normalizeMapBackground } from "@/project/mapBackground";
import { isActionCombatMap } from "@/project/actionCombat";
import type { EncounterTableEntry, FieldSpawnDef, GameEvent, GameMap, PaletteSlotRole, Project, Rect, RoguelikeRoomDef, TilesetDef } from "@/project/types";
import { mapLocations, resolveLocation } from "@/project/mapNamedLocations";
import { applyMapShift } from "@/editor/mapShiftActions";
import { visitProjectCommands } from "./commandTraversal";
import {
  FOUR_LAYER_GUIDANCE,
  MAP_ID_TAKEN_GUIDANCE,
  TOOL_LAYER_ENUM,
  assertMapIdAvailable,
  floodFillCells,
  inMapBounds,
  lineCells,
  parseToolLayer,
  passabilityWarning,
  requireMap,
  setLower,
  toolLayerLabel,
  type Point,
} from "./mapHelpers";
import { expandHardClusterPlacement, type HardClusterTileEdit } from "./clusterRulePlacement";
import { jitterPlacement, wobblePath } from "./naturalScatter";
import { jitterMaxOffset, naturalnessArg, naturalnessLabel, NATURALNESS_GUIDANCE, rngForTool } from "./naturalToolArgs";
import { paletteTilePickerForTool, type PaletteTilePicker } from "./paletteToolArgs";
import {
  filterRoadWidthCells,
  paintRoadGround,
  repairRoadPath,
  roadGapFailure,
  roadObstacleMaskFor,
  roadRepairWarnings,
  withWidthCells,
} from "./roadObstacles";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";
import { isSeason, isTimePhase, SEASONS, TIME_PHASES } from "@/project/gameTime";
import { COORD_SCHEMA, RECT_SCHEMA } from "./schemaShapes";
import { resolveEventPlacement } from "./eventTools";
import { expandCellsAgainstWalls } from "./wallFlush";
import { assertHousePlacement, protectedHouseCells, registerCompletedHouse } from "./houseProtection";

// 맵 테두리를 벽으로 두른다.
function borderWalls(map: GameMap): void {
  for (let x = 0; x < map.width; x += 1) {
    setLower(map, x, 0, TILE.WALL);
    setLower(map, x, map.height - 1, TILE.WALL);
  }
  for (let y = 0; y < map.height; y += 1) {
    setLower(map, 0, y, TILE.WALL);
    setLower(map, map.width - 1, y, TILE.WALL);
  }
}

// 시작 맵이 유효하지 않으면 이 맵을 시작 맵으로 채택하고 통행 가능한 시작점을 잡는다.
function adoptStartIfNeeded(project: Project, map: GameMap): void {
  if (project.maps[project.startMapId]) return;
  project.startMapId = map.id;
  const cx = Math.floor(map.width / 2);
  const cy = Math.floor(map.height / 2);
  project.startPos = { x: cx, y: cy };
}

function assertToolMapSize(width: number, height: number): void {
  if (exceedsMapDimensionLimit(width, height)) {
    throw new ToolError(mapSizeLimitMessage(), { code: "map-too-large" });
  }
}

function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function seedFromMapId(mapId: string): number {
  const normalized = fnv1a32(`map-bgm:${mapId}`);
  return normalized === 0 ? 1 : normalized;
}

function usedBgmResourceIds(draft: Project, excludeMapId: string): string[] {
  const used: string[] = [];
  for (const map of Object.values(draft.maps)) {
    if (map.id === excludeMapId || map.bgm?.mode !== "custom") continue;
    const resourceId = map.bgm.resourceId;
    if (typeof resourceId === "string" && resourceId.length > 0) used.push(resourceId);
  }
  return used;
}

 // @/util/rng mulberry32 maps 0→1, so raw seed 0 and 1 pick the same BGM.
 // Hash the decimal seed with a BGM namespace *before* that collapse so 0 vs 1 differ.
 // Tile RNG in generate_map stays on its own mulberry32 and is not mixed here.
 function namespacedBgmSeed(seed: number): number {
   const mixed = fnv1a32(`${seed}:map-bgm`);
   return mixed === 0 ? 1 : mixed;
 }

export function assignCreatedMapBgm(
  map: GameMap,
  args: Record<string, unknown>,
  options?: { readonly themeOrName?: string; readonly fallbackTheme?: string; readonly draft?: Project },
): string {
  const explicitBgm = args.bgm;
  if (explicitBgm && typeof explicitBgm === "object" && !Array.isArray(explicitBgm)) {
    const raw = explicitBgm as Record<string, unknown>;
    if (raw.mode !== "parent" && raw.mode !== "none" && raw.mode !== "custom") {
      throw new ToolError("bgm.mode는 parent, none, custom 중 하나여야 합니다.", { code: "invalid-args", mapId: map.id });
    }
    const bgm = structuredClone(explicitBgm) as NonNullable<GameMap["bgm"]>;
    if (bgm.mode === "custom") {
      const resourceId = typeof bgm.resourceId === "string" ? bgm.resourceId.trim() : "";
      if (!resourceId) {
        throw new ToolError("bgm.mode가 custom이면 resourceId가 필요합니다.", { code: "invalid-args", mapId: map.id });
      }
      bgm.resourceId = resourceId;
    }
    map.bgm = bgm;
    return bgm.mode === "custom" ? (bgm.resourceId ?? bgm.mode) : bgm.mode;
  }
  const explicitId = typeof args.bgmResourceId === "string" ? args.bgmResourceId.trim() : "";
  if (explicitId) {
    map.bgm = { mode: "custom", resourceId: explicitId };
    return explicitId;
  }
  const themeOrName = options?.themeOrName ?? map.name;
  const seed = typeof args.seed === "number" && Number.isInteger(args.seed)
    ? namespacedBgmSeed(args.seed)
    : seedFromMapId(map.id);
  const excludeIds = options?.draft !== undefined ? usedBgmResourceIds(options.draft, map.id) : undefined;
  const resourceId = recommendMapBgm(themeOrName, seed, excludeIds, {
    descriptions: options?.draft?.audioDescriptions?.music,
    fallbackTheme: options?.fallbackTheme,
  });
  map.bgm = { mode: "custom", resourceId };
  return resourceId;
}

const createMap: ToolDefinition = {
  name: "create_map",
  // border 는 모델 스키마에서 뺐다(2026-09-11). 실측: 스키마에 enum 이 있으면 조수가 동굴·던전·지하실
  // 요청마다 스스로 border:"wall" 을 골라 맵 4변을 돌벽으로 둘렀고(대화 62건 중 7건, 전부 그런 맵),
  // 설명을 "명시 요청 때만" 으로 바꿔도 선택은 그대로였다(3/3). 스키마에서 감추면 0/3.
  // 맵 밖은 이미 엔진이 통행 불가라(project/collision.ts canMove 의 inBounds) 테두리 벽은 화면 장식일 뿐이고,
  // 작은 맵에서는 면적만 먹는다(12×10 지하실 = 120칸 중 40칸). 런타임 호출 호환은 남긴다 — 과거 대화
  description: `새 맵을 생성한다(테두리 없는 잔디 평지, 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}). 시작 맵이 없으면 이 맵을 시작 맵으로 채택한다. BGM은 맵 이름을 각 곡의 제목·태그·기획 설명·청취 설명과 대조해 고른다(seed 생략 시 맵 id에서 유도 + 이미 쓴 곡 회피, bgm/bgmResourceId가 있으면 그걸 쓴다). 실내 시설·방을 만들라는 요청에서 빈 맵만 만들고 끝내지 말 것 — 실내는 place_concept 또는 start_interior_room_session 이 새 mapId 까지 함께 시공한다.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "맵 이름" },
      width: { type: "integer", description: `가로 타일 수(3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION})` },
      height: { type: "integer", description: `세로 타일 수(3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION})` },
      id: { type: "string", description: "맵 id(생략 시 자동 생성)" },
      // border 는 여기 없다 — 위 주석 참조. run() 은 인자를 계속 받는다(런타임 호환).
      seed: { type: "integer", description: "명시 BGM 선택 시드(생략 시 맵 id에서 유도, 이미 쓴 곡 회피)" },
      bgmResourceId: { type: "string", description: "맵 BGM 리소스 id. 있으면 자동 선택을 건너뛴다." },
      tilesetId: { type: "string", description: "타일셋 id(생략 시 숲마을 · 거리별 잔디. 실내·던전은 해당 칩셋을 명시). 프로젝트에 있는 타일셋만." },
      bgm: {
        type: "object",
        description: "명시적 BGM 설정. 있으면 자동 선택을 건너뛴다.",
        properties: {
          mode: { type: "string", enum: ["parent", "none", "custom"] },
          resourceId: { type: "string" },
          fadeInMs: { type: "integer" },
        },
      },
    },
    required: ["name", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const width = args.width as number;
    const height = args.height as number;
    if (width < 3 || height < 3) throw new ToolError("맵 크기는 최소 3x3 이상이어야 합니다.");
    assertToolMapSize(width, height);
    const id = (args.id as string | undefined) ?? genId("map");
    assertMapIdAvailable(draft, id);
    const name = args.name as string;
    // 같은 이름의 빈 맵이 이미 있으면 새 맵은 고아가 되기 쉽다(2026-09-23 등대지기 재시험: 「서리불꽃 등대 꼭대기」 두 장).
    const blankNamesake = Object.values(draft.maps).find(other =>
      other.name.trim() === String(name ?? "").trim() && other.events.length === 0 && !other.roomHarnessPlan);
    const size = width * height;
    const tilesetId = typeof args.tilesetId === "string" && args.tilesetId.trim().length > 0 ? args.tilesetId.trim() : defaultOutdoorTilesetId(draft);
    // Tilesets the place documents name (oprn_dungeon_*) are made on first use.
    ensureDocumentedTileset(draft, tilesetId);
    const tileset = draft.tilesets[tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { code: "tileset-not-found" });
    const map: GameMap = {
      id,
      name,
      width,
      height,
      tilesetId,
      // 맵의 좌표 단위는 **고른 타일셋**에서 온다. 16 을 박으면 32px 타일셋을 고른 순간
      // 맵만 16 으로 남아 렌더·히트테스트가 반 칸씩 어긋난다(set_map_properties 는 이미
      // 타일셋 크기를 따라가므로, 생성 경로만 규칙에서 빠져 있었다).
      tileSize: tileset.tileSize,
      lowerTiles: new Array<number>(size).fill(isCombinedTownCompatibleTileset(tileset) ? TILE.GRASS : TILE.EMPTY),
      upperTiles: new Array<number>(size).fill(TILE.EMPTY),
      events: [],
    };
    const borderArg = args.border;
    if (borderArg !== undefined && borderArg !== "none" && borderArg !== "wall") {
      throw new ToolError("border는 none, wall 중 하나여야 합니다.", { code: "invalid-args" });
    }
    const border = (borderArg as "none" | "wall" | undefined) ?? "none";
    if (border === "wall") borderWalls(map);
    const bgmResourceId = assignCreatedMapBgm(map, args, { draft });
    draft.maps[id] = map;
    // mapTree.mapId가 유효하지 않으면(빈 프로젝트) 이 맵을 트리 루트로 채택, 아니면 자식으로 추가.
    if (!draft.maps[draft.mapTree.mapId]) {
      draft.mapTree = { mapId: id, children: [] };
    } else if (draft.mapTree.mapId !== id && !draft.mapTree.children.some((child) => child.mapId === id)) {
      draft.mapTree.children.push({ mapId: id, children: [] });
    }
    adoptStartIfNeeded(draft, map);
    const warnings = blankNamesake
      ? [`같은 이름 '${name}' 의 빈 맵 ${blankNamesake.id}(${blankNamesake.width}×${blankNamesake.height}, 이벤트 0)가 이미 있습니다 — `
        + `같은 장소라면 새 맵 대신 그 mapId 를 쓰세요(run_dungeon_room_pipeline 등 방 파이프라인은 빈 맵을 그대로 이어받습니다).`]
      : [];
    return {
      summary: `맵 '${map.name}' (${width}x${height}) 생성 — id ${id}, BGM ${bgmResourceId}`,
      data: { mapId: id, bgmResourceId },
      ...(warnings.length > 0 ? { warnings } : {}),
    };
  },
};

const duplicateMap: ToolDefinition = {
  name: "duplicate_map",
  description: "맵 전체(타일·이벤트·BGM·배경·미니맵 설정)를 복제하고 원본 바로 뒤에 배치한다. 새 map id는 명시해야 한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      id: { type: "string", description: "새 맵 id" },
      name: { type: "string", description: "새 맵 이름(생략 시 '<원본> 복사')" },
    },
    required: ["mapId", "id"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const source = requireMap(draft, args.mapId as string);
    const id = args.id as string;
    if (draft.maps[id] || findTreeNode(draft.mapTree, id)) {
      throw new ToolError(`이미 사용 중인 맵/폴더 id입니다: ${id} — ${MAP_ID_TAKEN_GUIDANCE}`, { code: "map-exists", mapId: id });
    }
    const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : `${source.name} 복사`;
    const usedEventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.flatMap((event) => [event.id, ...(event.pages ?? []).map((page) => page.id)])));
    const nextEventId = (): string => {
      let candidate = genId("ev");
      while (usedEventIds.has(candidate)) candidate = genId("ev");
      usedEventIds.add(candidate);
      return candidate;
    };
    const copy = cloneGameMap(source, { newId: id, newName: name, nextEventId });
    draft.maps[id] = copy;
    const parentId = findParentMapId(draft.mapTree, source.id);
    const sourceIndex = siblingIndex(draft.mapTree, source.id);
    if (!insertTreeNode(draft.mapTree, { mapId: id, children: [] }, parentId ?? "", sourceIndex >= 0 ? sourceIndex + 1 : undefined)) {
      appendToTree(draft.mapTree, id);
    }
    return { summary: `맵 '${source.name}' 복제 → '${name}' (${id})`, data: { mapId: id } };
  },
};

const manageMapTree: ToolDefinition = {
  name: "manage_map_tree",
  description: "맵 트리의 분류 폴더를 생성·이름 변경·해제하거나 맵/폴더를 다른 분류로 이동한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      operation: { type: "string", enum: ["create_folder", "rename_folder", "dissolve_folder", "move"] },
      folderId: { type: "string" },
      mapId: { type: "string", description: "move 대상 맵 또는 폴더 id" },
      // 빈 문자열은 프로젝트 루트가 아니라 트리 최상위 맵의 자식이다 — 편집기 대화창과 같은
      // 낱말을 쓴다(OPRN-OUT-027). 조수가 「루트」를 형제 최상위로 읽으면 안 된다.
      parentId: { type: "string", description: "상위 맵/분류 id. 빈 문자열이면 트리 최상위 맵의 하위" },
      index: { type: "integer", minimum: 0 },
      name: { type: "string" },
    },
    required: ["operation"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const operation = args.operation;
    if (operation === "create_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!folderId || !name) throw new ToolError("create_folder에는 folderId와 비어 있지 않은 name이 필요합니다.", { code: "invalid-args" });
      if (draft.maps[folderId] || findTreeNode(draft.mapTree, folderId)) throw new ToolError(`이미 사용 중인 맵/폴더 id입니다: ${folderId}`, { code: "map-tree-id-exists" });
      const parentId = typeof args.parentId === "string" ? args.parentId : "";
      if (!insertTreeNode(draft.mapTree, { mapId: folderId, kind: "folder", name, children: [] }, parentId, args.index as number | undefined)) {
        throw new ToolError(`상위 맵/분류를 찾을 수 없습니다: ${parentId || "(최상위)"}`, { code: "map-tree-parent-not-found" });
      }
      return { summary: `맵 분류 '${name}' 생성`, data: { folderId } };
    }
    if (operation === "rename_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      const name = typeof args.name === "string" ? args.name.trim() : "";
      const node = findTreeNode(draft.mapTree, folderId);
      if (!node || !isMapTreeFolder(node)) throw new ToolError(`맵 분류를 찾을 수 없습니다: ${folderId}`, { code: "map-tree-folder-not-found" });
      if (!name) throw new ToolError("rename_folder에는 비어 있지 않은 name이 필요합니다.", { code: "invalid-args" });
      node.name = name;
      return { summary: `맵 분류 이름 변경 → '${name}'`, data: { folderId } };
    }
    if (operation === "dissolve_folder") {
      const folderId = typeof args.folderId === "string" ? args.folderId : "";
      if (!dissolveFolderKeepChildren(draft.mapTree, folderId)) throw new ToolError(`해제할 맵 분류를 찾을 수 없습니다: ${folderId}`, { code: "map-tree-folder-not-found" });
      return { summary: `맵 분류 ${folderId} 해제 — 하위 항목 유지`, data: { folderId } };
    }
    if (operation === "move") {
      const mapId = typeof args.mapId === "string" ? args.mapId : "";
      const parentId = typeof args.parentId === "string" ? args.parentId : "";
      if (!canReparentMap(draft.mapTree, mapId, parentId)) throw new ToolError(`맵/폴더 ${mapId}을 ${parentId || "최상위 맵"} 아래로 이동할 수 없습니다.`, { code: "invalid-map-tree-move" });
      const oldParentId = findParentMapId(draft.mapTree, mapId);
      const oldIndex = siblingIndex(draft.mapTree, mapId);
      const node = extractTreeNode(draft.mapTree, mapId);
      if (!node) throw new ToolError(`이동할 맵/폴더를 찾을 수 없습니다: ${mapId}`, { code: "map-tree-node-not-found" });
      if (!insertTreeNode(draft.mapTree, node, parentId, args.index as number | undefined)) {
        insertTreeNode(draft.mapTree, node, oldParentId ?? "", oldIndex);
        throw new ToolError(`상위 맵/분류를 찾을 수 없습니다: ${parentId || "(최상위)"}`, { code: "map-tree-parent-not-found" });
      }
      return { summary: `맵/분류 ${mapId} 이동 → ${parentId || "최상위 맵 하위"}`, data: { mapId, parentId } };
    }
    throw new ToolError(`지원하지 않는 map tree 작업입니다: ${String(operation)}`, { code: "invalid-args" });
  },
};

const paintTiles: ToolDefinition = {
  name: "paint_tiles",
  description: `타일을 칠한다. mode: rect(사각형)/line(선)/fill(채우기, 1·2층만)/cells(개별 셀). rect는 벽과 1칸 틈이 있으면 그 틈을 메워 벽에 붙인다. 통행성이 바뀌면 경고를 반환한다. ${FOUR_LAYER_GUIDANCE} 1층을 칠하면 그 칸의 2·3·4층·그림자를 비운다. 1/3층 요청에서 투명 배경 칩(벤치·나무·사선 지붕 등)은 상위 레이어 전용이라 자동 라우팅되고, 2·4층은 요청한 층에 그대로 놓는다. 1·2층의 지형 오토타일 멤버(흙길/모래/풀 장식 등)는 그 층 이웃에 맞춰 자동 재성형된다(외딴 점·오목 코너 포함). 여러 칸·여러 층 물체는 stamp_layer_block.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      layer: { type: "string", enum: [...TOOL_LAYER_ENUM], description: "1|2|3|4 (lower=1, upper=3)" },
      mode: { type: "string", enum: ["rect", "line", "fill", "cells"] },
      tile: { type: "integer", description: "타일 인덱스(-1=비움)" },
      from: COORD_SCHEMA,
      to: COORD_SCHEMA,
      cells: { type: "array", description: "[{x,y}...]", items: COORD_SCHEMA },
    },
    required: ["mapId", "layer", "mode", "tile"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const requestedLayer = parseToolLayer(args.layer);
    if (requestedLayer === null) {
      throw new ToolError(`layer는 ${TOOL_LAYER_ENUM.join("/")} 중 하나여야 합니다(lower=1층, upper=3층).`, { code: "invalid-args", mapId: map.id });
    }
    let layerNo: TileLayerNo = requestedLayer;
    const tile = args.tile as number;
    const mode = args.mode as "rect" | "line" | "fill" | "cells";
    const from = args.from as Point | undefined;
    const to = args.to as Point | undefined;
    const cells = args.cells as Point[] | undefined;

    // 에디터 수동 페인트(effectiveLayer)와 같은 규칙으로 레이어를 라우팅한다 —
    // 홈 레이어가 단일 판정되는 타일(투명 배경 칩 = 상위 전용 등)은 요청과 무관하게 홈에 놓는다.
    // 라우팅은 1/3층(lower/upper) 요청에만 한다 — 2·4층은 겹쳐 쌓으라는 명시 선택이라 그대로 존중한다.
    let routedNote: string | null = null;
    const tileset = draft.tilesets[map.tilesetId];
    // 합법 정의역은 -1(비움) 과 0~count-1 뿐이다.
    //
    // 다른 타일 인자를 받는 도구와 **같은 계약**이다(palettePreset·groupSample·visionQuery·
    // tileMetadata·vocabulary 는 모두 tile-out-of-range 를 던진다). 여기만 검증이 빠져 있어서
    // 범위 밖 인덱스가 조용히 지도 데이터에 저장됐다 — 실측(2026-09-16): 모델이 tile_query 로
    // `타일 인덱스 범위 밖: 99999 (0~479)` 를 받고도 이어서 paint_tiles 를 호출했고, 툴은 성공으로
    // 통과해 map.lowerTiles 에 99999 가 그대로 기록됐다. 타일셋에 없는 칸은 렌더되지 않으므로
    // 사용자에게는 «빈 칸» 이 된다.
    if (tileset && (!Number.isInteger(tile) || tile < -1 || tile >= tileset.count)) {
      throw new ToolError(
        `타일 인덱스 범위 밖: ${tile} (-1=비움, 0~${tileset.count - 1}) — tile_query 로 존재하는 인덱스를 확인하세요.`,
        { code: "tile-out-of-range", mapId: map.id },
      );
    }
    if (tile >= 0 && tileset && (layerNo === 1 || layerNo === 3)) {
      const home = tileLayerHome(tileset, tile);
      const requestedGroup = layerNo === 1 ? "lower" : "upper";
      if (home !== "both" && home !== requestedGroup) {
        if (mode === "fill") {
          throw new ToolError(
            `타일 ${tile}은(는) ${home === "upper" ? "상위(투명 배경 칩)" : "하위"} 레이어 전용입니다 — fill 모드는 1·2층만 지원하므로 rect/cells 모드로 칠하세요.`
          );
        }
        layerNo = home === "upper" ? 3 : 1;
        routedNote = `타일 ${tile}은(는) ${home === "upper" ? "상위 레이어 전용(투명 배경 칩)" : "하위 레이어 전용"}이라 ${home}에 배치했습니다.`;
      }
    }

    let targetCells: Point[] = [];
    if (mode === "rect") {
      if (!from || !to) throw new ToolError("rect 모드는 from/to가 필요합니다.");
      for (let y = Math.min(from.y, to.y); y <= Math.max(from.y, to.y); y += 1)
        for (let x = Math.min(from.x, to.x); x <= Math.max(from.x, to.x); x += 1) targetCells.push({ x, y });
      targetCells = expandCellsAgainstWalls(draft, map, targetCells);
    } else if (mode === "line") {
      if (!from || !to) throw new ToolError("line 모드는 from/to가 필요합니다.");
      targetCells = lineCells(from, to);
    } else if (mode === "fill") {
      if (!from) throw new ToolError("fill 모드는 from(시작점)이 필요합니다.");
      if (layerNo !== 1 && layerNo !== 2) throw new ToolError("fill 모드는 1층(lower)·2층만 지원합니다.");
      targetCells = floodFillCells(map, from, tile, layerNo);
    } else {
      if (!cells || cells.length === 0) throw new ToolError("cells 모드는 cells 배열이 필요합니다.");
      targetCells = cells;
    }

    const paintResult = layerNo === 2 || layerNo === 4
      ? applyOverlayPaint(map, layerNo, tile, targetCells)
      : applyClusterAwarePaint(map, tileset, layerNo === 1 ? "lower" : "upper", tile, targetCells);
    // 에디터 수동 페인트와 동일하게 지형 오토타일(흙길/모래 등)을 재성형한다 —
    // 편집 주변의 그룹 멤버 셀만 바뀌므로 비멤버 페인트에는 사실상 no-op.
    // 재성형은 칠한 층 배열에서 한다(2층 풀 장식은 2층 이웃 기준). 자동타일은 바닥 층(1·2층)의 것이다 —
    // 3·4층 물체는 적은 번호 그대로 둔다(옛 upper 칠하기와 같다: 수관 같은 상위 그룹을 모델이 고른 칸째 보존).
    const groundPoints = paintResult.touched.filter((cell) => paintResult.lowerTouched.has(coordKey(cell.x, cell.y)));
    if (groundPoints.length > 0) {
      // 1층을 칠한 칸은 2층도 비웠으므로(setLower) 둘레 2층 장식의 가장자리도 다시 잡는다.
      const layers: (1 | 2)[] = layerNo === 2 ? [2] : map.lowerOverlayTiles ? [1, 2] : [1];
      for (const layer of layers) {
        const view = autotileLayerView(map, layer);
        for (const group of autotileGroupsForTileset(tileset)) shapeAutotileGroupAround(view, group, groundPoints);
      }
    }
    compactMapLayers(map);
    // 통행은 네 층이 함께 정한다 — 어느 층을 칠해도 막힌 칸을 알린다(3층 물체가 가장 흔히 막는다).
    const warning = paintResult.touched.length > 0 ? passabilityWarning(draft, map, paintResult.touched) : null;
    const skippedNote = paintResult.skipped > 0
      ? layerNo === 2 || layerNo === 4 ? `맵 밖 ${paintResult.skipped}칸은 건너뛰었습니다.` : `hard 규칙 동반 배치가 불가능한 ${paintResult.skipped}칸은 거부했습니다.`
      : null;
    const autoNote = paintResult.autoTiles > 0 ? `클러스터 동반 ${paintResult.autoTiles}타일 자동 포함` : null;
    const warnings = [...(routedNote ? [routedNote] : []), ...(skippedNote ? [skippedNote] : []), ...(warning ? [warning] : [])];
    return {
      summary: `${map.name}에 타일 ${tile} 페인트(${mode}, ${paintLayerName(layerNo)}, ${paintResult.touched.length}칸)${routedNote ? " — 상위 전용 칩 자동 라우팅" : ""}${autoNote ? ` — ${autoNote}` : ""}${skippedNote ? ` — ${skippedNote}` : ""}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      // Snapshot the executed layer: later tile-rule edits must not reinterpret this receipt.
      data: Object.freeze({ effectiveLayer: toolLayerLabel(layerNo), autoClusterTiles: paintResult.autoTiles, skippedClusterCells: paintResult.skipped, tilesTouched: paintResult.touched.length }),
    };
  },
};

/** 요약 문구의 층 이름 — 1/3층은 옛 이름(lower/upper)을 함께 쓴다. */
function paintLayerName(layer: TileLayerNo): string {
  return layer === 1 ? "1층 lower" : layer === 3 ? "3층 upper" : `${layer}층`;
}

/**
 * 2·4층(겹침 층) 칠하기. 클러스터 동반 규칙은 1/3층(lower/upper) 어휘라 여기선 적용하지 않고 칸을 그대로 쓴다.
 * 2층 칸은 lowerTouched 에 담아 호출자가 2층 배열에서 오토타일을 재성형하게 한다.
 */
function applyOverlayPaint(
  map: GameMap,
  layer: 2 | 4,
  tile: number,
  cells: readonly Point[],
): { readonly autoTiles: number; readonly lowerTouched: ReadonlySet<string>; readonly skipped: number; readonly touched: readonly Point[] } {
  const touched: Point[] = [];
  const lowerTouched = new Set<string>();
  const seen = new Set<string>();
  let skipped = 0;
  for (const cell of cells) {
    if (!inMapBounds(map, cell.x, cell.y)) {
      skipped += 1;
      continue;
    }
    const key = coordKey(cell.x, cell.y);
    if (seen.has(key)) continue;
    seen.add(key);
    setLayerTileAt(map, layer, cell.y * map.width + cell.x, tile);
    if (layer === 2) lowerTouched.add(key);
    touched.push({ x: cell.x, y: cell.y });
  }
  return { autoTiles: 0, lowerTouched, skipped, touched };
}

function applyClusterAwarePaint(
  map: GameMap,
  tileset: Project["tilesets"][string] | undefined,
  layer: "lower" | "upper",
  tile: number,
  cells: readonly Point[]
): { readonly autoTiles: number; readonly lowerTouched: ReadonlySet<string>; readonly skipped: number; readonly touched: readonly Point[] } {
  const planned = new Map<string, HardClusterTileEdit>();
  let autoTiles = 0;
  let skipped = 0;
  for (const cell of cells) {
    if (!inMapBounds(map, cell.x, cell.y)) {
      skipped += 1;
      continue;
    }
    const expansion = tileset
      ? expandHardClusterPlacement({ map, origin: cell, originLayer: layer, tile, tileset })
      : { autoTiles: 0, edits: [{ layer, tile, x: cell.x, y: cell.y }], ok: true as const };
    if (!expansion.ok || hasPaintConflict(planned, expansion.edits)) {
      skipped += 1;
      continue;
    }
    for (const edit of expansion.edits) planned.set(editKey(edit), edit);
    autoTiles += expansion.autoTiles;
  }

  const touched: Point[] = [];
  const lowerTouched = new Set<string>();
  for (const edit of planned.values()) {
    if (edit.layer === "lower") {
      setLower(map, edit.x, edit.y, edit.tile);
      lowerTouched.add(coordKey(edit.x, edit.y));
    } else {
      const index = edit.y * map.width + edit.x;
      map.upperTiles[index] = edit.tile;
      // 3층을 비우면 그 위에 얹힌 4층도 비운다(뜬 물체를 남기지 않는다 — tile_erase upper 와 같다).
      if (edit.tile < 0) setLayerTileAt(map, 4, index, TILE.EMPTY);
    }
    touched.push({ x: edit.x, y: edit.y });
  }
  return { autoTiles, lowerTouched, skipped, touched };
}

function hasPaintConflict(planned: ReadonlyMap<string, HardClusterTileEdit>, edits: readonly HardClusterTileEdit[]): boolean {
  for (const edit of edits) {
    const existing = planned.get(editKey(edit));
    if (existing && existing.tile !== edit.tile) return true;
    const otherLayer = planned.get(`${edit.layer === "lower" ? "upper" : "lower"}:${edit.x},${edit.y}`);
    if (otherLayer && otherLayer.tile !== TILE.EMPTY && edit.tile !== TILE.EMPTY) return true;
  }
  return false;
}

function editKey(edit: HardClusterTileEdit): string {
  return `${edit.layer}:${edit.x},${edit.y}`;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

const paintRoad: ToolDefinition = {
  name: "paint_road",
  description: `폴리라인을 따라 도로를 깐다. style: dirt(흙길)/sand(모래). 프리셋이 있으면 개별 타일 id/style보다 presetId+paletteRole을 우선 사용하라. 오토타일로 가장자리를 자동 성형한다. 경로가 집·벽 같은 건물을 가로지르면 그 칸을 덮지 않고 자동으로 우회한다(저작물 보호). 나무·울타리는 치우고, 물은 우회를 먼저 시도한 뒤 마른 길이 없으면 건넌다. 우회로가 없어 길이 끊기면 실패하며 막힌 좌표를 알려주니 경유점을 그 좌표 밖으로 옮겨 다시 부르라. ${NATURALNESS_GUIDANCE} 인자 {mapId, style, points:[{x,y},...]}. 마을 동선·호수 둘레 산책로·집 앞 길에 쓴다(lay_path 보다 우선).`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      points: { type: "array", description: "[{x,y}...] 경로 꼭짓점", items: COORD_SCHEMA },
      style: { type: "string", enum: ["dirt", "sand"] },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. 0은 기존 직선 세그먼트와 동일, 기본 0.5" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 자연 경로)" },
    },
    required: ["mapId", "points"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const points = args.points as Point[];
    const style = args.style as "dirt" | "sand" | undefined;
    const naturalness = naturalnessArg(args);
    if (points.length < 1) throw new ToolError("경로에는 최소 1개의 점이 필요합니다.");
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, roadSeedSignature(map, points, naturalness)) : null;
    if (!picker && style !== "dirt" && style !== "sand") {
      throw new ToolError("paint_road에는 style(dirt/sand) 또는 presetId+paletteRole이 필요합니다.", { code: "invalid-args", mapId: map.id });
    }
    const painted: Point[] = [];
    const body = picker ? () => picker.pick() : () => style === "dirt" ? DIRT_ROAD_TILE.BODY : SAND_TILE.BODY;
    const mask = roadObstacleMaskFor(draft, map);
    const candidate = naturalness === 0
      ? { path: straightRoadCandidate(points), widthCells: [] as readonly Point[] }
      : wobblePath(points, naturalness, rngForTool(args, roadSeedSignature(map, points, naturalness)));
    const routed = repairRoadPath(map, mask, candidate.path);
    const gapFailure = roadGapFailure(routed);
    if (gapFailure) throw new ToolError(gapFailure, { code: "road-blocked", mapId: map.id });
    const repair = withWidthCells(routed, filterRoadWidthCells(mask, candidate.widthCells));
    const pathCells = routed.cells.filter((cell) => inMapBounds(map, cell.x, cell.y)).length;
    for (const cell of repair.cells) paintRoadCell(map, tileset, cell, body(), painted);
    if (painted.length === 0 && repair.blocked > 0) {
      throw new ToolError(
        `요청 경로 ${repair.blocked}칸이 전부 통행 불가라 도로를 한 칸도 깔지 못했습니다`
        + ` — 경유점을 건물·물 밖으로 옮기거나 타일 통행 설정을 확인하세요.`,
        { code: "road-blocked", mapId: map.id }
      );
    }
    if (!picker) {
      const group = style === "dirt" ? DEFAULT_ROAD_AUTOTILE_GROUP : DEFAULT_SAND_AUTOTILE_GROUP;
      shapeAutotileGroupAround(map, group, painted, (x, y) => mask(x, y) !== "structure");
    }
    const source = picker ? `${picker.presetId}/${picker.role}` : style;
    const warnings = roadRepairWarnings(repair);
    return {
      summary: `${map.name}에 ${source} 도로 ${painted.length}칸 — 자연도 ${naturalnessLabel(naturalness)} / 경로 ${pathCells}칸`
        + (repair.blocked > 0 ? ` — 통행 불가 ${repair.blocked}칸 우회` : ""),
      ...(warnings.length > 0 ? { warnings } : {}),
      data: {
        detouredSegments: repair.detours,
        disconnectedSegments: repair.gaps,
        endpointBlocked: repair.startBlocked || repair.endBlocked,
        obstacleCells: repair.blocked,
        pathCells,
        structureCells: repair.structureCells,
        waterCrossings: repair.waterCrossings.length,
      },
    };
  },
};

function straightRoadCandidate(points: readonly Point[]): readonly Point[] {
  const cells: Point[] = [];
  for (let i = 0; i < points.length; i += 1) {
    if (i === 0) {
      cells.push(points[0]);
      continue;
    }
    for (const cell of lineCells(points[i - 1], points[i])) cells.push(cell);
  }
  return cells;
}

function paintRoadCell(
  map: GameMap,
  tileset: TilesetDef | undefined,
  cell: Point,
  body: number,
  painted: Point[]
): void {
  if (!inMapBounds(map, cell.x, cell.y)) return;
  paintRoadGround(map, tileset, cell.x, cell.y, body);
  painted.push(cell);
}

function roadSeedSignature(map: GameMap, points: readonly Point[], naturalness: number): string {
  return `paint_road|${map.id}|${map.width}x${map.height}|${naturalnessLabel(naturalness)}|${points.map(pointSignature).join(";")}`;
}

const STRUCTURE_STYLES: readonly TownCityPlotStyle[] = ["l", "courtyard", "multi", "road", "plaster", "stone"];

const stampStructure: ToolDefinition = {
  name: "stamp_structure",
  description: `집/구조물 템플릿을 찍는다. template: l(ㄴ자 집)/courtyard(안뜰 딸린 집)/multi(연립 주택)/road(길)/plaster(회벽 소형 집)/stone(석조 소형 집). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. 반환 diff에 문 좌표를 포함한다. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      template: { type: "string", enum: STRUCTURE_STYLES as unknown as string[] },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. origin을 최대 2칸 지터(기본 0.5)" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 지터)" },
    },
    required: ["mapId", "template", "origin"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const template = args.template as TownCityPlotStyle;
    const requestedOrigin = args.origin as Point;
    const naturalness = naturalnessArg(args);
    if (!STRUCTURE_STYLES.includes(template)) throw new ToolError(`알 수 없는 구조물 템플릿: ${template}`);
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, structureSeedSignature(map, template, requestedOrigin, naturalness)) : null;
    const origin = jitterPlacement(
      requestedOrigin,
      jitterMaxOffset(naturalness),
      rngForTool(args, structureSeedSignature(map, template, requestedOrigin, naturalness)),
      (candidate) => inMapBounds(map, candidate.x, candidate.y)
    );
    const before = snapshotTiles(map);
    const structureMask = roadObstacleMaskFor(draft, map);
    const fenceProtection = new Set(protectedHouseCells(map).map((cell) => coordKey(cell.x, cell.y)));
    stampTownCityPlot(map, template, origin.x, origin.y,
      (x, y) => structureMask(x, y) !== "open",
      (x, y) => fenceProtection.has(coordKey(x, y)));
    const paletteTiles = picker && tileset
      ? applyPaletteToChangedCells(map, tileset, before, { x: origin.x, y: origin.y, width: 18, height: 16 }, picker)
      : 0;
    // 문 좌표는 대략적으로 구조물 하단 중앙으로 추정(정확 좌표는 템플릿별 상이).
    const door = { x: origin.x + 3, y: origin.y + 4 };
    return {
      summary: `${map.name}에 '${template}' 구조물 스탬프(${origin.x},${origin.y}) — 자연도 ${naturalnessLabel(naturalness)}${picker ? ` — 프리셋 ${picker.presetId}/${picker.role} ${paletteTiles}칸` : ""}`,
      data: { door, origin, paletteTiles },
    };
  },
};

const HOUSE_MATERIALS: readonly SmallHouseMaterial[] = ["plaster", "wood", "stone"];
const HOUSE_DOOR_TOP = 116;
const HOUSE_DOOR_BOTTOM = 146;

// 임의 크기 집 생성 — 벽 타일로 사각형을 채우는 오답("10x10 집" 사고)을 막는 정공법.
// 파라메트릭 buildPlan(지붕 4행 + 벽 N행 + 문 + 창문)을 합성해 스탬프 실행기에 넘긴다.
const HOUSE_MIN_WIDTH = 5;
const HOUSE_MAX_WIDTH = 30;
const HOUSE_MIN_HEIGHT = 6; // 지붕 4행 + 벽 최소 2행.
const HOUSE_MAX_HEIGHT = 24;

type HouseBuildArgs = {
  readonly origin: Point;
  readonly width: number;
  readonly height: number;
  readonly material: SmallHouseMaterial;
};

function houseBuildArgs(map: GameMap, args: Record<string, unknown>): HouseBuildArgs {
  const origin = args.origin as Point;
  const width = args.width as number;
  const height = args.height as number;
  const material = args.material as SmallHouseMaterial;
  if (!HOUSE_MATERIALS.includes(material)) throw new ToolError(`알 수 없는 재질: ${String(args.material)} (${HOUSE_MATERIALS.join("/")})`);
  if (!Number.isInteger(width) || width < HOUSE_MIN_WIDTH || width > HOUSE_MAX_WIDTH) {
    throw new ToolError(`width는 ${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH} 사이여야 합니다: ${String(args.width)}`, { code: "invalid-args" });
  }
  if (!Number.isInteger(height) || height < HOUSE_MIN_HEIGHT || height > HOUSE_MAX_HEIGHT) {
    throw new ToolError(`height는 ${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT} 사이여야 합니다(지붕 4행 포함): ${String(args.height)}`, { code: "invalid-args" });
  }
  if (origin.x < 0 || origin.y < 0 || origin.x + width > map.width || origin.y + height > map.height) {
    throw new ToolError(
      `집(${width}×${height})이 맵을 벗어납니다 — origin (${origin.x},${origin.y}), 맵 ${map.width}×${map.height}`,
      { code: "out-of-bounds", mapId: map.id, x: origin.x, y: origin.y }
    );
  }
  return { origin, width, height, material };
}

function houseFits(map: GameMap, origin: Point, width: number, height: number): boolean {
  return origin.x >= 0 && origin.y >= 0 && origin.x + width <= map.width && origin.y + height <= map.height;
}

function houseSeedSignature(map: GameMap, house: HouseBuildArgs, naturalness: number): string {
  return [
    "build_house",
    map.id,
    `${map.width}x${map.height}`,
    pointSignature(house.origin),
    `${house.width}x${house.height}`,
    house.material,
    naturalnessLabel(naturalness),
  ].join("|");
}

function structureSeedSignature(map: GameMap, template: TownCityPlotStyle, origin: Point, naturalness: number): string {
  return ["stamp_structure", map.id, `${map.width}x${map.height}`, template, pointSignature(origin), naturalnessLabel(naturalness)].join("|");
}

function pointSignature(point: Point): string {
  return `${point.x},${point.y}`;
}

type TileSnapshot = {
  readonly lower: readonly number[];
  readonly upper: readonly number[];
};

type PaletteApplyBounds = {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

function snapshotTiles(map: GameMap): TileSnapshot {
  return { lower: [...map.lowerTiles], upper: [...map.upperTiles] };
}

function applyPaletteToChangedCells(
  map: GameMap,
  tileset: TilesetDef,
  before: TileSnapshot,
  bounds: PaletteApplyBounds,
  picker: PaletteTilePicker
): number {
  let applied = 0;
  const x1 = Math.min(map.width, bounds.x + bounds.width);
  const y1 = Math.min(map.height, bounds.y + bounds.height);
  for (let y = Math.max(0, bounds.y); y < y1; y += 1) {
    for (let x = Math.max(0, bounds.x); x < x1; x += 1) {
      const index = y * map.width + x;
      const lowerChanged = before.lower[index] !== map.lowerTiles[index];
      const upperChanged = before.upper[index] !== map.upperTiles[index];
      if (!lowerChanged && !upperChanged) continue;
      if (!paletteRoleAppliesToCell(picker.role, y - bounds.y, bounds.height, lowerChanged, upperChanged)) continue;
      placePaletteTile(map, tileset, x, y, picker.pick(), picker.role);
      applied += 1;
    }
  }
  return applied;
}

function paletteRoleAppliesToCell(
  role: PaletteSlotRole,
  relativeY: number,
  height: number,
  lowerChanged: boolean,
  upperChanged: boolean
): boolean {
  switch (role) {
    case "roof":
      return upperChanged || relativeY < Math.min(4, height);
    case "wall":
      return lowerChanged && relativeY >= Math.min(3, height - 1);
    case "path":
    case "ground":
    case "water":
    case "boundary":
      return lowerChanged;
    case "decor":
    case "furniture":
      return upperChanged || !lowerChanged;
  }
}

function placePaletteTile(map: GameMap, tileset: TilesetDef, x: number, y: number, tile: number, role: PaletteSlotRole): void {
  const index = y * map.width + x;
  const layer = paletteLayerForTile(tileset, tile, role);
  if (layer === "upper") {
    map.upperTiles[index] = tile;
  } else {
    setLower(map, x, y, tile);
    map.upperTiles[index] = TILE.EMPTY;
  }
}

function paletteLayerForTile(tileset: TilesetDef, tile: number, role: PaletteSlotRole): "lower" | "upper" {
  if (role === "decor" || role === "furniture" || role === "roof") return "upper";
  const home = tileLayerHome(tileset, tile);
  if (home === "upper" || home === "lower") return home;
  return "lower";
}

function stampBuildHouse(map: GameMap, { origin, width, height, material }: HouseBuildArgs): Point {
  const result = stampRectHouseKit(map, {
    x: origin.x,
    y: origin.y,
    width,
    stories: 1,
    roofBodyRows: Math.max(1, height - 5),
    kitId: kitIdForSmallHouseMaterial(material),
  });
  if (!result.ok || !result.doorAt) throw new ToolError(result.reason ?? "집 시공 실패", { code: "house-kit-failed", mapId: map.id });
  const door = result.doorAt;
  map.lowerTiles[(door.y - 1) * map.width + door.x] = HOUSE_DOOR_TOP;
  map.lowerTiles[door.y * map.width + door.x] = HOUSE_DOOR_BOTTOM;
  return door;
}

function houseGrid(map: GameMap, origin: Point, width: number, height: number): { readonly lower: number[][]; readonly upper: number[][] } {
  const lower: number[][] = [];
  const upper: number[][] = [];
  for (let y = 0; y < height; y += 1) {
    const lowerRow: number[] = [];
    const upperRow: number[] = [];
    for (let x = 0; x < width; x += 1) {
      const index = (origin.y + y) * map.width + origin.x + x;
      lowerRow.push(map.lowerTiles[index] ?? TILE.EMPTY);
      upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
    }
    lower.push(lowerRow);
    upper.push(upperRow);
  }
  return { lower, upper };
}

const previewHouse: ToolDefinition = {
  name: "preview_house",
  description:
    "요청한 크기의 집을 실제 맵에 짓지 않고 미리보기한다. build_house와 같은 스탬프 로직으로 throwaway 복제 맵에 찍은 뒤, 이미지 렌더링용 lower/upper 타일 그리드를 반환한다.",
  mode: "read",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      width: { type: "integer", description: `가로 칸 수(${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH})` },
      height: { type: "integer", description: `세로 칸 수(${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT}, 지붕 4행 포함)` },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
    },
    required: ["mapId", "origin", "width", "height", "material"],
  },
  run(project, args): ToolExecResult {
    const map = requireMap(project, args.mapId as string);
    const house = houseBuildArgs(map, args);
    const previewMap = structuredClone(map);
    const door = stampBuildHouse(previewMap, house);
    const grid = houseGrid(previewMap, house.origin, house.width, house.height);
    return {
      summary: `${map.name}에 ${house.width}×${house.height} ${house.material} 집 미리보기(${house.origin.x},${house.origin.y}) — 문 (${door.x},${door.y})`,
      data: { tilesetId: map.tilesetId, x: house.origin.x, y: house.origin.y, w: house.width, h: house.height, lower: grid.lower, upper: grid.upper, door },
    };
  },
};

const buildHouse: ToolDefinition = {
  name: "build_house",
  description:
    `요청한 크기의 직사각형 집을 짓는다(지붕 4행 + 벽 + 문 + 창문 자동 구성). width 5~30, height 6~24, material: plaster(회벽)/wood(목재)/stone(석재). 프리셋이 있으면 개별 타일 id 대신 presetId+paletteRole을 우선 사용하라. '10x10 집'처럼 크기가 지정된 집은 벽 타일을 직접 칠하지 말고 이 툴을 써라. 반환 data에 문 좌표 포함. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      origin: { ...COORD_SCHEMA, description: "{x,y} 좌상단" },
      width: { type: "integer", description: `가로 칸 수(${HOUSE_MIN_WIDTH}~${HOUSE_MAX_WIDTH})` },
      height: { type: "integer", description: `세로 칸 수(${HOUSE_MIN_HEIGHT}~${HOUSE_MAX_HEIGHT}, 지붕 4행 포함)` },
      material: { type: "string", enum: HOUSE_MATERIALS as unknown as string[] },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 slot tileIds에서 선택" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      naturalness: { type: "number", description: "0~1 자연도. origin을 최대 2칸 지터(기본 0.5)" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 지터)" },
    },
    required: ["mapId", "origin", "width", "height", "material"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const baseHouse = houseBuildArgs(map, args);
    const naturalness = naturalnessArg(args);
    const tileset = draft.tilesets[map.tilesetId];
    const picker = tileset ? paletteTilePickerForTool(tileset, args, houseSeedSignature(map, baseHouse, naturalness)) : null;
    const origin = jitterPlacement(
      baseHouse.origin,
      jitterMaxOffset(naturalness),
      rngForTool(args, houseSeedSignature(map, baseHouse, naturalness)),
      (candidate) => houseFits(map, candidate, baseHouse.width, baseHouse.height)
    );
    const house = { ...baseHouse, origin };
    const bbox = { ...origin, w: house.width, h: house.height };
    assertHousePlacement(map, bbox);
    const before = snapshotTiles(map);
    const door = stampBuildHouse(map, house);
    const paletteTiles = picker && tileset
      ? applyPaletteToChangedCells(map, tileset, before, { x: house.origin.x, y: house.origin.y, width: house.width, height: house.height }, picker)
      : 0;
    registerCompletedHouse(draft, map, {
      ...bbox, label: `${house.material} 집`, kitId: kitIdForSmallHouseMaterial(house.material),
      doorAt: door, front: { x: door.x, y: door.y + 1 },
    });
    return {
      summary: `${map.name}에 ${house.width}×${house.height} ${house.material} 집 건설(${house.origin.x},${house.origin.y}) — 문 (${door.x},${door.y}) — 자연도 ${naturalnessLabel(naturalness)}${picker ? ` — 프리셋 ${picker.presetId}/${picker.role} ${paletteTiles}칸` : ""}`,
      data: { door, origin: house.origin, width: house.width, height: house.height, material: house.material, paletteTiles },
    };
  },
};

// 영역 일괄 정리 — 잘못 깐 구조물/타일 무더기를 한 번에 걷어낸다.
const clearRegion: ToolDefinition = {
  name: "clear_region",
  description:
    "맵의 사각 영역을 정리한다: 상위 레이어(3·4층)는 비우고, 하위 레이어(1층)는 잔디(fill=grass, 기본) 또는 빈 칸(fill=empty)으로 되돌린다. layer=lower 는 1층과 그 위 2층 장식·그림자, upper 는 3·4층, both 는 칸 전체. 잘못 배치한 구조물을 지울 때 사용. 이벤트는 지우지 않고 경고로 알린다.",
  mode: "write",
  invalidArgsExample: { mapId: "map_1", x: 0, y: 0, w: 10, h: 8, layer: "both" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      layer: { type: "string", enum: ["lower", "upper", "both"], description: "정리할 레이어(기본 both)" },
      fill: { type: "string", enum: ["grass", "empty"], description: "하위 레이어를 채울 값(기본 grass)" },
    },
    required: ["mapId", "x", "y", "w", "h"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    if (x1 <= x0 || y1 <= y0) throw new ToolError("정리할 영역이 맵과 겹치지 않습니다.", { code: "invalid-args" });
    const layer = (args.layer as "lower" | "upper" | "both" | undefined) ?? "both";
    const lowerFill = (args.fill as "grass" | "empty" | undefined) === "empty" ? TILE.EMPTY : TILE.GRASS;
    let cells = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const index = y * map.width + x;
        if (layer !== "upper") {
          map.lowerTiles[index] = lowerFill;
          setLayerTileAt(map, 2, index, TILE.EMPTY);
          setShadowAt(map, index, 0);
        }
        if (layer !== "lower") {
          map.upperTiles[index] = TILE.EMPTY;
          setLayerTileAt(map, 4, index, TILE.EMPTY);
        }
        cells += 1;
      }
    }
    compactMapLayers(map);
    const events = map.events.filter((event) => event.x >= x0 && event.x < x1 && event.y >= y0 && event.y < y1);
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1 - 1},${y1 - 1}) 정리 — ${cells}칸 (${layer}, 하위=${lowerFill === TILE.EMPTY ? "빈 칸" : "잔디"})`,
      warnings: events.length > 0 ? [`영역 안 이벤트 ${events.length}개는 남겨둠: ${events.map((event) => event.id).join(", ")} — 삭제하려면 remove_event`] : undefined,
      data: { cleared: cells, events: events.map((event) => event.id) },
    };
  },
};

// ── clear_map ──
// 맵 전체를 한 콜로 비운다(clear_region 의 맵 크기판). 이 툴이 따로 있는 이유는 두 가지다:
//  1) 모델이 맵 크기를 몰라도 된다 — 전체 rect 를 계산하려고 get_map_region 을 왕복하던 경로가 사라진다.
//  2) **타일이 아닌 저작물은 건드리지 않는다**는 계약을 이름에 못박는다. 스폰·명명 로케이션·시공
//     기록·맵 속성·맵 자체는 그대로다(맵을 없애는 것은 remove_map).
//
// 승인은 세 겹이고 각각 다른 것을 막는다:
//  - 인자 confirmDestroy:true — 모델이 파괴적 의도를 명시했는지(이름만 스쳐 지나가는 호출 차단).
//  - 적용 직전 사용자 허가 모달(ai/mapDestructionConfirm + aiProposalCard) — 사람이 봤는지.
//  - 완성된 집 불변식(toolRunner) — 선언과 무관하게 기록된 집은 남는다. 이건 뚫리지 않는다.
//
// 기존 내용 보호(밑그림 에셋 선언) 목록에는 **일부러 넣지 않는다**: 그 게이트가 아는 허가 형식은
// set_build_spec 의 clear 에셋이고, 이 툴은 자기 인자로 같은 허가를 이미 요구한다. 겹쳐 놓으면
// 「이 맵 다 지워」가 명세 제출 왕복을 강제당한다. 대신 파괴성 레지스트리(approvalPolicy·
// overInsertionReview)와 승격 금지 목록(capabilityEscalation)에는 등록한다.
const clearMap: ToolDefinition = {
  name: "clear_map",
  description:
    "맵 전체의 타일을 한 번에 비운다(파괴적). 상위 레이어(3·4층)·2층 장식·그림자는 항상 빈 칸이 되고 하위 레이어(1층)는 fill로 정한다" +
    "(기본 grass=잔디, empty=진짜 허공). confirmDestroy:true 없이는 실행되지 않는다. " +
    "events 기본값 keep 은 이벤트를 남기고 경고로 id를 알린다 — remove 면 이벤트까지 지운다. " +
    "필드 스폰·명명 로케이션·시공 기록·맵 속성은 건드리지 않는다(맵 자체를 없애는 것은 remove_map). " +
    "기록된 완성된 집이 있으면 거부된다. 맵 크기를 몰라도 되고 get_map_region 왕복도 필요 없다.",
  mode: "write",
  domains: ["map"],
  invalidArgsExample: { mapId: "map_1", confirmDestroy: true },
  invalidArgsHint: "맵 전체를 비우는 파괴적 작업이다 — 사용자가 명시적으로 요청한 경우에만 confirmDestroy:true를 넣는다.",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      fill: { type: "string", enum: ["grass", "empty"], description: "하위 레이어 결과(기본 grass). empty=허공(하늘 맵 등)" },
      events: { type: "string", enum: ["keep", "remove"], description: "이벤트 처리(기본 keep=남기고 경고)" },
      confirmDestroy: { type: "boolean", description: "파괴적 실행 확인 — true 여야 실행된다" },
    },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    if (args.confirmDestroy !== true) {
      throw new ToolError(
        `맵 전체 청소는 파괴적 작업입니다 — '${map.name}'(${map.id}) 타일 ${map.width * map.height}칸이 바뀝니다. `
          + `정말 필요하면 confirmDestroy:true 를 넣으세요. 예: ${JSON.stringify({ mapId: map.id, confirmDestroy: true })}`,
        { code: "invalid-args", mapId: map.id },
      );
    }
    const fill = (args.fill as "grass" | "empty" | undefined) ?? "grass";
    const lowerFill = fill === "empty" ? TILE.EMPTY : TILE.GRASS;
    const removeEvents = args.events === "remove";
    // 통행 보장 칸은 남긴다 — fill=empty 는 그 칸을 통행 불가로 만든다. 정책은 tile_erase/fill_region 과
    // 같다: 막는 칸만 건너뛰고 경고하며 편집 전체를 거부하지 않는다.
    const passage = fill === "empty" ? passageProtectedCells(draft, map) : new Map<string, string>();
    const keptLowerStacks: Record<number, number[]> = {};
    const keptUpperStacks: Record<number, number[]> = {};
    let cleared = 0;
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        if (passage.has(`${x},${y}`)) {
          const lowerStack = map.lowerTileStacks?.[index];
          const upperStack = map.upperTileStacks?.[index];
          if (lowerStack) keptLowerStacks[index] = lowerStack.slice();
          if (upperStack) keptUpperStacks[index] = upperStack.slice();
          continue;
        }
        map.lowerTiles[index] = lowerFill;
        map.upperTiles[index] = TILE.EMPTY;
        setLayerTileAt(map, 2, index, TILE.EMPTY);
        setLayerTileAt(map, 4, index, TILE.EMPTY);
        setShadowAt(map, index, 0);
        cleared += 1;
      }
    }
    compactMapLayers(map);
    if (Object.keys(keptLowerStacks).length > 0) map.lowerTileStacks = keptLowerStacks;
    else delete map.lowerTileStacks;
    if (Object.keys(keptUpperStacks).length > 0) map.upperTileStacks = keptUpperStacks;
    else delete map.upperTileStacks;

    const eventIds = map.events.map((event) => event.id);
    if (removeEvents) map.events = [];
    const warnings: string[] = [];
    if (removeEvents && eventIds.length > 0) {
      warnings.push(`이벤트 ${eventIds.length}개를 함께 삭제했습니다: ${eventIds.join(", ")}`);
    }
    if (!removeEvents && eventIds.length > 0) {
      warnings.push(`이벤트 ${eventIds.length}개는 남겨둠: ${eventIds.join(", ")} — 함께 지우려면 events:"remove"`);
    }
    if (passage.size > 0) {
      const samples = [...passage].slice(0, 3).map(([key, reason]) => `(${key})은 ${reason}라 제외했습니다`);
      const extra = passage.size > samples.length ? ` 외 ${passage.size - samples.length}칸` : "";
      warnings.push(`${samples.join(", ")}${extra}`);
    }
    return {
      summary: `${map.name}(${map.id}) 전체 청소 — ${cleared}/${map.width * map.height}칸 (하위=${fill === "empty" ? "빈 칸" : "잔디"}, 이벤트 ${removeEvents ? "삭제" : "유지"})`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: {
        mapId: map.id,
        mapName: map.name,
        fill,
        events: removeEvents ? "remove" : "keep",
        cells: cleared,
        total: map.width * map.height,
        keptCells: [...passage.keys()],
        removedEvents: removeEvents ? eventIds : [],
      },
    };
  },
};

// 영역 대칭 변환 — LLM 판단 없는 결정적 변환(코퍼스 mirror-symmetry가 "불가"이던 갭 해소).
// 비대칭 오토타일 경계는 후처리하지 않는다(설명에 명시).
const mirrorRegion: ToolDefinition = {
  name: "mirror_region",
  description:
    "사각 영역의 타일(1~4층/그림자/스택)과 영역 안 이벤트 좌표를 좌우(horizontal) 또는 상하(vertical)로 대칭 변환한다. 결정적 변환 — 오토타일 경계는 보정하지 않으므로 필요하면 이후 다듬기 지시를 권한다. 인자 {mapId,x,y,w,h,axis:\"horizontal\"|\"vertical\"}. 대칭·반복·복제 요청의 정본.",
  mode: "write",
  invalidArgsExample: { mapId: "map_1", x: 2, y: 2, w: 8, h: 6, axis: "horizontal" },
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
      w: { type: "integer" },
      h: { type: "integer" },
      axis: { type: "string", enum: ["horizontal", "vertical"] },
    },
    required: ["mapId", "x", "y", "w", "h", "axis"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const axis = args.axis as "horizontal" | "vertical";
    const x0 = Math.max(0, args.x as number);
    const y0 = Math.max(0, args.y as number);
    const x1 = Math.min(map.width, x0 + (args.w as number));
    const y1 = Math.min(map.height, y0 + (args.h as number));
    if (x1 <= x0 || y1 <= y0) throw new ToolError("대칭할 영역이 맵과 겹치지 않습니다.", { code: "invalid-args" });

    const mirrorX = (x: number): number => (axis === "horizontal" ? x0 + (x1 - 1) - x : x);
    const mirrorY = (y: number): number => (axis === "vertical" ? y0 + (y1 - 1) - y : y);

    const srcLower = map.lowerTiles.slice();
    const srcUpper = map.upperTiles.slice();
    // 2·4층·그림자는 있을 때만 옮긴다 — 옛 맵은 키가 없고 그대로다. 그림자 비트는 칸 안 사분면이라
    // 대칭 축에 맞춰 좌우(tl↔tr, bl↔br)·상하(tl↔bl, tr↔br)도 뒤집는다.
    const srcExtras = EXTRA_LAYER_KEYS.flatMap((key) => {
      const values = map[key];
      return values ? [{ key, values: values.slice() }] : [];
    });
    const srcLowerStacks = structuredClone(map.lowerTileStacks ?? {});
    const srcUpperStacks = structuredClone(map.upperTileStacks ?? {});
    const nextLowerStacks: Record<number, number[]> = structuredClone(map.lowerTileStacks ?? {});
    const nextUpperStacks: Record<number, number[]> = structuredClone(map.upperTileStacks ?? {});

    let cells = 0;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const di = y * map.width + x;
        const si = mirrorY(y) * map.width + mirrorX(x);
        map.lowerTiles[di] = srcLower[si];
        map.upperTiles[di] = srcUpper[si];
        const lowerStack = srcLowerStacks[si];
        if (lowerStack) nextLowerStacks[di] = lowerStack.slice();
        else delete nextLowerStacks[di];
        const upperStack = srcUpperStacks[si];
        if (upperStack) nextUpperStacks[di] = upperStack.slice();
        else delete nextUpperStacks[di];
        for (const extra of srcExtras) {
          const value = extra.values[si]!;
          map[extra.key]![di] = extra.key === "shadowBits" ? mirrorShadowBits(value, axis) : value;
        }
        cells += 1;
      }
    }
    if (Object.keys(nextLowerStacks).length > 0) map.lowerTileStacks = nextLowerStacks;
    else delete map.lowerTileStacks;
    if (Object.keys(nextUpperStacks).length > 0) map.upperTileStacks = nextUpperStacks;
    else delete map.upperTileStacks;

    let movedEvents = 0;
    for (const event of map.events) {
      if (event.x < x0 || event.x >= x1 || event.y < y0 || event.y >= y1) continue;
      const nx = mirrorX(event.x);
      const ny = mirrorY(event.y);
      if (nx !== event.x || ny !== event.y) {
        event.x = nx;
        event.y = ny;
        movedEvents += 1;
      }
    }
    return {
      summary: `${map.name} 영역 (${x0},${y0})~(${x1 - 1},${y1 - 1}) ${axis === "horizontal" ? "좌우" : "상하"} 대칭 — ${cells}칸, 이벤트 ${movedEvents}개 이동`,
      data: { cells, movedEvents, axis },
    };
  },
};

/** 그림자 사분면 비트(bit0 좌상·bit1 우상·bit2 좌하·bit3 우하)를 대칭 축에 맞춰 뒤집는다. */
function mirrorShadowBits(bits: number, axis: "horizontal" | "vertical"): number {
  const tl = bits & 1, tr = (bits >> 1) & 1, bl = (bits >> 2) & 1, br = (bits >> 3) & 1;
  return axis === "horizontal" ? tr | (tl << 1) | (br << 2) | (bl << 3) : bl | (br << 1) | (tl << 2) | (tr << 3);
}

const setStartPosition: ToolDefinition = {
  name: "set_start_position",
  description: "게임 시작 맵/좌표를 지정한다. 통행 불가 타일이면 실패한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      x: { type: "integer" },
      y: { type: "integer" },
    },
    required: ["mapId", "x", "y"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const x = args.x as number;
    const y = args.y as number;
    if (!inMapBounds(map, x, y)) throw new ToolError(`시작 위치가 맵 밖입니다: (${x}, ${y})`, { code: "start-out-of-bounds", mapId: map.id, x, y });
    if (!isPassable(draft, map, x, y)) {
      throw new ToolError(`시작 위치가 통행 불가 타일입니다: (${x}, ${y})`, { code: "start-impassable", mapId: map.id, x, y });
    }
    const previous = draft.maps[draft.startMapId];
    draft.startMapId = map.id;
    draft.startPos = { x, y };
    // 새 장소로 시작을 옮기면 빈 시작 맵이 문도 이벤트도 없는 고아로 남기 쉽다(추리 도그푸딩 3·4회차).
    // 지우는 건 파괴적이라 알려만 준다.
    const warnings = previous && previous.id !== map.id && (previous.events?.length ?? 0) === 0
      && collectMapLinkStats(draft, previous.id).playLinkCount === 0
      ? [`이전 시작 맵 '${previous.name}'(${previous.id}) 은 이벤트도 드나드는 문도 없는 빈 맵으로 남았습니다 — 쓸 곳이 없으면 remove_map { mapId: "${previous.id}" } 로 지우고, 쓸 거면 문(create_transfer_pair)으로 이으세요.`]
      : [];
    // 내용이 있는 이전 시작 맵이 새 시작에서 닿지 않으면 거기 만든 것이 통째로 플레이에서 빠진다 —
    // 2026-09-24 연애 4회차: 집 12채·주민 14명 마을을 시작 맵에 짓고 시작을 새 기숙사 방으로 옮긴 뒤 끝내 잇지 않았다.
    if (previous && previous.id !== map.id && (previous.events?.length ?? 0) > 0 && !reachableMapIdsFromStart(draft).has(previous.id)) {
      warnings.push(`이전 시작 맵 '${previous.name}'(${previous.id}, 이벤트 ${previous.events.length}개)은 새 시작 맵에서 문으로 닿지 않습니다 — create_transfer_pair 나 이동 선택지로 이어야 거기 만든 것이 플레이에 나옵니다.`);
    }
    return { summary: `시작 위치 설정: ${map.name} (${x}, ${y})`, ...(warnings.length > 0 ? { warnings } : {}) };
  },
};

const setTilePassability: ToolDefinition = {
  name: "set_tile_passability",
  description: "타일셋의 특정 타일 통행 가능 여부를 설정한다(4방향 일괄). 겉보기와 실제 통행성이 다른 타일을 고칠 때 사용.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      tilesetId: { type: "string", description: "생략 시 기본 타일셋" },
      tile: { type: "integer", description: "타일 인덱스" },
      passable: { type: "boolean" },
    },
    required: ["tile", "passable"],
  },
  run(draft, args): ToolExecResult {
    const tilesetId = (args.tilesetId as string | undefined) ?? DEFAULT_TILESET_ID;
    const tileset = draft.tilesets[tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${tilesetId}`, { code: "tileset-not-found" });
    const tile = args.tile as number;
    if (!Number.isInteger(tile) || tile < 0 || tile >= tileset.count) {
      throw new ToolError(`타일 인덱스 범위 밖: ${tile} (0~${tileset.count - 1})`, { code: "tile-out-of-range" });
    }
    const passable = args.passable === true;
    tileset.passability[tile] = { up: passable, down: passable, left: passable, right: passable };
    // 사용자 확정 메타로 기록 — 없으면 다음 로드 때 하네스 계약이 통행성을 되돌린다.
    markUserTileRuntimeMetadata(tileset, tile, { passage: passable ? "passable" : "solid" });
    return { summary: `타일 ${tile} 통행성 → ${passable ? "통행 가능" : "통행 불가"} (${tilesetId})`, data: { tilesetId, tile, passable } };
  },
};

const rectSchema: JsonSchema = {
  type: "object",
  properties: {
    x: { type: "integer" },
    y: { type: "integer" },
    w: { type: "integer" },
    h: { type: "integer" },
  },
  required: ["x", "y", "w", "h"],
};

const encounterConditionsSchema: JsonSchema = {
  type: "object",
  properties: {
    switchId: { type: "string" },
    variableId: { type: "string" },
    atLeast: { type: "integer" },
    minPartyLevel: { type: "integer" },
    maxPartyLevel: { type: "integer" },
    region: rectSchema,
    timePhase: { type: "string", enum: TIME_PHASES },
    season: { type: "string", enum: SEASONS },
  },
};

const encounterEntrySchema: JsonSchema = {
  type: "object",
  properties: {
    troopId: { type: "string" },
    weight: { type: "integer" },
    conditions: encounterConditionsSchema,
  },
  required: ["troopId", "weight"],
};

const fieldGraphicSchema: JsonSchema = {
  type: "object",
  description: "생략하면 적 레코드의 몬스터 그림을 사용한다. 지정 시 실제 sprite가 필요하다. query/characterIndex는 지원하지 않는다.",
  properties: {
    sprite: { type: "object", properties: { type: { type: "string", enum: ["bundled", "uploaded"] }, id: { type: "string" } }, required: ["type", "id"] },
    direction: { type: "string", enum: ["up", "down", "left", "right"] },
    pattern: { type: "integer" },
    transparent: { type: "boolean" },
    scale: { type: "number" },
  },
  additionalProperties: false,
};

const characterFootprintSchema: JsonSchema = {
  type: "object",
  description: "스폰 몸 크기(타일). 생략하면 1x1.",
  properties: {
    width: { type: "integer" },
    height: { type: "integer" },
  },
  required: ["width", "height"],
};

const roguelikeEncounterChoiceSchema: JsonSchema = {
  type: "object",
  properties: {
    fieldSpawnId: { type: "string" },
    weight: { type: "integer" },
    minFloor: { type: "integer" },
    maxFloor: { type: "integer" },
  },
  required: ["fieldSpawnId"],
};

const roguelikeEncounterSlotSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    choices: { type: "array", items: roguelikeEncounterChoiceSchema },
  },
  required: ["id", "choices"],
};

/**
 * 인카운터 테이블을 설정할 때 발생률도 함께 보장한다.
 * 라이브 QA 사고: encounterTable 만 채우고 encounterRate=0 으로 남기면
 * playSceneMovement 의 `rate <= 0` 게이트에 막혀 몬스터가 평생 등장하지 않는다.
 */
const DEFAULT_TABLE_ENCOUNTER_RATE = 25;

function applyEncounterRate(map: GameMap, requested: unknown, hasEntries: boolean): string | undefined {
  if (requested !== undefined) {
    if (typeof requested !== "number" || !Number.isInteger(requested) || requested < 0) {
      throw new ToolError("encounterRate는 0 이상 정수여야 합니다.", { code: "invalid-args", mapId: map.id });
    }
    map.encounterRate = requested;
    return `인카운터율=${requested}`;
  }
  if (!hasEntries || (map.encounterRate ?? 0) > 0) return undefined;
  map.encounterRate = DEFAULT_TABLE_ENCOUNTER_RATE;
  return `인카운터율 0 이라 기본값 ${DEFAULT_TABLE_ENCOUNTER_RATE} 으로 보정`;
}

function parseEncounterEntries(draft: Project, map: GameMap, value: unknown): EncounterTableEntry[] {
  if (!Array.isArray(value)) throw new ToolError("entries는 배열이어야 합니다.", { code: "invalid-entries", mapId: map.id });
  return value.map((entryValue, index) => parseEncounterEntry(draft, map, entryValue, `entries[${index}]`));
}

function parseEncounterEntry(draft: Project, map: GameMap, value: unknown, label: string): EncounterTableEntry {
  const entry = requireRecordValue(value, label);
  const troopId = stringField(entry, "troopId", label);
  assertKnownTroop(draft, troopId);
  const weight = integerField(entry, "weight", label);
  if (weight <= 0) throw new ToolError(`${label}.weight는 1 이상이어야 합니다.`, { code: "invalid-weight", mapId: map.id });
  const conditions = entry.conditions === undefined ? undefined : parseEncounterConditions(draft, map, entry.conditions, `${label}.conditions`);
  return conditions ? { troopId, weight, conditions } : { troopId, weight };
}

function parseEncounterConditions(draft: Project, map: GameMap, value: unknown, label: string): EncounterTableEntry["conditions"] {
  const input = requireRecordValue(value, label);
  const conditions: NonNullable<EncounterTableEntry["conditions"]> = {};
  if (input.switchId !== undefined) {
    conditions.switchId = stringField(input, "switchId", label);
    if (!draft.switches.some((sw) => sw.id === conditions.switchId)) {
      throw new ToolError(`${label}.switchId가 존재하지 않습니다: ${conditions.switchId}`, { code: "switch-not-found", mapId: map.id });
    }
  }
  if (input.variableId !== undefined) {
    conditions.variableId = stringField(input, "variableId", label);
    if (!draft.variables.some((variable) => variable.id === conditions.variableId)) {
      throw new ToolError(`${label}.variableId가 존재하지 않습니다: ${conditions.variableId}`, { code: "variable-not-found", mapId: map.id });
    }
    conditions.atLeast = integerField(input, "atLeast", label);
  }
  if (input.minPartyLevel !== undefined) conditions.minPartyLevel = integerField(input, "minPartyLevel", label);
  if (input.maxPartyLevel !== undefined) conditions.maxPartyLevel = integerField(input, "maxPartyLevel", label);
  if (conditions.minPartyLevel !== undefined && conditions.maxPartyLevel !== undefined && conditions.minPartyLevel > conditions.maxPartyLevel) {
    throw new ToolError(`${label}: minPartyLevel이 maxPartyLevel보다 큽니다.`, { code: "invalid-level-range", mapId: map.id });
  }
  if (input.region !== undefined) conditions.region = parseRect(input.region, `${label}.region`, map);
  if (input.timePhase !== undefined) {
    const timePhase = stringField(input, "timePhase", label);
    if (!isTimePhase(timePhase)) throw new ToolError(`${label}.timePhase가 잘못되었습니다: ${timePhase}`, { code: "invalid-time-phase", mapId: map.id });
    conditions.timePhase = timePhase;
  }
  if (input.season !== undefined) {
    const season = stringField(input, "season", label);
    if (!isSeason(season)) throw new ToolError(`${label}.season이 잘못되었습니다: ${season}`, { code: "invalid-season", mapId: map.id });
    conditions.season = season;
  }
  return conditions;
}

function parseFieldSpawn(draft: Project, map: GameMap, value: unknown, label: string): FieldSpawnDef {
  const input = requireRecordValue(value, label);
  const id = stringField(input, "id", label).trim();
  if (!id) throw new ToolError(`${label}.id는 비울 수 없습니다.`, { code: "invalid-spawn-id", mapId: map.id });
  const troopId = stringField(input, "troopId", label);
  assertKnownTroop(draft, troopId);
  const spawn: FieldSpawnDef = {
    id,
    troopId,
    area: parseRect(input.area, `${label}.area`, map),
  };
  // 구역 앵커. 이름(ID 또는 표시명)을 받아 같은 맵의 로케이션으로 해석한다 —
  // 없으면 오류다: 오타를 조용히 좌표로 되돌리면 «구역을 옮겼는데 스폰이 안 따라오는»
  // 상태를 디버깅하게 된다. area 는 폴백으로 항상 함께 남는다.
  if (input.locationId !== undefined) {
    const locationId = stringField(input, "locationId", label).trim();
    if (!locationId) throw new ToolError(`${label}.locationId는 비울 수 없습니다.`, { code: "invalid-location-anchor", mapId: map.id });
    const location = resolveLocation(map, locationId);
    if (!location) {
      const known = mapLocations(map).map((entry) => `${entry.name}(${entry.id})`).join(", ") || "(없음)";
      throw new ToolError(`${label}.locationId를 찾을 수 없습니다: ${locationId}. 이 맵의 로케이션: ${known}`, {
        code: "location-not-found",
        mapId: map.id,
      });
    }
    spawn.locationId = location.id;
  }
  if (input.maxAlive !== undefined) {
    const maxAlive = integerField(input, "maxAlive", label);
    if (maxAlive <= 0) throw new ToolError(`${label}.maxAlive는 1 이상이어야 합니다.`, { code: "invalid-max-alive", mapId: map.id });
    spawn.maxAlive = maxAlive;
  }
  if (input.respawnSec !== undefined) {
    const respawnSec = numberField(input, "respawnSec", label);
    if (respawnSec < 0) throw new ToolError(`${label}.respawnSec는 0 이상이어야 합니다.`, { code: "invalid-respawn", mapId: map.id });
    spawn.respawnSec = respawnSec;
  }
  if (input.chase !== undefined) spawn.chase = booleanField(input, "chase", label);
  if (input.graphic !== undefined) {
    const graphic = requireRecordValue(input.graphic, `${label}.graphic`);
    if (graphic.sprite === undefined && graphic.transparent !== true) {
      throw new ToolError("graphic에는 sprite:{type:'uploaded',id:'실제 리소스 ID'}가 필요합니다. graphic을 생략하면 적의 몬스터 그림을 사용합니다.", { code: "invalid-graphic", mapId: map.id });
    }
    if (graphic.sprite !== undefined) {
      const sprite = requireRecordValue(graphic.sprite, `${label}.graphic.sprite`);
      if ((sprite.type !== "uploaded" && sprite.type !== "bundled") || typeof sprite.id !== "string" || !sprite.id.trim()) {
        throw new ToolError("graphic.sprite의 type과 id를 확인하세요.", { code: "invalid-graphic", mapId: map.id });
      }
    }
    spawn.graphic = structuredClone(graphic) as FieldSpawnDef["graphic"];
  }
  // 진영·발자국·킬 필드를 드롭하면 make_action_enemy 와 스폰 계약이 갈라지고,
  // 저작한 덮어쓰기가 툴 한 번에 조용히 사라진다. 생략 시 키를 안 쓰는 기존 동작은 유지.
  if (input.factionId !== undefined) {
    const factionId = stringField(input, "factionId", label).trim();
    if (!factionId) throw new ToolError(`${label}.factionId는 비울 수 없습니다.`, { code: "invalid-faction-id", mapId: map.id });
    spawn.factionId = factionId;
  }
  if (input.footprint !== undefined) spawn.footprint = parseCharacterFootprint(input.footprint, `${label}.footprint`, map.id);
  if (input.passRows !== undefined) {
    const passRows = integerField(input, "passRows", label);
    if (passRows <= 0) throw new ToolError(`${label}.passRows는 1 이상이어야 합니다.`, { code: "invalid-pass-rows", mapId: map.id });
    spawn.passRows = passRows;
  }
  if (input.persistKill !== undefined) spawn.persistKill = booleanField(input, "persistKill", label);
  if (input.onKillSwitchId !== undefined) {
    const onKillSwitchId = stringField(input, "onKillSwitchId", label).trim();
    if (!onKillSwitchId) throw new ToolError(`${label}.onKillSwitchId는 비울 수 없습니다.`, { code: "invalid-kill-switch", mapId: map.id });
    if (!draft.switches.some((sw) => sw.id === onKillSwitchId)) {
      throw new ToolError(`${label}.onKillSwitchId가 존재하지 않습니다: ${onKillSwitchId}`, { code: "switch-not-found", mapId: map.id });
    }
    spawn.onKillSwitchId = onKillSwitchId;
  }
  return spawn;
}

function parseRoguelikeRoom(map: GameMap, args: Record<string, unknown>): RoguelikeRoomDef {
  const slots = args.slots ?? map.roguelikeRoom?.encounterSlots ?? [];
  if (!Array.isArray(slots)) {
    throw new ToolError("slots는 배열이어야 합니다.", { code: "invalid-slots", mapId: map.id });
  }
  const knownSpawnIds = new Set((map.fieldSpawns ?? []).map((spawn) => spawn.id));
  const usedSlotIds = new Set<string>();
  const encounterSlots = slots.map((slotValue, slotIndex) => {
    const label = `slots[${slotIndex}]`;
    const slot = requireRecordValue(slotValue, label);
    const id = stringField(slot, "id", label).trim();
    if (!id) throw new ToolError(`${label}.id는 비울 수 없습니다.`, { code: "invalid-slot-id", mapId: map.id });
    if (usedSlotIds.has(id)) throw new ToolError(`${label}.id가 중복됩니다: ${id}`, { code: "duplicate-slot-id", mapId: map.id });
    usedSlotIds.add(id);
    if (!Array.isArray(slot.choices) || slot.choices.length === 0) {
      throw new ToolError(`${label}.choices는 하나 이상이어야 합니다.`, { code: "empty-slot", mapId: map.id });
    }
    const usedChoiceIds = new Set<string>();
    const choices = slot.choices.map((choiceValue, choiceIndex) => {
      const choiceLabel = `${label}.choices[${choiceIndex}]`;
      const choice = requireRecordValue(choiceValue, choiceLabel);
      const fieldSpawnId = stringField(choice, "fieldSpawnId", choiceLabel).trim();
      if (!knownSpawnIds.has(fieldSpawnId)) {
        throw new ToolError(`${choiceLabel}.fieldSpawnId가 존재하지 않습니다: ${fieldSpawnId}`, { code: "spawn-not-found", mapId: map.id });
      }
      if (usedChoiceIds.has(fieldSpawnId)) {
        throw new ToolError(`${choiceLabel}.fieldSpawnId가 슬롯 안에서 중복됩니다: ${fieldSpawnId}`, { code: "duplicate-spawn-choice", mapId: map.id });
      }
      usedChoiceIds.add(fieldSpawnId);
      const weight = choice.weight === undefined ? 1 : integerField(choice, "weight", choiceLabel);
      if (weight <= 0) throw new ToolError(`${choiceLabel}.weight는 1 이상이어야 합니다.`, { code: "invalid-weight", mapId: map.id });
      const minFloor = choice.minFloor === undefined ? undefined : runFloorField(choice, "minFloor", choiceLabel, map.id);
      const maxFloor = choice.maxFloor === undefined ? undefined : runFloorField(choice, "maxFloor", choiceLabel, map.id);
      if (minFloor !== undefined && maxFloor !== undefined && minFloor > maxFloor) {
        throw new ToolError(`${choiceLabel}.minFloor가 maxFloor보다 큽니다.`, { code: "invalid-floor-range", mapId: map.id });
      }
      return {
        fieldSpawnId,
        weight,
        ...(minFloor !== undefined ? { minFloor } : {}),
        ...(maxFloor !== undefined ? { maxFloor } : {}),
      };
    });
    return { id, choices };
  });
  const roomId = typeof args.roomId === "string"
    ? args.roomId.trim()
    : args.roomId === undefined
      ? map.roguelikeRoom?.roomId?.trim() ?? ""
      : "";
  if (args.roomId !== undefined && !roomId) {
    throw new ToolError("roomId는 비울 수 없습니다.", { code: "invalid-room-id", mapId: map.id });
  }
  const resetEventState = args.resetEventState === undefined
    ? map.roguelikeRoom?.resetEventState
    : booleanField(args, "resetEventState", "roguelikeRoom");
  return {
    ...(roomId ? { roomId } : {}),
    ...(resetEventState !== undefined ? { resetEventState } : {}),
    encounterSlots,
  };
}

function runFloorField(record: Record<string, unknown>, key: "minFloor" | "maxFloor", label: string, mapId: string): number {
  const value = integerField(record, key, label);
  if (value < 1 || value > 9_999) {
    throw new ToolError(`${label}.${key}는 1..9999 범위여야 합니다.`, { code: "invalid-floor", mapId });
  }
  return value;
}

function parseRect(value: unknown, label: string, map: GameMap): Rect {
  const input = requireRecordValue(value, label);
  const rect = {
    x: integerField(input, "x", label),
    y: integerField(input, "y", label),
    w: integerField(input, "w", label),
    h: integerField(input, "h", label),
  };
  if (rect.w <= 0 || rect.h <= 0) throw new ToolError(`${label}.w/h는 1 이상이어야 합니다.`, { code: "invalid-rect", mapId: map.id });
  if (rect.x < 0 || rect.y < 0 || rect.x + rect.w > map.width || rect.y + rect.h > map.height) {
    throw new ToolError(`${label}가 맵 범위를 벗어납니다: (${rect.x},${rect.y}) ${rect.w}×${rect.h}`, { code: "rect-out-of-bounds", mapId: map.id });
  }
  return rect;
}

function parseCharacterFootprint(value: unknown, label: string, mapId: string): NonNullable<FieldSpawnDef["footprint"]> {
  const input = requireRecordValue(value, label);
  const footprint = {
    width: integerField(input, "width", label),
    height: integerField(input, "height", label),
  };
  if (footprint.width <= 0 || footprint.height <= 0) {
    throw new ToolError(`${label}.width/height는 1 이상이어야 합니다.`, { code: "invalid-footprint", mapId });
  }
  return footprint;
}

/** 오류 메시지에 실을 실제 트룹 id 목록(상한 12개 — 프롬프트 폭주 방지). */
function knownTroopIdHint(project: Project): string {
  const ids = project.database.troops.map((troop) => troop.id);
  if (ids.length === 0) return "등록된 트룹이 없습니다 — upsert_troop 으로 먼저 만드세요.";
  const shown = ids.slice(0, 12).join(", ");
  return `사용 가능한 트룹 id: ${shown}${ids.length > 12 ? ` (외 ${ids.length - 12}개)` : ""}`;
}

function assertKnownTroop(project: Project, troopId: string): void {
  if (!project.database.troops.some((troop) => troop.id === troopId)) {
    throw new ToolError(`존재하지 않는 트룹 id: ${troopId} — ${knownTroopIdHint(project)}`, { code: "troop-not-found" });
  }
}

function requireRecordValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ToolError(`${label}는 객체여야 합니다.`, { code: "invalid-object" });
  }
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new ToolError(`${label}.${key}는 문자열이어야 합니다.`, { code: "invalid-field" });
  return value;
}

function numberField(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ToolError(`${label}.${key}는 숫자여야 합니다.`, { code: "invalid-field" });
  return value;
}

function integerField(record: Record<string, unknown>, key: string, label: string): number {
  const value = numberField(record, key, label);
  if (!Number.isInteger(value)) throw new ToolError(`${label}.${key}는 정수여야 합니다.`, { code: "invalid-field" });
  return value;
}

function booleanField(record: Record<string, unknown>, key: string, label: string): boolean {
  const value = record[key];
  if (typeof value !== "boolean") throw new ToolError(`${label}.${key}는 boolean이어야 합니다.`, { code: "invalid-field" });
  return value;
}

function nextFieldSpawnId(map: GameMap, troopId: string): string {
  const base = `hunt_${troopId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const used = new Set((map.fieldSpawns ?? []).map((spawn) => spawn.id));
  if (!used.has(base)) return base;
  for (let index = 2; index < 1000; index += 1) {
    const id = `${base}_${index}`;
    if (!used.has(id)) return id;
  }
  throw new ToolError(`스폰 id를 만들 수 없습니다: ${base}`, { code: "spawn-id-exhausted", mapId: map.id });
}

const bgmSchema: JsonSchema = {
  type: "object",
  properties: {
    mode: { type: "string", enum: ["parent", "none", "custom"] },
    resourceId: { type: "string" },
    fadeInMs: { type: "integer", minimum: 0 },
  },
  required: ["mode"],
  additionalProperties: false,
};

const backgroundSchema: JsonSchema = {
  type: "object",
  properties: {
    imageId: { type: "string" },
    // 상한은 편집기 입력·로드 정규화와 같은 값이어야 한다 — 툴로만 들어가는 값이 생기면
    // 저장한 뒤 다시 열 때 조용히 잘린다.
    scrollX: { type: "number", minimum: -MAP_BACKGROUND_SCROLL_LIMIT, maximum: MAP_BACKGROUND_SCROLL_LIMIT },
    scrollY: { type: "number", minimum: -MAP_BACKGROUND_SCROLL_LIMIT, maximum: MAP_BACKGROUND_SCROLL_LIMIT },
    loopX: { type: "boolean" },
    loopY: { type: "boolean" },
    layers: {
      type: "array",
      description: "\ucd94\uac00 \ubc30\uacbd \ub808\uc774\uc5b4(\ucd5c\ub300 3\uc7a5, \uc55e\uc774 \uc544\ub798). CraftPix \uacc4\uce35 \ubc30\uacbd\uc744 \u00ab\uc138\ud2b8 \uae30\ubcf8 \ub808\uc774\uc5b4\u00bb\ub85c \uac00\uc838 \uc62c\ub54c \uc4f0\ub294\ub2e4.",
      items: {
        type: "object",
        properties: {
          imageId: { type: "string" },
          scrollX: { type: "number", minimum: -MAP_BACKGROUND_SCROLL_LIMIT, maximum: MAP_BACKGROUND_SCROLL_LIMIT },
          scrollY: { type: "number", minimum: -MAP_BACKGROUND_SCROLL_LIMIT, maximum: MAP_BACKGROUND_SCROLL_LIMIT },
          loopX: { type: "boolean" },
          loopY: { type: "boolean" },
        },
        required: ["imageId"],
        additionalProperties: false,
      },
    },
  },
  required: ["imageId"],
  additionalProperties: false,
};

const minimapSchema: JsonSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    corner: { type: "string", enum: ["topRight", "topLeft", "bottomRight", "bottomLeft"] },
    scale: { type: "number", minimum: 0.08, maximum: 0.5 },
    showEvents: { type: "boolean" },
    fogOfWar: { type: "boolean" },
  },
  required: ["enabled"],
  additionalProperties: false,
};

const cloudShadowSchema: JsonSchema = {
  type: "object",
  properties: {
    enabled: { type: "boolean" },
    amount: { type: "integer", minimum: 0, maximum: 6, description: "구름량: 0 없음, 1 적음, 3 보통(기본), 6 많음" },
    opacity: { type: "number", minimum: 0.05, maximum: 0.6 },
    speed: { type: "number", minimum: 0, maximum: 160 },
    angleDeg: { type: "number", minimum: 0, maximum: 359 },
    scale: { type: "number", minimum: 0.5, maximum: 2.5 },
  },
  required: ["enabled"],
  additionalProperties: false,
};

/** 반복 축 가장자리에서 양쪽 칸이 모두 통행 가능한 줄 수(넘어갈 수 있는 자리). */
function loopEdgeOpenings(project: Project, map: GameMap): number {
  let open = 0;
  if (mapLoopsX(map)) for (let y = 0; y < map.height; y++) if (isPassable(project, map, 0, y) && isPassable(project, map, map.width - 1, y)) open++;
  if (mapLoopsY(map)) for (let x = 0; x < map.width; x++) if (isPassable(project, map, x, 0) && isPassable(project, map, x, map.height - 1)) open++;
  return open;
}

// 맵 속성 설정. 크기 변경은 resize_map, 트리 위치는 manage_map_tree로 분리.
const setMapProperties: ToolDefinition = {
  name: "set_map_properties",
  description: "맵 편집기의 전체 속성을 설정한다: 이름·타일셋·인카운트·BGM·배경·전투 배경·저장/이동/도주 제한·미니맵·구름 그림자·기후(실내 차단/고정/상속)·반복 맵(loop: 가장자리가 반대편으로 이어짐 — 끝없는 숲·꿈 세계·반복 복도는 가장자리 이동 이벤트 대신 이것).",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      name: { type: "string" },
      tilesetId: { type: "string" },
      encounterRate: { type: "integer" },
      troopIds: { type: "array", items: { type: "string" } },
      bgm: bgmSchema,
      clearBgm: { type: "boolean" },
      background: backgroundSchema,
      clearBackground: { type: "boolean" },
      battleBackground: { type: "string" },
      clearBattleBackground: { type: "boolean" },
      flags: {
        type: "object",
        properties: { disableSave: { type: "boolean" }, disableTeleport: { type: "boolean" }, disableEscape: { type: "boolean" } },
        additionalProperties: false,
      },
      minimap: minimapSchema,
      clearMinimap: { type: "boolean" },
      cloudShadows: cloudShadowSchema,
      clearCloudShadows: { type: "boolean" },
      climate: mapClimateSchema,
      clearClimate: { type: "boolean" },
      loop: { type: "string", enum: ["none", ...MAP_LOOP_VALUES], description: "반복 맵. horizontal=좌우 끝이 이어짐, vertical=위아래, both=사방, none=끔. 플레이어가 가장자리를 넘으면 반대편 같은 줄에 선다(반대편 칸이 통행 가능해야 한다)." },
    },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const changed: string[] = [];
    const loopWarnings: string[] = [];
    const saveWarnings: string[] = [];
    if (typeof args.name === "string" && args.name.trim()) {
      const nextName = args.name.trim();
      // 같은 장소를 두 맵으로 만들지 않는다. 2026-09-23 도그푸딩에서 조수는 빈 던전 맵(map_frozen_cave)을
      // 두고 마을 집 실내 두 곳의 이름을 「얼어붙은 해안 동굴」「등대 꼭대기 전망대」로 바꿔 던전·보스방으로 썼다
      // — 침대·나무 바닥 그대로, 입구는 마을 집 문, 진짜 던전 맵은 빈 채 미연결로 남았다.
      const namesake = Object.values(draft.maps).find(other => other.id !== map.id && other.name.trim() === nextName);
      if (namesake && map.name.trim() !== nextName) {
        const empty = namesake.events.length === 0 ? " 그 맵은 아직 이벤트가 없습니다 — 그 맵을 시공·연결하세요(던전은 run_dungeon_room_pipeline mapId:" + JSON.stringify(namesake.id) + ")." : "";
        throw new ToolError(
          `'${nextName}' 은 이미 맵 ${namesake.id}(${namesake.width}×${namesake.height})의 이름입니다. 다른 맵(${map.id} '${map.name}')의 이름을 바꿔 같은 장소로 쓰지 마세요.${empty}`,
          { code: "map-name-taken", mapId: map.id },
        );
      }
      map.name = nextName;
      changed.push(`이름='${map.name}'`);
    }
    if (typeof args.tilesetId === "string") {
      ensureDocumentedTileset(draft, args.tilesetId);
      const tileset = draft.tilesets[args.tilesetId];
      if (!tileset) throw new ToolError(`존재하지 않는 타일셋 id: ${args.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
      map.tilesetId = tileset.id;
      map.tileSize = tileset.tileSize;
      changed.push(`타일셋=${tileset.id}`);
    }
    if (typeof args.encounterRate === "number") {
      if (args.encounterRate < 0) throw new ToolError("encounterRate는 0 이상이어야 합니다.");
      map.encounterRate = args.encounterRate;
      changed.push(`인카운트율=${args.encounterRate}`);
    }
    if (Array.isArray(args.troopIds)) {
      const troopIds = (args.troopIds as unknown[]).map(String);
      const known = new Set(draft.database.troops.map((troop) => troop.id));
      const missing = troopIds.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw new ToolError(`존재하지 않는 트룹 id: ${missing.join(", ")} — ${knownTroopIdHint(draft)}`, { code: "troop-not-found" });
      }
      map.troopIds = troopIds;
      changed.push(`트룹 ${troopIds.length}종`);
    }
    if (args.clearBgm === true) {
      delete map.bgm;
      changed.push("BGM=기본");
    } else if (args.bgm && typeof args.bgm === "object" && !Array.isArray(args.bgm)) {
      const bgm = structuredClone(args.bgm) as GameMap["bgm"];
      if (bgm?.mode === "custom" && !bgm.resourceId) throw new ToolError("bgm.mode가 custom이면 resourceId가 필요합니다.", { code: "invalid-args", mapId: map.id });
      map.bgm = bgm;
      changed.push(`BGM=${bgm?.mode}`);
    }
    if (args.clearBackground === true) {
      delete map.background;
      changed.push("배경=기본");
    } else if (args.background && typeof args.background === "object" && !Array.isArray(args.background)) {
      const normalized = normalizeMapBackground(args.background);
      if (!normalized) throw new ToolError("background는 { imageId, scrollX?, scrollY? } 여야 합니다.", { code: "invalid-args" });
      map.background = normalized;
      const layerCount = map.background.layers?.length ?? 0;
      changed.push(`배경=${map.background.imageId}${layerCount > 0 ? ` + 레이어 ${layerCount}장` : ""}`);
    }
    if (args.clearBattleBackground === true) {
      delete map.battleBackground;
      changed.push("전투배경=기본");
    } else if (typeof args.battleBackground === "string" && args.battleBackground.trim()) {
      map.battleBackground = args.battleBackground.trim();
      changed.push(`전투배경=${map.battleBackground}`);
    }
    if (args.flags && typeof args.flags === "object" && !Array.isArray(args.flags)) {
      const flags = args.flags as { disableSave?: boolean; disableTeleport?: boolean; disableEscape?: boolean };
      if (flags.disableSave === true) map.disableSave = true; else delete map.disableSave;
      if (flags.disableTeleport === true) map.disableTeleport = true; else delete map.disableTeleport;
      if (flags.disableEscape === true) map.disableEscape = true; else delete map.disableEscape;
      changed.push("제한 설정");
      // 저장 금지는 이벤트의 저장 메뉴(일기장·세이브 포인트)까지 막는다 — 2026-09-24 꿈 세계 도그푸딩에서 「일기장으로만
      // 저장」하려고 모든 맵에 저장 금지를 걸었고, 일기장이 있는 방까지 막혀 저장할 곳이 사라졌다.
      if (map.disableSave && JSON.stringify(map.events).includes('"kind":"openSaveMenu"')) {
        saveWarnings.push(`${map.name} 에는 저장 메뉴를 여는 이벤트가 있는데 저장 금지를 켰습니다 — 그 이벤트(일기장·세이브 포인트)도 저장할 수 없게 됩니다. 메뉴 저장만 막으려면 이 맵은 저장 금지를 끄세요.`);
      }
    }
    if (args.loop === "none") {
      delete map.loop;
      changed.push("반복=끔");
    } else if (isMapLoop(args.loop)) {
      map.loop = args.loop;
      changed.push(`반복=${mapLoopLabel(map.loop)}`);
      const open = loopEdgeOpenings(draft, map);
      if (open === 0) loopWarnings.push(`반복 가장자리에 양쪽 모두 통행 가능한 칸이 없습니다 — 맵 테두리가 벽·물이면 넘어갈 수 없습니다. 가장자리 줄을 통행 가능한 바닥으로 칠하세요.`);
    }
    if (args.clearMinimap === true) {
      delete map.minimap;
      changed.push("미니맵=끔");
    } else if (args.minimap && typeof args.minimap === "object" && !Array.isArray(args.minimap)) {
      map.minimap = structuredClone(args.minimap) as NonNullable<GameMap["minimap"]>;
      changed.push(`미니맵=${map.minimap.enabled ? "켬" : "끔"}`);
    }
    if (args.clearClimate === true) {
      delete map.climate;
      changed.push("기후=전역 상속");
    } else if (args.climate !== undefined) {
      validateMapClimateInput(args.climate);
      const climate = normalizeMapClimate(args.climate);
      if (!climate) throw new ToolError("climate.mode는 inherit, indoor, fixed 중 하나여야 합니다.", { code: "invalid-args" });
      map.climate = climate;
      changed.push(`기후=${climate.mode}`);
    }
    if (args.clearCloudShadows === true) {
      delete map.cloudShadows;
      changed.push("구름 그림자=끔");
    } else if (args.cloudShadows && typeof args.cloudShadows === "object" && !Array.isArray(args.cloudShadows)) {
      const shadows = structuredClone(args.cloudShadows) as NonNullable<GameMap["cloudShadows"]>;
      const params = normalizeCloudShadowParams(shadows);
      map.cloudShadows = {
        enabled: shadows.enabled === true,
        amount: params.amount,
        opacity: params.opacity,
        speed: params.speed,
        angleDeg: params.angleDeg,
        scale: params.scale,
      };
      changed.push(`구름 그림자=${map.cloudShadows.enabled ? "켬" : "끔"}`);
    }
    if (changed.length === 0) throw new ToolError("바꿀 맵 속성이 없습니다.", { code: "invalid-args", mapId: map.id });
    return { summary: `${map.name} 속성 변경 — ${changed.join(", ")}`, data: { mapId: map.id }, ...(loopWarnings.length || saveWarnings.length ? { warnings: [...loopWarnings, ...saveWarnings] } : {}) };
  },
};

const setEncounterTable: ToolDefinition = {
  name: "set_encounter_table",
  description: "맵의 조건부/가중 랜덤 인카운터 테이블을 교체한다. encounterTable이 있으면 기존 troopIds 균등 선택보다 우선한다. 맵 encounterRate가 0이면 기본 발생률로 자동 보정한다(0이면 런타임에서 인카운터가 아예 발생하지 않는다). 인카운터 구역 요청은 이 툴 또는 make_hunting_ground. 지키는 몬스터는 place_battle_blocker, 함정은 place_trap, 추격전은 make_chase_scene.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      entries: { type: "array", items: encounterEntrySchema },
      encounterRate: { type: "integer", description: "생략하면 0일 때만 기본값으로 보정한다. 0을 명시하면 랜덤 인카운터를 끈다." },
    },
    required: ["mapId", "entries"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const entries = parseEncounterEntries(draft, map, args.entries);
    if (entries.length > 0) map.encounterTable = entries;
    else delete map.encounterTable;
    const rateNote = applyEncounterRate(map, args.encounterRate, entries.length > 0);
    return {
      summary: `${map.name} 인카운터 테이블 ${entries.length}개 항목 설정${rateNote === undefined ? "" : ` — ${rateNote}`}`,
      data: { mapId: map.id, entries, encounterRate: map.encounterRate ?? 0 },
    };
  },
};

const makeHuntingGround: ToolDefinition = {
  name: "make_hunting_ground",
  description: "사냥터 구획에 보이는 몬스터를 배치한다. 프로젝트 위키의 전투 방식과 맵별 예외를 따르며, 접촉·액션 전투에서는 랜덤 인카운터를 끈다. 액션 결정이면 시스템과 대상 맵도 활성화한다. 위키 결정이 없으면 encounterEntries/encounterRate 설정을 사용한다. 지키는 몬스터 한 마리는 place_battle_blocker.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: rectSchema,
      troopId: { type: "string" },
      locationId: {
        type: "string",
        description:
          "이 맵의 로케이션(구역) ID 또는 이름. 주면 area 대신 그 구역 사각형을 스폰 영역으로 쓴다 — 구역을 옮기면 스폰도 따라온다. area 는 폴백으로 함께 보낸다.",
      },
      maxAlive: { type: "integer" },
      respawnSec: { type: "integer" },
      chase: { type: "boolean", description: "생략 시 true(추격). 매복·고정형은 false 명시." },
      graphic: fieldGraphicSchema,
      factionId: { type: "string" },
      footprint: characterFootprintSchema,
      passRows: { type: "integer" },
      persistKill: { type: "boolean" },
      onKillSwitchId: { type: "string" },
      encounterEntries: { type: "array", items: encounterEntrySchema },
      encounterRate: { type: "integer", description: "생략하면 0일 때만 기본값으로 보정한다. 0을 명시하면 랜덤 인카운터를 끈다." },
    },
    required: ["mapId", "area", "troopId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const troopId = args.troopId as string;
    assertKnownTroop(draft, troopId);
    const combat = resolveWikiCombatMode(draft, map.id)
      ?? (isActionCombatMap(draft, map) ? { mode: "action" as const, sourceId: "map.actionCombat" }
        : draft.system.genre === "adventure-jrpg" ? { mode: "contact" as const, sourceId: "system.genre" } : undefined);
    const area = parseRect(args.area, "area", map);
    const spawn = parseFieldSpawn(draft, map, {
      id: nextFieldSpawnId(map, troopId),
      troopId,
      area,
      ...(args.locationId !== undefined ? { locationId: args.locationId } : {}),
      ...(args.maxAlive !== undefined ? { maxAlive: args.maxAlive } : {}),
      ...(args.respawnSec !== undefined ? { respawnSec: args.respawnSec } : {}),
      chase: args.chase !== false,
      ...(args.graphic !== undefined ? { graphic: args.graphic } : {}),
      ...(args.factionId !== undefined ? { factionId: args.factionId } : {}),
      ...(args.footprint !== undefined ? { footprint: args.footprint } : {}),
      ...(args.passRows !== undefined ? { passRows: args.passRows } : {}),
      ...(args.persistKill !== undefined ? { persistKill: args.persistKill } : {}),
      ...(args.onKillSwitchId !== undefined ? { onKillSwitchId: args.onKillSwitchId } : {}),
    }, "fieldSpawn");
    map.fieldSpawns = [...(map.fieldSpawns ?? []), spawn];
    if (combat && combat.mode !== "random") {
      map.actionCombat = combat.mode === "action";
      if (combat.mode === "action") draft.system.actionCombat = { ...draft.system.actionCombat, enabled: true };
      map.encounterRate = 0;
      delete map.encounterTable;
      return {
        summary: `${map.name} — 보이는 몬스터 배치 (${combat.mode === "action" ? "맵 위 직접 전투" : "접촉 시 전투 화면"})`,
        data: { mapId: map.id, fieldSpawn: spawn, encounterRate: 0, combatMode: combat.mode, sourceId: combat.sourceId },
      };
    }
    const entries = args.encounterEntries !== undefined
      ? parseEncounterEntries(draft, map, args.encounterEntries)
      : [{ troopId, weight: 1, conditions: { region: area } }];
    if (entries.length > 0) map.encounterTable = entries;
    else delete map.encounterTable;
    const rateNote = applyEncounterRate(map, args.encounterRate, entries.length > 0);
    return {
      summary: `${map.name} 사냥터 구성 — 스폰 ${spawn.id}, 트룹 ${troopId}, 인카운터 ${entries.length}개${rateNote === undefined ? "" : ` — ${rateNote}`}`,
      data: { mapId: map.id, fieldSpawn: spawn, encounterTable: entries, encounterRate: map.encounterRate ?? 0 },
    };
  },
};

const configureRoguelikeRoom: ToolDefinition = {
  name: "configure_roguelike_room",
  description: "맵의 로그라이크 방 조우 슬롯과 이벤트 리셋 정책을 설정한다. 각 슬롯은 fieldSpawns 후보 중 하나를 런 seed·층·방·리셋 횟수로 결정적으로 선택한다. 기본적으로 새 방 세대는 셀프 스위치와 Erase Event 상태도 초기화한다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      roomId: { type: "string", description: "생략 시 mapId" },
      resetEventState: { type: "boolean", description: "방 세대 변경 시 셀프 스위치/Erase Event 상태 초기화(기본 true)" },
      slots: { type: "array", items: roguelikeEncounterSlotSchema },
      clear: { type: "boolean", description: "true면 기존 로그라이크 방 설정 제거" },
    },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    if (args.clear === true) {
      delete map.roguelikeRoom;
      return { summary: `${map.name} 로그라이크 방 설정 제거`, data: { mapId: map.id } };
    }
    const room = parseRoguelikeRoom(map, args);
    map.roguelikeRoom = room;
    return {
      summary: `${map.name} 로그라이크 방 설정 — 슬롯 ${room.encounterSlots?.length ?? 0}개`,
      data: { mapId: map.id, roguelikeRoom: room },
    };
  },
};

const createFarmPlot: ToolDefinition = {
  name: "create_farm_plot",
  description: "맵의 경작 가능 영역(farmableArea)을 선언한다. 타일/울타리/흙 연출은 변경하지 않는다. 밭·농장 요청의 정본 툴.",
  mode: "write",
  domains: ["database", "map"],
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      area: rectSchema,
    },
    required: ["mapId", "area"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const area = parseRect(args.area, "area", map);
    map.farmableArea ??= [];
    const duplicate = map.farmableArea.some((rect) => rect.x === area.x && rect.y === area.y && rect.w === area.w && rect.h === area.h);
    if (!duplicate) map.farmableArea.push(area);
    return {
      summary: `맵 '${map.name}' 경작 가능 영역 선언 (${area.x},${area.y},${area.w}x${area.h})${duplicate ? " — 기존 영역 재사용" : ""}`,
      data: { mapId: map.id, area },
    };
  },
};

// 맵 크기 변경(좌상단 기준 유지, 확장부는 잔디/빈 칸). 이벤트가 잘려 나가는 축소는 거부한다.
const resizeMapTool: ToolDefinition = {
  name: "resize_map",
  description: `맵 크기를 바꾼다(좌상단 기준, 확장부는 잔디, 최대 ${MAX_TOOL_MAP_DIMENSION}×${MAX_TOOL_MAP_DIMENSION}). 축소로 이벤트가 범위 밖에 나가면 거부 — 먼저 move_event/remove_event로 정리하라.`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      width: { type: "integer", description: `3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION}` },
      height: { type: "integer", description: `3 이상, 최대 ${MAX_TOOL_MAP_DIMENSION}` },
    },
    required: ["mapId", "width", "height"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const width = args.width as number;
    const height = args.height as number;
    if (width < 3 || height < 3) throw new ToolError("맵 크기는 최소 3x3 이상이어야 합니다.");
    assertToolMapSize(width, height);
    const outEvents = map.events.filter((event) => event.x >= width || event.y >= height);
    if (outEvents.length > 0) {
      throw new ToolError(
        `축소 범위 밖 이벤트 ${outEvents.length}개: ${outEvents.slice(0, 5).map((event) => `${event.id}(${event.x},${event.y})`).join(", ")} — 먼저 옮기거나 지우세요.`,
        { code: "events-out-of-bounds", mapId: map.id }
      );
    }
    if (draft.startMapId === map.id && (draft.startPos.x >= width || draft.startPos.y >= height)) {
      throw new ToolError(`시작 좌표 (${draft.startPos.x},${draft.startPos.y})가 새 크기 밖입니다 — set_start_position으로 먼저 옮기세요.`, { code: "start-out-of-bounds" });
    }
    const oldW = map.width;
    const oldH = map.height;
    const newLower = new Array<number>(width * height).fill(TILE.GRASS);
    const newUpper = new Array<number>(width * height).fill(TILE.EMPTY);
    for (let y = 0; y < Math.min(oldH, height); y += 1) {
      for (let x = 0; x < Math.min(oldW, width); x += 1) {
        newLower[y * width + x] = map.lowerTiles[y * oldW + x];
        newUpper[y * width + x] = map.upperTiles[y * oldW + x];
      }
    }
    const nextLowerStacks = resizedTileStacks(map.lowerTileStacks, oldW, oldH, width, height);
    const nextUpperStacks = resizedTileStacks(map.upperTileStacks, oldW, oldH, width, height);
    // 2층·4층·그림자도 같은 좌상단 기준으로 옮긴다 — 옛 길이로 남으면 로드가 깨진다.
    cropExtraLayers(map, oldW, oldH, 0, 0, width, height);
    map.width = width;
    map.height = height;
    map.lowerTiles = newLower;
    map.upperTiles = newUpper;
    if (nextLowerStacks) map.lowerTileStacks = nextLowerStacks;
    else delete map.lowerTileStacks;
    if (nextUpperStacks) map.upperTileStacks = nextUpperStacks;
    else delete map.upperTileStacks;
    return { summary: `${map.name} 크기 변경 ${oldW}×${oldH} → ${width}×${height}`, data: { mapId: map.id, width, height } };
  },
};

// 맵 삭제(파괴적). 시작 맵/마지막 맵은 거부. mapTree/연결/이동 명령 등 참조는 재배선/정리되고,
// 삭제 결과가 재로드(shape) 검증을 통과하지 못하면 차단된다(무결성 가드 — 도그푸딩 결함 ①).
const removeMapTool: ToolDefinition = {
  name: "remove_map",
  description:
    "맵을 삭제한다(파괴적 — 꼭 필요할 때만, 이유를 먼저 설명). 시작 맵은 삭제 불가. 맵 트리/연결/이동(transfer) 참조는 함께 정리되며, 무결성 검증에 실패하면 거부된다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: { mapId: { type: "string" } },
    required: ["mapId"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    // 에이전트 경로는 시작 맵 삭제를 차단(암묵 재배선 금지) — 먼저 시작 위치를 옮기게 한다.
    if (draft.startMapId === map.id) throw new ToolError("시작 맵은 삭제할 수 없습니다 — 먼저 set_start_position으로 시작 맵을 옮기세요.", { code: "start-map" });
    const plan = planMapDeletion(draft, map.id);
    if (!plan.ok) throw new ToolError(plan.block.message, { code: plan.block.code });
    const name = map.name;
    applyMapDeletion(draft, map.id);
    const impact = plan.impact;
    const cleaned = [
      impact.incomingCommandCount > 0 ? `이동 명령 ${impact.incomingCommandCount}개` : null,
      impact.connectionCount > 0 ? `맵 연결 ${impact.connectionCount}개` : null,
      impact.questCount > 0 ? `퀘스트 ${impact.questCount}개` : null,
    ].filter(Boolean);
    return {
      summary: `맵 '${name}'(${map.id}) 삭제됨${cleaned.length > 0 ? ` — 함께 정리: ${cleaned.join(", ")}` : ""}`,
      data: { mapId: map.id, impact },
    };
  },
};

const shiftMap: ToolDefinition = {
  name: "shift_map",
  description: "맵 내용 밀기: 타일·이벤트·시작 위치를 dx/dy만큼 이동한다. 맵 편집기의 내용 이동과 같다.",
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      dx: { type: "integer" },
      dy: { type: "integer" },
    },
    required: ["mapId", "dx", "dy"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, args.mapId as string);
    const dx = args.dx as number;
    const dy = args.dy as number;
    if (!Number.isInteger(dx) || !Number.isInteger(dy)) {
      throw new ToolError("dx와 dy는 정수여야 합니다.", { code: "invalid-args", mapId: map.id });
    }
    if (!applyMapShift(draft, map.id, { dx, dy })) {
      throw new ToolError("이동할 오프셋이 없습니다.", { code: "invalid-args", mapId: map.id });
    }
    return { summary: `${map.name} 내용 (${dx}, ${dy}) 이동`, data: { mapId: map.id, dx, dy } };
  },
};

// ── copy_map_region ──
// 맵 편집기의 영역 선택→복사→붙여넣기(editor/mapClipboard.ts)를 툴로 노출한다.
// mirror_region(제자리 대칭)·shift_map(맵 전체 밀기)·stamp_structure(템플릿 도장)로는
// "이 영역을 저기로 복제"가 표현되지 않았다(2026-08-26 도달성 감사 CONFIRMED GAP).

type CopyLayers = "all" | "lower" | "upper";
type CopyOverExisting = "clear" | "keep";

interface CopySourceCell {
  readonly dx: number;
  readonly dy: number;
  readonly lower: number;
  readonly upper: number;
  /** 2층·4층·그림자(MZ 4층). 원본에 선택 칸이 없으면 빈칸(-1/0) — 목적지에 새 키를 만들지 않는다. */
  readonly lowerOverlay: number;
  readonly upperOverlay: number;
  readonly shadow: number;
}

interface CopyProtectedSkip {
  readonly x: number;
  readonly y: number;
  readonly reason: string;
}

interface CopyEventSkip {
  readonly eventId: string;
  readonly x: number;
  readonly y: number;
}

interface CopyEventAdjustment extends CopyEventSkip {
  readonly toX: number;
  readonly toY: number;
}

function copyRegionRect(args: Record<string, unknown>, field: string): { mapId: string; x: number; y: number; w: number; h: number } {
  const raw = args[field];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ToolError(`${field}는 객체여야 합니다.`, { code: "invalid-args" });
  }
  return raw as { mapId: string; x: number; y: number; w: number; h: number };
}

// 시작 위치·transfer 목적지는 통행이 보장돼야 하는 칸이다. fill_region/tile_erase 와 같은 정책:
// 그 칸을 통행 불가로 만드는 쓰기만 건너뛰고 경고하며, 편집 전체를 거부하지 않는다.
// clear_map(fill=empty)과 copy_map_region 이 함께 쓴다 — 둘 다 통행 보장 칸을 불가로 만들 수 있다.
function passageProtectedCells(project: Project, map: GameMap): Map<string, string> {
  const cells = new Map<string, string>();
  if (project.startMapId === map.id) cells.set(`${project.startPos.x},${project.startPos.y}`, "시작 위치");
  visitProjectCommands(project, ({ command }) => {
    if (command.kind === "transfer" && command.mapId === map.id) cells.set(`${command.x},${command.y}`, "transfer 목적지");
  });
  return cells;
}

function copySkipWarnings(skipped: readonly CopyProtectedSkip[]): string[] {
  if (skipped.length === 0) return [];
  const samples = skipped.slice(0, 3).map((cell) => `(${cell.x},${cell.y})은 ${cell.reason}라 제외했습니다`);
  const extra = skipped.length > samples.length ? ` 외 ${skipped.length - samples.length}칸` : "";
  return [`${samples.join(", ")}${extra}`];
}

function copyEventWarnings(skipped: readonly CopyEventSkip[], adjusted: readonly CopyEventAdjustment[]): string[] {
  const warnings: string[] = [];
  if (skipped.length > 0) {
    const samples = skipped.slice(0, 5).map((event) => `${event.eventId}(${event.x},${event.y})`);
    const extra = skipped.length > samples.length ? ` 외 ${skipped.length - samples.length}건` : "";
    warnings.push(`통행 가능한 착지점을 찾지 못한 이벤트 ${skipped.length}개 제외: ${samples.join(", ")}${extra}`);
  }
  if (adjusted.length > 0) {
    const samples = adjusted.slice(0, 5).map((event) => `${event.eventId} (${event.x},${event.y}) → (${event.toX},${event.toY})`);
    const extra = adjusted.length > samples.length ? ` 외 ${adjusted.length - samples.length}건` : "";
    warnings.push(`이벤트 ${adjusted.length}개 위치 자동 조정: ${samples.join(", ")}${extra}`);
  }
  return warnings;
}

// 그래픽이 보이거나 자율 이동하는 페이지는 action 트리거여도 문이 아니라 캐릭터다.
function copyEventIsCharacter(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) =>
    (page.graphic.transparent !== true && page.graphic.sprite !== undefined)
    || page.movement.type !== "fixed"
  );
}

// duplicate_event 와 같은 판정: 페이지가 있으면 페이지 trigger/priority를, 없으면 본체 trigger를 읽는다.
function copyEventIsSteppable(event: GameEvent): boolean {
  const pages = event.pages ?? [];
  if (pages.some((page) => (page.trigger.kind === "touch" || page.trigger.kind === "playerTouch") && page.priority !== "same")) return true;
  if (pages.length > 0) return false;
  return event.trigger.kind === "touch" || event.trigger.kind === "playerTouch";
}

// duplicate_map/duplicate_event 와 같은 발급 방식(genId + 프로젝트 전역 사용 중 id 회피)을 쓴다.
function copyEventIdAllocator(project: Project): () => string {
  const used = new Set<string>(
    Object.values(project.maps).flatMap((map) => map.events.flatMap((event) => [event.id, ...(event.pages ?? []).map((page) => page.id)]))
  );
  return (): string => {
    let candidate = genId("ev_copy");
    while (used.has(candidate)) candidate = genId("ev_copy");
    used.add(candidate);
    return candidate;
  };
}

const copyMapRegion: ToolDefinition = {
  name: "copy_map_region",
  description:
    "맵의 사각 영역을 다른 위치/다른 맵으로 복사한다(맵 편집기의 영역 선택→복사→붙여넣기와 같다). "
    + "쓰는 저작 데이터: 목적지 맵의 하위·상위 타일(1~4층·그림자), withEvents면 목적지 맵의 이벤트(새 id로 복제). 원본은 그대로 남는다. "
    + "layers: all(기본, 1~4층·그림자)|lower(1·2층)|upper(3·4층). overExisting: clear(기본, 목적지 내용을 덮어씀)|keep(목적지에 이미 타일이 있는 칸은 건드리지 않음). "
    + "같은 맵 안에서 겹치는 영역으로도 안전하게 복사된다. 시작 위치·transfer 목적지를 통행 불가로 덮는 칸은 건너뛰고 경고한다. "
    + "오토타일 경계는 보정하지 않는다 — 제자리 대칭은 mirror_region, 맵 전체 밀기는 shift_map.",
  mode: "write",
  invalidArgsExample: { from: { mapId: "map_1", x: 2, y: 3, w: 6, h: 4 }, to: { mapId: "map_2", x: 10, y: 8 } },
  parameters: {
    type: "object",
    properties: {
      from: {
        type: "object",
        description: "복사할 원본 영역(맵 좌표)",
        properties: { mapId: { type: "string" }, ...(RECT_SCHEMA.properties ?? {}) },
        required: ["mapId", ...(RECT_SCHEMA.required ?? [])],
      },
      to: {
        type: "object",
        description: "붙여넣을 목적지 좌상단(다른 맵 id도 가능)",
        properties: { mapId: { type: "string" }, ...(COORD_SCHEMA.properties ?? {}) },
        required: ["mapId", ...(COORD_SCHEMA.required ?? [])],
      },
      layers: { type: "string", enum: ["all", "lower", "upper"], description: "복사할 레이어(기본 all)" },
      withEvents: { type: "boolean", description: "영역 안 이벤트도 복제할지(기본 false)" },
      overExisting: { type: "string", enum: ["clear", "keep"], description: "목적지에 이미 타일이 있을 때(기본 clear=덮어씀, keep=보존)" },
    },
    required: ["from", "to"],
    additionalProperties: false,
  },
  run(draft, args): ToolExecResult {
    const from = copyRegionRect(args, "from");
    const to = copyRegionRect(args, "to");
    const source = requireMap(draft, from.mapId);
    const target = requireMap(draft, to.mapId);
    if (!Number.isInteger(from.w) || !Number.isInteger(from.h) || from.w < 1 || from.h < 1) {
      throw new ToolError("from.w/h는 1 이상의 정수여야 합니다.", { code: "invalid-args", mapId: source.id });
    }
    if (from.x < 0 || from.y < 0 || from.x + from.w > source.width || from.y + from.h > source.height) {
      throw new ToolError(
        `복사할 영역이 맵(${source.width}×${source.height}) 밖입니다: (${from.x},${from.y}) ${from.w}×${from.h}`,
        { code: "region-out-of-bounds", mapId: source.id, x: from.x, y: from.y }
      );
    }
    if (to.x < 0 || to.y < 0 || to.x + from.w > target.width || to.y + from.h > target.height) {
      throw new ToolError(
        `붙여넣을 영역이 맵(${target.width}×${target.height}) 밖입니다: (${to.x},${to.y}) ${from.w}×${from.h}`,
        { code: "region-out-of-bounds", mapId: target.id, x: to.x, y: to.y }
      );
    }
    const layers = (args.layers as CopyLayers | undefined) ?? "all";
    const overExisting = (args.overExisting as CopyOverExisting | undefined) ?? "clear";
    const withEvents = args.withEvents === true;
    const writeLower = layers !== "upper";
    const writeUpper = layers !== "lower";

    // 같은 맵에서 겹치는 영역으로 복사할 때 읽으면서 쓰면 원본이 먼저 덮여 타일이 오염된다.
    // 그래서 목적지에 한 칸도 쓰기 전에 소스를 전부 버퍼에 담는다(맵 편집기 클립보드와 같은 순서).
    const buffer: CopySourceCell[] = [];
    for (let dy = 0; dy < from.h; dy += 1) {
      for (let dx = 0; dx < from.w; dx += 1) {
        const index = (from.y + dy) * source.width + from.x + dx;
        buffer.push({
          dx, dy, lower: source.lowerTiles[index], upper: source.upperTiles[index],
          lowerOverlay: layerTileAt(source, 2, index), upperOverlay: layerTileAt(source, 4, index), shadow: shadowAt(source, index),
        });
      }
    }

    const protectedCells = passageProtectedCells(draft, target);
    const skipped: CopyProtectedSkip[] = [];
    let copied = 0;
    let kept = 0;
    for (const cell of buffer) {
      const x = to.x + cell.dx;
      const y = to.y + cell.dy;
      const index = y * target.width + x;
      const beforeLower = target.lowerTiles[index];
      const beforeUpper = target.upperTiles[index];
      const beforeLowerOverlay = layerTileAt(target, 2, index);
      const beforeUpperOverlay = layerTileAt(target, 4, index);
      const beforeShadow = shadowAt(target, index);
      // overExisting=keep 은 "이미 뭔가 있는 칸은 건드리지 않는다" — 레이어별로 판단한다.
      const putLower = writeLower && (overExisting === "clear" || beforeLower === TILE.EMPTY);
      const putUpper = writeUpper && (overExisting === "clear" || beforeUpper === TILE.EMPTY);
      if (!putLower && !putUpper) {
        kept += 1;
        continue;
      }
      // 2층은 1층과, 4층은 3층과 함께 간다. 그림자는 칸 전체(all)를 옮길 때 바닥과 함께 간다.
      if (putLower) {
        target.lowerTiles[index] = cell.lower;
        setLayerTileAt(target, 2, index, cell.lowerOverlay);
        if (layers === "all") setShadowAt(target, index, cell.shadow);
      }
      if (putUpper) {
        target.upperTiles[index] = cell.upper;
        setLayerTileAt(target, 4, index, cell.upperOverlay);
      }
      const reason = protectedCells.get(`${x},${y}`);
      // 보호 칸은 쓴 결과가 통행 가능한지 실측하고, 막히면 원래 타일로 되돌린다(부분 스킵 정책).
      if (reason !== undefined && !isPassable(draft, target, x, y)) {
        target.lowerTiles[index] = beforeLower;
        target.upperTiles[index] = beforeUpper;
        setLayerTileAt(target, 2, index, beforeLowerOverlay);
        setLayerTileAt(target, 4, index, beforeUpperOverlay);
        setShadowAt(target, index, beforeShadow);
        skipped.push({ x, y, reason });
        continue;
      }
      copied += 1;
    }

    compactMapLayers(target);

    const copiedEventIds: string[] = [];
    const skippedEvents: CopyEventSkip[] = [];
    const adjustedEvents: CopyEventAdjustment[] = [];
    if (withEvents) {
      const nextId = copyEventIdAllocator(draft);
      const inside = source.events.filter(
        (event) => event.x >= from.x && event.x < from.x + from.w && event.y >= from.y && event.y < from.y + from.h
      );
      for (const event of inside) {
        const requestedX = to.x + (event.x - from.x);
        const requestedY = to.y + (event.y - from.y);
        const cloneId = nextId();
        let placement: { x: number; y: number; adjusted: boolean };
        try {
          placement = resolveEventPlacement(draft, target, requestedX, requestedY, {
            kind: copyEventIsCharacter(event) ? "character" : "interaction",
            steppable: copyEventIsSteppable(event),
            ignoreEventId: cloneId,
            label: `복제 이벤트 '${event.id}'`,
            code: "copy-region-event-impassable",
          });
        } catch (error) {
          if (!(error instanceof ToolError)) throw error;
          skippedEvents.push({ eventId: event.id, x: requestedX, y: requestedY });
          continue;
        }
        // duplicate_event도 같은 캐릭터 판정 약점이 있지만, 단건 사용자 지시인 그 경로와 달리 이 경로는 대량 복제라 여기서 분류한다.
        // duplicate_event 와 같은 규약: 커맨드는 그대로 두고 id·좌표만 새로 잡는다
        // (transfer 목적지를 임의로 다시 배선하면 저자 의도를 조용히 바꾼다).
        const clone: GameEvent = {
          ...structuredClone(event),
          id: cloneId,
          x: placement.x,
          y: placement.y,
        };
        if (clone.pages) clone.pages = clone.pages.map((page) => ({ ...page, id: nextId() }));
        target.events.push(clone);
        copiedEventIds.push(clone.id);
        if (placement.adjusted) {
          adjustedEvents.push({ eventId: event.id, x: requestedX, y: requestedY, toX: placement.x, toY: placement.y });
        }
      }
    }

    const where = source.id === target.id ? "같은 맵" : target.name;
    const notes = [
      kept > 0 ? `기존 유지 ${kept}칸` : null,
      skipped.length > 0 ? `보호 ${skipped.length}칸 제외` : null,
      copiedEventIds.length > 0 ? `이벤트 ${copiedEventIds.length}개 복제` : null,
      skippedEvents.length > 0 ? `이벤트 ${skippedEvents.length}개 제외` : null,
    ].filter((note): note is string => note !== null);
    const warnings = [...copySkipWarnings(skipped), ...copyEventWarnings(skippedEvents, adjustedEvents)];
    return {
      summary: `${source.name} (${from.x},${from.y}) ${from.w}×${from.h} → ${where} (${to.x},${to.y}) 복사 — ${copied}/${buffer.length}칸(${layers})${notes.length > 0 ? `, ${notes.join(", ")}` : ""}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: {
        fromMapId: source.id,
        toMapId: target.id,
        copied,
        requested: buffer.length,
        kept,
        skipped: skipped.length,
        layers,
        overExisting,
        events: copiedEventIds,
        eventsCopied: copiedEventIds.length,
        eventsSkipped: skippedEvents.length,
      },
    };
  },
};

export const MAP_TOOLS: readonly ToolDefinition[] = [createMap, duplicateMap, manageMapTree, paintTiles, paintRoad, stampStructure, previewHouse, buildHouse, clearRegion, clearMap, mirrorRegion, copyMapRegion, setStartPosition, setTilePassability, setMapProperties, setEncounterTable, makeHuntingGround, configureRoguelikeRoom, createFarmPlot, resizeMapTool, shiftMap, removeMapTool];

// 스키마 참조를 정적으로 검증하기 위한 도우미(사용처 없어도 트리 셰이킹 안전).
export type { JsonSchema };
