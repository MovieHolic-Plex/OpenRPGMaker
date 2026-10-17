// ai/stampPlanner.ts
// 바로 깔기의 모델 계획 층 — 한 번의 가벼운 모델 호출로 문장을 여러 도구 단계로 나눈다.
//
// 왜: 옛 정규식 계획(stampPlace.ts, 2026-09-27 삭제)은 문장 하나를 도구 하나로 옮기고 남은 낱말을 재료로 넣었다.
// 「땅으로」가 place_props material 이 되어 「라벨/설명이 "땅으로" 인 타일을 찾지 못했습니다」로 끝났고,
// 「땅을 동그랗게, 물을 동그랗게 옆에 나무」처럼 여러 부분으로 나눠 말하면 알아듣지 못했다(2026-09-25 사용자 신고).
// 여기서는 모델이 **실제 타일셋 라벨 중에서** 재료를 고르고, 대상 사각형 안에 단계마다 하위 사각형을 나눈다.
// 좌표·도구·인자 모양은 코드가 검증한다 — 대상 사각형 밖으로 나간 칸은 잘라 내고, 허용 목록 밖 도구는 버린다.
// 이 파일은 순수하다(네트워크·스토어 없음). 호출·실행은 editor/stampPlaceRunner.ts.
import { clampChestGold, type MapPlacementContext } from "./mapPlacementContext";
import { acceptedObjectNames, baseName, nearestStampObjects, resolveStampObject, type StampObjectEntry } from "./stampObjects";

export type StampTool =
  | "fill_region"
  | "place_props"
  | "paint_road"
  | "tile_erase"
  | "build_wall"
  | "place_door"
  | "place_chest"
  | "place_npc"
  | "place_savepoint"
  | "place_examine_hotspots"
  | "make_villager"
  | "place_storage_chest"
  | "place_trap"
  | "place_battle_blocker"
  | "set_scene_mood"
  | "set_start_position"
  | "move_event"
  | "remove_event"
  | "place_inn"
  | "place_signpost"
  | "place_object"
  | "stamp_tileset_object"
  | "place_house"
  | "place_terrain_house"
  | "build_jp_city_building"
  | "stamp_object"
  | "place_dungeon_room"
  | "paint_tiles"
  | "set_street_traffic";

export const STAMP_TOOLS: readonly StampTool[] = [
  "fill_region",
  "place_props",
  "paint_road",
  "tile_erase",
  "build_wall",
  "place_door",
  "place_chest",
  "place_npc",
  "place_savepoint",
  "place_examine_hotspots",
  "place_storage_chest",
  "place_trap",
  "place_battle_blocker",
  "set_scene_mood",
  "set_start_position",
  "move_event",
  "remove_event",
  "place_inn",
  "place_signpost",
  "place_object",
  "place_house",
  "place_dungeon_room",
  "set_street_traffic",
];

/** 한 번에 받을 단계 상한. 바로 깔기는 한 문장이라 이보다 많으면 모델이 쪼개기에 빠진 것이다. */
export const STAMP_MAX_STEPS = 8;

export interface StampRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface StampStep {
  readonly tool: StampTool;
  /** 도구에 그대로 넘길 인자(mapId 포함). */
  readonly args: Record<string, unknown>;
  /** 채팅에 남길 한 줄 라벨. */
  readonly label: string;
  /** 코드가 고친 점과 근거(예: 상자 금액 보정). 결과 줄에 붙인다. */
  readonly note?: string;
  /** 같은 요청에서 나온 여러 개(화분 세 개 = 도구 호출 셋)를 결과 줄 하나로 묶는 표지. */
  readonly group?: string;
  /** 이 단계가 놓는 칸(결과 줄에 좌표로 적는다). */
  readonly at?: readonly { readonly x: number; readonly y: number }[];
}

/** 모델에게 주는 사실. 재료는 현재 맵 타일셋의 실제 라벨이다. */
export interface StampPlanFacts {
  readonly text: string;
  readonly mapId: string;
  readonly mapWidth: number;
  readonly mapHeight: number;
  /** 대상 사각형 — 선택 영역이면 그것, 없으면 맵 전체. */
  readonly target: StampRect;
  readonly targetIsSelection: boolean;
  readonly tilesetId?: string;
  /** fill_region 이 받는 면 재료 라벨(fillableMaterialSuggestions). */
  readonly fillMaterials: readonly string[];
  /** 채팅 컨텍스트와 같은 소품·지형 라벨 힌트 한 줄(formatMaterialLabelHint). */
  readonly materialHint: string;
  /** 벽·문 라벨 후보(있을 때만). */
  readonly wallMaterials?: readonly string[];
  readonly doorMaterials?: readonly string[];
  /** 현재 맵 사실 — 상자 보상·NPC·조사 지점을 이 맵에 맞춰 고르는 근거(1순위). */
  readonly placement?: MapPlacementContext;
  /** 이 칩셋에서 놓을 수 있는 물건 사전(place_object 이름 대조용 — 모델에게 보내지 않는다). */
  readonly objects?: readonly StampObjectEntry[];
  /** 모델에게 보여 줄 「이 칩셋에 실제로 있는 물건 이름」 견본 — 이름 어휘를 맞추게 하는 데만 쓴다. */
  readonly objectSamples?: readonly string[];
  /** 한 칸이 물건 발자국에 들어도 되는 자리인가(통행 가능·위층 비어 있음·이벤트·시작칸 아님) — 실행 시점의 맵. */
  readonly isOpenCell?: (x: number, y: number) => boolean;
  /** 그 칸에 보이는 그림(위층 타일·겹침·보이는 이벤트)이 이미 있는가 — 그림 없는 조사 지점을 거르는 데 쓴다. */
  readonly hasArtAt?: (x: number, y: number) => boolean;
  /** 수리 라운드 — 물건 이름이 사용자 문장에 실제로 든 낱말이어야 한다(문 달기가 실패하자 「뚜껑문」으로 바꿔 깔던 대체를 막는다). */
  readonly repairRound?: boolean;
  /** 그 칸이 벽 어휘 타일인가 — place_door 는 벽 칸에만 달린다(아니면 도구가 거부해 수리 호출만 낭비한다). */
  readonly isWallCell?: (x: number, y: number) => boolean;
  /** place_props 의 material 이 나무(density 를 받는 재료)인가 — 아니면 density 를 칸 수로 바꾼다(첫 호출이 항상 실패하던 길). */
  readonly isTreeMaterial?: (material: string) => boolean;
  /** 이 칩셋에서 바로 깔기가 지을 수 있는 집 외관 수(조립식 스타일 또는 집 키트). 0 이면 place_house 를 거절한다. */
  readonly houseLooks?: number;
  /** 벽 부착물(벽 횃불·아치·현수막)이 붙을 수 있는 벽면 칸인가. */
  readonly isWallMountCell?: (x: number, y: number) => boolean;
  /** 다리(돌다리·아치 다리·널다리)가 가로지를 물·용암 칸인가. */
  readonly isWaterCell?: (x: number, y: number) => boolean;
  /** 차량·횡단보도가 놓일 차도 칸인가. */
  readonly isRoadCell?: (x: number, y: number) => boolean;
}

