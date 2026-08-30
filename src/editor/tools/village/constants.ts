// editor/tools/village/constants.ts
// 마을 시공 공용 기반층 — 타일 상수·템플릿·기본 NPC·공용 타입(Rect/Point 등)·소형 공용 헬퍼.
//
// ⚠ 타일셋 스코프: village/ 디렉토리의 모든 원시 타일 id(문 116/146, 울타리 378~439,
// 돌마당 411/412/413, 우물 382, 깃발 208/209 등)는 combined_town 칩셋
// (easyrpg_chipset_combined_town, 30열×16행) 전용 좌표다. 다른 타일셋에서는 전부 깨진다 —
// build_village가 시공 전에 타일셋을 검사해 거부한다(builder.ts).

import type { FootprintWing, HouseKitId } from "@/editor/houseKit";
import { MIXABLE_HOUSE_KIT_IDS } from "@/editor/houseKit";
import type { HouseInteriorProgram } from "@/editor/houseInteriors";
import { DEFAULT_COBBLE_AUTOTILE_GROUP, DEFAULT_ROAD_AUTOTILE_GROUP, DEFAULT_SAND_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { HOUSE_TEMPLATE_DEFS, houseTemplateWingsAt } from "@/project/defaults/houseTemplateCatalog";
import type { GameMap, MapId, Project } from "@/project/types";
import type { Rng } from "@/util/rng";
import type { YardDecorKind } from "../houseLotDecor";
import type { ToolDefinition, ToolExecResult } from "../types";
import type {
  EdgeTrees,
  KitMix,
  PlazaLayout,
  PlazaStyle,
  RoadStyle,
  YardStyle,
} from "../villagePlan";

/** 주거 배치 패턴 — seed/쿼리로 갈라서 같은 템플릿만 반복하지 않는다. */
export type SettlementLayout = "plaza-ring" | "street-grid" | "clusters";

export interface VillageIntent {
  readonly theme: string;
  readonly pathStyle: RoadStyle;
  readonly kitMix: KitMix;
  readonly yardStyle: YardStyle;
  readonly plazaStyle: PlazaStyle;
  readonly edgeTrees: EdgeTrees;
  readonly plazaLayout: PlazaLayout;
  readonly roadWidth: number;
  readonly roadNaturalness: number;
  readonly settlementLayout: SettlementLayout;
  /** 집 순서별 마당 태그(LLM). 짧으면 스타일 팩으로 패딩. */
  readonly houseYards: readonly (readonly YardDecorKind[])[];
  /** 집 순서별 키트 강제(LLM). 없으면 kitMix. */
  readonly houseKits: readonly (HouseKitId | undefined)[];
  /** 집 순서별 exterior template id 강제 (예: l, rect-large). */
  readonly houseTemplates: readonly (string | undefined)[];
  /** 집 순서별 주인 이름 (실내 ownerName). */
  readonly houseOwners: readonly (string | undefined)[];
  /** 집 순서별 실내 program 강제. */
  readonly housePrograms: readonly (HouseInteriorProgram | undefined)[];
}

export const MIN_SIZE = 20;
export const MAX_SIZE = 256;
export const DEFAULT_SIZE = 50;
export const DEFAULT_HOUSES = 8;
export const MIN_HOUSES = 1;
/** 대형 마을(100×100 등)용 — 예전 12 상한은 대형 시공에 부족 */
export const MAX_HOUSES = 32;
export const PLAZA_WIDTH = 8;
export const PLAZA_HEIGHT = 6;
export const HOUSE_MARGIN = 2;
/** 마을 길 기본 폭(칸). 예전은 1칸 폴리라인만 써서 실핀처럼 보였다. */
export const DEFAULT_ROAD_WIDTH = 2;
export const MAX_ROAD_WIDTH = 3;
/** 집 bbox 바깥 1칸 필지에 울타리(상단 투명 오버레이). HOUSE_MARGIN=2라 이웃 집과 겹치지 않는다. */
export const FENCE_LOT_MARGIN = 1;
/** 문 앞 남쪽 울타리 게이트 반폭(총 3칸: door.x±1). 길·NPC 동선 확보. */
export const FENCE_GATE_HALF_WIDTH = 1;
// 울타리 둘레 세트 정본(2026-07-16 사용자 교정): 378/380=위 모서리, 438/410=아래 모서리,
// 379=가로대, 408=세로 변, 409=왼쪽 끝 가로대, 439=오른쪽 끝 가로대.
export const FENCE_TOP_LEFT = 378;
export const FENCE_TOP_RAIL = 379;
export const FENCE_TOP_RIGHT = 380;
export const FENCE_SIDE_RAIL = 408;
export const FENCE_END_LEFT = 409;
export const FENCE_END_RIGHT = 439;
export const FENCE_BOTTOM_RIGHT = 410;
export const FENCE_BOTTOM_LEFT = 438;
export const FENCE_TILES = new Set<number>([
  FENCE_TOP_LEFT,
  FENCE_TOP_RAIL,
  FENCE_TOP_RIGHT,
  FENCE_SIDE_RAIL,
  FENCE_BOTTOM_RIGHT,
  FENCE_BOTTOM_LEFT,
  409,
  439,
]);
export const DOOR_TOP_TILE = 116;
export const DOOR_BOTTOM_TILE = 146;
export const WINDOW_TILES = new Set<number>([85, 87]);
/** 411/412/413/443은 용도 미확정으로 사용 금지(2026-07-16 사용자 밴). 돌길 정본은 포석 129 블록. */
export const BANNED_STONE_TILES = new Set<number>([411, 412, 413, 443]);
/** 감사·울타리 정리용 — 흙길+모래+포석 모두 길로 본다. */
export const ROAD_TILES = new Set<number>([
  ...DEFAULT_ROAD_AUTOTILE_GROUP.memberTileIds,
  ...DEFAULT_SAND_AUTOTILE_GROUP.memberTileIds,
  ...DEFAULT_COBBLE_AUTOTILE_GROUP.memberTileIds,
]);
export const DEFAULT_ROAD_STYLE: RoadStyle = "sand";
// 랜덤 믹스 대상 킷만 — aframe-stone은 지오메트리 종속이라 템플릿이 강제할 때만 쓴다.
export const HOUSE_KITS: readonly HouseKitId[] = MIXABLE_HOUSE_KIT_IDS;
/** 집마다 seed로 고르는 마당 꾸밈 테마(place_props 태그). */
// 마당 랜덤 가방 규칙(2026-07-16):
// - 벤치는 길 옆 전용(placeBenchesAlongRoads가 길과 평행하게 배치) — 마당 산포 금지.
// - 과일박스는 시장(장터 데크) 전용 — 마당 산포 금지. 명시적 yard 태그로는 여전히 허용.
export const YARD_THEMES: readonly (readonly YardDecorKind[])[] = [
  ["mailbox", "flowers"],
  ["firewood", "pot"],
  ["barrel", "jar"],
  ["wood_box", "flowers"],
  ["wood_box", "pot"],
  ["sign", "mailbox"],
  ["flowers", "jar"],
  ["barrel", "flowers"],
  ["firewood", "jar", "flowers"],
  ["mailbox", "pot", "wood_box"],
];
export const YARD_STYLE_POOLS: Record<YardStyle, readonly (readonly YardDecorKind[])[]> = {
  mixed: YARD_THEMES,
  garden: [
    ["flowers", "pot"],
    ["flowers", "jar"],
    ["pot", "flowers"],
    ["pot", "jar", "flowers"],
    ["flowers", "mailbox"],
  ],
  workshop: [
    ["firewood", "wood_box"],
    ["mailbox", "wood_box"],
    ["firewood", "barrel"],
    ["sign", "wood_box"],
    ["barrel", "jar"],
  ],
  market: [
    ["barrel", "wood_box"],
    ["sign", "wood_box"],
    ["sign", "mailbox"],
    ["barrel", "pot"],
    ["wood_box", "jar"],
  ],
  minimal: [["mailbox"], ["flowers"], ["pot"], ["sign"], ["jar"]],
};
export const VILLAGE_NPC_GRAPHIC_REFS: readonly (readonly [textureKey: string, characterIndex: number])[] = [
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

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface HouseTemplate {
  readonly id: string;
  readonly name: string;
  readonly w: number;
  /** footprint 층수. 기본 1. */
  readonly stories?: 1 | 2 | 3;
  readonly h: number;
  /** 낮은 벽(상단+하단 2행) — 헛간·창고·오두막. */
  readonly lowWall?: boolean;
  /** 킷 강제 — aframe처럼 지오메트리가 킷에 종속인 템플릿. 랜덤 믹스보다 우선. */
  readonly kitId?: HouseKitId;
  /** 옥상 판자 데크 + 벽면 사다리(파랑 평지붕 전용) — houses.ts applyRoofDeck. */
  readonly roofDeck?: boolean;
  /** 원점(0,0) 기준 날개 — 선언형 형태 데이터. */
  readonly wings: readonly FootprintWing[];
  /** wings를 시공 좌표로 평행이동한 것. houseTemplateWingsAt의 얇은 래퍼. */
  wingsAt(x: number, y: number): FootprintWing[];
}

export interface HouseCandidate {
  readonly template: HouseTemplate;
  readonly bbox: Rect;
  readonly organic: boolean;
}

export interface BuiltHouse {
  readonly bbox: Rect;
  readonly doorAt: Point;
  /**
   * 문 칸(상·하) 의 정본 하위 타일. 문 이벤트가 외형을 맡으면 킷 벽 타일,
   * 이벤트 없는 타일 문이면 116/146 이다. 길·지형·조경 패스가 덮었을 때
   * restoreHouseDoors 가 이 값으로 되돌리고, audit 이 훼손 여부를 이 값으로 센다.
   */
  readonly doorTiles?: { readonly top: number; readonly bottom: number };
  readonly front: Point;
  readonly kitId: HouseKitId;
  readonly stories: 1 | 2 | 3;
  readonly templateId: string;
  /** Explicit owner for interiors (preferred over NPC-index heuristic). */
  readonly ownerName?: string;
  /** Explicit interior program (preferred over ownerName regex). */
  readonly program?: HouseInteriorProgram;
}

export interface VillageHouseInteriorRef {
  readonly houseIndex: number;
  readonly ownerName: string;
  readonly interiorMapId: MapId;
  readonly doorEventId: string;
  readonly exitEventId: string;
  readonly entry: Point;
  readonly exit: Point;
  readonly returnTo: Point;
  readonly scale: string;
  readonly program: string;
  readonly stories: 1 | 2 | 3;
  readonly upperMapId?: MapId;
  readonly floorMapIds?: readonly MapId[];
}

export interface Plaza {
  readonly rect: Rect;
  readonly centerRow: number;
  readonly centerX: number;
}

export interface NpcText {
  readonly name: string;
  readonly lines: readonly string[];
}

export interface VillageAudit {
  readonly doorsConnected: number;
  readonly doorsIntact: number;
  readonly roadInsideHouses: number;
  /** 용마루 행(bbox.y-1)을 침범한 길/키트 외 upper 칸 수 — 0이어야 한다. */
  readonly ridgeInvaded: number;
  readonly roadComponents: number;
  readonly npcCount: number;
  readonly npcsWithText: number;
  readonly windowCount: number;
  readonly fencedHouses: number;
  readonly fenceTiles: number;
}

// 형태 카탈로그 — 선언형 데이터 정본은 project/defaults/houseTemplateCatalog.ts(34종)에 있다.
// 여기서는 시공 코드가 쓰는 wingsAt(x, y) 표면만 씌운다 — 데이터 → 함수 어댑터.
// 카탈로그 규칙(층 구간 최소 높이·w 상한·estate·aframe 공식)은 그 파일 머리 주석에 있다.
export const HOUSE_TEMPLATES: readonly HouseTemplate[] = HOUSE_TEMPLATE_DEFS.map((def): HouseTemplate => ({
  ...def,
  wingsAt: (x: number, y: number) => houseTemplateWingsAt(def, x, y),
}));

export const DEFAULT_NPCS: readonly NpcText[] = [
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

export function requireTool(tools: readonly ToolDefinition[], name: string): ToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`필수 툴을 찾을 수 없습니다: ${name}`);
  return tool;
}

export function runNested(tool: ToolDefinition, draft: Project, args: Record<string, unknown>, warnings: string[]): ToolExecResult {
  const result = tool.run(draft, args);
  if (result.warnings) warnings.push(...result.warnings);
  return result;
}

export function uniqueId(draft: Project, prefix: string, body: string): string {
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

export function expandRect(rect: Rect, margin: number): Rect {
  return { x: rect.x - margin, y: rect.y - margin, w: rect.w + margin * 2, h: rect.h + margin * 2 };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const temp = copy[i] as T;
    copy[i] = copy[j] as T;
    copy[j] = temp;
  }
  return copy;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function pointInMap(map: GameMap, point: Point): boolean {
  return point.x >= 0 && point.y >= 0 && point.x < map.width && point.y < map.height;
}

export function pointInRect(point: Point, rect: Rect): boolean {
  return point.x >= rect.x && point.y >= rect.y && point.x < rect.x + rect.w && point.y < rect.y + rect.h;
}

export function coordKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function pointFromKey(key: string): Point {
  const [x, y] = key.split(",").map(Number);
  return { x: x ?? 0, y: y ?? 0 };
}
