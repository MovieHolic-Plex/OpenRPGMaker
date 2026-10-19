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
  | "set_street_traffic"
  | "compose_scene"
  | "erase_object"
  | "move_object"
  | "move_region"
  | "carve_river"
  | "sculpt_hill"
  | "place_castle"
  | "place_shop"
  | "place_corpses"
  | "harmonize_region"
  | "place_bridge"
  | "carve_waterfall_pond"
  | "carve_lake_island"
  | "retheme_season_biome"
  | "build_market_bazaar"
  | "build_harbor_dock"
  | "build_farm_ranch"
  | "build_rail_crossing"
  | "place_church_healer"
  | "place_guild_board"
  | "place_travel_portal"
  | "place_roaming_enemies"
  | "place_switch_and_gate"
  | "place_camp_rest"
  | "place_mimic_and_sparkles"
  | "repeat_line_or_grid"
  | "mirror_region"
  | "enclose_with_wall"
  | "auto_connect_roads"
  | "populate_crowd"
  | "set_mood_weather"
  | "sculpt_relief"
  | "place_terrain_ramp";
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
  "compose_scene",
  "erase_object",
  "move_object",
  "move_region",
  "carve_river",
  "sculpt_hill",
  "place_castle",
  "place_shop",
  "place_corpses",
  "harmonize_region",
  "place_bridge",
  "carve_waterfall_pond",
  "carve_lake_island",
  "retheme_season_biome",
  "build_market_bazaar",
  "build_harbor_dock",
  "build_farm_ranch",
  "build_rail_crossing",
  "place_church_healer",
  "place_guild_board",
  "place_travel_portal",
  "place_roaming_enemies",
  "place_switch_and_gate",
  "place_camp_rest",
  "place_mimic_and_sparkles",
  "repeat_line_or_grid",
  "mirror_region",
  "enclose_with_wall",
  "auto_connect_roads",
  "populate_crowd",
  "set_mood_weather",
];

export type FastPathCommandTier =
  | "SPATIAL_DIRECT_OP"
  | "QUEST_OR_NARRATIVE_REJECTED"
  | "SCENE_COMPOSITION_OP";

export type FastPathSpatialOpKind = "place" | "erase" | "move";

export type FastPathRejectCode = "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT";

export const FAST_PATH_QUEST_OR_EVENT_GUIDANCE =
  "「퀘스트·이벤트·대화 만들기」는 타일만 찍는 『바로 깔기』로 처리할 수 없습니다. 일반 AI 조수 모드(『퀘스트/이벤트 제작』)로 전환해 실행해 주세요.";

export interface FastPathCommandClassification {
  readonly tier: FastPathCommandTier;
  readonly allowed: boolean;
  readonly op?: FastPathSpatialOpKind;
  readonly spatialOp?: FastPathSpatialOpKind;
  readonly code?: FastPathRejectCode;
  readonly matchedCategory?: string;
  readonly guidance?: string;
}

export interface PlacedMapObjectSummary {
  readonly id: string;
  readonly kind: "structure" | "kit" | "prop_cluster" | "event";
  readonly name: string;
  readonly coreName: string;
  readonly kitId?: string;
  readonly placementId?: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

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
  /** 실제로 부를 등록 도구 이름(compose_scene 이 고른 장면 구성기). 없으면 tool 이름을 그대로 부른다. */
  readonly call?: string;
}

/**
 * 이 맵 칩셋에서 바로 깔기가 부를 수 있는 장면 구성기 하나(모델에게 보여 주는 메뉴).
 * 구성기는 도로망·블록·대지·여러 칸 건물 키트·소품·방 배치를 통째로 짠다 — 모델은 장면·스타일·가게·실내 구성만 고른다.
 */
export interface StampSceneOption {
  readonly id: string;
  readonly label: string;
  readonly about: string;
  readonly styles?: readonly string[];
  /** 꼭 넣을 가게·건물 낱말(구성기가 받는 값 그대로). */
  readonly shops?: readonly string[];
  /** 실내 구성(program) id — scene 이 interior 일 때만. */
  readonly programs?: readonly string[];
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
  /** 나무·화단이 우선 놓일 잔디·흙 칸인가(판석·보도 광장 위를 피한다). */
  readonly isGrassOrSoilCell?: (x: number, y: number) => boolean;
  /** 이 칩셋의 장면 구성기 메뉴(마을·거리·던전·실내 한 장을 통째로). 비면 compose_scene 을 거절한다. */
  readonly scenes?: readonly StampSceneOption[];
  /** 현재 맵에 이미 배치된 물체·건물·나무 요약(지우기·옮기기 대조용). */
  readonly placedObjects?: readonly PlacedMapObjectSummary[];
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
  "- WHOLE PLACES FIRST: when the sentence asks for a whole place (마을·동네·도시·번화가·거리·상점가·주택가·강변 산책로·던전·동굴·지하 묘지 한 층·실내 한 층: 오피스 로비·백화점·병원·마트·역·영화관·레스토랑·박물관·여관 실내…) and facts.target is the whole map (or most of it), emit ONE compose_scene step {scene, style?, program?, shops?, seed?} with scene/style/program/shops copied from facts.scenes. The scene composer lays out roads, city blocks and alleys, lots, multi-tile buildings, fences, gardens, props, dungeon rooms with walls/torches/pillars, or a furnished multi-room interior — it is far better than hand steps. NEVER rebuild that place with fill_region / paint_road / place_house / place_dungeon_room / place_object. After compose_scene you may add ONLY set_scene_mood or set_street_traffic (the composer may resize the map, so coordinate steps are dropped). Pick shops/program/style that match the sentence (편의점→konbini or 편의점, 오피스 로비→lobby or office-1f, 백화점→department-store). If facts.scenes is empty or the target is a small selection, use the normal tools below.",
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
  "place_npc {at:{x,y}, name, role?:string, lines?:[\"...\"], movement?:\"fixed\"|\"random\", merchant?:boolean, stock?:[itemId]}",
  "place_shop {area?:{x,y,w,h}, at?:{x,y}, kind?:\"potion\"|\"weapon\"|\"armor\"|\"general\", name?:string}  (when the user asks for 간단한 상점/물약 상점/무기 상점/방어구 상점/잡화점/가게/노점을 만들어줘·세워줘 — places shop building/stall + merchant NPC with stock)",
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
  "erase_object {query:\"나무\", region?:\"오른쪽 위\", rect?:{x,y,w,h}}  (when the user asks to erase/remove/clear a placed object, tree, fountain, well, fence or house)",
  "move_object {query:\"우물\", toRegion?:\"광장 한가운데\", fromRegion?:string, to?:{x,y}, dx?:int, dy?:int}  (when the user asks to move/relocate/shift an object or house, e.g. \"우물을 광장 한가운데로 옮겨줘\", \"집을 오른쪽으로 4칸 옮겨줘\")",
  "compose_scene {scene, style?:string, program?:string, shops?:[string], seed?:int}  (omit seed unless the user names one — code picks a new seed every run so the same sentence gives a different layout)",
  "carve_river {area?:{x,y,w,h}, direction?:\"horizontal\"|\"vertical\", bridge?:boolean}  (when the user asks for 강/개울/물줄기/운하/내를 깔아줘·흐르게 해줘 — carves a natural winding water river channel + stone/wood bridge across the area)",
  "sculpt_hill {area?:{x,y,w,h}, levels?:1|2|3, stairs?:boolean}  (when the user asks for 언덕/고지/절벽 단차/단/계단식 언덕을 만들어줘·올려줘 — raises walkable relief cliff elevation + stairs + hilltop trees/flowers)",
  "place_castle {area?:{x,y,w,h}, gate?:boolean, towers?:boolean, archetype?:\"citadel\"|\"keep\"|\"gatehouse\"|\"outpost\", seed?:int}  (when the user asks for 성/성채/요새/성곽/성벽과 성문/망루를 지어줘·세워줘 — builds stone castle ramparts, battlements, round watchtowers, arched portcullis gate, and courtyard; omit seed unless the user names one)",
  "place_corpses {area?:{x,y,w,h}, count?:int, withDebris?:boolean}  (when the user asks for 시체/시체들/백골/유골/유해/전사자 유해/해골 더미/전투 흔적을 깔아줘 — scatters skeletal/corpse remains, skull piles, graves, and battle debris/weapons)",
  "harmonize_region {area?:{x,y,w,h}}  (when the user asks for \"주변과 어울리게 해줘\", \"주변 풍경에 맞게 자연스럽게 꾸며줘\", \"어울리게 채워줘\" — inspects surrounding ground, roads, trees, and props to automatically blend the area with the map biome)",
  "place_bridge {area?:{x,y,w,h}, direction?:\"horizontal\"|\"vertical\", style?:\"stone\"|\"wood\"|\"sluice\"}  (when the user asks for 다리/돌다리/나무다리/수문 다리를 놓아줘·연결해줘 across water/river)",
  "carve_waterfall_pond {area?:{x,y,w,h}}  (when the user asks for 폭포/폭포수와 연못/절벽 폭포를 만들어줘·깔아줘)",
  "carve_lake_island {area?:{x,y,w,h}, centerpiece?:\"shrine\"|\"pavilion\"|\"statue\"}  (when the user asks for 호수 섬/작은 섬이 있는 호수/호수 한가운데 사당·정자·석상을 만들어줘)",
  "retheme_season_biome {area?:{x,y,w,h}, theme:\"winter_snow\"|\"autumn\"|\"ruins\"|\"volcanic\"}  (when the user asks to change season/biome to 겨울 설원/눈 덮인 마을, 가을 단풍, 고대 폐허/유적, or 화산/용암 지대)",
  "build_market_bazaar {area?:{x,y,w,h}, stallCount?:int}  (when the user asks for 장터/시장 광장/바자회/노점 거리를 만들어줘)",
  "build_harbor_dock {area?:{x,y,w,h}}  (when the user asks for 항구/부두/선착장/잔교와 배를 만들어줘)",
  "build_farm_ranch {area?:{x,y,w,h}}  (when the user asks for 농장/목장/텃밭과 헛간·가축을 만들어줘)",
  "build_rail_crossing {area?:{x,y,w,h}}  (when the user asks for 철길/기찻길/선로와 건널목/간이역을 만들어줘)",
  "place_inn {area?:{x,y,w,h}, at?:{x,y}, name?:string, price?:number, greeting?:string}  (when the user asks for 여관/숙소와 여관 주인을 만들어줘 — stamps inn building + Innkeeper NPC with gold-deducting party heal)",
  "place_church_healer {area?:{x,y,w,h}, name?:string}  (when the user asks for 교회/성당/예배당과 치유 사제/힐러를 만들어줘 — heals party + opens save menu)",
  "place_guild_board {area?:{x,y,w,h}, name?:string}  (when the user asks for 모험가 길드/의뢰 게시판을 만들어줘 — guild hall + interactive 3-choice rumor/bounty board)",
  "place_travel_portal {area?:{x,y,w,h}, kind?:\"carriage\"|\"portal\"}  (when the user asks for 역마차 정류장/마차 or 순간이동 마법진/전이 포탈을 만들어줘)",
  "place_roaming_enemies {area?:{x,y,w,h}, count?:1..4, movement?:\"approach\"|\"random\"}  (when the user asks for 돌아다니는 몬스터/배회하는 적/심볼 인카운터 적들을 깔아줘)",
  "place_switch_and_gate {area?:{x,y,w,h}}  (when the user asks for 레버와 철문/스위치와 열리는 성문을 깔아줘 — wires a lever switch to open an iron gate)",
  "place_camp_rest {area?:{x,y,w,h}}  (when the user asks for 야영지/캠프파이어/모닥불 쉼터와 천막을 만들어줘 — tent + campfire with rest/heal/save)",
  "place_mimic_and_sparkles {area?:{x,y,w,h}}  (when the user asks for 미믹 상자와 반짝이는 바닥 아이템/유실물을 깔아줘)",
  "repeat_line_or_grid {area?:{x,y,w,h}, query?:string, count?:int, rows?:int, cols?:int}  (when the user asks to repeat/line up/grid-place streetlamps, pillars, trees, statues, benches, banners)",
  "mirror_region {area?:{x,y,w,h}, axis?:\"horizontal\"|\"vertical\"}  (when the user asks to mirror/symmetrically copy the left/right or top/bottom half of the selection)",
  "enclose_with_wall {area?:{x,y,w,h}, style?:\"stone\"|\"fence\"|\"hedge\", gateSide?:\"south\"|\"north\"|\"east\"|\"west\"}  (when the user asks to surround/enclose the area with a stone wall, wooden fence, or hedge with a gate opening)",
  "auto_connect_roads {area?:{x,y,w,h}}  (when the user asks to automatically connect building doors/gates to the road network with cobblestone roads and lamps)",
  "populate_crowd {area?:{x,y,w,h}, count?:int}  (when the user asks to populate the area with a lively crowd of townsfolk, guards, children, and pets)",
  "set_mood_weather {area?:{x,y,w,h}, weather?:\"rain\"|\"snow\"|\"fog\"|\"storm\"|\"clear\", preset?:\"sunset\"|\"night\"|\"dawn\"|\"day\"}  (when the user asks to set weather + sunset/night/dawn lighting tint + lit braziers/lamps)",
  "- SIMPLE NPC, SIMPLE SHOP, TOWN FACILITIES & FIELD GIMMICKS ARE ALLOWED: place_npc, place_shop, place_inn, place_church_healer, place_guild_board, place_travel_portal, place_roaming_enemies, place_switch_and_gate, place_camp_rest, place_mimic_and_sparkles.",
  "- QUEST / BRANCHING STORY / BOSS EVENT / PUZZLE / PARTY RECRUIT / COMPLEX SYSTEM WIRING GUARD: ONLY if the sentence asks for 퀘스트 만들기/세우기, 분기·선택지 대화·스토리·컷신 짜기, 보스전·퍼즐·선택지 이벤트 만들기, 동료 영입/합류, or 상점·숙소 기능 배선/시스템 구현, return ONLY {\"reject\":\"FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT\"}.",
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
    ...(facts.scenes?.length ? { scenes: facts.scenes } : {}),
    ...(facts.objectSamples?.length ? { objectNames: facts.objectSamples } : {}),
    ...(facts.placedObjects?.length ? { placedObjects: facts.placedObjects } : {}),
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
  compose_scene: "장면 구성",
  erase_object: "물체 지우기",
  move_object: "물체 옮기기",
  move_region: "영역 옮기기",
  carve_river: "강·물줄기",
  sculpt_hill: "언덕·절벽 단차",
  place_castle: "성·성채",
  place_shop: "상점",
  place_corpses: "백골 유해·전투 흔적",
  harmonize_region: "주변 맞춤 조경",
  place_bridge: "다리·수문 횡단교",
  carve_waterfall_pond: "폭포와 연못",
  carve_lake_island: "호수 섬과 사당",
  retheme_season_biome: "계절·바이옴 리테마",
  build_market_bazaar: "장터 노점 광장",
  build_harbor_dock: "항구 부두와 선박",
  build_farm_ranch: "농장·목장 지구",
  build_rail_crossing: "철길 건널목과 간이역",
  place_church_healer: "성당과 치유 사제",
  place_guild_board: "모험가 길드와 의뢰 게시판",
  place_travel_portal: "역마차·전이 마법진",
  place_roaming_enemies: "배회 심볼 몬스터",
  place_switch_and_gate: "레버 스위치와 철문",
  place_camp_rest: "야영지 천막과 모닥불",
  place_mimic_and_sparkles: "미믹 상자와 반짝이 유실물",
  repeat_line_or_grid: "일렬·격자 반복 배치",
  mirror_region: "좌우·상하 대칭 복사",
  enclose_with_wall: "성벽·울타리 포위 시공",
  auto_connect_roads: "출입구 도로망 자동 연결",
  populate_crowd: "활기찬 마을 군중 배치",
  set_mood_weather: "날씨·석양/야경 조명 연출",
  sculpt_relief: "절벽 높이 빚기",
  place_terrain_ramp: "오르막 계단",
};