export const STAMP_PLANNER_SYSTEM_PROMPT = [
  "You turn ONE short Korean map-editing sentence into direct tool steps for a 2D tile RPG editor. No questions, no plan prose.",
  "Return ONLY a JSON object: {\"steps\":[{\"tool\":\"...\",\"args\":{...},\"label\":\"짧은 한국어 설명\"}]}.",
  "Rules:",
  "- Every rectangle/point MUST lie inside facts.target (map coordinates, x right, y down, w/h in tiles). Split the target into sub-rectangles when the sentence names several parts (\"A 옆에 B\", \"왼쪽/오른쪽\", \"가운데\"). Parts should not overlap unless the sentence says so.",
  "- material MUST be copied verbatim from the provided labels (facts.fillMaterials for fill_region; the labels in facts.materialHint for place_props; facts.wallMaterials / facts.doorMaterials for walls/doors). Map everyday words to the closest real label: 땅/흙/맨땅 → a dirt/soil/earth fill label; 풀밭/잔디 → grass; 물/호수/연못 → water; 숲/나무 → a tree label. Never invent a label; never use a group id.",
  "- Shapes: 동그랗게/원/둥근/호수/연못 → fill_region shape \"circle\" (ellipse for wide ovals); otherwise \"rect\".",
  "- A circle needs a square box: give circle steps a sub-rectangle with w == h (the largest square that fits its part); use ellipse only when the user says 타원/길쭉하게.",
  "- Trees/forest use place_props with density: 숲/나무/숲길 → \"dense\" (walkable forest with water, small trees, rocks and hidden canopy paths), 울창/빽빽/통행 불가/막힌 → \"impassable\", 성글게 → \"normal\", 드문드문/가로수 → \"sparse\". density is ONLY for tree labels — never send density with any other material. Decorative crates/boxes (장식 상자·나무 상자) are place_props with count.",
  "- HOUSES & BUILDINGS (집·주택·단독주택·민가·오두막·가옥·초가집·저택·살림집·여관·상점·대장간·편의점·카페·이자카야·오피스·빌딩·아파트·은행·병원·호텔·건물 한 채/두 채) are ONE place_house step {area|at, kind?, size?, count?, stories?}. Put kind = the Korean building noun when specific (e.g. \"여관\",\"편의점\",\"카페\",\"이자카야\",\"오피스\",\"단독주택\"). Code picks this tileset's real building exterior (roof, walls, windows and door included) and a flat empty spot. NEVER build or imitate a house/building with build_wall, place_door, fill_region, place_props or place_object. size: 작은 → \"small\", 큰/저택/빌딩 → \"large\", otherwise \"medium\". If facts.houseLooks is 0 still send place_house — code refuses honestly.",
  "- DUNGEON ROOMS & CORRIDORS (던전 방·입구 방·중앙 홀·보물 방·함정 방·깊은 방·던전 복도 연결) use place_dungeon_room {area:{x,y,w,h}, kind:\"room\"|\"corridor\"|\"connect\", style?:\"crypt\"|\"sewer\"|\"temple\"|\"volcano\"|\"cave\", hazard?:\"lava\"|\"water\"} first so code carves the dungeon ceiling, 2-row north wall face, and stone floor before placing stairs, pillars, torches, chests, or traps.",
  "- PHYSICAL THINGS (물건: 화분·의자·탁자·침대·벤치·우물·가로등·자판기·책장·동상·우체통·통·바위·돌·카펫·모닥불·꽃밭·덤불 한 포기…) are placed ONLY with place_object {name, alternatives?, area|at, count?}. name = the correctly spelled everyday Korean noun alone (fix typos: 화뷴→화분, 의짜→의자; no numbers or verbs); alternatives = up to 3 true synonyms of the SAME thing (탁자→[\"테이블\",\"식탁\"]); never a different or merely similar thing (왕좌≠의자, 대포≠화로) — code ignores those and refuses honestly. Code looks the name up among this tileset's real object pictures (facts.objectNames are examples of names that exist) and REFUSES, listing the nearest names, when no picture matches. So NEVER imitate a thing with place_examine_hotspots (it makes an INVISIBLE event), place_npc/make_villager (people only), or a terrain place_props — those make invisible, wrong or person-shaped things. place_chest, place_savepoint, place_signpost keep their own jobs; place_door only goes on an existing WALL cell (code drops it, saying so, when the target has no wall). Use place_props only for terrain-like scatter with labels copied from the lists, never for a named object. Counts (세 개·둘·여러) → count (default 1, max 8); position words (창가·구석·가운데·왼쪽·입구 옆) → pick area/at inside the target accordingly.",
  "- Game objects: 보물상자/상자(열어서 얻는) → place_chest; 사람/주민/상인/NPC/경비 → place_npc (one step per person, give each a fitting Korean name and 1-2 short lines); 세이브/저장 → place_savepoint; 조사/살펴보기 → place_examine_hotspots ONLY on a cell that already shows a picture (a drawn painting, statue, sign…; code drops hotspots on bare floor); 표지판 → place_signpost. Put them on walkable ground inside the target, not on trees, water or walls.",
  "- More game objects: 상인(물건 파는) → place_npc with merchant:true and stock:[itemId...] from facts.placement.rewardItems / existing shops; 보관 상자/창고 → place_storage_chest; 함정/가시/즉사 → place_trap; 길막 몬스터/보스 앞 적 → place_battle_blocker with troopId from facts.placement.encounterTroops (skip it if that list is empty); 비·눈·폭풍·안개 → set_scene_mood; 시작 위치 → set_start_position; 기존 것 옮기기/지우기 → move_event/remove_event with an eventId from facts.placement.existing.occupied.",
  "- facts.placement.role says what this map is. TOWN (마을): prefer townsfolk with lines, merchants with stock, an inn keeper (place_inn, price from facts.placement.innPrice), signposts at road forks and entrances (place_signpost), a savepoint near the inn, examine hotspots on wells/boards; put people beside roads and doors, never inside houses or on the road itself; chests are rare and small. No traps or blocking monsters in a town unless the sentence asks. INTERIOR: a few NPCs/props, no monsters. DUNGEON/FIELD: chests, blockers from encounterTroops, traps on corridors.",
  "- Empty sentence in a TOWN means: fill it like a lived-in village (2~4 townsfolk, 1 merchant if no shop exists yet, 1 signpost), not treasure and monsters.",
  "- Do not put a new object on or right above/below a cell in facts.placement.existing.occupied, nor on another new object; code moves overlapping ones but choose free cells first.",
  "- facts.placement describes THIS map (its fights, existing chests, shops, NPCs, wiki). It is the main reference. Chest gold MUST be inside facts.placement.chestGold.min..max; prefer an item from facts.placement.rewardItems (use its id) when the sentence asks for items. Never invent item ids. NPC names must not repeat facts.placement.existing.npcs. Match NPC lines to the map name, locations and wiki.",
  "- An empty sentence (\"(빈 입력) …\") means: decorate the target sensibly for this map (terrain first); add at most one game object and only if it clearly fits.",
  "- Order steps ground first (fill_region / paint_road), then houses/walls, then props, so props land on finished ground.",
  "- Do not add things the user did not ask for. Empty steps [] only if nothing can be done.",
  `- At most ${STAMP_MAX_STEPS} steps. Omit mapId; code fills it.`,
  "Tool arg shapes (only these keys):",
  "fill_region {rect:{x,y,w,h}, material, shape?:\"rect\"|\"circle\"|\"ellipse\", clearUpper?:boolean}",
  "place_props {area:{x,y,w,h}, material, density?:\"sparse\"|\"normal\"|\"dense\"|\"impassable\", count?:int, packing?:\"natural\"|\"dense\"}",
  "paint_road {points:[{x,y},...], style?:\"dirt\"|\"sand\"}",
  "tile_erase {rect:{x,y,w,h}, layer?:\"both\"|\"lower\"|\"upper\"}",
  "build_wall {rect:{x,y,w,h}, material}  (a free-standing wall or fence only — never a house)",
  "place_door {at:{x,y}, material}  (only on an existing wall cell)",
  "place_house {area?:{x,y,w,h}, at?:{x,y}, kind?:string, size?:\"small\"|\"medium\"|\"large\", count?:1..4, stories?:1|2}",
  "place_dungeon_room {area:{x,y,w,h}, kind?:\"room\"|\"corridor\"|\"connect\", style?:\"crypt\"|\"sewer\"|\"temple\"|\"volcano\"|\"cave\", hazard?:\"lava\"|\"water\"}",
  "place_chest {at:{x,y}, gold?:int, itemId?:string, why?:\"short basis\"}",
  "place_npc {at:{x,y}, name, role?:string, lines?:[\"...\"], merchant?:boolean, stock?:[itemId]}",
  "place_savepoint {at:{x,y}, mode?:\"both\"|\"slot\"|\"checkpoint\", heal?:boolean}",
  "place_examine_hotspots {spots:[{at:{x,y}, name, lines:[\"...\"]}]}",
  "place_storage_chest {at:{x,y}}",
  "place_inn {at:{x,y}, name?, price?:number, greeting?:string}",
  "place_signpost {at:{x,y}, lines:[\"북쪽: 어둠 동굴\"]}",
  "place_object {name:\"화분\", alternatives?:[\"동의어\"], at?:{x,y}, area?:{x,y,w,h}, count?:int}",
  "place_trap {at:{x,y}, trigger?:\"touch\"|\"action\", message?:string}",
  "place_battle_blocker {at:{x,y}, troopId, intro?:[\"...\"]}",
  "set_scene_mood {weather:{kind:\"none\"|\"rain\"|\"storm\"|\"snow\"|\"fog\", intensity?:0..1}}",
  "- MOVING CARS / STREET TRAFFIC (도로에 차/자동차/승용차/버스/택시/순찰차가 다니게·움직이는 차·차량 흐름·교차로 회전 차량): use ONE set_street_traffic step {density?:\"sparse\"|\"normal\"|\"busy\", includeTurns?:boolean, includeBus?:boolean, clear?:boolean}. Never place an NPC or static prop when the user asks for moving cars/traffic.",
  "set_start_position {at:{x,y}}",
  "set_street_traffic {density?:\"sparse\"|\"normal\"|\"busy\", includeTurns?:boolean, includeBus?:boolean, clear?:boolean}",
  "move_event {eventId, at:{x,y}}",
  "remove_event {eventId}",
].join("\n");

export function buildStampPlannerUserPayload(facts: StampPlanFacts): string {
  return JSON.stringify({
    sentence: facts.text,
    map: { id: facts.mapId, width: facts.mapWidth, height: facts.mapHeight },
    target: { ...facts.target, source: facts.targetIsSelection ? "user selection" : "whole map" },
    tileset: facts.tilesetId ?? null,
    fillMaterials: facts.fillMaterials,
    materialHint: facts.materialHint,
    ...(facts.wallMaterials?.length ? { wallMaterials: facts.wallMaterials } : {}),
    ...(facts.doorMaterials?.length ? { doorMaterials: facts.doorMaterials } : {}),
    houseLooks: facts.houseLooks ?? 0,
    ...(facts.objectSamples?.length ? { objectNames: facts.objectSamples } : {}),
    ...(facts.placement ? { placement: placementForModel(facts.placement) } : {}),
  });
}

