import type { Project, SectionStructureKitDef, TilesetDef } from "@/project/types";
import { PLACE_REFERENCES, regionReference } from "@/project/regionReferences";

export type SpatialThemeCategory = "fantasy" | "modern" | "eastern" | "special" | "utility";
export type SpatialThemeFilter = "all" | "used" | SpatialThemeCategory;

export const SPATIAL_THEME_FILTERS: readonly { readonly id: SpatialThemeFilter; readonly label: string }[] = [
  { id: "all", label: "전체" },
  { id: "used", label: "내 게임 사용 중" },
  { id: "fantasy", label: "판타지·중세" },
  { id: "modern", label: "현대·도시" },
  { id: "eastern", label: "동양·역사" },
  { id: "special", label: "특수·SF·자연" },
  { id: "utility", label: "실내·공용" },
];

export const SPATIAL_THEME_CATEGORY_LABEL: Readonly<Record<SpatialThemeCategory, string>> = {
  fantasy: "판타지·중세",
  modern: "현대·도시",
  eastern: "동양·역사",
  special: "특수·SF·자연",
  utility: "실내·공용",
};

export type SpatialThemeSpec = {
  readonly id: string;
  readonly name: string;
  readonly subtitle: string;
  readonly description: string;
  readonly category: SpatialThemeCategory;
  readonly tags: readonly string[];
  readonly primaryTilesetId: string;
  readonly aiPromptHint: string;
  readonly matchTileset: (tileset: TilesetDef) => boolean;
};

const starts = (prefix: string) => (ts: TilesetDef): boolean => ts.id === prefix || ts.id.startsWith(`${prefix}_`);

