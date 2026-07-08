// editor/tools/villageBuilder.ts
// 약한 LLM은 테마/이름/대사만 고르고, 50x50 마을 배치·시공은 전부 결정론 코드가 맡는다.

import { findCharsetSemantic, type CharsetSemanticEntry } from "@/assets/charsetSemantics";
import { stampFootprintHouseKit, type FootprintWing, type HouseKitId } from "@/editor/houseKit";
import { createHouseDoorEvent, createHouseInteriorMap } from "@/editor/houseInteriors";
import { appendToTree } from "@/editor/mapTreeActions";
import { DEFAULT_ROAD_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { TILE } from "@/project/defaults/constants";
import type { Command, GameEvent, GameMap, MapId, MapTreeNode, Project } from "@/project/types";
import { mulberry32, type Rng } from "@/util/rng";
import { EVENT_TOOLS } from "./eventTools";
import { MAP_TOOLS } from "./mapTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

const MIN_SIZE = 36;
const MAX_SIZE = 256;
const DEFAULT_SIZE = 50;
const DEFAULT_HOUSES = 8;
const MIN_HOUSES = 4;
const MAX_HOUSES = 12;
const PLAZA_WIDTH = 8;
const PLAZA_HEIGHT = 6;
const HOUSE_MARGIN = 2;
const DOOR_TOP_TILE = 116;
const DOOR_BOTTOM_TILE = 146;
const WINDOW_TILES = new Set<number>([85, 87]);
const ROAD_TILES = new Set<number>(DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds);
const VILLAGE_NPC_GRAPHIC_REFS: readonly (readonly [textureKey: string, characterIndex: number])[] = [
  ["tex_easyrpg_charset_people1", 0],
  ["tex_easyrpg_charset_people2", 0],
  ["tex_easyrpg_charset_people3", 4],
  ["tex_easyrpg_charset_people4", 3],
  ["tex_easyrpg_charset_people5", 6],
  ["tex_easyrpg_charset_people1", 1],
  ["tex_easyrpg_charset_people2", 1],
  ["tex_easyrpg_charset_people3", 6],
  ["tex_easyrpg_charset_people4", 6],
  ["tex_easyrpg_charset_people5", 1],
  ["tex_easyrpg_charset_people1", 3],
  ["tex_easyrpg_charset_people2", 3],
  ["tex_easyrpg_charset_people5", 3],
  ["tex_easyrpg_charset_people1", 5],
  ["tex_easyrpg_charset_people5", 5],
  ["tex_easyrpg_charset_people1", 6],
  ["tex_easyrpg_charset_people5", 7],
  ["tex_easyrpg_charset_people1", 7],
];

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

interface Point {
  readonly x: number;
  readonly y: number;
}

interface HouseTemplate {
  readonly id: "rect-large" | "rect-small" | "l" | "u";
  readonly name: string;
  readonly w: number;
  readonly h: number;
  wingsAt(x: number, y: number): FootprintWing[];
}

interface HouseCandidate {
  readonly template: HouseTemplate;
  readonly bbox: Rect;
}

interface BuiltHouse {
  readonly bbox: Rect;
  readonly doorAt: Point;
  readonly front: Point;
  readonly kitId: HouseKitId;
}

interface VillageHouseInteriorRef {
  readonly houseIndex: number;
  readonly ownerName: string;
  readonly interiorMapId: MapId;
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly entry: Point;
  readonly exit: Point;
  readonly returnTo: Point;
}

interface Plaza {
  readonly rect: Rect;
  readonly centerRow: number;
  readonly centerX: number;
}

interface NpcText {
  readonly name: string;
  readonly lines: readonly string[];
}

interface VillageAudit {
  readonly doorsConnected: number;
  readonly doorsIntact: number;
  readonly roadInsideHouses: number;
  readonly roadComponents: number;
  readonly npcCount: number;
  readonly npcsWithText: number;
  readonly windowCount: number;
}

const HOUSE_TEMPLATES: readonly HouseTemplate[] = [
  {
    id: "rect-large",
    name: "직사각 대",
    w: 8,
    h: 7,
    wingsAt: (x, y) => [{ x, y, w: 8, h: 7 }],
  },
  {
    id: "rect-small",
    name: "직사각 소",
    w: 6,
    h: 6,
    wingsAt: (x, y) => [{ x, y, w: 6, h: 6 }],
  },
  {
    id: "l",
    name: "ㄱ자",
    w: 6,
    h: 8,
    wingsAt: (x, y) => [
      { x, y, w: 3, h: 8 },
      { x: x + 3, y, w: 3, h: 6 },
    ],
  },
  {
    id: "u",
    name: "ㄷ자",
    w: 8,
    h: 8,
    wingsAt: (x, y) => [
      { x, y, w: 8, h: 5 },
      { x, y: y + 5, w: 3, h: 3 },
      { x: x + 5, y: y + 5, w: 3, h: 3 },
    ],
  },
];

const DEFAULT_NPCS: readonly NpcText[] = [
  { name: "민재", lines: ["소라가 아침마다 우물가를 챙겨 줘요.", "이 길만 따라가면 광장까지 금방입니다."] },
  { name: "소라", lines: ["민재가 고친 지붕 덕분에 비가 새지 않아요.", "오늘은 장터에 풋고추가 많이 나왔대요."] },
  { name: "대길", lines: ["새벽에 닭이 울면 남쪽 밭으로 나갑니다.", "광장 대로가 이어져서 짐 나르기가 편해졌어요."] },
  { name: "연화", lines: ["집집마다 창문을 닦아 두니 마을이 밝아졌네요."] },
  { name: "준호", lines: ["동쪽 길은 해 질 무렵에도 잘 보여요.", "아이들이 광장에서 술래잡기를 합니다."] },
  { name: "다솜", lines: ["저녁 국거리로 무를 썰어 두었어요.", "촌장님은 늘 마을 길부터 살피세요."] },
  { name: "태식", lines: ["보라가 부탁한 장작은 광장 옆에 쌓아 두었습니다."] },
  { name: "보라", lines: ["태식 아저씨가 장작을 챙겨 줘서 오늘 밤은 따뜻하겠어요."] },
  { name: "한결", lines: ["서쪽 끝부터 동쪽 끝까지 길이 하나로 이어졌습니다.", "이제 손님도 헤매지 않겠군요."] },
  { name: "미선", lines: ["광장에 두 사람이 더 있으니 장터가 북적이는 것 같아요.", "필요한 물건이 있으면 해 지기 전에 들르세요."] },
];

const createMapTool = requireTool(MAP_TOOLS, "create_map");
const paintRoadTool = requireTool(MAP_TOOLS, "paint_road");
const placeNpcTool = requireTool(EVENT_TOOLS, "place_npc");

export const VILLAGE_TOOLS: readonly ToolDefinition[] = [
  {
    name: "build_village",
    description:
      "하네싱 집 키트 기반 50x50 마을을 한 번에 시공한다. 인자 없이 호출해도 50x50 마을이 완성된다. " +
      "배치·집·길·NPC 배치는 결정론 코드가 수행하고, npcs 로 이름/대사만 지정 가능하다. " +
      "기본 결과: 집 8채, 중앙 광장과 전부 연결된 흙길, 집마다 주민 1명과 광장 주민 2명.",
    mode: "write",
    parameters: {
      type: "object",
      properties: {
        mapId: { type: "string", description: "기존 맵에 시공한다. 최소 36x36 필요." },
        name: { type: "string", description: "새 맵 이름(기본: 마을 50x50)" },
        width: { type: "integer", description: "새 맵 가로(기본 50, 36~256)" },
        height: { type: "integer", description: "새 맵 세로(기본 50, 36~256)" },
        houses: { type: "integer", description: "목표 집 수(기본 8, 4~12)" },
        seed: { type: "integer", description: "결정론 PRNG 시드(기본 1)" },
        interior: { type: "boolean", description: "집마다 내부 맵과 Object1 문 이벤트를 생성(기본 true). false면 기존 외장/문 타일만 만든다." },
        npcs: {
          type: "array",
          description: "선택 이름/대사 오버라이드. [{name, lines:string[]}] 순서대로 소비한다.",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              lines: { type: "array", items: { type: "string" } },
            },
          },
        },
      },
    },
    invalidArgsExample: { seed: 7 },
    run(draft, args): ToolExecResult {
      const seed = integerArg(args, "seed", 1);
      const targetHouses = integerArg(args, "houses", DEFAULT_HOUSES, MIN_HOUSES, MAX_HOUSES);
      const interiorEnabled = args.interior !== false;
      const overrides = npcOverrides(args.npcs);
      const warnings: string[] = [];
      const mapId = typeof args.mapId === "string" && args.mapId.trim().length > 0
        ? args.mapId.trim()
        : createVillageMap(draft, args, seed);
      const map = requireVillageMap(draft, mapId);
      assertExistingMapSize(map);

      const upperBefore = [...map.upperTiles];
      const rng = mulberry32(seed);
      const plaza = villagePlaza(map);
      paintPlazaAndAvenue(draft, map, plaza, warnings);
      const houses = buildHouses(map, plaza, targetHouses, rng, warnings);
      connectHousesToRoads(draft, map, plaza, houses, warnings);
      const houseInteriors = interiorEnabled
        ? createVillageHouseInteriors(draft, map, houses, overrides, seed)
        : [];
      placeVillageNpcs(draft, map, houses, plaza, overrides, seed, warnings);

      const audit = auditVillage(map, houses, upperBefore);
      if (houses.length < targetHouses) warnings.push(`집 수 미달: ${houses.length}/${targetHouses}`);
      if (audit.doorsConnected < houses.length) warnings.push(`문 연결 미달: ${audit.doorsConnected}/${houses.length}`);
      if (audit.doorsIntact < houses.length) warnings.push(`문 타일 훼손: ${houses.length - audit.doorsIntact}곳`);
      if (audit.roadInsideHouses > 0) warnings.push(`집 내부를 침범한 도로 ${audit.roadInsideHouses}칸`);
      if (audit.roadComponents !== 1) warnings.push(`길 연결 성분 미달: ${audit.roadComponents}`);
      if (audit.npcCount !== houses.length + 2) warnings.push(`NPC 수 미달: ${audit.npcCount}/${houses.length + 2}`);
      if (audit.npcsWithText !== audit.npcCount) warnings.push(`대사 없는 NPC: ${audit.npcCount - audit.npcsWithText}명`);
      if (interiorEnabled && houseInteriors.length !== houses.length) warnings.push(`내부 생성 미달: ${houseInteriors.length}/${houses.length}`);

      return {
        summary:
          `마을 시공: 집 ${houses.length}/${targetHouses}, 문 연결 ${audit.doorsConnected}/${houses.length}, ` +
          `길 성분 ${audit.roadComponents}, NPC ${audit.npcCount}, 내부 ${houseInteriors.length} (창문 ${audit.windowCount}).`,
        data: {
          mapId,
          housesBuilt: houses.length,
          doorsConnected: audit.doorsConnected,
          doorsIntact: audit.doorsIntact,
          roadComponents: audit.roadComponents,
          npcCount: audit.npcCount,
          interiorCount: houseInteriors.length,
          doorEventCount: houseInteriors.length,
          houses: houses.map((house, index) => {
            const interiorRef = houseInteriors[index];
            return {
              index,
              kitId: house.kitId,
              doorAt: house.doorAt,
              front: house.front,
              ownerName: npcText(index, overrides).name,
              ...(interiorRef
                ? {
                    interiorMapId: interiorRef.interiorMapId,
                    doorEventId: interiorRef.doorEventId,
                    exitEventId: interiorRef.exitEventId,
                    entry: interiorRef.entry,
                    exit: interiorRef.exit,
                    returnTo: interiorRef.returnTo,
                  }
                : {}),
            };
          }),
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    },
  },
];

function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

function integerArg(args: Record<string, unknown>, key: string, fallback: number, min?: number, max?: number): number {
  const value = args[key];
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || !Number.isFinite(value)) {
    throw new ToolError(`${key}는 정수여야 합니다.`, { code: "invalid-args" });
  }
  if (min !== undefined && value < min) throw new ToolError(`${key}는 ${min} 이상이어야 합니다.`, { code: "invalid-args" });
  if (max !== undefined && value > max) throw new ToolError(`${key}는 ${max} 이하여야 합니다.`, { code: "invalid-args" });
  return value;
}