/** 모델에게 보내는 맵 사실 — 거르는 데만 쓰는 id 목록은 뺀다(토큰만 먹는다). */
function placementForModel(placement: MapPlacementContext): Omit<MapPlacementContext, "knownItemIds" | "itemPrices"> {
  const { knownItemIds: _known, itemPrices: _prices, ...rest } = placement;
  return rest;
}

/** 실패한 단계와 도구 오류를 보여 주고 대체 단계만 받는다. */
export function buildStampRepairPrompt(failures: readonly { readonly step: StampStep; readonly error: string }[]): string {
  const listed = failures.map((failure, index) => {
    const args = Object.fromEntries(Object.entries(failure.step.args).filter(([key]) => key !== "mapId"));
    return `${index + 1}. ${JSON.stringify({ tool: failure.step.tool, args, label: failure.step.label })}\n   error: ${failure.error}`;
  }).join("\n");
  return [
    "These steps failed when executed:",
    listed,
    "Return {\"steps\":[...]} with replacement steps for ONLY the failed steps (same JSON shape and rules). Use a label the error suggests or one from the provided lists. If a step cannot be fixed, leave it out. Never replace a failed thing with a person/NPC/merchant, an invisible examine hotspot, or an unrelated terrain scatter — leaving it out is the honest answer.",
  ].join("\n");
}

// ── 파싱·검증 ────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteInt(value: unknown): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : null;
}