/**
 * 모델 단계 하나 → 도구 인자. 허용 키만 옮기고 좌표를 대상 사각형 안으로 자른다.
 * 모델은 rect 이름을 도구마다 헷갈리므로 rect/area 를 서로 받아 준다.
 */
export function validateStampStep(raw: unknown, facts: StampPlanFacts): StampStepCheck {
  if (!isRecord(raw)) return { dropped: "단계가 객체가 아닙니다" };
  const rawTool = typeof raw.tool === "string" ? raw.tool.trim() : "";
  const tool = rawTool === "set_map_transit" ? "set_street_traffic" : rawTool === "place_simple_shop" ? "place_shop" : rawTool;
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
      const sameSizeVariants = entry.id.startsWith("mc-prop-street-tree-") || entry.id.startsWith("mc-prop-blossom-") || entry.id.startsWith("mc-prop-ginkgo-")
        ? ["mc-prop-blossom-a", "mc-prop-ginkgo-a", "mc-prop-street-tree-a", "mc-prop-blossom-b"]
        : hit.variants
            .filter((v) => v.width === entry.width && v.height === entry.height)
            .slice(0, 8)
            .map((v) => v.id);
      return {
        step: {
          tool: stampTool,
          label: labelText ?? `${shown} ${count}개`,
          ...(notes.length ? { note: notes.join(" · ") } : {}),
          args: {
            mapId,
            name: shown,
            entryId: entry.id,
            ...(sameSizeVariants.length > 1 ? { variantIds: sameSizeVariants } : {}),
            entryKind: entry.kind,
            entryName: entry.name,
            width: entry.width,
            height: entry.height,
            placement,
            area,
            count,
          },
        },
      };
    }
    case "fill_region": {
      if (!rect) return dropped("영역이 대상 밖입니다");
      if (!material) return dropped("재료가 없습니다");
      if (/경작지|밭/u.test(material) && !facts.fillMaterials.includes(material)) {
        return validateStampStep({ tool: "place_object", label: raw.label, args: { name: "밭", area: rect, count: 2 } }, facts);
      }
      if (/횡단보도|crosswalk/iu.test(material)) {
        return validateStampStep({ tool: "place_object", label: raw.label, args: { name: "횡단보도", area: rect, count: 1 } }, facts);
      }
      const resolvedMaterial = normalizeFillMaterial(material, facts.fillMaterials, `${labelText ?? ""} ${facts.text}`);
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
      const body = lines.length > 0 ? lines : [`${name}: 안녕하세요. 좋은 하루입니다!`];
      const movement = enumArg(args.movement, ["fixed", "random", "approach"] as const)
        ?? (/산책|배회|걸어|돌아다니|구경/u.test(`${name} ${role ?? ""} ${facts.text}`)
          ? "random"
          : /경비|문지기|병사|보초|초병|상인|주인|점원|guard|soldier|merchant|shopkeeper/iu.test(`${name} ${role ?? ""}`)
            ? "fixed"
            : undefined);
      const isMerchant = args.merchant === true || Array.isArray(args.stock) || /상인|상점\s*주인|약사|무기상|방어구상|잡화상|점원|merchant|shopkeeper/iu.test(`${name} ${role ?? ""}`);
      if (isMerchant) {
        const shopKind = inferShopKind(`${name} ${role ?? ""} ${facts.text}`);
        const stock = merchantStock(args.stock, facts, shopKind);
        if (stock.itemIds.length > 0) {
          return {
            step: {
              tool: "make_villager",
              label: labelText ?? `${name} 상인`,
              ...(stock.note ? { note: stock.note } : {}),
              args: {
                mapId, name, home: at,
                graphic: { query: role ?? "merchant" },
                movement: "fixed",
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
            ...(movement ? { movement } : {}),
            pages: [{ lines: body }],
          },
        },
      };
    }
    case "place_shop": {
      const area = args.at !== undefined ? pointRect(clampPointToTarget(args.at, target)) : (rect ?? target);
      if (!area) return dropped("상점을 놓을 영역이 대상 밖입니다");
      const kind = enumArg(args.kind, ["potion", "weapon", "armor", "general"] as const)
        ?? inferShopKind(`${stringArg(args.kind) ?? ""} ${stringArg(args.name) ?? ""} ${labelText ?? ""} ${facts.text}`);
      const defaultShopName = kind === "potion" ? "물약 상점" : kind === "weapon" ? "무기 상점" : kind === "armor" ? "방어구 상점" : "잡화 상점";
      const name = stringArg(args.name) ?? defaultShopName;
      const stock = merchantStock(args.stock, facts, kind);
      return {
        step: {
          tool: "place_shop",
          label: labelText ?? `${name}과 상인 NPC`,
          ...(stock.note ? { note: stock.note } : {}),
          args: {
            mapId,
            area,
            kind,
            name,
            stock: stock.itemIds,
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
    case "compose_scene": {
      const scenes = facts.scenes ?? [];
      if (scenes.length === 0) return dropped(`이 칩셋(${facts.tilesetId ?? "현재 칩셋"})에는 장면 구성기가 없습니다`);
      const wanted = stringArg(args.scene) ?? "";
      const scene = scenes.find((option) => option.id === wanted) ?? scenes.find((option) => option.label === wanted);
      if (!scene) return dropped(`장면 '${wanted || "(없음)"}' 이 이 칩셋 메뉴(${scenes.map((option) => option.id).join("·")})에 없습니다`);
      // 구성기는 맵 한 장을 통째로 짠다 — 작은 선택 영역 안의 주문을 맵 전체 재구성으로 바꾸지 않는다.
      const mapArea = Math.max(1, facts.mapWidth * facts.mapHeight);
      if (facts.targetIsSelection && (target.w * target.h) / mapArea < 0.6) {
        return dropped(`장면 구성기는 맵 전체를 짭니다 — 선택 영역(${target.w}×${target.h})이 맵의 60% 미만이라 쓰지 않습니다(선택을 풀고 다시 말하세요)`);
      }
      const style = scene.styles ? enumArg(args.style, scene.styles) : undefined;
      const programRaw = stringArg(args.program);
      const program = scene.programs && programRaw
        ? scene.programs.find((id) => id === programRaw) ?? scene.programs.find((id) => id.includes(programRaw) || programRaw.includes(id))
        : undefined;
      if (scene.programs && !program) return dropped(`실내 구성 '${programRaw ?? "(없음)"}' 이 이 칩셋 구성 목록에 없습니다(${scene.programs.slice(0, 12).join("·")}…)`);
      const askedShops = Array.isArray(args.shops) ? args.shops.map(stringArg).filter((shop): shop is string => shop !== null) : [];
      const shops = scene.shops ? askedShops.filter((shop) => scene.shops!.includes(shop)).slice(0, 8) : [];
      // 모델은 씨앗을 늘 같은 값(0·1·42)으로 채우는 버릇이 있다 — 사용자가 씨앗을 말했을 때만 받고, 아니면 코드가 매번 새로 고른다.
      const seed = /씨앗|시드|seed/iu.test(facts.text) ? finiteInt(args.seed) : null;
      const skipped = askedShops.length - shops.length;
      return {
        step: {
          tool: stampTool,
          label: labelText ?? `${scene.label}${style ? `(${style})` : ""}${program ? `(${program})` : ""}`,
          ...(skipped > 0 ? { note: `구성기가 모르는 가게 ${skipped}개는 뺌` } : {}),
          args: { mapId, scene: scene.id, ...(style ? { style } : {}), ...(program ? { program } : {}), ...(shops.length ? { shops } : {}), ...(seed !== null && seed >= 0 ? { seed } : {}) },
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
      const basis = facts.placement?.innPrice ?? { gold: 20, reason: "기본" };
      const asked = typeof args.price === "number" && Number.isFinite(args.price) ? Math.round(args.price) : undefined;
      const price = asked === undefined ? basis.gold : Math.max(Math.ceil(basis.gold / 3), Math.min(basis.gold * 3, asked));
      const name = stringArg(args.name) ?? "여관 주인";
      const greeting = stringArg(args.greeting)?.slice(0, 80) ?? `어서 오세요. 하룻밤 ${price}G 입니다.`;
      const existingInn = facts.placement?.existing.occupied.find((entry) => entry.kind === "inn");
      const priceNote = asked !== undefined && asked !== price ? `요금 ${asked}G → ${price}G(${basis.reason})` : `요금 ${price}G(${basis.reason})`;
      const note = existingInn ? `${priceNote} · 이 맵에 이미 여관이 있습니다(${existingInn.name} ${existingInn.x},${existingInn.y})` : priceNote;
      if (args.at !== undefined && args.area === undefined && args.rect === undefined) {
        const at = pointOrCenter(args.at, rect, target);
        if (!at) return dropped("여관 주인 위치가 없습니다");
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
      const area = rect ?? target;
      return {
        step: {
          tool: "place_inn",
          label: labelText ?? "여관 건물과 숙박 회복 주인",
          note,
          args: { mapId, area, name, price, greeting },
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
    case "erase_object": {
      const query = stringArg(args.query) ?? stringArg(args.name) ?? stringArg(args.object) ?? stringArg(args.target) ?? extractEraseTargetNoun(facts.text);
      const region = stringArg(args.region) ?? stringArg(args.where) ?? extractSpatialZonePhrase(facts.text);
      if (!query && !rect) return dropped("지울 대상이 없습니다");
      return {
        step: {
          tool: "erase_object",
          label: labelText ?? `${region ? `${region} ` : ""}${query ?? "영역"} 지우기`,
          args: {
            mapId,
            ...(query ? { query } : {}),
            ...(region ? { region } : {}),
            ...(rectRaw !== undefined && rect ? { rect } : {}),
          },
        },
      };
    }
    case "move_object": {
      const query = stringArg(args.query) ?? stringArg(args.name) ?? stringArg(args.object) ?? stringArg(args.target) ?? extractMoveTargetNoun(facts.text) ?? "선택 물체";
      const parsedShift = parseRelativeShift(facts.text);
      const dx = finiteInt(args.dx) ?? parsedShift?.dx ?? null;
      const dy = finiteInt(args.dy) ?? parsedShift?.dy ?? null;
      const toRegion = stringArg(args.toRegion) ?? stringArg(args.where) ?? stringArg(args.destination) ?? extractMoveDestinationPhrase(facts.text);
      const fromRegion = stringArg(args.fromRegion) ?? extractMoveSourcePhrase(facts.text);
      const toPoint = args.to !== undefined ? clampPointToTarget(args.to, target) : args.at !== undefined ? clampPointToTarget(args.at, target) : null;
      return {
        step: {
          tool: "move_object",
          label: labelText ?? `${query} 옮기기`,
          args: {
            mapId,
            query,
            ...(toRegion ? { toRegion } : {}),
            ...(fromRegion ? { fromRegion } : {}),
            ...(dx !== null ? { dx } : {}),
            ...(dy !== null ? { dy } : {}),
            ...(toPoint ? { to: toPoint } : {}),
          },
        },
      };
    }
    case "move_region": {
      const fromRect = clampRectToTarget(args.from, { x: 0, y: 0, w: facts.mapWidth, h: facts.mapHeight });
      const toPoint = clampPointToTarget(args.to, { x: 0, y: 0, w: facts.mapWidth, h: facts.mapHeight });
      if (!fromRect || !toPoint) return dropped("옮길 영역(from/to)이 올바르지 않습니다");
      const layers = enumArg(args.layers, ["all", "lower", "upper"] as const) ?? "upper";
      return {
        step: {
          tool: "move_region",
          label: labelText ?? "영역 옮기기",
          args: {
            from: { mapId, ...fromRect },
            to: { mapId, ...toPoint },
            layers,
            ...(args.withEvents === true ? { withEvents: true } : {}),
          },
        },
      };
    }
    case "carve_river": {
      const area = rect ?? target;
      const direction = enumArg(args.direction, ["horizontal", "vertical"] as const)
        ?? (/세로|남북|위아래/u.test(facts.text) ? "vertical" : /가로|동서|양옆/u.test(facts.text) ? "horizontal" : area.w >= area.h ? "horizontal" : "vertical");
      const bridge = typeof args.bridge === "boolean" ? args.bridge : !/다리\s*없이/u.test(facts.text);
      return {
        step: {
          tool: "carve_river",
          label: labelText ?? (bridge ? "굽이치는 강줄기와 돌다리" : "굽이치는 강줄기"),
          args: { mapId, area, direction, bridge },
        },
      };
    }
    case "sculpt_hill": {
      const area = rect ?? target;
      const lvMatch = /(\d+)\s*단/u.exec(facts.text);
      const levelsRaw = finiteInt(args.levels) ?? (lvMatch?.[1] ? Number(lvMatch[1]) : 2);
      const levels = Math.max(1, Math.min(3, levelsRaw));
      const stairs = typeof args.stairs === "boolean" ? args.stairs : !/계단\s*없이/u.test(facts.text);
      return {
        step: {
          tool: "sculpt_hill",
          label: labelText ?? `${levels}단 언덕과 오르막 계단`,
          args: { mapId, area, levels, stairs },
        },
      };
    }
    case "place_castle": {
      const area = rect ?? target;
      const gate = typeof args.gate === "boolean" ? args.gate : !/성문\s*없이|문\s*없이/u.test(facts.text);
      const towers = typeof args.towers === "boolean" ? args.towers : !/망루\s*없이|탑\s*없이/u.test(facts.text);
      const archetype = enumArg(args.archetype, ["citadel", "keep", "gatehouse", "outpost"] as const)
        ?? inferCastleArchetypeFromText(facts.text);
      const seed = /씨앗|시드|seed/iu.test(facts.text) ? finiteInt(args.seed) : null;
      return {
        step: {
          tool: "place_castle",
          label: labelText ?? "성채 성벽·망루·아치 성문",
          args: {
            mapId,
            area,
            gate,
            towers,
            ...(archetype ? { archetype } : {}),
            ...(seed !== null && seed >= 0 ? { seed } : {}),
          },
        },
      };
    }
    case "place_corpses": {
      const area = rect ?? target;
      const countRaw = finiteInt(args.count);
      const count = Math.max(2, Math.min(8, countRaw ?? 5));
      const withDebris = typeof args.withDebris === "boolean" ? args.withDebris : /전투|무기|흔적|부서진|잔해|폐허|전장/u.test(facts.text);
      return {
        step: {
          tool: "place_corpses",
          label: labelText ?? (withDebris ? "전투 흔적과 백골 유해" : "백골 유해·해골 더미"),
          args: { mapId, area, count, withDebris },
        },
      };
    }
    case "harmonize_region": {
      const area = rect ?? target;
      return {
        step: {
          tool: "harmonize_region",
          label: labelText ?? "주변 바이옴 맞춤 자동 조경",
          args: { mapId, area },
        },
      };
    }
    case "place_bridge": {
      const area = rect ?? target;
      const direction = enumArg(args.direction, ["horizontal", "vertical"] as const);
      const style = enumArg(args.style, ["stone", "wood", "sluice"] as const)
        ?? (/수문|갑문/u.test(facts.text) ? "sluice" : /나무|널다리|목교/u.test(facts.text) ? "wood" : "stone");
      return {
        step: {
          tool: "place_bridge",
          label: labelText ?? (style === "sluice" ? "수문 다리와 양안 진입로" : style === "wood" ? "나무 널다리와 진입로" : "아치 돌다리와 양안 진입로"),
          args: { mapId, area, ...(direction ? { direction } : {}), style },
        },
      };
    }
    case "carve_waterfall_pond": {
      const area = rect ?? target;
      return {
        step: {
          tool: "carve_waterfall_pond",
          label: labelText ?? "절벽 폭포와 폭포수 연못",
          args: { mapId, area },
        },
      };
    }
    case "carve_lake_island": {
      const area = rect ?? target;
      const centerpiece = enumArg(args.centerpiece, ["shrine", "pavilion", "statue"] as const)
        ?? (/정자|닫집|파빌리온/u.test(facts.text) ? "pavilion" : /석상|동상|조각상/u.test(facts.text) ? "statue" : "shrine");
      return {
        step: {
          tool: "carve_lake_island",
          label: labelText ?? "호수 위 작은 섬과 사당·징검돌 다리",
          args: { mapId, area, centerpiece },
        },
      };
    }
    case "retheme_season_biome": {
      const area = rect ?? target;
      const theme = enumArg(args.theme, ["winter_snow", "autumn", "ruins", "volcanic"] as const)
        ?? (/화산|용암|잿더미|흑요석|volcan/iu.test(facts.text)
          ? "volcanic"
          : /폐허|유적|고대|무너진|ruin/iu.test(facts.text)
            ? "ruins"
            : /가을|단풍|추수|황금|autumn|fall/iu.test(facts.text)
              ? "autumn"
              : "winter_snow");
      const koTheme = theme === "winter_snow" ? "겨울 설원" : theme === "autumn" ? "가을 단풍" : theme === "ruins" ? "고대 유적 폐허" : "화산 용암 지대";
      return {
        step: {
          tool: "retheme_season_biome",
          label: labelText ?? `${koTheme} 바이옴 리테마`,
          args: { mapId, area, theme },
        },
      };
    }
    case "build_market_bazaar": {
      const area = rect ?? target;
      const stallCount = Math.max(3, Math.min(6, finiteInt(args.stallCount) ?? 5));
      return {
        step: {
          tool: "build_market_bazaar",
          label: labelText ?? "장터 광장과 노점 바자회·상인 NPC",
          args: { mapId, area, stallCount },
        },
      };
    }
    case "build_harbor_dock": {
      const area = rect ?? target;
      return {
        step: {
          tool: "build_harbor_dock",
          label: labelText ?? "석조 부두 안벽·나무 잔교·정박 어선·선원 NPC",
          args: { mapId, area },
        },
      };
    }
    case "build_farm_ranch": {
      const area = rect ?? target;
      return {
        step: {
          tool: "build_farm_ranch",
          label: labelText ?? "목장 울타리·경작지 밭·닭장·양떼·농부 NPC",
          args: { mapId, area },
        },
      };
    }
    case "build_rail_crossing": {
      const area = rect ?? target;
      return {
        step: {
          tool: "build_rail_crossing",
          label: labelText ?? "동서 철길 선로·남북 건널목·간이역·역무원 NPC",
          args: { mapId, area },
        },
      };
    }
    case "place_church_healer": {
      const area = rect ?? target;
      return {
        step: {
          tool: "place_church_healer",
          label: labelText ?? "성당 예배당과 치유·저장 사제 NPC",
          args: { mapId, area },
        },
      };
    }
    case "place_guild_board": {
      const area = rect ?? target;
      return {
        step: {
          tool: "place_guild_board",
          label: labelText ?? "모험가 길드 회관과 3분기 의뢰 게시판",
          args: { mapId, area },
        },
      };
    }
    case "place_travel_portal": {
      const area = rect ?? target;
      const kind = enumArg(args.kind, ["carriage", "portal"] as const)
        ?? (/마법진|포탈|순간이동|전이|룬|portal|teleport/iu.test(facts.text) ? "portal" : "carriage");
      return {
        step: {
          tool: "place_travel_portal",
          label: labelText ?? (kind === "portal" ? "고대 전이 마법진과 이동 이벤트" : "역마차 정류장과 마부 이동 이벤트"),
          args: { mapId, area, kind },
        },
      };
    }
    case "place_roaming_enemies": {
      const area = rect ?? target;
      const count = Math.max(1, Math.min(4, finiteInt(args.count) ?? 3));
      const movement = enumArg(args.movement, ["approach", "random"] as const) ?? "approach";
      return {
        step: {
          tool: "place_roaming_enemies",
          label: labelText ?? `배회 심볼 몬스터 ${count}마리`,
          args: { mapId, area, count, movement },
        },
      };
    }
    case "place_switch_and_gate": {
      const area = rect ?? target;
      const leverSide = enumArg(args.leverSide, ["north", "south"] as const);
      return {
        step: {
          tool: "place_switch_and_gate",
          label: labelText ?? "레버 스위치와 연동 강철 성문",
          args: { mapId, area, ...(leverSide ? { leverSide } : {}) },
        },
      };
    }
    case "place_camp_rest": {
      const area = rect ?? target;
      return {
        step: {
          tool: "place_camp_rest",
          label: labelText ?? "모험가 야영 천막과 휴식·저장 모닥불",
          args: { mapId, area },
        },
      };
    }
    case "place_mimic_and_sparkles": {
      const area = rect ?? target;
      return {
        step: {
          tool: "place_mimic_and_sparkles",
          label: labelText ?? "보물상자·미믹 함정 상자·반짝이 유실물",
          args: { mapId, area },
        },
      };
    }
    case "repeat_line_or_grid": {
      const area = rect ?? target;
      const query = stringArg(args.query) ?? stringArg(args.name) ?? (/벤치/u.test(facts.text) ? "벤치" : /석상|동상/u.test(facts.text) ? "석상" : /기둥|열주/u.test(facts.text) ? "기둥" : /나무|가로수/u.test(facts.text) ? "나무" : /깃발|배너/u.test(facts.text) ? "깃발" : "가로등");
      const count = finiteInt(args.count) ?? undefined;
      const rows = finiteInt(args.rows) ?? undefined;
      const cols = finiteInt(args.cols) ?? undefined;
      return {
        step: {
          tool: "repeat_line_or_grid",
          label: labelText ?? `${query} 일렬·격자 반복 배치`,
          args: { mapId, area, query, ...(count ? { count } : {}), ...(rows ? { rows } : {}), ...(cols ? { cols } : {}) },
        },
      };
    }
    case "mirror_region": {
      const area = rect ?? target;
      const axis = enumArg(args.axis, ["horizontal", "vertical"] as const)
        ?? (/상하|위아래/u.test(facts.text) ? "vertical" : "horizontal");
      return {
        step: {
          tool: "mirror_region",
          label: labelText ?? `${axis === "horizontal" ? "좌우" : "상하"} 대칭 복사`,
          args: { mapId, area, axis },
        },
      };
    }
    case "enclose_with_wall": {
      const area = rect ?? target;
      const style = enumArg(args.style, ["stone", "fence", "hedge"] as const)
        ?? (/산울타리|생울타리|덤불/u.test(facts.text) ? "hedge" : /나무\s*울타리|울타리|펜스|목책/u.test(facts.text) ? "fence" : "stone");
      const gateSide = enumArg(args.gateSide, ["south", "north", "east", "west"] as const)
        ?? (/북쪽|위쪽/u.test(facts.text) ? "north" : /동쪽|오른쪽/u.test(facts.text) ? "east" : /서쪽|왼쪽/u.test(facts.text) ? "west" : "south");
      return {
        step: {
          tool: "enclose_with_wall",
          label: labelText ?? "외곽 담장·울타리 포위 및 출입구 시공",
          args: { mapId, area, style, gateSide },
        },
      };
    }
    case "auto_connect_roads": {
      const area = rect ?? target;
      return {
        step: {
          tool: "auto_connect_roads",
          label: labelText ?? "건물 출입구 도로망 자동 연결",
          args: { mapId, area },
        },
      };
    }
    case "populate_crowd": {
      const area = rect ?? target;
      const count = Math.max(3, Math.min(8, finiteInt(args.count) ?? 5));
      return {
        step: {
          tool: "populate_crowd",
          label: labelText ?? `활기찬 마을 군중 NPC ${count}명 배치`,
          args: { mapId, area, count },
        },
      };
    }
    case "set_mood_weather": {
      const area = rect ?? target;
      const weather = enumArg(args.weather, ["rain", "snow", "fog", "storm", "clear"] as const)
        ?? (/눈|설원|폭설/u.test(facts.text) ? "snow" : /안개|연무/u.test(facts.text) ? "fog" : /폭풍|번개/u.test(facts.text) ? "storm" : /맑|쾌청/u.test(facts.text) ? "clear" : "rain");
      const preset = enumArg(args.preset, ["sunset", "night", "dawn", "day"] as const)
        ?? (/밤|야경|달빛|어두운/u.test(facts.text) ? "night" : /새벽|여명/u.test(facts.text) ? "dawn" : /노을|석양|황혼|저녁/u.test(facts.text) ? "sunset" : "sunset");
      return {
        step: {
          tool: "set_mood_weather",
          label: labelText ?? `${preset === "night" ? "야경" : preset === "dawn" ? "새벽" : "노을"} 조명과 ${weather === "snow" ? "눈" : weather === "fog" ? "안개" : weather === "clear" ? "맑음" : "비"} 분위기 연출`,
          args: { mapId, area, weather, preset, withLights: args.withLights !== false },
        },
      };
    }
    case "paint_tiles":
    case "sculpt_relief":
    case "place_terrain_ramp":
      return dropped("내부 전용 도구입니다");
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

function inferShopKind(text: string): "potion" | "weapon" | "armor" | "general" {
  if (/물약|포션|약초|약국|치료|회복약|연금|potion|herb|apothecary/iu.test(text)) return "potion";
  if (/무기|대장간|검|도검|창|활|weapon|smith|forge/iu.test(text)) return "weapon";
  if (/방어구|갑옷|방패|투구|장비|armor|armour/iu.test(text)) return "armor";
  return "general";
}

function inferCastleArchetypeFromText(text: string): "citadel" | "keep" | "gatehouse" | "outpost" | undefined {
  if (/왕성\s*원형|대성당형\s*왕성|왕성\s*전체|citadel/iu.test(text)) return "citadel";
  if (/안뜰\s*본성|본성|천수각|내성|궁전\s*성채|keep/iu.test(text)) return "keep";
  if (/해자|도개교|성문루|다리가\s*있는\s*성|gatehouse|moat/iu.test(text)) return "gatehouse";
  if (/망루\s*초소|초소|정원\s*성채|쌍둥이\s*탑\s*요새|outpost/iu.test(text)) return "outpost";
  return undefined;
}

/** 상인 재고 — 실제 id 만, 값이 이 맵 상자 범위의 두 배를 넘는 것은 뺀다. 비면 상점 종류별 기본 아이템·보상 후보로 채운다. */
function merchantStock(
  raw: unknown,
  facts: StampPlanFacts,
  shopKind: "potion" | "weapon" | "armor" | "general" = "general",
): { readonly itemIds: readonly string[]; readonly note?: string } {
  const defaultByKind: Record<"potion" | "weapon" | "armor" | "general", readonly string[]> = {
    potion: ["item_potion", "item_hi_potion", "item_antidote", "item_ether"],
    weapon: ["equip_sword", "item_potion", "item_antidote"],
    armor: ["equip_shield", "equip_leather_armor", "equip_sword", "item_potion"],
    general: ["item_potion", "item_antidote", "item_ether", "item_hi_potion"],
  };
  const placement = facts.placement;
  if (!placement) {
    return { itemIds: defaultByKind[shopKind] };
  }
  const ceiling = Math.max(120, placement.chestGold.max * 2);
  const asked = Array.isArray(raw) ? raw.map((entry) => (isRecord(entry) ? stringArg(entry.itemId) : stringArg(entry))).filter((id): id is string => Boolean(id)) : [];
  const priceOf = (id: string): number | undefined => placement.itemPrices[id];
  const kept = [...new Set(asked)].filter((id) => priceOf(id) !== undefined && priceOf(id)! <= ceiling).slice(0, 8);
  const removed = asked.filter((id) => !kept.includes(id));
  if (kept.length > 0) return { itemIds: kept, ...(removed.length ? { note: `재고에서 뺌: ${removed.join(", ")}(없는 id 이거나 ${ceiling}G 초과)` } : {}) };
  const preferred = defaultByKind[shopKind].filter((id) => placement.knownItemIds.includes(id));
  const rewardIds = placement.rewardItems.filter((item) => item.price > 0 && item.price <= ceiling).slice(0, 4).map((item) => item.id);
  const merged = [...new Set([...preferred, ...rewardIds])].slice(0, 5);
  const finalIds = merged.length > 0 ? merged : placement.knownItemIds.slice(0, 3);
  return { itemIds: finalIds, ...(finalIds.length ? { note: `기본 상점 재고(${finalIds.join(", ")})` } : {}) };
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
  let roadVehiclesPlaced = 0;
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
    const entryIdStr = String(args.entryId ?? "");
    const isVehicle = placement === "road" && width >= 3 && !/crosswalk|횡단보도|xwalk/iu.test(entryIdStr);
    const isArchDoor = placement === "wall" && width >= 2 && height >= 2;
    const isTreeObj = /^(?:bd-tree-|jp-prop-tree-|mc-prop-(?:street-tree|tree|blossom|ginkgo))/i.test(entryIdStr);
    const isPillarGrid = count === 4 && /column|pillar|기둥/iu.test(`${entryIdStr} ${name}`) && search.w >= 7 && search.h >= 5;
    const isAltarOrCenterpiece = count === 1 && /altar|제단|분수|fountain|우물|well/iu.test(`${entryIdStr} ${name}`);
    const canOverhangUpper =
      placement === "floor"
      && height >= 3
      && (width === 1 || entryIdStr.startsWith("jp-prop-tree-") || entryIdStr.startsWith("mc-prop-"));
    const cellAllowed = (x: number, y: number, baseY: number): boolean => {
      if (!inBoundsNotTaken(x, y)) return false;
      if (entryIdStr.startsWith("jp-prop-tree-") && search.y >= 18 && baseY - height + 1 < 18) return false;
      if (canOverhangUpper && y < baseY) {
        return !(facts.hasArtAt && facts.hasArtAt(x, y));
      }
      if (isVehicle && height >= 3 && y < baseY - 1) {
        return !(facts.hasArtAt && facts.hasArtAt(x, y));
      }
      if (!insideRect(facts.target, x, y)) return false;
      if (placement === "wall") return facts.isWallMountCell ? facts.isWallMountCell(x, y) : true;
      if (placement === "water") return true;
      if (placement === "road") return facts.isRoadCell ? facts.isRoadCell(x, y) : open(x, y);
      return open(x, y);
    };
    const isChokeDoorway = (base: { x: number; y: number }): boolean => {
      if (!isArchDoor || !facts.isOpenCell) return false;
      for (let dx = 0; dx < width; dx++) {
        if (!facts.isOpenCell(base.x + dx, base.y + 1)) return false;
        if (!facts.isOpenCell(base.x + dx, base.y - height)) return false;
      }
      return true;
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
        const checkCells = isVehicle && height >= 3 ? cells.filter((c) => c.y >= base.y - 1) : cells;
        const roadCount = checkCells.filter((cell) => facts.isRoadCell!(cell.x, cell.y)).length;
        if (roadCount < Math.min(checkCells.length, 4)) return false;
      }
      if (margin === 0) return !chosen.some((other) => other.some((o) => cells.some((c) => c.x === o.x && c.y === o.y)));
      return !chosen.some((other) => other.some((o) => cells.some((c) => Math.abs(c.x - o.x) <= margin && Math.abs(c.y - o.y) <= margin)));
    };
    let roadMinY = Infinity;
    let roadMaxY = -Infinity;
    if (isVehicle && facts.isRoadCell) {
      for (let y = search.y; y < search.y + search.h; y++) {
        for (let x = search.x; x < search.x + search.w; x++) {
          if (facts.isRoadCell(x, y)) {
            if (y < roadMinY) roadMinY = y;
            if (y > roadMaxY) roadMaxY = y;
          }
        }
      }
    }
    const hasRoadLanes = isVehicle && Number.isFinite(roadMinY) && roadMaxY - roadMinY >= 3;
    const northLaneY = hasRoadLanes ? roadMinY + 1 : 0;
    const southLaneY = hasRoadLanes ? roadMaxY : 0;
    const picked: { x: number; y: number }[] = [];
    const horizontalSpread = search.w >= search.h;
    const staggerY = count > 1 && placement === "floor" && horizontalSpread && search.h >= height + 3 && !isPillarGrid;
    const pillarTargets: readonly [number, number][] = [
      [search.x + 1, search.y + 2],
      [search.x + search.w - 2, search.y + 2],
      [search.x + 1, search.y + search.h - 1],
      [search.x + search.w - 2, search.y + search.h - 1],
    ];
    const vehicleXFractions = [0.2, 0.72, 0.34, 0.84] as const;
    for (let slot = 0; slot < count; slot++) {
      const vIdx = roadVehiclesPlaced + slot;
      const slotCx = isPillarGrid
        ? pillarTargets[slot % 4]![0]
        : isAltarOrCenterpiece
          ? search.x + Math.floor((search.w - width) / 2)
          : hasRoadLanes
            ? search.x + vehicleXFractions[vIdx % 4]! * (search.w - width)
            : count > 1 && horizontalSpread
              ? search.x + ((slot + 0.5) * search.w) / count - (width - 1) / 2
              : search.x + (search.w - 1) / 2;
      const baseCy = isPillarGrid
        ? pillarTargets[slot % 4]![1]
        : isAltarOrCenterpiece
          ? search.y + Math.floor((search.h + 2) / 2)
          : count > 1 && !horizontalSpread
            ? search.y + ((slot + 0.5) * search.h) / count
            : search.y + (search.h - 1) / 2;
      const slotCy = hasRoadLanes
        ? (vIdx % 2 === 0 ? northLaneY : southLaneY)
        : staggerY
          ? baseCy + (slot % 2 === 0 ? -1.4 : 1.4)
          : baseCy;
      const candidates: { x: number; y: number; d: number; choke: number; lane: number; grass: number }[] = [];
      for (let y = search.y; y < search.y + search.h; y++) for (let x = search.x; x < search.x + search.w; x++) {
        const choke = isArchDoor && isChokeDoorway({ x, y }) ? 0 : 1;
        const lane = hasRoadLanes ? (y === slotCy ? 0 : y === northLaneY || y === southLaneY ? 1 : 2) : 0;
        const grass = isTreeObj && facts.isGrassOrSoilCell ? (facts.isGrassOrSoilCell(x, y) ? 0 : 1) : 0;
        candidates.push({ x, y, d: Math.hypot(x - slotCx, y - slotCy), choke, lane, grass });
      }
      candidates.sort((a, b) => a.choke - b.choke || a.lane - b.lane || a.grass - b.grass || a.d - b.d || a.y - b.y || a.x - b.x);
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
    if (isVehicle) roadVehiclesPlaced += picked.length;
    if (picked.length === 0) {
      let openCells = 0;
      for (let y = facts.target.y; y < facts.target.y + facts.target.h; y++) for (let x = facts.target.x; x < facts.target.x + facts.target.w; x++) if (open(x, y)) openCells += 1;
      dropped.push(`${name}: 놓을 자리가 없습니다(${facts.targetIsSelection ? "선택 영역" : "맵"} ${facts.target.w}×${facts.target.h} 안에서 길·물·벽·건물·막힌 칸·이벤트를 뺀 빈 칸이 ${openCells}칸뿐이라 ${width}×${height} 물건이 들어갈 자리가 없음 — 영역을 넓히거나 빈 마당을 골라 주세요)`);
      continue;
    }
    const short = picked.length < count ? `자리가 모자라 ${count}개 중 ${picked.length}개만` : "";
    const variantIds = Array.isArray(args.variantIds) ? (args.variantIds as string[]) : [String(args.entryId)];
    const rotateVariants = /^(?:bd-tree-|jp-prop-tree-|mc-prop-(?:street-tree|tree|blossom|ginkgo)|mc-veh-|jp-prop-car-)/i.test(String(args.entryId ?? ""));
    picked.forEach((base, index) => {
      const notes = [index === 0 ? step.note : undefined, index === 0 ? short : undefined].filter(Boolean).join(" · ");
      let objectId = rotateVariants && variantIds.length > 0 ? variantIds[index % variantIds.length]! : String(args.entryId);
      if (hasRoadLanes && variantIds.length > 1) {
        const wantEastbound = base.y >= southLaneY;
        const directional = variantIds.filter((id) =>
          id.startsWith("mc-veh-") ? (wantEastbound ? !id.endsWith("-l") : id.endsWith("-l"))
            : id.startsWith("jp-prop-car-") ? (wantEastbound ? !id.endsWith("-r") : id.endsWith("-r"))
              : true
        );
        if (directional.length > 0) objectId = directional[index % directional.length]!;
      }
      out.push({
        tool: "stamp_tileset_object",
        label: picked.length > 1 ? `${name} ${index + 1}/${picked.length}` : name,
        group: name,
        at: [{ x: base.x, y: base.y }],
        ...(notes ? { note: notes } : {}),
        args: { mapId, objectId, base, ...(isVehicle || canOverhangUpper ? { overwrite: true } : {}) },
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

function normalizeFillMaterial(material: string, fillMaterials: readonly string[], contextText = ""): string {
  const m = material.trim();
  if (fillMaterials.length === 0) return material;
  // jp_city 의 가방 그룹 「거리 · 땅·잔디·판석·참배길」은 첫 타일이 맨땅(흙)이라 잔디 공원 요청에는 실제 오토타일 「잔디」를 쓴다.
  if (m === "거리 · 땅·잔디·판석·참배길" && /잔디|공원|풀밭/u.test(contextText) && fillMaterials.includes("잔디")) {
    return "잔디";
  }
  if (fillMaterials.includes(material)) return material;
  if (/횡단보도|crosswalk/iu.test(m)) {
    const hit = fillMaterials.find((f) => /횡단보도/u.test(f));
    if (hit) return hit;
  }
  if (/판석\s*광장|공공\s*·\s*보도/u.test(m)) {
    const hit = fillMaterials.find((f) => /판석\s*광장|광장|보도/u.test(f) && !/횡단보도/u.test(f));
    if (hit) return hit;
  }
  if (/보도|판석|광장|블록/u.test(m) && !/횡단보도|차도|차선|생활도로/u.test(m)) {
    const hit = fillMaterials.find((f) => /보도|판석|점자블록/u.test(f) && !/횡단보도/u.test(f));
    if (hit) return hit;
  }
  if (/공원|잔디|녹지|풀밭/u.test(m)) {
    const exact = fillMaterials.find((f) => f === "잔디" || /^잔디\(|^녹지/u.test(f));
    if (exact) return exact;
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
const PERSON_WORDS = /사람|주민|npc|상인|경비|병사|아이|아저씨|아주머니|할머니|할아버지|여관|주인|손님|학생|선생|기사|공주|왕|마법사|요리사|대장장이|점원|캐릭터|동료|친구|인물|노인|소녀|소년|여자|남자|용사|상점|가게|술집|주막|대장간|시장|장터|교회|성당|신부|수녀|사제|힐러|치유|선원|뱃사람|농부|목장|역무원|마부|길드|군중|인파|북적|행인|villager|merchant|guard|keeper|shop|inn|priest|healer|sailor|farmer\b/iu;
const VAGUE_WORDS = /예쁘|알아서|분위기|꾸며|꾸미|아늑|풍성|채워|사람 사는|마을처럼|활기|따뜻|멋지|그럴듯|빈 입력|살아 있|생기|북적/u;
export function allowsPerson(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  return PERSON_WORDS.test(t) || VAGUE_WORDS.test(t);
}

export interface StampGuardRejection {
  readonly code: FastPathRejectCode;
  readonly matchedCategory: string;
  readonly guidance: string;
}

export interface StampTurnObservation {
  readonly turnCompleted?: number;
  readonly placedStructures: readonly { readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number }[];
  readonly doorCells: readonly { readonly x: number; readonly y: number }[];
  readonly waterCells: number;
  readonly roadCells: number;
  readonly eventsCreated: readonly { readonly id: string; readonly name: string; readonly x: number; readonly y: number }[];
  readonly switchesWired: readonly string[];
  readonly remainingGoals: readonly string[];
}

export interface StampPlannerFollowUpInput {
  readonly turn?: number;
  readonly maxTurns?: number;
  readonly facts: StampPlanFacts;
  readonly turn1Steps: readonly StampStep[];
  readonly priorSteps?: readonly StampStep[];
  readonly observation: StampTurnObservation;
}

export interface ParsedStampPlan {
  readonly steps: readonly StampStep[];
  /** 버린 단계와 이유(채팅에 한 줄로 남긴다). */
  readonly dropped: readonly string[];
  /** 칩셋에 그림이 없어 깔지 않은 물건(거절 사유와 가까운 이름). */
  readonly refused: readonly StampRefusal[];
  /** 퀘스트·이벤트·대화 등 바로 깔기 금지 명령 가드. */
  readonly guardRejected?: StampGuardRejection;
  /** 1턴 계획이 2턴 후속 정밀 시공을 요청했거나 남은 복합 목표가 있을 때. */
  readonly needsFollowUp?: boolean;
  readonly remainingGoals?: readonly string[];
  /** JSON 을 읽지 못했을 때만. */
  readonly error?: string;
}

const FAST_PATH_FACILITY_OR_GIMMICK_ALLOW_RE =
  /길드\s*게시판|의뢰\s*게시판|퀘스트\s*게시판|모험가\s*길드|(?:스위치|레버)(?:와|과|랑|하고|\s)+(?:열리는\s*)?(?:철문|성문|문|창살문|격자문)|미믹|반짝이는\s*(?:바닥|아이템|유실물)|(?:돌아다니는|배회하는|필드)\s*(?:몬스터|적|슬라임|고블린)/iu;

const TIER2_REJECTION_RULES: readonly { readonly category: string; readonly pattern: RegExp }[] = [
  {
    category: "퀘스트 만들기",
    pattern: /퀘스트|서브\s*퀘스트|메인\s*퀘스트|\bquest\b|(?:의뢰|임무)\s*(?:를|을)?\s*(?:만들|세우|세워|짜|생성|추가|설계|넣)|(?:토벌|수집|심부름|배달|호위)\s*(?:의뢰|임무)/iu,
  },
  {
    category: "대화·스토리 짜기",
    pattern: /(?:스토리|시나리오|서사|내러티브)\s*(?:를|을)?\s*(?:짜|만들|세우|세워|구상|진행|넣|추가|작성|연출)|(?:대화|대사|대화문)\s*(?:이벤트|분기|선택지|시나리오|스토리|컷신)|(?:분기|선택지)\s*(?:대화|대사|스토리)|컷신|오프닝\s*(?:이벤트|컷신|연출|만들|짜)|엔딩\s*(?:이벤트|컷신|연출|만들|짜)|사건\s*(?:이벤트|연출|컷신)|\b(?:cutscene|storyline)\b/iu,
  },
  {
    category: "보스전·퍼즐 이벤트 만들기",
    pattern: /보스\s*(?:전|전투|이벤트|레이드|기믹|페이즈|등장)|(?:전투|배틀)\s*이벤트|퍼즐|수수께끼|선택지\s*(?:장치|기믹|이벤트|퍼즐)|(?:스위치|레버|비밀\s*통로|비밀\s*스위치|비밀\s*계단|암호|열쇠|봉인)\s*(?:기믹|퍼즐|이벤트|장치|해제)|기믹\s*(?:을|를)?\s*(?:만들|세우|세워|넣|짜|설계|추가)|\b(?:puzzle|gimmick|boss\s*fight|boss\s*event)\b/iu,
  },
  {
    category: "동료 영입",
    pattern: /동료\s*(?:를|을)?\s*(?:영입|합류|만들|추가|맞이)|파티\s*(?:합류|영입|가입|원\s*추가|에\s*들어오)|(?:영입|합류)\s*(?:이벤트|기믹|조건)|\b(?:party\s*recruit|recruit\s*event)\b/iu,
  },
  {
    category: "상점·숙소 기능 배선",
    pattern: /(?:상점|숙소|여관|무기점|방어구점|도구점|대장간|잡화점|시설|이벤트|스위치|변수|출입구|잠긴\s*문)[^\n,.!?]{0,14}배선|배선\s*(?:을|를)?\s*(?:해|하|만들|연결|짜)|(?:상점|숙소|여관)\s*(?:사고파는|숙박|회복|구매|판매)?\s*기능\s*(?:을|를)?\s*(?:만들|넣|배선|구현|연결)|(?:사고파는|숙박\s*회복|회복\s*캡슐|전직|조합|강화)\s*(?:기능|시스템|이벤트|기믹)/iu,
  },
];

const MOVE_VERB_RE = /옮겨|옮기|이동해|이동시켜|밀어|당겨|자리\s*바꿔|위치\s*바꿔|재배치|\b(?:move|relocate|shift)\b/iu;
const ERASE_VERB_RE = /지워|지우|없애|삭제|철거|허물|치워|치우|비워|제거|베어|뽑아|\b(?:erase|clear|remove|delete|demolish)\b/iu;

export function classifyFastPathCommand(text: string): FastPathCommandClassification {
  const trimmed = text.trim();
  if (!trimmed) {
    return { tier: "SPATIAL_DIRECT_OP", allowed: true, op: "place", spatialOp: "place" };
  }
  if (!FAST_PATH_FACILITY_OR_GIMMICK_ALLOW_RE.test(trimmed)) {
    for (const rule of TIER2_REJECTION_RULES) {
      if (rule.pattern.test(trimmed)) {
        return {
          tier: "QUEST_OR_NARRATIVE_REJECTED",
          allowed: false,
          code: "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT",
          matchedCategory: rule.category,
          guidance: FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
        };
      }
    }
  }
  if (MOVE_VERB_RE.test(trimmed) && !/역마차|마차\s*정류장|순간이동|전이\s*마법진|포탈/u.test(trimmed)) {
    return { tier: "SPATIAL_DIRECT_OP", allowed: true, op: "move", spatialOp: "move" };
  }
  if (ERASE_VERB_RE.test(trimmed) && !/차|자동차|승용차|버스|택시|차량|주행|교통/u.test(trimmed)) {
    return { tier: "SPATIAL_DIRECT_OP", allowed: true, op: "erase", spatialOp: "erase" };
  }
  return { tier: "SPATIAL_DIRECT_OP", allowed: true, op: "place", spatialOp: "place" };
}

const SPATIAL_ZONE_PATTERNS: readonly { readonly phrase: string; readonly re: RegExp }[] = [
  { phrase: "광장 한가운데", re: /광장\s*(?:한가운데|정중앙|가운데|중앙)/u },
  { phrase: "광장", re: /광장/u },
  { phrase: "오른쪽 위", re: /오른쪽\s*위|우측\s*상단|북동쪽?/u },
  { phrase: "왼쪽 위", re: /왼쪽\s*위|좌측\s*상단|북서쪽?/u },
  { phrase: "오른쪽 아래", re: /오른쪽\s*아래|우측\s*하단|남동쪽?/u },
  { phrase: "왼쪽 아래", re: /왼쪽\s*아래|좌측\s*하단|남서쪽?/u },
  { phrase: "한가운데", re: /한가운데|정중앙|가운데|중앙/u },
  { phrase: "위쪽", re: /위쪽|윗쪽|상단|북쪽/u },
  { phrase: "아래쪽", re: /아래쪽|하단|남쪽/u },
  { phrase: "오른쪽", re: /오른쪽|우측|동쪽/u },
  { phrase: "왼쪽", re: /왼쪽|좌측|서쪽/u },
];

export function extractSpatialZonePhrase(text: string): string | null {
  for (const item of SPATIAL_ZONE_PATTERNS) {
    if (item.re.test(text)) return item.phrase;
  }
  return null;
}

const KNOWN_SPATIAL_NOUN_RE =
  /(분수대|분수|돌\s*우물|우물|소나무|벚나무|은행나무|느티나무|전나무|가로수|침엽수|활엽수|나무|숲|왕성|성채|성곽|요새|성문|망루|성|통나무집|단독주택|오두막|초가집|기와집|살림집|민가|주택|저택|여관|물약\s*상점|무기\s*상점|방어구\s*상점|잡화점|상점|가게|노점|좌판|대장간|편의점|카페|빌딩|건물|집|나무\s*벤치|벤치|의자|탁자|테이블|식탁|침대|화분|꽃밭|화단|꽃|덤불|관목|산울타리|울타리|펜스|담장|가로등|등불|횃불|모닥불|화로|바위|돌|동상|조각상|석상|기둥|돌기둥|제단|통|오크통|술통|나무\s*상자|보물상자|상자|우체통|자판기|신호등|표지판|간판|다리|돌다리|계단)/u;

export function extractEraseTargetNoun(text: string): string | null {
  const m = KNOWN_SPATIAL_NOUN_RE.exec(text);
  return m?.[1]?.trim() ?? null;
}

export function extractMoveTargetNoun(text: string): string | null {
  // "우물을 광장 한가운데로 옮겨줘", "집을 오른쪽으로 4칸 옮겨줘" → 목적격 조사 앞의 명사 우선
  const beforeObj = /([가-힣a-zA-Z0-9\s]{1,18}?)(?:을|를)\s/u.exec(text);
  if (beforeObj?.[1]) {
    const m = KNOWN_SPATIAL_NOUN_RE.exec(beforeObj[1]);
    if (m?.[1]) return m[1].trim();
  }
  const m = KNOWN_SPATIAL_NOUN_RE.exec(text);
  return m?.[1]?.trim() ?? null;
}

function parseShiftAmountToken(token: string | undefined): number {
  if (!token) return 3;
  const trimmed = token.trim();
  const num = Number(trimmed);
  if (Number.isFinite(num) && num > 0) return Math.round(num);
  const koMap: Readonly<Record<string, number>> = {
    한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4,
    다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8, 몇: 3, 조금: 2, 살짝: 2, 약간: 2,
  };
  return koMap[trimmed] ?? 3;
}

export function parseRelativeShift(text: string): { readonly dx: number; readonly dy: number } | null {
  let dx = 0;
  let dy = 0;
  let matched = false;
  const qtyPat = "(\\d+|한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟|몇|조금|살짝|약간)";
  const right = new RegExp(`(?:오른쪽|우측|동쪽)(?:으로|로)?\\s*(?:${qtyPat}\\s*칸?|조금|살짝|약간)`, "u").exec(text);
  if (right) { dx += parseShiftAmountToken(right[1]); matched = true; }
  const left = new RegExp(`(?:왼쪽|좌측|서쪽)(?:으로|로)?\\s*(?:${qtyPat}\\s*칸?|조금|살짝|약간)`, "u").exec(text);
  if (left) { dx -= parseShiftAmountToken(left[1]); matched = true; }
  const down = new RegExp(`(?:아래쪽?|하단|남쪽)(?:으로|로)?\\s*(?:${qtyPat}\\s*칸?|조금|살짝|약간)`, "u").exec(text);
  if (down) { dy += parseShiftAmountToken(down[1]); matched = true; }
  const up = new RegExp(`(?:위쪽?|윗쪽|상단|북쪽)(?:으로|로)?\\s*(?:${qtyPat}\\s*칸?|조금|살짝|약간)`, "u").exec(text);
  if (up) { dy -= parseShiftAmountToken(up[1]); matched = true; }
  if (matched) return { dx, dy };
  return null;
}

export function extractMoveDestinationPhrase(text: string): string | null {
  if (parseRelativeShift(text)) return null;
  const destMatch = /([가-힣\s]{1,18}?)(?:으로|로)\s*(?:옮겨|옮기|이동|미뤄|밀어|당겨|배치)/u.exec(text);
  const candidate = destMatch?.[1]?.trim() ?? text;
  return extractSpatialZonePhrase(candidate) ?? extractSpatialZonePhrase(text);
}

export function extractMoveSourcePhrase(text: string): string | null {
  const beforeObj = /^(.+?)(?:을|를)\s/u.exec(text);
  if (!beforeObj?.[1]) return null;
  return extractSpatialZonePhrase(beforeObj[1]);
}

export function parseStampPlan(raw: string, facts: StampPlanFacts): ParsedStampPlan {
  const preCheck = classifyFastPathCommand(facts.text);
  if (!preCheck.allowed && preCheck.code === "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT") {
    return {
      steps: [],
      dropped: [],
      refused: [],
      guardRejected: {
        code: preCheck.code,
        matchedCategory: preCheck.matchedCategory ?? "퀘스트·이벤트·대화 만들기",
        guidance: preCheck.guidance ?? FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
      },
    };
  }
  const parsed = extractJsonObject(raw);
  if (isRecord(parsed) && parsed.reject === "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT") {
    return {
      steps: [],
      dropped: [],
      refused: [],
      guardRejected: {
        code: "FAST_PATH_UNSUPPORTED_QUEST_OR_EVENT",
        matchedCategory: stringArg(parsed.reason) ?? "퀘스트·이벤트·대화 만들기",
        guidance: FAST_PATH_QUEST_OR_EVENT_GUIDANCE,
      },
    };
  }
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
  // 장면 구성기가 맵을 통째로 짜면(크기도 바꿀 수 있다) 같은 계획의 좌표 단계는 옛 맵 좌표다 — 장면 하나와 좌표 없는 단계만 남긴다.
  const sceneStep = steps.find((step) => step.tool === "compose_scene");
  if (sceneStep) {
    const companions = steps.filter((step) => step !== sceneStep && SCENE_COMPANION_TOOLS[step.tool] === true);
    const cut = steps.filter((step) => step !== sceneStep && SCENE_COMPANION_TOOLS[step.tool] !== true);
    if (cut.length > 0) dropped.push(`장면 구성기가 맵 전체를 짜므로 좌표 단계 ${cut.length}개(${[...new Set(cut.map((step) => TOOL_KO[step.tool]))].join("·")})는 깔지 않음`);
    return { steps: [sceneStep, ...companions], dropped, refused };
  }
  const afterHouses = houseInsteadOfWalls(steps, facts, dropped);
  const afterDungeon = dungeonInsteadOfWalls(afterHouses, facts);
  const finalSteps = upgradeDirectSpatialOps(afterDungeon, facts, preCheck, dropped);
  if (finalSteps.length === 0 && dropped.length === 0 && refused.length === 0 && houseAsk && facts.houseLooks === 0) {
    dropped.push(`집: 이 타일셋(${facts.tilesetId ?? "현재 타일셋"})에는 집 외관이 없습니다(벽·문·바닥으로 흉내 내지 않음)`);
  }
  const needsFollowUp = isRecord(parsed) && parsed.needsFollowUp === true;
  const remainingGoals = isRecord(parsed) && Array.isArray(parsed.remainingGoals)
    ? parsed.remainingGoals.map(stringArg).filter((g): g is string => Boolean(g))
    : undefined;
  return {
    steps: finalSteps,
    dropped,
    refused,
    ...(needsFollowUp ? { needsFollowUp: true } : {}),
    ...(remainingGoals && remainingGoals.length > 0 ? { remainingGoals } : {}),
  };
}

const EXTENDED_TOOL_MATCHERS: readonly { readonly tool: StampTool; readonly re: RegExp; readonly defaultArgs?: Record<string, unknown> }[] = [
  { tool: "carve_waterfall_pond", re: /폭포|폭포수(?:와\s*연못)?|절벽\s*폭포/u },
  { tool: "carve_lake_island", re: /호수\s*(?:위\s*)?(?:작은\s*)?섬|섬이?\s*있는\s*호수|호수\s*한가운데\s*(?:섬|사당|정자)/u },
  { tool: "place_bridge", re: /(?:돌다리|나무\s*다리|널다리|아치\s*다리|수문\s*다리|다리)(?:를|을|로|으로)?\s*(?:놓|깔|세우|세워|만들|연결|건너|잇|이어)/u },
  { tool: "retheme_season_biome", re: /(?:겨울\s*설원|설원\s*눈|눈\s*덮인|가을\s*단풍|고대\s*폐허|폐허\s*유적|화산\s*용암|용암\s*지대)(?:으로|로)?\s*(?:바꿔|리테마|꾸며|만들|변환|테마)/u },
  { tool: "build_market_bazaar", re: /(?:장터|시장\s*광장|바자회|노점\s*거리|노점상\s*광장)(?:을|를|도|이|가)?\s*(?:만들|열|세우|세워|깔|조성)/u },
  { tool: "build_harbor_dock", re: /(?:항구\s*부두|선착장|부두(?:와|랑)?\s*(?:배|어선|잔교)|잔교(?:와|랑)?\s*배|항구\s*선착장)(?:을|를|도)?\s*(?:만들|세우|세워|깔|조성)/u },
  { tool: "build_farm_ranch", re: /(?:농장|목장|울타리\s*농장|경작지\s*농장|밭과\s*(?:헛간|양|목장))(?:을|를|도)?\s*(?:만들|세우|세워|깔|일구|조성)/u },
  { tool: "build_rail_crossing", re: /(?:철길|기찻길|철도\s*선로|광산\s*선로|철도\s*건널목|건널목과\s*간이역)(?:을|를|도)?\s*(?:만들|깔|세우|세워|놓|연결)/u },
  { tool: "place_inn", re: /(?:여관(?:과|이랑|하고)?\s*(?:숙박|여관\s*주인|회복)?|숙박\s*여관)(?:을|를|도)?\s*(?:만들|세우|세워|짓|지어|깔)/u },
  { tool: "place_church_healer", re: /(?:성당|예배당|교회|치유\s*성소|힐러\s*사제|치유\s*사제)(?:과|와|이랑|하고|\s)*(?:치유\s*사제|신부님|힐러|사제|세이브)?(?:을|를|도)?\s*(?:만들|세우|세워|짓|지어|깔|배치)/u },
  { tool: "place_guild_board", re: /(?:모험가\s*길드|길드\s*게시판|의뢰\s*게시판|현상금\s*게시판)(?:을|를|과|와|도)?\s*(?:만들|세우|세워|깔|놓|배치)/u },
  { tool: "place_travel_portal", re: /(?:역마차\s*정류장|역마차와\s*마부|전이\s*마법진|순간이동\s*마법진|이동\s*포탈)(?:을|를|도)?\s*(?:만들|세우|세워|깔|놓|배치)/u },
  { tool: "place_roaming_enemies", re: /(?:돌아다니는|배회하는|추격하는|필드|심볼\s*인카운터)\s*(?:몬스터|적|슬라임|고블린|늑대)/u },
  { tool: "place_switch_and_gate", re: /(?:레버|스위치)(?:와|과|랑|하고|\s)+(?:열리는\s*|연동\s*)?(?:철문|강철\s*성문|성문|창살문|문)/u },
  { tool: "place_camp_rest", re: /(?:야영지|캠프파이어|모닥불\s*쉼터|야영\s*천막과\s*모닥불|모닥불\s*야영지)(?:을|를|도)?\s*(?:만들|세우|세워|깔|놓|펴)/u },
  { tool: "place_mimic_and_sparkles", re: /(?:미믹\s*상자|미믹(?:과|와|이랑)?\s*반짝이|반짝이는\s*(?:바닥\s*)?(?:유실물|아이템))/u },
  { tool: "repeat_line_or_grid", re: /(?:일렬로|줄지어|격자로|바둑판으로|나란히\s*반복|간격으로\s*반복)(?:해서)?\s*(?:깔|놓|세우|세워|배치)|(?:가로등|기둥|석상|벤치|나무|깃발)(?:을|를)\s*(?:일렬로|격자로|줄지어)/u },
  { tool: "mirror_region", re: /(?:좌우\s*대칭|상하\s*대칭|거울\s*대칭|반대편에\s*대칭)(?:으로)?\s*(?:복사|미러링|맞춰|만들|배치)/u },
  { tool: "enclose_with_wall", re: /(?:성벽|돌담|담장|울타리|산울타리)(?:으로|로)\s*(?:둘러싸|감싸|포위|두르|둘러)/u },
  { tool: "auto_connect_roads", re: /(?:출입구|문\s*앞|건물\s*문|도로망|길망)(?:을|를|끼리|마다)?\s*(?:길로\s*|도로로\s*)?(?:자동\s*연결|이어|잇고|연결해)/u },
  { tool: "populate_crowd", re: /(?:사람들|주민들|군중|인파)(?:로|으로)?\s*(?:북적이게|가득\s*채워|활기차게|많이\s*배치)|마을\s*군중(?:을|를)?\s*(?:배치|만들|깔)/u },
  { tool: "set_mood_weather", re: /(?:석양|노을|야경|밤하늘|새벽\s*안개|비\s*내리는\s*밤|눈\s*내리는\s*밤|조명과\s*날씨)(?:으로|로)?\s*(?:분위기|조명|날씨|바꿔|연출|맞춰)/u },
];

export function extractCompoundFollowUpGoals(
  text: string,
  turn1Steps: readonly StampStep[],
): { readonly tool: StampTool; readonly label: string }[] {
  const used = new Set<StampTool>(turn1Steps.map((s) => s.tool));
  const matched: { tool: StampTool; label: string }[] = [];
  for (const m of EXTENDED_TOOL_MATCHERS) {
    if (m.re.test(text) && !used.has(m.tool)) {
      matched.push({ tool: m.tool, label: TOOL_KO[m.tool] });
    }
  }
  return matched;
}

export function inferMaxStampLlmTurns(text: string, requestedMaxTurns?: number): 1 | 2 | 3 | 4 {
  if (typeof requestedMaxTurns === "number" && Number.isFinite(requestedMaxTurns)) {
    const clamped = Math.max(1, Math.min(4, Math.round(requestedMaxTurns)));
    return clamped as 1 | 2 | 3 | 4;
  }
  const t = text.trim();
  if (!t) return 2;
  const hasStage1Foundation = /성채|왕성|성곽|요새|폭포|연못|호수|강|돌다리|다리|항구|부두|선착장/u.test(t);
  const hasStage2Town = /여관|성당|예배당|치유\s*사제|상점|무기점|물약\s*상점|길드|의뢰\s*게시판|장터|바자회|농장|목장|도로망|자동\s*연결/u.test(t);
  const hasStage3Dungeon = /던전|폐허|성벽으로\s*둘러|담장|포위|레버|강철\s*성문|철문|배회하는\s*몬스터|심볼\s*몬스터|몬스터|야영지|캠프파이어|미믹|반짝이|보물상자/u.test(t);
  const hasStage4Living = /역마차|마법진|포탈|군중|인파|북적이게|일렬로|대칭|석양|노을|야경|새벽|조명|날씨/u.test(t);
  const stageCount = Number(hasStage1Foundation) + Number(hasStage2Town) + Number(hasStage3Dungeon) + Number(hasStage4Living);
  let matchedTools = 0;
  for (const m of EXTENDED_TOOL_MATCHERS) {
    if (m.re.test(t)) matchedTools++;
  }
  if (/4\s*턴|4\s*단계|월드빌딩|지역\s*전체\s*시공/u.test(t) || stageCount >= 4 || matchedTools >= 7) return 4;
  if (/3\s*턴|3\s*단계/u.test(t) || stageCount === 3 || matchedTools >= 5) return 3;
  return 2;
}

export function shouldRunStampTurn2(
  facts: StampPlanFacts,
  turn1Steps: readonly StampStep[],
  observation: StampTurnObservation,
  explicitNeedsFollowUp = false,
): boolean {
  if (!facts.text || turn1Steps.length === 0) return false;
  if (turn1Steps.some((s) => s.tool === "compose_scene")) return false;
  if (explicitNeedsFollowUp) return true;
  return observation.remainingGoals.length > 0;
}

export function buildStampTurn2Prompt(input: StampPlannerFollowUpInput): string {
  const turn = input.turn ?? 2;
  const maxTurns = input.maxTurns ?? 2;
  const prior = input.priorSteps ?? input.turn1Steps;
  return JSON.stringify({
    turn,
    maxTurns,
    instruction: `Turn ${turn - 1} construction has been applied on the draft map. Inspect observation (placedStructures, doorCells, waterCells, roadCells, eventsCreated, switchesWired, remainingGoals) and emit ONLY the next stage steps (up to 6 steps) needed to progress or complete the user's RPG worldbuilding sentence, or {"steps":[]} if everything is already complete.`,
    sentence: input.facts.text,
    target: input.facts.target,
    turn1AppliedTools: prior.map((s) => ({ tool: s.tool, label: s.label })),
    observation: input.observation,
  });
}

export function planStampFollowUpFallback(input: StampPlannerFollowUpInput): StampStep[] {
  const out: StampStep[] = [];
  const prior = input.priorSteps ?? input.turn1Steps;
  const used = new Set<StampTool>(prior.map((s) => s.tool));
  for (const m of EXTENDED_TOOL_MATCHERS) {
    if (used.has(m.tool)) continue;
    if (m.re.test(input.facts.text) || input.observation.remainingGoals.some((g) => g.includes(m.tool) || m.re.test(g))) {
      const check = validateStampStep({ tool: m.tool, args: { area: input.facts.target } }, input.facts);
      if ("step" in check) {
        out.push(check.step);
        used.add(m.tool);
      }
    }
  }
  return out;
}

function upgradeDirectSpatialOps(
  steps: readonly StampStep[],
  facts: StampPlanFacts,
  classification: FastPathCommandClassification,
  dropped: string[],
): StampStep[] {
  if (classification.op === "erase") {
    if (steps.some((step) => step.tool === "erase_object" || step.tool === "remove_event" || step.tool === "set_street_traffic")) {
      return [...steps];
    }
    const noun = extractEraseTargetNoun(facts.text);
    const region = extractSpatialZonePhrase(facts.text);
    // 문장이 특정 물체·나무·분수대·집을 지우라고 말했는데 모델이 맵 전체 tile_erase 나 빈 단계를 냈으면 erase_object 로 승격한다.
    if (noun) {
      const check = validateStampStep(
        { tool: "erase_object", args: { query: noun, ...(region ? { region } : {}) }, label: `${region ? `${region} ` : ""}${noun} 지우기` },
        facts,
      );
      if ("step" in check) {
        dropped.length = 0;
        return [check.step];
      }
    }
  }
  if (classification.op === "move") {
    if (steps.some((step) => step.tool === "move_object" || step.tool === "move_event" || step.tool === "move_region")) {
      return [...steps];
    }
    const noun = extractMoveTargetNoun(facts.text) ?? "선택 물체";
    const check = validateStampStep(
      { tool: "move_object", args: { query: noun }, label: `${noun} 옮기기` },
      facts,
    );
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 확장 22종 도구(지형·도하·지구·시설·기믹·스마트 배치·군중/날씨) 결정론 폴백 매칭:
  // 모델이 빈 steps 를 반환했거나 일반 타일 칠하기만 냈을 때 확장 도구로 승격한다.
  if (steps.length === 0) {
    const matchedExtended: StampStep[] = [];
    for (const m of EXTENDED_TOOL_MATCHERS) {
      if (m.re.test(facts.text)) {
        const check = validateStampStep({ tool: m.tool, args: { area: facts.target, ...(m.defaultArgs ?? {}) } }, facts);
        if ("step" in check) matchedExtended.push(check.step);
      }
    }
    if (matchedExtended.length > 0) {
      dropped.length = 0;
      return matchedExtended.slice(0, STAMP_MAX_STEPS);
    }
  }
  if (steps.length > 0) {
    return [...steps];
  }
  // 간단한 상점·물약 상점·무기 상점·잡화점과 상인 NPC
  if (
    /(?:간단한\s*)?(?:물약|포션|약초|무기|방어구|도구|잡화)?\s*(?:상점|가게|잡화점|무기점|방어구점|도구점|약국|노점|좌판)(?:과\s*상인(?:\s*NPC)?|이랑\s*상인(?:\s*NPC)?|\s*NPC)?(?:을|를|도|이|가)?\s*(?:하나\s*)?(?:만들|세우|세워|짓|지어|차리|차려|깔|놓|추가)/iu.test(facts.text)
    && !steps.some((step) => step.tool === "place_shop")
  ) {
    const check = validateStampStep({ tool: "place_shop", args: { area: facts.target } }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 간단한 NPC·경비병·산책하는 주민 생성
  if (
    /(?:간단한\s*)?(?:마을\s*)?(?:경비병|문지기|병사|산책하는\s*주민|주민|마을\s*사람|NPC)(?:과|와|이랑|하고|\s|,)*(?:산책하는\s*주민|주민|대사도|대사|NPC)?(?:을|를|도|이|가)?\s*(?:만들|세우|세워|깔|놓|추가|배치)/iu.test(facts.text)
    && !steps.some((step) => step.tool === "place_npc" || step.tool === "make_villager" || step.tool === "place_shop")
  ) {
    const wantsGuard = /경비|문지기|병사|보초|guard|soldier/iu.test(facts.text);
    const wantsStroller = /산책|배회|주민|마을\s*사람/u.test(facts.text);
    const npcSteps: StampStep[] = [];
    const cx = facts.target.x + Math.floor(facts.target.w / 2);
    const cy = facts.target.y + Math.floor(facts.target.h / 2);
    if (wantsGuard && wantsStroller) {
      const gCheck = validateStampStep({
        tool: "place_npc",
        label: "마을 경비병 NPC",
        args: {
          at: { x: Math.max(facts.target.x, cx - 2), y: cy },
          name: "마을 경비병",
          role: "guard",
          movement: "fixed",
          lines: [
            "마을 경비병: 이상 무! 오늘도 버들항 거리는 평화롭습니다.",
            "마을 경비병: 성문과 광장 주변을 순찰 중이니 안심하고 다니시오.",
          ],
        },
      }, facts);
      const vCheck = validateStampStep({
        tool: "place_npc",
        label: "산책하는 주민 NPC",
        args: {
          at: { x: Math.min(facts.target.x + facts.target.w - 1, cx + 2), y: cy },
          name: "산책하는 주민",
          role: "villager",
          movement: "random",
          lines: [
            "산책하는 주민: 바람이 선선해서 마을 산책하기 참 좋은 날이네요.",
            "산책하는 주민: 새로 문을 연 상점 쪽에서 향긋한 약초 냄새가 나더라고요.",
          ],
        },
      }, facts);
      if ("step" in gCheck) npcSteps.push(gCheck.step);
      if ("step" in vCheck) npcSteps.push(vCheck.step);
    } else if (wantsGuard) {
      const gCheck = validateStampStep({
        tool: "place_npc",
        label: "마을 경비병 NPC",
        args: {
          at: { x: cx, y: cy },
          name: "마을 경비병",
          role: "guard",
          movement: "fixed",
          lines: [
            "마을 경비병: 이상 무! 오늘도 마을은 평화롭습니다.",
            "마을 경비병: 길을 잃으셨다면 큰길을 따라 광장으로 가 보십시오.",
          ],
        },
      }, facts);
      if ("step" in gCheck) npcSteps.push(gCheck.step);
    } else {
      const vCheck = validateStampStep({
        tool: "place_npc",
        label: "마을 주민 NPC",
        args: {
          at: { x: cx, y: cy },
          name: "마을 주민",
          role: "villager",
          movement: "random",
          lines: [
            "마을 주민: 어서 오세요! 우리 마을에 오신 걸 환영합니다.",
            "마을 주민: 날씨가 참 좋지요? 천천히 둘러보고 가세요.",
          ],
        },
      }, facts);
      if ("step" in vCheck) npcSteps.push(vCheck.step);
    }
    if (npcSteps.length > 0) {
      dropped.length = 0;
      return npcSteps;
    }
  }
  // 맥락 맞춤 조경("주변과 어울리게 해줘")
  if (
    /주변(?:과|이랑|하고|에|풍경에)?\s*(?:자연스럽게\s*)?(?:어울리|어우러지|맞추|맞게|조화)|풍경에\s*맞게\s*(?:자연스럽게\s*)?(?:꾸며|꾸미|채워)|맥락에\s*맞게/u.test(facts.text)
    && !steps.some((step) => step.tool === "harmonize_region")
  ) {
    const check = validateStampStep({ tool: "harmonize_region", args: { area: facts.target }, label: "주변 바이옴 맞춤 자동 조경" }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 시체들·백골 유해·전투 흔적
  if (
    /(?:시체|시체들|백골|유골|전사자\s*유해|백골\s*유해|사체|주검|유해|해골\s*더미|뼈\s*더미)/u.test(facts.text)
    && !steps.some((step) => step.tool === "place_corpses")
  ) {
    const check = validateStampStep({ tool: "place_corpses", args: { area: facts.target } }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 성·성채·요새·성벽과 성문
  if (
    /(?:성채|성곽|요새|성벽(?:과|와|이랑)?\s*성문|성문(?:과|와|이랑)?\s*성벽|망루(?:와|과)?\s*성벽|성벽을?\s*세우|성채를?\s*(?:지|세우|깔|만들)|성을?\s*(?:지|세우|깔|만들)|성채와\s*성문)/u.test(facts.text)
    && !steps.some((step) => step.tool === "place_castle")
  ) {
    const check = validateStampStep({ tool: "place_castle", args: { area: facts.target } }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 언덕·고지·절벽 단차
  if (
    /(?:언덕|구릉|고지|절벽\s*단차|계단식\s*언덕|높은\s*단)(?:을|를|이|가|과|와)?\s*(?:계단(?:과|이랑)?\s*)?(?:만들|깔|올리|올려|세우|세워|빚|쌓|놓|추가)|(?:\d+\s*단\s*언덕)/u.test(facts.text)
    && !steps.some((step) => step.tool === "sculpt_hill")
  ) {
    const check = validateStampStep({ tool: "sculpt_hill", args: { area: facts.target } }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  // 강·개울·물줄기("강 깔아줘", "가로로 강 흐르게 해줘") — 마을 전체 구성(강가 마을)은 제외
  if (
    /(?:강|강물|강줄기|개울|시내|물줄기|운하|하천)(?:을|를|이|가|과|와)?\s*(?:다리(?:와|랑)?\s*)?(?:깔|만들|흐르|내|파|놓|그려|추가)|(?:가로|세로|동서|남북)(?:로|으로)?\s*강/u.test(facts.text)
    && !/강가\s*마을|강변\s*산책로\s*거리/u.test(facts.text)
    && !steps.some((step) => step.tool === "carve_river")
  ) {
    const check = validateStampStep({ tool: "carve_river", args: { area: facts.target } }, facts);
    if ("step" in check) {
      dropped.length = 0;
      return [check.step];
    }
  }
  return [...steps];
}

/** 장면 구성 뒤에 같이 둘 수 있는 좌표 없는 단계. */
const SCENE_COMPANION_TOOLS: Partial<Record<StampTool, true>> = { set_scene_mood: true, set_street_traffic: true };
