// 마을 종류 카탈로그(2026-10-22) — 「사이버펑크 마을」「조선 장터 마을」 같은 요청 한 마디를 칩셋 계열 + 시공 도구 + 선택지로 옮기는 한 장의 표.
// 사용자 목표: 조수가 현대·중세·고대·미래 수십 가지 마을을 지을 수 있어야 한다. 시공기는 칩셋마다 이미 있다(버들항 author_beodeul_town,
// 테마 칩셋 compose_*_map, 일본 compose_jp_region, 조선 등록 장소). 빠져 있던 것은 «어느 요청이 어느 시공기·선택지로 가는가»와
// «그림이 없는 종류를 정직하게 말하기»였다. 이 표가 그 둘의 정본이다 — find_village_type 도구·의도 노트(plainTurn)·검수 페이지가 같이 읽는다.
// 상태: ready = 지금 한 번에 지어진다 · partial = 짓되 한 가지가 빠진다(gap 에 적는다) · needs-art = 그 시대 그림이 없다(짓지 말고 말한다).
// 주의: 이 파일의 문장은 모델 지시문에 실린다 — PAW 전용 게이트 낱말(현·대·모·던 이어 쓴 말, 영어 m-o-d-e-r-n)을 문장에 쓰지 않는다(정규식 안은 괜찮다).

export type VillageEra = "ancient" | "medieval" | "eastasia" | "industrial" | "today" | "future" | "fantasy";
export type VillageTypeStatus = "ready" | "partial" | "needs-art";

export interface VillageType {
  readonly id: string;
  readonly ko: string;
  readonly era: VillageEra;
  /** 타일셋 id. needs-art 는 null(가장 가까운 칩셋은 nearest 의 종류로). */
  readonly chipset: string | null;
  readonly status: VillageTypeStatus;
  /** 짓는 순서 한 줄 — 도구 이름과 인자. */
  readonly recipe: string;
  /** 요청 낱말. 가장 길게 맞은 종류가 이긴다. */
  readonly words: RegExp;
  /** 빠진 그림(partial·needs-art). */
  readonly gap?: string;
  /** 그림 묶음 id — 같은 묶음을 그리면 함께 풀리는 종류를 센다(검수 페이지의 그림 우선순위). */
  readonly gapId?: string;
  /** needs-art 일 때 대신 지을 수 있는 가장 가까운 종류 id. */
  readonly nearest?: readonly string[];
}

export const VILLAGE_ERA_LABEL: Record<VillageEra, string> = {
  ancient: "선사·고대",
  medieval: "중세 서양",
  eastasia: "동아시아 옛날",
  industrial: "근대·산업",
  today: "오늘날",
  future: "미래·SF",
  fantasy: "판타지",
};

export const ART_GAPS: Record<string, string> = {
  "beodeul-town-wall": "버들항 성벽·성문·망루(마을을 두르는 벽)",
  "murim-kit": "무림(중국 무협) 칩셋 굽기 — 객잔·문파 산문·수향 다리",
  "post-apoc-kit": "폐허(포스트아포칼립스) 칩셋 — 무너진 건물·녹슨 차·판잣집",
  "underwater-kit": "해저 돔 칩셋 — 유리 돔·산호 바닥·잠수정 부두",
  "elf-tree-kit": "엘프 나무 위 마을 조각 — 큰 나무 줄기 집·흔들다리(버들항 결)",
  "mine-kit": "광산 입구·광차 선로·갱목(버들항 결)",
  "korea-today-kit": "한국 동네 칩셋 — 빌라·골목 상가·한글 간판 없는 가게",
  "american-town-kit": "미국 소도시 칩셋 — 목조 2층집·잔디 앞마당·식당",
  "wizard-village-kit": "마법 마을 거리 조각(호그스미드풍 상점 줄)",
  "dwarf-kit": "드워프 산악 요새 바깥 — 바위 문·용광로 굴뚝",
};

const T = (t: VillageType): VillageType => t;

