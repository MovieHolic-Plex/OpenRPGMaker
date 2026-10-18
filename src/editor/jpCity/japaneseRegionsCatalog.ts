// 일본 지역 30종 마스터 카탈로그(jp_city) — 2026-10-18 사용자 「이건 '상점가' 고 다른 지역들도 많을거같은데 … 학교·주거지·등산로·유적지 … 한 30가지 쯤」.
// 지역 하나 = 이름·무리·팔레트 주조 재료·장면 문법(바닥·길·랜드마크·줄·흩뿌림). 좌표는 맵 크기에 대한 비율(0~1)이고 폭만 칸이다 —
// 같은 지역이라도 맵 크기와 씨앗이 다르면 다른 장면이 나온다. 장면은 regionComposer.ts 가 도구 호출 단계로 펼치고 compose_jp_region 이 시공한다.
// 상가·주택가처럼 거리 구성기(jpCityStreetComposer)가 이미 잘 짜는 지역은 engine:"street" 로 그 구성기에 넘긴다.
import type { JpPaletteFamilyId } from "./paletteContract";

export type JpRegionCategory = "urban" | "residential" | "campus_civic" | "sacred_historic" | "mountain_nature" | "onsen_rural_coast";

export const JP_REGION_CATEGORIES: readonly { readonly id: JpRegionCategory; readonly letter: "A" | "B" | "C" | "D" | "E" | "F"; readonly ko: string; readonly en: string }[] = [
  { id: "urban", letter: "A", ko: "도심·상업·역세권", en: "Downtown · Commerce · Station" },
  { id: "residential", letter: "B", ko: "주거지·일상 골목", en: "Residential · Everyday Lanes" },
  { id: "campus_civic", letter: "C", ko: "학원·문화·공공", en: "Campus · Culture · Civic" },
  { id: "sacred_historic", letter: "D", ko: "신사·사찰·역사 유적지", en: "Shrines · Temples · Historic Ruins" },
  { id: "mountain_nature", letter: "E", ko: "산림·등산로·자연 비경", en: "Forest · Trails · Scenic Nature" },
  { id: "onsen_rural_coast", letter: "F", ko: "온천·농어촌·해안", en: "Onsen · Farm & Fishing Villages · Coast" },
];

/** 장면 문법 한 줄. 좌표 x·y 는 맵 폭·높이 비율(0~1), size·step·gap 은 칸. 바닥 재료는 jp_city 타일 그룹 이름(fill_region material). */
export type JpRegionOp =
  /** 사각 영역 바닥. clear:true 면 그 칸에 소품을 놓지 않는다(물·논·광장 중심). */
  | { readonly op: "area"; readonly mat: string; readonly box: readonly [number, number, number, number]; readonly clear?: boolean }
  /** 맵을 가로지르는 길·물·선로 띠. 늘 비워 둔다(onPath 소품만 위에 선다). span 은 띠 방향 범위 비율. */
  | { readonly op: "band"; readonly mat: string; readonly dir: "h" | "v"; readonly at: number; readonly size: number; readonly span?: readonly [number, number] }
  /** 랜드마크 하나 - at 은 키트 가운데(foot:true 면 x 가운데·y 는 맨 아랫줄). */
  | { readonly op: "put"; readonly kit: string; readonly at: readonly [number, number]; readonly foot?: boolean; readonly onPath?: boolean }
  /** 건물·노점 줄 - 아랫줄(발)을 foot 에 맞춰 왼쪽부터 kits 를 돌려 가며 세운다. */
  | { readonly op: "row"; readonly kits: readonly string[]; readonly foot: number; readonly span: readonly [number, number]; readonly gap?: number }
  /** 같은 키트를 선 위에 step 칸마다(가로등·도리이 터널·지장 행렬·방파제 블록). at 은 선의 가로(h)·세로(v) 위치 비율 = 키트 가운데. */
  | { readonly op: "line"; readonly kit: string; readonly dir: "h" | "v"; readonly at: number; readonly span: readonly [number, number]; readonly step: number; readonly onPath?: boolean }
  /** 상자 안에 n 개 흩뿌림(나무·바위·벤치) - 서로 한 칸 띄운다. */
  | { readonly op: "scatter"; readonly kits: readonly string[]; readonly n: number; readonly box: readonly [number, number, number, number]; readonly onPath?: boolean };

export type JpRegionEngine =
  | { readonly kind: "scene"; readonly ground: string; readonly ops: readonly JpRegionOp[] }
  | { readonly kind: "street"; readonly style: "shopping" | "residential" | "shitamachi" | "shotengai" };

export interface JpRegion {
  readonly no: number;
  readonly id: string;
  readonly category: JpRegionCategory;
  readonly ko: string;
  readonly ja: string;
  readonly en: string;
  /** 무엇을 보여 주는 장면인가 - 조수가 사용자에게 설명할 때 쓴다. */
  readonly pitch: string;
  /** 요청 문장에서 이 지역을 고르는 낱말. */
  readonly keywords: readonly string[];
  /** 팔레트 계약(paletteContract.ts)의 주조 재료 - 화면 넓이 순. */
  readonly palette: readonly string[];
  readonly harmony: readonly JpPaletteFamilyId[];
  /** 권장 계절·시간대(팔레트 JP_SEASON_RULES·JP_TIME_OF_DAY_RULES 의 id). */
  readonly season: "spring" | "summer" | "autumn" | "winter";
  readonly timeOfDay: "dawn" | "day" | "dusk" | "night";
  /** 권장 맵 크기(칸). 40×28 이상이면 비율대로 펴진다. */
  readonly size: readonly [number, number];
  /** 다른 번들 칩셋으로 짓는 변형(jp_city 밖). */
  readonly alsoWith?: string;
  readonly engine: JpRegionEngine;
}

const HARMONY: Record<JpRegionCategory, readonly JpPaletteFamilyId[]> = {
  urban: ["ground_stone", "roof_modern", "accent_signage"],
  residential: ["roof_modern", "ground_stone", "vegetation_season"],
  campus_civic: ["ground_stone", "roof_modern", "vegetation_season"],
  sacred_historic: ["ground_stone", "vegetation_season", "timber_traditional"],
  mountain_nature: ["vegetation_season", "water_onsen_coast", "timber_traditional"],
  onsen_rural_coast: ["water_onsen_coast", "vegetation_season", "timber_traditional"],
};

// 바닥 재료(타일 그룹 이름) - 오타가 곧 시공 실패라 한곳에 둔다.
const M = {
  pave: "판석 광장", walk: "콘크리트 판석 보도", curb: "보도 연석", lane: "생활도로", road: "거리 · 도로·정지선", lot: "거리 · 주차장",
  alley: "따뜻한 아스팔트 골목", lawn: "잔디", gravel: "자갈 참배길", pond: "연못", canal: "수로", rail: "선로", school: "校庭 흙 바닥", gomu: "遊具 밑 ゴムチップ",
  sand: "해변 모래사장", sea: "바다", paddy: "논(물 댄 모)", trail: "산길 흙", forest: "숲 바닥(이끼·낙엽)", deck: "나무 데크 탐방로",
  ishidatami: "온천가 돌길(이시다타미)", marsh: "습원 풀밭", oldrail: "폐선 녹슨 선로",
} as const;

/** 카탈로그가 쓰는 바닥 재료 이름 전부(시공 전 칩셋 확인용). */
export const JP_REGION_GROUND_MATERIALS: readonly string[] = Object.values(M);

type RegionDef = Omit<JpRegion, "harmony">;

