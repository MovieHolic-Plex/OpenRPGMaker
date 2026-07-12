/**
 * 마을+상점가 시공.
 * 주거/길/울타리/NPC = build_village (기존 슬롯·HOUSE_MARGIN 알고리즘).
 * 동쪽 여백에 데크 상점가를 덧붙인다. 하드코딩 origin 집 스탬프 금지.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { runTool } from "@/editor/tools/toolRunner";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { repairMapTreeOrphans, collectMapIdsInTree } from "@/editor/mapTreeActions";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { defaultDatabase, defaultTitleScreenSettings } from "./defaultDatabase";
import { DEFAULT_ITEM_ID, TILE } from "./constants";
import { RM2K3_WOOD_FLOOR_PASSABILITY } from "./chipsetMapping";
import type {
  Command,
  EventPage,
  EventPageGraphic,
  EventPageMovement,
  GameEvent,
  GameMap,
  Project,
} from "../types";

export const VILLAGE_SHOPPING_STREET_MAP_ID = "map_village_shopping_street";
export const VILLAGE_SHOPPING_STREET_MAP_NAME = "마을과 상점가";

/** 전체 맵 — 서쪽 36칸 주거(bounds), 동쪽 상점가용 여백 */
const MAP_W = 56;
const MAP_H = 42;
/** build_village 최소 36×36 — 주거 전용 영역 */
const VILLAGE_BOUNDS = { x: 0, y: 0, w: 36, h: 42 } as const;
/** 상점가 데크 (마을 bounds 밖, 동측) */
const SHOP_DECK = { x: 39, y: 10, w: 14, h: 14 } as const;
/**
 * RM2k3 층계 입구 — 연결 도로 y=20,21 과 맞춤.
 * 데크 서측 가장자리 중 이 두 칸만 전방향 ○(본체), 나머지는 edgeWest(←막힘).
 */
const STAIR_WORLD_Y = [20, 21] as const;

const WOOD_FLOOR = RM2K3_WOOD_FLOOR_PASSABILITY.body;
const WOOD_EDGE_W = RM2K3_WOOD_FLOOR_PASSABILITY.edgeWest;
const WOOD_EDGE_E = RM2K3_WOOD_FLOOR_PASSABILITY.edgeEast;
const WOOD_EDGE_N = RM2K3_WOOD_FLOOR_PASSABILITY.edgeNorth;
const WOOD_EDGE_S = RM2K3_WOOD_FLOOR_PASSABILITY.edgeSouth;
const TIMBER_RAIL = 223;
const TIMBER_POST = 193;
const RAIL_L = 468;
const RAIL_M = 469;
const RAIL_R = 470;
const STONE_STEP = 268;
const STONE_STAIR_L = 111;
const STONE_STAIR_M = 112;
const TABLE_L = 234;
const TABLE_M = 235;
const TABLE_R = 236;
const WOOD_BOX = 237;
const FRUIT_L = 202;
const FRUIT_R = 203;
const FIREWOOD = 349;
const FLOWER = 288;
const BENCH_L = 327;
const BENCH_R = 328;
const TREE = 260;
const TREE_BOTTOM = 290;

const FIXED: EventPageMovement = { type: "fixed", speed: 3, frequency: 3 };

export type VillageShoppingStreetBuildResult = {
  readonly project: Project;
  readonly mapId: string;
  readonly villageSummary: string;
  readonly housesBuilt: number;
  readonly shopEvents: number;
  readonly warnings: readonly string[];
  readonly mapTreeIds: readonly string[];
};

/**
 * 맵 전부 비운 뒤 마을(알고리즘) + 상점가 한 장(실내는 off → 맵 1장)으로 시공.
 */