export const VILLAGE_TYPES: readonly VillageType[] = [
  // ── 선사·고대 ──
  T({ id: "prehistoric-hut-village", ko: "원시 움집 마을", era: "ancient", chipset: "prehistoric", status: "ready",
    recipe: "create_map({tilesetId:\"prehistoric\"}) → compose_prehistoric_map({style:\"village\"})",
    words: /원시\s*(?:마을|부락|부족)|움집|선사\s*(?:시대\s*)?마을|석기\s*(?:시대\s*)?마을|부족\s*마을|stone\s*age\s*village|primitive\s*village/iu }),
  T({ id: "prehistoric-swamp", ko: "늪가 원시 부락", era: "ancient", chipset: "prehistoric", status: "ready",
    recipe: "create_map({tilesetId:\"prehistoric\"}) → compose_prehistoric_map({style:\"swamp\"})",
    words: /(?:원시|선사|석기)\S*\s*(?:늪|습지)|(?:늪|습지)\S*\s*(?:원시|선사)\s*부락/iu }),
  T({ id: "prehistoric-volcano", ko: "화산 골짜기 부족", era: "ancient", chipset: "prehistoric", status: "ready",
    recipe: "create_map({tilesetId:\"prehistoric\"}) → compose_prehistoric_map({style:\"volcano\"})",
    words: /(?:원시|선사|공룡)\S*\s*화산|화산\s*(?:골짜기\s*)?부족/iu }),
  T({ id: "roman-city", ko: "고대 로마 도시", era: "ancient", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"city\"}) — 블록 격자 도시(60×60), 항구는 harbour:true·가로 83 이상",
    words: /로마(?:풍|식)?\s*(?:도시|마을|시가)|고대\s*(?:로마|그리스)|그리스(?:풍)?\s*(?:도시|폴리스)|폴리스|roman\s*(?:city|town)/iu }),
  T({ id: "oasis-village", ko: "사막 오아시스 마을", era: "ancient", chipset: "desert_east", status: "ready",
    recipe: "create_map({tilesetId:\"desert_east\"}) → compose_desert_east_map({kind:\"oasis\"})",
    words: /오아시스|사막\s*(?:마을|촌)|desert\s*village|oasis/iu }),
  T({ id: "bazaar-town", ko: "바자르 교역 도시", era: "ancient", chipset: "desert_east", status: "ready",
    recipe: "create_map({tilesetId:\"desert_east\"}) → compose_desert_east_map({kind:\"bazaar\"})",
    words: /바자르|바자\b|수크|아라비(?:아|안)\S*\s*(?:도시|시장|거리)|사막\s*(?:도시|시장|장터)|bazaar|souk/iu }),
  T({ id: "caravan-stop", ko: "실크로드 대상 역참", era: "ancient", chipset: "desert_east", status: "ready",
    recipe: "create_map({tilesetId:\"desert_east\"}) → compose_desert_east_map({kind:\"caravanserai\"})",
    words: /대상\s*(?:숙소|마을|역참)|카라반|캐러밴|실크\s*로드|비단길|caravan/iu }),
  T({ id: "pyramid-town", ko: "피라미드 아래 고대 이집트 마을", era: "ancient", chipset: "desert_east", status: "ready",
    recipe: "create_map({tilesetId:\"desert_east\"}) → compose_desert_east_map({kind:\"pyramid\"})",
    words: /피라미드|이집트|파라오|스핑크스|pyramid|egypt/iu }),

  // ── 중세 서양(버들항) ──
  T({ id: "fishing-village", ko: "어촌", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"coast\", form:\"street\"})",
    words: /어촌|포구\s*마을|바닷가\s*마을|해안\s*마을|갯마을|fishing\s*village/iu }),
  T({ id: "mountain-village", ko: "산골 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", terrain:\"highland\", form:\"scatter\", roofs:\"log\", forestType:\"conifer\"})",
    words: /산골|산촌|산\s*속\s*마을|산속\s*마을|산비탈\s*마을|고원\s*마을|mountain\s*village/iu }),
  T({ id: "market-village", ko: "장터 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"river\", form:\"plaza\"}) — 광장과 앵커 건물(강을 말하면 water:\"river\")",
    words: /장터\s*마을|장이\s*서는|시장\s*마을|교역\s*(?:마을|도시)|market\s*(?:village|town)/iu }),
  T({ id: "mill-village", ko: "강가 방앗간 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"river\", form:\"riverbank\"})",
    words: /방앗간|물레방아|강가\s*마을|강변\s*마을|나루\s*마을|river\s*(?:side\s*)?village|mill\s*village/iu }),
  T({ id: "forest-village", ko: "숲속 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", woods:\"dense\", form:\"scatter\", roofs:\"moss\", forestType:\"mixed\"})",
    words: /숲\s*속\s*마을|숲속\s*마을|숲\s*마을|숲\s*빈터|forest\s*village/iu }),
  T({ id: "farm-village", ko: "농촌", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"river\", form:\"scatter\", roofs:\"moss\"}) → stamp_object(kit:beodeul_city/bd-farm-barn·bd-farm-fenced-plot) 로 농가 덩이",
    words: /농촌|농가\s*마을|농장\s*마을|시골\s*마을|밭\s*마을|farm(?:ing)?\s*village/iu }),
  T({ id: "snow-village-beodeul", ko: "눈 덮인 중세 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"snow\"}) — 북방·바이킹 낱말이면 snow_north(북방 마을)",
    words: /겨울\s*마을|눈\s*덮인\s*(?:중세|로마풍)?\s*마을|설원\s*마을/iu }),
  T({ id: "swamp-village", ko: "늪 수상 마을", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"swamp\"})",
    words: /늪\s*(?:마을|가\s*마을)|습지\s*마을|수상\s*마을|stilt\s*village|swamp\s*village/iu }),
  T({ id: "harbour-city", ko: "항구 도시", era: "medieval", chipset: "beodeul_city", status: "ready",
    recipe: "author_beodeul_town({theme:\"city\", harbour:true, width:84})",
    words: /항구\s*도시|무역\s*항|port\s*city|harbou?r\s*city/iu }),
  T({ id: "walled-town", ko: "성벽 도시", era: "medieval", chipset: "beodeul_city", status: "partial",
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", form:\"street\", roofs:\"slate\"}) — 성벽은 그리지 말고 「성벽 그림은 아직 없다」고 말한다",
    words: /성벽\s*(?:도시|마을)|성벽으로\s*둘러싼(?:\s*마을)?|성곽\s*(?:도시|마을)|성\s*안\s*마을|성채\s*도시|요새\s*도시|walled\s*(?:town|city|village)/iu,
    gap: "버들항에 마을을 두르는 성벽·성문 그림이 없다", gapId: "beodeul-town-wall" }),
  T({ id: "frontier-fort-village", ko: "국경 요새 마을", era: "medieval", chipset: "beodeul_city", status: "partial",
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", terrain:\"terraces\", form:\"street\", roofs:\"slate\"}) — 성벽·망루는 그리지 말고 「성벽 그림은 아직 없다」고 말한다",
    words: /(?:국경|변경)\s*(?:요새\s*)?마을|요새\s*마을|수비대\s*마을|frontier\s*(?:fort|town)/iu,
    gap: "버들항에 마을을 두르는 성벽·성문·망루 그림이 없다", gapId: "beodeul-town-wall" }),
  T({ id: "monastery-village", ko: "수도원 마을", era: "medieval", chipset: "beodeul_city", status: "partial",
    recipe: "author_beodeul_town({theme:\"river\", water:\"none\", form:\"scatter\", roofs:\"slate\"}) → 빈 마당에 stamp_object({objectId:\"kit:beodeul_city/bd-house-village-church\"})",
    words: /수도원|수도회|교회\s*마을|성당\s*마을|abbey|monastery/iu,
    gap: "수도원 회랑·종탑 단지는 없고 마을 교회 한 채만 있다" }),
  T({ id: "mining-town", ko: "광산촌", era: "medieval", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 광산 입구·광차 그림이 없다. 대신 산골 마을(mountain-village)을 제안한다",
    words: /광산\s*(?:마을|촌|도시)|광산촌|탄광\s*(?:마을|촌)|mining\s*(?:town|village)/iu,
    gap: "광산 입구·광차 선로·갱목 그림이 없다", gapId: "mine-kit", nearest: ["mountain-village"] }),

  // ── 판타지 ──
  T({ id: "sky-island-village", ko: "하늘섬 마을", era: "fantasy", chipset: "sky_island", status: "ready",
    recipe: "create_map({tilesetId:\"sky_island\"}) → compose_sky_island_map({style:\"village\"})",
    words: /하늘\s*섬\s*마을|공중\s*(?:섬\s*)?마을|구름\s*위\s*마을|떠\s*있는\s*(?:섬\s*)?마을|하늘\s*마을|floating\s*village|sky\s*village/iu }),
  T({ id: "pirate-harbour", ko: "해적 항구 마을", era: "fantasy", chipset: "pirate_isles", status: "ready",
    recipe: "create_map({tilesetId:\"pirate_isles\"}) → compose_pirate_isles_map({kind:\"harbor\"})",
    words: /해적\s*(?:항구|마을|소굴|도시)|pirate\s*(?:harbou?r|town|cove)/iu }),
  T({ id: "tropical-beach-village", ko: "열대 섬 해변 마을", era: "fantasy", chipset: "pirate_isles", status: "ready",
    recipe: "create_map({tilesetId:\"pirate_isles\"}) → compose_pirate_isles_map({kind:\"beach\"})",
    words: /열대\s*(?:섬\s*)?마을|야자\s*(?:해변|섬)\s*마을|남국\s*마을|섬\s*해변\s*마을|tropical\s*village/iu }),
  T({ id: "elf-forest-village", ko: "엘프 숲 마을", era: "fantasy", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 나무 위 집 그림이 없다. 대신 숲속 마을(forest-village)을 제안한다",
    words: /엘프\S*\s*(?:숲\s*)?(?:마을|도시|왕국)?|요정\s*마을|elf|elven/iu,
    gap: "나무 줄기 집·흔들다리(나무 위 마을) 그림이 없다", gapId: "elf-tree-kit", nearest: ["forest-village"] }),
  T({ id: "treetop-village", ko: "나무 위 마을", era: "fantasy", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 나무 위 집·흔들다리 그림이 없다. 대신 숲속 마을(forest-village)을 제안한다",
    words: /나무\s*위\s*(?:마을|집)|트리\s*하우스|treetop|tree\s*house/iu,
    gap: "나무 줄기 집·흔들다리(나무 위 마을) 그림이 없다", gapId: "elf-tree-kit", nearest: ["forest-village"] }),
  T({ id: "dwarf-hold", ko: "드워프 산악 마을", era: "fantasy", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 바위 문·용광로 그림이 없다. 대신 산골 마을을 제안한다",
    words: /드워프\S*\s*(?:산악\s*)?(?:마을|요새|도시)?|난쟁이\s*마을|dwarf|dwarven/iu,
    gap: "드워프 바위 문·용광로 굴뚝·광산 입구 그림이 없다", gapId: "dwarf-kit", nearest: ["mountain-village"] }),
  T({ id: "wizard-village", ko: "마법사 마을(호그스미드풍)", era: "fantasy", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 마법 학교 칩셋(wizarding_world)은 공간 13종과 18×14 우체국 골목 예제뿐, 마을 거리 그림이 없다",
    words: /마법\s*(?:사\s*)?마을|호그스미드|마법사의?\s*마을|wizard\s*village|hogsmeade/iu,
    gap: "마법 마을 상점 줄·거리 그림이 없다", gapId: "wizard-village-kit", nearest: ["snow-village-beodeul"] }),

  // ── 동아시아 옛날 ──
  T({ id: "joseon-village", ko: "조선 마을", era: "eastasia", chipset: "joseon_baram", status: "ready",
    recipe: "import_region_reference({id:\"joseon-v20-64x56\"}) — 조선 마을 20호(관아·초가·기와집·강·물레방아)를 맵째 가져와 고친다",
    words: /조선\s*(?:시대\s*)?(?:마을|동네|촌)|한옥\s*마을|사극\s*마을|바람의\s*나라\S*\s*마을|양반\s*마을|초가\s*마을|joseon\s*village/iu }),
  T({ id: "joseon-market", ko: "조선 장터 마을", era: "eastasia", chipset: "joseon_baram", status: "ready",
    recipe: "import_region_reference({id:\"joseon-v20-64x56\"}) → 다리 앞 네거리·관아 앞 흙 마당에 stamp_object({objectId:\"kit:joseon_baram/jb-market_stall\"|\"jb-market_stall_cloth\"|\"jb-market_stall_pots\"}) 로 장터 좌판 4~8개(길 칸은 비운다)",
    words: /조선\s*(?:시대\s*)?(?:장터|시장|저자)(?:\s*마을)?|(?:한옥|사극|양반)\S*\s*장터|장터\s*(?:마을\s*)?\(?조선|오일장|저잣거리/iu }),
  T({ id: "joseon-walled-city", ko: "조선·고구려 성곽 도시", era: "eastasia", chipset: "joseon_baram", status: "ready",
    recipe: "import_region_reference({id:\"gungnae-96x96\"}) — 국내성(성벽·성문·궁·민가)을 맵째 가져온다(원작 규모는 gungnae-full-200x208)",
    words: /국내성|고구려\s*(?:도성|성|도시)|조선\s*(?:성곽|도성|읍성)|읍성|도성\s*마을|한양\s*도성/iu }),
  T({ id: "castle-town-edo", ko: "일본 성하마을", era: "eastasia", chipset: "sengoku_edo", status: "ready",
    recipe: "create_map({tilesetId:\"sengoku_edo\"}) → compose_sengoku_edo_map({style:\"castle_town\"})",
    words: /성하\s*마을|조카마치|전국\s*시대\s*(?:마을|도시)|사무라이\s*마을|castle\s*town/iu }),
  T({ id: "edo-inn-street", ko: "에도 여관 거리", era: "eastasia", chipset: "sengoku_edo", status: "ready",
    recipe: "create_map({tilesetId:\"sengoku_edo\"}) → compose_sengoku_edo_map({style:\"inn_street\"})",
    words: /에도\s*(?:시대\s*)?(?:거리|마을|여관)|역참\s*마을|숙장\s*마을|가도\s*마을|post\s*town/iu }),
  T({ id: "edo-farm-village", ko: "에도 농촌", era: "eastasia", chipset: "sengoku_edo", status: "ready",
    recipe: "create_map({tilesetId:\"sengoku_edo\"}) → compose_sengoku_edo_map({style:\"village\"})",
    words: /일본\s*전통\s*(?:마을|농촌)|에도\s*농촌|전국\s*농촌|옛\s*일본\s*마을/iu }),
  T({ id: "temple-gate-town", ko: "신사·절 문전 마을", era: "eastasia", chipset: "sengoku_edo", status: "ready",
    recipe: "create_map({tilesetId:\"sengoku_edo\"}) → compose_sengoku_edo_map({style:\"temple\"})",
    words: /문전\s*마을|몬젠마치|(?:옛|전통)\s*신사\s*마을|절\s*앞\s*마을/iu }),
  T({ id: "jiangnan-water-town", ko: "중국 강남 수향", era: "eastasia", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 중국풍 칩셋(무림)이 아직 번들에 없다",
    words: /강남\s*수향|수향\s*마을|중국\s*(?:옛\s*|전통\s*)?(?:마을|도시|수향)|water\s*town/iu,
    gap: "무림(중국 무협) 칩셋이 번들에 없다(하네스 후보 단계)", gapId: "murim-kit", nearest: ["joseon-village"] }),
  T({ id: "murim-sect-gate", ko: "무림 문파 산문 마을", era: "eastasia", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 문파 산문·도장 그림이 아직 번들에 없다",
    words: /문파\s*(?:마을|산문)|산문\s*마을|소림사|무당파|화산파/iu,
    gap: "무림(중국 무협) 칩셋이 번들에 없다(하네스 후보 단계)", gapId: "murim-kit", nearest: ["temple-gate-town"] }),
  T({ id: "murim-inn-town", ko: "무림 객잔 마을", era: "eastasia", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 무림 칩셋은 아직 번들에 굽지 않았다. 가장 가까운 것은 조선 마을(joseon-village)이지만 중국풍이 아니다",
    words: /무림\S*\s*(?:객잔\s*)?(?:마을)?|무협\S*\s*(?:마을)?|객잔\s*마을|강호|wuxia/iu,
    gap: "무림(중국 무협) 칩셋이 번들에 없다(하네스 후보 단계)", gapId: "murim-kit", nearest: ["joseon-village"] }),

  // ── 근대·산업 ──
  T({ id: "steampunk-factory-town", ko: "스팀펑크 공장 도시", era: "industrial", chipset: "steampunk_city", status: "ready",
    recipe: "create_map({tilesetId:\"steampunk_city\"}) → compose_steampunk_city_map({style:\"industrial\"})",
    words: /공장\s*(?:도시|마을|지대)|산업\s*(?:혁명\s*)?도시|공업\s*도시|증기\s*(?:도시|마을)|스팀\s*펑크\s*(?:마을|도시)|steampunk\s*(?:town|city)/iu }),
  T({ id: "steampunk-street", ko: "빅토리아풍 증기 거리", era: "industrial", chipset: "steampunk_city", status: "ready",
    recipe: "create_map({tilesetId:\"steampunk_city\"}) → compose_steampunk_city_map({style:\"street\"})",
    words: /빅토리아\s*(?:풍|시대)\s*(?:거리|마을|도시)|증기\s*거리|스팀\s*펑크\s*거리|victorian\s*(?:street|town)/iu }),
  T({ id: "steampunk-dock", ko: "운하 부두 마을", era: "industrial", chipset: "steampunk_city", status: "ready",
    recipe: "create_map({tilesetId:\"steampunk_city\"}) → compose_steampunk_city_map({style:\"dock\"})",
    words: /운하\s*(?:부두|마을)|증기\s*(?:항구|부두)|스팀\s*펑크\s*(?:항구|부두)/iu }),

  // ── 오늘날 ──
  T({ id: "jp-residential", ko: "일본 주택가", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\", width:50, height:36}) → compose_jp_city_street({style:\"residential\"})",
    words: /(?:일본\s*)?주택가|동네\s*거리|조용한\s*동네|residential\s*(?:area|street)/iu }),
  T({ id: "jp-shopping-street", ko: "상점가", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\", width:50, height:36}) → compose_jp_city_street({style:\"shopping\"})",
    words: /상점가|상가\s*거리|번화가|쇼핑\s*거리|편의점\s*거리|shopping\s*street/iu }),
  T({ id: "jp-rice-village", ko: "시골 마을(다랑논)", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"terraced_rice_village\"})",
    words: /다랑논|계단\s*논|논\s*마을|일본\s*시골(?:\s*마을)?|inaka|rice\s*village/iu }),
  T({ id: "jp-fishing-harbour", ko: "어항 마을", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"fishing_harbor_market\"})",
    words: /어항|수산\s*시장|일본\s*(?:어촌|항구\s*마을)|fishing\s*harbou?r/iu }),
  T({ id: "jp-onsen-town", ko: "온천 마을", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"onsen_ryokan_town\"})",
    words: /온천\s*(?:마을|거리|가)|료칸\s*거리|onsen/iu }),
  T({ id: "seaside-resort", ko: "해안 관광지", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"coastal_seaside_road\"})",
    words: /해안\s*(?:관광지|도로|휴양지)|해변\s*(?:관광|휴양|마을)|바닷가\s*관광|휴양지|seaside\s*(?:resort|town)/iu }),
  T({ id: "new-town-danchi", ko: "신도시 아파트 단지", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"danchi_complex\"})",
    words: /신도시|아파트\s*단지|단치|주공\s*아파트|new\s*town|housing\s*estate/iu }),
  T({ id: "university-town", ko: "대학가", era: "today", chipset: "jp_city", status: "ready",
    recipe: "create_map({tilesetId:\"jp_city\"}) → compose_jp_region({region:\"university_avenue\"}) — 교정 안이면 modern_campus 의 compose_campus_grounds({style:\"university\"})",
    words: /대학가|대학\s*(?:거리|앞\s*거리|동네)|college\s*town|university\s*(?:avenue|town)/iu }),
  T({ id: "tokyo-downtown", ko: "도쿄풍 도심 거리", era: "today", chipset: "modern_city", status: "ready",
    recipe: "create_map({tilesetId:\"modern_city\", width:60, height:48}) → compose_modern_city_street({shops:[…]})",
    words: /도쿄|빌딩\s*숲|오피스\s*거리|tokyo/iu }),
  T({ id: "korea-neighbourhood", ko: "한국 동네(빌라·골목)", era: "today", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 한국 동네 칩셋이 없다. 가장 가까운 것은 일본 주택가(jp-residential)지만 집 모양이 일본식이다",
    words: /한국\s*(?:동네|마을|골목|주택가)|서울\s*(?:동네|골목)|빌라\s*(?:촌|골목)|달동네|korean\s*(?:town|neighbou?rhood)/iu,
    gap: "한국 동네(빌라·골목 상가) 칩셋이 없다", gapId: "korea-today-kit", nearest: ["jp-residential"] }),
  T({ id: "korea-countryside", ko: "한국 시골 마을(오늘날)", era: "today", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 한국 시골(슬레이트 지붕 농가·비닐하우스·마을회관) 그림이 없다. 옛 한국 마을이면 조선 마을(joseon-village)",
    words: /한국\s*(?:시골|농촌)(?:\s*마을)?|우리\s*시골|마을\s*회관|비닐\s*하우스\s*마을/iu,
    gap: "한국 동네(빌라·골목 상가)·시골 칩셋이 없다", gapId: "korea-today-kit", nearest: ["joseon-village", "jp-rice-village"] }),
  T({ id: "american-small-town", ko: "미국 소도시", era: "today", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 미국 소도시 칩셋이 없다. 가장 가까운 것은 도쿄풍 도심(tokyo-downtown)",
    words: /미국\s*(?:소도시|마을|시골|교외)|아메리칸\s*(?:타운|마을)|교외\s*주택가|american\s*(?:town|suburb)|small\s*town\s*america/iu,
    gap: "미국 소도시(목조 2층집·앞마당·식당) 칩셋이 없다", gapId: "american-town-kit", nearest: ["tokyo-downtown"] }),

  // ── 미래·SF ──
  T({ id: "cyberpunk-street", ko: "사이버펑크 네온 거리", era: "future", chipset: "sf_station", status: "ready",
    recipe: "create_map({tilesetId:\"sf_station\", width:48, height:30}) → compose_sf_station_map({kind:\"street\"})",
    words: /사이버\s*펑크|네온\s*(?:거리|도시|마을|골목)|미래\s*(?:도시|거리|마을)|cyberpunk|neon\s*(?:street|city)/iu }),
  T({ id: "moon-colony", ko: "달·행성 정착지", era: "future", chipset: "sf_station", status: "ready",
    recipe: "create_map({tilesetId:\"sf_station\", width:48, height:32}) → compose_sf_station_map({kind:\"moonbase\"})",
    words: /(?:달|화성|행성|우주)\s*(?:정착지|식민지|기지|콜로니|마을)|콜로니|정착지\s*\(?우주|space\s*colony|moon\s*base|mars\s*colony/iu }),
  T({ id: "station-habitat", ko: "우주 정거장 거주구", era: "future", chipset: "sf_station", status: "ready",
    recipe: "create_map({tilesetId:\"sf_station\", width:44, height:32}) → compose_sf_station_map({kind:\"station\"})",
    words: /우주\s*정거장|거주구|우주\s*도시|space\s*station/iu }),
  T({ id: "undersea-dome", ko: "해저 돔 도시", era: "future", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 해저 돔 그림이 없다. 가장 가까운 것은 우주 정거장 거주구(station-habitat)",
    words: /해저\s*(?:돔|도시|마을|기지)|바다\s*밑\s*(?:도시|마을)|수중\s*도시|underwater\s*(?:city|dome)|undersea/iu,
    gap: "해저 돔(유리 돔·산호 바닥·잠수정 부두) 칩셋이 없다", gapId: "underwater-kit", nearest: ["station-habitat"] }),
  T({ id: "post-apocalypse", ko: "포스트아포칼립스 폐허 마을", era: "future", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 폐허 칩셋이 없다(멀쩡한 거리에 잔해를 흩뿌려 흉내 내지 않는다)",
    words: /포스트\s*아포칼립스|아포칼립스|종말\s*(?:이후|후)?\s*(?:마을|도시|세계)|핵\s*전쟁\s*(?:이후|후)|폐허\s*마을|post[-\s]?apocalyp/iu,
    gap: "폐허(무너진 건물·녹슨 차·판잣집) 칩셋이 없다", gapId: "post-apoc-kit", nearest: ["cyberpunk-street"] }),

  T({ id: "ruined-city", ko: "좀비 폐허 도시", era: "future", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 무너진 빌딩·녹슨 차 그림이 없다(멀쩡한 거리에 잔해를 흩뿌려 흉내 내지 않는다)",
    words: /폐허\s*(?:도시|거리)|좀비\s*(?:마을|도시|거리)|버려진\s*도시|ruined\s*city|zombie\s*(?:town|city)/iu,
    gap: "폐허(무너진 건물·녹슨 차·판잣집) 칩셋이 없다", gapId: "post-apoc-kit", nearest: ["tokyo-downtown"] }),
  T({ id: "wasteland-settlement", ko: "황무지 판잣집 정착촌", era: "future", chipset: null, status: "needs-art",
    recipe: "짓지 않는다 — 판잣집·고철 울타리 그림이 없다",
    words: /황무지\s*(?:마을|정착지|정착촌)|판잣집\s*(?:마을|촌)|고철\s*마을|wasteland|shanty\s*town/iu,
    gap: "폐허(무너진 건물·녹슨 차·판잣집) 칩셋이 없다", gapId: "post-apoc-kit", nearest: ["oasis-village"] }),

  // ── 북방 ──
  T({ id: "viking-village", ko: "북방 바이킹 마을", era: "medieval", chipset: "snow_north", status: "ready",
    recipe: "create_map({tilesetId:\"snow_north\"}) → compose_snow_north_map({style:\"village\"})",
    words: /바이킹|노르딕|북방\s*마을|북쪽\s*마을|툰드라\s*마을|viking|nordic\s*village/iu }),
  T({ id: "frozen-lake-village", ko: "얼음 호수 낚시 마을", era: "medieval", chipset: "snow_north", status: "ready",
    recipe: "create_map({tilesetId:\"snow_north\"}) → compose_snow_north_map({style:\"lake\"})",
    words: /얼어붙은\s*호수|얼음\s*낚시|빙판\s*호수\s*마을|frozen\s*lake/iu }),
  T({ id: "winter-market", ko: "북방 겨울 장터", era: "medieval", chipset: "snow_north", status: "ready",
    recipe: "create_map({tilesetId:\"snow_north\"}) → compose_snow_north_map({style:\"market\"})",
    words: /겨울\s*(?:장터|시장)|북방\s*장터|winter\s*market/iu }),
];

/** 마을·도시 종류를 말한 문장인가 — 가장 길게 맞은 종류. 없으면 null. */
export function matchVillageType(text: string | undefined): VillageType | null {
  if (!text) return null;
  let best: VillageType | null = null;
  let bestLen = 0;
  for (const type of VILLAGE_TYPES) {
    const m = type.words.exec(text);
    // 시대·세계 낱말(조선·엘프·사이버펑크…)이 일반 낱말(숲 마을·시골 마을)보다 이긴다 — 버들항이 아닌 종류에 가산점.
    const score = m ? m[0].length + (type.chipset === "beodeul_city" ? 0 : 3) : 0;
    if (m && score > bestLen) { best = type; bestLen = score; }
  }
  return best;
}

export function villageTypeById(id: string): VillageType | undefined {
  return VILLAGE_TYPES.find((type) => type.id === id);
}

/** 문장 검색 — query 낱말이 이름·id 에 닿는 종류(맞은 종류가 맨 앞). */
export function searchVillageTypes(query: string, limit = 8): VillageType[] {
  const hit = matchVillageType(query);
  const q = query.toLowerCase();
  const tokens = q.split(/[\s,·]+/u).filter((t) => t.length >= 2);
  const scored = VILLAGE_TYPES.map((type) => ({ type, score: (type === hit ? 100 : 0) + tokens.filter((t) => type.ko.toLowerCase().includes(t) || type.id.includes(t)).length }))
    .filter((row) => row.score > 0).sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((row) => row.type);
}

/** 그림 묶음 → 그 그림이 풀어 줄 종류(needs-art + partial). 많이 푸는 순. */
export function rankArtGaps(): { gapId: string; label: string; unlocks: string[] }[] {
  const byGap = new Map<string, string[]>();
  for (const type of VILLAGE_TYPES) if (type.gapId) byGap.set(type.gapId, [...(byGap.get(type.gapId) ?? []), type.ko]);
  return [...byGap.entries()].map(([gapId, unlocks]) => ({ gapId, label: ART_GAPS[gapId] ?? gapId, unlocks }))
    .sort((a, b) => b.unlocks.length - a.unlocks.length);
}

function nearestText(type: VillageType): string {
  const near = (type.nearest ?? []).map(villageTypeById).filter((t): t is VillageType => !!t);
  return near.map((t) => `${t.ko}(${t.recipe})`).join(" / ");
}

/** 의도 노트 한 덩이 — 맞은 종류의 칩셋·시공 순서·빠진 그림. */
export function formatVillageTypeNote(type: VillageType): string {
  const head = `[마을 종류 — ${type.ko} · ${VILLAGE_ERA_LABEL[type.era]}] find_village_type 표에서 이 요청에 맞는 종류다.`;
  if (type.status === "needs-art") {
    return [
      head,
      `이 종류는 그림이 없다: ${type.gap}. 맵을 만들지 말고, 다른 칩셋 타일·평면 선·잔해 흩뿌리기로 흉내 내지 않는다.`,
      `답의 첫 문장에 「${type.ko}은(는) 필요한 그림이 아직 없어 짓지 않았다 — ${type.gap}」고 분명히 말하고, 대신 지을 수 있는 가장 가까운 종류를 제안한다: ${nearestText(type)}. 사용자가 그 대안을 고르면 그때 짓는다.`,
    ].join("\n");
  }
  const lines = [head, `칩셋 ${type.chipset} · 시공: ${type.recipe}.`];
  if (type.status === "partial") lines.push(`빠진 그림: ${type.gap} — 그 부분을 다른 타일로 흉내 내지 말고 지은 뒤 답에서 「${type.gap}」라고 말한다.`);
  lines.push("요청이 말한 나머지 선택(크기·지붕·물·숲)은 그 도구 설명을 따르고, 말하지 않은 선택과 seed 는 보내지 않는다.");
  return lines.join("\n");
}