const DEFS: readonly RegionDef[] = [
  // ─── A. 도심·상업·역세권 ───
  {
    no: 1, id: "shotengai", category: "urban", ko: "시타마치 아케이드 상점가", ja: "下町アーケード商店街", en: "Shitamachi Arcade Shopping Street",
    pitch: "붉은 함석 아케이드 지붕 아래 청과·생선·정육 가게가 늘어서고 大門通 아치가 어귀를 연다.",
    keywords: ["상점가", "쇼텐가이", "아케이드", "商店街", "shotengai", "arcade"],
    palette: ["paving_stone", "noren_rust", "kawara_dark_tile", "lantern_amber"], season: "summer", timeOfDay: "day", size: [50, 36],
    engine: { kind: "street", style: "shotengai" },
  },
  {
    no: 2, id: "station_plaza", category: "urban", ko: "역전 로터리·택시 승강장·고가선", ja: "駅前ロータリー", en: "Station Plaza Rotary & Viaduct",
    pitch: "고가 선로 아래 역사, 버스·택시가 도는 로터리, 하치코 동상과 느티나무, 자전거 무리.",
    keywords: ["역 앞", "역전", "로터리", "택시", "고가", "駅前", "station"],
    palette: ["paving_stone", "asphalt", "concrete_grey", "vending_cool_white"], season: "spring", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.pave, ops: [
      { op: "band", mat: M.rail, dir: "h", at: 0.06, size: 2 },
      { op: "put", kit: "jp-prop-train8", at: [0.2, 0.06], onPath: true },
      { op: "row", kits: ["jp-prop-viaduct6-shops", "jp-bldg-station-small", "jp-prop-viaduct6-shops", "jp-prop-viaduct6-pass"], foot: 0.36, span: [0.03, 0.97], gap: 0 },
      { op: "band", mat: M.walk, dir: "h", at: 0.42, size: 2 },
      { op: "band", mat: M.road, dir: "h", at: 0.66, size: 4 },
      { op: "put", kit: "jp-prop-bus", at: [0.24, 0.66], onPath: true },
      { op: "put", kit: "jp-prop-car-taxi", at: [0.62, 0.66], onPath: true },
      { op: "put", kit: "jp-prop-car-taxi-r", at: [0.8, 0.66], onPath: true },
      { op: "area", mat: M.lawn, box: [0.42, 0.47, 0.58, 0.56] },
      { op: "put", kit: "jp-prop-hachiko", at: [0.5, 0.52] },
      { op: "put", kit: "jp-prop-metro-exit", at: [0.1, 0.52] },
      { op: "put", kit: "jp-prop-tree-zelkova", at: [0.3, 0.5] },
      { op: "put", kit: "jp-prop-tree-zelkova", at: [0.7, 0.5] },
      { op: "put", kit: "jp-prop-vend-trio", at: [0.88, 0.52] },
      { op: "line", kit: "jp-bus-stop", dir: "h", at: 0.58, span: [0.12, 0.4], step: 7 },
      { op: "band", mat: M.walk, dir: "h", at: 0.8, size: 2 },
      { op: "row", kits: ["jp-prop-bike-cluster", "jp-prop-planter", "jp-prop-smoking-area", "jp-prop-bench", "jp-prop-bike-cluster", "jp-prop-lamp-post"], foot: 0.97, span: [0.03, 0.97], gap: 2 },
    ] },
  },
  {
    no: 3, id: "canal_promenade", category: "urban", ko: "강변 운하 산책로와 다리", ja: "運河沿いの遊歩道", en: "Canal Promenade & Bridges",
    pitch: "목조 가게가 운하를 마주 보고, 벚나무 산책로와 돌다리가 물을 건넌다(메구로강·오타루 운하풍).",
    keywords: ["운하", "강변", "산책로", "다리", "운하길", "運河", "canal"],
    palette: ["canal_indigo", "paving_stone", "sakura_petal", "machiya_timber"], season: "spring", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.pave, ops: [
      { op: "row", kits: ["jp-bldg-house-machiya", "jp-bldg-shop-cafe", "jp-bldg-shop-soba", "jp-bldg-shop-wagashi", "jp-bldg-house-tile3", "jp-bldg-shop-sake"], foot: 0.4, span: [0.02, 0.98], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.46, size: 2 },
      { op: "line", kit: "jp-prop-lantern-post", dir: "h", at: 0.5, span: [0.06, 0.94], step: 8 },
      { op: "band", mat: M.canal, dir: "h", at: 0.64, size: 5 },
      { op: "band", mat: M.walk, dir: "v", at: 0.32, size: 3, span: [0.54, 0.76] },
      { op: "band", mat: M.walk, dir: "v", at: 0.74, size: 3, span: [0.54, 0.76] },
      { op: "band", mat: M.walk, dir: "h", at: 0.79, size: 2 },
      { op: "line", kit: "jp-prop-tree-sakura", dir: "h", at: 0.89, span: [0.04, 0.96], step: 7 },
      { op: "scatter", kits: ["jp-prop-bench", "jp-prop-ricksha-cart", "jp-prop-bike-sora"], n: 3, box: [0.05, 0.84, 0.95, 0.98] },
    ] },
  },
  {
    no: 4, id: "yokocho_alley", category: "urban", ko: "뒷골목 요코초 포장마차·이자카야 거리", ja: "横丁・飲み屋街", en: "Yokocho Izakaya Alley",
    pitch: "어깨 너비 골목 양쪽에 이자카야·라멘 노포가 붙어 서고, 초롱 줄과 함석 노점이 골목을 메운다(오모이데 요코초풍).",
    keywords: ["요코초", "골목 술집", "이자카야 거리", "포장마차", "横丁", "yokocho", "飲み屋"],
    palette: ["asphalt", "machiya_timber", "lantern_amber", "noren_indigo"], season: "summer", timeOfDay: "night", size: [48, 34],
    engine: { kind: "scene", ground: M.alley, ops: [
      { op: "row", kits: ["jp-recipe-izakaya-alt", "jp-bldg-shop-izakaya", "jp-recipe-bar-row", "jp-recipe-sushi-bar", "jp-recipe-machiya-izakaya", "jp-bldg-shop-ramen"], foot: 0.42, span: [0.01, 0.99], gap: 0 },
      { op: "band", mat: M.alley, dir: "h", at: 0.48, size: 3 },
      { op: "put", kit: "jp-prop-omoide-gate", at: [0.08, 0.47], onPath: true },
      { op: "line", kit: "jp-prop-string-lanterns4", dir: "h", at: 0.44, span: [0.25, 0.95], step: 9, onPath: true },
      { op: "row", kits: ["jp-prop-tin-stall-0", "rg-yatai", "jp-prop-tin-stall-1", "jp-prop-tin-stall-2", "rg-yatai"], foot: 0.66, span: [0.02, 0.98], gap: 1 },
      { op: "band", mat: M.alley, dir: "h", at: 0.72, size: 2 },
      { op: "row", kits: ["jp-bldg-row-inshokugai", "jp-bldg-shop-teishoku", "jp-bldg-shop-sushi"], foot: 0.99, span: [0.01, 0.99], gap: 0 },
      { op: "scatter", kits: ["jp-prop-vend-pair", "jp-prop-a-frame", "jp-gomi-box", "jp-prop-cat-loaf"], n: 4, box: [0.02, 0.5, 0.98, 0.62], onPath: true },
    ] },
  },
  {
    no: 5, id: "business_district", category: "urban", ko: "현대 오피스·은행 빌딩 거리", ja: "オフィス街", en: "Modern Office & Bank District",
    pitch: "큰길 두 줄과 고층 오피스·은행·편의점 스카이라인(마루노우치·오테마치풍).",
    keywords: ["오피스", "빌딩", "은행", "비즈니스", "업무 지구", "オフィス街", "business"],
    palette: ["concrete_grey", "asphalt", "arcade_skylight_slate", "vending_cool_white"], season: "autumn", timeOfDay: "day", size: [50, 52],
    engine: { kind: "street", style: "shopping" },
  },
  // ─── B. 주거지·일상 골목 ───
  {
    no: 6, id: "quiet_residential", category: "residential", ko: "한적한 단독주택·담장 골목", ja: "閑静な住宅街", en: "Quiet Detached-House Lanes",
    pitch: "블록 담·생울타리 안 2층 단독주택, 카포트·커브 미러·전봇대가 선 생활도로.",
    keywords: ["주택가", "주거지", "단독주택", "동네", "住宅街", "residential"],
    palette: ["concrete_grey", "cream_stucco", "kawara_dark_tile", "pine_bamboo"], season: "spring", timeOfDay: "day", size: [50, 36],
    engine: { kind: "street", style: "residential" },
  },
  {
    no: 7, id: "danchi_complex", category: "residential", ko: "단치(공공 아파트 단지)와 작은 놀이터", ja: "団地と公園", en: "Danchi Housing Estate & Playground",
    pitch: "똑같은 5층 단치 동이 나란히 서고, 고무칩 놀이터·자전거 보관소·게시판이 동 사이를 채운다.",
    keywords: ["단치", "아파트 단지", "공영 주택", "놀이터", "団地", "danchi"],
    palette: ["concrete_grey", "pine_bamboo", "moss", "asphalt"], season: "summer", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "row", kits: ["jp-bldg-danchi5", "jp-bldg-danchi5", "jp-bldg-apart-steel2"], foot: 0.44, span: [0.02, 0.98], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.49, size: 2 },
      { op: "area", mat: M.gomu, box: [0.05, 0.57, 0.46, 0.8], clear: true },
      { op: "put", kit: "jp-lot-slide", at: [0.12, 0.66], onPath: true },
      { op: "put", kit: "jp-prop-swing", at: [0.24, 0.66], onPath: true },
      { op: "put", kit: "jp-jungle-gym", at: [0.36, 0.66], onPath: true },
      { op: "put", kit: "jp-prop-sandbox", at: [0.24, 0.76], onPath: true },
      { op: "put", kit: "jp-bike-shelter", at: [0.66, 0.6] },
      { op: "put", kit: "jp-keijiban", at: [0.86, 0.58] },
      { op: "band", mat: M.lane, dir: "h", at: 0.9, size: 3 },
      { op: "scatter", kits: ["jp-prop-tree-zelkova", "jp-prop-bench", "jp-gomi-box", "jp-tsutsuji-3", "jp-prop-tree-sakura"], n: 7, box: [0.5, 0.64, 0.98, 0.84] },
    ] },
  },
  {
    no: 8, id: "rail_crossing_neighborhood", category: "residential", ko: "철도 건널목과 선로변 주택가", ja: "踏切のある町", en: "Railway Crossing Neighborhood",
    pitch: "땡땡 울리는 踏切 차단기, 선로를 따라 낮은 집과 전봇대·커브 미러가 이어진다.",
    keywords: ["건널목", "踏切", "선로", "철길", "후미키리", "railway crossing", "fumikiri"],
    palette: ["asphalt", "gravel", "cream_stucco", "kawara_dark_tile"], season: "summer", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "band", mat: M.lane, dir: "v", at: 0.5, size: 4 },
      { op: "row", kits: ["jp-bldg-house-hip2", "jp-bldg-house-gable-garage", "jp-bldg-house-tile3", "jp-bldg-house-western", "jp-bldg-house-flat3"], foot: 0.4, span: [0.01, 0.99], gap: 1 },
      { op: "band", mat: M.lane, dir: "h", at: 0.45, size: 2 },
      { op: "band", mat: M.rail, dir: "h", at: 0.58, size: 2 },
      { op: "put", kit: "jp-fumikiri-v", at: [0.5, 0.58], onPath: true },
      { op: "put", kit: "jp-prop-train8-y", at: [0.18, 0.56], onPath: true },
      { op: "line", kit: "jp-pole-wood", dir: "h", at: 0.49, span: [0.06, 0.94], step: 12 },
      { op: "band", mat: M.lane, dir: "h", at: 0.7, size: 2 },
      { op: "row", kits: ["jp-bldg-house-hiraya", "jp-bldg-apart-wood2", "jp-bldg-house-shed-modern", "jp-bldg-house-hiraya-gable"], foot: 0.99, span: [0.01, 0.99], gap: 1 },
      { op: "scatter", kits: ["jp-prop-curve-mirror", "jp-pots", "jp-monohoshi", "jp-prop-cat-sit"], n: 4, box: [0.02, 0.64, 0.98, 0.76], onPath: true },
    ] },
  },
  {
    no: 9, id: "slope_stair_town", category: "residential", ko: "언덕길 계단 마을", ja: "坂と階段の町", en: "Hillside Stair Town",
    pitch: "바다를 내려다보는 비탈에 집이 층층이 앉고, 돌계단과 골목 고양이가 층을 잇는다(오노미치·나가사키풍).",
    keywords: ["언덕", "계단 마을", "비탈", "오노미치", "나가사키", "坂", "slope", "stair"],
    palette: ["paving_stone", "cream_stucco", "kawara_dark_tile", "canal_indigo"], season: "spring", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "area", mat: M.sea, box: [0, 0, 1, 0.09], clear: true },
      { op: "band", mat: M.walk, dir: "h", at: 0.11, size: 1 },
      { op: "row", kits: ["jp-bldg-house-hiraya-gable", "jp-bldg-house-machiya", "jp-bldg-house-hiraya"], foot: 0.36, span: [0.02, 0.45], gap: 1 },
      { op: "row", kits: ["jp-bldg-house-tile3", "jp-bldg-house-western", "jp-bldg-shop-dagashi"], foot: 0.36, span: [0.6, 0.99], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.4, size: 2 },
      { op: "band", mat: M.walk, dir: "v", at: 0.52, size: 3, span: [0.1, 1] },
      { op: "put", kit: "jp-prop-stairs-stone8", at: [0.52, 0.24], onPath: true },
      { op: "put", kit: "jp-prop-stairs-stone8", at: [0.52, 0.6], onPath: true },
      { op: "row", kits: ["jp-bldg-house-hip2", "jp-bldg-house-tile3"], foot: 0.74, span: [0.02, 0.45], gap: 1 },
      { op: "row", kits: ["jp-bldg-house-hiraya", "jp-bldg-house-shed-modern"], foot: 0.74, span: [0.6, 0.99], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.78, size: 2 },
      { op: "scatter", kits: ["jp-prop-cat-sit", "jp-prop-cat-loaf", "jp-pots", "jp-prop-tree-sakura", "jp-monohoshi"], n: 7, box: [0.02, 0.82, 0.98, 0.99] },
    ] },
  },
  {
    no: 10, id: "machiya_quarter", category: "residential", ko: "전통 마치야 목조 가옥 보존지구", ja: "町家の町並み保存地区", en: "Preserved Machiya Quarter",
    pitch: "격자창 마치야가 돌길 양쪽에 처마를 맞대고, 초롱 기둥·인력거가 선다(교토 산넨자카·가나자와풍).",
    keywords: ["마치야", "전통 가옥", "보존지구", "교토", "町家", "machiya", "kyoto"],
    palette: ["machiya_timber", "kawara_dark_tile", "shrine_flagstone", "lantern_amber"], season: "autumn", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.gravel, ops: [
      { op: "row", kits: ["jp-bldg-house-machiya", "jp-recipe-machiya-izakaya", "jp-bldg-shop-wagashi", "jp-bldg-house-machiya", "jp-recipe-l-machiya-annex", "jp-bldg-shop-soba"], foot: 0.42, span: [0.01, 0.99], gap: 0 },
      { op: "band", mat: M.ishidatami, dir: "h", at: 0.5, size: 4 },
      { op: "line", kit: "jp-prop-lantern-post", dir: "h", at: 0.45, span: [0.06, 0.94], step: 7, onPath: true },
      { op: "put", kit: "jp-prop-ricksha-cart", at: [0.62, 0.52], onPath: true },
      { op: "row", kits: ["jp-bldg-house-nagaya", "jp-bldg-house-machiya", "jp-bldg-shop-sake", "jp-bldg-house-machiya"], foot: 0.92, span: [0.01, 0.99], gap: 1 },
      { op: "band", mat: M.ishidatami, dir: "h", at: 0.96, size: 2 },
      { op: "scatter", kits: ["jp-pots", "jp-prop-stone-lantern", "jp-prop-cat-loaf"], n: 4, box: [0.02, 0.57, 0.98, 0.64] },
    ] },
  },
  // ─── C. 학원·문화·공공 ───
  {
    no: 11, id: "high_school_grounds", category: "campus_civic", ko: "고등학교 캠퍼스와 흙 운동장·벚나무 교문", ja: "高校の校庭", en: "High School & Dirt Schoolyard",
    pitch: "4층 교사와 체육관, 흙 운동장 트랙과 축구 골대, 교문 옆 벚나무·니노미야 동상.",
    keywords: ["학교", "고등학교", "중학교", "운동장", "교정", "高校", "学校", "school"],
    palette: ["concrete_grey", "tatami_straw", "sakura_petal", "pine_bamboo"], season: "spring", timeOfDay: "day", size: [52, 40],
    alsoWith: "modern_campus 칩셋의 compose_campus_grounds(style:\"school\") - 한국·서양 학교 변형",
    engine: { kind: "scene", ground: M.school, ops: [
      { op: "row", kits: ["jp-bldg-school", "jp-bldg-school-gym"], foot: 0.28, span: [0.02, 0.98], gap: 2 },
      { op: "band", mat: M.walk, dir: "h", at: 0.32, size: 2 },
      { op: "put", kit: "jp-school-track-l", at: [0.38, 0.66] },
      { op: "put", kit: "jp-chorei-dai", at: [0.38, 0.39] },
      { op: "put", kit: "jp-flagpoles", at: [0.08, 0.42] },
      { op: "put", kit: "jp-souko", at: [0.85, 0.4] },
      { op: "put", kit: "jp-ball-net", at: [0.93, 0.56] },
      { op: "put", kit: "jp-teaarai", at: [0.84, 0.52] },
      { op: "put", kit: "jp-hyakuyoubako", at: [0.76, 0.48] },
      { op: "put", kit: "jp-ninomiya", at: [0.84, 0.84] },
      { op: "put", kit: "jp-school-gate-l", at: [0.86, 0.96] },
      { op: "line", kit: "jp-prop-tree-sakura", dir: "v", at: 0.97, span: [0.4, 0.86], step: 7 },
      { op: "scatter", kits: ["jp-tetsubo", "jp-noboribou", "jp-tires", "jp-kadan"], n: 4, box: [0.72, 0.62, 0.92, 0.82] },
    ] },
  },
  {
    no: 12, id: "university_avenue", category: "campus_civic", ko: "대학교 은행나무 가로수 캠퍼스", ja: "大学のイチョウ並木", en: "University Ginkgo Avenue",
    pitch: "노란 은행나무 두 줄이 정문에서 시계탑까지 이어지고, 강의동·잔디 광장·자전거 보관소가 양옆에 선다(도쿄대 혼고풍).",
    keywords: ["대학", "대학교", "캠퍼스", "은행나무", "가로수", "大学", "university", "ginkgo"],
    palette: ["paving_stone", "lantern_amber", "concrete_grey", "pine_bamboo"], season: "autumn", timeOfDay: "day", size: [48, 36],
    alsoWith: "modern_campus 칩셋의 compose_campus_grounds(style:\"university\")",
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "band", mat: M.walk, dir: "v", at: 0.5, size: 4 },
      { op: "row", kits: ["jp-bldg-office6", "jp-bldg-clinic"], foot: 0.5, span: [0.02, 0.4], gap: 1 },
      { op: "row", kits: ["jp-bldg-post-office", "jp-bldg-office6"], foot: 0.5, span: [0.6, 0.99], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.55, size: 2 },
      { op: "line", kit: "jp-prop-tree-ginkgo", dir: "v", at: 0.41, span: [0.6, 0.98], step: 7 },
      { op: "line", kit: "jp-prop-tree-ginkgo", dir: "v", at: 0.59, span: [0.6, 0.98], step: 7 },
      { op: "put", kit: "jp-lot-clock", at: [0.5, 0.12], onPath: true },
      { op: "put", kit: "jp-bike-shelter", at: [0.18, 0.66] },
      { op: "put", kit: "jp-lot-kiosk", at: [0.82, 0.64] },
      { op: "scatter", kits: ["jp-prop-bench", "jp-prop-tree-zelkova", "jp-tsutsuji-3", "jp-prop-lamp-post"], n: 8, box: [0.02, 0.72, 0.98, 0.98] },
    ] },
  },
  {
    no: 13, id: "neighborhood_park", category: "campus_civic", ko: "동네 근린공원과 시계탑·분수", ja: "近所の公園", en: "Neighborhood Park, Clock & Fountain",
    pitch: "십자 산책로 한가운데 분수와 시계 기둥, 연못·등나무 시렁·미끄럼틀, 벤치마다 고양이.",
    keywords: ["공원", "근린공원", "분수", "시계탑", "놀이터", "公園", "park"],
    palette: ["pine_bamboo", "moss", "paving_stone", "canal_indigo"], season: "spring", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "band", mat: M.walk, dir: "h", at: 0.5, size: 2 },
      { op: "band", mat: M.walk, dir: "v", at: 0.5, size: 2 },
      { op: "area", mat: M.pave, box: [0.42, 0.4, 0.58, 0.6], clear: true },
      { op: "put", kit: "jp-lot-fountain", at: [0.5, 0.5], onPath: true },
      { op: "put", kit: "jp-lot-clock", at: [0.6, 0.36] },
      { op: "area", mat: M.pond, box: [0.66, 0.64, 0.9, 0.86], clear: true },
      { op: "put", kit: "jp-fujidana", at: [0.78, 0.32] },
      { op: "area", mat: M.gomu, box: [0.06, 0.62, 0.38, 0.86], clear: true },
      { op: "put", kit: "jp-lot-slide", at: [0.12, 0.72], onPath: true },
      { op: "put", kit: "jp-prop-swing", at: [0.24, 0.72], onPath: true },
      { op: "put", kit: "jp-prop-sandbox", at: [0.33, 0.8], onPath: true },
      { op: "scatter", kits: ["jp-prop-tree-sakura", "jp-prop-tree-zelkova", "jp-tsutsuji-3", "jp-prop-bench", "jp-prop-cat-sit"], n: 12, box: [0.02, 0.02, 0.98, 0.98] },
    ] },
  },
  {
    no: 14, id: "civic_museum_plaza", category: "campus_civic", ko: "시립 도서관·박물관 광장", ja: "市立図書館・博物館前広場", en: "Civic Library & Museum Plaza",
    pitch: "넓은 판석 광장 뒤로 박물관·도서관·우체국이 서고, 분수·동상·느티나무 줄이 버스 정류장까지 이어진다(우에노 공원 앞풍).",
    keywords: ["도서관", "박물관", "미술관", "시청", "광장", "博物館", "図書館", "museum", "library"],
    palette: ["paving_stone", "concrete_grey", "cream_stucco", "pine_bamboo"], season: "autumn", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.pave, ops: [
      { op: "row", kits: ["jp-bldg-post-office", "jp-bldg-market-hall", "jp-bldg-clinic"], foot: 0.36, span: [0.04, 0.96], gap: 2 },
      { op: "band", mat: M.walk, dir: "h", at: 0.41, size: 2 },
      { op: "put", kit: "jp-lot-fountain", at: [0.5, 0.56] },
      { op: "put", kit: "jp-prop-hachiko", at: [0.3, 0.55] },
      { op: "put", kit: "jp-ninomiya", at: [0.7, 0.55] },
      { op: "line", kit: "jp-prop-tree-zelkova", dir: "h", at: 0.7, span: [0.04, 0.96], step: 8 },
      { op: "band", mat: M.walk, dir: "h", at: 0.81, size: 2 },
      { op: "band", mat: M.road, dir: "h", at: 0.92, size: 4 },
      { op: "put", kit: "jp-prop-bus-r", at: [0.3, 0.93], onPath: true },
      { op: "line", kit: "jp-bus-stop", dir: "h", at: 0.78, span: [0.18, 0.4], step: 8 },
      { op: "scatter", kits: ["jp-prop-bench", "jp-keijiban", "jp-prop-lamp-post", "jp-prop-planter"], n: 6, box: [0.04, 0.46, 0.96, 0.64] },
    ] },
  },
  {
    no: 15, id: "matsuri_festival_grounds", category: "campus_civic", ko: "여름 축제(마츠리) 야시장 마당", ja: "夏祭りの縁日", en: "Summer Matsuri Night Fair",
    pitch: "신사 경내 참배길 양쪽으로 포장마차가 줄을 서고, 초롱 줄·노보리·석등이 밤을 밝힌다.",
    keywords: ["축제", "마츠리", "야시장", "여름 축제", "엔니치", "祭", "縁日", "matsuri", "festival"],
    palette: ["gravel", "lantern_amber", "torii_vermilion", "noren_indigo"], season: "summer", timeOfDay: "night", size: [48, 34],
    engine: { kind: "scene", ground: M.gravel, ops: [
      { op: "put", kit: "jp-bldg-shrine-haiden", at: [0.5, 0.24], foot: true },
      { op: "band", mat: M.pave, dir: "v", at: 0.5, size: 4, span: [0.26, 1] },
      { op: "line", kit: "rg-yatai", dir: "v", at: 0.36, span: [0.34, 0.92], step: 4 },
      { op: "line", kit: "rg-yatai", dir: "v", at: 0.64, span: [0.34, 0.92], step: 4 },
      { op: "line", kit: "jp-prop-string-lanterns4", dir: "v", at: 0.5, span: [0.34, 0.86], step: 6, onPath: true },
      { op: "put", kit: "jp-torii", at: [0.5, 0.95], onPath: true },
      { op: "line", kit: "jp-prop-stone-lantern", dir: "h", at: 0.3, span: [0.38, 0.62], step: 10 },
      { op: "scatter", kits: ["jp-prop-nobori-aka", "jp-prop-tree-zelkova", "jp-prop-nobori-sora", "jp-prop-bench"], n: 10, box: [0.02, 0.1, 0.24, 0.98] },
      { op: "scatter", kits: ["jp-prop-nobori-aka", "jp-prop-tree-zelkova", "jp-prop-nobori-sora", "jp-prop-bench"], n: 10, box: [0.76, 0.1, 0.98, 0.98] },
    ] },
  },
  // ─── D. 신사·사찰·역사 유적지 ───
  {
    no: 16, id: "torii_shrine_precinct", category: "sacred_historic", ko: "붉은 도리이 참배길과 산신사", ja: "千本鳥居の参道と山の社", en: "Vermilion Torii Path & Mountain Shrine",
    pitch: "주홍 도리이가 터널처럼 겹친 참배길이 삼나무 숲을 올라 배전에 닿는다(후시미 이나리풍).",
    keywords: ["신사", "도리이", "참배길", "이나리", "神社", "鳥居", "shrine", "torii"],
    palette: ["torii_vermilion", "pine_bamboo", "shrine_flagstone", "moss"], season: "autumn", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "put", kit: "jp-bldg-shrine-haiden", at: [0.5, 0.26], foot: true },
      { op: "band", mat: M.gravel, dir: "v", at: 0.5, size: 4, span: [0.28, 1] },
      { op: "line", kit: "jp-torii", dir: "v", at: 0.5, span: [0.4, 0.98], step: 3, onPath: true },
      { op: "put", kit: "jp-prop-chozuya", at: [0.28, 0.34] },
      { op: "put", kit: "jp-hokora-jizo", at: [0.7, 0.34] },
      { op: "line", kit: "jp-prop-stone-lantern", dir: "v", at: 0.42, span: [0.36, 0.95], step: 6 },
      { op: "line", kit: "jp-prop-stone-lantern", dir: "v", at: 0.58, span: [0.36, 0.95], step: 6 },
      { op: "scatter", kits: ["rg-sugi", "rg-sugi", "rg-bamboo-grove", "rg-maple"], n: 12, box: [0.01, 0.02, 0.36, 0.98] },
      { op: "scatter", kits: ["rg-sugi", "rg-sugi", "rg-bamboo-grove", "rg-maple"], n: 12, box: [0.64, 0.02, 0.99, 0.98] },
    ] },
  },
  {
    no: 17, id: "buddhist_temple_pagoda", category: "sacred_historic", ko: "불교 사찰과 오중탑·종루", ja: "五重塔と鐘楼のある寺", en: "Buddhist Temple, Pagoda & Bell Tower",
    pitch: "산문을 지나 향로 연기 너머 본당, 왼쪽에 오중탑, 오른쪽에 종루와 곰솔(센소지·호류지풍).",
    keywords: ["절", "사찰", "오중탑", "종루", "본당", "寺", "五重塔", "temple", "pagoda"],
    palette: ["kawara_dark_tile", "torii_vermilion", "gravel", "pine_bamboo"], season: "winter", timeOfDay: "dawn", size: [48, 36],
    engine: { kind: "scene", ground: M.gravel, ops: [
      { op: "put", kit: "jp-prop-honden", at: [0.5, 0.36], foot: true },
      { op: "band", mat: M.pave, dir: "v", at: 0.5, size: 4, span: [0.37, 1] },
      { op: "put", kit: "jp-prop-censer", at: [0.5, 0.52], onPath: true },
      { op: "put", kit: "jp-prop-sanmon6", at: [0.5, 0.99], foot: true, onPath: true },
      { op: "put", kit: "jp-prop-pagoda5", at: [0.13, 0.62], foot: true },
      { op: "put", kit: "rg-shoro", at: [0.84, 0.6] },
      { op: "line", kit: "jp-prop-stone-lantern", dir: "v", at: 0.44, span: [0.42, 0.82], step: 6 },
      { op: "line", kit: "jp-prop-stone-lantern", dir: "v", at: 0.56, span: [0.42, 0.82], step: 6 },
      { op: "scatter", kits: ["rg-pine", "rg-moss-buddha", "rg-pine", "jp-prop-tree-sakura"], n: 8, box: [0.02, 0.64, 0.98, 0.98] },
    ] },
  },
  {
    no: 18, id: "castle_moat_ruins", category: "sacred_historic", ko: "성곽 해자와 천수각 석벽 유적지", ja: "城跡の堀と石垣", en: "Castle Moat, Keep & Stone Walls",
    pitch: "흰 천수각이 石垣 위에 서고, 쪽빛 해자를 흙다리가 건너며 바깥 둑에 벚나무가 늘어선다(히메지·마쓰모토풍).",
    keywords: ["성", "성곽", "천수각", "해자", "석벽", "城", "天守", "castle", "moat"],
    palette: ["cream_stucco", "shrine_flagstone", "canal_indigo", "sakura_petal"], season: "spring", timeOfDay: "day", size: [48, 36],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "put", kit: "rg-tenshu", at: [0.5, 0.36], foot: true },
      { op: "band", mat: M.gravel, dir: "v", at: 0.5, size: 3, span: [0.37, 0.98] },
      { op: "line", kit: "rg-ishigaki", dir: "h", at: 0.48, span: [0.02, 0.98], step: 8 },
      { op: "band", mat: M.canal, dir: "h", at: 0.62, size: 4 },
      { op: "band", mat: M.walk, dir: "v", at: 0.5, size: 3, span: [0.54, 0.74] },
      { op: "band", mat: M.walk, dir: "h", at: 0.8, size: 2 },
      { op: "line", kit: "jp-prop-tree-sakura", dir: "h", at: 0.9, span: [0.04, 0.96], step: 7 },
      { op: "scatter", kits: ["rg-pine", "rg-pine", "jp-prop-stone-lantern"], n: 6, box: [0.02, 0.04, 0.98, 0.38] },
    ] },
  },
  {
    no: 19, id: "ancient_stone_ruins", category: "sacred_historic", ko: "고대 석조 유적·이끼 낀 석상 숲", ja: "苔むす石仏と古代遺跡の森", en: "Ancient Stone Ruins & Mossy Statues",
    pitch: "삼나무 숲 그늘에 무너진 돌벽과 쓰러진 기둥, 이끼 낀 석불이 흩어진 오솔길(무로우지·아스카 석조물풍).",
    keywords: ["유적", "유적지", "석상", "석불", "고대", "이끼", "遺跡", "石仏", "ruins"],
    palette: ["shrine_flagstone", "moss", "pine_bamboo", "wet_cobble"], season: "summer", timeOfDay: "dawn", size: [48, 34],
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "band", mat: M.trail, dir: "v", at: 0.42, size: 2 },
      { op: "band", mat: M.trail, dir: "h", at: 0.6, size: 2, span: [0.42, 1] },
      { op: "area", mat: M.gravel, box: [0.55, 0.22, 0.8, 0.44] },
      { op: "put", kit: "rg-stone-ruin", at: [0.62, 0.3] },
      { op: "put", kit: "rg-stone-ruin", at: [0.74, 0.34] },
      { op: "line", kit: "rg-moss-buddha", dir: "h", at: 0.52, span: [0.56, 0.9], step: 4 },
      { op: "scatter", kits: ["rg-stone-ruin", "rg-moss-buddha", "jp-prop-stone-lantern"], n: 6, box: [0.02, 0.05, 0.98, 0.95] },
      { op: "scatter", kits: ["rg-sugi", "rg-sugi", "rg-bamboo-grove", "rg-maple"], n: 14, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  {
    no: 20, id: "jizo_mountain_pass", category: "sacred_historic", ko: "지조보살 석불 군락과 고개 쉼터", ja: "峠の地蔵と茶屋", en: "Jizo Statues & Mountain Pass Rest Stop",
    pitch: "산길이 만나는 고개에 붉은 턱받이 지장 행렬과 사당, 찻집 산장·약수터·이정표가 선다.",
    keywords: ["고개", "지조", "지장보살", "석불", "쉼터", "峠", "地蔵", "jizo", "pass"],
    palette: ["moss", "shrine_flagstone", "aged_cedar", "torii_vermilion"], season: "autumn", timeOfDay: "day", size: [48, 34],
    alsoWith: "snow_north 칩셋 - 눈 덮인 겨울 고개",
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "band", mat: M.trail, dir: "v", at: 0.5, size: 2 },
      { op: "band", mat: M.trail, dir: "h", at: 0.5, size: 2 },
      { op: "put", kit: "rg-lodge", at: [0.26, 0.42], foot: true },
      { op: "line", kit: "jp-jizo", dir: "h", at: 0.42, span: [0.58, 0.84], step: 2 },
      { op: "put", kit: "jp-hokora-jizo", at: [0.9, 0.42] },
      { op: "put", kit: "rg-doshirube", at: [0.55, 0.57] },
      { op: "put", kit: "rg-wakimizu", at: [0.42, 0.6] },
      { op: "put", kit: "jp-prop-bench", at: [0.3, 0.46] },
      { op: "scatter", kits: ["rg-sugi", "rg-maple", "rg-maple", "rg-pine"], n: 16, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  // ─── E. 산림·등산로·자연 비경 ───
  {
    no: 21, id: "bamboo_mountain_trail", category: "mountain_nature", ko: "삼나무·대나무숲 등산로와 약수터", ja: "竹林と杉の山道・湧き水", en: "Bamboo & Cedar Trail with Spring",
    pitch: "대숲이 양쪽 벽처럼 선 흙길이 삼나무 숲으로 오르고, 대나무 대롱 약수터와 이정표가 쉼표를 찍는다(아라시야마풍).",
    keywords: ["등산로", "대나무", "대숲", "산길", "약수터", "竹林", "山道", "trail", "bamboo"],
    palette: ["pine_bamboo", "moss", "aged_cedar", "onsen_mineral_teal"], season: "summer", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "band", mat: M.trail, dir: "v", at: 0.48, size: 3 },
      { op: "line", kit: "rg-bamboo-grove", dir: "v", at: 0.4, span: [0.02, 0.98], step: 6 },
      { op: "line", kit: "rg-bamboo-grove", dir: "v", at: 0.57, span: [0.02, 0.98], step: 6 },
      { op: "put", kit: "rg-wakimizu", at: [0.48, 0.5], onPath: true },
      { op: "put", kit: "rg-doshirube", at: [0.45, 0.8], onPath: true },
      { op: "scatter", kits: ["rg-sugi", "rg-sugi", "rg-bamboo-grove", "jp-prop-stone-lantern"], n: 18, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  {
    no: 22, id: "mountain_ropeway_lookout", category: "mountain_nature", ko: "산장·케이블카 전망대 고원", ja: "ロープウェイ山頂駅と展望台", en: "Ropeway Summit & Mountain Lodge Lookout",
    pitch: "로프웨이 산정역과 통나무 산장, 호수를 내려다보는 나무 데크 전망대(하코네·롯코산풍).",
    keywords: ["케이블카", "로프웨이", "전망대", "산장", "고원", "ロープウェイ", "展望台", "ropeway", "lookout"],
    palette: ["pine_bamboo", "aged_cedar", "concrete_grey", "canal_indigo"], season: "autumn", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.marsh, ops: [
      { op: "put", kit: "rg-ropeway", at: [0.24, 0.34], foot: true },
      { op: "put", kit: "rg-lodge", at: [0.72, 0.34], foot: true },
      { op: "band", mat: M.trail, dir: "h", at: 0.4, size: 2 },
      { op: "band", mat: M.trail, dir: "v", at: 0.5, size: 2, span: [0.4, 0.66] },
      { op: "band", mat: M.deck, dir: "h", at: 0.68, size: 3, span: [0.12, 0.88] },
      { op: "line", kit: "jp-prop-bench", dir: "h", at: 0.67, span: [0.18, 0.82], step: 8, onPath: true },
      { op: "area", mat: M.sea, box: [0, 0.8, 1, 1], clear: true },
      { op: "put", kit: "rg-doshirube", at: [0.55, 0.47] },
      { op: "scatter", kits: ["rg-pine", "rg-maple", "rg-sugi"], n: 10, box: [0.01, 0.02, 0.99, 0.74] },
    ] },
  },
  {
    no: 23, id: "gorge_waterfall_trail", category: "mountain_nature", ko: "계곡 출렁다리와 폭포 단풍길", ja: "渓谷の吊り橋と滝の紅葉道", en: "Gorge Suspension Bridge & Waterfall",
    pitch: "이끼 절벽의 폭포가 계류로 흘러내리고, 출렁다리가 협곡을 건너며 단풍이 양쪽 산길을 물들인다.",
    keywords: ["계곡", "폭포", "출렁다리", "단풍", "협곡", "渓谷", "滝", "吊り橋", "gorge", "waterfall"],
    palette: ["autumn_maple", "onsen_mineral_teal", "moss", "aged_cedar"], season: "autumn", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "band", mat: M.canal, dir: "v", at: 0.56, size: 5, span: [0.16, 1] },
      { op: "put", kit: "rg-waterfall", at: [0.56, 0.18], foot: true, onPath: true },
      { op: "band", mat: M.trail, dir: "h", at: 0.56, size: 2, span: [0, 0.48] },
      { op: "band", mat: M.trail, dir: "h", at: 0.56, size: 2, span: [0.64, 1] },
      { op: "put", kit: "rg-tsuribashi", at: [0.56, 0.56], onPath: true },
      { op: "put", kit: "rg-doshirube", at: [0.2, 0.5] },
      { op: "scatter", kits: ["rg-maple", "rg-maple", "rg-sugi", "rg-stone-ruin"], n: 16, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  {
    no: 24, id: "alpine_marsh_boardwalk", category: "mountain_nature", ko: "고원 습원 나무데크 탐방로", ja: "高層湿原の木道", en: "Alpine Marsh Boardwalk",
    pitch: "풀빛 습원 위로 나무 데크가 갈래를 치고, 하늘을 비춘 작은 못(池塘)이 점점이 놓인다(오제·가미코치풍).",
    keywords: ["습원", "습지", "나무데크", "탐방로", "오제", "湿原", "木道", "marsh", "boardwalk"],
    palette: ["moss", "aged_cedar", "onsen_mineral_teal", "pine_bamboo"], season: "summer", timeOfDay: "dawn", size: [48, 34],
    engine: { kind: "scene", ground: M.marsh, ops: [
      { op: "area", mat: M.pond, box: [0.56, 0.12, 0.84, 0.36], clear: true },
      { op: "area", mat: M.pond, box: [0.08, 0.66, 0.26, 0.86], clear: true },
      { op: "area", mat: M.pond, box: [0.64, 0.66, 0.78, 0.8], clear: true },
      { op: "band", mat: M.deck, dir: "h", at: 0.5, size: 2 },
      { op: "band", mat: M.deck, dir: "v", at: 0.36, size: 2, span: [0.5, 1] },
      { op: "band", mat: M.deck, dir: "v", at: 0.5, size: 2, span: [0.06, 0.5] },
      { op: "put", kit: "rg-lodge", at: [0.22, 0.4], foot: true },
      { op: "put", kit: "rg-doshirube", at: [0.47, 0.44] },
      { op: "line", kit: "jp-prop-bench", dir: "h", at: 0.5, span: [0.6, 0.9], step: 10, onPath: true },
      { op: "scatter", kits: ["rg-pine", "jp-tsutsuji", "jp-tsutsuji-3"], n: 9, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  {
    no: 25, id: "abandoned_forest_railway", category: "mountain_nature", ko: "폐선된 숲속 철길과 터널 유적", ja: "廃線跡と森のトンネル", en: "Abandoned Forest Railway & Tunnel",
    pitch: "녹슨 레일이 이끼 숲을 가로질러 담쟁이 덮인 벽돌 터널로 사라지고, 버려진 간이역 대합실이 선로 곁에 남았다.",
    keywords: ["폐선", "폐역", "터널", "철길", "폐철도", "廃線", "トンネル", "abandoned railway", "tunnel"],
    palette: ["noren_rust", "moss", "machiya_timber", "pine_bamboo"], season: "summer", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.forest, ops: [
      { op: "band", mat: M.oldrail, dir: "h", at: 0.58, size: 2 },
      { op: "put", kit: "rg-tunnel", at: [0.92, 0.62], foot: true, onPath: true },
      { op: "put", kit: "rg-mujin-eki", at: [0.3, 0.54], foot: true },
      { op: "put", kit: "jp-train-car-a", at: [0.58, 0.58], onPath: true },
      { op: "band", mat: M.trail, dir: "v", at: 0.18, size: 2 },
      { op: "scatter", kits: ["rg-sugi", "rg-bamboo-grove", "rg-sugi", "rg-stone-ruin"], n: 18, box: [0.01, 0.02, 0.99, 0.98] },
    ] },
  },
  // ─── F. 온천·농어촌·해안 ───
  {
    no: 26, id: "onsen_ryokan_town", category: "onsen_rural_coast", ko: "온천 마을 거리(유후인·구사쓰풍)", ja: "温泉街と湯畑", en: "Onsen Ryokan Town & Yubatake",
    pitch: "湯畑에서 김이 오르고, 돌길 양쪽으로 료칸·대중탕·기념품 가게가 서며 노천탕이 숲 가장자리에 숨는다.",
    keywords: ["온천", "온천 마을", "료칸", "노천탕", "유바타케", "温泉", "旅館", "onsen", "ryokan"],
    palette: ["onsen_mineral_teal", "wet_cobble", "machiya_timber", "lantern_amber"], season: "winter", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.gravel, ops: [
      { op: "row", kits: ["jp-bldg-sento", "jp-bldg-house-machiya", "jp-recipe-l-machiya-annex", "jp-bldg-shop-wagashi", "jp-bldg-house-tile3"], foot: 0.4, span: [0.01, 0.99], gap: 1 },
      { op: "band", mat: M.ishidatami, dir: "h", at: 0.47, size: 4 },
      { op: "line", kit: "jp-prop-lantern-post", dir: "h", at: 0.42, span: [0.08, 0.92], step: 8, onPath: true },
      { op: "area", mat: M.canal, box: [0.36, 0.6, 0.64, 0.74], clear: true },
      { op: "line", kit: "rg-yukemuri", dir: "h", at: 0.66, span: [0.38, 0.62], step: 3, onPath: true },
      { op: "put", kit: "rg-rotenburo", at: [0.14, 0.72] },
      { op: "put", kit: "rg-rotenburo", at: [0.86, 0.74] },
      { op: "band", mat: M.ishidatami, dir: "h", at: 0.84, size: 2 },
      { op: "scatter", kits: ["rg-maple", "rg-pine", "jp-prop-stone-lantern", "rg-yukemuri"], n: 9, box: [0.01, 0.56, 0.99, 0.99] },
    ] },
  },
  {
    no: 27, id: "terraced_rice_village", category: "onsen_rural_coast", ko: "계단식 논밭(다랑논)과 농가 마을", ja: "棚田と農村集落", en: "Terraced Rice Paddies & Farm Village",
    pitch: "산비탈 다랑논이 층층이 물을 담고, 허수아비·볏단 걸이·초가 농가가 논두렁 사이에 앉는다.",
    keywords: ["논", "다랑논", "계단식 논", "농촌", "농가", "시골", "棚田", "田んぼ", "rice", "paddy", "farm"],
    palette: ["moss", "tatami_straw", "canal_indigo", "aged_cedar"], season: "autumn", timeOfDay: "dusk", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "row", kits: ["jp-bldg-house-hiraya", "jp-bldg-house-hiraya-gable", "jp-bldg-machikoba-home", "jp-bldg-house-hiraya"], foot: 0.22, span: [0.02, 0.98], gap: 2 },
      { op: "band", mat: M.trail, dir: "h", at: 0.26, size: 2 },
      { op: "band", mat: M.paddy, dir: "h", at: 0.38, size: 4, span: [0.02, 0.92] },
      { op: "band", mat: M.paddy, dir: "h", at: 0.56, size: 4, span: [0.06, 0.96] },
      { op: "band", mat: M.paddy, dir: "h", at: 0.74, size: 4, span: [0.02, 0.88] },
      { op: "band", mat: M.trail, dir: "v", at: 0.12, size: 2, span: [0.26, 1] },
      { op: "line", kit: "rg-kakashi", dir: "h", at: 0.38, span: [0.3, 0.9], step: 14, onPath: true },
      { op: "line", kit: "rg-kakashi", dir: "h", at: 0.74, span: [0.24, 0.84], step: 16, onPath: true },
      { op: "line", kit: "rg-hazakake", dir: "h", at: 0.47, span: [0.22, 0.9], step: 10 },
      { op: "line", kit: "rg-hazakake", dir: "h", at: 0.65, span: [0.2, 0.9], step: 12 },
      { op: "scatter", kits: ["rg-sugi", "rg-maple", "jp-hokora-jizo"], n: 6, box: [0.01, 0.84, 0.99, 0.99] },
    ] },
  },
  {
    no: 28, id: "fishing_harbor_market", category: "onsen_rural_coast", ko: "항구 어시장과 방파제 등대", ja: "漁港の朝市と灯台", en: "Fishing Harbor Market & Lighthouse",
    pitch: "어시장 홀과 창고가 부두를 등지고, 大漁旗 어선이 정박하며 테트라포드 방파제 끝에 붉은 등대가 선다.",
    keywords: ["항구", "어항", "어시장", "부두", "등대", "방파제", "漁港", "港", "harbor", "lighthouse"],
    palette: ["canal_indigo", "wet_cobble", "concrete_grey", "vending_cool_white"], season: "winter", timeOfDay: "dawn", size: [48, 34],
    engine: { kind: "scene", ground: M.pave, ops: [
      { op: "row", kits: ["jp-bldg-market-hall", "jp-bldg-warehouse", "jp-bldg-shop-fish", "jp-bldg-factory"], foot: 0.32, span: [0.01, 0.99], gap: 1 },
      { op: "band", mat: M.walk, dir: "h", at: 0.37, size: 2 },
      { op: "area", mat: M.sea, box: [0, 0.6, 1, 1], clear: true },
      { op: "band", mat: M.pave, dir: "v", at: 0.78, size: 4, span: [0.6, 0.98] },
      { op: "put", kit: "rg-lighthouse", at: [0.78, 0.98], foot: true, onPath: true },
      { op: "line", kit: "rg-tetrapod", dir: "v", at: 0.86, span: [0.62, 0.92], step: 3, onPath: true },
      { op: "put", kit: "rg-fishing-boat", at: [0.2, 0.7], onPath: true },
      { op: "put", kit: "rg-fishing-boat", at: [0.5, 0.78], onPath: true },
      { op: "put", kit: "rg-fishing-boat", at: [0.3, 0.9], onPath: true },
      { op: "scatter", kits: ["jp-prop-van-white", "jp-gomi-box", "jp-prop-vend-pair", "jp-prop-ricksha-cart", "jp-prop-cone"], n: 6, box: [0.02, 0.42, 0.98, 0.57] },
    ] },
  },
  {
    no: 29, id: "coastal_seaside_road", category: "onsen_rural_coast", ko: "해변 모래사장과 방풍림 해안도로", ja: "海岸道路と防風林の砂浜", en: "Seaside Road, Pine Windbreak & Beach",
    pitch: "해안도로 아래로 곰솔 방풍림이 줄을 서고, 그 너머 모래사장과 파도, 테트라포드가 이어진다(쇼난·이즈풍).",
    keywords: ["해변", "해안", "모래사장", "바다", "해안도로", "방풍림", "海岸", "砂浜", "beach", "coast", "seaside"],
    palette: ["canal_indigo", "tatami_straw", "pine_bamboo", "asphalt"], season: "summer", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "row", kits: ["jp-bldg-house-western", "jp-bldg-shop-cafe", "jp-bldg-house-hiraya", "jp-bldg-shop-tabako", "jp-bldg-house-shed-modern"], foot: 0.28, span: [0.01, 0.99], gap: 1 },
      { op: "band", mat: M.curb, dir: "h", at: 0.32, size: 2 },
      { op: "band", mat: M.road, dir: "h", at: 0.4, size: 4 },
      { op: "put", kit: "jp-prop-car-white", at: [0.2, 0.4], onPath: true },
      { op: "put", kit: "jp-prop-bus-r", at: [0.66, 0.4], onPath: true },
      { op: "line", kit: "rg-pine", dir: "h", at: 0.54, span: [0.03, 0.97], step: 5 },
      { op: "area", mat: M.sand, box: [0, 0.64, 1, 0.82] },
      { op: "area", mat: M.sea, box: [0, 0.82, 1, 1], clear: true },
      { op: "line", kit: "rg-tetrapod", dir: "h", at: 0.84, span: [0.62, 0.98], step: 5, onPath: true },
      { op: "put", kit: "rg-fishing-boat", at: [0.24, 0.93], onPath: true },
      { op: "scatter", kits: ["jp-prop-bench", "jp-prop-vend-pair", "jp-gomi-box"], n: 4, box: [0.02, 0.66, 0.98, 0.8] },
    ] },
  },
  {
    no: 30, id: "rural_wayside_station", category: "onsen_rural_coast", ko: "시골 무인 간이역과 해바라기 들판", ja: "無人駅とひまわり畑", en: "Rural Unmanned Station & Sunflower Field",
    pitch: "한 칸짜리 무인역 대합실과 홑선 선로, 그 앞으로 해바라기 들판이 펼쳐지고 나무 전봇대와 자판기 하나가 여름을 지킨다.",
    keywords: ["무인역", "간이역", "시골역", "해바라기", "들판", "無人駅", "ひまわり", "rural station", "sunflower"],
    palette: ["lantern_amber", "pine_bamboo", "aged_cedar", "gravel"], season: "summer", timeOfDay: "day", size: [48, 34],
    engine: { kind: "scene", ground: M.lawn, ops: [
      { op: "band", mat: M.rail, dir: "h", at: 0.36, size: 2 },
      { op: "put", kit: "rg-mujin-eki", at: [0.36, 0.32], foot: true },
      { op: "put", kit: "jp-prop-vending-aka", at: [0.5, 0.3] },
      { op: "line", kit: "jp-pole-wood", dir: "h", at: 0.2, span: [0.05, 0.95], step: 12 },
      { op: "band", mat: M.trail, dir: "v", at: 0.62, size: 2, span: [0.38, 1] },
      { op: "band", mat: M.trail, dir: "h", at: 0.42, size: 2 },
      { op: "scatter", kits: ["rg-sunflower"], n: 26, box: [0.02, 0.48, 0.98, 0.98] },
      { op: "put", kit: "rg-kakashi", at: [0.8, 0.7] },
      { op: "scatter", kits: ["rg-sugi", "rg-pine"], n: 5, box: [0.02, 0.02, 0.98, 0.14] },
    ] },
  },
];

export const JP_REGIONS: readonly JpRegion[] = DEFS.map((d) => ({ ...d, harmony: HARMONY[d.category] }));

export function jpRegionById(id: string): JpRegion | undefined { return JP_REGIONS.find((r) => r.id === id); }

/** 요청 문장에 가장 많이 걸리는 지역(낱말 수). 없으면 빈 배열. */
export function searchJpRegions(query: string, limit = 5): JpRegion[] {
  const q = query.toLowerCase();
  return JP_REGIONS.map((r) => ({ r, score: r.keywords.filter((k) => q.includes(k.toLowerCase())).length + (q.includes(r.id) ? 3 : 0) }))
    .filter((s) => s.score > 0).sort((a, b) => b.score - a.score || a.r.no - b.r.no).slice(0, limit).map((s) => s.r);
}

/** 조수가 읽는 한 줄 목록. */
export function jpRegionBrief(r: JpRegion): string {
  const cat = JP_REGION_CATEGORIES.find((c) => c.id === r.category)!;
  return `${cat.letter}${r.no} ${r.id} ${r.ko}(${r.ja}) - ${r.pitch}`;
}