export function buildVillageShoppingStreetProject(options: {
  readonly seed?: number;
  readonly houses?: number;
} = {}): VillageShoppingStreetBuildResult {
  const seed = options.seed ?? 11;
  const houses = options.houses ?? 6;
  const warnings: string[] = [];

  const project = createEmptyToolProject(VILLAGE_SHOPPING_STREET_MAP_NAME);
  // 상점 itemIds 검증용 — empty 툴 프로젝트는 items를 비우므로 기본 DB 복원
  project.database = defaultDatabase();
  project.meta = { ...project.meta, title: VILLAGE_SHOPPING_STREET_MAP_NAME };
  // 타이틀 배경 명시 (테스트 플레이 시 easyrpg-title-title1)
  applyDefaultTitleScreen(project, VILLAGE_SHOPPING_STREET_MAP_NAME);
  ensureTilesetHarnesses(project);

  const ctx: { project: Project } = { project };

  runOk(ctx, "create_map", {
    id: VILLAGE_SHOPPING_STREET_MAP_ID,
    name: VILLAGE_SHOPPING_STREET_MAP_NAME,
    width: MAP_W,
    height: MAP_H,
    border: "none",
  }, warnings);

  // 기존 집 배치 알고리즘 (슬롯·HOUSE_MARGIN·필지 울타리). 실내 맵은 만들지 않음 → 맵 1장.
  const village = runOk(ctx, "build_village", {
    mapId: VILLAGE_SHOPPING_STREET_MAP_ID,
    seed,
    houses,
    theme: "장터 마을",
    pathStyle: "sand",
    yardStyle: "market",
    plazaStyle: "market",
    plazaLayout: "center",
    settlementLayout: "street-grid",
    fences: true,
    decor: true,
    skipTerrain: true,
    interior: false,
    doorEvent: false,
    bounds: { ...VILLAGE_BOUNDS },
    npcs: [
      { name: "주민 아린", lines: ["동쪽 끝이 상점가야. 메인 길로 나가면 데크가 보여."] },
      { name: "주민 코르", lines: ["집 사이 간격은 필지 규칙으로 맞춰져 있어. 울타리가 겹치면 안 되지."] },
      { name: "주민 세리", lines: ["광장에서 장 보는 기분으로 동쪽 상인들을 만나 봐."] },
    ],
  }, warnings);

  // runTool은 draft로 project를 교체한다 — 맵 참조는 항상 최신 ctx에서 다시 잡는다.
  if (!ctx.project.maps[VILLAGE_SHOPPING_STREET_MAP_ID]) {
    throw new Error(`map missing after build_village: ${VILLAGE_SHOPPING_STREET_MAP_ID}`);
  }

  // 마을 동쪽 경계 → 상점가 연결 길 (이 호출도 project를 교체함)
  connectVillageToShoppingStreet(ctx, warnings);

  const map = ctx.project.maps[VILLAGE_SHOPPING_STREET_MAP_ID];
  if (!map) throw new Error(`map missing after paint_road: ${VILLAGE_SHOPPING_STREET_MAP_ID}`);

  // 순수 타일/이벤트 뮤테이션은 최신 map 객체에만 (추가 runTool 없이)
  stampShoppingStreetDeck(map);
  addShopkeepers(map);

  // 시작 위치: build_village가 잡은 안전 좌표 유지
  if (!ctx.project.startMapId || !ctx.project.maps[ctx.project.startMapId]) {
    ctx.project.startMapId = VILLAGE_SHOPPING_STREET_MAP_ID;
  }

  // 맵 트리: 실내 없음 → 이 맵만
  for (const id of Object.keys(ctx.project.maps)) {
    if (id !== VILLAGE_SHOPPING_STREET_MAP_ID) {
      delete ctx.project.maps[id];
    }
  }
  ctx.project.mapTree = { mapId: VILLAGE_SHOPPING_STREET_MAP_ID, children: [] };
  ctx.project.startMapId = VILLAGE_SHOPPING_STREET_MAP_ID;
  repairMapTreeOrphans(ctx.project);

  const villageData = (village.data ?? {}) as { housesBuilt?: number; mapId?: string };
  const finalMap = ctx.project.maps[VILLAGE_SHOPPING_STREET_MAP_ID]!;
  const shopEvents = finalMap.events.filter((e) => e.id.startsWith("ev_shop_")).length;

  return {
    project: ctx.project,
    mapId: VILLAGE_SHOPPING_STREET_MAP_ID,
    villageSummary: village.summary,
    housesBuilt: villageData.housesBuilt ?? houses,
    shopEvents,
    warnings,
    mapTreeIds: [...collectMapIdsInTree(ctx.project.mapTree)],
  };
}