export const SPATIAL_THEME_SPECS: readonly SpatialThemeSpec[] = [
  {
    id: "beodeul",
    name: "버들항 · 판타지 항구",
    subtitle: "중세 항구 마을 · 민가 · 성당 · 왕성 · 숲",
    description: "따뜻한 석재·목조 건물과 항구 부두, 귀족 저택, 자연 숲 기물이 하나로 묶인 기본 판타지 세계관입니다.",
    category: "fantasy",
    tags: ["판타지", "중세", "항구", "마을", "왕성", "숲", "여관", "성당"],
    primaryTilesetId: "beodeul_city",
    aiPromptHint: "버들항 판타지 항구(beodeul_city) 테마로",
    matchTileset: (ts) => ts.id.startsWith("beodeul_"),
  },
  {
    id: "jp_city",
    name: "일본 도시 · 상가·역·신사",
    subtitle: "상점가 · 주택가 · 전철역 · 신사 · 실내 가구",
    description: "편의점·이자카야·주택가·전철역·신사와 생활 밀착 실내 가구까지 갖춘 일본 현대 도시 팩입니다.",
    category: "modern",
    tags: ["일본", "현대", "상가", "편의점", "주택", "전철역", "신사", "이자카야"],
    primaryTilesetId: "jp_city",
    aiPromptHint: "일본 도시(jp_city) 테마로",
    matchTileset: starts("jp_city"),
  },
  {
    id: "modern_city",
    name: "현대 도시 · 도쿄 거리",
    subtitle: "도로 · 빌딩 · 횡단보도 · 차량 · 도심 상가",
    description: "2차선 아스팔트 도로, 횡단보도, 고층 빌딩과 차량·거리 소품 중심의 현대 도심 팩입니다.",
    category: "modern",
    tags: ["현대", "도시", "도쿄", "도로", "빌딩", "자동차", "거리"],
    primaryTilesetId: "modern_city",
    aiPromptHint: "현대 도시(modern_city) 테마로",
    matchTileset: starts("modern_city"),
  },
  {
    id: "modern_campus",
    name: "현대 학교 · 캠퍼스",
    subtitle: "교문 · 교사 · 운동장 · 교실 · 도서관 · 기숙사",
    description: "교문과 운동장부터 교실·복도·보건실·급식실·도서관까지 학원물 전용 야외/실내 팩입니다.",
    category: "modern",
    tags: ["학교", "캠퍼스", "교실", "학원", "도서관", "운동장", "기숙사"],
    primaryTilesetId: "modern_campus",
    aiPromptHint: "현대 학교·캠퍼스(modern_campus) 테마로",
    matchTileset: starts("modern_campus"),
  },
  {
    id: "joseon_baram",
    name: "조선 · 바람의나라풍",
    subtitle: "기와집 · 초가집 · 성문 · 궁궐 · 정자 · 주막",
    description: "전통 한옥 기와집, 초가집, 성곽 대문과 정자, 논밭·강 오토타일을 담은 조선 시대 팩입니다.",
    category: "eastern",
    tags: ["조선", "한옥", "기와집", "초가집", "주막", "성문", "궁궐", "정자"],
    primaryTilesetId: "joseon_baram",
    aiPromptHint: "조선 바람의나라풍(joseon_baram) 테마로",
    matchTileset: starts("joseon_baram"),
  },
  {
    id: "sengoku_edo",
    name: "전국 · 에도 일본",
    subtitle: "마치야 · 천수각 · 무가 저택 · 다다미 · 신사",
    description: "에도 거리 마치야, 성곽 천수각, 신사·절과 다다미·장지 실내를 아우르는 일본 시대극 팩입니다.",
    category: "eastern",
    tags: ["전국", "에도", "일본", "천수각", "다다미", "마치야", "무사"],
    primaryTilesetId: "sengoku_edo",
    aiPromptHint: "전국·에도 일본(sengoku_edo) 테마로",
    matchTileset: starts("sengoku_edo"),
  },
  {
    id: "wizarding_world",
    name: "마법 학교 · 성채",
    subtitle: "마법 성벽 · 기숙사 · 연회장 · 마법 상점가 · 호수",
    description: "고성 회랑, 연회장, 기숙사, 마법 약품점과 검은 호수까지 마법 학원 판타지 전용 팩입니다.",
    category: "fantasy",
    tags: ["마법", "학교", "성채", "판타지", "연회장", "기숙사", "마법사"],
    primaryTilesetId: "wizarding_world",
    aiPromptHint: "마법 학교(wizarding_world) 테마로",
    matchTileset: starts("wizarding_world"),
  },
  {
    id: "gothic_manor",
    name: "고딕 저택 · 묘지 호러",
    subtitle: "고딕 저택 · 예배당 · 묘지 · 미술관 · 철책",
    description: "음산한 석조 저택, 예배당, 묘비와 고사목, 촛대·전시실 실내를 갖춘 고딕 호러 팩입니다.",
    category: "fantasy",
    tags: ["고딕", "저택", "호러", "묘지", "예배당", "공포", "흡혈귀"],
    primaryTilesetId: "gothic_manor",
    aiPromptHint: "고딕 저택·묘지(gothic_manor) 테마로",
    matchTileset: starts("gothic_manor"),
  },
  {
    id: "sky_island",
    name: "하늘섬 · 구름과 비공정",
    subtitle: "부유섬 · 구름 바닥 · 밧줄다리 · 폭포 · 비공정",
    description: "구름 위 부유섬, 바위 절벽, 폭포와 정박된 비공정까지 하늘 대륙 모험 팩입니다.",
    category: "fantasy",
    tags: ["하늘섬", "구름", "비공정", "부유섬", "폭포", "판타지"],
    primaryTilesetId: "sky_island",
    aiPromptHint: "하늘섬(sky_island) 테마로",
    matchTileset: starts("sky_island"),
  },
  {
    id: "pirate_isles",
    name: "열대 군도 · 해적 항구",
    subtitle: "야자수 해변 · 해적 항구 · 요새 · 범선 · 선술집",
    description: "에메랄드 해안, 야자수, 항구 요새와 범선, 해적 선술집 실내로 꾸민 해양 모험 팩입니다.",
    category: "fantasy",
    tags: ["해적", "항구", "열대", "섬", "야자수", "범선", "바다"],
    primaryTilesetId: "pirate_isles",
    aiPromptHint: "열대 군도·해적 항구(pirate_isles) 테마로",
    matchTileset: starts("pirate_isles"),
  },
  {
    id: "desert_east",
    name: "사막 · 동양풍 오아시스",
    subtitle: "흙벽돌 집 · 돔 궁전 · 바자르 · 피라미드 · 오아시스",
    description: "실크로드·아라비아·이집트 감성의 돔 지붕, 시장 천막, 피라미드와 사구 오아시스 팩입니다.",
    category: "special",
    tags: ["사막", "오아시스", "바자르", "피라미드", "궁전", "천막"],
    primaryTilesetId: "desert_east",
    aiPromptHint: "사막·동양풍(desert_east) 테마로",
    matchTileset: starts("desert_east"),
  },
  {
    id: "snow_north",
    name: "북방 설원 · 통나무 마을",
    subtitle: "통나무 오두막 · 긴집 회관 · 얼음 동굴 · 사우나",
    description: "눈 쌓인 너와 지붕 오두막, 북방 회관, 얼어붙은 폭포와 따뜻한 창불의 설원 팩입니다.",
    category: "special",
    tags: ["설원", "겨울", "눈", "오두막", "북방", "얼음", "사우나"],
    primaryTilesetId: "snow_north",
    aiPromptHint: "북방 설원(snow_north) 테마로",
    matchTileset: starts("snow_north"),
  },
  {
    id: "steampunk_city",
    name: "스팀펑크 · 증기 공방",
    subtitle: "증기 공장 · 시계탑 · 철도 · 비행선 정박장 · 운하",
    description: "황동 파이프, 시계탑, 증기 기관차와 보일러 공방이 어우러진 산업 판타지 팩입니다.",
    category: "special",
    tags: ["스팀펑크", "증기", "공장", "시계탑", "철도", "기계"],
    primaryTilesetId: "steampunk_city",
    aiPromptHint: "스팀펑크 도시(steampunk_city) 테마로",
    matchTileset: starts("steampunk_city"),
  },
  {
    id: "sf_station",
    name: "SF 정거장 · 네온 사이버",
    subtitle: "거주 돔 · 에어록 · 네온 간판 · 조종실 · 달 기지",
    description: "우주 정거장 실내, 달 기지 외곽, 사이버펑크 네온 거리와 콘솔·자판기 소품 팩입니다.",
    category: "special",
    tags: ["SF", "우주", "정거장", "사이버펑크", "네온", "기지"],
    primaryTilesetId: "sf_station",
    aiPromptHint: "SF 정거장·네온 거리(sf_station) 테마로",
    matchTileset: starts("sf_station"),
  },
  {
    id: "wasteland_ruins",
    name: "폐허 · 황무지 생존",
    subtitle: "무너진 빌딩 · 고철 판잣집 · 바리케이드 · 녹슨 차",
    description: "갈라진 아스팔트, 폐허 건물, 바리케이드와 생존자 장터를 담은 포스트 아포칼립스 팩입니다.",
    category: "special",
    tags: ["폐허", "황무지", "아포칼립스", "생존", "고철", "바리케이드"],
    primaryTilesetId: "wasteland_ruins",
    aiPromptHint: "폐허·황무지(wasteland_ruins) 테마로",
    matchTileset: starts("wasteland_ruins"),
  },
  {
    id: "prehistoric",
    name: "선사 시대 · 원시 세계",
    subtitle: "움집 · 매머드 뼈 집 · 토템 · 화산 · 동굴 벽화",
    description: "원시 부족 움집, 가죽 천막, 용암 화산과 고대 동굴 벽화를 담은 선사 시대 팩입니다.",
    category: "special",
    tags: ["선사", "원시", "공룡", "화산", "동굴", "움집", "부족"],
    primaryTilesetId: "prehistoric",
    aiPromptHint: "선사 시대 원시 세계(prehistoric) 테마로",
    matchTileset: starts("prehistoric"),
  },
  {
    id: "atlas_interior",
    name: "공용 실내 · 가구·탈것",
    subtitle: "손 도트 실내 v5 가구 · 바닥 · 벽 · 배·마차·비공정",
    description: "여관·상점·집 안을 채우는 공용 실내 가구 640+종과 배·마차·축제 탈것 조각을 모았습니다.",
    category: "utility",
    tags: ["실내", "가구", "방", "침대", "책상", "상점", "배", "마차", "탈것"],
    primaryTilesetId: "atlas_biome_interior",
    aiPromptHint: "공용 실내(atlas_biome_interior) 테마로",
    matchTileset: (ts) => ts.id === "atlas_biome_interior" || ts.id === "oprn_atlas_vehicles",
  },
  {
    id: "monster_kit",
    name: "몬스터 수집 · 모험 키트",
    subtitle: "포켓몬풍 마을 · 연구소 · 체육관 · 풀숲 · 실내",
    description: "몬스터 수집 RPG 전용 밝은 마을·도로·연구소·체육관 타일셋 묶음입니다.",
    category: "utility",
    tags: ["몬스터", "수집", "포켓몬", "연구소", "체육관", "마을"],
    primaryTilesetId: "monster_kit_town",
    aiPromptHint: "몬스터 수집 키트 테마로",
    matchTileset: (ts) => ts.id.includes("monster_kit"),
  },
  {
    id: "worldmap_misc",
    name: "월드맵 · 지도·기타 시트",
    subtitle: "월드맵 아이콘 · 연결 지형 붓 · 지도 32px · 보조 시트",
    description: "대륙 월드맵 제작용 아이콘·지형 붓과 보조 시트를 모아 둔 유틸리티 팩입니다.",
    category: "utility",
    tags: ["월드맵", "지도", "아이콘", "지형", "Scarloxy"],
    primaryTilesetId: "worldmap_authoring",
    aiPromptHint: "월드맵 지형(worldmap_authoring) 테마로",
    matchTileset: (ts) => ts.id.startsWith("worldmap_") || ts.id === "atlas_cartography" || ts.id.startsWith("scarloxy_"),
  },
];

