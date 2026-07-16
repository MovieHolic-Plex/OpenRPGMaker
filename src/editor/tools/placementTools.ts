import { buildGroupSample, type GroupSample } from "@/ai/groupSampleBuilder";
import { TILE } from "@/project/defaults/constants";
import { isRoadTile } from "@/project/defaults/roadAutotile";
import { isSandTile } from "@/project/defaults/sandAutotile";
import { isCobbleTile } from "@/project/defaults/cobbleAutotile";
import { isLakeAutotileTile } from "@/project/defaults/lakeAutotile";
import { isTreeCanopyTileId, isTreeTrunkTileId, isUpperOnlyOverlayTile } from "@/project/tilesetHarness";
import type { Command, GameMap, PaletteSlotRole, Project, TileGroupMetadata, TilesetDef } from "@/project/types";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { inMapBounds, passabilityWarning, requireMap, setLower, type Point } from "./mapHelpers";
import { hardClusterRuleCount, nonEmptyFootprintTileCount } from "./clusterRulePlacement";
import { clusterScatter, poissonScatter, type ScatterBounds } from "./naturalScatter";
import { naturalnessArg, naturalnessLabel, NATURALNESS_GUIDANCE, rngForTool, seedForTool } from "./naturalToolArgs";
import { paletteTilePickerForTool, type PaletteTilePicker } from "./paletteToolArgs";
import { placementSoftPenalty } from "./placementScoring";
import { resolvePlacementStructure, type StructureCellEdit } from "./placementStructure";
import { ToolError, type JsonSchema, type ToolDefinition, type ToolExecResult } from "./types";

type Area = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
type Rect = Area;
type ScatterMode = "uniform" | "poisson" | "cluster";
type RecordValue = { readonly [key: string]: unknown };
type ScatterArgs = {
  readonly mapId: string;
  readonly groupId?: string;
  readonly area: Area;
  readonly count: number;
  readonly minGap: number;
  readonly maxGap: number;
  readonly naturalness: number;
  readonly mode: ScatterMode;
  readonly seed?: number;
  readonly avoidProtected: boolean;
  readonly preferSoftRules: boolean;
  readonly applyStructure: boolean;
};
type Footprint = { readonly w: number; readonly h: number; readonly lower: readonly number[]; readonly upper: readonly number[] };
type ChooseInput = {
  readonly choices: readonly Point[];
  readonly allowed: readonly Point[];
  readonly placed: readonly Rect[];
  readonly footprint: Footprint;
  readonly minGap: number;
  readonly seed: string;
  readonly step: number;
  readonly map: GameMap;
  readonly group: TileGroupMetadata;
  readonly preferSoftRules: boolean;
};
type UniformChooseInput = Omit<ChooseInput, "choices"> & {
  readonly maxGap: number;
};
type RankedChooseInput = {
  readonly allowed: readonly Point[];
  readonly choices: readonly Point[];
  readonly footprint: Footprint;
  readonly group: TileGroupMetadata;
  readonly map: GameMap;
  readonly minGap: number;
  readonly placed: readonly Rect[];
  readonly preferSoftRules: boolean;
  readonly rankByPoint: ReadonlyMap<string, number>;
  readonly remaining: number;
};

const AREA_SCHEMA: JsonSchema = {
  type: "object",
  properties: { x: { type: "integer" }, y: { type: "integer" }, w: { type: "integer" }, h: { type: "integer" } },
  required: ["x", "y", "w", "h"],
};

/**
 * 산포 엔진 — place_props(v3)와 레거시 scatter_object 툴이 공유.
 * 새 코드는 ToolDefinition 이름 대신 이 함수를 호출할 것.
 */