/** 모델 본문에서 JSON 객체 하나를 꺼낸다 — 코드펜스·앞뒤 잡담을 견딘다. */
export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/iu.exec(trimmed);
  const body = fenced?.[1]?.trim() ?? trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(body.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

/** 사각형을 대상 안으로 자른다. 겹침이 없으면 null. */
export function clampRectToTarget(value: unknown, target: StampRect): StampRect | null {
  if (!isRecord(value)) return null;
  const x = finiteInt(value.x);
  const y = finiteInt(value.y);
  const w = finiteInt(value.w ?? value.width);
  const h = finiteInt(value.h ?? value.height);
  if (x === null || y === null || w === null || h === null || w < 1 || h < 1) return null;
  const x0 = Math.max(x, target.x);
  const y0 = Math.max(y, target.y);
  const x1 = Math.min(x + w, target.x + target.w);
  const y1 = Math.min(y + h, target.y + target.h);
  if (x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function clampPointToTarget(value: unknown, target: StampRect): { x: number; y: number } | null {
  if (!isRecord(value)) return null;
  const x = finiteInt(value.x);
  const y = finiteInt(value.y);
  if (x === null || y === null) return null;
  return {
    x: Math.min(target.x + target.w - 1, Math.max(target.x, x)),
    y: Math.min(target.y + target.h - 1, Math.max(target.y, y)),
  };
}

function roadPoints(area: StampRect): { x: number; y: number }[] {
  if (area.w >= area.h) {
    const y = area.y + Math.floor((area.h - 1) / 2);
    return [{ x: area.x, y }, { x: area.x + area.w - 1, y }];
  }
  const x = area.x + Math.floor((area.w - 1) / 2);
  return [{ x, y: area.y }, { x, y: area.y + area.h - 1 }];
}

function stringArg(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function enumArg<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

/** 칩셋에 그림이 없어 깔지 않은 물건 — 이벤트·지형으로 흉내 내지 않고 가까운 이름을 보여 준다. */
export interface StampRefusal {
  readonly wanted: string;
  readonly nearest: readonly string[];
}

export type StampStepCheck =
  | { readonly step: StampStep }
  | { readonly dropped: string }
  | { readonly refused: StampRefusal };

const TOOL_KO: Record<StampTool, string> = {
  fill_region: "칠하기",
  place_props: "깔기",
  paint_road: "길",
  tile_erase: "지우기",
  build_wall: "벽",
  place_door: "문",
  place_chest: "보물상자",
  place_npc: "NPC",
  place_savepoint: "세이브 포인트",
  place_examine_hotspots: "조사 지점",
  make_villager: "상인",
  place_storage_chest: "보관 상자",
  place_trap: "함정",
  place_battle_blocker: "길막 몬스터",
  set_scene_mood: "분위기",
  set_start_position: "시작 위치",
  move_event: "옮기기",
  remove_event: "지우기",
  place_inn: "여관",
  place_signpost: "표지판",
  place_object: "물건",
  stamp_tileset_object: "물건",
  place_house: "집",
  place_terrain_house: "집",
  build_jp_city_building: "집",
  stamp_object: "건물",
  place_dungeon_room: "던전 방",
  paint_tiles: "타일 칠하기",
  set_street_traffic: "주행 차량",
};

/**
 * 모델 단계 하나 → 도구 인자. 허용 키만 옮기고 좌표를 대상 사각형 안으로 자른다.
 * 모델은 rect 이름을 도구마다 헷갈리므로 rect/area 를 서로 받아 준다.
 */
export function validateStampStep(raw: unknown, facts: StampPlanFacts): StampStepCheck {
  if (!isRecord(raw)) return { dropped: "단계가 객체가 아닙니다" };
  const rawTool = typeof raw.tool === "string" ? raw.tool.trim() : "";
  const tool = rawTool === "set_map_transit" ? "set_street_traffic" : rawTool;
  if (!(STAMP_TOOLS as readonly string[]).includes(tool)) return { dropped: `허용되지 않은 도구 ${tool || "(없음)"}` };
  const stampTool = tool as StampTool;
  const args = isRecord(raw.args) ? raw.args : raw;
  const target = facts.target;
  const mapId = facts.mapId;
  const rectRaw = args.rect ?? args.area;
  const rect = rectRaw === undefined ? target : clampRectToTarget(rectRaw, target);
  const material = stringArg(args.material);
  const labelText = stringArg(raw.label);
  const label = labelText ?? `${material ? `${material} ` : ""}${TOOL_KO[stampTool]}`;
  const dropped = (reason: string): StampStepCheck => ({ dropped: `${stampTool}: ${reason}` });
  // 마을·실내에서 함정·길막 몬스터는 문장이 직접 요청할 때만(「알아서」에 섞여 나오지 않게).
  if ((stampTool === "place_trap" || stampTool === "place_battle_blocker") && isSafeArea(facts) && !asksForHostile(facts.text)) {
    return dropped(`${facts.placement?.map.name ?? "이 맵"}: ${facts.placement?.role.role === "town" ? "마을" : "실내"}이라 요청 없이 ${stampTool === "place_trap" ? "함정을" : "몬스터를"} 두지 않습니다(${facts.placement?.role.reason})`);
  }
  // 사람이 아닌 것을 NPC 로 세우지 않는다 — 「대포」「공룡 알」이 주민 그림으로 서던 경로다(2026-10-15 코퍼스).
  if ((stampTool === "place_npc" || stampTool === "place_inn") && !allowsPerson(facts.text)) {
    return dropped(`「${facts.text}」는 사람을 세우라는 말이 아니라서 NPC 를 두지 않습니다(물건은 place_object 로 칩셋 그림을 찾아 깝니다)`);
  }
  switch (stampTool) {
    case "place_object": {
      const named = stringArg(args.name) ?? stringArg(args.object) ?? stringArg(args.query) ?? stringArg(args.material);
      if (!named) return dropped("물건 이름이 없습니다");
      const alternatives = stringList(args.alternatives ?? args.alts ?? args.synonyms, 4);
      const primary = cleanObjectName(named) || named;
      if (/^(?:문|출입문|대문|door|창|창문|window)$/iu.test(primary.trim())) {
        return dropped(`「${primary}」은 벽에 다는 물건이라 바닥에 놓지 않습니다(문은 place_door 로 벽 칸에만 — 벽이 없으면 먼저 벽·건물이 필요합니다)`);
      }
      // 「집」을 물건으로 보내면 물건 사전(3×3 상한)이 거절한다 — 집 단계로 돌린다.
      if (HOUSE_NAME.test(primary.trim())) return validateStampStep({ tool: "place_house", label: raw.label, args }, facts);
      if (/^(?:차|자동차|승용차|버스|택시|경찰차|트럭|차량|탈것)$/iu.test(primary.trim()) && /(?:다니|움직|달리|흐름|교통|노선|회전|지나가)/u.test(facts.text)) {
        return validateStampStep({ tool: "set_street_traffic", label: raw.label, args: {} }, facts);
      }
      if (facts.repairRound && !norm2(facts.text).includes(norm2(primary))) {
        return dropped(`수리 라운드에서는 요청하지 않은 물건(「${primary}」)으로 바꾸지 않습니다`);
      }
      const accepted = acceptedObjectNames(primary, alternatives.map(cleanObjectName).filter((name) => name.length > 0));
      const names = accepted.names;
      const hit = resolveStampObject(facts.objects ?? [], names, { w: target.w, h: target.h });
      if (!hit) return { refused: { wanted: primary, nearest: nearestStampObjects(facts.objects ?? [], [primary]) } };
      const countRaw = finiteInt(args.count);
      const count = Math.max(1, Math.min(STAMP_MAX_OBJECTS, countRaw ?? 1));
      const area = args.at !== undefined ? pointRect(clampPointToTarget(args.at, target)) : rect;
      if (!area) return dropped("물건을 놓을 영역이 대상 밖입니다");
      const entry = hit.entry;
      const shown = baseName(entry.name);
      const notes: string[] = [];
      if (hit.corrected) notes.push(`철자 보정 「${hit.matchedBy}」→「${shown}」`);
      else if (norm2(shown) !== norm2(named) && !norm2(shown).includes(norm2(named))) notes.push(`「${named}」→「${shown}」(${hit.matchedBy})`);
      if (hit.variants.length > 1) notes.push(`같은 이름 ${hit.variants.length}종 중 ${entry.id}`);
      const placement = entry.placement ?? (entry.floorStanding ? "floor" : "wall");
      return {
        step: {
          tool: stampTool,
          label: labelText ?? `${shown} ${count}개`,
          ...(notes.length ? { note: notes.join(" · ") } : {}),
          args: { mapId, name: shown, entryId: entry.id, entryKind: entry.kind, entryName: entry.name, width: entry.width, height: entry.height, placement, area, count },
        },
      };
    }
    case "fill_region": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      if (!material) return dropped("재료가 없습니다");
      if (/경작지|밭/u.test(material) && !facts.fillMaterials.includes(material)) {
        return validateStampStep({ tool: "place_object", label: raw.label, args: { name: "밭", area: rect, count: 2 } }, facts);
      }
      const resolvedMaterial = normalizeFillMaterial(material, facts.fillMaterials);
      // 연못·호수를 물 재료가 없는 칩셋에서 「하늘」「잔디」로 채우던 대체를 막는다(천공섬 「연못 파 줘」가 하늘 칠하기였다).
      if (/연못|호수|못 파|pond|lake/iu.test(`${labelText ?? ""} ${facts.text}`) && !/물|수역|해안|바다|호수|연못|강|water|lake|pond|sea|river|shore/iu.test(resolvedMaterial)) {
        return dropped(`「${resolvedMaterial}」은 물이 아니라서 연못으로 칠하지 않았습니다 — 이 칩셋의 물 재료 라벨이 없으면 연못은 깔지 않습니다(다른 재료로 흉내 내지 않음)`);
      }
      const shape = enumArg(args.shape, ["rect", "circle", "ellipse"] as const);
      const clearUpper = typeof args.clearUpper === "boolean" ? args.clearUpper : undefined;
      return { step: { tool: stampTool, label, args: { mapId, rect, material: resolvedMaterial, shape: shape ?? "rect", ...(clearUpper !== undefined ? { clearUpper } : {}) } } };
    }
    case "place_props": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      if (!material) return dropped("재료가 없습니다");
      const density = enumArg(args.density, ["sparse", "normal", "dense", "impassable"] as const);
      const count = finiteInt(args.count);
      const packing = enumArg(args.packing, ["natural", "dense"] as const);
      const cells = rect.w * rect.h;
      // density 는 나무 재료만 받는다(도구가 아니면 「density는 침엽수/활엽수 material에만」 으로 거부 — 코퍼스에서 비수목 place_props 58회가 첫 호출 실패 → 수리 호출).
      const treeOnly = density && facts.isTreeMaterial !== undefined && !facts.isTreeMaterial(material);
      const share = { sparse: 0.15, normal: 0.4, dense: 0.8, impassable: 1 } as const;
      const sized = density && !treeOnly
        ? { density }
        : treeOnly
          ? { count: Math.max(1, count !== null && count > 0 ? Math.min(count, cells) : Math.round(cells * share[density!])), ...(density === "impassable" ? { packing: "dense" as const } : {}) }
          : count !== null && count > 0
            ? { count: Math.min(count, cells), ...(packing ? { packing } : {}) }
            : { count: cells, packing: "dense" as const };
      const densityNote = treeOnly ? `density 는 나무 전용이라 칸 수 ${(sized as { count: number }).count}개로 바꿈` : undefined;
      return { step: { tool: stampTool, label, ...(densityNote ? { note: densityNote } : {}), args: { mapId, area: rect, material, ...sized } } };
    }
    case "paint_road": {
      const rawPoints = Array.isArray(args.points) ? args.points : [];
      const points = rawPoints
        .map((point) => clampPointToTarget(point, target))
        .filter((point): point is { x: number; y: number } => point !== null);
      const path = points.length >= 2 ? points : rect ? roadPoints(rect) : null;
      if (!path) return dropped("경로가 없습니다");
      const style = enumArg(args.style, ["dirt", "sand"] as const) ?? "dirt";
      return { step: { tool: stampTool, label, args: { mapId, points: path, style, naturalness: 0 } } };
    }
    case "tile_erase": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      const layer = enumArg(args.layer, ["both", "lower", "upper"] as const) ?? "both";
      return { step: { tool: stampTool, label, args: { mapId, rect, layer } } };
    }
    case "build_wall": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      return { step: { tool: stampTool, label, args: { mapId, rect, material: material ?? "벽" } } };
    }
    case "place_door": {
      const at = args.at !== undefined
        ? clampPointToTarget(args.at, target)
        : rect ? { x: rect.x + Math.floor((rect.w - 1) / 2), y: rect.y + rect.h - 1 } : null;
      if (!at) return dropped("문 위치가 없습니다");
      let doorAt = at;
      let doorNote: string | undefined;
      if (facts.isWallCell && !facts.isWallCell(at.x, at.y)) {
        // 모델이 고른 칸이 벽이 아니면 영역 안의 벽 칸 중 가장 가까운 것(아래쪽 우선)으로 옮긴다. 벽이 없으면 문을 달지 않는다.
        let best: { x: number; y: number; d: number } | null = null;
        for (let y = target.y; y < target.y + target.h; y++) for (let x = target.x; x < target.x + target.w; x++) {
          if (!facts.isWallCell(x, y)) continue;
          const d = Math.abs(x - at.x) + Math.abs(y - at.y) - (y >= at.y ? 0.1 : 0);
          if (!best || d < best.d) best = { x, y, d };
        }
        if (!best) return dropped("문은 벽 칸에만 달 수 있는데 이 영역에는 벽이 없습니다(문 그림을 이벤트·바닥으로 흉내 내지 않았습니다 — 벽·건물이 있는 곳을 고르거나 먼저 벽을 지으세요)");
        doorAt = { x: best.x, y: best.y };
        doorNote = `고른 칸은 벽이 아니라 가장 가까운 벽 (${best.x},${best.y})로 옮김`;
      }
      return { step: { tool: stampTool, label, ...(doorNote ? { note: doorNote } : {}), args: { mapId, at: doorAt, material: material ?? "문" } } };
    }
    case "place_chest": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("상자 위치가 없습니다");
      const basis = facts.placement?.chestGold;
      const itemRaw = stringArg(args.itemId);
      const known = itemRaw && facts.placement ? facts.placement.knownItemIds.includes(itemRaw) : false;
      const itemId = known ? itemRaw : undefined;
      const goldRaw = finiteInt(args.gold);
      const notes: string[] = [];
      if (itemRaw && !known) notes.push(`없는 아이템 ${itemRaw} 은 뺐습니다`);
      let gold: number | undefined;
      if (goldRaw !== null && goldRaw > 0) {
        if (basis) {
          const clamped = clampChestGold(goldRaw, basis);
          gold = clamped.gold;
          notes.push(clamped.note);
        } else gold = goldRaw;
      }
      if (!itemId && gold === undefined) {
        gold = basis ? Math.round((basis.min + basis.max) / 2) : 50;
        notes.push(basis ? `금액이 없어 ${gold}G(${basis.reason})` : "금액이 없어 50G");
      }
      const note = notes.join(" · ");
      return { step: { tool: stampTool, label: labelText ?? "보물상자", note, args: { mapId, x: at.x, y: at.y, contents: { ...(itemId ? { itemId } : {}), ...(gold !== undefined ? { gold } : {}) } } } };
    }
    case "place_npc": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("NPC 위치가 없습니다");
      const name = stringArg(args.name) ?? "마을 사람";
      const role = stringArg(args.role);
      const lines = stringList(args.lines, 3);
      const body = lines.length > 0 ? lines : [`${name}: 안녕하세요.`];
      if (args.merchant === true || Array.isArray(args.stock)) {
        const stock = merchantStock(args.stock, facts);
        if (stock.itemIds.length > 0) {
          return {
            step: {
              tool: "make_villager",
              label: labelText ?? `${name} 상인`,
              ...(stock.note ? { note: stock.note } : {}),
              args: {
                mapId, name, home: at,
                graphic: { query: role ?? "merchant" },
                pages: [{ lines: body }],
                shop: { stock: stock.itemIds.map((itemId) => ({ itemId })) },
              },
            },
          };
        }
      }
      return {
        step: {
          tool: stampTool,
          label: labelText ?? `${name} NPC`,
          args: {
            mapId, x: at.x, y: at.y, name,
            graphic: { query: role ?? name },
            pages: [{ lines: body }],
          },
        },
      };
    }
    case "place_savepoint": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("세이브 위치가 없습니다");
      const mode = args.mode === "slot" || args.mode === "checkpoint" || args.mode === "both" ? args.mode : undefined;
      return { step: { tool: stampTool, label: labelText ?? "세이브 포인트", args: { mapId, x: at.x, y: at.y, ...(mode ? { mode } : {}), ...(args.heal === true ? { heal: true } : {}) } } };
    }
    case "place_examine_hotspots": {
      const raw = Array.isArray(args.spots) ? args.spots : Array.isArray(args.hotspots) ? args.hotspots : [];
      const hotspots = raw.slice(0, 6).flatMap((spot) => {
        if (!isRecord(spot)) return [];
        const at = clampPointToTarget(spot.at, target);
        if (!at) return [];
        const lines = stringList(spot.lines, 3);
        return [{ at, name: stringArg(spot.name) ?? "조사 지점", lines: lines.length > 0 ? lines : ["특별한 것은 없다."] }];
      });
      if (hotspots.length === 0) return dropped("조사 지점이 없습니다");
      // 그림 없는 칸의 조사 지점은 「빈 바닥 위 투명 이벤트」다 — 물건을 깔지 못해 이벤트로 흉내 내던 경로(코퍼스 64회)를 막는다.
      const seen = hotspots.filter((spot) => facts.hasArtAt === undefined || facts.hasArtAt(spot.at.x, spot.at.y) || facts.hasArtAt(spot.at.x, spot.at.y - 1));
      if (seen.length === 0) return dropped(`조사 지점(${hotspots.map((spot) => spot.name).join(", ")})은 이미 그림이 있는 칸에만 둡니다 — 이 자리에는 보이는 물건이 없어 투명 이벤트만 생기므로 두지 않았습니다(물건은 place_object)`);
      const skippedSpots = hotspots.length - seen.length;
      return { step: { tool: stampTool, label: labelText ?? `조사 지점 ${seen.length}곳`, ...(skippedSpots > 0 ? { note: `그림 없는 자리 ${skippedSpots}곳은 뺌` } : {}), args: { mapId, hotspots: seen } } };
    }
    case "make_villager":
      return dropped("상인은 place_npc merchant:true 로 보낸다");
    case "stamp_tileset_object":
      return dropped("stamp_tileset_object 는 코드가 place_object 에서 만드는 내부 단계다 — place_object 를 쓴다");
    case "place_house": {
      // 집·건물은 코드가 칩셋의 실제 외관(지붕·벽·창·문)과 빈 땅을 고른다 — 모델은 영역·종류·크기·채 수만 말한다.
      const area = args.at !== undefined ? pointRect(clampPointToTarget(args.at, target)) : rect;
      if (!area) return dropped("집을 지을 영역이 대상 밖입니다");
      const size = enumArg(args.size, ["small", "medium", "large"] as const) ?? houseSizeFromText(facts.text);
      const count = Math.max(1, Math.min(STAMP_MAX_HOUSES, finiteInt(args.count) ?? 1));
      const stories = finiteInt(args.stories) === 2 ? 2 : 1;
      const kind = stringArg(args.kind) ?? stringArg(args.name) ?? labelText ?? undefined;
      return { step: { tool: stampTool, label: labelText ?? (count > 1 ? `집 ${count}채` : "집"), args: { mapId, area, size, count, stories, ...(kind ? { kind } : {}) } } };
    }
    case "place_dungeon_room": {
      const area = rect ?? target;
      const contextText = `${labelText ?? ""} ${facts.text}`;
      const kind = enumArg(args.kind, ["room", "corridor", "connect"] as const)
        ?? (/복도|잇는|연결|통로/u.test(contextText) ? "connect" : "room");
      const style = enumArg(args.style, ["crypt", "sewer", "temple", "volcano", "cave"] as const)
        ?? (/용암|화산/u.test(contextText) ? "volcano" : "crypt");
      const hazard = enumArg(args.hazard, ["lava", "water"] as const)
        ?? (/용암/u.test(contextText) ? "lava" : undefined);
      return {
        step: {
          tool: stampTool,
          label: labelText ?? (kind === "connect" ? "던전 복도 연결" : "던전 방"),
          args: { mapId, area, kind, style, ...(hazard ? { hazard } : {}) },
        },
      };
    }
    case "place_terrain_house":
    case "build_jp_city_building":
    case "stamp_object":
      return dropped(`${stampTool} 은 코드가 place_house 에서 만드는 내부 단계다 — place_house 를 쓴다`);
    case "paint_tiles":
      return dropped("paint_tiles 는 코드가 place_dungeon_room 에서 만드는 내부 단계다 — place_dungeon_room 을 쓴다");
    case "place_inn": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("여관 주인 위치가 없습니다");
      const basis = facts.placement?.innPrice ?? { gold: 20, reason: "기본" };
      const asked = typeof args.price === "number" && Number.isFinite(args.price) ? Math.round(args.price) : undefined;
      // 요청 금액은 기준의 1/3~3배 안에서만 받는다.
      const price = asked === undefined ? basis.gold : Math.max(Math.ceil(basis.gold / 3), Math.min(basis.gold * 3, asked));
      const name = stringArg(args.name) ?? "여관 주인";
      const greeting = stringArg(args.greeting)?.slice(0, 80) ?? `어서 오세요. 하룻밤 ${price}G 입니다.`;
      const existingInn = facts.placement?.existing.occupied.find((entry) => entry.kind === "inn");
      const priceNote = asked !== undefined && asked !== price ? `요금 ${asked}G → ${price}G(${basis.reason})` : `요금 ${price}G(${basis.reason})`;
      // 2026-09-27 라이브: 「상자 하나랑 여관 주인」이 이미 여관 있는 마을에 두 번째 주인을 세웠다 — 요청이라 막지 않고 알린다.
      const note = existingInn ? `${priceNote} · 이 맵에 이미 여관이 있습니다(${existingInn.name} ${existingInn.x},${existingInn.y})` : priceNote;
      return {
        step: {
          tool: "place_npc",
          label: labelText ?? `${name}(여관)`,
          note,
          args: {
            mapId, x: at.x, y: at.y, name,
            graphic: { query: stringArg(args.role) ?? "여관 주인" },
            pages: [{ commands: [{ kind: "inn", price, note: greeting }] }],
          },
        },
      };
    }
    case "place_signpost": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("표지판 위치가 없습니다");
      const lines = stringList(args.lines, 3);
      if (lines.length === 0) return dropped("표지판 글이 없습니다");
      return {
        step: {
          tool: "place_npc",
          label: labelText ?? "표지판",
          args: { mapId, x: at.x, y: at.y, name: stringArg(args.name) ?? "표지판", graphic: SIGNPOST_GRAPHIC, movement: "fixed", pages: [{ lines }] },
        },
      };
    }
    case "place_storage_chest": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("보관 상자 위치가 없습니다");
      return { step: { tool: stampTool, label: labelText ?? "보관 상자", args: { mapId, x: at.x, y: at.y } } };
    }
    case "place_trap": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("함정 위치가 없습니다");
      const trigger = enumArg(args.trigger, ["touch", "action"] as const) ?? "touch";
      const message = stringArg(args.message)?.slice(0, 120);
      return { step: { tool: stampTool, label: labelText ?? "함정", args: { mapId, at, trigger, ...(message ? { message } : {}) } } };
    }
    case "place_battle_blocker": {
      const troops = facts.placement?.encounterTroops ?? [];
      if (troops.length === 0) return dropped("이 맵에 나오는 적 그룹이 없어 몬스터를 둘 수 없습니다(조우를 먼저 정하세요)");
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("몬스터 위치가 없습니다");
      const asked = stringArg(args.troopId);
      const troop = troops.find((entry) => entry.id === asked) ?? troops[0]!;
      const intro = stringList(args.intro, 2);
      const note = asked && asked !== troop.id ? `이 맵에 없는 적 그룹 ${asked} 대신 ${troop.name}` : `이 맵 적 그룹 ${troop.name}`;
      return { step: { tool: stampTool, label: labelText ?? `${troop.name} 길막`, note, args: { mapId, x: at.x, y: at.y, troopId: troop.id, ...(intro.length ? { intro } : {}) } } };
    }
    case "set_scene_mood": {
      const weatherRaw = isRecord(args.weather) ? args.weather : args;
      const kind = enumArg(weatherRaw.kind ?? args.kind, ["none", "rain", "storm", "snow", "fog"] as const);
      if (!kind) return dropped("날씨 종류가 없습니다(none/rain/storm/snow/fog)");
      const intensityRaw = typeof weatherRaw.intensity === "number" ? weatherRaw.intensity : 0.6;
      const intensity = Math.max(0.1, Math.min(1, intensityRaw));
      return { step: { tool: stampTool, label: labelText ?? "분위기", args: { mapId, weather: { kind, intensity }, applyMode: "map" } } };
    }
    case "set_start_position": {
      const at = pointOrCenter(args.at, rect, target);
      if (!at) return dropped("시작 위치가 없습니다");
      return { step: { tool: stampTool, label: labelText ?? "시작 위치", args: { mapId, x: at.x, y: at.y } } };
    }
    case "set_street_traffic": {
      const density = enumArg(args.density, ["sparse", "normal", "busy"] as const) ?? (/혼잡|많이|빽빽/u.test(facts.text) ? "busy" : /한산|드문/u.test(facts.text) ? "sparse" : "normal");
      const includeTurns = typeof args.includeTurns === "boolean" ? args.includeTurns : true;
      const includeBus = typeof args.includeBus === "boolean" ? args.includeBus : true;
      const clear = args.clear === true || /지워|없애|끄기|끄게/u.test(facts.text);
      return { step: { tool: stampTool, label: labelText ?? (clear ? "주행 차량 지우기" : "거리 주행·회전 차량"), args: { mapId, ...(clear ? { clear: true } : { density, includeTurns, includeBus }) } } };
    }
    case "move_event":
    case "remove_event": {
      const eventId = stringArg(args.eventId);
      const known = facts.placement?.existing.occupied.find((entry) => entry.id === eventId);
      if (!eventId || !known) return dropped(`이 맵에 없는 이벤트 ${eventId ?? "(없음)"}`);
      if (stampTool === "remove_event") {
        return { step: { tool: stampTool, label: labelText ?? `${known.name} 지우기`, args: { mapId, eventId } } };
      }
      const at = clampPointToTarget(args.at, target);
      if (!at) return dropped("옮길 위치가 없습니다");
      return { step: { tool: stampTool, label: labelText ?? `${known.name} 옮기기`, args: { mapId, eventId, x: at.x, y: at.y } } };
    }
  }
}