function createVillageMap(draft: Project, args: Record<string, unknown>, seed: number): string {
  const width = integerArg(args, "width", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const height = integerArg(args, "height", DEFAULT_SIZE, MIN_SIZE, MAX_SIZE);
  const name = typeof args.name === "string" && args.name.trim().length > 0 ? args.name.trim() : "마을 50x50";
  const id = uniqueId(draft, "map_village", `${seed >>> 0}_${width}x${height}`);
  createMapTool.run(draft, { id, name, width, height, border: "none" });
  return id;
}

function requireVillageMap(draft: Project, mapId: string): GameMap {
  const map = draft.maps[mapId];
  if (!map) throw new ToolError(`맵을 찾을 수 없습니다: ${mapId}`, { code: "map-not-found", mapId });
  return map;
}

function assertExistingMapSize(map: GameMap): void {
  if (map.width < MIN_SIZE || map.height < MIN_SIZE) {
    throw new ToolError(`build_village는 최소 ${MIN_SIZE}x${MIN_SIZE} 맵이 필요합니다: ${map.width}x${map.height}`, {
      code: "map-too-small",
      mapId: map.id,
    });
  }
}

function uniqueId(draft: Project, prefix: string, body: string): string {
  const cleanBody = body.replace(/[^a-zA-Z0-9_]+/g, "_").replace(/^_+|_+$/g, "") || "1";
  let id = `${prefix}_${cleanBody}`;
  let suffix = 2;
  const eventIds = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (draft.maps[id] || eventIds.has(id)) {
    id = `${prefix}_${cleanBody}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function villagePlaza(map: GameMap): Plaza {
  const x = Math.floor(map.width / 2) - Math.floor(PLAZA_WIDTH / 2);
  const y = Math.floor(map.height / 2) - Math.floor(PLAZA_HEIGHT / 2);
  return {
    rect: { x, y, w: PLAZA_WIDTH, h: PLAZA_HEIGHT },
    centerRow: y + Math.floor(PLAZA_HEIGHT / 2),
    centerX: x + Math.floor(PLAZA_WIDTH / 2),
  };
}

function paintPlazaAndAvenue(draft: Project, map: GameMap, plaza: Plaza, warnings: string[]): void {
  const x0 = plaza.rect.x;
  const y0 = plaza.rect.y;
  const x1 = plaza.rect.x + plaza.rect.w - 1;
  const y1 = plaza.rect.y + plaza.rect.h - 1;
  runNested(paintRoadTool, draft, {
    mapId: map.id,
    style: "dirt",
    naturalness: 0,
    points: [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y0 },
    ],
  }, warnings);
  runNested(paintRoadTool, draft, {
    mapId: map.id,
    style: "dirt",
    naturalness: 0,
    points: [
      { x: 2, y: plaza.centerRow },
      { x: map.width - 3, y: plaza.centerRow },
    ],
  }, warnings);
}

function runNested(tool: ToolDefinition, draft: Project, args: Record<string, unknown>, warnings: string[]): ToolExecResult {
  const result = tool.run(draft, args);
  if (result.warnings) warnings.push(...result.warnings);
  return result;
}

function buildHouses(map: GameMap, plaza: Plaza, target: number, rng: Rng, warnings: string[]): BuiltHouse[] {
  const candidates = shuffled(houseCandidates(map, plaza, target), rng);
  const houses: BuiltHouse[] = [];
  for (const candidate of candidates) {
    if (houses.length >= target) break;
    if (!canPlaceHouse(map, plaza.rect, houses, candidate.bbox)) continue;
    const kitId: HouseKitId = houses.length % 2 === 0 ? "blue-stone" : "bright-plaster";
    const result = stampFootprintHouseKit(map, {
      kitId,
      wings: candidate.template.wingsAt(candidate.bbox.x, candidate.bbox.y),
    });
    if (!result.ok || !result.doorAt) {
      warnings.push(`집 시공 실패(${candidate.template.name}): ${result.reason ?? "문 좌표 없음"}`);
      continue;
    }
    const doorAt = result.doorAt;
    map.lowerTiles[(doorAt.y - 1) * map.width + doorAt.x] = DOOR_TOP_TILE;
    map.lowerTiles[doorAt.y * map.width + doorAt.x] = DOOR_BOTTOM_TILE;
    houses.push({ bbox: candidate.bbox, doorAt, front: { x: doorAt.x, y: doorAt.y + 1 }, kitId });
  }
  return houses;
}

function houseCandidates(map: GameMap, plaza: Plaza, target: number): HouseCandidate[] {
  const minTemplateWidth = Math.min(...HOUSE_TEMPLATES.map((template) => template.w));
  const wantedColumns = Math.ceil(target / 2);
  const maxColumns = Math.max(1, Math.floor((map.width - HOUSE_MARGIN * 2 + HOUSE_MARGIN * 2) / (minTemplateWidth + HOUSE_MARGIN * 2)));
  const columns = Math.max(1, Math.min(wantedColumns, maxColumns));
  const allTemplatesFit = columns * 8 + (columns - 1) * HOUSE_MARGIN * 2 + HOUSE_MARGIN * 2 <= map.width;
  const slotWidth = allTemplatesFit ? 8 : minTemplateWidth;
  const templates = HOUSE_TEMPLATES.filter((template) => template.w <= slotWidth);
  const span = columns * slotWidth + (columns - 1) * HOUSE_MARGIN * 2;
  const xStart = Math.max(HOUSE_MARGIN, Math.floor((map.width - span) / 2));
  const candidates: HouseCandidate[] = [];
  for (let col = 0; col < columns; col += 1) {
    const slotX = xStart + col * (slotWidth + HOUSE_MARGIN * 2);
    for (const template of templates) {
      const x = slotX + Math.floor((slotWidth - template.w) / 2);
      candidates.push({ template, bbox: { x, y: plaza.rect.y - HOUSE_MARGIN - template.h, w: template.w, h: template.h } });
      candidates.push({ template, bbox: { x, y: plaza.rect.y + plaza.rect.h + HOUSE_MARGIN, w: template.w, h: template.h } });
    }
  }
  return candidates;
}

function canPlaceHouse(map: GameMap, plaza: Rect, houses: readonly BuiltHouse[], bbox: Rect): boolean {
  if (bbox.x < HOUSE_MARGIN || bbox.y < HOUSE_MARGIN) return false;
  if (bbox.x + bbox.w > map.width - HOUSE_MARGIN) return false;
  if (bbox.y + bbox.h > map.height - HOUSE_MARGIN) return false;
  if (rectsOverlap(bbox, expandRect(plaza, HOUSE_MARGIN))) return false;
  return houses.every((house) => !rectsOverlap(expandRect(bbox, HOUSE_MARGIN), house.bbox));
}

function expandRect(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 };
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = temp;
  }
  return copy;
}

function connectHousesToRoads(draft: Project, map: GameMap, plaza: Plaza, houses: readonly BuiltHouse[], warnings: string[]): void {
  const leftEdge = plaza.rect.x;
  const rightEdge = plaza.rect.x + plaza.rect.w - 1;
  const plazaTop = plaza.rect.y;
  const plazaBottom = plaza.rect.y + plaza.rect.h - 1;
  for (const house of houses) {
    const points: Point[] = [house.front];
    if (house.front.y <= plazaTop) {
      // 광장 위 밴드: 문 앞에서 광장 위 변까지 곧장 내려간다(집을 지나지 않음).
      points.push({ x: house.front.x, y: plazaTop }, { x: clamp(house.front.x, leftEdge, rightEdge), y: plazaTop });
    } else {
      // 광장 아래 밴드: 문은 집 남쪽에 있으므로 곧장 광장으로 올리면 집을 관통한다.
      // 집 옆(마진 보장) 복도 열로 우회해 광장 아래 변으로 올라간다.
      const rightCorridor = house.bbox.x + house.bbox.w;
      const corridorX = rightCorridor <= map.width - 2 ? rightCorridor : house.bbox.x - 1;
      points.push(
        { x: corridorX, y: house.front.y },
        { x: corridorX, y: plazaBottom },
        { x: clamp(corridorX, leftEdge, rightEdge), y: plazaBottom }
      );
    }
    runNested(paintRoadTool, draft, { mapId: map.id, style: "dirt", naturalness: 0, points }, warnings);
  }
}

function createVillageHouseInteriors(
  draft: Project,
  map: GameMap,
  houses: readonly BuiltHouse[],
  overrides: readonly Partial<NpcText>[],
  seed: number
): VillageHouseInteriorRef[] {
  const refs: VillageHouseInteriorRef[] = [];
  const mapPart = map.id.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  for (let index = 0; index < houses.length; index += 1) {
    const house = houses[index] as BuiltHouse;
    const owner = npcText(index, overrides).name;
    const base = `${seed >>> 0}_${mapPart}_${index + 1}`;
    const interiorMapId = uniqueId(draft, "map_house_interior", base);
    const doorEventId = uniqueId(draft, "ev_house_door", base);
    const exitEventId = uniqueId(draft, "ev_house_exit", base);
    const interior = createHouseInteriorMap({
      id: interiorMapId,
      name: `${owner}의 집 내부`,
      returnMapId: map.id,
      returnX: house.front.x,
      returnY: house.front.y,
      exitEventId,
      seed: (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0,
    });
    draft.maps[interiorMapId] = interior.map;
    appendTreeChildOnce(draft.mapTree, interiorMapId, map.id);
    upsertEvent(map.events, createHouseDoorEvent({
      eventId: doorEventId,
      x: house.doorAt.x,
      y: house.doorAt.y,
      interiorMapId,
      kitId: house.kitId,
      name: `${owner}의 집 문`,
    }));
    refs.push({
      houseIndex: index,
      ownerName: owner,
      interiorMapId,
      doorEventId,
      exitEventId,
      entry: interior.entry,
      exit: interior.exit,
      returnTo: house.front,
    });
  }
  return refs;
}

function appendTreeChildOnce(root: MapTreeNode, mapId: MapId, parentId: MapId): void {
  if (treeContains(root, mapId)) return;
  appendToTree(root, mapId, parentId);
}

function treeContains(node: MapTreeNode, mapId: MapId): boolean {
  return node.mapId === mapId || node.children.some((child) => treeContains(child, mapId));
}

function upsertEvent(events: GameEvent[], event: GameEvent): void {
  const index = events.findIndex((entry) => entry.id === event.id);
  if (index >= 0) events[index] = event;
  else events.push(event);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function placeVillageNpcs(
  draft: Project,
  map: GameMap,
  houses: readonly BuiltHouse[],
  plaza: Plaza,
  overrides: readonly Partial<NpcText>[],
  seed: number,
  warnings: string[]
): void {
  const occupied = new Set<string>();
  const placements = [
    ...houses.map((house, index) => npcPointNearHouseFront(map, house, index, occupied)),
    { x: plaza.centerX - 1, y: plaza.centerRow },
    { x: plaza.centerX + 1, y: plaza.centerRow },
  ];
  const graphics = seededVillageNpcGraphics(seed);
  for (let index = 0; index < placements.length; index += 1) {
    const point = placements[index] as Point;
    const text = npcText(index, overrides);
    const graphic = graphics[index % graphics.length] as CharsetSemanticEntry;
    runNested(placeNpcTool, draft, {
      mapId: map.id,
      x: point.x,
      y: point.y,
      name: text.name,
      graphic: { textureKey: graphic.textureKey, characterIndex: graphic.characterIndex },
      movement: "random",
      pages: [{ lines: text.lines }],
      id: uniqueEventId(draft, map.id, seed, index),
    }, warnings);
  }
}

function seededVillageNpcGraphics(seed: number): readonly CharsetSemanticEntry[] {
  const entries = VILLAGE_NPC_GRAPHIC_REFS.map(([textureKey, characterIndex]) => findCharsetSemantic(textureKey, characterIndex))
    .filter((entry): entry is CharsetSemanticEntry => entry !== undefined);
  if (entries.length === 0) throw new Error("마을 NPC 그래픽 후보가 비어 있습니다.");
  const rng = mulberry32((seed ^ 0x6d2b79f5) >>> 0);
  const offset = Math.floor(rng() * entries.length);
  return [...entries.slice(offset), ...entries.slice(0, offset)];
}

function npcPointNearHouseFront(map: GameMap, house: BuiltHouse, index: number, occupied: Set<string>): Point {
  const leftFirst = index % 2 === 0;
  const candidates = leftFirst
    ? [
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x - 2, y: house.front.y },
        { x: house.front.x + 2, y: house.front.y },
      ]
    : [
        { x: house.front.x + 1, y: house.front.y },
        { x: house.front.x - 1, y: house.front.y },
        { x: house.front.x, y: house.front.y + 1 },
        { x: house.front.x + 2, y: house.front.y },
        { x: house.front.x - 2, y: house.front.y },
      ];
  for (const point of candidates) {
    if (!pointInMap(map, point)) continue;
    if (point.x === house.front.x && point.y === house.front.y) continue;
    if (point.x === house.doorAt.x && point.y === house.doorAt.y) continue;
    if (pointInRect(point, house.bbox)) continue;
    const key = coordKey(point.x, point.y);
    if (occupied.has(key)) continue;
    occupied.add(key);
    return point;
  }
  const fallback = house.front;
  occupied.add(coordKey(fallback.x, fallback.y));
  return fallback;
}

function pointInMap(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

function pointInRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}

function uniqueEventId(draft: Project, mapId: string, seed: number, index: number): string {
  const mapPart = mapId.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 32) || "map";
  const base = `ev_village_${seed >>> 0}_${mapPart}_${index + 1}`;
  let id = base;
  let suffix = 2;
  const existing = new Set(Object.values(draft.maps).flatMap((map) => map.events.map((event) => event.id)));
  while (existing.has(id)) {
    id = `${base}_${suffix}`;
    suffix += 1;
  }
  return id;
}

function npcOverrides(value: unknown): Partial<NpcText>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new ToolError("npcs는 [{name, lines}] 배열이어야 합니다.", { code: "invalid-args" });
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new ToolError(`npcs[${index}]는 객체여야 합니다.`, { code: "invalid-args" });
    }
    const record = entry as Record<string, unknown>;
    const name = record.name;
    const lines = record.lines;
    if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
      throw new ToolError(`npcs[${index}].name은 비어 있지 않은 문자열이어야 합니다.`, { code: "invalid-args" });
    }
    if (lines !== undefined && (!Array.isArray(lines) || !lines.every((line) => typeof line === "string" && line.length > 0))) {
      throw new ToolError(`npcs[${index}].lines는 문자열 배열이어야 합니다.`, { code: "invalid-args" });
    }
    return {
      ...(typeof name === "string" ? { name: name.trim() } : {}),
      ...(Array.isArray(lines) ? { lines: lines as string[] } : {}),
    };
  });
}

function npcText(index: number, overrides: readonly Partial<NpcText>[]): NpcText {
  const base = DEFAULT_NPCS[index % DEFAULT_NPCS.length] as NpcText;
  const override = overrides[index];
  const name = override?.name ?? (index < DEFAULT_NPCS.length ? base.name : `${base.name}${Math.floor(index / DEFAULT_NPCS.length) + 1}`);
  const lines = override?.lines && override.lines.length > 0 ? override.lines : base.lines;
  return { name, lines };
}

function auditVillage(map: GameMap, houses: readonly BuiltHouse[], upperBefore: readonly number[]): VillageAudit {
  const doorsConnected = houses.filter((house) => doorHasRoad(map, house.doorAt)).length;
  // 문 타일 자체가 살아있는지(도로 관통 등으로 덮이지 않았는지)도 직접 검사한다.
  const lowerAt = (x: number, y: number): number => map.lowerTiles[y * map.width + x] ?? TILE.EMPTY;
  const doorsIntact = houses.filter(
    (house) => lowerAt(house.doorAt.x, house.doorAt.y) === DOOR_BOTTOM_TILE && lowerAt(house.doorAt.x, house.doorAt.y - 1) === DOOR_TOP_TILE
  ).length;
  let roadInsideHouses = 0;
  for (const house of houses) {
    for (let y = house.bbox.y; y < house.bbox.y + house.bbox.h; y += 1) {
      for (let x = house.bbox.x; x < house.bbox.x + house.bbox.w; x += 1) {
        if (ROAD_TILES.has(lowerAt(x, y))) roadInsideHouses += 1;
      }
    }
  }
  const roadComponents = countRoadComponents(map);
  const npcEvents = map.events.filter(isNpcEvent);
  const npcsWithText = npcEvents.filter(eventHasText).length;
  let windowCount = 0;
  for (let i = 0; i < map.upperTiles.length; i += 1) {
    if (upperBefore[i] !== map.upperTiles[i] && WINDOW_TILES.has(map.upperTiles[i] ?? TILE.EMPTY)) windowCount += 1;
  }
  return { doorsConnected, doorsIntact, roadInsideHouses, roadComponents, npcCount: npcEvents.length, npcsWithText, windowCount };
}

function doorHasRoad(map: GameMap, door: Point): boolean {
  for (let y = door.y + 1; y <= door.y + 3; y += 1) {
    for (let x = door.x - 1; x <= door.x + 1; x += 1) {
      if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
      if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) return true;
    }
  }
  return false;
}

function countRoadComponents(map: GameMap): number {
  const road = new Set<string>();
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? TILE.EMPTY)) road.add(coordKey(x, y));
    }
  }
  let components = 0;
  while (road.size > 0) {
    const first = road.values().next().value as string | undefined;
    if (!first) break;
    components += 1;
    const stack = [first];
    road.delete(first);
    while (stack.length > 0) {
      const key = stack.pop() as string;
      const point = pointFromKey(key);
      for (const next of [
        { x: point.x + 1, y: point.y },
        { x: point.x - 1, y: point.y },
        { x: point.x, y: point.y + 1 },
        { x: point.x, y: point.y - 1 },
      ]) {
        const nextKey = coordKey(next.x, next.y);
        if (!road.has(nextKey)) continue;
        road.delete(nextKey);
        stack.push(nextKey);
      }
    }
  }
  return components;
}

function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

function pointFromKey(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}

function isNpcEvent(event: GameEvent): boolean {
  return event.id.startsWith("ev_village_");
}

function eventHasText(event: GameEvent): boolean {
  return (event.pages ?? []).some((page) => page.commands.some(isTextCommand));
}

function isTextCommand(command: Command): boolean {
  return command.kind === "text";
}