export function runScatterObject(draft: Project, rawArgs: Record<string, unknown>): ToolExecResult {
    const args = parseArgs(rawArgs);
    const map = requireMap(draft, args.mapId);
    const tileset = draft.tilesets[map.tilesetId];
    if (!tileset) throw new ToolError(`타일셋을 찾을 수 없습니다: ${map.tilesetId}`, { code: "tileset-not-found", mapId: map.id });
    const picker = paletteTilePickerForTool(tileset, rawArgs, scatterSeedSignature(map, args));
    if (!picker && !args.groupId) throw new ToolError("scatter_object에는 groupId 또는 presetId+paletteRole이 필요합니다.", { code: "invalid-args", mapId: map.id });
    const group = picker ? syntheticPaletteGroup(picker) : groupById(map, draft, args.groupId as string);
    // 문법 없는 다수 타일 prop 가방(소품 잡동사니)은 1칸씩 랜덤 타일로 뿌린다.
    // 전체를 세로 쌍/한 줄 스탬프로 묶으면 벤치 좌우 타일이 위아래로 붙는 버그가 난다.
    const bagProp = !picker && isBagPropGroup(group);
    const footprint = picker
      ? singleTileFootprint()
      : bagProp
        ? singleUpperPropFootprint(group.tileIds[0] ?? TILE.EMPTY, tileset)
        : treeLayeredFootprint(group, tileset)
          ?? oneInstance(buildGroupSample(tileset, {
            role: group.role,
            tileIds: group.tileIds,
            patternGrammar: group.patternGrammar,
          }), group, tileset);
    const protectedCells = args.avoidProtected ? protectedEventCells(draft, map) : new Set<string>();
    const candidates = origins(map, args.area, footprint).filter((origin) => footprintFits(map, footprint, origin, protectedCells));
    const legacySeed = scatterSeedSignature(map, args);
    const seed = args.seed === undefined ? legacySeed : String(args.seed);
    const ranked = args.mode === "uniform" ? null : rankedNaturalCandidates({ args, candidates, footprint, legacySeed, map });
    const placed: Rect[] = [];
    const footprints: Footprint[] = [];
    for (let step = 0; step < args.count; step += 1) {
      const stepFootprint = bagProp
        ? bagPropFootprint(group, tileset, seed, step)
        : footprint;
      const sourceCandidates = ranked?.ordered ?? candidates;
      // 성능 캡(2026-07-17): 스텝마다 전 후보(면적 규모)를 재검사·재채점하면 대형 맵에서
      // count×면적 곱으로 폭주한다(100×100 침엽수 84그루 = 수백 초). ranked는 이미
      // 자연도 순 정렬이라 "상위 512개 중 선택"이 의미를 보존한다. uniform은 전수 유지.
      const allowedCap = ranked ? 512 : Number.POSITIVE_INFINITY;
      const allowed: typeof candidates = [];
      for (const origin of sourceCandidates) {
        if (allowed.length >= allowedCap) break;
        if (!footprintFits(map, stepFootprint, origin, protectedCells)) continue;
        // 숲: 레이어가 다르면 발자국이 겹쳐도 됨(수관 upper + 밑동 lower).
        if (!layeredSpaced(rectAt(origin, stepFootprint), stepFootprint, placed, footprints, args.minGap)) continue;
        allowed.push(origin);
      }
      if (allowed.length === 0) break;
      const remaining = args.count - placed.length;
      const chosen = ranked
        ? chooseRanked({
          allowed,
          choices: allowed,
          placed,
          footprint: stepFootprint,
          minGap: args.minGap,
          map,
          group,
          preferSoftRules: args.preferSoftRules,
          rankByPoint: ranked.rankByPoint,
          remaining,
        })
        : chooseUniform({ allowed, placed, footprint: stepFootprint, minGap: args.minGap, maxGap: args.maxGap, seed, step, map, group, preferSoftRules: args.preferSoftRules });
      placed.push(rectAt(chosen, stepFootprint));
      footprints.push(stepFootprint);
    }
    const touched = placed.flatMap((rect, index) => {
      if (picker) return paintPaletteTile(map, tileset, picker, { x: rect.x, y: rect.y });
      return paint(map, footprints[index] ?? footprint, { x: rect.x, y: rect.y });
    });
    const structureTouched = args.applyStructure && ((group.junctions?.length ?? 0) > 0 || (group.overlays?.length ?? 0) > 0)
      ? applyStructureEdits(map, resolvePlacementStructure({ map, tileset, group, placed }))
      : [];
    const skipped = args.count - placed.length;
    const warning = passabilityWarning(draft, map, [...touched, ...structureTouched]);
    const atomicTileCount = picker ? 1 : nonEmptyFootprintTileCount(footprint);
    const clusterNote = !picker && hardClusterRuleCount(group) > 0
      ? ` = ${placed.length * atomicTileCount}타일(클러스터 동반 배치 포함)`
      : "";
    const sourceName = picker ? `${picker.presetId}/${picker.role}` : group.name;
    return {
      summary: `${map.name}에 ${sourceName} ${placed.length}개${clusterNote} 배치(${args.mode}, 자연도 ${naturalnessLabel(args.naturalness)}, 간격 ${args.minGap}~${args.maxGap})${skipped > 0 ? ` — ${skipped}개 건너뜀: 보호셀/간격/공간 부족` : ""}`,
      data: { mode: args.mode, naturalness: args.naturalness, placed: placed.length, requested: args.count, skipped, tilesPlaced: placed.length * atomicTileCount },
      warnings: warning ? [warning] : undefined,
    };
}