/** 기존 마을 표지판(dew-village ev_sign, object1 frame 25 = characterIndex 0)과 같은 그림. query 「signpost」 는 주민 그림을 골랐다(2026-09-27 헤드리스). */
const SIGNPOST_GRAPHIC = { textureKey: "tex_easyrpg_charset_object1", characterIndex: 0 } as const;

function isSafeArea(facts: StampPlanFacts): boolean {
  const role = facts.placement?.role.role;
  return role === "town" || role === "interior";
}

/** 문장이 적대 배치를 직접 말하는가 — 마을 습격·함정 방 같은 의도적 요청은 통과. */
function asksForHostile(text: string): boolean {
  return /함정|트랩|가시|몬스터|적|습격|보스|전투|길막|괴물|trap|monster|enemy|boss|ambush/i.test(text);
}

/** 상인 재고 — 실제 id 만, 값이 이 맵 상자 범위의 두 배를 넘는 것은 뺀다. 비면 이 맵 보상 후보로 채운다. */
function merchantStock(raw: unknown, facts: StampPlanFacts): { readonly itemIds: readonly string[]; readonly note?: string } {
  const placement = facts.placement;
  if (!placement) return { itemIds: [] };
  const ceiling = placement.chestGold.max * 2;
  const asked = Array.isArray(raw) ? raw.map((entry) => (isRecord(entry) ? stringArg(entry.itemId) : stringArg(entry))).filter((id): id is string => Boolean(id)) : [];
  const priceOf = (id: string): number | undefined => placement.itemPrices[id];
  const kept = [...new Set(asked)].filter((id) => priceOf(id) !== undefined && priceOf(id)! <= ceiling).slice(0, 8);
  const removed = asked.filter((id) => !kept.includes(id));
  if (kept.length > 0) return { itemIds: kept, ...(removed.length ? { note: `재고에서 뺌: ${removed.join(", ")}(없는 id 이거나 ${ceiling}G 초과)` } : {}) };
  const fallback = placement.rewardItems.filter((item) => item.price > 0 && item.price <= ceiling).slice(0, 4).map((item) => item.id);
  return { itemIds: fallback, ...(fallback.length ? { note: `재고는 이 맵 보상 후보로 채움(${ceiling}G 이하)` } : {}) };
}