/** @deprecated 하드코딩 스탬프 경로 — buildVillageShoppingStreetProject 사용 */
export function createVillageShoppingStreetMap(): GameMap {
  const built = buildVillageShoppingStreetProject();
  const map = built.project.maps[VILLAGE_SHOPPING_STREET_MAP_ID];
  if (!map) throw new Error("createVillageShoppingStreetMap: build failed");
  return structuredClone(map);
}

export function villageShoppingStreetStartPos(): { readonly x: number; readonly y: number } {
  return { x: 28, y: 20 };
}

function runOk(
  ctx: { project: Project },
  name: string,
  args: Record<string, unknown>,
  warnings: string[],
) {
  const result = runTool(ctx, name, args);
  if (!result.ok) {
    throw new Error(
      `${name} failed: ${result.summary}\n${JSON.stringify(result.issues ?? [], null, 2)}`,
    );
  }
  if (result.warnings?.length) warnings.push(...result.warnings);
  return result;
}

function connectVillageToShoppingStreet(
  ctx: { project: Project },
  warnings: string[],
): void {
  // bounds 동쪽 끝 → 데크 입구 (2줄 평행 폴리라인으로 폭 느낌)
  const roadY = 20;
  const mapId = VILLAGE_SHOPPING_STREET_MAP_ID;
  try {
    runOk(ctx, "paint_road", {
      mapId,
      style: "sand",
      naturalness: 0,
      points: [
        { x: 30, y: roadY },
        { x: 42, y: roadY },
      ],
    }, warnings);
    runOk(ctx, "paint_road", {
      mapId,
      style: "sand",
      naturalness: 0,
      points: [
        { x: 30, y: roadY + 1 },
        { x: 42, y: roadY + 1 },
      ],
    }, warnings);
  } catch (err) {
    warnings.push(`paint_road 연결 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * RM2k3 식 고상 데크:
 * - 내부: wood floor body (전방향 ○)
 * - 사방 가장자리: 바깥 방향만 막힌 edge 칩 (4 dir)
 * - 모서리·남단: timber × 난간 + 상위 레일
 * - 서측 층계 칸만 body(○) → 도로에서만 올라감
 */
function stampShoppingStreetDeck(map: GameMap): void {
  const { x, y, w, h } = SHOP_DECK;
  const stairYs = new Set<number>(STAIR_WORLD_Y);

  // 1) 본체 채움
  for (let dy = 0; dy < h; dy += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      setLower(map, x + dx, y + dy, WOOD_FLOOR);
      // 상위 잔여 장식 제거(이전 solid 돌단 등이 층계를 막지 않게)
      setUpper(map, x + dx, y + dy, TILE.EMPTY);
    }
  }

  // 2) 가장자리 4방향 칩 (모서리는 나중에 timber로 덮음)
  for (let dx = 1; dx < w - 1; dx += 1) {
    setLower(map, x + dx, y, WOOD_EDGE_N);
    setLower(map, x + dx, y + h - 1, WOOD_EDGE_S);
  }
  for (let dy = 1; dy < h - 1; dy += 1) {
    const worldY = y + dy;
    // 층계 칸만 전방향 ○ — 그 외 서측은 ← 막힘
    setLower(map, x, worldY, stairYs.has(worldY) ? WOOD_FLOOR : WOOD_EDGE_W);
    setLower(map, x + w - 1, worldY, WOOD_EDGE_E);
  }

  // 3) 모서리·남단 시각 난간 (× 칩 — 완전 차단, RM2k3 난간)
  for (let dx = 0; dx < w; dx += 1) {
    setLower(map, x + dx, y + h - 1, TIMBER_RAIL);
    setUpper(map, x + dx, y + h - 1, dx === 0 ? RAIL_L : dx === w - 1 ? RAIL_R : RAIL_M);
  }
  setLower(map, x, y, TIMBER_POST);
  setLower(map, x + w - 1, y, TIMBER_POST);
  setLower(map, x, y + h - 1, TIMBER_POST);
  setLower(map, x + w - 1, y + h - 1, TIMBER_POST);
  // 서측 비층계 구간: 기둥으로 시각 보강(층계 칸은 비움)
  for (let dy = 1; dy < h - 1; dy += 1) {
    const worldY = y + dy;
    if (stairYs.has(worldY)) continue;
    // edgeWest 유지 — 통행은 4dir, 상위 레일은 남단만
  }

  // 4) 층계 접근 (지면 → 데크): 돌계단 ○ 전방향. 연석(×)은 층계 옆이 아니라 위·아래 한 칸 떨어뜨려 길을 막지 않음.
  for (const sy of STAIR_WORLD_Y) {
    setLower(map, x - 2, sy, STONE_STAIR_L);
    setLower(map, x - 1, sy, STONE_STAIR_M);
    setUpper(map, x - 2, sy, TILE.EMPTY);
    setUpper(map, x - 1, sy, TILE.EMPTY);
  }
  // 연석 장식 — 층계 행이 아닌 y에만 (통행 경로 밖)
  setUpper(map, x - 1, STAIR_WORLD_Y[0] - 2, STONE_STEP);
  setUpper(map, x - 1, STAIR_WORLD_Y[1] + 2, STONE_STEP);

  // 5) 카운터·소품 (내부만) — 천막 없음, 나무 데크 위 카운터만
  stampCounter(map, x + 1, y + 3);
  stampCounter(map, x + 6, y + 3);
  stampCounter(map, x + 3, y + 7);
  setUpper(map, x + 1, y + 2, WOOD_BOX);
  setUpper(map, x + 4, y + 2, FRUIT_L);
  setUpper(map, x + 5, y + 2, FRUIT_R);
  setUpper(map, x + 10, y + 2, WOOD_BOX);
  setUpper(map, x + 8, y + 8, FIREWOOD);

  // 주변 소품 (데크 밖)
  setUpper(map, x + 2, y + h + 2, FLOWER);
  setUpper(map, x + 3, y + h + 2, FLOWER);
  setUpper(map, x + 6, y + h + 3, BENCH_L);
  setUpper(map, x + 7, y + h + 3, BENCH_R);
  stampConifer(map, x + w, y + 1);
  stampConifer(map, x + w + 1, y + 4);
  stampConifer(map, x + w, y + h + 1);
}

function stampCounter(map: GameMap, x: number, y: number): void {
  setUpper(map, x, y, TABLE_L);
  setUpper(map, x + 1, y, TABLE_M);
  setUpper(map, x + 2, y, TABLE_M);
  setUpper(map, x + 3, y, TABLE_R);
}

/**
 * RM2k3 상점 정석:
 * - 카운터(탁자) 칸에 투명 이벤트 → shop
 * - 카운터 뒤 NPC 스프라이트 → 옆/뒤로 말 걸면 잡담만
 * (정면에서 카운터를 조사하면 상점, 돌아가서 NPC에게 말하면 다른 대사)
 */
function addShopkeepers(map: GameMap): void {
  const { x, y } = SHOP_DECK;
  // stampCounter(x+1,y+3), (x+6,y+3), (x+3,y+7) 와 맞춤
  const stalls = [
    {
      id: "potion",
      counterX: x + 2,
      counterY: y + 3,
      npcX: x + 2,
      npcY: y + 2,
      speaker: "포션 상인 루나",
      sprite: "tex_easyrpg_charset_actor1",
      charIndex: 0,
      items: [DEFAULT_ITEM_ID, "item_hi_potion", "item_ether"] as const,
      shopLine: "포션 가게입니다. 필요한 걸 골라 보세요.",
      sideLine: "요즘 여행자가 늘어서 포션이 잘 나가. 카운터 앞에서 말해 줘.",
    },
    {
      id: "tools",
      counterX: x + 7,
      counterY: y + 3,
      npcX: x + 7,
      npcY: y + 2,
      speaker: "도구 상인 바르",
      sprite: "tex_easyrpg_charset_people4",
      charIndex: 1,
      items: ["item_antidote", "item_wake_herb", DEFAULT_ITEM_ID] as const,
      shopLine: "해독제랑 각성초, 여기 카운터에서 사가.",
      sideLine: "장사 이야기는 카운터 앞에서. 옆에서 부르면 대답만 해 줄게.",
    },
    {
      id: "general",
      counterX: x + 4,
      counterY: y + 7,
      npcX: x + 4,
      npcY: y + 6,
      speaker: "잡화 상인 미나",
      sprite: "tex_easyrpg_charset_people2",
      charIndex: 2,
      items: [DEFAULT_ITEM_ID, "item_antidote"] as const,
      shopLine: "잡화는 이 카운터에서 거래해요.",
      sideLine: "여기서 수다만 떨 거지? 물건은 탁자 앞에서 사 가요.",
    },
  ] as const;

  for (const stall of stalls) {
    map.events.push(
      counterShopEvent(`ev_shop_counter_${stall.id}`, stall.counterX, stall.counterY, stall.speaker, stall.items, stall.shopLine),
    );
    map.events.push(
      merchantChatEvent(`ev_shop_npc_${stall.id}`, stall.npcX, stall.npcY, stall.speaker, stall.sprite, stall.charIndex, stall.sideLine),
    );
  }
}

/** 카운터(탁자) 위 투명 이벤트 — 앞에서 조사 시 shop */
function counterShopEvent(
  id: string,
  x: number,
  y: number,
  speaker: string,
  itemIds: readonly string[],
  greeting: string,
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: `${speaker} 카운터`,
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [
          { kind: "text", speaker, body: greeting },
          {
            kind: "shop",
            itemIds: [...itemIds],
            allowSell: true,
            quantityMode: "select",
            shopType: "normal",
            messageType: "welcome",
            branchOnTransaction: false,
            transactionBranch: [],
          } satisfies Command,
        ],
      } satisfies EventPage,
    ],
  };
}

/** 카운터 뒤 상인 — 옆/뒤로 말 걸면 잡담만 (shop 없음) */
function merchantChatEvent(
  id: string,
  x: number,
  y: number,
  speaker: string,
  spriteId: string,
  characterIndex: number,
  line: string,
): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: `${id}_page`,
        name: speaker,
        conditions: [],
        graphic: charsetGraphic(spriteId, characterIndex),
        trigger: { kind: "action" },
        priority: "same",
        overlapForbidden: true,
        movement: FIXED,
        commands: [{ kind: "text", speaker, body: line }],
      } satisfies EventPage,
    ],
  };
}

function charsetGraphic(spriteId: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}

function stampConifer(map: GameMap, x: number, y: number): void {
  if (!inside(map, x, y) || !inside(map, x, y + 1)) return;
  map.upperTiles[y * map.width + x] = TREE;
  map.lowerTiles[(y + 1) * map.width + x] = TREE_BOTTOM;
  map.upperTiles[(y + 1) * map.width + x] = TILE.EMPTY;
}

function setLower(map: GameMap, x: number, y: number, tile: number): void {
  if (!inside(map, x, y)) return;
  map.lowerTiles[y * map.width + x] = tile;
}

function setUpper(map: GameMap, x: number, y: number, tile: number): void {
  if (!inside(map, x, y)) return;
  map.upperTiles[y * map.width + x] = tile;
}

function inside(map: GameMap, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

const DEFAULT_TITLE_RESOURCE_ID = "easyrpg-title-title1";

function applyDefaultTitleScreen(project: Project, title: string): void {
  const base = defaultTitleScreenSettings();
  project.system = {
    ...project.system,
    titleResourceId: DEFAULT_TITLE_RESOURCE_ID,
    titleScreen: {
      ...base,
      title,
      backgroundResourceId: DEFAULT_TITLE_RESOURCE_ID,
      layout: { ...base.layout },
      menuLabels: { ...base.menuLabels },
    },
  };
}