const CUSTOM_THEME_SPEC: SpatialThemeSpec = {
  id: "custom_user",
  name: "내 커스텀 타일셋",
  subtitle: "이 프로젝트에 직접 가져온 타일셋·오브젝트",
  description: "사용자가 소재 관리자나 공방에서 직접 추가한 커스텀 타일셋과 오브젝트를 모았습니다.",
  category: "utility",
  tags: ["커스텀", "내 소재", "가져오기", "공방"],
  primaryTilesetId: "",
  aiPromptHint: "내 커스텀 타일셋으로",
  matchTileset: () => false,
};

/** 타일셋이 속하는 테마 팩 ID 를 찾는다. 어디에도 안 맞으면 `custom_user`. */
export function themeIdForTileset(tileset: TilesetDef): string {
  for (const spec of SPATIAL_THEME_SPECS) {
    if (spec.matchTileset(tileset)) return spec.id;
  }
  return tileset.image.type === "bundled" ? "worldmap_misc" : CUSTOM_THEME_SPEC.id;
}

export function themeSpecById(id: string): SpatialThemeSpec | undefined {
  if (id === CUSTOM_THEME_SPEC.id) return CUSTOM_THEME_SPEC;
  return SPATIAL_THEME_SPECS.find((spec) => spec.id === id);
}