/** 칸에 서는 도구 — 겹침 해소 대상. set_start_position 은 이벤트가 아니라 칸만 피한다. */
function stepPoints(step: StampStep): { readonly get: () => { x: number; y: number }[]; readonly set: (points: { x: number; y: number }[]) => StampStep } | null {
  const args = step.args;
  const xy = (): { x: number; y: number }[] => [{ x: args.x as number, y: args.y as number }];
  const withXY = (points: { x: number; y: number }[]): StampStep => ({ ...step, args: { ...args, x: points[0]!.x, y: points[0]!.y } });
  switch (step.tool) {
    case "place_chest": case "place_npc": case "place_savepoint": case "place_storage_chest":
    case "place_battle_blocker": case "set_start_position": case "move_event":
      return { get: xy, set: withXY };
    case "make_villager":
      return { get: () => [args.home as { x: number; y: number }], set: (points) => ({ ...step, args: { ...args, home: points[0] } }) };
    case "place_trap":
      return { get: () => [args.at as { x: number; y: number }], set: (points) => ({ ...step, args: { ...args, at: points[0] } }) };
    case "place_examine_hotspots": {
      const spots = args.hotspots as { at: { x: number; y: number } }[];
      return { get: () => spots.map((spot) => spot.at), set: (points) => ({ ...step, args: { ...args, hotspots: spots.map((spot, index) => ({ ...spot, at: points[index] })) } }) };
    }
    default:
      return null;
  }
}

export interface OverlapResult {
  readonly steps: readonly StampStep[];
  readonly dropped: readonly string[];
}

/**
 * 새 이벤트가 기존 이벤트 칸·그 바로 위아래(두 칸 높이 그림)·같은 계획의 다른 새 이벤트와 겹치면
 * 가까운 통행 가능 빈 칸으로 옮긴다(반경 6). 옮길 칸이 없으면 그 단계를 버린다.
 * 2026-09-27 실측: 모델이 맵 한가운데 기존 표지판 칸 위에 상인을 세웠다.
 */
export function resolveStampOverlaps(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
  isLanding: (x: number, y: number) => boolean,
): OverlapResult {
  const occupied = facts.placement?.existing.occupied ?? [];
  const removed = new Set(steps.filter((step) => step.tool === "remove_event").map((step) => step.args.eventId as string));
  const moved = new Set(steps.filter((step) => step.tool === "move_event").map((step) => step.args.eventId as string));
  const blocked = new Set<string>();
  const block = (x: number, y: number): void => { for (const dy of [-1, 0, 1]) blocked.add(`${x},${y + dy}`); };
  for (const entry of occupied) if (!removed.has(entry.id) && !moved.has(entry.id)) block(entry.x, entry.y);
  const free = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < facts.mapWidth && y < facts.mapHeight && !blocked.has(`${x},${y}`) && isLanding(x, y);
  const nearest = (from: { x: number; y: number }): { x: number; y: number } | null => {
    if (free(from.x, from.y)) return from;
    for (let radius = 1; radius <= 6; radius++) {
      const ring: { x: number; y: number; d: number }[] = [];
      for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
        ring.push({ x: from.x + dx, y: from.y + dy, d: Math.abs(dx) + Math.abs(dy) });
      }
      ring.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      const hit = ring.find((cell) => free(cell.x, cell.y));
      if (hit) return { x: hit.x, y: hit.y };
    }
    return null;
  };
  const out: StampStep[] = [];
  const dropped: string[] = [];
  for (const step of steps) {
    const points = stepPoints(step);
    if (!points) { out.push(step); continue; }
    const next: { x: number; y: number }[] = [];
    const notes: string[] = [];
    let failed = false;
    for (const point of points.get()) {
      const landed = nearest(point);
      if (!landed) { failed = true; break; }
      if (landed.x !== point.x || landed.y !== point.y) notes.push(`겹쳐서 (${point.x},${point.y})→(${landed.x},${landed.y})`);
      if (step.tool !== "set_start_position") block(landed.x, landed.y);
      next.push(landed);
    }
    if (failed) { dropped.push(`${step.label}: 근처에 겹치지 않는 빈 칸이 없습니다`); continue; }
    const placed = points.set(next);
    out.push(notes.length ? { ...placed, note: [step.note, ...notes].filter(Boolean).join(" · ") } : placed);
  }
  return { steps: out, dropped };
}

// ── 물건 자리 정하기 ─────────────────────────────────────────────────────────

function insideRect(rect: StampRect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x < rect.x + rect.w && y < rect.y + rect.h;
}

/** 물건 발자국(밑줄 왼쪽 칸 base 기준)의 칸들. */
function footprintCells(base: { x: number; y: number }, width: number, height: number): { x: number; y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) cells.push({ x: base.x + dx, y: base.y - dy });
  return cells;
}

/**
 * 계획의 `place_object`(이름만 정해진 보류 단계)를 실제 도구 호출로 펼친다 — 칸은 **지금 맵**에서 고른다.
 *  - 킷 물건: 발자국 전체가 대상 사각형 안·통행 가능·위층 비어 있음·이벤트 없음이어야 하고, 서로 한 칸 띄운다(모자라면 붙여서).
 *  - 소품 그룹: place_props(그룹 이름 = material) 한 번.
 * 자리가 없으면 그 단계를 버리고 이유를 남긴다(무음 폐기 금지).
 */
