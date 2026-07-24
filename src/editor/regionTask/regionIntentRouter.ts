// 영역 작업 지시의 의도를 키워드로 감지해 카테고리별 도구 가이드를 주입한다(스펙 §3-A).
// LLM 불사용 — assistantToolMode.INTENT_KEYWORDS(도구 노출 도메인)와 별개로,
// 여기서는 "가이드 문장"을 고른다. 도구 노출 자체는 tile/event/map 도메인이 이미
// footer("[컨텍스트] 현재 맵:"의 "맵")·기본 domainSeed·가이드 문구의 키워드로 자연히
// 열리고, 상한(40) 슬라이스에 밀리는 핵심 도구는 toolRegistry.PINNED_TOOLS_BY_DOMAIN이
// 보장한다(2026-07-10 라이브 실측 수정 — 카테고리별 "도메인 시드" 병합은 A/B 실측상 아무
// 효과가 없는 죽은 복잡도로 판정돼 제거했다).

export type RegionIntentCategory =
  | "interior"
  | "structure"
  | "npc-shop"
  | "door-transfer"
  | "quest-trigger"
  | "battle-trap"
  | "mood"
  | "transform";

export const REGION_INTENT_KEYWORDS: Readonly<Record<RegionIntentCategory, readonly string[]>> = {
  // 실내/방 맵 — 야외 build_house_kit 과 충돌하므로 structure보다 우선·배타.
  interior: [
    "실내", "인테리어", "실내맵", "실내 맵", "방 맵", "방맵",
    "침실", "서재", "주방", "창고", "선술집", "interior",
  ],
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
    "연출", "트리거", "플래그", "스위치", "회상", "갤러리", "미술관", "투더문",
    // bare "상자"/"박스"는 장식 소품(place_props wood-box)과 혼동 — 보물·개봉 맥락만 라우팅.
    "보물상자", "보물 상자", "보물", "열쇠", "잠긴", "잠금", "상자를 열", "상자 열",
    "세이브", "저장", "우물",
  ],
  "battle-trap": ["몬스터", "전투", "인카운터", "함정", "추격", "쫓아", "슬라임", "유령", "트랩", "즉사", "마녀", "저택"],
  mood: ["조명", "분위기", "어둡", "음산", "축제", "등불", "밤에", "밤이", "밤을", "밤 ", "화려", "을씨년"],
  transform: ["대칭", "반복", "복제", "옮겨", "옮기", "지워", "지우", "비우", "미러", "뒤집"],
};

const GUIDE_LINES: Readonly<Record<RegionIntentCategory, string>> = {
  interior:
    "- 실내: 현재 맵/선택 영역에 야외 집을 짓지 마세요. "
    + "start_interior_room_session으로 **새 mapId·요청 이름** 실내 맵을 시공 "
    + "(rooms[] 역할 테마 bedroom|study|dining|kitchen|storage|tavern|corridor, door, wallMaterial) → "
    + "advance_interior_room_build 반복 → evaluate_interior_room. create_map만 하고 멈추지 마세요.",
  structure:
    // stamp_structure는 v1→v2(tile_structure)→v3(build_wall) 폐기 체인이라 LLM에 노출되지 않는다
    // (2026-07-10 라이브 실측 수정) — 탑 등 구조물도 build_wall로 안내한다.
    "- 구조물(야외): author_house(집·여관·대장간 외장), build_wall+fill_region(울타리·안뜰·광장 바닥, 탑 등 구조물), create_farm_plot(밭). 실내/방 맵 요청에는 쓰지 말 것",
  "npc-shop":
    "- NPC: place_npc/make_villager(주민·경비·상인 — graphic은 query로 외형 지정), set_npc_schedule(순찰·시간표), set_shop_stock(상인 재고 연결)",
  "door-transfer":
    "- 문/이동: create_transfer_pair {a:{mapId,x,y}, b:{mapId,x,y}} — 문·계단·텔레포트 왕복 쌍을 한 번에. 문 시각 배치는 place_door",
  "quest-trigger":
    "- 상호작용: place_chest(보물상자 — contents.itemId/gold 지급, 개봉 기억), place_storage_chest(보관 상자 — openChest 입출고), place_savepoint(세이브 포인트), place_examine_hotspots(조사 지점) 또는 make_gallery_room(이브 갤러리 원큐), create_quest/declare_story_flag(퀘스트·플래그), script_cutscene 또는 script_cutscene_preset(투더문 회상/엔딩). 보물상자·세이브포인트는 반드시 place_chest/place_savepoint — place_npc/upsert_event 흉내 금지. 장식 박스·나무상자는 place_chest 금지(place_props wood-box).",
  "battle-trap":
    "- 전투/호러: set_encounter_table/make_hunting_ground(인카운터 구역), place_battle_blocker(지키는 몬스터), place_trap(함정) 또는 make_horror_loop(트랩+체크포인트+추격 원큐), make_chase_scene(추격전)",
  mood:
    "- 분위기: set_scene_mood(어둡게·축제 등 프리셋), set_lighting_volume(영역 조명), 등불·장식 소품은 place_props. 호러 슬라이스는 make_horror_loop/make_gallery_room과 함께 사용",
  transform:
    // clear_region은 v1→v2(tile_paint)→v3(tile_erase) 폐기 체인이라 LLM에 노출되지 않는다
    // (2026-07-10 라이브 실측 수정) — 비우기는 tile_erase로 안내한다.
    "- 변형: mirror_region {mapId,x,y,w,h,axis:\"horizontal\"|\"vertical\"}(대칭), tile_erase(비우기), move_event/duplicate_event(이벤트 이동·복제)",
};

const CATEGORY_ORDER: readonly RegionIntentCategory[] = [
  "interior", "structure", "npc-shop", "door-transfer", "quest-trigger", "battle-trap", "mood", "transform",
];

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/**
 * 선택 영역 작업(하드 클립)으로는 이행할 수 없는 요청.
 * 실내 맵·새 맵 생성은 현재 맵 사각형 밖 프로젝트 변경이 본업이라 영역 클립에 담기지 않는다
 * → 채팅 전량 경로로 우회해야 한다(audit 18: create_map 후 "이 영역에서 바뀐 것이 없습니다").
 */
export function isRegionEscapingIntent(instruction: string): boolean {
  const normalized = normalize(instruction);
  if (!normalized) return false;
  if (REGION_INTENT_KEYWORDS.interior.some((keyword) => normalized.includes(keyword))) return true;
  const newMapPatterns = [
    "새 맵", "새로운 맵", "맵을 만들", "맵 생성", "맵을 생성", "맵 하나", "맵을 하나",
    "맵을 새로", "새로 맵", "create map", "new map",
  ];
  return newMapPatterns.some((pattern) => normalized.includes(pattern));
}

export function routeRegionIntent(instruction: string): RegionIntentCategory[] {
  const normalized = normalize(instruction);
  const routed = CATEGORY_ORDER.filter((category) =>
    REGION_INTENT_KEYWORDS[category].some((keyword) => normalized.includes(keyword)),
  );
  // 실내 요청에 "집"이 들어 있어도 야외 build_house_kit 가이드를 붙이지 않는다.
  if (routed.includes("interior")) {
    return routed.filter((category) => category !== "structure");
  }
  return routed;
}

export function regionIntentGuideLines(categories: readonly RegionIntentCategory[]): string[] {
  return CATEGORY_ORDER.filter((category) => categories.includes(category)).map((category) => GUIDE_LINES[category]);
}