export type CuratedKitCandidate<TCard> = {
  readonly card: TCard;
  readonly tileset: TilesetDef | undefined;
  readonly kit: SectionStructureKitDef | undefined;
};

/**
 * 테마당 수천 개의 structureKits 중 사람이 1초 만에 화풍을 파악할 수 있는
 * 대표 건물·랜드마크·가구·소품 `limit` 종만 고르게 선별한다.
 *
 * 선별 기준:
 *  1) 크기가 2×2 이상인 건물(role=building)과 대표 구조물을 우선 배치
 *  2) 소품·가구(role=prop/none)는 이름 앞단어 중복(양배추 궤짝·당근 궤짝…)을 억제해 다양성 확보
 *  3) 1×1 바닥/도로 조각 같은 단순 파편은 뒤로 미룸
 */
export function curateThemeObjects<TCard extends { readonly id: string; readonly name: string; readonly tilesetId?: string; readonly objectId?: string; readonly localId?: string }>(
  cards: readonly TCard[],
  tilesetsById: Readonly<Record<string, TilesetDef>>,
  limit = 18,
): TCard[] {
  if (cards.length <= limit) return [...cards];

  type Scored = {
    readonly card: TCard;
    readonly bucket: "building" | "prop" | "other";
    readonly score: number;
    readonly stem: string;
    readonly tailNoun: string;
    readonly index: number;
  };

  // 타일셋별 kit ID -> kit 맵을 한 번만 만든다.
  const kitLookup = new Map<string, Map<string, SectionStructureKitDef>>();
  const getKit = (tilesetId: string | undefined, kitId: string | undefined): SectionStructureKitDef | undefined => {
    if (!tilesetId || !kitId) return undefined;
    let map = kitLookup.get(tilesetId);
    if (!map) {
      map = new Map();
      const ts = tilesetsById[tilesetId];
      for (const kit of ts?.structureKits ?? []) {
        if (kit.kind === "section") map.set(kit.id, kit as SectionStructureKitDef);
      }
      kitLookup.set(tilesetId, map);
    }
    return map.get(kitId);
  };

  const scored: Scored[] = cards.map((card, index) => {
    const kit = getKit(card.tilesetId, card.objectId ?? card.localId);
    const w = kit?.width ?? 1;
    const h = kit?.height ?? 1;
    const area = w * h;
    const role: string = kit?.ai?.role ?? "";
    const isBuilding = role === "building" || role === "structure" || role === "castle" || (area >= 9 && role !== "terrain" && role !== "water");
    const isTerrainPiece = role === "terrain" || role === "water" || role === "floor" || role === "wall" || role === "stairs";

    const bucket: Scored["bucket"] = isBuilding ? "building" : isTerrainPiece ? "other" : "prop";

    // 시각적으로 보기 좋은 비율(3×3 ~ 8×8)에 가산점, 지나치게 길쭉한 도로 1×12 나 1×1 파편은 감점
    const aspect = Math.max(w, h) / Math.max(1, Math.min(w, h));
    let score = 0;
    if (bucket === "building") score += 100;
    else if (bucket === "prop") score += 50;
    else score += 10;

    if (area >= 4 && area <= 64) score += 30 + Math.min(25, area);
    else if (area >= 2) score += 15;
    if (aspect > 4) score -= 25;
    if (kit?.name && !kit.name.includes("구간") && !kit.name.includes("가장자리") && !kit.name.includes("조각")) {
      score += 10;
    }

    // 중복 변형 억제용 어간: 테마 접두어(버들항·일본·조선·건물 등)·괄호·숫자 제거 후 핵심 명사 추출
    const clean = card.name
      .replace(/\([^)]*\)/g, "")
      .replace(/\d+×\d+|\d+칸|\d+호|\d+/g, "")
      .replace(/[·\-_/:]+/g, " ")
      .replace(/\b(버들항|일본|조선|현대|마법|고딕|사막|설원|해적|하늘섬|스팀펑크|선사|폐허|건물|소품|마을|광장|왕성|실내)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const tokens = clean.split(" ").filter(Boolean);
    // 마지막 단어(가게집·오두막·집·성벽·편의점·궤짝 등)와 첫 단어를 조합해 유사 변형 군집을 묶는다.
    const stem = tokens.length >= 2
      ? `${tokens[0]}:${tokens[tokens.length - 1]}`
      : (tokens[0] || card.name);
    const tailNoun = tokens[tokens.length - 1] || stem;

    return { card, bucket, score, stem, tailNoun, index };
  });

  scored.sort((a, b) => b.score - a.score || a.index - b.index);

  const buildings = scored.filter((s) => s.bucket === "building");
  const props = scored.filter((s) => s.bucket === "prop");
  const others = scored.filter((s) => s.bucket === "other");

  const picked: TCard[] = [];
  const pickedIds = new Set<string>();
  const stemCounts = new Map<string, number>();
  const tailCounts = new Map<string, number>();

  const takeFrom = (pool: readonly Scored[], targetCount: number, maxPerStem: number, maxPerTail: number): void => {
    let added = 0;
    for (const item of pool) {
      if (picked.length >= limit || added >= targetCount) break;
      if (pickedIds.has(item.card.id)) continue;
      if ((stemCounts.get(item.stem) ?? 0) >= maxPerStem) continue;
      if ((tailCounts.get(item.tailNoun) ?? 0) >= maxPerTail) continue;
      pickedIds.add(item.card.id);
      stemCounts.set(item.stem, (stemCounts.get(item.stem) ?? 0) + 1);
      tailCounts.set(item.tailNoun, (tailCounts.get(item.tailNoun) ?? 0) + 1);
      picked.push(item.card);
      added++;
    }
  };

  // 균형 배분: 건물 최대 9종 + 소품/가구 최대 8종 + 지형/보조 1종, 부족하면 남은 풀에서 채움
  const buildingQuota = buildings.length > 0 ? Math.min(Math.ceil(limit * 0.5), buildings.length) : 0;
  const propQuota = Math.max(0, limit - buildingQuota - (others.length > 0 ? 1 : 0));

  takeFrom(buildings, buildingQuota, 1, 2);
  takeFrom(props, propQuota, 1, 2);
  takeFrom(others, 1, 1, 2);

  // 제한 때문에 개수가 모자라면 점진 완화해 마저 채움
  if (picked.length < limit) takeFrom(buildings, limit - picked.length, 2, 3);
  if (picked.length < limit) takeFrom(props, limit - picked.length, 2, 3);
  if (picked.length < limit) takeFrom(scored, limit - picked.length, 99, 99);

  return picked;
}

/** 프로젝트 맵들이 어떤 타일셋을 몇 개씩 쓰는지 집계한다. */
export function mapUsageByTileset(project: Project): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const gameMap of Object.values(project.maps)) {
    const list = map.get(gameMap.tilesetId) ?? [];
    list.push(gameMap.name || gameMap.id);
    map.set(gameMap.tilesetId, list);
  }
  return map;
}

/** 테마에 속한 완성 장소 사례(PLACE_REFERENCES)의 대표 미리보기 URL 하나를 찾는다. */
export function coverPlacePreviewForTilesets(tilesetIds: ReadonlySet<string>): string | undefined {
  for (const entry of PLACE_REFERENCES) {
    if (tilesetIds.has(entry.tilesetId)) {
      const ref = regionReference(entry.id);
      if (ref?.preview) return ref.preview;
    }
  }
  return undefined;
}

export { CUSTOM_THEME_SPEC };