export function expandStampObjects(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
): OverlapResult {
  const out: StampStep[] = [];
  const dropped: string[] = [];
  // 같은 계획의 새 이벤트(NPC 등)가 선 칸과 바로 위아래는 물건이 덮지 않는다.
  const taken = new Set<string>();
  for (const step of steps) {
    const points = stepPoints(step);
    if (!points) continue;
    for (const point of points.get()) for (const dy of [-1, 0, 1]) taken.add(`${point.x},${point.y + dy}`);
  }
  const chosen: { x: number; y: number }[][] = [];
  const open = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < facts.mapWidth && y < facts.mapHeight && !taken.has(`${x},${y}`) && (facts.isOpenCell ? facts.isOpenCell(x, y) : true);
  const inBoundsNotTaken = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < facts.mapWidth && y < facts.mapHeight && !taken.has(`${x},${y}`);
  for (const step of steps) {
    if (step.tool !== "place_object") { out.push(step); continue; }
    const args = step.args;
    const area = args.area as StampRect;
    const count = Number(args.count) || 1;
    const width = Number(args.width) || 1;
    const height = Number(args.height) || 1;
    const placement = typeof args.placement === "string" ? args.placement : "floor";
    const name = String(args.name ?? step.label);
    const mapId = String(args.mapId);
    if (args.entryKind === "group") {
      out.push({
        tool: "place_props", label: step.label, ...(step.note ? { note: step.note } : {}), group: name,
        args: { mapId, area, material: String(args.entryName), count, minGap: 1 },
      });
      continue;
    }
    const pointAnchor = area.w === 1 && area.h === 1;
    const search = pointAnchor
      ? { x: area.x - 3, y: area.y - 3, w: 7, h: 7 }
      : placement === "wall" || placement === "water" || placement === "road"
        ? facts.target
        : area;
    const cellAllowed = (x: number, y: number, baseY: number): boolean => {
      if (!inBoundsNotTaken(x, y)) return false;
      if (placement === "floor" && height >= 3 && y < baseY) {
        return !(facts.hasArtAt && facts.hasArtAt(x, y));
      }
      if (!insideRect(facts.target, x, y)) return false;
      if (placement === "wall") return facts.isWallMountCell ? facts.isWallMountCell(x, y) : true;
      if (placement === "water") return true;
      if (placement === "road") return facts.isRoadCell ? facts.isRoadCell(x, y) || open(x, y) : open(x, y);
      return open(x, y);
    };
    const fits = (base: { x: number; y: number }, margin: number, strictSurface: boolean): boolean => {
      const cells = footprintCells(base, width, height);
      if (!cells.every((cell) => cellAllowed(cell.x, cell.y, base.y))) return false;
      if (placement === "wall" && facts.isOpenCell) {
        for (let dx = 0; dx < width; dx++) {
          const frontY = height >= 2 ? base.y + 1 : (facts.isWallMountCell?.(base.x + dx, base.y + 1) ? base.y + 2 : base.y + 1);
          if (!facts.isOpenCell(base.x + dx, frontY)) return false;
        }
      }
      if (strictSurface && placement === "water" && facts.isWaterCell) {
        if (!cells.some((cell) => facts.isWaterCell!(cell.x, cell.y))) return false;
      }
      if (strictSurface && placement === "road" && facts.isRoadCell) {
        const roadCount = cells.filter((cell) => facts.isRoadCell!(cell.x, cell.y)).length;
        if (roadCount < Math.min(cells.length, 4)) return false;
      }
      if (margin === 0) return !chosen.some((other) => other.some((o) => cells.some((c) => c.x === o.x && c.y === o.y)));
      return !chosen.some((other) => other.some((o) => cells.some((c) => Math.abs(c.x - o.x) <= margin && Math.abs(c.y - o.y) <= margin)));
    };
    const picked: { x: number; y: number }[] = [];
    const horizontalSpread = search.w >= search.h;
    for (let slot = 0; slot < count; slot++) {
      const slotCx = count > 1 && horizontalSpread
        ? search.x + ((slot + 0.5) * search.w) / count - (width - 1) / 2
        : search.x + (search.w - 1) / 2;
      const slotCy = count > 1 && !horizontalSpread
        ? search.y + ((slot + 0.5) * search.h) / count
        : search.y + (search.h - 1) / 2;
      const candidates: { x: number; y: number; d: number }[] = [];
      for (let y = search.y; y < search.y + search.h; y++) for (let x = search.x; x < search.x + search.w; x++) {
        candidates.push({ x, y, d: Math.hypot(x - slotCx, y - slotCy) });
      }
      candidates.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
      let slotHit = false;
      for (const strictSurface of [true, false]) {
        for (const margin of count > 1 ? [1, 0] : [0]) {
          for (const candidate of candidates) {
            const base = { x: candidate.x, y: candidate.y };
            if (picked.some((p) => p.x === base.x && p.y === base.y)) continue;
            if (!fits(base, margin, strictSurface)) continue;
            picked.push(base);
            chosen.push(footprintCells(base, width, height));
            slotHit = true;
            break;
          }
          if (slotHit) break;
        }
        if (slotHit) break;
      }
    }
    if (picked.length === 0) {
      let openCells = 0;
      for (let y = facts.target.y; y < facts.target.y + facts.target.h; y++) for (let x = facts.target.x; x < facts.target.x + facts.target.w; x++) if (open(x, y)) openCells += 1;
      dropped.push(`${name}: 놓을 자리가 없습니다(${facts.targetIsSelection ? "선택 영역" : "맵"} ${facts.target.w}×${facts.target.h} 안에서 길·물·벽·건물·막힌 칸·이벤트를 뺀 빈 칸이 ${openCells}칸뿐이라 ${width}×${height} 물건이 들어갈 자리가 없음 — 영역을 넓히거나 빈 마당을 골라 주세요)`);
      continue;
    }
    const short = picked.length < count ? `자리가 모자라 ${count}개 중 ${picked.length}개만` : "";
    picked.forEach((base, index) => {
      const notes = [index === 0 ? step.note : undefined, index === 0 ? short : undefined].filter(Boolean).join(" · ");
      out.push({
        tool: "stamp_tileset_object",
        label: picked.length > 1 ? `${name} ${index + 1}/${picked.length}` : name,
        group: name,
        at: [{ x: base.x, y: base.y }],
        ...(notes ? { note: notes } : {}),
        args: { mapId, objectId: String(args.entryId), base },
      });
    });
  }
  return { steps: out, dropped };
}

function stringList(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(stringArg).filter((line): line is string => Boolean(line)).map((line) => line.slice(0, 120)).slice(0, limit);
}

function pointOrCenter(value: unknown, rect: StampRect | null, target: StampRect): { x: number; y: number } | null {
  if (value !== undefined) return clampPointToTarget(value, target);
  const box = rect ?? target;
  return { x: box.x + Math.floor(box.w / 2), y: box.y + Math.floor(box.h / 2) };
}

/** 한 번에 놓을 물건 개수 상한. */
export const STAMP_MAX_OBJECTS = 8;

/** 한 번에 지을 집 채 수 상한. */
export const STAMP_MAX_HOUSES = 4;

/** place_object 이름이 집·건물인가(「작은 집」「통나무집」「편의점」「여관」). 「개집」「새집」은 물건이다. */
const HOUSE_NAME =
  /^(?:.*\s)?(?:집|주택|단독주택|연립주택|상가주택|민가|오두막|오두막집|가옥|초가|초가집|기와집|저택|살림집|통나무집|여관|상점|가게|상가|점포|대장간|편의점|카페|이자카야|술집|빵집|라멘집|초밥집|도시락집|목욕탕|오피스|사무실|사무소|빌딩|타워|아파트|맨션|은행|병원|호텔|백화점|창고|우체국|경찰서|소방서|학교|본관|별관|체육관|도서관|기숙사|학생회관|강의동|건물|house|cottage|hut|inn|shop|store|smithy|konbini|cafe|izakaya|office|building|tower|apartment|bank|hospital|hotel)$/iu;
/** 문장이 집·건물을 지으라는 말인가 — 「집 앞에」「집 옆」처럼 자리를 가리키는 집은 뺀다. */
const HOUSE_ASK =
  /(?:^|[^개새])(?:집|주택|단독주택|민가|오두막|가옥|초가|저택|살림집|여관|상점|대장간|편의점|카페|이자카야|오피스|빌딩|아파트|맨션|은행|병원|호텔|건물)(?!\s*(?:앞|옆|뒤|안|에|의|근처|주변|마당|문|벽|지붕|쪽|사이|주인))|house|cottage|building/iu;
/** 문장이 벽·담을 직접 말하면 벽 단계는 사용자가 원한 것이다. */
const WALL_ASK = /벽(?!돌)|담장|담을|울타리|성벽|펜스|fence|wall/iu;
/** 문장이 던전 방이나 복도 연결을 말하는가. */
const DUNGEON_ROOM_ASK = /던전.*방|입구\s*방|보물\s*방|함정\s*방|깊은\s*방|보스\s*방|중앙.*홀|중앙.*방/u;
const DUNGEON_CORRIDOR_ASK = /던전\s*복도|방\s*사이를\s*잇는|방\s*사이.*복도/u;