const scatterObject: ToolDefinition = {
  name: "scatter_object",
  description: `타일 그룹 오브젝트를 영역 안에 여러 개 흩뿌려 배치한다. 프리셋이 있으면 groupId 대신 presetId+paletteRole을 우선 사용하라. 풋프린트 단위로 원자 배치하며 시작칸/이벤트/transfer/상위 타일·물·흙길/모래길·통행 불가 하층 보호셀을 피한다(avoidProtected 기본 true). poisson/cluster는 자연 샘플 rank 를 따르며, 요청 개수를 채울 수 없는 후보만 제외한다. ${NATURALNESS_GUIDANCE}`,
  mode: "write",
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      groupId: { type: "string" },
      presetId: { type: "string", description: "팔레트 프리셋 id. 지정 시 paletteRole과 함께 1×1 타일 산포" },
      paletteRole: { type: "string", description: "팔레트 role. presetId와 함께 지정" },
      area: AREA_SCHEMA,
      count: { type: "integer" },
      minGap: { type: "integer", description: "오브젝트 사이 최소 빈 칸 수(기본 1)" },
      maxGap: { type: "integer", description: "흩뿌림 후보를 고를 때 선호하는 최대 빈 칸 수(기본 3)" },
      naturalness: { type: "number", description: "0~1 자연도. <0.3 uniform, 0.3~0.7 poisson, >0.7 cluster(기본 0.5)" },
      mode: { type: "string", enum: ["uniform", "poisson", "cluster"], description: "자연산포 모드 명시 오버라이드" },
      seed: { type: "integer", description: "선택 PRNG 시드(같은 입력/시드면 같은 산포)" },
      avoidProtected: { type: "boolean", description: "시작칸/이벤트/transfer/상위 타일/물·흙길/모래길·통행 불가 하층 회피(기본 true)" },
      preferSoftRules: { type: "boolean", description: "soft/medium 규칙 만족을 우선(기본 true)" },
      applyStructure: { type: "boolean", description: "overlay/처마 생략 등 구조 규칙 자동 적용(기본 true)" },
    },
    required: ["mapId", "area", "count"],
  },
  run: runScatterObject,
};

export const PLACEMENT_TOOLS: readonly ToolDefinition[] = [scatterObject];

