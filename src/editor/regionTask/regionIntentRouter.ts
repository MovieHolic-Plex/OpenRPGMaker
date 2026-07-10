// 영역 작업 지시의 의도를 키워드로 감지해 카테고리별 도구 가이드를 주입한다(스펙 §3-A).
// LLM 불사용 — assistantToolMode.INTENT_KEYWORDS(도구 노출 도메인)와 별개로,
// 여기서는 "가이드 문장"을 고른다.
//
// 주의(2026-07-10 라이브 실측 수정): 가이드가 언급하는 도구가 실제로는 tile/event가 아닌
// map/quest 도메인에 등록된 경우가 있다(mirror_region/clear_region/stamp_structure/
// create_farm_plot/set_encounter_table/make_hunting_ground는 map, create_quest/
// declare_story_flag는 quest — src/editor/tools/toolRegistry.ts의 withDomain 참고).
// buildRegionTaskMessage의 기본 domainSeed("타일 지형 나무 소품 집 npc 이벤트 주민")는
// tile/event만 여는데, 가이드는 그 밖의 도메인 도구도 안내하므로 모델이 가이드를 따르면
// unknown tool이 된다. REGION_INTENT_DOMAIN_SEEDS로 카테고리별 부족분만 보충한다.

export type RegionIntentCategory =
  | "structure"
  | "npc-shop"
  | "door-transfer"
  | "quest-trigger"
  | "battle-trap"
  | "mood"
  | "transform";

export const REGION_INTENT_KEYWORDS: Readonly<Record<RegionIntentCategory, readonly string[]>> = {
  structure: [
    "집을", "집이", "집에", "집은", "집 ", "건물", "오두막", "여관", "성벽",
    "탑을", "탑이", "탑에", "탑은", "탑 ", "대장간", "광장", "울타리", "목장",
    "정원", "분수", "안뜰", "폐허", "폐가", "농장", "밭을", "밭이", "밭에", "밭은", "밭 ",
    "매점", "다리", "시설",
  ],
  "npc-shop": [
    "npc", "주민", "상인", "경비", "손님", "대장장이", "농부", "도적", "사람",
    "순찰", "상점", "재고", "잡화", "주인",
  ],
  "door-transfer": ["입구", "출구", "텔레포트", "포탈", "계단", "다음 맵", "이어지"],
  "quest-trigger": [
    "퀘스트", "조사", "표지판", "제단", "사당", "전설", "이야기", "대화", "컷신",
    "연출", "트리거", "플래그", "스위치", "상자", "보물", "열쇠", "잠긴", "잠금",
    "세이브", "저장", "우물",
  ],
  "battle-trap": ["몬스터", "전투", "인카운터", "함정", "추격", "쫓아", "슬라임", "유령"],
  mood: ["조명", "분위기", "어둡", "음산", "축제", "등불", "밤에", "밤이", "밤을", "밤 ", "화려", "을씨년"],
  transform: ["대칭", "반복", "복제", "옮겨", "옮기", "지워", "지우", "비우", "미러", "뒤집"],
};

const GUIDE_LINES: Readonly<Record<RegionIntentCategory, string>> = {
  structure:
    // stamp_structure는 v1→v2(tile_structure)→v3(build_wall) 폐기 체인이라 LLM에 노출되지 않는다
    // (2026-07-10 라이브 실측 수정) — 탑 등 구조물도 build_wall로 안내한다.
    "- 구조물: build_house_kit(집·여관·대장간 등), build_wall+fill_region(울타리·안뜰·광장 바닥, 탑 등 구조물), create_farm_plot(밭)",
  "npc-shop":
    "- NPC: place_npc/make_villager(주민·경비·상인 — graphic은 query로 외형 지정), set_npc_schedule(순찰·시간표), set_shop_stock(상인 재고 연결)",
  "door-transfer":
    "- 문/이동: create_transfer_pair {a:{mapId,x,y}, b:{mapId,x,y}} — 문·계단·텔레포트 왕복 쌍을 한 번에. 문 시각 배치는 place_door",
  "quest-trigger":
    "- 상호작용: place_chest(보물상자 — contents.itemId/gold 지급, 개봉 기억), place_savepoint(세이브 포인트), place_examine_hotspots(조사 지점), create_quest/declare_story_flag(퀘스트·플래그), script_cutscene(연출·대사). 보물상자·세이브포인트는 반드시 place_chest/place_savepoint를 쓸 것 — place_npc나 upsert_event로 흉내내지 말 것.",
  "battle-trap":
    "- 전투: set_encounter_table/make_hunting_ground(인카운터 구역), place_battle_blocker(지키는 몬스터), place_trap(함정), make_chase_scene(추격전)",
  mood:
    "- 분위기: set_scene_mood(어둡게·축제 등 프리셋), set_lighting_volume(영역 조명), 등불·장식 소품은 place_props",
  transform:
    // clear_region은 v1→v2(tile_paint)→v3(tile_erase) 폐기 체인이라 LLM에 노출되지 않는다
    // (2026-07-10 라이브 실측 수정) — 비우기는 tile_erase로 안내한다.
    "- 변형: mirror_region {mapId,x,y,w,h,axis:\"horizontal\"|\"vertical\"}(대칭), tile_erase(비우기), move_event/duplicate_event(이벤트 이동·복제)",
};