export function isHouseSentence(text: string): boolean {
  return HOUSE_ASK.test(text) && !WALL_ASK.test(text) && !DUNGEON_ROOM_ASK.test(text);
}

function houseSizeFromText(text: string): "small" | "medium" | "large" {
  if (/작은|조그만|조그마|아담|소박|오두막/u.test(text)) return "small";
  if (/큰|커다란|넓은|저택|빌딩|타워|여관/u.test(text)) return "large";
  return "medium";
}

function normalizeFillMaterial(material: string, fillMaterials: readonly string[]): string {
  if (fillMaterials.length === 0 || fillMaterials.includes(material)) return material;
  const m = material.trim();
  if (/보도|판석|광장|블록/u.test(m) && !/차도|차선|생활도로/u.test(m)) {
    const hit = fillMaterials.find((f) => /보도|판석|점자블록/u.test(f));
    if (hit) return hit;
  }
  if (/공원|잔디|녹지|풀밭/u.test(m)) {
    const hit = fillMaterials.find((f) => /녹지|잔디|풀밭|참배길/u.test(f));
    if (hit) return hit;
  }
  if (/아스팔트|차도|도로/u.test(m)) {
    const hit = fillMaterials.find((f) => /아스팔트|생활도로|도로/u.test(f));
    if (hit) return hit;
  }
  return material;
}

/**
 * 집 문장인데 모델이 벽+문으로 집을 흉내 냈으면 벽 단계들을 집 단계로 바꾸고 문은 뺀다.
 * 왜(2026-10-17 실측, 버들항 「집」「집 지어줘」「작은 집」「민가」 4/4): 계획기가 build_wall+place_door 만 냈고,
 * 벽 재료가 단일 타일이라 전부 실패했다(성공해도 지붕 없는 상자). 문장이 벽·담·울타리를 말하면 손대지 않는다.
 */
function houseInsteadOfWalls(steps: readonly StampStep[], facts: StampPlanFacts, dropped: string[]): StampStep[] {
  if (!isHouseSentence(facts.text) || !steps.some((step) => step.tool === "build_wall")) return [...steps];
  const wallSteps = steps.filter((step) => step.tool === "build_wall");
  const out: StampStep[] = [];
  let housed = steps.some((step) => step.tool === "place_house");
  for (const step of steps) {
    if (step.tool !== "build_wall") { out.push(step); continue; }
    if (!housed) {
      housed = true;
      const count = Math.min(STAMP_MAX_HOUSES, wallSteps.length);
      const rawRect = isRecord(step.args.rect) ? step.args.rect : null;
      const area = count > 1 || !rawRect || Number(rawRect.h) < 7 ? facts.target : rawRect;
      const check = validateStampStep(
        { tool: "place_house", label: count > 1 ? `집 ${count}채` : step.label, args: { area, count, kind: facts.text } },
        facts,
      );
      if ("step" in check) out.push({ ...check.step, note: "벽으로 짓던 집을 칩셋의 집 외관으로 바꿈" });
      else if ("dropped" in check) dropped.push(check.dropped);
      continue;
    }
    dropped.push("build_wall: 집 단계가 지붕·벽·문을 함께 짓습니다(따로 세우지 않음)");
  }
  return out;
}

/** 던전 방·복도 문장인데 모델이 일반 판석 채우기+성벽이나 흙길+집 문으로 흉내 냈으면 place_dungeon_room 단계로 바꾼다. */
function dungeonInsteadOfWalls(steps: readonly StampStep[], facts: StampPlanFacts): StampStep[] {
  if (steps.some((step) => step.tool === "place_dungeon_room")) return [...steps];
  const isRoomAsk = DUNGEON_ROOM_ASK.test(facts.text);
  const isCorridorAsk = DUNGEON_CORRIDOR_ASK.test(facts.text);
  if (!isRoomAsk && !isCorridorAsk) return [...steps];
  const out: StampStep[] = [];
  let inserted = false;
  for (const step of steps) {
    if (isRoomAsk && (step.tool === "fill_region" || step.tool === "build_wall")) {
      if (!inserted) {
        inserted = true;
        const check = validateStampStep(
          {
            tool: "place_dungeon_room",
            label: step.label.replace(/\s*(?:바닥|외벽)$/u, ""),
            args: { area: facts.target, kind: "room" },
          },
          facts,
        );
        if ("step" in check) out.push(check.step);
      }
      continue;
    }
    if (isCorridorAsk && (step.tool === "paint_road" || step.tool === "place_door")) {
      if (!inserted) {
        inserted = true;
        const check = validateStampStep(
          {
            tool: "place_dungeon_room",
            label: "방 사이 던전 복도와 아치 문",
            args: { area: facts.target, kind: "connect" },
          },
          facts,
        );
        if ("step" in check) out.push(check.step);
      }
      continue;
    }
    out.push(step);
  }
  return out;
}

/** 모델이 이름에 붙인 수량·조사를 떼고 낱말만 남긴다(「화분 세 개」→「화분」). */
export function cleanObjectName(value: string): string {
  return value
    .replace(/\d+/gu, " ")
    .replace(/(?:^|\s)(?:한|두|세|네|다섯|여섯|일곱|여덟|몇|여러|하나|둘|셋|넷)(?=\s|$)/gu, " ")
    .replace(/\s+(?:개|그루|대|채|송이|마리|명|줄)$/u, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function norm2(text: string): string {
  return text.replace(/[\s·()]+/gu, "").toLowerCase();
}

function pointRect(point: { x: number; y: number } | null): StampRect | null {
  return point ? { x: point.x, y: point.y, w: 1, h: 1 } : null;
}

/** 문장이 사람을 세우라는 말인가 — 사람 낱말이 있거나 「알아서·예쁘게」처럼 구체 물건이 없는 말. */
const PERSON_WORDS = /사람|주민|npc|상인|경비|병사|아이|아저씨|아주머니|할머니|할아버지|여관|주인|손님|학생|선생|기사|공주|왕|마법사|요리사|대장장이|점원|캐릭터|동료|친구|인물|노인|소녀|소년|여자|남자|용사|상점|가게|술집|주막|대장간|시장|교회|신부|수녀|villager|merchant|guard|keeper|shop|inn\b/iu;
const VAGUE_WORDS = /예쁘|알아서|분위기|꾸며|꾸미|아늑|풍성|채워|사람 사는|마을처럼|활기|따뜻|멋지|그럴듯|빈 입력|살아 있|생기/u;
export function allowsPerson(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return PERSON_WORDS.test(t) || VAGUE_WORDS.test(t);
}

export interface ParsedStampPlan {
  readonly steps: readonly StampStep[];
  /** 버린 단계와 이유(채팅에 한 줄로 남긴다). */
  readonly dropped: readonly string[];
  /** 칩셋에 그림이 없어 깔지 않은 물건(거절 사유와 가까운 이름). */
  readonly refused: readonly StampRefusal[];
  /** JSON 을 읽지 못했을 때만. */
  readonly error?: string;
}

export function parseStampPlan(raw: string, facts: StampPlanFacts): ParsedStampPlan {
  const parsed = extractJsonObject(raw);
  const list = isRecord(parsed) && Array.isArray(parsed.steps)
    ? parsed.steps
    : Array.isArray(parsed) ? parsed : null;
  if (!list) return { steps: [], dropped: [], refused: [], error: "모델 응답에서 steps 를 읽지 못했습니다" };
  const steps: StampStep[] = [];
  const dropped: string[] = [];
  const refused: StampRefusal[] = [];
  const houseAsk = isHouseSentence(facts.text);
  const dungeonCorridorAsk = DUNGEON_CORRIDOR_ASK.test(facts.text);
  for (const entry of list) {
    if (steps.length >= STAMP_MAX_STEPS) {
      dropped.push(`단계 상한(${STAMP_MAX_STEPS}) 초과`);
      break;
    }
    // 집 문장의 문은 집 단계가 함께 짓는다 — 벽이 없다는 검증 오류 대신 이유를 한 줄로 남긴다.
    if (houseAsk && isRecord(entry) && entry.tool === "place_door") {
      dropped.push("place_door: 집 단계가 지붕·벽·문을 함께 짓습니다(따로 달지 않음)");
      continue;
    }
    if (dungeonCorridorAsk && isRecord(entry) && entry.tool === "place_door") {
      continue;
    }
    const check = validateStampStep(entry, facts);
    if ("step" in check) steps.push(check.step);
    else if ("refused" in check) refused.push(check.refused);
    else dropped.push(check.dropped);
  }
  const afterHouses = houseInsteadOfWalls(steps, facts, dropped);
  const finalSteps = dungeonInsteadOfWalls(afterHouses, facts);
  if (finalSteps.length === 0 && dropped.length === 0 && refused.length === 0 && houseAsk && facts.houseLooks === 0) {
    dropped.push(`집: 이 타일셋(${facts.tilesetId ?? "현재 타일셋"})에는 집 외관이 없습니다(벽·문·바닥으로 흉내 내지 않음)`);
  }
  return { steps: finalSteps, dropped, refused };
}