function parseArgs(args: Record<string, unknown>): ScatterArgs {
  const areaRecord = record(args["area"], "area{x,y,w,h}");
  const area = { x: int(areaRecord["x"], "area.x"), y: int(areaRecord["y"], "area.y"), w: int(areaRecord["w"], "area.w"), h: int(areaRecord["h"], "area.h") };
  const count = int(args["count"], "count");
  const minGap = int(args["minGap"] ?? 1, "minGap");
  const maxGap = int(args["maxGap"] ?? 3, "maxGap");
  const naturalness = naturalnessArg(args);
  const mode = modeArg(args["mode"], naturalness);
  const seed = optionalInt(args["seed"], "seed");
  if (area.w < 1 || area.h < 1) throw new ToolError("area.w/h는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (count < 1) throw new ToolError("count는 1 이상이어야 합니다.", { code: "invalid-args" });
  if (minGap < 0 || maxGap < minGap) throw new ToolError("간격은 0 이상이고 maxGap은 minGap 이상이어야 합니다.", { code: "invalid-args" });
  return {
    mapId: str(args["mapId"], "mapId"),
    ...(typeof args["groupId"] === "string" && args["groupId"].trim() !== "" ? { groupId: str(args["groupId"], "groupId") } : {}),
    area,
    count,
    minGap,
    maxGap,
    naturalness,
    mode,
    ...(seed === undefined ? {} : { seed }),
    avoidProtected: bool(args["avoidProtected"] ?? true, "avoidProtected"),
    preferSoftRules: bool(args["preferSoftRules"] ?? true, "preferSoftRules"),
    applyStructure: bool(args["applyStructure"] ?? true, "applyStructure"),
  };
}

function record(value: unknown, label: string): RecordValue {
  if (!isRecord(value)) throw new ToolError(`${label}가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null;
}

function str(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") throw new ToolError(`${label}(문자열)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function int(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new ToolError(`${label}(정수)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function optionalInt(value: unknown, label: string): number | undefined {
  if (value === undefined) return undefined;
  return int(value, label);
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new ToolError(`${label}(boolean)가 필요합니다.`, { code: "invalid-args" });
  return value;
}

function modeArg(value: unknown, naturalness: number): ScatterMode {
  if (value === undefined) {
    if (naturalness < 0.3) return "uniform";
    if (naturalness <= 0.7) return "poisson";
    return "cluster";
  }
  if (value === "uniform" || value === "poisson" || value === "cluster") return value;
  throw new ToolError("mode는 uniform/poisson/cluster 중 하나여야 합니다.", { code: "invalid-args" });
}

function groupById(map: GameMap, project: Project, groupId: string): TileGroupMetadata {
  const group = project.tilesets[map.tilesetId]?.tileGroups?.find((entry) => entry.id === groupId);
  if (!group) throw new ToolError(`타일 그룹을 찾을 수 없습니다: ${groupId}`, { code: "group-not-found", mapId: map.id });
  return group;
}

function syntheticPaletteGroup(picker: PaletteTilePicker): TileGroupMetadata {
  const role = paletteGroupRole(picker.role);
  return {
    id: `${picker.presetId}:${picker.role}`,
    name: `${picker.presetId}/${picker.role}`,
    role,
    defaultLayer: role === "prop" || picker.role === "roof" ? "upper" : "lower",
    tileIds: [],
    description: "palette preset placement",
    placementRules: "",
  };
}

function paletteGroupRole(role: PaletteSlotRole): TileGroupMetadata["role"] {
  switch (role) {
    case "wall":
      return "wall";
    case "water":
      return "water";
    case "roof":
      return "roof";
    case "decor":
    case "furniture":
      return "prop";
    default:
      return "terrain";
  }
}

function singleTileFootprint(): Footprint {
  return { w: 1, h: 1, lower: [TILE.EMPTY], upper: [TILE.EMPTY] };
}

function oneInstance(sample: GroupSample, group: TileGroupMetadata, tileset: TilesetDef): Footprint {
  const sourceRect = sourceRectFootprint(group, tileset);
  if (sourceRect) return sourceRect;
  const hasUpper = sample.upper.some((tile) => tile !== TILE.EMPTY);
  const occupied = new Set<number>();
  for (let index = 0; index < sample.w * sample.h; index += 1) {
    const upper = sample.upper[index] ?? TILE.EMPTY;
    const lower = sample.lower[index] ?? TILE.EMPTY;
    if ((hasUpper && upper !== TILE.EMPTY) || (!hasUpper && lower !== TILE.EMPTY)) occupied.add(index);
  }
  const first = [...occupied].sort((a, b) => a - b)[0];
  if (first === undefined) throw new ToolError(`타일 그룹 '${group.name}'에는 배치할 타일이 없습니다.`, { code: "empty-group" });
  const component = new Set<number>();
  const stack = [first];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === undefined || component.has(current) || !occupied.has(current)) continue;
    component.add(current);
    const x = current % sample.w;
    const y = Math.floor(current / sample.w);
    if (x > 0) stack.push(y * sample.w + x - 1);
    if (x < sample.w - 1) stack.push(y * sample.w + x + 1);
    if (y > 0) stack.push((y - 1) * sample.w + x);
    if (y < sample.h - 1) stack.push((y + 1) * sample.w + x);
  }
  const xs = [...component].map((index) => index % sample.w);
  const ys = [...component].map((index) => Math.floor(index / sample.w));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const lower: number[] = [];
  const upper: number[] = [];
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const source = y * sample.w + x;
      const sourceUpper = component.has(source) ? sample.upper[source] ?? TILE.EMPTY : TILE.EMPTY;
      const sourceLower = component.has(source) ? sample.lower[source] ?? TILE.EMPTY : TILE.EMPTY;
      lower.push(hasUpper ? backingLower(tileset, sourceUpper) : sourceLower);
      upper.push(sourceUpper);
    }
  }
  return { w: x1 - x0 + 1, h: y1 - y0 + 1, lower, upper };
}

function sourceRectFootprint(group: TileGroupMetadata, tileset: TilesetDef): Footprint | null {
  const layered = treeLayeredFootprint(group, tileset);
  if (layered) return layered;
  if (group.patternGrammar?.kind !== "source_rect") return null;
  const topLeft = partTile(group, "topLeft", group.tileIds[0]);
  const topRight = partTile(group, "topRight", group.tileIds[1]);
  const bottomLeft = partTile(group, "bottomLeft", group.tileIds[2]);
  const bottomRight = partTile(group, "bottomRight", group.tileIds[3]);
  const tiles = [topLeft, topRight, bottomLeft, bottomRight];
  if (tiles.every((tile) => tile === TILE.EMPTY)) return null;
  const lower: number[] = [];
  const upper: number[] = [];
  for (const tile of tiles) {
    if (tile === TILE.EMPTY) {
      lower.push(TILE.EMPTY);
      upper.push(TILE.EMPTY);
    } else if (footprintLayer(tileset, group, tile) === "upper") {
      // 수관: lower 를 비워 기존 밑동을 보존(숲 겹침). 잔디 백킹 금지.
      lower.push(isTreeCanopyTileId(tile) ? TILE.EMPTY : backingLower(tileset, tile));
      upper.push(tile);
    } else {
      lower.push(tile);
      upper.push(TILE.EMPTY);
    }
  }
  return { h: 2, lower, upper, w: 2 };
}

function partTile(group: TileGroupMetadata, role: NonNullable<TileGroupMetadata["patternGrammar"]>["parts"][number]["role"], fallback: number | undefined): number {
  const tile = group.patternGrammar?.parts.find((part) => part.role === role)?.tileIds[0] ?? fallback;
  return typeof tile === "number" && Number.isInteger(tile) ? tile : TILE.EMPTY;
}

function footprintLayer(tileset: TilesetDef, group: TileGroupMetadata, tile: number): "lower" | "upper" {
  if (isTreeCanopyTileId(tile)) return "upper";
  if (isTreeTrunkTileId(tile)) return "lower";
  if (group.defaultLayer === "upper" || group.role === "prop" || isUpperOnlyOverlayTile(tileset, tile)) return "upper";
  return tileset.priority[tile] === "upper" ? "upper" : "lower";
}

function backingLower(tileset: TilesetDef, upperTile: number): number {
  return isUpperOnlyOverlayTile(tileset, upperTile) ? defaultGrassTile(tileset) : TILE.EMPTY;
}

function defaultGrassTile(tileset: TilesetDef): number {
  if (TILE.GRASS >= 0 && TILE.GRASS < tileset.count) return TILE.GRASS;
  const firstLower = tileset.priority.findIndex((layer) => layer === "lower");
  return firstLower >= 0 ? firstLower : TILE.EMPTY;
}

/** 이벤트·transfer·시작칸만 — 지형 점유는 footprintFits 가 레이어별로 본다(숲 겹침용). */
function protectedEventCells(project: Project, map: GameMap): Set<string> {
  const blocked = new Set<string>();
  const visit = (commands: readonly Command[]): void => {
    for (const command of commands) {
      if (command.kind === "transfer" && command.mapId === map.id) blocked.add(key(command.x, command.y));
      else if (command.kind === "choices") {
        for (const option of command.options) visit(option.branch);
        visit(command.cancelBranch ?? []);
      } else if (command.kind === "fork") {
        visit(command.then);
        visit(command.else ?? []);
      } else if (command.kind === "loop") visit(command.body);
    }
  };
  for (const event of map.events) blocked.add(key(event.x, event.y));
  if (project.startMapId === map.id) blocked.add(key(project.startPos.x, project.startPos.y));
  for (const sourceMap of Object.values(project.maps)) {
    for (const event of sourceMap.events) {
      visit(event.commands);
      for (const page of event.pages ?? []) visit(page.commands);
    }
  }
  for (const commonEvent of project.commonEvents) visit(commonEvent.commands);
  return blocked;
}

/**
 * 숲/벤치/가구 등 다칸 소품 풋프린트.
 * 나무: 수관 upper + 밑동 lower (숲 겹침).
 * 벤치·탁자·과일박스: 전부 upper.
 */
function treeLayeredFootprint(group: TileGroupMetadata, _tileset: TilesetDef): Footprint | null {
  const id = group.id;

  // 가로 벤치 327|328
  if (id.includes("bench-horizontal")) {
    const left = group.tileIds[0] ?? 327;
    const right = group.tileIds[1] ?? 328;
    return {
      w: 2,
      h: 1,
      upper: [left, right],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 의자 358|388 — 둘 다 upper (나무 밑동/수관 분리 금지)
  if (id.includes("bench-vertical")) {
    const top = group.patternGrammar?.parts.find((p) => p.role === "top")?.tileIds[0]
      ?? group.tileIds[0]
      ?? 358;
    const bottom = group.patternGrammar?.parts.find((p) => p.role === "bottom")?.tileIds[0]
      ?? group.tileIds[1]
      ?? 388;
    return {
      w: 1,
      h: 2,
      upper: [top, bottom],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 가로 탁자 234|235|236 (산포 시 최소 3칸)
  if (id.includes("table-horizontal")) {
    return {
      w: 3,
      h: 1,
      upper: [234, 235, 236],
      lower: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 탁자 144/174/204
  if (id.includes("table-vertical")) {
    return {
      w: 1,
      h: 3,
      upper: [144, 174, 204],
      lower: [TILE.EMPTY, TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 과일박스 202|203
  if (id.includes("fruit-box")) {
    return {
      w: 2,
      h: 1,
      upper: [202, 203],
      lower: [TILE.EMPTY, TILE.EMPTY],
    };
  }

  // 세로 2칸 나무만: conifer/dry (vertical_expandable 가구·문은 여기 넣지 않음)
  const verticalTree = id.includes("conifer-tree")
    || id.includes("dry-tree");
  if (verticalTree) {
    const top = group.patternGrammar?.parts.find((p) => p.role === "top")?.tileIds[0]
      ?? group.tileIds[0]
      ?? TILE.EMPTY;
    const bottom = group.patternGrammar?.parts.find((p) => p.role === "bottom")?.tileIds[0]
      ?? group.tileIds[1]
      ?? TILE.EMPTY;
    return {
      w: 1,
      h: 2,
      upper: [top, TILE.EMPTY],
      lower: [TILE.EMPTY, bottom],
    };
  }
  if (id.includes("broadleaf-tree")) {
    const tl = partTile(group, "topLeft", group.tileIds[0]);
    const tr = partTile(group, "topRight", group.tileIds[1]);
    const bl = partTile(group, "bottomLeft", group.tileIds[2]);
    const br = partTile(group, "bottomRight", group.tileIds[3]);
    return {
      w: 2,
      h: 2,
      upper: [tl, tr, TILE.EMPTY, TILE.EMPTY],
      lower: [TILE.EMPTY, TILE.EMPTY, bl, br],
    };
  }
  return null;
}

/** 흙길·모래 등 길/포장 하층 — 소품 산포 시 보호. */
export function isPathSurfaceTile(tile: number): boolean {
  // 포석(129 블록)도 길 표면 — 소품 산포가 돌길을 막지 않게 보호.
  return isRoadTile(tile) || isSandTile(tile) || tile === TILE.PATH || isCobbleTile(tile);
}

function origins(map: GameMap, area: Area, footprint: Footprint): readonly Point[] {
  const points: Point[] = [];
  for (let y = area.y; y <= area.y + area.h - footprint.h; y += 1) {
    for (let x = area.x; x <= area.x + area.w - footprint.w; x += 1) {
      if (inMapBounds(map, x, y) && inMapBounds(map, x + footprint.w - 1, y + footprint.h - 1)) points.push({ x, y });
    }
  }
  return points;
}

/**
 * 레이어별 적합 — upper 만 쓸 칸은 기존 lower(밑동) 위를 허용(숲 겹침).
 * lower 에 밑동을 쓸 칸은 잔디/빈 칸만(물·길·벽·다른 구조 금지).
 */
function footprintFits(map: GameMap, footprint: Footprint, origin: Point, protectedCells: ReadonlySet<string>): boolean {
  if (!inMapBounds(map, origin.x, origin.y) || !inMapBounds(map, origin.x + footprint.w - 1, origin.y + footprint.h - 1)) return false;
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const mx = origin.x + x;
      const my = origin.y + y;
      if (protectedCells.has(key(mx, my))) return false;
      const source = y * footprint.w + x;
      const wantLower = footprint.lower[source] ?? TILE.EMPTY;
      const wantUpper = footprint.upper[source] ?? TILE.EMPTY;
      if (wantLower === TILE.EMPTY && wantUpper === TILE.EMPTY) continue;
      const index = my * map.width + mx;
      const haveLower = map.lowerTiles[index];
      const haveUpper = map.upperTiles[index];
      if (isLakeAutotileTile(haveLower) || isPathSurfaceTile(haveLower) || haveLower === TILE.WALL) return false;
      if (wantUpper !== TILE.EMPTY) {
        if (haveUpper !== TILE.EMPTY) return false;
        // 상위 소품: 물·길·벽만 금지. 실내 나무바닥(72) 등 비-잔디 통행 바닥 위에도 놓인다.
        // (예전 잔디/빈칸/나무밑동 제한은 야외 수관 전제 — 실내 가구 place_props가 0개 스킵되던 원인)
      }
      if (wantLower !== TILE.EMPTY) {
        // 밑동 자리: 잔디/빈 칸만. 이미 밑동이 있으면 겹침 금지.
        if (haveLower !== TILE.EMPTY && haveLower !== TILE.GRASS && haveLower !== wantLower) return false;
        if (isTreeTrunkTileId(haveLower) && isTreeTrunkTileId(wantLower)) return false;
      }
    }
  }
  return true;
}

function rectAt(origin: Point, footprint: Footprint): Rect {
  return { x: origin.x, y: origin.y, w: footprint.w, h: footprint.h };
}

function spaced(candidate: Rect, placed: readonly Rect[], minGap: number): boolean {
  return placed.every((rect) => !(candidate.x < rect.x + rect.w && candidate.x + candidate.w > rect.x && candidate.y < rect.y + rect.h && candidate.y + candidate.h > rect.y) && gap(candidate, rect) >= minGap);
}

/** 기하 간격 + 같은 레이어 충돌만 금지(upper 수관이 lower 밑동 칸에 겹치는 숲 허용). */
function layeredSpaced(
  candidate: Rect,
  candidateFp: Footprint,
  placed: readonly Rect[],
  placedFps: readonly Footprint[],
  minGap: number,
): boolean {
  for (let i = 0; i < placed.length; i += 1) {
    const rect = placed[i]!;
    const otherFp = placedFps[i] ?? candidateFp;
    const overlaps = candidate.x < rect.x + rect.w
      && candidate.x + candidate.w > rect.x
      && candidate.y < rect.y + rect.h
      && candidate.y + candidate.h > rect.y;
    if (!overlaps) {
      if (gap(candidate, rect) < minGap) return false;
      continue;
    }
    // 겹치는 맵 칸에서 둘 다 upper 또는 둘 다 lower 를 쓰면 충돌
    for (let y = Math.max(candidate.y, rect.y); y < Math.min(candidate.y + candidate.h, rect.y + rect.h); y += 1) {
      for (let x = Math.max(candidate.x, rect.x); x < Math.min(candidate.x + candidate.w, rect.x + rect.w); x += 1) {
        const ci = (y - candidate.y) * candidateFp.w + (x - candidate.x);
        const oi = (y - rect.y) * otherFp.w + (x - rect.x);
        const cU = candidateFp.upper[ci] ?? TILE.EMPTY;
        const cL = candidateFp.lower[ci] ?? TILE.EMPTY;
        const oU = otherFp.upper[oi] ?? TILE.EMPTY;
        const oL = otherFp.lower[oi] ?? TILE.EMPTY;
        if (cU !== TILE.EMPTY && oU !== TILE.EMPTY) return false;
        if (cL !== TILE.EMPTY && oL !== TILE.EMPTY) return false;
      }
    }
  }
  return true;
}

function gap(a: Rect, b: Rect): number {
  return Math.max(Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0), Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0));
}

function rankedNaturalCandidates(input: {
  readonly args: ScatterArgs;
  readonly candidates: readonly Point[];
  readonly footprint: Footprint;
  readonly legacySeed: string;
  readonly map: GameMap;
}): { readonly ordered: readonly Point[]; readonly rankByPoint: ReadonlyMap<string, number> } {
  const { args, candidates, footprint, legacySeed, map } = input;
  const bounds = scatterBoundsForOrigins(args.area, footprint);
  const seedArgs: Record<string, unknown> = args.seed === undefined ? {} : { seed: args.seed };
  const signature = `${legacySeed}|${args.mode}|${naturalnessLabel(args.naturalness)}|${map.width}x${map.height}`;
  const rng = rngForTool(seedArgs, signature);
  const request = Math.min(candidates.length, Math.max(args.count * 4, args.count + 16));
  const sampled = args.mode === "poisson"
    ? poissonScatter(bounds, request, poissonOriginGap(args, footprint), rng).points
    : clusterScatter(bounds, [], request, clusterFalloff(bounds, args.naturalness), rng);
  return rankCandidateOrder(sampled, candidates, seedForTool(seedArgs, signature));
}

function scatterBoundsForOrigins(area: Area, footprint: Footprint): ScatterBounds {
  return {
    x: area.x,
    y: area.y,
    width: Math.max(0, area.w - footprint.w + 1),
    height: Math.max(0, area.h - footprint.h + 1),
  };
}

function poissonOriginGap(args: ScatterArgs, footprint: Footprint): number {
  return Math.max(1, args.minGap + Math.min(3, Math.max(footprint.w, footprint.h) - 1));
}

function clusterFalloff(bounds: ScatterBounds, naturalness: number): number {
  const span = Math.max(1, Math.min(bounds.width, bounds.height));
  return Math.max(1, span * (1.05 - naturalness) * 0.3);
}

function rankCandidateOrder(
  sampled: readonly Point[],
  candidates: readonly Point[],
  seed: number
): { readonly ordered: readonly Point[]; readonly rankByPoint: ReadonlyMap<string, number> } {
  const candidateByKey = new Map(candidates.map((candidate) => [pointKey(candidate), candidate]));
  const seen = new Set<string>();
  const ordered: Point[] = [];
  for (const point of sampled) {
    const key = pointKey(point);
    const candidate = candidateByKey.get(key);
    if (!candidate || seen.has(key)) continue;
    seen.add(key);
    ordered.push(candidate);
  }
  const remaining = candidates
    .filter((candidate) => !seen.has(pointKey(candidate)))
    .sort((a, b) => hash(`${seed}|rest|${pointKey(a)}`) - hash(`${seed}|rest|${pointKey(b)}`));
  ordered.push(...remaining);
  const rankByPoint = new Map<string, number>();
  ordered.forEach((point, index) => rankByPoint.set(pointKey(point), index));
  return { ordered, rankByPoint };
}

function chooseUniform(input: UniformChooseInput): Point {
  const { allowed, placed, footprint, maxGap } = input;
  const nearby = placed.length === 0 ? allowed : allowed.filter((origin) => placed.some((rect) => gap(rectAt(origin, footprint), rect) <= maxGap));
  return choose({ ...input, choices: nearby.length > 0 ? nearby : allowed });
}

/**
 * uniform: soft → 시드 해시. 좁은 영역 패킹은 poisson 경로 + minGap 이 담당.
 * 전 후보 "남은 자리 최대화"는 넓은 들에서 격자 채우기를 만들어 산포가 깨지므로 쓰지 않는다.
 */
function choose(input: ChooseInput): Point {
  const { choices, seed, step, map, group, preferSoftRules, placed, footprint } = input;
  const first = choices[0];
  if (!first) throw new ToolError("배치 후보가 없습니다.", { code: "no-placement" });
  let best = first;
  let bestPenalty = Number.POSITIVE_INFINITY;
  let bestRank = Number.POSITIVE_INFINITY;
  for (const candidate of choices) {
    const candidateRect = rectAt(candidate, footprint);
    const penalty = preferSoftRules ? placementSoftPenalty({ group, candidate: candidateRect, placed, map }) : 0;
    const rank = hash(`${seed}|${step}|${candidate.x},${candidate.y}`);
    if (penalty < bestPenalty || (penalty === bestPenalty && rank < bestRank)) {
      best = candidate;
      bestPenalty = penalty;
      bestRank = rank;
    }
  }
  return best;
}

/**
 * poisson/cluster: naturalScatter 샘플 rank 를 1순위로 고른다(넓은 들에서 진짜 랜덤 산포).
 * 패킹 필터는 공간이 빠듯해 요청 개수를 못 채울 때만(needAfter > maxFuture).
 * soft 규칙은 동점 처리.
 */
function chooseRanked(input: RankedChooseInput & { readonly remaining: number }): Point {
  const { allowed, choices, placed, footprint, minGap, map, group, preferSoftRules, rankByPoint, remaining } = input;
  const first = choices[0];
  if (!first) throw new ToolError("배치 후보가 없습니다.", { code: "no-placement" });

  const scored = choices.map((candidate) => {
    const candidateRect = rectAt(candidate, footprint);
    const future = allowed.filter(
      (origin) =>
        (origin.x !== candidate.x || origin.y !== candidate.y)
        && spaced(rectAt(origin, footprint), [...placed, candidateRect], minGap),
    ).length;
    return {
      candidate,
      future,
      rank: rankByPoint.get(pointKey(candidate)) ?? Number.POSITIVE_INFINITY,
      penalty: preferSoftRules ? placementSoftPenalty({ group, candidate: candidateRect, placed, map }) : 0,
    };
  });

  const maxFuture = scored.reduce((max, row) => Math.max(max, row.future), 0);
  const needAfter = Math.max(0, remaining - 1);
  // 여유 있으면 poisson rank 그대로. 좁을 때만 최대 잔여 자리 후보로 제한.
  const tight = needAfter > maxFuture;
  const pool = tight ? scored.filter((row) => row.future >= maxFuture) : scored;
  const usePool = pool.length > 0 ? pool : scored;

  let best = usePool[0]!;
  for (const row of usePool) {
    if (
      row.rank < best.rank
      || (row.rank === best.rank && row.penalty < best.penalty)
      || (row.rank === best.rank && row.penalty === best.penalty && row.future > best.future)
    ) {
      best = row;
    }
  }
  return best.candidate;
}

/** 문법 없는 prop 가방(3타일 이상) — 1칸 단위 랜덤 산포. */
function isBagPropGroup(group: TileGroupMetadata): boolean {
  if (group.patternGrammar) return false;
  if (group.role !== "prop") return false;
  return group.tileIds.length > 2;
}

function singleUpperPropFootprint(tileId: number, tileset: TilesetDef): Footprint {
  const tile = Number.isInteger(tileId) && tileId >= 0 ? tileId : TILE.EMPTY;
  return {
    w: 1,
    h: 1,
    lower: [backingLower(tileset, tile)],
    upper: [tile],
  };
}

function bagPropFootprint(group: TileGroupMetadata, tileset: TilesetDef, seed: string, step: number): Footprint {
  const ids = group.tileIds.filter((tile) => Number.isInteger(tile) && tile >= 0);
  if (ids.length === 0) return singleUpperPropFootprint(TILE.EMPTY, tileset);
  const tile = ids[hash(`${seed}|bag|${step}`) % ids.length] ?? ids[0];
  return singleUpperPropFootprint(tile, tileset);
}

function hash(input: string): number {
  let value = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function paint(map: GameMap, footprint: Footprint, origin: Point): readonly Point[] {
  const touched: Point[] = [];
  for (let y = 0; y < footprint.h; y += 1) {
    for (let x = 0; x < footprint.w; x += 1) {
      const source = y * footprint.w + x;
      const lower = footprint.lower[source] ?? TILE.EMPTY;
      const upper = footprint.upper[source] ?? TILE.EMPTY;
      if (lower === TILE.EMPTY && upper === TILE.EMPTY) continue;
      const target = (origin.y + y) * map.width + origin.x + x;
      // 밑동(lower) 기록. 수관(upper)은 기존 밑동을 덮지 않음.
      if (lower !== TILE.EMPTY) setLower(map, origin.x + x, origin.y + y, lower);
      if (upper !== TILE.EMPTY) {
        map.upperTiles[target] = upper;
        // 빈 하층 위 수관이면 잔디 받침(투명 수관 아래 검정 방지). 밑동 위면 유지.
        const haveLower = map.lowerTiles[target];
        if (
          isTreeCanopyTileId(upper)
          && (haveLower === TILE.EMPTY || haveLower < 0)
        ) {
          setLower(map, origin.x + x, origin.y + y, TILE.GRASS);
        }
      }
      touched.push({ x: origin.x + x, y: origin.y + y });
    }
  }
  return touched;
}

function paintPaletteTile(map: GameMap, tileset: TilesetDef, picker: PaletteTilePicker, origin: Point): readonly Point[] {
  const tile = picker.pick();
  const index = origin.y * map.width + origin.x;
  const layer = paletteLayerForTile(tileset, tile, picker.role);
  if (layer === "upper") map.upperTiles[index] = tile;
  else {
    setLower(map, origin.x, origin.y, tile);
    map.upperTiles[index] = TILE.EMPTY;
  }
  return [{ x: origin.x, y: origin.y }];
}

function paletteLayerForTile(tileset: TilesetDef, tile: number, role: PaletteSlotRole): "lower" | "upper" {
  if (role === "decor" || role === "furniture" || role === "roof") return "upper";
  const home = tileLayerHome(tileset, tile);
  if (home === "upper" || home === "lower") return home;
  return "lower";
}

function applyStructureEdits(map: GameMap, edits: readonly StructureCellEdit[]): readonly Point[] {
  const touched: Point[] = [];
  for (const edit of edits) {
    if (!inMapBounds(map, edit.x, edit.y)) continue;
    const index = edit.y * map.width + edit.x;
    if (edit.layer === "lower") map.lowerTiles[index] = edit.tile;
    else map.upperTiles[index] = edit.tile;
    touched.push({ x: edit.x, y: edit.y });
  }
  return touched;
}

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function pointKey(point: Point): string {
  return key(point.x, point.y);
}

function scatterSeedSignature(map: GameMap, args: ScatterArgs): string {
  const source = args.groupId ?? "palette";
  return `${map.id}|${source}|${args.area.x},${args.area.y},${args.area.w},${args.area.h}|${args.count}|${args.minGap}|${args.maxGap}`;
}