const CATEGORY_ORDER: readonly RegionIntentCategory[] = [
  "structure", "npc-shop", "door-transfer", "quest-trigger", "battle-trap", "mood", "transform",
];

// 카테고리 → 도메인 시드 문자열. 기본 domainSeed가 이미 tile/event를 여므로,
// 그 두 도메인만으로 가이드의 모든 도구가 커버되는 카테고리는 빈 문자열("")이다.
// assistantToolMode.INTENT_KEYWORDS의 strong 키워드를 그대로 재사용해 도메인을 연다.
export const REGION_INTENT_DOMAIN_SEEDS: Readonly<Record<RegionIntentCategory, string>> = {
  // build_house_kit/build_wall+fill_region은 tile(기본 시드로 이미 활성).
  // stamp_structure/create_farm_plot는 map 도메인 — "맵"으로 보충.
  structure: "맵",
  // place_npc/make_villager/set_npc_schedule/set_shop_stock 전부 event(기본 시드로 이미 활성).
  "npc-shop": "",
  // create_transfer_pair는 event, place_door는 tile(둘 다 기본 시드로 이미 활성).
  "door-transfer": "",
  // place_chest/place_savepoint/place_examine_hotspots/script_cutscene은 event(기본 시드로 이미 활성).
  // create_quest/declare_story_flag는 quest 도메인 — "퀘스트"로 보충.
  "quest-trigger": "퀘스트",
  // place_battle_blocker/place_trap/make_chase_scene은 event(기본 시드로 이미 활성).
  // set_encounter_table/make_hunting_ground는 map 도메인 — "맵"으로 보충.
  "battle-trap": "맵",
  // set_lighting_volume/set_scene_mood 전부 event(기본 시드로 이미 활성).
  mood: "",
  // move_event/duplicate_event는 event(기본 시드로 이미 활성).
  // mirror_region/clear_region은 map 도메인 — "맵"으로 보충.
  transform: "맵",
};

/** categories에 필요한 도메인 시드 단어(중복 제거, 등장 순서)를 공백 결합한 문자열로 반환한다. */
export function regionIntentDomainSeed(categories: readonly RegionIntentCategory[]): string {
  const words: string[] = [];
  for (const category of CATEGORY_ORDER) {
    if (!categories.includes(category)) continue;
    const seed = REGION_INTENT_DOMAIN_SEEDS[category];
    if (!seed) continue;
    for (const word of seed.split(/\s+/).filter(Boolean)) {
      if (!words.includes(word)) words.push(word);
    }
  }
  return words.join(" ");
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function routeRegionIntent(instruction: string): RegionIntentCategory[] {
  const normalized = normalize(instruction);
  return CATEGORY_ORDER.filter((category) =>
    REGION_INTENT_KEYWORDS[category].some((keyword) => normalized.includes(keyword)),
  );
}

export function regionIntentGuideLines(categories: readonly RegionIntentCategory[]): string[] {
  return CATEGORY_ORDER.filter((category) => categories.includes(category)).map((category) => GUIDE_LINES[category]);
}
