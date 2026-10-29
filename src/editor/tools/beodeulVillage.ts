// editor/tools/beodeulVillage.ts — 버들항 「마을 문법」 시공기(author_beodeul_town theme ≠ city, 2026-10-01).
//
// 왜: author_beodeul_town 은 로마풍 블록 격자(bd-block-*)만 깔았다. 「마을 만들어 줘」에 바둑판 도시가 나왔고(r1 시험, 60×59),
// 사용자가 고른 버들항 변형 마을(포구·방앗간·포도원·장터, tiledata/beodeul-variants/<장소>/)과 달랐다.
// 그 변형들이 공통으로 따르는 배치 문법을 코드로 옮긴다(문서: tiledata/beodeul-city/references/bd-pick-doc-village-grammar.md):
//   1. 자연 앵커(강·바다·오아시스·얼음 못·늪)를 먼저 깐다 — 마을이 기대는 물.
//   2. 큰길 하나가 맵을 가로지른다(폭 2, 완만한 S자 굽이 — 열쇠점 사이 smoothstep). 강을 건너는 곳은 곧게, 아치 다리.
//   3. 뒷길(폭 1~2)이 큰길과 이음길로 고리를 만든다(막다른 길 없음). 한쪽 끝은 맵 가장자리 출구.
//   4. 광장(결절점)을 큰길 위에 둔다 — 가운데 우물·모닥불, 둘레에 좌판·벤치·등, 북쪽에 앵커 건물(여관·회관·대상 숙소)이 광장을 본다.
//   5. 집은 길을 바라본다: 문이 남쪽이므로 길의 북쪽 띠에 앉고, 문 앞 칸이 길이다(물러앉으면 1칸 문 앞 길). 이웃은 같은 키트를 피하고
//      간격은 1~3칸, 가끔 마당(4~6칸)을 비워 나무 덩이를 심는다 — 길이 굽으니 지붕선도 따라 굽는다.
//   6. 용도별 소품 덩이: 광장(장), 일터(방앗간·포구·대상·얼음낚시), 집 옆(살림), 밭 가장자리(허수아비·볏단).
//   7. 바깥은 밭·숲 덩이로 맺는다(일렬 금지). 남은 빈 땅은 작은 덤불·풀꽃으로만 메운다.
// 결정적이다(같은 seed·크기·theme = 같은 마을). 키트의 층·통행(3/4 규칙)은 키트가 가진 그대로 찍는다(stamp_object).
//
// 형태(form, 2026-10-11): 위 1~7 은 「광장 마을(plaza)」 하나의 문법이었다. 실험(~/exp-chunks village-forms)에서
// 「가운데 광장·큰길 위 광장·북쪽 앵커」가 늘 같은 구도를 만드는 고정관념으로 확인돼, 마을이 왜 거기 생겼나에 따라 넷으로 나눈다.
//   plaza     광장 마을 — 위 문법 그대로(장터·교역지).
//   street    길가 마을 — 광장 없이 큰길·뒷길. 앵커는 이유 있는 자리(다리 머리·포구 길 어귀·오아시스 쪽·마을 어귀)에 작은 판석 어귀와 우물 하나.
//   riverbank 물가 띠 마을(강만) — 큰길이 넓은 둑을 따라 남북으로, 들길 하나가 가장자리에서 들어온다. 앵커는 들길 어귀.
//   scatter   흩어진 마을 — 모랫길 폭 1, 집 간격 4~8칸, 갈림길 하나가 모이는 곳. 풀밭 마을은 집마다 울타리 텃밭.
// 밭은 형태와 상관없이 이어진 울타리로 두른다(풀밭 마을만 — 울타리 조각이 숲 계열이다). 문 한 칸은 길 쪽.
import { createBeodeulGroundTileset, ensureBeodeulGroundReferences } from "@/project/defaults/beodeulGround";
import { translateTiles } from "@/project/objectStamp";
import groundCatalog from "@/assets/beodeulGroundCatalog.json";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { planBeodeulCanopy, shapeBeodeulCanopyMask, type BeodeulForestType } from "./beodeulForest";
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "@/project/relief/walk";
import type { ReliefData } from "@/project/relief/types";
import { stampTownWall, townWallAvailable, townWallLayout, type TownWallPlan, type WallGap, type WallGate, type WallTower } from "./beodeulTownWall";
import { allowedVillageTerrains, planVillageTerrain, resolveVillageTerrain, TERRAIN_LABEL, VILLAGE_TERRAINS } from "./beodeulTerrain";
import { carveHeightFirstWater, defaultLandform, parseHigh, parseLandform, parseSettle, parseTiers, planHeightFirst, type HeightFirstPlan, type VillageLandform } from "./beodeulHeightFirst";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import type { CodeTerrain } from "./beodeulTerrainGen";
import { autoLayout, pathRuns, routePath, type LayoutPoint, type VillageLayout } from "./beodeulCodeLayout";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition } from "./types";
import { analyzeCityForm } from "./cityForm";
import { beginConstructionTiles, logConstructionPlan, logConstructionTiles } from "./constructionLog";

export const BEODEUL_VILLAGE_THEMES = ["river", "coast", "desert", "snow", "swamp"] as const;
export type BeodeulVillageTheme = (typeof BEODEUL_VILLAGE_THEMES)[number];
export const BEODEUL_VILLAGE_FORMS = ["plaza", "street", "riverbank", "scatter"] as const;
export type BeodeulVillageForm = (typeof BEODEUL_VILLAGE_FORMS)[number];
const FORM_LABEL: Record<BeodeulVillageForm, string> = { plaza: "광장 마을", street: "길가 마을", riverbank: "물가 띠 마을", scatter: "흩어진 마을" };
/** form 을 생략했을 때 seed 로 고르는 후보 — 모델이 인자를 빼도 늘 광장 마을이 나오지 않게. */
const DEFAULT_FORMS: Record<BeodeulVillageTheme, BeodeulVillageForm[]> = {
  // 광장(plaza)은 기본 후보에서 뺐다(2026-10-11 — 「중심 광장을 기본으로 삼지 말 것」인데 늪 seed 7 이 광장으로 나왔다). 장터일 때 form:"plaza" 로 명시한다.
  river: ["street", "riverbank", "scatter"], coast: ["street", "scatter"],
  desert: ["street", "scatter"], snow: ["street", "scatter"], swamp: ["street", "scatter"],
};
/** theme 에서 지을 수 있는 형태(물가 띠는 강이 있어야 한다). */
export function allowedVillageForms(theme: BeodeulVillageTheme): BeodeulVillageForm[] {
  return theme === "river" ? [...BEODEUL_VILLAGE_FORMS] : ["plaza", "street", "scatter"];
}
/** 형태를 정한다. 생략하면 seed 로(본 시공의 난수열과 따로 — 같은 seed 의 광장 마을이 예전과 같다). */
export function resolveVillageForm(theme: BeodeulVillageTheme, seed: number, form?: string): BeodeulVillageForm {
  if (form === undefined || form === "") { const xs = DEFAULT_FORMS[theme]; return xs[Math.floor(rng(seed * 2971 + 89)() * xs.length)]!; }
  if (!(BEODEUL_VILLAGE_FORMS as readonly string[]).includes(form)) throw new ToolError(`form 은 ${BEODEUL_VILLAGE_FORMS.join("|")} 중 하나다(받은 값: ${form}).`, { code: "invalid-args" });
  if (!allowedVillageForms(theme).includes(form as BeodeulVillageForm)) throw new ToolError(`form ${form} 은 theme ${theme} 에서 지을 수 없다(가능: ${allowedVillageForms(theme).join("|")}). 물가 띠(riverbank)는 강가 마을(river)만.`, { code: "invalid-args" });
  return form as BeodeulVillageForm;
}

const TS_ID = "beodeul_city";
const PAVING = "버들항 길 포석";
const PLAZA = "버들항 광장 판석";
const GRASS = "버들항 풀밭";
const WATER = "버들항 강·운하 물";

type Surface = { mat: string } | { kit: string };
interface ThemeSpec {
  label: string;
  size: [number, number];
  base: Surface; road: Surface; plaza: Surface;
  feature: "river" | "coast" | "pond" | "bog" | "none";
  pond?: { water: Surface; ring?: Surface; ringTrees: string[] };
  houses: string[]; anchors: string[];
  plazaCenter: string[]; plazaRing: string[]; plazaLamps: string[];
  home: string[]; work: string[]; workOnWater?: string[];
  field?: { decals?: string[]; sample?: Surface; kit?: string; edge: string[] };
  trees: string[]; shrubs: string[]; decals: string[];
}

/** 흩어진 마을 텃밭 안 — 밭두렁·배추 상자. */
const YARD_BEDS = ["bd-pick-wizard-tower-bed-herb", "bd-pick-wizard-tower-bed-flower", "bd-prop-crate_cabbage", "bd-pick-wizard-tower-bed-herb"];
const pick = (place: string, names: string): string[] => names.split(/\s+/).filter(Boolean).map((n) => `bd-pick-${place}-${n}`);
const CITY_HOUSES = "h101_0 h101_1 h102_0 h102_1 h103_0 h103_1 h103_2 h104_0 h106_1 h107_0 h107_1 h109_1 h110_0 h111_0 h111_1 h112_0 h113_0 h113_1 h116_0 h116_1 h117_0 h117_1 h119_0 h120_0 h122_0 h123_1 h129_0 h131_0 h132_0 h134_0 h135_0 h137_0 h138_0 h139_0"
  .split(" ").map((n) => `bd-house-${n}`);
// 지붕 팔레트(roofs, 2026-10-22 「마을을 시키면 다 비슷하다」): 강가·포구 마을의 집이 늘 붉은 기와(CITY_HOUSES)뿐이었다.
// AI 는 팔레트 이름 하나만 고르고(실험 H7 — ~/exp-creativity), 함수가 「주색 80%·둘째 20%」로 섞는다. 강조색은 앵커(여관 등)가 맡는다.
// 청회색·이끼·통나무 집은 사람이 허용한 건물(bd-house-rv-*, beodeul-building-review)에서 가게·탑·교회를 뺀 살림집만 고른다.
const rv = (names: string): string[] => names.split(/\s+/).filter(Boolean).map((n) => `bd-house-rv-${n}`);
// 중세 건물(medieval, 2026-10-25): bk-massing-100 덩어리 모형을 손 도트로 그려 3/4 관문 + 독립 검수 둘을 통과한 bd-house-mk-*(beodeulMassing).
// 아직 설치되지 않은 id 는 have() 가 거른다 — 목록은 이름만 미리 적어 둔다.
const mk = (names: string): string[] => names.split(/\s+/).filter(Boolean).map((n) => `bd-house-mk-${n}`);
const MEDIEVAL_ANCHORS = mk("town-hall market-hall chapel inn great-hall");
export const BEODEUL_ROOF_PALETTES = ["red", "slate", "moss", "log", "medieval"] as const;
export type BeodeulRoofPalette = (typeof BEODEUL_ROOF_PALETTES)[number];
export const ROOF_PALETTE_LABEL: Record<BeodeulRoofPalette, string> = { red: "붉은 기와", slate: "청회색 슬레이트", moss: "이끼 초가·너와", log: "통나무집", medieval: "중세 건물(목골·막돌·탑)" };
const ROOF_PALETTES: Record<BeodeulRoofPalette, { main: string[]; accent: string[] }> = {
  red: { main: CITY_HOUSES, accent: [] },
  slate: { main: rv("r6-02 r6-08 r9-05 r9-14 r9-16 r7-09 r9-08"), accent: rv("r2-10 r7-01 r9-01 r8-06 r9-17") },
  moss: { main: rv("r7-02 r8-02 r8-07 r9-02 r9-13 r9-18 r6-01 r6-06 r9-10"), accent: rv("r7-01 r9-01 r2-10") },
  log: { main: rv("r10-01 r10-03 r10-04 r10-05 r10-06"), accent: rv("r6-01 r8-07 r9-18") },
  medieval: {
    main: mk("cottage gable-cottage thouse jetty-house merchant-house dormer-house cross-house l-farmhouse longhouse tower-house"),
    // 비둘기탑·물레방앗간은 집이 아니다(2026-10-25 VQA: 비둘기탑이 길가 집으로, 물레방아 방앗간이 강에서 8칸 떨어진 뭍에 섰다) — 집 목록에서 뺀다
    accent: mk("inn smithy chapel brewery bakery guildhall market-hall warehouse"),
  },
};
/** roofs 를 생략하면 seed 로(붉은 기와 절반·이끼·청회색) — 같은 「평범한 마을」 요청이 늘 붉은 기와가 되지 않게. 늪·사막·설원은 자기 집 키트가 있어 쓰지 않는다. */
// 통나무(log)는 산골·숲속을 말할 때만 — 장터·성벽 마을이 seed 로 통나무 마을이 되면 어색했다(after2 실측: 생략한 넷 중 셋이 통나무).
const DEFAULT_ROOFS: Partial<Record<BeodeulVillageTheme, BeodeulRoofPalette[]>> = { river: ["red", "red", "moss", "slate"], coast: ["red", "red", "slate", "moss"] };
export function roofPalettesFor(theme: BeodeulVillageTheme): BeodeulRoofPalette[] { return DEFAULT_ROOFS[theme] ? [...BEODEUL_ROOF_PALETTES] : []; }
export function resolveRoofPalette(theme: BeodeulVillageTheme, seed: number, roofs?: string): BeodeulRoofPalette | null {
  const xs = DEFAULT_ROOFS[theme];
  if (!xs) return null;
  if (roofs === undefined || roofs === "") return xs[Math.floor(rng(seed * 4099 + 211)() * xs.length)]!;
  if (!(BEODEUL_ROOF_PALETTES as readonly string[]).includes(roofs)) throw new ToolError(`roofs 는 ${BEODEUL_ROOF_PALETTES.join("·")} 중 하나다(받은 값: ${roofs}).`, { code: "invalid-args" });
  return roofs as BeodeulRoofPalette;
}
/** 강가 마을(theme river)의 물: river 강이 맵을 세로로 지나고 다리 · none 강 없는 숲 빈터·언덕 마을(물레방아·나루 없음). 생략하면 seed 로(셋에 하나꼴 none). */
export const BEODEUL_VILLAGE_WATERS = ["river", "none"] as const;
export function resolveVillageWater(theme: BeodeulVillageTheme, seed: number, form: BeodeulVillageForm, water?: string): "river" | "none" | null {
  if (theme !== "river") return null;
  if (water !== undefined && water !== "") {
    if (!(BEODEUL_VILLAGE_WATERS as readonly string[]).includes(water)) throw new ToolError(`water 는 ${BEODEUL_VILLAGE_WATERS.join("·")} 중 하나다(받은 값: ${water}).`, { code: "invalid-args" });
    return form === "riverbank" ? "river" : water as "river" | "none";
  }
  if (form === "riverbank") return "river";
  return rng(seed * 6007 + 401)() < 0.45 ? "none" : "river";
}
/** 숲(river·coast·snow 마을): edge 마을 둘레 숲 덩이(기본) · dense 숲속 빈터 — 집·길·작은 밭 사이를 숲이 메운다(숲속 마을). */
export const BEODEUL_VILLAGE_WOODS = ["edge", "dense"] as const;
export interface BeodeulVillageOptions {
  /** 숲 밀도(edge·dense). 생략하면 edge. */
  woods?: string;
  /** 강가 마을의 물(river·none). 생략하면 seed 로. */
  water?: string;
  /** 지붕 팔레트(river·coast 만). 생략하면 seed 로. */
  roofs?: string;
  /** 살림집 상한(앵커 제외) — 「집 3~5채」 작은 마을. */
  houseLimit?: number;
  /** 마을 둘레 성벽(버들항 성벽 꼬리 28,544~). 평지로 짓고, 길이 성벽을 지나는 곳은 성문루(가로 성벽)·쪽문 터널(세로 성벽)이 된다. 눈·사막 마을은 눈 덮인 성벽·사암 성벽. */
  walls?: boolean;
  /** 성문 쪽(walls 일 때): S 남문 하나(기본) · N 북문 하나 · NS 남북 하나씩. 그 밖에서 성벽을 지나는 길은 성벽 안에서 끊는다. */
  wallGate?: "S" | "N" | "NS";
  /** true 면 서·동 성벽을 지나는 길에 쪽문 터널을 낸다(기본 false — 「성문 하나」 요청에 옆 구멍이 생기지 않게). */
  wallSideGaps?: boolean;
  /**
   * 쓰임 덩이 마당 자리(dress_village_quarter 가 깔 마당, 둘레 포함 칸 수). 밭·숲·덤불을 놓기 전에 길에 맞닿은 한 단 풀밭을 비워 둔다(CLEAR).
   * 2026-10-23 village-art r3: 다 지은 마을에서 마당을 내면 숲을 칸 선으로 베어 계단·반쪽 나무가 남았다 — 숲이 서기 전에 자리를 남긴다.
   */
  yard?: { w: number; h: number };
  /**
   * 지형 먼저(2026-10-29 기본 순서, beodeulHeightFirst.ts): 땅 모양을 먼저 짓고 큰길·뒷길·아랫길이 그 단의 등고선을 따라간다.
   * terraces(계단식 단)·hill(언덕)·slope(산비탈)·plateau(고원)·flat(평지 — 예전 시공, 지형이 큰길에 맞춰 깎인다).
   * 생략하면 terrain 낱말(terraces→terraces, hillside→hill, highland→slope, flat→flat)이나 테마·seed 로 고른다. 성벽 마을은 평지.
   */
  landform?: string;
  /** 마을이 앉는 단: middle(가운데, 남쪽에 낮은 단·아랫길·강, 기본)·low(맨 아래). */
  settle?: string;
  /** 마을 단 위 높은 단 겹 수(1~4). */
  tiers?: number;
  /** 높은 곳 자리: north(맵 폭 전체)·center·west·east. */
  high?: string;
  /**
   * 코드 지형(2026-10-30, beodeulTerrainGen.generateCodeTerrain): 높이맵·침식·강·단을 코드가 만든 지형. 주면 landform·settle·tiers·high·지형 먼저 띠를 쓰지 않고
   * 이 지형 위에 짓는다. 크기는 맵과 같아야 한다. 집·길 자리는 layout(조수가 고른 자리)을 따르고, 없으면 autoLayout 대체.
   */
  codeTerrain?: CodeTerrain;
  /** 코드 지형 위 자리(조수가 그림·요약을 보고 고른다) — 함수는 놓을 수 있는지·길 연결·도달만 검사하고 옮긴 자리·실패를 보고한다. */
  layout?: VillageLayout;
}
/** 지형 먼저: 맨 윗단 길의 높은 곳 건물(망루가 붙은 집·예배당·저택 · 사원·성자 무덤 · 회관·목욕집 · 사당). */
const TIER_LANDMARKS: Partial<Record<BeodeulVillageTheme, string[]>> = {
  river: ["bd-house-mk-tower-house", "bd-house-mk-chapel", "bd-house-mk-manor"],
  coast: ["bd-house-mk-tower-house", "bd-house-mk-chapel"],
  desert: ["bd-pick-desert-oasis-temple", "bd-pick-desert-oasis-shrine"],
  snow: ["bd-pick-snowfield-hall", "bd-pick-snowfield-bath"],
  swamp: ["bd-pick-swamp-stilt-shrine", "bd-pick-swamp-stilt-hall"],
};
/** 지형 먼저: 낮은 단 아랫길의 일터 건물(헛간·십일조 헛간·방앗간 곳간). */
const LOW_WORKS: Partial<Record<BeodeulVillageTheme, string[]>> = {
  river: ["bd-farm-barn", "bd-house-mk-tithe-barn", "bd-house-mk-granary-mill"],
  coast: ["bd-farm-barn", "bd-house-mk-warehouse"],
  snow: ["bd-pick-snowfield-shed"],
  swamp: ["bd-pick-swamp-stilt-pierhut"],
};
const LEAF_TREES = ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-47e17a", "bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-3e8732", "bd-tree-1a786c", "bd-tree-d61d7e", "bd-tree-7ecdb8", "bd-tree-1e09f0", "bd-tree-bdd36e", "bd-tree-b1d104"];
// 침엽·혼효 마을(forestType, woodland r3): 낱 나무도 숲과 같은 계열로 — 둥근 활엽 덤불이 침엽 마을을 덮지 않게(독립 검수 D10).
const CONIFER_TREES = ["bd-pick-coast-cliff-road-fir-l", "bd-pick-coast-cliff-road-fir-m", "bd-pick-coast-cliff-road-fir-m2", "bd-tree-eef4bc", "bd-tree-28ad5e", "bd-tree-c27062"];
const CONIFER_SHRUBS = ["bd-pick-coast-cliff-road-fir-s", "bd-tree-eef4bc", "bd-tree-c27062"];
const LEAF_SHRUBS = ["bd-tree-f4f319", "bd-tree-37f48b", "bd-tree-d105b2", "bd-tree-0f7ed1", "bd-tree-132848", "bd-mpart-bush-c", "bd-mpart-bush-e"];
const MEADOW = [...pick("deep-forest-path", "wild-a wild-b wild-c heath-a heath-b fern-a fern-b stones-a"), ...pick("wheat-roman-road", "wild-a wild-b")];

const THEMES: Record<BeodeulVillageTheme, ThemeSpec> = {
  river: {
    label: "강가 마을", size: [56, 44], base: { mat: GRASS }, road: { mat: PAVING }, plaza: { mat: PLAZA }, feature: "river",
    houses: CITY_HOUSES, anchors: ["bd-house-inn", "bd-house-h124_0", "bd-house-h104_1"],
    plazaCenter: ["bd-prop-well_roofed"], plazaRing: ["bd-prop-stall_veg", "bd-prop-stall_herb_flower", "bd-prop-flower_cart", "bd-prop-veg_cart", "bd-prop-crate_apple", "bd-prop-crate_cabbage", "bd-prop-bench_wood"], plazaLamps: ["bd-prop-lamp_crook"],
    home: ["bd-prop-door_pots", "bd-prop-laundry_rack", ...pick("riverside-mill", "laundry-line"), "bd-prop-flowerbox_long", "bd-out-woodpile", "bd-prop-planter_round"],
    work: [...pick("riverside-mill", "millstones flour-cart haystack wheat-stooks-a wheat-stooks-b"), ...pick("walled-market", "sack-pile hay-bales")],
    field: { decals: pick("wheat-roman-road", "wheat-a wheat-b wheat-c"), kit: "bd-pick-vineyard-vine-field", edge: [...pick("riverside-mill", "scarecrow wheat-stooks-a wheat-stooks-b haystack"), "bd-pick-wheat-roman-road-scarecrow"] },
    trees: LEAF_TREES, shrubs: LEAF_SHRUBS, decals: MEADOW,
  },
  coast: {
    label: "포구 마을", size: [56, 40], base: { mat: GRASS }, road: { mat: PAVING }, plaza: { mat: PLAZA }, feature: "coast",
    houses: CITY_HOUSES, anchors: ["bd-house-inn", "bd-house-h124_0", "bd-house-h122_0"],
    plazaCenter: ["bd-prop-well_roofed"], plazaRing: ["bd-prop-fish_crates", "bd-prop-fish_barrel", "bd-prop-crate_fish", "bd-prop-stall_veg", "bd-prop-sandwich_board", "bd-prop-bench_wood", "bd-prop-anchor_display"], plazaLamps: ["bd-prop-lamp_crook"],
    home: ["bd-prop-door_pots", "bd-prop-laundry_rack", "bd-prop-flowerbox_long", "bd-out-woodpile", "bd-prop-net_rack"],
    work: [...pick("fishing-port", "drying-rack-a drying-rack-b lobster-pots upturned-boat"), "bd-prop-net_rack", "bd-prop-fish_crates", "bd-prop-fish_barrel", "bd-prop-mooring_bollard"],
    workOnWater: ["bd-pick-coast-cliff-road-rowboat", "bd-pick-swamp-stilt-rowboat", "bd-pick-coast-cliff-road-rowboat"],
    field: { decals: pick("wheat-roman-road", "wheat-a wheat-b wheat-c"), edge: [...pick("riverside-mill", "scarecrow haystack")] },
    trees: LEAF_TREES, shrubs: LEAF_SHRUBS, decals: [...MEADOW, ...pick("coast-cliff-road", "heath-a heath-b heath-c")],
  },
  desert: {
    label: "사막 오아시스 마을", size: [58, 44], base: { kit: "bd-pick-desert-oasis-ground-sand" }, road: { kit: "bd-pick-desert-oasis-ground-road" }, plaza: { kit: "bd-pick-desert-oasis-ground-plaza" }, feature: "pond",
    pond: { water: { kit: "bd-pick-desert-oasis-ground-water" }, ring: { kit: "bd-pick-desert-oasis-ground-lawn" }, ringTrees: pick("desert-oasis", "palm palm reed") },
    houses: pick("desert-oasis", "n1 n2 n3 n4 n5 n6 s1 s2 s3 w1 w2 e2"), anchors: pick("desert-oasis", "khan temple"),
    plazaCenter: pick("desert-oasis", "well"), plazaRing: pick("desert-oasis", "stall stall jars rug bales"), plazaLamps: [],
    home: pick("desert-oasis", "jars oven datemat"), work: pick("desert-oasis", "camel tent bales hitch jars"),
    field: { sample: { kit: "bd-pick-desert-oasis-ground-field" }, edge: pick("desert-oasis", "bales jars") },
    trees: pick("desert-oasis", "palm palm cactus"), shrubs: pick("desert-oasis", "cactus scrub scrub rock"), decals: pick("desert-oasis", "scrub bones scrub"),
  },
  snow: {
    label: "설원 마을", size: [56, 44], base: { kit: "bd-pick-snowfield-ground-snow" }, road: { kit: "bd-pick-snowfield-ground-road" }, plaza: { kit: "bd-pick-snowfield-ground-plaza" }, feature: "pond",
    pond: { water: { kit: "bd-pick-snowfield-ground-ice" }, ringTrees: pick("snowfield", "pine rock") },
    houses: pick("snowfield", "e1 e2 n2 s1 s2 w1 w2 w3 hut shed"), anchors: pick("snowfield", "hall bath"),
    plazaCenter: pick("snowfield", "bonfire well"), plazaRing: pick("snowfield", "bench board bench fishcrates"), plazaLamps: pick("snowfield", "lamp"),
    home: pick("snowfield", "firewood pile sled stool snowman fence"), work: pick("snowfield", "netrack fishcrates sled firewood bollard"),
    workOnWater: pick("snowfield", "ice-boat ice-hole ice-row ice-hole"),
    trees: pick("snowfield", "pine pine rock"), shrubs: pick("snowfield", "rock mound pine"), decals: pick("snowfield", "mound"),
  },
  swamp: {
    label: "늪 수상 마을", size: [56, 44], base: { kit: "bd-pick-swamp-stilt-ground-mud" }, road: { kit: "bd-pick-swamp-stilt-ground-path" }, plaza: { kit: "bd-pick-swamp-stilt-ground-deck" }, feature: "bog",
    pond: { water: { kit: "bd-pick-swamp-stilt-ground-water" }, ring: { kit: "bd-pick-swamp-stilt-ground-bog" }, ringTrees: pick("swamp-stilt", "mangrove snag") },
    houses: pick("swamp-stilt", "e1 e2 e2-reed e3 n1 n2 s1 s2 s2-shingle w1 w2 w3 pierhut"), anchors: pick("swamp-stilt", "hall loom shrine"),
    plazaCenter: pick("swamp-stilt", "stall"), plazaRing: pick("swamp-stilt", "lantern fish-rack reed-stack crab-trap stall"), plazaLamps: pick("swamp-stilt", "lantern"),
    home: pick("swamp-stilt", "crab-trap reed-stack moss-log pilings"), work: pick("swamp-stilt", "fish-rack reed-stack crab-trap moss-log"),
    workOnWater: pick("swamp-stilt", "ducks rowboat fishing-boat ducks"),
    field: { sample: { kit: "bd-pick-swamp-stilt-ground-reedbed" }, edge: pick("swamp-stilt", "reed-stack") },
    trees: pick("swamp-stilt", "mangrove snag mangrove"), shrubs: pick("swamp-stilt", "moss-log reed-stack"), decals: pick("swamp-stilt", "crab-trap"),
  },
};

// 칸 점유(계획 단계)
/** 집 벽에 붙여야 읽히는 살림 소품(화분·화단 상자·둥근 화분·장작더미). */
const WALL_HUG = /door_pots|flowerbox|planter|woodpile/;
const FREE = 0, ROAD = 1, WATERC = 2, PLAZAC = 3, BLD = 4, PROP = 5, FIELD = 6, KEEP = 7, POND_RING = 8, FENCE = 9;
/** 비워 둔 걸음 자리(울타리 문 앞에서 길까지 — 바닥은 바탕 그대로, 나무·소품·밭이 앉지 않는다). */
const CLEAR = 10;
/** 숲 덩이(이어진 수관 오토타일이 덮는 막힌 칸, 2026-10-18). */
const FOREST = 11;
/** 성벽 둘레 띠(walls) — 집·나무·소품이 앉지 않는다. 길은 지나가도 된다(지나는 곳이 성문·틈). */
const WALLB = 12;
/** 시공 기록(constructionLog)에 싣는 계획 분류 이름 — 편집기가 밑그림 색을 고른다. */
const PLAN_CLASSES: Record<number, string> = { [ROAD]: "road", [WATERC]: "water", [PLAZAC]: "plaza", [BLD]: "building", [PROP]: "prop", [FIELD]: "field", [KEEP]: "keep", [POND_RING]: "ring", [FENCE]: "prop", [FOREST]: "prop", [WALLB]: "keep" };
const SAND_PATH = "버들항 모랫길";

interface Kit { id: string; w: number; h: number; door: { dx: number; dy: number } | null; def: StructureKitDef }
/** 언덕 절벽 양식(relief/styles.ts RELIEF_STYLES) — 풀밭은 잔디 둑 흙벽, 사막은 사암, 설원은 눈 둑, 늪은 이탄 둑. */
// 2026-10-30 「경사로를 전부 계단으로」: 같은 색·벽의 *-steps 양식 — 자동 계단(5~8)을 칩셋 bd-mpart-stairs 돌계단 화소로 칠한다(styles.ts·rampArt.json).
const RELIEF_STYLE: Record<BeodeulVillageTheme, string> = { river: "grass-steps", coast: "grass-steps", desert: "sand-steps", snow: "snow-steps", swamp: "peat-steps" };
interface Stamp { kit: string; x: number; y: number; record: boolean; /** 계획 분류(claim 이 찍은 것만) */ v?: number }
interface Street { name: string; cells: Set<number>; horizontal: boolean; width: number }

const requireTool = (tools: readonly ToolDefinition[], name: string): ToolDefinition => {
  const t = tools.find((c) => c.name === name); if (!t) throw new Error(`필수 툴 없음: ${name}`); return t;
};
const fillRegionTool = requireTool(CONSTRUCTION_TOOLS_V3, "fill_region");
const stampObjectTool = requireTool(SHARED_OBJECT_TOOLS, "stamp_object");

function rng(seed: number): () => number {
  let s = (seed ^ 0x5bd1e995) >>> 0;
  return () => { s = (Math.imul(s ^ (s >>> 15), 2246822507) + 0x9e3779b9) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
}
const smooth = (t: number) => t * t * (3 - 2 * t);

export function themeDefaultSize(theme: BeodeulVillageTheme): [number, number] { return THEMES[theme].size; }

export interface VillageResult {
  summary: string; data: Record<string, unknown>; warnings: string[];
}

/** 버들항 마을 문법 시공. map 은 이미 만들어진(크기 확정) 버들항 맵. */
export function buildBeodeulVillage(draft: Project, mapId: string, theme: BeodeulVillageTheme, seed: number, formArg?: string, terrainArg?: string, forestType: BeodeulForestType = "broadleaf", options: BeodeulVillageOptions = {}): VillageResult {
  let form = resolveVillageForm(theme, seed, formArg);
  const codeT = options.codeTerrain ?? null;
  // 코드 지형: 마을 모양은 조수가 고른 자리가 정한다 — 모이는 곳에 판석 광장(plaza false 면 우물만)
  // 흩어진 농가(scatter)를 청했으면 코드 지형에서도 길은 모두 흙 들길로 — 포장 큰길·골목이면 읍내로 읽혔다(ab14 들판 농가 두 판 모두 A)
  const scatterWanted = !!codeT && form === "scatter";
  if (codeT) form = options.layout?.gather?.plaza === false ? "street" : "plaza";
  const roofs = resolveRoofPalette(theme, seed, options.roofs);
  const water = resolveVillageWater(theme, seed, form, options.water);
  if (options.woods !== undefined && options.woods !== "" && !(BEODEUL_VILLAGE_WOODS as readonly string[]).includes(options.woods)) throw new ToolError(`woods 는 ${BEODEUL_VILLAGE_WOODS.join("·")} 중 하나다(받은 값: ${options.woods}).`, { code: "invalid-args" });
  const denseWoods = options.woods === "dense";
  const houseLimit = options.houseLimit !== undefined && Number.isInteger(options.houseLimit) && options.houseLimit > 0 ? options.houseLimit : Infinity;
  let terrainName: ReturnType<typeof resolveVillageTerrain>;
  const warnings0: string[] = [];
  let terrainNote = "";
  // 요청한 지형과 실제로 지은 지형을 따로 든다 — 대체는 요약 맨 앞에 적는다(경고에만 두면 모델이 「요청대로 지었다」고 거짓 보고했다, 2026-10-11 조수 실입력창 검수)
  const requestedTerrain = terrainArg === undefined || terrainArg === "" ? null : terrainArg;
  let terrainSwapped = false;
  try { terrainName = resolveVillageTerrain(theme, seed, terrainArg); } catch (e) {
    // 다른 theme 의 지형 이름(예: river 에 basin)은 거절하지 않고 이 theme 의 기본 지형으로 짓는다 — 선택 칸을 다 채워 보내는 모델이 있다
    if (!(VILLAGE_TERRAINS as readonly string[]).includes(terrainArg ?? "")) throw new ToolError((e as Error).message, { code: "invalid-args" });
    terrainName = resolveVillageTerrain(theme, seed);
    terrainSwapped = true;
    terrainNote = `요청한 지형 ${terrainArg}(${TERRAIN_LABEL[terrainArg as keyof typeof TERRAIN_LABEL]}) 는 이 테마(${theme})에서 못 쓴다 → ${terrainName}(${TERRAIN_LABEL[terrainName]}) 으로 지었다(가능: ${allowedVillageTerrains(theme).join("·")}).`;
  }
  // 성벽 마을은 평지로 — 성벽 둘레가 단을 넘지 않게(경사로·절벽 위 성벽 그림은 없다)
  const walls = options.walls === true && !codeT && townWallAvailable(draft.tilesets[TS_ID]);
  if (options.walls === true && !walls) warnings0.push("성벽 칸이 없는 옛 버들항 사본이라 성벽 없이 지었다(타일셋을 최신 번들로 갱신하면 성벽이 생긴다).");
  if (walls && terrainName !== "flat") { if (requestedTerrain !== null) terrainNote = `${terrainNote} 성벽 마을은 평지로 지었다(요청 지형 ${requestedTerrain} 대신 flat).`.trim(); terrainName = "flat"; }
  // 강 없는 마을(water none): 강가 마을 문법에서 물만 뺀다 — 큰길이 맵을 가로지르고, 일터는 물레방아 대신 타작마당
  const base: ThemeSpec = water === "none" ? { ...THEMES[theme], label: "숲 빈터 마을", feature: "none" } : THEMES[theme];
  // 흩어진 마을의 길은 포석이 아니라 모랫길(재료 길만 — 모래·눈·늪 표본 길은 그대로 폭 1)
  const spec0: ThemeSpec = form === "scatter" && "mat" in base.road ? { ...base, road: { mat: SAND_PATH } } : base;
  const spec: ThemeSpec = spec0.trees !== LEAF_TREES || forestType === "broadleaf" ? spec0
    : forestType === "conifer" ? { ...spec0, trees: CONIFER_TREES, shrubs: CONIFER_SHRUBS }
    : { ...spec0, trees: [...LEAF_TREES.slice(0, 7), ...CONIFER_TREES], shrubs: [...LEAF_SHRUBS.slice(0, 3), ...CONIFER_SHRUBS] };
  const fenced = "mat" in base.base; // 울타리 조각(숲 계열)은 풀밭 마을에만
  const ts: TilesetDef = draft.tilesets[TS_ID]!;
  const map0 = draft.maps[mapId]!;
  // 같은 mapId 로 다시 지을 때 옛 높이를 지운다 — 높이를 아는 stamp_object 가 시공 도중 옛 relief 를 보고 키트를 거절하지 않게(새 relief 는 12c 에서 싣는다)
  delete map0.relief;
  const W = map0.width, H = map0.height;
  if (codeT && (codeT.W !== W || codeT.H !== H)) throw new ToolError(`코드 지형 크기 ${codeT.W}×${codeT.H} 가 맵 ${W}×${H} 와 다르다.`, { code: "invalid-args" });
  const rand = rng(seed * 7919 + theme.length * 131 + 17);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const choice = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  /** 덩이 붙여 키우기: 이미 선 그루 p 곁 한 자리. 옆이면 위·아래로 한 칸 어긋나게(같은 줄 옆에 세우면 덤불·측백이 한 줄로 늘어섰다), 아니면 앞뒤로(수관이 겹친다). */
  const clumpNext = (p: { x: number; y: number; w: number; h: number }, k: { w: number; h: number }): [number, number] =>
    rand() < 0.6 ? [p.x + choice([-k.w, -k.w + 1, p.w - 1, p.w]), p.y + choice([-1, 1])]
      : [p.x + ri(-1, 1), p.y + choice([-(k.h - 1), p.h - 1, Math.max(1, Math.floor(p.h / 2))])];
  const warnings: string[] = [...(terrainNote ? [terrainNote] : []), ...warnings0];
  const openLand = theme === "desert" || theme === "snow"; // 모래·눈은 트인 땅이 자연 — 빈 덩이 40칸까지, 화면당 40%까지
  // 자연 덧그림(2026-10-11, beodeul_nature): 강·바다는 돌 둑 운하 대신 흙·풀 둑, 오아시스 풀밭은 모래 위에 둥근 가장자리로 얹는다
  const naturalWater = spec.feature === "river" || spec.feature === "coast";
  const lawnOverlay = theme === "desert";
  const lawnSet = new Set<number>(); // 오아시스 풀밭+못(나중에 나무·소품이 앉아도 가장자리 계산은 처음 모양으로)

  const kitIndex = new Map<string, Kit>();
  for (const k of ts.structureKits ?? []) {
    const ent = (k.parts ?? []).find((p) => p.kind === "entrance");
    // 허용 건물(bd-house-rv-*)의 문은 두 칸 높이(dy = 문 윗칸) — 문 앞 계산은 아랫칸 기준이라 아랫칸으로 맞춘다
    const doorDy = ent ? (reviewedPrefix(k.id) ? ent.dy + Math.max(1, ent.h ?? 1) - 1 : ent.dy) : 0;
    kitIndex.set(k.id, { id: k.id, w: k.width, h: k.height, door: ent ? { dx: ent.dx, dy: doorDy } : null, def: k });
  }
  const have = (ids: readonly string[]) => ids.filter((id) => kitIndex.has(id));
  const K = (id: string) => kitIndex.get(id)!;
  const doorAtBottom = (id: string) => { const d = K(id).door; return !!d && d.dy === K(id).h - 1; };
  const palette = roofs ? ROOF_PALETTES[roofs] : null;
  const houses = have(palette ? palette.main : spec.houses).filter(doorAtBottom);
  const accentHouses = palette ? have(palette.accent).filter(doorAtBottom) : [];
  if (houses.length < 3) throw new ToolError(`버들항 ${spec.label} 집 키트가 부족하다(${houses.length}). 타일셋을 최신 번들로 갱신할 것.`, { code: "beodeul-kits-missing" });

  const occ = new Uint8Array(W * H);
  const cover = new Uint8Array(W * H); // 키트 그림이 실제로 덮은 칸(투명 귀퉁이 제외) — 빈 바닥 비율용
  const idx = (x: number, y: number) => y * W + x;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const at = (x: number, y: number) => (inMap(x, y) ? occ[idx(x, y)]! : 255);
  const set = (x: number, y: number, v: number) => { if (inMap(x, y)) occ[idx(x, y)] = v; };
  const stamps: Stamp[] = [];
  // 자연 덧그림 팩은 이식 원본일 뿐(맵에 직접 칠하지 않는다) — 저장된 프로젝트의 옛 팩이 지금 목록보다 짧으면(울타리 조각 추가 등) 새로 만든다
  const natureTileset = () => { const t = draft.tilesets[BEODEUL_NATURE_ID]; return t && t.count >= BEODEUL_NATURE.count ? t : (draft.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset()); };
  const surfaceAt = new Map<number, Surface>(); // 바닥 덧칠(물 고리·밭 표본)
  const decalAt = new Set<number>(); // 바닥 소품(풀꽃·밀) 찍은 칸
  const onWater = new Set<number>(); // 물 위 소품(배·오리·얼음 구멍)이 앉은 칸 — 계획 칸은 물 그대로
  const keepRoad = new Set<number>(); // 막다른 길 깎기에서 지키는 길 끝(나루처럼 물가에서 끝나는 길)
  let ferry: { x: number; y: number } | null = null;
  // 시공 기록: 계획 구역이 끝날 때마다 격자를 남긴다(기록기가 꺼져 있으면 아무것도 안 한다).
  const planStep = (label: string) => logConstructionPlan(mapId, W, H, occ, label, PLAN_CLASSES);
  // 성벽 둘레 띠를 먼저 비워 둔다(집·나무·소품·물이 앉지 않는다). 길은 이 띠를 덮어쓸 수 있다 — 지나는 곳이 성문·틈이 된다.
  const wallLayout = walls ? townWallLayout(W, H, seed) : null;
  if (wallLayout) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (wallLayout.inBand(x, y)) occ[idx(x, y)] = WALLB;

  // ---------- 1. 자연 앵커 ----------
  let riverX = -1; // 강 왼쪽 열(다리 자리)
  let riverLeft = false;
  const shoreY: number[] = new Array(W).fill(H);
  // highland(산골): 큰길을 맵 아래쪽으로 내려 그 위에 비탈 세 단이 설 자리를 둔다
  // 높이 먼저(landform): 땅 모양과 마을 단을 물·길보다 먼저 정하고, 큰길 기준 줄을 그 단에서 꺼낸다
  let hf: HeightFirstPlan | null = null;
  let hfFlat = false;
  if (!codeT) {
    let landform: VillageLandform | undefined, settle, tiers, high;
    const flatAsked = options.landform === "flat" || (options.landform === undefined && requestedTerrain === "flat");
    try { landform = options.landform === "flat" ? undefined : parseLandform(options.landform); settle = parseSettle(options.settle); tiers = parseTiers(options.tiers); high = parseHigh(options.high); } catch (e) { throw new ToolError((e as Error).message, { code: "invalid-args" }); }
    // 지형 먼저가 기본 순서다 — landform 을 안 주면 terrain 낱말이나 테마·seed 로 고른다(평지는 flat 을 말했을 때만)
    if (!landform && !flatAsked && !walls) landform = requestedTerrain === "terraces" ? "terraces" : requestedTerrain === "hillside" ? "hill" : requestedTerrain === "highland" ? "slope" : defaultLandform(theme, seed);
    if (landform && walls) { if (options.landform) warnings.push(`성벽 마을은 평지로 지어 landform ${landform} 을 쓰지 않았다.`); }
    else if (landform) {
      // 둑길 마을(남북 강가 띠)은 남북 강을 따라 짓는 형태다 — 높이 먼저의 강은 남쪽 낮은 단에서 동서로 흐르므로 길가 마을로 짓는다
      if (form === "riverbank") { form = "street"; warnings.push(`높이 먼저(landform ${landform})라 둑길 마을 대신 길가 마을로 지었다 — 강은 남쪽 낮은 단에서 동서로 흐른다.`); }
      // 마을이 앉는 단을 안 주면 땅이 정한다: 강가·늪 마을은 물가 단(low)에 내려앉고(강·늪이 마을에 붙는다 — ab9 「맨 아래 강이 마을과 떨어졌다」·「늪 맵의 네모 물」), 그 밖은 가운데 단
      const settle1 = settle ?? (spec.feature === "river" || theme === "swamp" ? "low" : "middle");
      // 맨 윗단 폭·깊이는 이 테마의 가장 작은 높은 곳 건물에 맞춘다
      const lms = have(TIER_LANDMARKS[theme] ?? []).map((id) => K(id)).filter((k) => k.door);
      const need = lms.length ? lms.reduce((a, k) => (k.w * k.h < a.w * a.h ? { w: k.w, h: k.h } : a), { w: lms[0]!.w, h: lms[0]!.h }) : { w: 7, h: 6 };
      hf = planHeightFirst(W, H, seed, theme, landform, settle1, theme === "coast" ? Math.round(H * 0.72) - 3 : undefined, spec.feature === "river", tiers ?? (theme === "swamp" ? 1 : undefined), high, need);
      terrainName = hf.terrainName;
    } else if (flatAsked && spec.feature === "river" && !walls && form !== "riverbank") {
      // 평지 강가 마을도 땅 설계를 따른다: 강은 마을 남쪽 집 띠 바로 아래에서 동서로 흐르고 마을이 그 둑에 앉는다(단·절벽 없음).
      // 예전 평지 경로는 늘 「세로 강+다리+가로 큰길」 한 구도였다(2026-10-29 맵 반복 조사 24장 중 19장, b5 argon 「flat·river」 판).
      const p = planHeightFirst(W, H, seed, theme, "terraces", "low", undefined, true, 1, high);
      p.levels.fill(0);
      hf = { ...p, terrainName: "flat", seamAbove: null, seamBelow: null, aboveSpan: null, cliffEnds: [], plateauTop: null, summitFrom: 99,
        note: `평지 강가 · 마을이 강 둑에 앉는다 · 강은 남쪽에서 동서로` };
      hfFlat = true;
      terrainName = "flat";
    }
  }
  const yMainBase = hf ? hf.mainY(Math.round(W / 2)) : theme === "coast" ? Math.round(H * 0.4) : terrainName === "highland" ? Math.round(H * 0.66) + ri(-1, 1) : Math.round(H * 0.5) + ri(-2, 2);
  if (codeT) {
    // 코드 지형의 물(강·못·바다)을 그대로 — 강은 길이 곧게 건너는 널다리 자리, 못·바다는 건너지 않는다
    for (let c = 0; c < W * H; c += 1) if (codeT.water[c]) occ[c] = WATERC;
  } else if (spec.feature === "river" && hf?.riverY) {
    // 높이 먼저: 강은 남쪽 낮은 단에서 동서로(폭 3) — 단 경계와 나란히 흘러 단을 가르지 않는다. 다리가 필요 없다(riverX = -1, 강 없는 마을과 같은 길망).
    const ry = hf.riverY;
    for (let x = 0; x < W; x += 1) for (let o = 0; o < 3; o += 1) set(x, ry(x) + o, WATERC);
  } else if (spec.feature === "river") {
    // 강은 seed 에 따라 동쪽(0.6) 또는 서쪽(0.36) — 넓은 쪽 둑이 광장·뒷길을 갖는다
    riverLeft = rand() < 0.5;
    // 물가 띠 마을: 강은 늘 서쪽 — 둑길 마을이 넓은 동쪽 둑을 쓰고, 방앗간·물레방아는 좁은 서쪽 둑(바퀴 들보가 왼쪽 방앗간 벽에 닿는다)
    if (form === "riverbank") riverLeft = true;
    riverX = riverLeft ? Math.round(W * (form === "riverbank" ? 0.2 : 0.36)) + ri(-2, 2) : Math.round(W * 0.6) + ri(-3, 3);
    // 굽이는 넓은 둑 쪽으로만(좁은 둑의 뒷길·방앗간 자리를 물이 먹지 않게)
    const sg = riverLeft ? -1 : 1;
    const keys: [number, number][] = [[0, riverX - sg * ri(2, 3)], [Math.round(yMainBase / 2), riverX + sg], [yMainBase - 3, riverX], [yMainBase + 6, riverX], [H - 1, riverX - sg * ri(3, 5)]];
    for (let y = 0; y < H; y += 1) {
      let k = 0; while (k < keys.length - 2 && y > keys[k + 1]![0]) k += 1;
      const [y0, x0] = keys[k]!, [y1, x1] = keys[k + 1]!;
      const x = Math.round(x0 + (x1 - x0) * smooth(y1 === y0 ? 0 : Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))));
      for (let o = 0; o < 4; o += 1) set(x + o, y, WATERC);
    }
  } else if (spec.feature === "coast") {
    const ph = rand() * 6.28, ph2 = rand() * 6.28;
    for (let x = 0; x < W; x += 1) {
      let s = Math.round(H * 0.72 + 1.6 * Math.sin(x / 7 + ph) + 1.0 * Math.sin(x / 3.3 + ph2));
      if (x >= W - 9) s += Math.round(3 * smooth(Math.min(1, (x - (W - 9)) / 5))); // 동쪽 곶
      shoreY[x] = Math.min(H - 4, s);
      for (let y = shoreY[x]!; y < H; y += 1) set(x, y, WATERC);
    }
  }
  const blob = (cx: number, cy: number, rx: number, ry: number, wob: number): number[] => {
    const out: number[] = []; const ph = rand() * 6.28, f = 2 + Math.floor(rand() * 2);
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y += 1) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
      if (!inMap(x, y)) continue; const a = Math.atan2((y - cy) / ry, (x - cx) / rx);
      const r = 1 + wob * Math.sin(f * a + ph) + wob * 0.5 * Math.sin(5 * a + ph * 2);
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= r * r) out.push(idx(x, y));
    }
    return out;
  };
  // 굽이는 완만하게: 열쇠점 사이 높이 차는 가로 거리의 1/6 이하(계단 칸이 4칸 이상 이어지게 — 2~3칸 토막은 「막다른 길」 혹이 된다).
  function easeKeys(keys: [number, number][], along: 0 | 1): void {
    const o = 1 - along;
    for (let i = 1; i < keys.length; i += 1) {
      const span = Math.abs(keys[i]![along] - keys[i - 1]![along]); const lim = Math.floor(span / 6);
      const d = keys[i]![o] - keys[i - 1]![o]; if (Math.abs(d) > lim) keys[i]![o] = keys[i - 1]![o] + Math.sign(d) * lim;
    }
  }
  // 못·늪은 길을 정한 뒤(길을 피해서) 깐다 — 자리만 먼저 정한다(지형이 못 자리를 알아야 한다)
  const pondSide = rand() < 0.5 ? "w" : "e";
  const pondPlan = spec.feature === "pond" && spec.pond && !codeT
    ? (() => {
      const cx = pondSide === "w" ? Math.round(W * 0.2) : Math.round(W * 0.8);
      // 높이 먼저: 못은 마을 단 북쪽 집 띠 안(위 단 절벽 밑 2줄 ~ 큰길 위 2줄)에 — 단 경계에 걸쳐 우묵한 구덩이가 되지 않게
      // 지형 먼저: 못(오아시스·얼음 못)은 큰길 남쪽 띠 — 마을이 물을 보고 모인다(북쪽 집 띠에 두면 집 자리를 먹고 위 단 절벽에 잘렸다, ab10 사막)
      if (hf?.seamAbove) { const c2 = pondSide === "w" ? Math.round(W * 0.3) : Math.round(W * 0.7); return { cx: c2, cy: hf.mainY(c2) + 6, rx: ri(5, 7), ry: 2 }; }
      return { cx, cy: Math.round(yMainBase - H * 0.22) + ri(-1, 1), rx: ri(6, 8), ry: ri(4, 5) };
    })() : null;

  // 포구 길가 마을(2026-10-11 「광장 마을에서 광장만 뺀 모양」 지적): 왜 여기 생겼나 = 배를 댈 수 있는 물가.
  // 그래서 해안선 모양(입력)에서 일하는 물가 자리를 먼저 고르고 큰길이 그 자리를 따라 굽는다 — 물이 뭍으로 파고든 만(灣)에는 잔교·작은 부두
  // (큰길이 물가로 다가가 부두가 길에서 바로 뻗는다), 뭍이 바다로 나온 모래톱에는 그물 말림터(큰길이 안쪽으로 물러나 말림터 자리를 남긴다).
  // 가운데에 가장 가까운 만이 큰 잔교·생선 시장·모이는 곳. 뒷길은 그 뒤 짧은 고리 하나뿐이고 광장·가운데 십자 길은 없다.
  const coastStreet = theme === "coast" && form === "street" && !codeT;
  type CoastSpot = { x: number; kind: "pier" | "dock" | "nets" };
  const coastSpots: CoastSpot[] = [];
  let coastKeys: [number, number][] = [];
  if (coastStreet) {
    const sm = (x: number) => { let a = 0, n = 0; for (let t = x - 3; t <= x + 3; t += 1) if (t >= 0 && t < W) { a += shoreY[t]!; n += 1; } return a / n; };
    const x0 = 4, x1 = W - 12; // 동쪽 곶 앞에서 멈춘다
    const mean = Array.from({ length: x1 - x0 + 1 }, (_, i) => sm(x0 + i)).reduce((a, b) => a + b, 0) / (x1 - x0 + 1);
    // 큰 잔교 = 가운데 띠(0.38~0.62W)에서 물이 가장 깊이 파고든 만. 그다음 양쪽으로 11~17칸마다 한 자리씩 — 그 구간에서 만이 뚜렷하면 작은 부두, 아니면 가장 넓은 모래톱에 그물 말림터.
    let pierX = Math.round(W * 0.38); for (let x = pierX; x <= Math.round(W * 0.62); x += 1) if (sm(x) < sm(pierX)) pierX = x;
    coastSpots.push({ x: pierX, kind: "pier" });
    for (const dir of [1, -1]) {
      for (let x = pierX; ;) {
        const a = Math.max(x0, Math.min(x + dir * 11, x + dir * 17)), b = Math.min(x1, Math.max(x + dir * 11, x + dir * 17));
        if (b - a < 2) break;
        let bay = a, beach = a; for (let t = a; t <= b; t += 1) { if (sm(t) < sm(bay)) bay = t; if (sm(t) > sm(beach)) beach = t; }
        const sp: CoastSpot = sm(bay) < mean - 0.4 ? { x: bay, kind: "dock" } : { x: beach, kind: "nets" };
        coastSpots.push(sp); x = sp.x;
      }
    }
    coastSpots.sort((p, q) => p.x - q.x);
    // 그물 말림터가 하나도 없으면 가장 넓은 모래톱 하나를 말림터로(포구마다 그물은 말린다)
    if (!coastSpots.some((s) => s.kind === "nets")) { const docks = coastSpots.filter((s) => s.kind === "dock"); if (docks.length) docks.sort((p, q) => sm(q.x) - sm(p.x))[0]!.kind = "nets"; }
    const minShore = (x: number, r: number) => Math.min(...shoreY.slice(Math.max(0, x - r), Math.min(W, x + r + 1)));
    coastKeys = [[0, minShore(0, 6) - 4]];
    for (const sp of coastSpots) coastKeys.push([sp.x, minShore(sp.x, 3) - 3]);
    coastKeys.push([W - 1, minShore(W - 4, 3) - 4]);
    coastKeys.sort((p, q) => p[0] - q[0]);
    // 모래톱(말림터)에서는 큰길이 안쪽으로 물러난다 — 물가에서 6칸, 그리고 이웃 열쇠점보다 2줄 이상 안쪽(폭 2 길이 한 줄씩만 오르내리면 겹친 줄이 곧게 이어진다)
    for (let i = 1; i < coastKeys.length - 1; i += 1) {
      const sp = coastSpots.find((c) => c.x === coastKeys[i]![0]); if (sp?.kind !== "nets") continue;
      coastKeys[i]![1] = Math.min(coastKeys[i]![1] - 3, coastKeys[i - 1]![1] - 2, coastKeys[i + 1]![1] - 2);
    }
    const settle = () => { easeKeys(coastKeys, 0); for (const k of coastKeys) k[1] = Math.min(k[1], minShore(k[0], 3) - 3); }; // 물가에서 3칸 안쪽(폭 2 길 + 물가 한 줄)
    settle();
    // 폭 2 큰길의 한 줄이 40칸 넘게 곧게 이어지면(이웃 열쇠점 높이가 한 줄 차이로 오르내릴 때) 그 가운데 열쇠점을 2줄 안쪽으로 — 결과 길에서 직접 잰다
    const longestRow = (): { len: number; x: number } => {
      const ys: number[] = [];
      for (let x = 0; x < W; x += 1) { let k = 0; while (k < coastKeys.length - 2 && x > coastKeys[k + 1]![0]) k += 1; const [x0, y0] = coastKeys[k]!, [x1, y1] = coastKeys[k + 1]!; ys.push(Math.round(y0 + (y1 - y0) * smooth(x1 === x0 ? 0 : Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))))); }
      let best = { len: 0, x: 0 };
      for (let r = Math.min(...ys); r <= Math.max(...ys) + 1; r += 1) { let run = 0; for (let x = 0; x <= W; x += 1) { if (x < W && (ys[x] === r || ys[x] === r - 1)) run += 1; else { if (run > best.len) best = { len: run, x: x - Math.ceil(run / 2) }; run = 0; } } }
      return best;
    };
    for (let t = 0; t < 6; t += 1) {
      const lr = longestRow(); if (lr.len <= 40) break;
      // 잔교·부두 자리 열쇠점은 물가에 붙어 있어야 하므로 옮기지 않는다 — 그 사이에 열쇠점을 하나 넣어(이웃과 12칸 이상) 안쪽으로 휘거나, 말림터·끝 열쇠점을 옮긴다
      const fixed = (i: number) => coastSpots.some((c) => c.x === coastKeys[i]![0] && c.kind !== "nets");
      const ins = coastKeys.findIndex((k) => k[0] > lr.x);
      const yr = (() => { const [xa, ya] = coastKeys[ins - 1]!, [xb, yb] = coastKeys[ins]!; return Math.round(ya + (yb - ya) * (lr.x - xa) / Math.max(1, xb - xa)); })();
      if (ins > 0 && lr.x - coastKeys[ins - 1]![0] >= 12 && coastKeys[ins]![0] - lr.x >= 12) coastKeys.splice(ins, 0, [lr.x, yr - 2]);
      else {
        let ki = -1; for (let i = 0; i < coastKeys.length; i += 1) if (!fixed(i) && (ki < 0 || Math.abs(coastKeys[i]![0] - lr.x) < Math.abs(coastKeys[ki]![0] - lr.x))) ki = i;
        if (ki < 0) break; coastKeys[ki]![1] -= 2;
      }
      settle();
    }
  }

  // ---------- 0. 지형(2026-10-11 「지형을 먼저 기획하고 그 위에 마을을」) ----------
  // 물 자리(강 곡선·해안선·못)가 정해진 지금 단 높이 격자를 만든다. 아래 모든 단계가 이 지형을 따른다:
  // 길은 단을 건너는 곳에서 매끈한 경사로로 오르고(3b), 집·밭·나무·소품은 한 단 위에만 앉고(fits), 문 앞 길은 경사로로만 단을 오른다(linkToRoad).
  const mainBase = theme === "coast"
    ? (form === "street" ? Math.min(...coastKeys.map((k) => k[1])) : Math.max(10, Math.min(yMainBase, Math.min(...shoreY) - 9))) : yMainBase;
  const terrain = codeT ? { name: (codeT.maxLevel > 0 ? "terraces" : "flat") as typeof terrainName, levels: Uint8Array.from(codeT.levels), northSeam: null, coves: [] as { x0: number; x1: number }[], note: codeT.note }
    : hf ? carveHeightFirstWater(hf, W, H, (x, y) => at(x, y) === WATERC, pondPlan)
    : planVillageTerrain({ W, H, theme, form, seed, water: (x, y) => at(x, y) === WATERC, riverLeft, mainBase, pond: pondPlan }, terrainName);
  const lv = terrain.levels;
  if (codeT) terrainName = terrain.name;
  const hasTerrain = lv.some((v) => v > 0);
  const rampCells = new Set<number>(); // 길 경사로 칸(코드 1~4) — 문 앞·소품 자리로 쓰지 않는다
  const ramps = new Array<number>(W * H).fill(0);
  let rel: ReliefData | null = null; // 경사로까지 정한 뒤(3b) 만든다 — 문 앞 길 찾기가 단을 안다
  // 흩어진 마을의 갈래길은 마감에서 마지막 집 문 앞까지 깎인다 — 그 끝 토막과 거기 놓인 경사로를 믿고 자리를 고르지 않는다(울타리 문·대지 이어짐 계산)
  const branch = (c: number) => form === "scatter" && streets.some((st) => st.name === "갈래길" && st.cells.has(c));
  /** 계획 단계에서 믿을 수 있는 한 걸음: 단은 경사로로만, 갈래길 경사로는 믿지 않는다. */
  const trustStep = (x: number, y: number, nx: number, ny: number): boolean => {
    const c = idx(x, y), n = idx(nx, ny);
    if ((rampCells.has(n) || rampCells.has(c)) && (branch(n) || branch(c))) return false;
    return !rel || reliefAllowsStep(rel, x, y, nx, ny);
  };
  let rampCount = 0, cutCells = 0, rampFails = 0;

  planStep("물 자리");
  // ---------- 2. 큰길 ----------
  const streets: Street[] = [];
  const hStreet = (name: string, keys: [number, number][], width: number): Street => {
    keys.sort((a, b) => a[0] - b[0]); easeKeys(keys, 0);
    const cells = new Set<number>(); let prev = -999;
    for (let x = Math.max(0, keys[0]![0]); x <= Math.min(W - 1, keys[keys.length - 1]![0]); x += 1) {
      let k = 0; while (k < keys.length - 2 && x > keys[k + 1]![0]) k += 1;
      const [x0, y0] = keys[k]!, [x1, y1] = keys[k + 1]!;
      const y = Math.round(y0 + (y1 - y0) * smooth(x1 === x0 ? 0 : Math.min(1, Math.max(0, (x - x0) / (x1 - x0)))));
      for (let o = 0; o < width; o += 1) if (inMap(x, y + o)) cells.add(idx(x, y + o));
      if (prev !== -999 && Math.abs(y - prev) >= width) for (let yy = Math.min(y, prev); yy <= Math.max(y, prev); yy += 1) cells.add(idx(x, yy));
      prev = y;
    }
    const s = { name, cells, horizontal: true, width }; streets.push(s); return s;
  };
  const vStreet = (name: string, keys: [number, number][], width: number): Street => {
    keys.sort((a, b) => a[1] - b[1]); easeKeys(keys, 1);
    const cells = new Set<number>(); let prev = -999;
    for (let y = Math.max(0, keys[0]![1]); y <= Math.min(H - 1, keys[keys.length - 1]![1]); y += 1) {
      let k = 0; while (k < keys.length - 2 && y > keys[k + 1]![1]) k += 1;
      const [x0, y0] = keys[k]!, [x1, y1] = keys[k + 1]!;
      const x = Math.round(x0 + (x1 - x0) * smooth(y1 === y0 ? 0 : Math.min(1, Math.max(0, (y - y0) / (y1 - y0)))));
      for (let o = 0; o < width; o += 1) if (inMap(x + o, y)) cells.add(idx(x + o, y));
      if (prev !== -999 && Math.abs(x - prev) >= width) for (let xx = Math.min(x, prev); xx <= Math.max(x, prev); xx += 1) cells.add(idx(xx, y));
      prev = x;
    }
    const s = { name, cells, horizontal: false, width }; streets.push(s); return s;
  };
  /** 함수로 준 줄(yOf)을 따라가는 동서 길 — 등고선과 나란한 뒷길. 계단은 hStreet 와 같이 세로로 잇는다. */
  const hStreetFn = (name: string, x0: number, x1: number, yOf0: (x: number) => number, width: number): Street => {
    const cells = new Set<number>(); let prev = -999;
    // 길 끝 몇 칸 안에서 꺾이면 2~3칸 턱이 막다른 토막처럼 남는다 — 끝 7칸은 그 안에서 가장 북쪽 줄로 곧게(위로만 옮겨 높은 단에 남게)
    const a = Math.max(0, x0), b = Math.min(W - 1, x1);
    const top = (u: number, v: number) => { let m = H; for (let t = u; t <= v; t += 1) m = Math.min(m, yOf0(t)); return m; };
    const yOf = (x: number) => { if (b - a < 14) return yOf0(x); if (x <= a + 6 && a > 0) return top(a, a + 6); if (x >= b - 6 && b < W - 1) return top(b - 6, b); return yOf0(x); };
    for (let x = a; x <= b; x += 1) {
      const y = yOf(x);
      for (let o = 0; o < width; o += 1) if (inMap(x, y + o)) cells.add(idx(x, y + o));
      // 꺾이는 칸은 등고선 안쪽(더 남쪽까지 높은) 열에 — 올라가면 앞 열, 내려가면 이 열(길 전체가 높은 단에 남게)
      if (prev !== -999 && Math.abs(y - prev) >= width) { const cx = y < prev ? x - 1 : x; for (let yy = Math.min(y, prev); yy <= Math.max(y, prev) + width - 1; yy += 1) cells.add(idx(cx, yy)); }
      prev = y;
    }
    const s = { name, cells, horizontal: true, width }; streets.push(s); return s;
  };
  const yAt = (s: Street, x: number): number | null => { for (let y = 0; y < H; y += 1) if (s.cells.has(idx(x, y))) return y; return null; };

  /** x0→x1 구간에 12~16칸마다 열쇠점, 높이는 yBase ± 1~amp 로 번갈아(곧은 길 45칸 넘지 않게). 끝점 높이는 고정할 수 있다. */
  // tight: 고정한 끝(다리 앞뒤처럼 yBase 로 곧은 끝) 바로 옆 열쇠점을 12칸 거리·높이 차 amp 로 둔다 — 폭 2 길은 한 줄만 어긋나면 윗줄·아랫줄이
  // 이어져 곧은 줄로 남고, 열쇠점 차는 easeKeys 가 가로 거리 1/6 로 묶는다. 다리 앞뒤 곧은 길과 이웃 구간이 이어져 45칸 곧은 큰길이 났다(강가 88×56 seed 7).
  // tight 를 안 주면 예전과 같은 난수열·같은 결과.
  const wavy = (x0: number, x1: number, yBase: number, amp: number, yStart?: number, yEnd?: number, tight = false): [number, number][] => {
    const keys: [number, number][] = []; let sg = rand() < 0.5 ? 1 : -1;
    keys.push([x0, yStart ?? yBase + sg * ri(1, amp)]);
    const tS = tight && yStart !== undefined, tE = tight && yEnd !== undefined;
    if (tS && x1 - x0 >= 20) { sg = -sg; keys.push([x0 + 12, yBase + sg * amp]); }
    for (let x = keys[keys.length - 1]![0] + ri(12, 16); x < x1 - (tE ? 20 : 8); x += ri(12, 16)) { sg = -sg; keys.push([x, yBase + sg * ri(1, amp)]); }
    if (tE && x1 - 12 - keys[keys.length - 1]![0] >= 8) { sg = -sg; keys.push([x1 - 12, yBase + sg * amp]); }
    keys.push([x1, yEnd ?? yBase - sg * ri(1, amp)]);
    return keys;
  };

  // ---------- 2'. 코드 지형 위 자리와 길(options.codeTerrain) ----------
  // 조수가 고른 자리(layout)를 놓을 수 있는 가장 가까운 자리로 옮겨 잡고(옮긴 거리를 보고), 모이는 곳에서 맵 가장자리로 큰길(폭 2),
  // 문 앞마다 길망까지 골목(폭 1)을 계단 계약을 지키는 최소 비용 길로 낸다. 길이 지나는 단 경계는 3b 가 계단으로 만든다.
  const RESV = 13, RESV_DOOR = 14, PLAZA_HOLD = 15;
  type CodeSpot = { role: "landmark" | "anchor" | "work" | "house"; k: Kit; x: number; y: number; front: { x: number; y: number }; want: LayoutPoint; moved: number };
  const codePlan = codeT ? (() => {
    const given = options.layout && Object.keys(options.layout).length ? options.layout : null;
    const layout: VillageLayout = given ?? autoLayout(codeT, seed, Number.isFinite(houseLimit) ? houseLimit : ri(5, 8));
    const report = { auto: !given, moved: [] as string[], failed: [] as string[], roadsFailed: [] as string[], requested: { houses: layout.houses?.length ?? 0 } };
    const spots: CodeSpot[] = [];
    const spotOk = (k: Kit, x: number, y: number): boolean => {
      if (!k.door || x < 1 || y < 1 || x + k.w > W - 1 || y + k.h > H - 2) return false;
      const L0 = lv[idx(x, y)]!;
      for (let j = -1; j <= k.h; j += 1) for (let i = -1; i <= k.w; i += 1) {
        const X = x + i, Y = y + j; if (!inMap(X, Y)) continue; const c = idx(X, Y);
        if (i >= 0 && j >= 0 && i < k.w && j < k.h) { if (occ[c] !== FREE || lv[c] !== L0) return false; }
        else if (occ[c] === RESV) return false; // 이웃 건물과 한 칸 띄운다
      }
      for (let i = 0; i < k.w; i += 1) for (let kk = 1; kk <= 2; kk += 1) { const Y = y + k.h - 1 + kk; if (Y < H && lv[idx(x + i, Y)]! > L0 + kk - 1) return false; }
      const fx = x + k.door.dx, fy = y + k.door.dy + 1; if (!inMap(fx, fy + 1)) return false; const f = idx(fx, fy);
      return occ[f] === FREE && lv[f] === L0 && lv[f + W]! >= L0 && occ[f + W] !== WATERC;
    };
    const place = (role: CodeSpot["role"], ks: Kit[], want: LayoutPoint): CodeSpot | null => {
      for (let r = 0; r <= 9; r += 1) {
        const ring: [number, number][] = [];
        for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) ring.push([dx, dy]);
        ring.sort((a, b) => Math.hypot(a[0], a[1] * 1.3) - Math.hypot(b[0], b[1] * 1.3));
        for (const [dx, dy] of ring) for (const k of ks) {
          const x = want.x + dx - Math.floor(k.w / 2), y = want.y + dy - Math.floor(k.h / 2);
          if (!spotOk(k, x, y)) continue;
          for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) occ[idx(x + i, y + j)] = RESV;
          const front = { x: x + k.door!.dx, y: y + k.door!.dy + 1 }; occ[idx(front.x, front.y)] = RESV_DOOR;
          const sp: CodeSpot = { role, k, x, y, front, want, moved: Math.round(Math.hypot(dx, dy)) };
          if (sp.moved >= 3) report.moved.push(`${role}(${want.x},${want.y})→(${x + Math.floor(k.w / 2)},${y + Math.floor(k.h / 2)}) ${sp.moved}칸`);
          spots.push(sp); return sp;
        }
      }
      report.failed.push(`${role}(${want.x},${want.y}) — 9칸 안에 한 단 평지 자리가 없다`);
      return null;
    };
    const snapFree = (p: LayoutPoint): number => {
      let best = -1, bd = Infinity;
      for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) { const c = idx(x, y); if (occ[c] !== FREE) continue; const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = c; } }
      return best;
    };
    // 모이는 곳을 먼저 잡고 광장 자리(판석 덩이)를 비워 둔다 — 집이 먼저 들어서면 광장이 0칸이 됐다(2026-10-30 ab12 장터 마을 「광장·우물·노점이 없다」)
    const gWant = layout.gather ?? { x: Math.round(W / 2), y: Math.round(H / 2) };
    const g0 = snapFree(gWant);
    const gx = g0 % W, gy = Math.floor(g0 / W);
    if (Math.hypot(gx - gWant.x, gy - gWant.y) >= 3) report.moved.push(`gather(${gWant.x},${gWant.y})→(${gx},${gy})`);
    const plazaHold: number[] = [];
    {
      // 광장이 없는 모이는 곳(우물·좌판)도 둘레 두 칸은 비워 둔다 — 집이 모이는 곳을 에워싸 큰길·골목이 모두 막혔다(ab r6 강가 마을)
      const big = (layout.gather?.plaza ?? true) !== false, rx = big ? 5.5 : 2.5, ry = big ? 3.5 : 2.5;
      const gl = lv[g0]!;
      for (let y = gy - 3; y <= gy + 3; y += 1) for (let x = gx - 5; x <= gx + 5; x += 1) {
        if (!inMap(x, y) || ((x - gx) / rx) ** 2 + ((y - gy) / ry) ** 2 > 1) continue; const c = idx(x, y);
        if (occ[c] === FREE && lv[c] === gl) { occ[c] = PLAZA_HOLD; plazaHold.push(c); }
      }
    }
    const shuffled = <T,>(xs: readonly T[]): T[] => xs.map((v) => ({ v, r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.v);
    const doorKits = (ids: readonly string[]) => have(ids).filter(doorAtBottom).map(K);
    if (layout.landmark) { const ks = shuffled(doorKits(TIER_LANDMARKS[theme] ?? spec.anchors)); if (ks.length) place("landmark", ks, layout.landmark); }
    const anchorIds = roofs === "medieval" && have(MEDIEVAL_ANCHORS).length ? MEDIEVAL_ANCHORS : spec.anchors;
    if (layout.anchor) { const ks = shuffled(doorKits(anchorIds)).filter((k) => !spots.some((sp) => sp.k.id === k.id)); if (ks.length) place("anchor", ks, layout.anchor); }
    if (layout.work) { const ks = shuffled(doorKits(LOW_WORKS[theme] ?? [])); if (ks.length) place("work", ks, layout.work); }
    const last: string[] = [];
    // 조수가 집 자리를 주면 그 수가 정한다(12채까지) — size 의 집 수(3~5)는 자동 배치에만
    for (const want of (layout.houses ?? []).slice(0, given ? 12 : Number.isFinite(houseLimit) ? houseLimit : 24)) {
      const main0 = shuffled(houses.map(K).filter((k) => k.w <= 9 && !last.includes(k.id)));
      const acc = accentHouses.length && rand() < 0.2 ? shuffled(accentHouses.map(K).filter((k) => k.w <= 9)) : [];
      const sp = place("house", [...acc, ...main0].slice(0, 6), want);
      if (sp) { last.push(sp.k.id); if (last.length > 2) last.shift(); }
    }
    // 길 — 단은 계단으로만(곧게 3칸 온 뒤 건너고 건넌 뒤 3칸 곧게), 두 단 넘는 낭떠러지는 못 건넌다. 강은 곧게 널다리로.
    const network = new Set<number>();
    const fords: number[] = [];
    const grid = (wide: boolean) => ({
      W, H, lv,
      blocked: (c: number) => occ[c] === RESV || occ[c] === BLD || occ[c] === KEEP || (occ[c] === WATERC && codeT.water[c] !== 1),
      ford: (c: number) => occ[c] === WATERC && codeT.water[c] === 1,
      extra: (c: number) => {
        const x = c % W, y = (c - x) / W; let e = network.has(c) ? -0.55 : 0;
        if (y + 1 < H && lv[c + W]! < lv[c]!) e += 1.2; // 절벽 끝 바로 위
        const edge = Math.min(x, y, W - 1 - x, H - 1 - y); if (edge === 0) e += 1.5; else if (edge === 1) e += 0.8; // 맵 테두리를 따라 기는 길
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const v = at(x + dx, y + dy); if (v === RESV) e += 0.8; else if (v === WATERC) e += 0.4; }
        return e;
      },
      wide,
    });
    const opts = (wide: boolean) => ({ maxStep: 2, before: 3, after: 3, turnCost: wide ? 2.2 : 1.4, climbCost: 6, fordCost: 4, wide, climbNS: true });
    for (const c of plazaHold) if (occ[c] === PLAZA_HOLD) occ[c] = FREE;
    const paths: { name: string; cells: number[]; width: number }[] = [];
    const edgeOf = (e: string) => (c: number) => { const x = c % W, y = (c - x) / W; return e === "west" ? x === 0 : e === "east" ? x === W - 1 : e === "north" ? y === 0 : y === H - 1; };
    const exits = layout.exits?.length ? layout.exits : (W >= H ? ["west", "east"] as const : ["north", "south"] as const);
    let entrance: { x: number; y: number } | null = null;
    for (const e of exits) {
      let path = routePath(grid(true), [g0], edgeOf(e), opts(true));
      let width = 2;
      if (!path) { path = routePath(grid(false), [g0], edgeOf(e), opts(false)); width = 1; }
      if (!path) { report.roadsFailed.push(`${e} 가장자리로 가는 큰길`); continue; }
      paths.push({ name: "큰길", cells: path, width }); for (const c of path) network.add(c);
      const end = path[path.length - 1]!; if (!entrance) entrance = { x: end % W, y: Math.floor(end / W) };
    }
    network.add(g0);
    const byDist = [...spots].sort((a, b) => Math.hypot(a.front.x - gx, a.front.y - gy) - Math.hypot(b.front.x - gx, b.front.y - gy));
    for (const sp of byDist) {
      const f = idx(sp.front.x, sp.front.y);
      if (network.has(f)) continue;
      const path = routePath(grid(false), [f], (c) => network.has(c), opts(false));
      if (!path) {
        report.roadsFailed.push(`${sp.role}(${sp.front.x},${sp.front.y}) 문 앞 길`);
        if (sp.role !== "landmark") { for (let j = 0; j < sp.k.h; j += 1) for (let i = 0; i < sp.k.w; i += 1) occ[idx(sp.x + i, sp.y + j)] = FREE; occ[f] = FREE; spots.splice(spots.indexOf(sp), 1); }
        continue;
      }
      paths.push({ name: sp.role === "house" ? "골목" : "오름길", cells: path, width: 1 }); for (const c of path) network.add(c);
    }
    // 길이 하나도 닿지 않는 넓은 단(높은 터·건너편 들)에는 들길 하나 — 한가운데에서 길망까지(못 내면 숲이 덮는다)
    {
      const comp = new Int32Array(W * H).fill(-1); const comps: number[][] = [];
      for (let c0 = 0; c0 < W * H; c0 += 1) {
        if (comp[c0]! >= 0 || occ[c0] === WATERC || occ[c0] === RESV) continue;
        const cs = [c0]; comp[c0] = comps.length;
        for (let h = 0; h < cs.length; h += 1) { const c = cs[h]!, x = c % W, y = (c - x) / W;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (comp[n]! < 0 && lv[n] === lv[c0] && occ[n] !== WATERC && occ[n] !== RESV) { comp[n] = comps.length; cs.push(n); } } }
        comps.push(cs);
      }
      let added = 0;
      for (const cs of comps.filter((cs) => cs.length >= 140 && !cs.some((c) => network.has(c))).sort((a, b) => b.length - a.length)) {
        if (added >= 3) break;
        // 덩이 가장자리에서 가장 먼 칸(평평한 한가운데)
        const inC = new Set(cs); const d = new Map<number, number>(); const q: number[] = [];
        for (const c of cs) { const x = c % W, y = (c - x) / W; if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inC.has(idx(x + dx!, y + dy!)) || !inMap(x + dx!, y + dy!))) { d.set(c, 0); q.push(c); } }
        for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = idx(x + dx, y + dy); if (inMap(x + dx, y + dy) && inC.has(n) && !d.has(n)) { d.set(n, d.get(c)! + 1); q.push(n); } } }
        let best = cs[0]!, bd = -1; for (const [c, v] of d) if (v > bd) { bd = v; best = c; }
        const path = routePath(grid(false), [best], (c) => network.has(c), opts(false));
        if (!path) continue;
        paths.push({ name: "들길", cells: path, width: 1 }); for (const c of path) network.add(c); added += 1;
        keepRoad.add(best); // 들길 끝(높은 터 한가운데)은 막다른 길 다듬기에서 지킨다
      }
    }
    // 길 칸 → 곧은 토막 Street(3b 가 토막마다 계단을 놓는다). 강 칸은 널다리(KEEP).
    for (const pth of paths) for (const run of pathRuns(pth.cells, W)) {
      const cells = new Set<number>();
      for (const c of run.cells) {
        cells.add(c);
        if (pth.width === 2) { const t = run.horizontal ? c + W : c + 1; if (t < W * H && (run.horizontal || c % W < W - 1) && occ[t] !== RESV && occ[t] !== BLD) cells.add(t); }
      }
      for (const c of cells) if (occ[c] === WATERC) { occ[c] = KEEP; fords.push(c); }
      const st: Street = { name: pth.name, cells, horizontal: run.horizontal, width: pth.width };
      streets.push(st);
    }
    for (const c of network) if (occ[c] === RESV_DOOR || occ[c] === FREE) occ[c] = ROAD;
    for (const sp of spots) if (occ[idx(sp.front.x, sp.front.y)] === RESV_DOOR) occ[idx(sp.front.x, sp.front.y)] = FREE;
    return { layout, report, spots, g: { x: gx, y: gy }, entrance, fords, plaza: (layout.gather?.plaza ?? true) !== false };
  })() : null;
  const lanesWidth = form === "scatter" ? 1 : 2; // 흩어진 마을은 오솔길
  let mainKeys: [number, number][] = [];
  if (form === "riverbank") {
    // 둑길: 강 동쪽 둑을 따라 남북으로(강물에서 물레방아·방앗간·집 한 줄 자리를 비우고)
    let wMax = -1; for (let c = 0; c < W * H; c += 1) if (occ[c] === WATERC) wMax = Math.max(wMax, c % W);
    const rx = Math.min(W - 16, wMax + 1 + ri(9, 11));
    mainKeys = [[rx, 0]];
    for (let y = ri(12, 16), sg = rand() < 0.5 ? 1 : -1; y < H - 8; y += ri(12, 16), sg = -sg) mainKeys.push([rx + sg, y]);
    mainKeys.push([rx, H - 1]);
  } else if (theme === "coast" && form === "street") {
    // 포구 길가 마을: 큰길이 물가를 따라간다(물가 길이 곧 큰길) — 집은 바다를 보고 한 줄로 서고, 뒷길은 그 뒤 짧은 고리 하나.
    // 열쇠점 = 일하는 물가 자리(위 coastSpots): 만은 물가에서 3칸(부두가 길에서 바로 뻗는다), 모래톱은 6칸(그물 말림터 자리).
    mainKeys = coastKeys.map(([x, y]) => [x, y] as [number, number]);
  } else if (theme === "coast") {
    const top = Math.min(...shoreY) - 9;
    const yM = Math.max(10, Math.min(yMainBase, top));
    mainKeys = wavy(0, W - 1, yM, 2);
  } else if (riverX >= 0) {
    // 다리 앞뒤(강 왼쪽 4칸 ~ 오른쪽 7칸)는 곧게
    const yc = yMainBase;
    mainKeys = [...wavy(0, riverX - 4, yc, 2, undefined, yc, true), ...wavy(riverX + 7, W - 1, yc, 2, yc, undefined, true)];
  } else {
    mainKeys = wavy(0, W - 1, yMainBase, 3);
  }
  // 높이 먼저: 큰길은 마을 단의 등고선을 따라간다(단을 건너지 않는다). 강 골 앞뒤 5칸은 곧게 — 골로 내려가는 경사로가 곧은 단면에 놓이게.
  const hfMainY = hf ? (x: number): number => {
    for (const cv of terrain.coves) if (x >= cv.x0 - 6 && x <= cv.x1 + 6) return hf!.mainY(Math.max(0, cv.x0 - 6));
    return hf!.mainY(x);
  } : null;
  const main = codePlan ? ([...streets].filter((st) => st.name === "큰길").sort((a, b) => Number(b.horizontal) - Number(a.horizontal) || b.cells.size - a.cells.size)[0]
      ?? streets[0] ?? hStreet("큰길", [[Math.max(0, codePlan.g.x - 1), codePlan.g.y], [Math.min(W - 1, codePlan.g.x + 1), codePlan.g.y]], 1))
    : form === "riverbank" ? vStreet("둑길", mainKeys, 2)
    : hfMainY && !coastStreet ? hStreetFn(form === "scatter" ? "오솔길" : "큰길", 0, W - 1, hfMainY, lanesWidth)
    : hStreet(form === "scatter" ? "오솔길" : "큰길", mainKeys, lanesWidth);
  // 다리 칸: 큰길이 물을 지나는 곳은 길 대신 다리 키트
  // 다리(2026-10-11): 옛 아치 다리(bd-bridge-arch)는 성 안 운하용 그림이라 아래 두 줄(아치 면)이 물결 위 반투명 아치로 1층에 깔려
  // 「투명한 뭔가」로 보였다(사용자 지적). 들판 강에는 산길 돌다리, 오솔길 마을에는 나무 널다리(5×4: 난간·바닥 두 줄·아래 난간).
  // 바닥 두 줄만 다리 자리(KEEP)로 잡는다 — 난간 줄은 강물 위에 위층으로 얹힌다.
  let bridge: { x: number; y: number; kit: string } | null = null;
  let millBridge: { x: number; y: number; kit: string } | null = null; // 물가 띠 마을 방앗간 널다리(서쪽 둑)
  // 다리 키트(5×4)는 강폭 4보다 한 칸 넓다 — 다리 자리 앞뒤로 강을 다리 폭만큼 넓혀 다리 양 끝이 정확히 양쪽 둑에 얹히게 한다
  // (2026-10-11 사용자 「다리를 강폭 사이에 끼우던가, 강폭을 다리만큼 넓히던가」 — 오른쪽 한 칸이 풀밭 위에 떠 아치 밑이 풀이었다).
  // by = 다리 맨 윗줄(난간). 난간 위 한 줄 ~ 아치 아래 한 줄(by−1 ~ by+4)을 5칸 폭 물로, 바닥 두 줄(by+1, by+2)은 다리 자리(KEEP).
  const widenForBridge = (bx: number, by: number) => {
    for (let y = by - 1; y <= by + 4; y += 1) for (let x = bx; x < bx + 5; x += 1) if (inMap(x, y) && (at(x, y) === FREE || at(x, y) === WATERC)) set(x, y, WATERC);
    for (let x = bx; x < bx + 5; x += 1) for (let y = by + 1; y <= by + 2; y += 1) set(x, y, KEEP);
  };
  if (riverX >= 0 && form !== "riverbank") {
    const yb = yAt(main, riverX)!;
    const kit = form === "scatter" ? "bd-pick-riverside-mill-plank-footbridge" : "bd-pick-mountain-pass-stone-bridge";
    bridge = { x: riverX, y: yb - 1, kit };
    widenForBridge(riverX, yb - 1);
    for (const c of [...main.cells]) if (occ[c] === WATERC || occ[c] === KEEP) main.cells.delete(c);
  }
  const markStreet = (s: Street) => { for (const c of s.cells) if (occ[c] !== WATERC && occ[c] !== KEEP) occ[c] = ROAD; };
  if (codePlan) for (const st of streets) markStreet(st); else markStreet(main);
  const yMainAt = (x: number) => yAt(main, x) ?? yMainBase;

  planStep("큰길");
  // ---------- 3. 뒷길 고리 ----------
  // 강이 있으면 북쪽 뒷길은 강 서쪽, 남쪽 뒷길은 강 동쪽. 바다면 남쪽은 물가 길(산책로).
  // 강둑 경계: 그 줄들에서 물이 가장 멀리 나온 칸 + 3칸
  const bank = (side: -1 | 1): number => {
    let v = side < 0 ? W : -1;
    for (let c = 0; c < W * H; c += 1) if (occ[c] === WATERC || occ[c] === KEEP) { const x = c % W; v = side < 0 ? Math.min(v, x) : Math.max(v, x); }
    return side < 0 ? v - 3 : v + 3;
  };
  const westEnd = riverX >= 0 ? bank(-1) : W - 1;
  const eastStart = riverX >= 0 ? bank(1) : 0;
  const north: { s: Street; x0: number; x1: number } | null = codeT || form === "riverbank" || form === "scatter" ? null : (() => {
    // 큰길 북쪽 띠(집 한 줄, 6~8칸) + 뒷길 북쪽 띠(집 한 줄)가 들어가게: 큰길에서 10~12칸 위, 맵 위에서 7칸 아래
    const yBase = coastStreet ? (yAt(main, Math.round(W / 2)) ?? yMainBase) : yMainBase;
    // 뒷길 북쪽에 집 띠(6~8줄)가 안 들어가는 낮은 맵(포구 큰길 y≈15)이면 뒷길을 더 올려 큰길 북쪽 띠를 앵커 높이(9줄)까지 넓힌다
    const yN0 = yBase - 10 - ri(0, 2);
    const yN = yN0 >= 7 ? yN0 : Math.max(2, Math.min(7, yBase - 12));
    if (!terrain.northSeam && yBase - yN < 9) return null;
    const toWestEdge = riverX >= 0 ? !riverLeft : pondSide === "e";
    // 강이 서쪽이면 뒷길은 동쪽 둑(방앗간 자리 10칸을 비우고 동쪽 끝까지)
    let nx0 = toWestEdge ? 0 : riverLeft ? eastStart + 10 : Math.round(W * 0.3) + ri(-3, 3);
    let nx1 = toWestEdge ? Math.min(westEnd, Math.round(W * (riverX >= 0 ? 0.55 : 0.7)) + ri(-3, 3)) : W - 1;
    if (coastStreet) {
      // 포구 길가 마을: 뒷길은 큰 잔교 뒤 짧은 고리 하나(양 끝 모두 이음길) — 집은 거의 큰길가 한 줄이다.
      // 고리 끝(이음길)이 부두·잔교 자리와 같은 열이면 큰길을 건너 십자 길이 되므로 4칸 넘게 비켜 둔다.
      // 고리는 잔교 한쪽(넓은 쪽)으로 비켜 낸다 — 잔교·앵커를 고리가 둘러싸면 광장 마을처럼 가운데를 감싼 네모가 된다.
      const pier = coastSpots.find((sp) => sp.kind === "pier")!;
      const len = Math.max(18, Math.min(30, Math.round(W * 0.36))) + ri(0, 3);
      const away = (x: number) => coastSpots.every((sp) => Math.abs(sp.x - x) > 4);
      const east = W - 4 - (pier.x + 5) >= pier.x - 5 - 3;
      if (east) { nx0 = pier.x + 5; nx1 = Math.min(W - 4, nx0 + len); } else { nx1 = pier.x - 5; nx0 = Math.max(3, nx1 - len); }
      // 끝을 잔교에서 먼 쪽으로만 민다(가까운 끝은 바깥쪽으로, 먼 끝은 안쪽으로)
      for (let t = 0; t < 6 && !away(nx0); t += 1) nx0 += 1;
      for (let t = 0; t < 6 && !away(nx1); t += 1) nx1 -= 1;
      nx0 = Math.max(3, nx0); nx1 = Math.min(W - 4, nx1);
    }
    const nw = coastStreet ? 1 : theme === "coast" ? 2 : 1 + (rand() < 0.4 ? 1 : 0);
    // 계단식 비탈: 뒷길은 높은 단 위에서 등고선을 따라간다 — 집은 그 북쪽, 문이 아래 마을을 본다.
    // 절벽 끝 바로 위에 길을 깔면 어색하다(2026-10-11 사용자) — 길과 절벽 끝 사이에 풀밭 한 줄(RIM_GAP)을 남긴다.
    const RIM_GAP = 1;
    const seam = terrain.northSeam;
    let [x0, x1] = [nx0, nx1];
    if (seam) {
      // 지형 먼저: 위 단 절벽이 비스듬히 사라지는 끝 너머로는 뒷길을 내지 않는다(곧은 절벽 밑에서만)
      if (hf?.aboveSpan) { x0 = Math.max(x0, hf.aboveSpan.x0 + 2); x1 = Math.min(x1, hf.aboveSpan.x1 - 2); }
      // 골(강·못을 깎은 0단 기둥)을 건너지 않는다 — 골에 걸리면 넓은 쪽만 남긴다
      for (const cv of terrain.coves) {
        if (cv.x1 + 2 < x0 || cv.x0 - 2 > x1) continue;
        const left = cv.x0 - 3 - x0, right = x1 - (cv.x1 + 3);
        if (left >= right) x1 = cv.x0 - 3; else x0 = cv.x1 + 3;
      }
      if (x1 - x0 < 10) return null;
      let lo = H; for (let x = x0; x <= x1; x += 1) lo = Math.min(lo, seam(x) - nw - RIM_GAP); if (lo < 3) return null;
    }
    const s = seam ? hStreetFn("뒷길(북)", x0, x1, (x) => seam(x) - nw - RIM_GAP, nw) : hStreet("뒷길(북)", wavy(x0, x1, yN, 1, yN, yN), nw);
    markStreet(s);
    return { s, x0, x1 };
  })();
  const connectors: Street[] = [];
  /** 이음길. align "r" = x 가 길 끝 칸이고 이음길이 그 왼쪽으로 붙는다(끝에 혹이 남지 않게). */
  const connect = (name: string, xEnd0: number, sTop: Street, sBot: Street, align: "l" | "r" | "m" = "m") => {
    const cw = 1 + (rand() < 0.3 ? 1 : 0);
    // 지형이 있으면 두 길이 곧은 곳(앞뒤 2칸 같은 줄)에서 잇는다 — 길이 한 줄 꺾이는 자리에 붙으면 이음길 경사로 옆구리에 길이 닿아 오르지 못한다
    let xEnd = xEnd0;
    if (hasTerrain) {
      // 끝에 붙는 이음길은 안쪽으로 5칸까지 곧아야 한다(그 사이에서 꺾이면 2~3칸 턱이 남는다)
      const [lo, hi] = align === "l" ? [-2, 5] : align === "r" ? [-5, 2] : [-2, 2];
      const flatAt = (s: Street, x: number) => { const y = yAt(s, x); if (y === null) return false; for (let d = lo; d <= hi; d += 1) if (yAt(s, x + d) !== y && !(x + d < 0 || x + d >= W)) return false; return true; };
      const order = align === "m" ? [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6] : [0, 1, 2, 3, 4, 5, 6, 7, 8].map((d) => (align === "l" ? d : -d));
      const banned = (x: number) => coastStreet && coastSpots.some((sp) => Math.abs(sp.x - x) <= 3); // 포구 길가: 부두와 같은 열이면 큰길을 건너 십자 길
      const hit = order.map((d) => xEnd0 + d).find((x) => x >= 1 && x < W - 1 && flatAt(sTop, x) && flatAt(sBot, x) && !banned(x));
      if (hit !== undefined) xEnd = hit;
    }
    const x = align === "r" ? xEnd - cw + 1 : xEnd;
    // 끝에서 안쪽으로 옮겼으면 그 바깥 토막은 막다른 길이 되므로 걷어 낸다
    if (align !== "m" && xEnd !== xEnd0) for (const s of [sTop, sBot]) {
      if (s === main) continue;
      const xs = [...s.cells].map((c) => c % W); if ((align === "l" ? Math.min(...xs) : Math.max(...xs)) !== xEnd0) continue;
      for (const c of [...s.cells]) { const cx = c % W; if (align === "l" ? cx < x : cx > x + cw - 1) { s.cells.delete(c); if (occ[c] === ROAD) occ[c] = FREE; } }
    }
    const y0 = (yAt(sTop, xEnd) ?? 0) + sTop.width - 1, y1 = yAt(sBot, xEnd) ?? H - 1;
    if (y1 - y0 < 3) return;
    const bend = align === "m" && !hasTerrain ? ri(-2, 2) : 0; // 지형이 있으면 곧게(등고선을 직각으로 건너 경사로가 곧게 놓이게)
    const c = vStreet(name, [[x, y0], [x + bend, Math.round((y0 + y1) / 2)], [x, y1]], cw);
    markStreet(c); connectors.push(c);
  };
  if (north) {
    const cx = north.x0 === 0 ? north.x1 : north.x0;
    connect("이음길", cx, north.s, main, north.x0 === 0 ? "r" : "l");
    // 골에 잘려 양쪽 끝이 다 맵 안이면 다른 끝도 잇는다(막다른 뒷길 금지)
    if (north.x0 > 0 && north.x1 < W - 1) connect("이음길", north.x1, north.s, main, "r");
    // 긴 뒷길이면 가운데에 이음길 하나 더(작은 고리)
    if (Math.abs(north.x1 - north.x0) > 30) connect("이음길", Math.round((north.x0 + north.x1) / 2) + ri(-3, 3), north.s, main);
  }
  let south: Street | null = null;
  const souths: Street[] = [];
  let entryLane: Street | null = null; // 물가 띠 마을의 들길(입구)
  let junctionX = -1; // 흩어진 마을의 갈림길(모이는 곳)
  if (form === "riverbank") {
    // 둑길 동쪽에 뒷길(남북) 하나, 위·아래·가운데 이음길(동서)로 고리. 가운데 이음길은 맵 동쪽 끝까지 — 들길(입구).
    const mx = Math.max(...[...main.cells].map((c) => c % W));
    const bx = Math.min(W - 9, mx + ri(11, 13));
    const yTop = ri(5, 8), yBot = H - 1 - ri(5, 8);
    const back = vStreet("뒷길", [[bx, yTop], [bx, yBot]], 1); markStreet(back);
    for (const [name, y, toEdge] of [["이음길", yTop, false], ["이음길", yBot, false], ["들길", Math.round((yTop + yBot) / 2) + ri(-2, 2), true]] as const) {
      // 들길은 맵 끝까지 길다 — 열쇠점으로 굽혀 45칸 넘는 곧은 길을 만들지 않는다(88×56 에서 52~55칸 곧은 들길이 check_city_form 에 걸렸다)
      const lane = hStreet(name, toEdge ? wavy(mx, W - 1, y, 1, y) : [[mx, y], [bx, y]], toEdge ? 1 + (rand() < 0.5 ? 1 : 0) : 1);
      markStreet(lane); connectors.push(lane); if (toEdge) entryLane = lane;
    }
  } else if (form === "scatter" && !codeT) {
    // 흩어진 마을: 오솔길에서 갈래 오솔길 2~3개가 남북으로 뻗는다. 끝은 마지막 집 문 앞에서 멈춘다(막다른 토막은 마감에서 깎인다).
    const n = ri(2, 3);
    const xs: number[] = [];
    for (let t = 0; t < 60 && xs.length < n; t += 1) {
      const x = ri(5, W - 6);
      if (xs.some((o) => Math.abs(o - x) < 12) || (riverX >= 0 && x > riverX - 7 && x < riverX + 11)) continue;
      xs.push(x);
    }
    xs.sort((a, b) => a - b);
    for (const x of xs) {
      const y0 = yAt(main, x); if (y0 === null) continue;
      let up = theme === "coast" || rand() < 0.5;
      let len = ri(9, 14);
      // 지형 먼저: 갈래길은 마을 단 안에서 멈춘다 — 위 단(두 단 차이 절벽)·낮은 단으로 넘어가면 그 옆 집 자리가 두 단에 걸려 집이 못 앉았다(ab7 흩어진 마을 1~3채)
      if (hf) {
        const room = (u: boolean) => u ? (hf!.seamAbove ? y0 - hf!.seamAbove(x) - 1 : y0 - 2) : (hf!.seamBelow ? hf!.seamBelow(x) - y0 - 3 : hf!.riverY ? hf!.riverY(x) - 4 - y0 : H - 3 - y0);
        if (room(up) < 6 && room(!up) > room(up)) up = !up;
        len = Math.max(4, Math.min(len, room(up)));
      }
      const keys: [number, number][] = up ? [[x, Math.max(2, y0 - len)], [x, y0]] : [[x, y0 + 1], [x, Math.min(H - 3, y0 + len)]];
      const b = vStreet("갈래길", keys, 1); markStreet(b); connectors.push(b);
    }
    junctionX = xs.length ? xs[Math.floor(xs.length / 2)]! : Math.round(W / 2);
  }
  // 흩어진 마을도 지형 먼저 낮은 단이 있으면 아랫길을 낸다 — 갈래길은 마을 단 안에서 멈추므로 낮은 단의 밭이 아무 길에도 안 닿았다(ab10 사막 오아시스 「남쪽 띠에 길·건널 곳이 없다」)
  if (codeT || form === "riverbank" || (form === "scatter" && theme !== "coast" && !hf?.seamBelow)) {
    // 위에서 뼈대를 다 깔았다
  } else if (coastStreet) {
    south = main; // 큰길이 물가 길이다 — 생선 시장·잔교·그물 터는 큰길 아래 물가에
  } else if (theme === "coast") {
    // 물가 길: 해안선 3칸 위를 따라 동서로(곶 앞에서 멈춤)
    const keys: [number, number][] = [];
    // 열쇠점 12칸마다, 물가에서 3~4칸 위로 번갈아(물가를 따라 굽고 45칸 넘게 곧지 않게)
    // 이웃 열쇠점이 같은 높이면(물가가 한 칸 물러난 자리에서 -3/-4 번갈이가 상쇄) 한 칸 더 올린다 — 88×56 seed 11 에서 47~51칸 곧은 물가 길이 났다
    const pushKey = (x: number, y: number) => { const prev = keys[keys.length - 1]; keys.push([x, prev && prev[1] === y ? y - 1 : y]); };
    for (let x = 0, k = 0; x <= W - 12; x += 12, k += 1) pushKey(x, Math.min(...shoreY.slice(Math.max(0, x - 6), x + 7)) - 3 - (k % 2));
    pushKey(W - 10, Math.min(...shoreY.slice(W - 13, W - 7)) - 3);
    south = hStreet("물가 길", keys, lanesWidth); markStreet(south);
    connect("포구 길", Math.round(W * 0.5) + ri(-4, 4), main, south);
    connect("포구 길", ri(4, 8), main, south);
    connect("포구 길", W - 10, main, south, "r"); // 물가 길 동쪽 끝이 막다른 길이 되지 않게
  } else if (hf?.seamBelow) {
    // 높이 먼저: 남쪽 길은 한 단 낮은 땅에서 마을 단 절벽 밑 두 줄 아래를 등고선 따라 — 이음길(남북)만 단을 건너 경사로로 오른다
    const below = hf.seamBelow;
    const spans: [number, number][] = riverX >= 0 ? [[0, riverX - 3], [eastStart, W - 1]] : [[0, W - 1]];
    for (const [x0, x1] of spans) {
      if (x1 - x0 < 12) continue;
      // 낮은 단이 넉넉하면(강 없음) 아랫길을 절벽 밑 일곱 줄 아래로 — 절벽과 길 사이에 헛간·곳간 한 줄이 앉는다(ab9 「아래 단이 빈 땅」)
      let room = H; for (let x = x0; x <= x1; x += 1) room = Math.min(room, H - below(x));
      const deep = !hf.riverY && room >= 11;
      const yOf = (x: number) => (deep ? Math.min(H - 3, below(x) + 7) : Math.min(H - 5, below(x) + 2));
      const st = hStreetFn("아랫길", x0, x1, yOf, 1 + (rand() < 0.4 ? 1 : 0));
      markStreet(st); souths.push(st);
      const ends = [x0 > 0 ? x0 + 4 : -1, x1 < W - 1 ? x1 - 4 : -1].filter((x) => x >= 0);
      if (!ends.length) ends.push(Math.round((x0 + x1) / 2) + ri(-3, 3));
      for (const x of ends) connect("이음길", x, main, st);
      if (x1 - x0 > 30 && ends.length < 2) connect("이음길", Math.round(x0 + (x1 - x0) * 0.25) + ri(-2, 2), main, st);
    }
  } else if (H - yMainBase >= 15) {
    // 남쪽 뒷길 — 강이 있으면 양쪽 둑에 하나씩. 맵 가장자리에 닿지 않은 끝마다 이음길로 큰길과 잇는다(막다른 길 없음).
    const spans: [number, number][] = riverX >= 0 ? [[0, riverX - 3], [eastStart, W - 1]]
      : [[rand() < 0.5 ? 0 : ri(4, 8), rand() < 0.5 ? W - 1 : W - 1 - ri(4, 8)]];
    for (const [x0, x1] of spans) {
      if (x1 - x0 < 12) continue;
      const yS = Math.min(H - 6, yMainBase + ri(11, 13));
      const st = hStreet("뒷길(남)", wavy(x0, x1, yS, 2, yS), 1 + (rand() < 0.4 ? 1 : 0));
      markStreet(st); souths.push(st);
      const ends = [x0 > 0 ? x0 : -1, x1 < W - 1 ? x1 : -1].filter((x) => x >= 0);
      if (!ends.length) ends.push(Math.round((x0 + x1) / 2));
      for (const x of ends) connect("이음길", x, main, st, x === x1 && x1 < W - 1 ? "r" : x === x0 && x0 > 0 ? "l" : "m");
      if (x1 - x0 > 30) connect("이음길", Math.round((x0 + x1) / 2) + ri(-3, 3), main, st);
    }
  }
  if (south && south !== main) souths.push(south);
  // 지형 먼저 강(남쪽 동서): 마을이 강에 붙는다 — 물가 길(마을 단이 강가 단이면 강 둑 두 줄 위, 가운데 단이면 아랫길)에서
  // 남북으로 강을 건너는 나루(널다리 — 번들 어촌 포구 「서쪽 작은 부두」 1칸 폭 널판을 물 위 칸마다)와 매어 둔 나룻배.
  // 건너편 둑으로 나루 길이 이어져 맵 남쪽 끝까지(마을 밖 들·다음 마을로). 동서 다리 키트(5×4)는 돌릴 수 없어 남북 건널목은 부두 널판으로 짓는다.
  let ford: { x: number; bank: Street; top: number; bottom: number } | null = null;
  const fordStones: { c: number; kit: string }[] = []; // 나루 널다리 칸(물 위) — 12b 뒤에 1층 널판 타일로 직접 깐다
  if (codePlan) for (const c of codePlan.fords) fordStones.push({ c, kit: "bd-pick-fishing-port-jetty-west" });
  if (hf?.riverY && riverX < 0) {
    const ry = hf.riverY;
    let bank = souths.find((st) => st.horizontal && [...st.cells].some((c) => { const x = c % W; return Math.floor(c / W) >= ry(x) - 4 && Math.floor(c / W) < ry(x); })) ?? null;
    if (!bank && !hf.seamBelow) {
      const n0 = streets.length;
      const st = hStreetFn("물가 길", 0, W - 1, (x) => ry(x) - 2, 1);
      if ([...st.cells].every((c) => occ[c] === FREE || occ[c] === ROAD)) {
        markStreet(st); souths.push(st); bank = st;
        const ends = [ri(5, 9), W - 1 - ri(5, 9)];
        if (W > 44) ends.push(Math.round(W / 2) + ri(-4, 4));
        for (const x of ends) connect("이음길", x, main, st);
      } else streets.splice(n0);
    }
    if (bank) {
      const by = (x: number) => { const y = yAt(bank!, x); return y === null ? -1 : y + bank!.width - 1; };
      const okX = (x: number) => x >= 4 && x < W - 4 && [-2, -1, 0, 1, 2].every((d) => ry(x + d) === ry(x) && by(x + d) === by(x) && by(x) >= 0)
        && Array.from({ length: H - by(x) - 1 }, (_, j) => idx(x, by(x) + 1 + j)).every((c) => occ[c] === FREE || occ[c] === WATERC);
      // 이음길이 물가 길에 닿는 열(큰길 → 이음길 → 물가 길 → 나루가 한 줄로 이어진다)을 먼저, 없으면 가운데에 가까운 곧은 자리
      const laneXs = connectors.map((c) => Math.min(...[...c.cells].map((i) => i % W)));
      const cands = Array.from({ length: W }, (_, x) => x).filter(okX)
        .sort((a, b) => (laneXs.some((l) => Math.abs(l - a) <= 1) ? 0 : 1) - (laneXs.some((l) => Math.abs(l - b) <= 1) ? 0 : 1) || Math.abs(a - W / 2) - Math.abs(b - W / 2));
      const fx = cands[0];
      const stones = have(["bd-pick-fishing-port-jetty-west"]);
      if (fx !== undefined && stones.length) {
        const lane = vStreet("나루 길", [[fx, by(fx) + 1], [fx, H - 1]], 1);
        for (const c of lane.cells) {
          if (occ[c] === WATERC) { occ[c] = KEEP; const x = c % W, y = Math.floor(c / W); fordStones.push({ c, kit: stones[(x + y) % stones.length]! }); }
          else if (occ[c] === FREE) occ[c] = ROAD;
        }
        connectors.push(lane);
        // 나룻배는 널다리 옆 물에 매어 둔다(물가 둑에 붙여 — 강 한가운데 떠 있지 않게)
        const boat = kitIndex.get("bd-pick-swamp-stilt-rowboat");
        if (boat) for (const bx of [fx + 2, fx - 3]) {
          const y = ry(bx); if (at(bx, y) === WATERC && at(bx + 1, y) === WATERC && !onWater.has(idx(bx, y))) { stamps.push({ kit: boat.id, x: bx, y, record: false }); onWater.add(idx(bx, y)); onWater.add(idx(bx + 1, y)); break; }
        }
        ford = { x: fx, bank, top: ry(fx), bottom: ry(fx) + 2 };
      } else warnings.push("강 건널목(나루 널다리) 자리를 찾지 못했다 — 물가 길이 굽은 곳뿐이었다.");
    }
  }

  // ---------- 3a. 단 위로 오르는 길(2026-10-11) ----------
  // 길이 하나도 닿지 않는 높은 단(큰길 북쪽 뒷길 뒤 2단, 흩어진 마을·낮은 포구의 1단)은 배경으로 남아 거기 생긴 밭 울타리 문까지 못 갔다.
  // 그런 단마다 바로 아랫단의 동서 길에서 곧은 오르막(폭 1, 3b 가 경사로를 놓는다 — 아랫 층계참·경사로 2·윗 층계참)을 북쪽으로 내고,
  // 단 위에서는 등고선을 따라(절벽 끝과 풀밭 한 줄을 띄워) 윗길을 맵 가장자리까지 낸다 — 마을 밖으로 이어지는 밭길·숲길·고갯길.
  // 가장자리에 못 닿으면(양쪽이 골) 오르막을 양 끝에 하나씩 내어 고리로 만든다. 단 위의 쓰임은 마을 설정을 따른다(풀밭 = 밭, 그 밖 = 숲·덤불 덩이, 오르막 머리에 전망 의자).
  interface Climb { level: number; lanes: number[]; path: [number, number]; to: "west" | "east" | "loop"; cells: number[]; rows: Map<number, number>; use: string[]; lookout?: { x: number; y: number }; street?: Street }
  const climbs: Climb[] = [];
  const topStreets: Street[] = []; // 지형 먼저: 고원·언덕 꼭대기 짧은 윗길(오르막 하나)
  // 산골(highland) 맨 윗단(세 단째)은 오를 길 없이 산 숲으로 덮는다(「산골 마을인데 산이 없다」) — 마을 뒤 산비탈
  const summit = new Set<number>();
  let lowered = 0; // 오를 길이 없어 아랫단으로 내린 칸 수
  const trackCells = new Set<number>(); // 풀밭 마을의 윗길·오르막(모랫길로 칠한다)
  if (codePlan && "mat" in spec.road) for (const st of streets) if (st.name === "들길" || scatterWanted) for (const c of st.cells) trackCells.add(c);
  // 내린 단이 다른 단과 합쳐지거나 그 위 단의 아랫단이 사라질 수 있으므로 바뀐 것이 없을 때까지 다시 센다(높이는 내려가기만 하므로 끝난다)
  for (let pass = 0; hasTerrain && !codeT && pass < 4; pass += 1) {
    let changed = false;
    const comp = new Int32Array(W * H).fill(-1); const comps: { level: number; cells: number[] }[] = [];
    for (let c0 = 0; c0 < W * H; c0 += 1) {
      if (lv[c0]! === 0 || comp[c0]! >= 0 || occ[c0] === WATERC || occ[c0] === KEEP) continue;
      const L = lv[c0]!, cells = [c0]; comp[c0] = comps.length;
      for (let h = 0; h < cells.length; h += 1) { const c = cells[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy);
          if (comp[n]! < 0 && lv[n] === L && occ[n] !== WATERC && occ[n] !== KEEP) { comp[n] = comps.length; cells.push(n); } } }
      comps.push({ level: L, cells });
    }
    const grassy = "mat" in spec.road;
    for (const ci of comps.map((_, i) => i).sort((a, b) => comps[a]!.level - comps[b]!.level)) {
      const C = comps[ci]!, L = C.level;
      if (terrainName === "highland" && L >= (hf ? hf.summitFrom : 3)) {
        if (!summit.has(C.cells[0]!)) for (const c of C.cells) if (c + W < W * H && lv[c + W] === L && !rampCells.has(c)) { summit.add(c); occ[c] = FOREST; }
        continue;
      }
      const trunk = streets.filter((st) => !(form === "scatter" && st.name === "갈래길"));
      if (C.cells.some((c) => trunk.some((st) => st.cells.has(c)))) continue; // 이미 길이 지나는 단
      const bot = new Int16Array(W).fill(-1), topY = new Int16Array(W).fill(H), cnt = new Int16Array(W);
      for (const c of C.cells) { const x = c % W, y = (c - x) / W; bot[x] = Math.max(bot[x]!, y); topY[x] = Math.min(topY[x]!, y); cnt[x] += 1; }
      // 윗길이 설 수 있는 열: 단이 세로로 이어지고 3줄 이상, 길 줄(절벽 끝 한 줄 위)이 맵 안
      const usable = (x: number) => x >= 0 && x < W && bot[x]! >= 0 && cnt[x] === bot[x]! - topY[x]! + 1 && cnt[x]! >= 3 && bot[x]! - 1 >= 1;
      const nUsable = Array.from({ length: W }, (_, x) => usable(x)).filter(Boolean).length;
      // 오를 길을 낼 수 없는 단(좁은 조각·길에 안 닿는 자리)은 아랫단으로 내린다 — 아무도 못 가는 대지를 남기지 않는다.
      // 아직 길·물 말고는 아무것도 앉지 않았으므로(3a) 키트가 두 단에 걸칠 일이 없다.
      const flatten = () => { for (const c of C.cells) lv[c] = L - 1; lowered += C.cells.length; changed = true; };
      // 작은 대지 조각(160칸 미만)도 내린다 — 동서 끝이 1px 선으로만 보이는 조각 대지가 맵 구석에 남았다(2026-10-22 독립 검수)
      if (nUsable < 12 || C.cells.length < 160) { flatten(); continue; }
      const hStreets = trunk.filter((st) => st.horizontal);
      /** x 열에서 단 아래로 곧게 내려가 아랫단 동서 길에 닿는 오르막 자리 — 길 윗줄(없으면 null). */
      // 아랫단 높이: 보통 한 단 아래, 높이 먼저면 두 단 아래(마을 단 바로 위 단은 두 단 차이 절벽)도 — 3b 가 계단으로 건넌다
      const maxStep = hf ? 2 : 1;
      const lowerAt = (x: number) => { const b = bot[x]! + 1; return b < H ? lv[idx(x, b)]! : -1; };
      // 곧은 폭: 보통 다섯 열(±2). 지형 먼저 언덕·사라지는 단 끝은 곧은 다섯 열이 드물어(ab10 사막 언덕 885칸이 통째로 내려앉음) 못 찾으면 세 열(±1)로 한 번 더 본다.
      let laneR = 2;
      const laneAt = (x: number): { st: Street; y: number } | null => {
        if (!usable(x)) return null;
        for (let d = -laneR; d <= laneR; d += 1) if (!usable(x + d) || bot[x + d] !== bot[x]) return null; // 경사로 단면·절벽 끝이 곧은 자리
        const Ld = lowerAt(x); if (Ld < 0 || Ld >= L || L - Ld > maxStep) return null;
        let y = bot[x]! + 1;
        while (y < H && occ[idx(x, y)] === FREE && lv[idx(x, y)] === Ld) y += 1;
        if (y >= H || occ[idx(x, y)] !== ROAD || y - bot[x]! < 4) return null;
        const st = hStreets.find((h) => h.cells.has(idx(x, y)) && yAt(h, x) === y); if (!st) return null;
        for (let d = -laneR; d <= laneR; d += 1) if (yAt(st, x + d) !== y) return null; // 아랫길도 곧은 자리(오르막이 꺾이는 자리에 붙으면 턱이 남는다)
        for (let yy = bot[x]! - 1; yy < y; yy += 1) for (const sx of [x - 1, x + 1]) if (at(sx, yy) === ROAD || at(sx, yy) === PLAZAC) return null; // 나란한 길 금지
        // 옆 네 열 안에 이미 단을 건너는 남북 길(이음길·다른 오르막)이 있으면 그 길을 쓴다 — 계단 두 개가 붙어 섰다(2026-10-29 b6 terra)
        for (let dx = -4; dx <= 4; dx += 1) { if (Math.abs(dx) < 2) continue; let run = 0; for (let yy = bot[x]! - 1; yy <= bot[x]! + 1; yy += 1) if (at(x + dx, yy) === ROAD || at(x + dx, yy) === PLAZAC) run += 1; if (run >= 3) return null; }
        return { st, y };
      };
      const runOf = (x: number): [number, number] => { let a = x, b = x; while (usable(a - 1)) a -= 1; while (usable(b + 1)) b += 1; return [a, b]; };
      let cands = Array.from({ length: W }, (_, x) => x).filter((x) => laneAt(x));
      if (!cands.length && hf) { laneR = 1; cands = Array.from({ length: W }, (_, x) => x).filter((x) => laneAt(x)); }
      if (!cands.length) { flatten(); continue; }
      type Plan = { lanes: number[]; path: [number, number]; to: Climb["to"]; score: number };
      const plans: Plan[] = [];
      for (const x of cands) {
        const [r0, r1] = runOf(x); const span = r1 - r0;
        const target = Math.max(14, Math.min(36, Math.round(span * 0.5)));
        if (r0 === 0 && x >= 10) plans.push({ lanes: [x], path: [0, x], to: "west", score: Math.abs(x - target) });
        if (r1 === W - 1 && W - 1 - x >= 10) plans.push({ lanes: [x], path: [x, W - 1], to: "east", score: Math.abs(W - 1 - x - target) });
        if (r0 > 0 && r1 < W - 1) for (const x2 of cands) if (x2 - x >= 10 && x2 <= r1) plans.push({ lanes: [x, x2], path: [x, x2], to: "loop", score: 100 + Math.abs(x2 - x - target) });
        // 지형 먼저: 맵 가장자리에 닿지 않는 고원·언덕 꼭대기는 오르막 하나 + 꼭대기 짧은 윗길(막다른 전망길)도 받는다 — 고리를 못 내면 꼭대기가 통째로 내려앉았다(고원 사라짐)
        if (hf && r0 > 0 && r1 < W - 1) plans.push({ lanes: [x], path: [Math.max(r0 + 1, x - 5), Math.min(r1 - 1, x + 5)], to: "loop", score: 200 + Math.abs(x - Math.round((r0 + r1) / 2)) });
      }
      plans.sort((a, b) => a.score - b.score || a.lanes[0]! - b.lanes[0]!);
      let built = false;
      for (const pl of plans.slice(0, 6)) {
        const nBefore = streets.length;
        const up = hStreetFn("윗길", pl.path[0], pl.path[1], (x) => bot[x]! - 1, 1);
        const lanes: Street[] = [];
        // 흩어진 마을의 갈래길이 단 위로 들어와 있으면 윗길이 그 길과 만나도 된다(만난 곳이 갈림목)
        const free = (c: number) => occ[c] === FREE || (form === "scatter" && occ[c] === ROAD && streets.some((st) => st.name === "갈래길" && st.cells.has(c)));
        let ok = [...up.cells].every((c) => free(c) && lv[c] === L && comp[c] === ci);
        // 절벽 끝 한 줄 띄움: 윗길 칸 바로 남쪽은 같은 단(풀밭 한 줄)이어야 한다
        if (ok) ok = [...up.cells].every((c) => c + W < W * H && (up.cells.has(c + W) || lv[c + W] === L));
        for (const x of pl.lanes) {
          if (!ok) break;
          const top = yAt(up, x); const lane = laneAt(x); if (top === null || !lane) { ok = false; break; }
          const v = vStreet("오르막", [[x, top + 1], [x, lane.y - 1]], 1);
          lanes.push(v);
          const Ld = lowerAt(x);
          ok = [...v.cells].every((c) => free(c) && (Math.floor(c / W) <= bot[x]! ? lv[c] === L : lv[c] === Ld));
        }
        if (!ok) { streets.splice(nBefore); continue; }
        for (const st of [up, ...lanes]) { markStreet(st); if (grassy) for (const c of st.cells) trackCells.add(c); }
        const rows = new Map<number, number>(); for (const c of up.cells) { const x = c % W; rows.set(x, Math.max(rows.get(x) ?? -1, Math.floor(c / W))); }
        climbs.push({ level: L, lanes: pl.lanes, path: pl.path, to: pl.to, cells: C.cells, rows, use: [], street: up });
        if (hf && pl.lanes.length === 1 && pl.to === "loop") topStreets.push(up); // 꼭대기 전망길 — 7단계가 그 북쪽에 집 한 채(고원 위 집·망루 자리)를 앉힌다
        built = true; break;
      }
      if (!built) flatten();
    }
    if (!changed) break;
  }

  // ---------- 3b. 길이 단을 건너는 곳 = 매끈한 경사로 ----------
  // 길 단면(동서 길은 열, 남북 길은 줄)을 길을 따라 걸으며 단이 바뀌는 곳마다 낮은 쪽 두 칸(단 차 + 1)에 경사로(코드 1~4)를 놓는다.
  // 경사로·두 층계참이 곧은 단면이어야 한다(편집기 connectTerrainRoad 와 같은 계약). 굽은 곳에서 바뀌면 높은 쪽으로 길을 깎아(그 길 칸을 낮은 단으로)
  // 곧은 곳까지 바뀌는 자리를 민다 — 길이 언덕을 깎고 오르는 모습. 단면 안에서 단이 섞이면 낮은 쪽으로 깎는다.
  if (hasTerrain) {
    const isRoad = (c: number) => occ[c] === ROAD || occ[c] === PLAZAC;
    const lower = (c: number, to: number) => { if (lv[c]! > to) { lv[c] = to; cutCells += 1; } };
    const rampStreet = (st: Street) => {
      const along = (c: number) => (st.horizontal ? c % W : Math.floor(c / W));
      const across = (c: number) => (st.horizontal ? Math.floor(c / W) : c % W);
      const sec = new Map<number, number[]>();
      for (const c of st.cells) if (isRoad(c)) { const a = along(c); (sec.get(a) ?? sec.set(a, []).get(a)!).push(c); }
      const pos = [...sec.keys()].sort((a, b) => a - b);
      const key = (p: number) => (sec.get(p) ?? []).map(across).sort((a, b) => a - b).join(",");
      const L = (p: number) => Math.min(...(sec.get(p) ?? []).map((c) => lv[c]!));
      // 깎은 동서 길 칸 바로 남쪽이 높으면 그 높은 칸이 길을 가린다 — 한 줄 같이 깎는다
      const lowerSec = (p: number, to: number) => { for (const c of sec.get(p) ?? []) { lower(c, to); if (st.horizontal) { const b = c + W; if (b < W * H && !st.cells.has(b) && lv[b]! > to && !isRoad(b)) lower(b, to); } } };
      for (const p of pos) { const m = L(p); lowerSec(p, m); }
      const straight = (ps: number[]) => ps.every((p) => sec.has(p)) && ps.every((p) => key(p) === key(ps[0]!));
      // 경사로 칸 옆(단면 바깥)에 다른 길이 붙으면 옆구리로는 못 오른다 — 그런 자리는 피한다
      const sideFree = (p: number) => (sec.get(p) ?? []).every((c) => {
        const x = c % W, y = (c - x) / W;
        const side = st.horizontal ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        return side.every(([dx, dy]) => { const X = x + dx!, Y = y + dy!; if (!inMap(X, Y)) return true; const n = idx(X, Y); return st.cells.has(n) || !isRoad(n); });
      });
      for (let guard = 0; guard < 40; guard += 1) {
        let fixed = false;
        for (let i = 0; i + 1 < pos.length; i += 1) {
          const p = pos[i]!, q = pos[i + 1]!; if (q !== p + 1) continue;
          const lp = L(p), lq = L(q); if (lp === lq) continue;
          if ([...(sec.get(p) ?? []), ...(sec.get(q) ?? [])].some((c) => rampCells.has(c))) continue;
          const up = lq > lp ? 1 : -1; // 높은 쪽 방향(along 축)
          // 높이 먼저(hf): 두 단 차이(마을 단 ↔ 위 단 두꺼운 절벽)까지 그대로 건넌다 — 계단 세 칸. 그 밖은 한 단씩(더 높으면 높은 쪽을 깎는다).
          const maxStep = hf || codeT ? 2 : 1;
          const lo = Math.min(lp, lq), dl = Math.min(maxStep, Math.abs(lp - lq)), hi = lo + dl;
          if (Math.abs(lp - lq) > maxStep) { lowerSec(up > 0 ? q : p, hi); fixed = true; break; }
          // 낮은 쪽 마지막 칸 = b, 경사로 b·…·b−dl·up(단 차 + 1칸), 아랫 층계참 b−(dl+1)up, 윗 층계참 b+up. 높은 쪽으로 k칸 밀며(그만큼 길을 깎아) 곧은 자리를 찾는다.
          const b0 = up > 0 ? p : q;
          let placed = false;
          // 옆구리 길(옆에 붙은 다른 길)이 있으면 먼저 피하고, 코드 지형은 피할 자리가 없으면 옆구리를 허용한다(늪 골목이 단에서 끊겼다)
          for (let k = 0, relax = false; !placed; k += 1) {
            if (k > 6) { if (relax || !codeT) break; relax = true; k = 0; }
            const b = b0 + k * up, flight = Array.from({ length: dl + 1 }, (_, j) => b - j * up), ps = [b - (dl + 1) * up, ...flight, b + up];
            if (!straight(ps) || (!relax && flight.some((x) => !sideFree(x)))) continue;
            const between = new Set(Array.from({ length: k }, (_, j) => b0 + (j + 1) * up)); // 깎을 높은 쪽 칸들
            if ([...between].some((x) => !sec.has(x) || L(x) !== hi) || L(b + up) !== hi) continue;
            if (ps.slice(0, dl + 2).some((x) => !between.has(x) && L(x) !== lo)) continue;
            for (const x of between) lowerSec(x, lo);
            const dir = st.horizontal ? (up > 0 ? "e" : "w") : (up > 0 ? "s" : "n");
            // 높이 먼저는 계단(코드 5~8) — 잔디 둑 양식은 통나무 계단, 눈 둑은 매끈한 비탈로 그린다(styles carvedStairs/smoothStairs). 판정자가 「경사로가 안 보인다」고 했다(ab6).
            for (const x of flight) for (const c of sec.get(x)!) { ramps[c] = rampCode(dir, true); rampCells.add(c); }
            rampCount += 1; placed = true;
          }
          if (!placed) { rampFails += 1; for (const c of [...(sec.get(p) ?? []), ...(sec.get(q) ?? [])]) rampCells.add(c); }
          fixed = true; break;
        }
        if (!fixed) break;
      }
    };
    // 절벽 끝 바로 위를 지나는 동서 길(둑길 마을 이음길처럼 등고선 줄에 걸린 길)은 그 남쪽 한 줄을 길 높이로 올려 풀밭 한 줄을 둔다
    for (const st of streets) if (st.horizontal) for (const c of st.cells) {
      const b = c + W; if (b >= W * H || !isRoad(c) || isRoad(b) || lv[b]! >= lv[c]!) continue;
      if ([b, b + W].some((n) => n < W * H && (occ[n] === WATERC || occ[n] === KEEP))) continue;
      lv[b] = lv[c]!;
    }
    for (const st of streets) rampStreet(st);
    // 실패한 건널목 표시로 넣었던 칸(경사로 코드 없음)은 빼고, 경사로가 있는 칸만 남긴다
    for (const c of [...rampCells]) if (!ramps[c]) rampCells.delete(c);
    if (rampFails) warnings.push(`길이 단을 건너는 곳 ${rampFails}군데에 경사로를 놓지 못했다(굽은 길·갈림목) — 그 길은 단에서 끊긴다.`);
  }
  rel = { width: W, height: H, levels: Array.from(lv), ramps: ramps.slice() };
  invalidateReliefSlopes(rel);

  planStep("뒷길 고리");
  // ---------- 4. 광장(광장 마을만) ----------
  let plazaX = -1, plazaCy = -1, prx = 0, pry = 0;
  let plazaCells: number[] = [];
  const throughPlaza = new Set<number>(); // 코드 지형: 광장을 지나는 길 칸(판석으로 깔되 소품을 얹지 않는다)
  if (codePlan) {
    if (codePlan.plaza) {
      plazaX = codePlan.g.x; plazaCy = codePlan.g.y; prx = ri(4, 5); pry = 3;
      const gl = lv[idx(plazaX, plazaCy)]!;
      const ok = (c: number) => (occ[c] === FREE || occ[c] === ROAD) && lv[c] === gl && !rampCells.has(c);
      // 모이는 곳에서 이어진 칸만(단 너머·건물 뒤로 판석이 번지지 않게)
      const inBlob = new Set(blob(plazaX, plazaCy, prx, pry, 0.1).filter(ok));
      const s0 = idx(plazaX, plazaCy); const q = inBlob.has(s0) ? [s0] : []; const seenP = new Set(q);
      for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (inBlob.has(n) && !seenP.has(n)) { seenP.add(n); q.push(n); } } }
      plazaCells = q;
      for (const c of plazaCells) { if (occ[c] === ROAD) throughPlaza.add(c); occ[c] = PLAZAC; }
    }
  } else if (form === "plaza") {
  const plazaX0 = (() => {
    if (riverX >= 0) return riverLeft ? eastStart + Math.round((W - eastStart) * 0.5) + ri(-3, 3) : Math.round(riverX * 0.5) + ri(-3, 3);
    if (spec.feature === "pond") return pondSide === "w" ? Math.round(W * 0.6) + ri(-3, 3) : Math.round(W * 0.4) + ri(-3, 3);
    return Math.round(W * 0.48) + ri(-4, 4);
  })();
  // 광장은 큰길 남쪽으로 부풀린다 — 북쪽 띠는 앵커 건물(광장을 보는 여관·회관)이 쓴다
  prx = ri(5, 6); pry = ri(3, 4);
  // 남쪽으로 내려가는 이음길이 광장을 가르지 않는 자리로 민다(길이 판석을 가르면 결절점이 둘로 쪼개진다)
  const southLaneXs = connectors.filter((c) => [...c.cells].some((i) => Math.floor(i / W) > (yAt(main, i % W) ?? 0))).map((c) => Math.min(...[...c.cells].map((i) => i % W)));
  plazaX = (() => {
    const clear = (x: number) => x - prx - 1 > 0 && x + prx + 1 < W - 1 && southLaneXs.every((lx) => Math.abs(lx - x) > prx + 2)
      && (riverX < 0 || x + prx + 2 < riverX || x - prx - 2 > riverX + 4);
    for (let d = 0; d < W; d += 1) for (const x of [plazaX0 + d, plazaX0 - d]) if (clear(x)) return x;
    return plazaX0;
  })();
  plazaCy = yMainAt(plazaX) + 1.5 + pry;
  // 큰길은 광장 북쪽 가장자리를 그대로 지나간다(길망이 광장에서 끊기지 않게)
  plazaCells = blob(plazaX, plazaCy, prx, pry, 0.08).filter((c) => occ[c] !== WATERC && occ[c] !== KEEP && !main.cells.has(c));
  // 광장은 판석 46칸 안팎 — 소품이 아래층을 덮어도 결절점(24칸)이 남게, 모자라면 가로로 넓힌다
  for (let grow = 1; plazaCells.length < 46 && grow <= 4; grow += 1) {
    for (const c of blob(plazaX, plazaCy, prx + grow, pry, 0.08)) if (!plazaCells.includes(c) && occ[c] !== WATERC && occ[c] !== KEEP && !main.cells.has(c)) plazaCells.push(c);
  }
  // 광장은 한 단 — 광장 자리 큰길과 같은 단만(단 너머로 판석이 번지지 않게)
  if (hasTerrain) { const pl = lv[idx(plazaX, Math.min(H - 1, yMainAt(plazaX)))]!; plazaCells = plazaCells.filter((c) => lv[c] === pl && !rampCells.has(c)); }
  for (const c of plazaCells) occ[c] = PLAZAC;
  }
  const plazaSet = new Set(plazaCells);

  planStep("광장");
  // ---------- 5. 못·늪 (길을 피해) ----------
  const nearStreet = (c: number, d: number) => {
    const x = c % W, y = (c - x) / W;
    for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) { const v = at(x + dx, y + dy); if (v === ROAD || v === PLAZAC || v === KEEP) return true; }
    return false;
  };
  const pondCells: number[] = [];
  const bogRing = new Set<number>(); // 늪 물가 한 줄(이끼 늪, 막힘) — 12b 에서 진흙 둑 덧그림
  if (pondPlan && spec.pond) {
    const { cx, cy, rx, ry } = pondPlan;
    const ring = spec.pond.ring ? blob(cx, cy, rx + 2.5, ry + 2.2, lawnOverlay ? 0.22 : 0.12) : [];
    for (const c of ring) if (occ[c] === FREE && !nearStreet(c, 0)) { occ[c] = POND_RING; surfaceAt.set(c, spec.pond.ring!); }
    for (const c of blob(cx, cy, rx, ry, 0.14)) if ((occ[c] === FREE || occ[c] === POND_RING) && !nearStreet(c, 1)) { occ[c] = WATERC; pondCells.push(c); surfaceAt.set(c, spec.pond.water); }
    if (lawnOverlay) {
      // 풀밭은 2층 덧그림(자연 가장자리)이라 1층은 모래 그대로, 물 칸은 8이웃이 모두 물·풀밭이어야 한다 — 모래에 바로 닿는 물·4칸 미만 물 조각은 풀밭으로
      for (const c of ring) if (occ[c] === POND_RING) surfaceAt.delete(c);
      for (let pass = 0; pass < 4; pass += 1) {
        let changed = 0;
        for (const c of [...pondCells]) {
          const x = c % W, y = (c - x) / W;
          const bare = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]].some(([dx, dy]) => { const v = at(x + dx!, y + dy!); return v !== WATERC && v !== POND_RING; });
          const nWater = [[0, -1], [0, 1], [-1, 0], [1, 0]].filter(([dx, dy]) => at(x + dx!, y + dy!) === WATERC).length;
          if (bare || nWater <= 1) { occ[c] = POND_RING; surfaceAt.delete(c); pondCells.splice(pondCells.indexOf(c), 1); changed += 1; }
        }
        if (!changed) break;
      }
      if (pondCells.length < 4) for (const c of pondCells.splice(0)) { occ[c] = POND_RING; surfaceAt.delete(c); }
      for (let c = 0; c < W * H; c += 1) if (occ[c] === POND_RING) lawnSet.add(c);
      for (const c of pondCells) lawnSet.add(c);
    }
  }

  if (codeT && spec.pond) {
    // 코드 지형의 못(오아시스·얼음 못·늪 못): 물 칸은 테마 물 표본, 물가 두 칸은 물가 고리(사막은 풀밭 덧그림)
    const pond = spec.pond;
    for (let c = 0; c < W * H; c += 1) if (occ[c] === WATERC && codeT.water[c]) { pondCells.push(c); surfaceAt.set(c, pond.water); }
    for (let c = 0; c < W * H; c += 1) {
      if (occ[c] !== FREE) continue; const x = c % W, y = (c - x) / W; let near = false;
      for (let dy = -2; dy <= 2 && !near; dy += 1) for (let dx = -2; dx <= 2; dx += 1) { if (at(x + dx, y + dy) === WATERC && lv[idx(x + dx, y + dy)] === lv[c] && dx * dx + dy * dy <= 5) { near = true; break; } }
      if (!near || nearStreet(c, 0)) continue;
      occ[c] = POND_RING; if (pond.ring && !lawnOverlay) surfaceAt.set(c, pond.ring);
    }
    if (lawnOverlay) { for (let c = 0; c < W * H; c += 1) if (occ[c] === POND_RING) lawnSet.add(c); for (const c of pondCells) lawnSet.add(c); }
  }
  planStep("못·늪");
  // ---------- 6. 앵커 건물(광장 북쪽) ----------
  /** 지형 위 자리: 발자국 전부 한 단(L), 가림 규칙(남쪽 k줄 칸은 L + k − 1 이하 — 3/4 시점에서 들린 남쪽 칸이 키트 아랫줄을 덮지 않게),
   *  문이 있으면 문 앞 칸도 같은 단이고 경사로가 아니다. 키트 그림은 한 단 위에만 앉는다(반쯤 걸치면 절벽이 그림을 가른다). */
  const LV = (x: number, y: number) => (inMap(x, y) ? lv[idx(x, y)]! : 0);
  const flatOn = (k: Kit, x: number, y: number): boolean => {
    if (!hasTerrain) return true;
    const L = LV(x, y);
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (LV(x + i, y + j) !== L) return false;
    for (let i = 0; i < k.w; i += 1) for (let kk = 1; kk <= 2; kk += 1) if (inMap(x + i, y + k.h - 1 + kk) && LV(x + i, y + k.h - 1 + kk) > L + kk - 1) return false;
    // 문 앞 칸도 같은 단·경사로 아님, 그리고 절벽 끝이 아니다(바로 남쪽이 낮으면 문 앞 길이 절벽 위에 놓인다)
    if (k.door) { const fx = x + k.door.dx, fy = y + k.door.dy + 1; if (inMap(fx, fy) && (LV(fx, fy) !== L || rampCells.has(idx(fx, fy)) || (inMap(fx, fy + 1) && LV(fx, fy + 1) < L && !rampCells.has(idx(fx, fy + 1))))) return false; }
    return true;
  };
  const fits = (k: Kit, x: number, y: number, margin = 0, allow: (v: number) => boolean = (v) => v === FREE || v === POND_RING) => {
    if (x < 0 || y < 0 || x + k.w > W || y + k.h > H) return false;
    for (let j = -margin; j < k.h + margin; j += 1) for (let i = -margin; i < k.w + margin; i += 1) {
      const inside = i >= 0 && j >= 0 && i < k.w && j < k.h;
      const v = at(x + i, y + j);
      if (inside) { if (!allow(v)) return false; } else if (v === BLD) return false;
    }
    return flatOn(k, x, y);
  };
  /** 칸들이 모두 한 단이고 경사로가 아닌가(밭·울타리·문 앞 토막 길). */
  const flatCells = (cells: number[]): boolean => !hasTerrain || (cells.length === 0 || cells.every((c) => lv[c] === lv[cells[0]!] && !rampCells.has(c)));
  /** 새 길 칸이 절벽 끝(바로 남쪽이 낮은 단, 경사로 아님) 위가 아닌가 — 절벽 끝 바로 위의 길은 어색하다(RIM_GAP 규칙). */
  const offRim = (cells: number[]): boolean => !hasTerrain || cells.every((c) => !(c + W < W * H && lv[c + W]! < lv[c]! && !rampCells.has(c + W)));
  const claim = (k: Kit, x: number, y: number, v: number, record: boolean) => {
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
      set(x + i, y + j, v);
      const r = k.def.rows[j]; if (r && ((r.tiles[i] ?? -1) >= 0 || (r.upperTiles?.[i] ?? -1) >= 0) && inMap(x + i, y + j)) cover[idx(x + i, y + j)] = 1;
    }
    stamps.push({ kit: k.id, x, y, record, v });
  };
  const anchors: string[] = [];
  /** 물가에 걸치는 키트(물레방아·생선 시장): 계획 칸은 잡되 물이던 칸은 물로 남겨 물로 칠해지게 한다. */
  // 서 있는 소품(생선 시장 좌판)의 발 — 막힌 칸, 없으면 맨 아래 줄의 그림 칸. 발이 물 위면 stamp_object 가 거절한다
  // (작은 포구·포구 길가에서 좌판이 매번 「찍기 실패」로 빠졌다, 2026-10-22). 물에 걸치는 것은 발 밖 칸만.
  const feetOnWater = (k: Kit, x: number, y: number): boolean => {
    const blocks = (t: number) => { if (t < 0) return false; const p = ts.passability?.[t]; return !!p && !p.up && !p.down && !p.left && !p.right; };
    const cells: [number, number][] = [];
    k.def.rows.forEach((row, j) => (row.upperTiles ?? []).forEach((t, i) => { if (blocks(t)) cells.push([i, j]); }));
    if (!cells.length) (k.def.rows[k.h - 1]?.upperTiles ?? []).forEach((t, i) => { if (t >= 0) cells.push([i, k.h - 1]); });
    return cells.some(([i, j]) => at(x + i, y + j) === WATERC);
  };
  const claimKeepingWater = (k: Kit, x: number, y: number, v: number) => {
    const wet: number[] = [];
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (at(x + i, y + j) === WATERC) wet.push(idx(x + i, y + j));
    claim(k, x, y, v, true);
    for (const c of wet) occ[c] = WATERC;
  };
  /** 문 앞 칸에서 가장 가까운 길·광장까지 빈 땅으로 BFS 해 1칸 폭 문 앞 길을 낸다(건물·물은 피한다). */
  const linkToRoad = (fx: number, fy: number, commit = true): boolean => {
    if (!inMap(fx, fy)) return false;
    const prev = new Int32Array(W * H).fill(-2); const start = idx(fx, fy); prev[start] = -1; const q = [start];
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]!; const x = c % W, y = (c - x) / W;
      if (c !== start && (occ[c] === ROAD || occ[c] === PLAZAC)) {
        if (!commit) return true;
        for (let t = prev[c]!; t >= 0; t = prev[t]!) if (occ[t] === FREE || occ[t] === POND_RING) occ[t] = ROAD;
        if (occ[start] === FREE || occ[start] === POND_RING) occ[start] = ROAD;
        return true;
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
        if (prev[n] !== -2) continue; const v = occ[n];
        if (rel && !reliefAllowsStep(rel, x, y, nx, ny)) continue; // 단은 경사로로만 오른다
        if (hasTerrain && (v === FREE || v === POND_RING) && ny + 1 < H && lv[n + W]! < lv[n]! && !rampCells.has(n + W)) continue; // 새 길을 절벽 끝 위로 내지 않는다
        if (v === FREE || v === POND_RING || v === ROAD || v === PLAZAC) { prev[n] = c; q.push(n); }
      }
    }
    return false;
  };
  const doorFronts: { x: number; y: number; kit: string }[] = [];
  // 모이는 곳 — 형태마다 「왜 거기」가 있는 자리. 앵커 건물은 그 길의 북쪽에서 문으로 길을 본다.
  /** 코드 지형: 미리 잡아 둔 건물 자리를 계단·길 정리 뒤 다시 확인하고 앉힌다. */
  const claimCodeSpot = (sp: CodeSpot): boolean => {
    for (let j = 0; j < sp.k.h; j += 1) for (let i = 0; i < sp.k.w; i += 1) { const c = idx(sp.x + i, sp.y + j); if (occ[c] === RESV) occ[c] = FREE; }
    if (!fits(sp.k, sp.x, sp.y)) { codePlan!.report.failed.push(`${sp.role}(${sp.want.x},${sp.want.y}) — 계단·길을 놓은 뒤 문 앞이 계단·절벽 끝이 되어 앉지 못했다`); return false; }
    claim(sp.k, sp.x, sp.y, BLD, true);
    const f = idx(sp.front.x, sp.front.y); if (occ[f] === FREE) occ[f] = ROAD;
    doorFronts.push({ x: sp.front.x, y: sp.front.y, kit: sp.k.id });
    return true;
  };
  const gather: { s: Street; x: number; why: string } = codePlan ? { s: main, x: codePlan.g.x, why: codePlan.report.auto ? "자동 배치(가장 넓은 낮은 터)" : "조수가 고른 모이는 곳" } : (() => {
    if (form === "plaza") return { s: main, x: plazaX, why: "큰길 위 광장" };
    // 지형 먼저: 모이는 곳(앵커 건물)은 땅이 정한다 — 강을 건너는 나루로 내려가는 길목, 윗단으로 오르는 계단 어귀, (그다음 형태별 자리)
    if (hf && form !== "riverbank" && spec.feature !== "pond") {
      if (ford) return { s: main, x: ford.x + 3, why: "나루(널다리)로 내려가는 길목" };
      const cl = climbs.filter((c) => c.level <= hf!.villageLevel + 2).sort((a, b) => a.level - b.level)[0];
      if (cl && cl.lanes.length) return { s: main, x: cl.lanes[0]! + 3, why: "윗단으로 오르는 계단 어귀" };
    }
    if (form === "riverbank") return { s: entryLane ?? main, x: Math.max(...[...main.cells].map((c) => c % W)) + 4, why: "들길이 둑길과 만나는 어귀" };
    if (form === "scatter") return { s: main, x: junctionX + (junctionX + 4 < W - 2 ? 3 : -3), why: "오솔길 갈림길" };
    if (riverX >= 0) return { s: main, x: riverLeft ? riverX + 9 : riverX - 6, why: "다리 머리" };
    if (coastStreet) { const pier = coastSpots.find((sp) => sp.kind === "pier"); return { s: main, x: pier ? pier.x + 1 : Math.round(W * 0.5) + 2, why: "잔교 앞 물가 큰길" }; }
    if (theme === "coast") { const lane = connectors.find((c) => c.name === "포구 길"); const lx = lane ? Math.min(...[...lane.cells].map((c) => c % W)) : Math.round(W / 2); return { s: main, x: lx + 3, why: "포구 길이 큰길과 만나는 어귀" }; }
    if (spec.feature === "pond") return { s: main, x: pondSide === "w" ? Math.round(W * 0.2) + 10 : Math.round(W * 0.8) - 10, why: theme === "desert" ? "못(오아시스)으로 드는 어귀" : theme === "snow" ? "얼어붙은 못가로 드는 어귀" : "못가로 드는 어귀" };
    return { s: main, x: 7, why: "큰길이 마을로 드는 어귀" };
  })();
  // 모이는 곳은 길이 곧은 자리(앞뒤 4칸 같은 줄)에 — 길이 꺾이는 자리에 앵커·어귀·우물을 두면 폭 2 길의 아랫줄이 2~3칸 턱으로 남는다.
  // 이미 곧으면 그대로(결과 불변).
  if (gather.s.horizontal && form !== "plaza" && !codePlan) { // 광장 마을은 광장 맞은편 그대로
    const straightAt = (x: number) => { const y = yAt(gather.s, x); if (y === null) return false; for (let e = -4; e <= 4; e += 1) if (yAt(gather.s, x + e) !== y) return false; return true; };
    const hit = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((d) => gather.x + d).find((x) => x >= 4 && x < W - 4 && straightAt(x));
    if (hit !== undefined) gather.x = hit;
  }
  let gatherDoor: { x: number; y: number } | null = null;
  if (codePlan) {
    for (const sp of codePlan.spots) if ((sp.role === "landmark" || sp.role === "anchor") && claimCodeSpot(sp)) { anchors.push(sp.k.id); if (sp.role === "anchor") gatherDoor = { ...sp.front }; }
    if (!gatherDoor && !codePlan.plaza) gatherDoor = { x: codePlan.g.x, y: codePlan.g.y - 1 };
  } else {
    // 중세 건물 마을은 모이는 곳에 시청·장터·예배당·여관 같은 공공 건물(2026-10-25 VQA: 광장·장터·교회가 없고 앵커가 원본 버들항 집이었다)
    const anchorPool = roofs === "medieval" ? have(MEDIEVAL_ANCHORS) : [];
    const cand = (anchorPool.length ? anchorPool : have(spec.anchors)).filter((id) => K(id).door);
    const order = cand.map((id) => ({ id, r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.id);
    let done = false;
    // 가까운 자리부터, 안 되면 ±16칸까지(계단식 비탈 물가 띠 88×56 seed 11 은 ±10 안이 다 단 경계였다 — 길가 집 띠가 지형·물에 좁아진 마을에서 앵커를 놓치지 않게 — 앞 자리에서 찾으면 결과는 그대로)
    // 길에 바로 붙일 자리가 없으면 1~2칸 물러앉히고 문 앞을 길로 잇는다(굽은 길이 집 밑으로 파고드는 자리·좁은 집 띠) — 바로 붙는 자리를 다 본 뒤에만
    for (const setback of [0, 1, 2]) {
      for (const off of [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -13, 13, -16, 16]) {
        for (const id of order) {
          const k = K(id); const d = k.door!; const fx = gather.x + off; const top = yAt(gather.s, fx) ?? -1;
          if (top < 0) continue;
          const x = fx - d.dx, y = top - 1 - d.dy - setback;
          const stub = Array.from({ length: setback }, (_, j) => idx(fx, top - 1 - j));
          if (stub.some((c) => occ[c] !== FREE) || !flatCells([...stub, idx(fx, top)])) continue;
          if (fits(k, x, y)) {
            claim(k, x, y, BLD, true); for (const c of stub) occ[c] = ROAD;
            anchors.push(id); doorFronts.push({ x: fx, y: top - setback, kit: id }); gatherDoor = { x: fx, y: top }; done = true; break;
          }
        }
        if (done) break;
      }
      if (done) break;
    }
    if (!done) warnings.push(form === "plaza" ? "광장 맞은편(큰길 북쪽)에 앵커 건물이 들어갈 자리가 없었다." : `모이는 곳(${gather.why})에 앵커 건물이 들어갈 자리가 없었다.`);
  }
  // 길가·물가 띠 마을: 앵커 문 맞은편(길 남쪽)에 작은 판석 어귀 — 광장이 아니라 문 앞 마당 크기
  if (gatherDoor && (form === "street" || form === "riverbank") && !coastStreet && !codePlan) { // 포구 길가는 길 아래가 바로 잔교 머리 물가 — 판석 대신 물가 소품
    const yBelow = gatherDoor.y + gather.s.width;
    const gl = lv[idx(gatherDoor.x, gatherDoor.y)]!;
    const big = roofs === "medieval"; // 중세 건물 마을: 공공 건물 앞 작은 광장
    const apron = blob(gatherDoor.x, yBelow + (big ? 2 : 1), big ? 4.2 : 2.6, big ? 2.2 : 1.4, 0.05).filter((c) => occ[c] === FREE && lv[c] === gl && !rampCells.has(c));
    for (const c of apron) { occ[c] = PLAZAC; plazaCells.push(c); plazaSet.add(c); }
  }

  planStep("큰 건물 자리");
  // ---------- 8. 일터 소품 덩이 ----------
  const propFits = (k: Kit, x: number, y: number) => fits(k, x, y, 0) && (() => {
    // 길·문 앞 칸 바로 위·옆을 막지 않는다(문 앞 길 칸은 ROAD 라 fits 에서 이미 빠짐)
    for (let i = -1; i <= k.w; i += 1) { const v = at(x + i, y + k.h); if (v === KEEP) return false; }
    return true;
  })();
  const cluster = (ids: readonly string[], cx: number, cy: number, n: number, radius: number, v = PROP): number => {
    const pool = have(ids); if (!pool.length) return 0; let placed = 0;
    for (let t = 0; t < n * 25 && placed < n; t += 1) {
      const k = K(choice(pool));
      const x = Math.round(cx + (rand() * 2 - 1) * radius) - Math.floor(k.w / 2), y = Math.round(cy + (rand() * 2 - 1) * radius * 0.7) - k.h + 1;
      if (!propFits(k, x, y)) continue;
      claim(k, x, y, v, false); placed += 1;
    }
    return placed;
  };
  // 광장 아닌 형태: 모이는 곳에 우물(또는 모닥불·좌판) 하나와 곁들이 하나 — 어귀 판석 위, 없으면 앵커 문 옆 빈 땅
  function gatherProps(): number {
    if (!gatherDoor || coastStreet) return 0; // 포구 길가는 일터(잔교)를 먼저 놓고 그 곁 물가에(아래)
    let n = 0;
    const spots = (k: Kit): [number, number][] => {
      const out: [number, number][] = [];
      // 문 줄(dx 0)은 마지막 — 우물이 앵커 문 바로 앞을 막지 않게(2026-10-25 VQA)
      for (let dy = 1; dy <= 4; dy += 1) for (const dx of [-3, 3, -4, 4, -2, 2, -5, 5, 0]) out.push([gatherDoor!.x + dx - Math.floor(k.w / 2), gatherDoor!.y + gather.s.width + dy - k.h]);
      return out;
    };
    const place = (ids: readonly string[]) => {
      const pool = have(ids); if (!pool.length) return false;
      const k = K(pool[0]!);
      for (const [x, y] of spots(k)) {
        if (fits(k, x, y, 0, (v) => v === PLAZAC) || (form === "scatter" && propFits(k, x, y))) { claim(k, x, y, PROP, true); n += 1; return true; }
      }
      return false;
    };
    place(spec.plazaCenter);
    if (form !== "riverbank") place([choice(spec.plazaRing)]);
    return n;
  }
  // 광장: 가운데 우물·모닥불, 둘레 좌판·벤치, 가장자리 등
  let plazaProps = form !== "plaza" ? gatherProps() : (() => {
    let n = 0;
    const center = have(spec.plazaCenter);
    if (center.length) { const k = K(center[0]!); const x = plazaX - Math.floor(k.w / 2), y = Math.round(plazaCy) - Math.floor(k.h / 2) + 1;
      if (fits(k, x, y, 0, (v) => v === PLAZAC)) { claim(k, x, y, PROP, true); n += 1; } }
    const ring = have(spec.plazaRing);
    for (let t = 0; t < 60 && n < 6 && ring.length; t += 1) {
      const a = rand() * 6.28; const k = K(choice(ring));
      const x = Math.round(plazaX + Math.cos(a) * (prx - 1.5)) - Math.floor(k.w / 2), y = Math.round(plazaCy + Math.sin(a) * (pry - 1)) - k.h + 1;
      // 광장 칸 위에만, 큰길 줄(통행)은 비운다
      if (!fits(k, x, y, 0, (v) => v === PLAZAC)) continue;
      let onMain = false; for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (main.cells.has(idx(x + i, y + j)) || throughPlaza.has(idx(x + i, y + j))) onMain = true;
      if (onMain) continue;
      claim(k, x, y, PROP, false); n += 1;
    }
    for (const lamp of have(spec.plazaLamps).slice(0, 1)) {
      const k = K(lamp);
      for (const sx of [-1, 1]) { const x = plazaX + sx * (prx + 1), y = Math.round(plazaCy) - k.h + 1;
        if (fits(k, x, y)) { claim(k, x, y, PROP, false); n += 1; } }
    }
    return n;
  })();
  // 일터 — 테마마다 자리
  let workAt: { x: number; y: number; name: string } | null = null;
  let coastWork: string[] = []; // 포구 길가 마을의 일하는 물가(잔교·작은 부두·그물 말림터)
  if (codePlan) {
    const sp = codePlan.spots.find((s0) => s0.role === "work");
    const built = !!sp && claimCodeSpot(sp);
    if (built) anchors.push(sp!.k.id);
    const wp = built ? { x: sp!.front.x + 3, y: sp!.front.y + 1 } : codePlan.layout.work ?? null;
    if (wp) {
      workAt = { x: wp.x, y: wp.y, name: theme === "desert" ? "대상 마당" : theme === "snow" ? "얼음낚시터" : theme === "swamp" ? "고기 말림터" : theme === "coast" ? "그물 말림터" : built ? "헛간 마당" : "타작마당" };
      cluster(spec.work, wp.x, wp.y, 4, 4);
    }
    // 코드 지형 포구: 바다로 곧게 뻗는 잔교 하나(낚시 포구 잔교 몸통+머리 키트) — 일터·모이는 곳에 가까운 남향 물가에서, 뭍 끝을 길망에 잇는다.
    // 없으면 포구로 읽히지 않았다(ab14 포구 어촌 두 판 「잔교·부두가 없다」).
    if (theme === "coast") {
      const stem = kitIndex.get("bd-pick-fishing-port-jetty-stem"), head = kitIndex.get("bd-pick-fishing-port-jetty-head");
      const sea = (x: number, y: number) => inMap(x, y) && codeT!.water[idx(x, y)] === 3 && occ[idx(x, y)] === WATERC;
      const near = workAt ?? codePlan.g;
      let best: { x: number; y: number; len: number; d: number } | null = null;
      if (stem && head) for (let x = 5; x < W - 6; x += 1) for (let y = 2; y < H - 6; y += 1) {
        const top = occ[idx(x, y)], top2 = occ[idx(x + 1, y)];
        if (!((top === FREE || top === ROAD) && (top2 === FREE || top2 === ROAD)) || !sea(x, y + 1) || !sea(x + 1, y + 1)) continue;
        let len = 0; while (len < stem.h && sea(x, y + 1 + len) && sea(x + 1, y + 1 + len)) len += 1;
        if (len < 5) continue;
        const hy = y + len; let headOk = hy + head.h < H;
        for (let j = 0; j < head.h && headOk; j += 1) for (let i = 0; i < head.w; i += 1) if (!sea(x - 4 + i, hy + j)) { headOk = false; break; }
        if (!headOk) continue;
        const d = Math.hypot(x - near.x, y - near.y); if (!best || d < best.d) best = { x, y, len, d };
      }
      if (best && stem && head && linkToRoad(best.x, best.y, false)) {
        const { x: jx, y: jy, len } = best;
        stamps.push({ kit: stem.id, x: jx, y: jy, record: false });
        for (let j = 1; j <= Math.max(len, stem.h - 1); j += 1) { set(jx, jy + j, KEEP); set(jx + 1, jy + j, KEEP); }
        const hy = jy + len; stamps.push({ kit: head.id, x: jx - 4, y: hy, record: false });
        for (let j = 0; j < head.h; j += 1) for (let i = 0; i < head.w; i += 1) set(jx - 4 + i, hy + j, KEEP);
        linkToRoad(jx, jy);
        coastWork.push(`잔교(${jx},${jy})`);
      }
    }
  } else if (riverX >= 0) {
    // 나루를 먼저 낸다 — 물가 띠 마을의 방앗간은 서쪽 둑에 서고 나루 건너편 들길로 문 앞 길을 잇는다
    // 물가 띠 마을의 나루(2026-10-11 「나룻배로 건너다니는」): 들길 줄 가까이에서 둑길 → 강 동쪽 둑까지 나루 길, 강물에 나룻배,
    // 둑에 계류 말뚝. 건너편 서쪽 둑에도 나루와 맵 서쪽 끝까지 들길. 나루 길 끝(물가)은 막다른 길로 깎지 않는다.
    if (form === "riverbank" && entryLane) {
      const boat = kitIndex.get("bd-pick-swamp-stilt-rowboat"), post = kitIndex.get("bd-prop-mooring_bollard");
      const ly = yAt(entryLane, W - 1) ?? yMainBase;
      const rowWater = (y: number) => { let a = -1, b = -1; for (let x = 0; x < W; x += 1) if (at(x, y) === WATERC) { if (a < 0) a = x; b = x; } return [a, b] as const; };
      const mainLeft = (y: number) => { for (let x = 0; x < W; x += 1) if (main.cells.has(idx(x, y))) return x; return -1; };
      // 방앗간 널다리(바퀴 바로 아래, 대략 wy0+6 줄)와 10줄 이상 떨어진 줄을 먼저 — 건널목 둘이 붙으면 나루가 쓸모없어 보인다
      const millRow = Math.max(4, Math.round(yMainBase * 0.45)) + 6;
      const dys = [0, 3, -3, 6, -6, 9, -9, 12].sort((a, b) => (Math.abs(ly + a - millRow) >= 10 ? 0 : 1) - (Math.abs(ly + b - millRow) >= 10 ? 0 : 1) || Math.abs(a) - Math.abs(b));
      for (const dy of dys) {
        const fy = ly + dy; if (fy < 3 || fy > H - 4) continue;
        const [wW, wE] = rowWater(fy); const ml = mainLeft(fy); if (wW < 0 || ml < 0) continue;
        const east: number[] = []; for (let x = wE + 1; x < ml; x += 1) east.push(idx(x, fy));
        const west: number[] = []; for (let x = 0; x < wW; x += 1) west.push(idx(x, fy));
        if (!east.length || ![...east, ...west].every((c) => occ[c] === FREE)) continue;
        if (!flatCells([...east, idx(ml, fy)]) || !flatCells(west) || !offRim([...east, ...west])) continue; // 나루 길은 한 단(경사로 없이 닿는다)·절벽 끝 위 아님
        for (const c of [...east, ...west]) occ[c] = ROAD;
        keepRoad.add(idx(wE + 1, fy)); if (wW > 0) keepRoad.add(idx(wW - 1, fy));
        // 나룻배는 동쪽 나루에 붙여 맨다(강 한가운데 떠 있으면 길이 둑에서 끊긴 것처럼 보였다 — 2026-10-25 VQA)
        if (boat && at(wE - 1, fy) === WATERC && at(wE, fy) === WATERC) { stamps.push({ kit: boat.id, x: wE - 1, y: fy, record: false }); onWater.add(idx(wE, fy)); onWater.add(idx(wE - 1, fy)); }
        if (post) for (const [px, py] of [[wE + 1, fy - 1], [wW - 1, fy - 1]] as const) if (px >= 0 && fits(post, px, py - post.h + 1)) claim(post, px, py - post.h + 1, PROP, false);
        ferry = { x: wE + 1, y: fy };
        break;
      }
      if (!ferry) warnings.push("물가 띠 마을에 나루 자리를 찾지 못했다(둑길과 강 사이가 막힘).");
    }
    // 방앗간: 북쪽 강둑. 물레방아 그림은 바퀴 왼쪽 위에 굴대 들보가 왼쪽으로 뻗는다 — 원본(강가 방앗간 변형)처럼 들보가 왼쪽 뭍의
    // 방앗간 벽에 닿아야 한다(2026-10-11 사용자 「옆에 짝이 맞는 건물이 필요」). 그래서 바퀴는 강 **서쪽** 둑에 걸치고
    // (밑 줄: 왼쪽 한 칸 뭍, 오른쪽 둘 강물 — 놓기 규칙 kitPlacementRules), 방앗간 h109 를 바퀴 바로 왼쪽에 붙여 앉힌다.
    // 방앗간 문 앞 길이 길망에 닿지 않으면 바퀴도 놓지 않는다(들보가 허공을 가리키는 물레방아는 두지 않는다).
    const wy = Math.max(4, Math.round(yMainBase * 0.45));
    const firstWater = (y: number) => { for (let x = 0; x < W; x += 1) if (at(x, y) === WATERC) return x; return -1; };
    const wheel = kitIndex.get("bd-pick-riverside-mill-waterwheel");
    const mill = kitIndex.get("bd-house-h109_0") ?? kitIndex.get("bd-house-h109_1");
    if (wheel && mill) for (const dy of [0, 2, -2, 4, -4, 6, -6, 8]) {
      const y = wy + dy, wx = firstWater(y + wheel.h - 1) - 1;
      if (y < 1 || wx < mill.w + 1 || y + wheel.h >= H) continue;
      let ok = true;
      for (let j = 0; j < wheel.h && ok; j += 1) for (let i = 0; i < wheel.w; i += 1) { const v = at(wx + i, y + j); if (v !== FREE && v !== WATERC) { ok = false; break; } }
      const bottom = [0, 1, 2].map((i) => at(wx + i, y + wheel.h - 1));
      if (!ok || bottom[0] !== FREE || !bottom.includes(WATERC)) continue;
      if (!flatOn(wheel, wx, y)) continue;
      // 방앗간 오른쪽 벽이 바퀴 왼쪽 열에 붙고, 밑줄은 물 위 줄(바퀴 셋째 줄) — 들보(바퀴 첫 줄)가 벽 아래쪽에 닿는다
      const mx = wx - mill.w, my = y + 2 - mill.h + 1, d = mill.door;
      if (!d || my < 0 || !fits(mill, mx, my)) continue;
      const front = { x: mx + d.dx, y: my + d.dy + 1 };
      if (at(front.x, front.y) !== FREE || !linkToRoad(front.x, front.y, false)) continue;
      claimKeepingWater(wheel, wx, y, PROP);
      claim(mill, mx, my, BLD, true); anchors.push(mill.id);
      doorFronts.push({ ...front, kit: mill.id }); linkToRoad(front.x, front.y);
      workAt = { x: Math.max(1, mx - 3), y: front.y + 1, name: "방앗간" };
      // 물가 띠 마을은 서쪽 둑이 나루로만 이어진다 — 원본 방앗간처럼 바퀴 곁에 널다리(5×4)를 놓아 걸어서 건너게 한다
      if (form === "riverbank") {
        const plank = kitIndex.get("bd-pick-riverside-mill-plank-footbridge");
        // 나루와 멀리(두 건널목이 붙어 있으면 나루가 쓸모없어 보인다) — 바퀴 위·아래 후보 중 나루 줄에서 먼 것부터
        const cands = [y - 4, y - 5, y - 3, y - 6, y + wheel.h + 1, y + wheel.h + 2, y + wheel.h + 3, y + wheel.h + 5];
        if (ferry) { const fy = ferry.y; cands.sort((a, b) => Math.abs(b + 1 - fy) - Math.abs(a + 1 - fy)); }
        for (const by of cands) {
          if (!plank || by < 1 || by + 3 >= H) continue;
          const bx = firstWater(by + 1); if (bx < 1) continue;
          // 강 4칸이 곧은 줄(by−1 ~ by+4)이고 그 동쪽 한 칸은 빈 뭍 — 그 칸까지 물로 넓혀 다리 폭(5)과 맞춘다
          let ok = true;
          for (let j = -1; j < 5 && ok; j += 1) for (let i = 0; i < 5; i += 1) {
            const v = at(bx + i, by + j), wantWater = i < 4;
            if (wantWater ? v !== WATERC : v !== FREE) { ok = false; break; }
          }
          if (!ok || at(bx - 1, by + 1) !== FREE || at(bx - 1, by + 2) !== FREE || at(bx + 5, by + 1) !== FREE) continue;
          if (!linkToRoad(bx - 1, by + 1, false) || !linkToRoad(bx + 5, by + 1, false)) continue;
          widenForBridge(bx, by);
          linkToRoad(bx - 1, by + 1); linkToRoad(bx + 5, by + 1);
          keepRoad.add(idx(bx - 1, by + 1)); keepRoad.add(idx(bx + 5, by + 1));
          millBridge = { x: bx, y: by, kit: plank.id };
          break;
        }
        if (!millBridge) warnings.push("방앗간 널다리 자리를 찾지 못했다 — 방앗간은 나루로만 건너간다.");
      }
      break;
    }
    if (!workAt && mill) {
      // 서쪽 둑에 자리가 없으면 물레방아 없이 동쪽 둑 방앗간만
      for (const dy of [0, 3, -3, 6]) { const y = wy + dy - mill.h + 3, x = firstWater(wy + dy) + 6;
        if (x < 0 || !fits(mill, x, y) || !mill.door) continue;
        const front = { x: x + mill.door.dx, y: y + mill.door.dy + 1 };
        if (at(front.x, front.y) !== FREE || !linkToRoad(front.x, front.y, false)) continue;
        claim(mill, x, y, BLD, true); anchors.push(mill.id); doorFronts.push({ ...front, kit: mill.id }); linkToRoad(front.x, front.y);
        workAt = { x: x + 2, y: y + mill.h + 1, name: "방앗간" }; break; }
    }
    if (workAt) cluster(spec.work, workAt.x, workAt.y, 4, 4);
  } else if (coastStreet) {
    // 포구 길가 마을: 큰길을 따라 띄엄띄엄 일하는 물가 — 만에는 잔교·작은 부두(배를 대고 말뚝), 모래톱에는 그물 말림터(시렁·그물대·엎은 배·통발).
    const shoreAt = (x: number) => shoreY[Math.max(0, Math.min(W - 1, x))]!;
    const roadBottom = (x: number) => { const y = yAt(main, x); return y === null ? -1 : y + main.width - 1; };
    const stem = kitIndex.get("bd-pick-fishing-port-jetty-stem"), head = kitIndex.get("bd-pick-fishing-port-jetty-head");
    const small = kitIndex.get("bd-pick-fishing-port-jetty-west"), market = kitIndex.get("bd-pick-fishing-port-fish-market");
    const boatK = kitIndex.get("bd-pick-coast-cliff-road-rowboat"), post = kitIndex.get("bd-prop-mooring_bollard");
    const netKits = have(["bd-pick-fishing-port-drying-rack-b", "bd-prop-net_rack", "bd-pick-fishing-port-drying-rack-a", "bd-pick-fishing-port-upturned-boat", "bd-pick-fishing-port-lobster-pots", "bd-prop-fish_crates"]);
    const keepRect = (x: number, y: number, w: number, h: number) => { for (let j = 0; j < h; j += 1) for (let i = 0; i < w; i += 1) if (inMap(x + i, y + j)) set(x + i, y + j, KEEP); };
    /** 부두 몸통(kit)을 x 열 물가에서 바다로 — 몸통 그림이 덮는 줄을 모두 다리 자리(KEEP)로. 길 바로 아래 줄에서 시작한다. */
    const jetty = (k: Kit, x: number): { y: number; len: number } | null => {
      const y0 = roadBottom(x) + 1; if (y0 <= 0) return null;
      for (let i = 0; i < k.w; i += 1) { if (roadBottom(x + i) + 1 !== y0) return null; for (let y = y0; y < shoreAt(x + i); y += 1) if (at(x + i, y) !== FREE) return null; }
      if (y0 + k.h > H - 1) return null;
      let wet = 0; for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (at(x + i, y0 + j) === WATERC) wet += 1;
      if (wet < k.w * k.h * 0.62) return null; // 놓기 규칙: 몸통 60% 이상 물
      stamps.push({ kit: k.id, x, y: y0, record: false }); keepRect(x, y0, k.w, k.h);
      return { y: y0, len: k.h };
    };
    const moor = (x: number, y: number) => { // 부두 곁 물에 거룻배 한 척(둘레 1칸도 물)
      if (!boatK) return;
      for (const bx of [x + 2, x - boatK.w - 1]) {
        let ok = true; for (let j = -1; j <= boatK.h && ok; j += 1) for (let i = -1; i <= boatK.w; i += 1) { const v = at(bx + i, y + j); if (v !== WATERC || onWater.has(idx(bx + i, y + j))) { ok = false; break; } }
        if (!ok) continue; stamps.push({ kit: boatK.id, x: bx, y, record: false }); for (let i = 0; i < boatK.w; i += 1) onWater.add(idx(bx + i, y)); return;
      }
    };
    const used: string[] = [];
    for (const sp of coastSpots) {
      if (sp.kind === "pier" && stem && head) {
        let j: { y: number; len: number } | null = null;
        for (const d of [0, 1, -1, 2, -2, 3, -3]) { j = jetty(stem, sp.x + d); if (j) { sp.x += d; break; } }
        if (j) {
          const hy = j.y + j.len - 2; if (hy + head.h < H) { stamps.push({ kit: head.id, x: sp.x - 4, y: hy, record: false }); keepRect(sp.x - 4, hy, head.w, head.h); }
          moor(sp.x, j.y + 4); used.push("잔교");
          // 생선 시장: 잔교 곁, 큰길 바로 아래 물가에 걸쳐(밑 줄에 물)
          const clearOf = (mx: number) => coastSpots.every((o) => o === sp || o.x < mx - 2 || o.x > mx + market!.w + 1); // 다른 부두·말림터 자리를 덮지 않게
          if (market) for (const mx of [sp.x + 3, sp.x - market.w - 1, sp.x + 5, sp.x - market.w - 3].filter(clearOf)) {
            let y = 0; for (let i = 0; i < market.w; i += 1) y = Math.max(y, roadBottom(mx + i) + 1); if (y <= 0) continue;
            const wetBottom = Array.from({ length: market.w }, (_, i) => at(mx + i, y + market.h - 1)).includes(WATERC);
            if (wetBottom && !feetOnWater(market, mx, y) && fits(market, mx, y, 0, (v) => v === FREE || v === WATERC)) { claimKeepingWater(market, mx, y, BLD); anchors.push(market.id); break; }
          }
        }
      } else if (sp.kind === "dock" && small) {
        // 작은 부두 그림(jetty-west)은 맨 윗줄 뒤가 물빛이라 물가 길 아래 풀 위에서 검은 네모로 보였다(2026-10-22 독립 검수) —
        // 길에서 바로 뻗어도 깨끗한 잔교 몸통(stem)을 쓴다. 몸통이 안 맞는 자리에서만 작은 부두
        const j = (stem ? jetty(stem, sp.x) : null) ?? jetty(small, sp.x);
        if (j) { moor(sp.x, j.y + 3 + ri(0, 3)); used.push("작은 부두");
          if (post) for (const px of [sp.x + 1, sp.x - 1]) { const py = j.y; if (fits(post, px, py)) { claim(post, px, py, PROP, false); break; } } }
      } else if (sp.kind === "nets" && netKits.length) {
        // 말림터: 큰길과 물가 사이 모래톱에 시렁·그물대·엎은 배를 한 줄로(밑줄이 물가 바로 위)
        let n = 0;
        for (let x = sp.x - 6; x <= sp.x + 6 && n < 5;) {
          const k = K(netKits[(n + ri(0, 1)) % netKits.length]!);
          let yb = H; for (let i = 0; i < k.w; i += 1) yb = Math.min(yb, shoreAt(x + i) - 1);
          const y = yb - k.h + 1;
          if (y > roadBottom(x) && y > roadBottom(x + k.w - 1) && propFits(k, x, y)) { claim(k, x, y, PROP, false); n += 1; x += k.w + ri(0, 1); } else x += 1;
        }
        if (n) used.push("그물 말림터");
        if (!workAt && n) workAt = { x: sp.x, y: shoreAt(sp.x) - 1, name: "그물 말림터" };
      }
    }
    if (!workAt) workAt = { x: coastSpots[0]?.x ?? 8, y: shoreAt(coastSpots[0]?.x ?? 8) - 1, name: "물가 일터" };
    coastWork = used;
    // 모이는 곳 = 잔교 머리 물가: 판석 어귀 대신 잔교 곁 물가에 생선 상자·통·닻 같은 물가 소품 두셋
    const pier = coastSpots.find((sp) => sp.kind === "pier");
    if (pier) plazaProps += cluster(spec.plazaRing, pier.x + 1, shoreAt(pier.x) - 1, 3, 5);
    const lh = kitIndex.get("bd-pick-fishing-port-lighthouse");
    if (lh) { const x = W - lh.w - 2; const y = Math.min(...shoreY.slice(x, x + lh.w)) - lh.h - 1; if (fits(lh, x, y)) { claim(lh, x, y, BLD, true); anchors.push(lh.id);
      const d = lh.door; if (d) { const fx = x + d.dx, fy = y + d.dy + 1; doorFronts.push({ x: fx, y: fy, kit: lh.id }); linkToRoad(fx, fy); } } }
  } else if (theme === "coast") {
    // 포구: 물가 길 아래 해안에 생선 시장·잔교, 동쪽 곶에 등대, 바다에 배
    const px = Math.round(W * 0.5);
    const market = kitIndex.get("bd-pick-fishing-port-fish-market");
    // 생선 시장: 물가 길 바로 아래, 물가에 걸쳐 앉는다(포구 변형과 같다 — 좌판 앞은 물가 길에서 본다)
    if (market) for (const off of [-9, 9, -13, 13, -5, 5]) {
      const x = px + off - 3; const top = yAt(south!, px + off); if (top === null) continue;
      const y = top + 2;
      const wetBottom = Array.from({ length: market.w }, (_, i) => at(x + i, y + market.h - 1)).includes(WATERC);
      if (feetOnWater(market, x, y)) continue;
      if (wetBottom && fits(market, x, y, 0, (v) => v === FREE || v === WATERC)) { claimKeepingWater(market, x, y, BLD); anchors.push(market.id); break; }
    }
    const stem = kitIndex.get("bd-pick-fishing-port-jetty-stem"), head = kitIndex.get("bd-pick-fishing-port-jetty-head");
    const jx = px + 5; const sy = shoreY[jx]!;
    if (stem && head && sy + 8 < H) {
      const len = Math.min(stem.h, H - sy - head.h - 1);
      if (len >= 4) {
        stamps.push({ kit: stem.id, x: jx, y: sy - 1, record: false });
        // 몸통 키트는 len 보다 길 수 있다(통째로 찍힌다) — 그림이 덮는 줄 전부를 잡아 배·오리가 그 밑에 앉지 않게
        for (let j = -1; j < Math.max(len, stem.h - 1); j += 1) { set(jx, sy + j, KEEP); set(jx + 1, sy + j, KEEP); }
        const hy = sy - 1 + len - 1; if (hy + head.h < H) { stamps.push({ kit: head.id, x: jx - 4, y: hy, record: false }); for (let j = 0; j < head.h; j += 1) for (let i = 0; i < head.w; i += 1) set(jx - 4 + i, hy + j, KEEP); }
        // 물가 길에서 잔교까지 이어진 길
        for (let y = (yAt(south!, jx) ?? sy - 3); y < sy - 1; y += 1) { set(jx, y, ROAD); set(jx + 1, y, ROAD); }
      }
    }
    const lh = kitIndex.get("bd-pick-fishing-port-lighthouse");
    if (lh) { const x = W - lh.w - 2; const y = Math.min(...shoreY.slice(x, x + lh.w)) - lh.h - 1; if (fits(lh, x, y)) { claim(lh, x, y, BLD, true); anchors.push(lh.id);
      const d = lh.door; if (d) { const fx = x + d.dx, fy = y + d.dy + 1; doorFronts.push({ x: fx, y: fy, kit: lh.id });
        linkToRoad(fx, fy); } } }
    workAt = { x: ri(8, 14), y: (yAt(south!, 11) ?? shoreY[11]!) + 1, name: "그물 말리는 자갈밭" };
    cluster(spec.work, workAt.x, workAt.y + 1, 5, 4);
    cluster(spec.work, px + 12, (yAt(south!, px + 12) ?? shoreY[px]!) + 1, 3, 3);
  } else {
    // 사막 대상 마당·설원 얼음낚시·늪 고기 말림: 못 가장자리
    const pc = pondCells.length ? pondCells[Math.floor(pondCells.length / 2)]! : idx(Math.round(W * 0.8), Math.round(H * 0.3));
    const pcx = pc % W, pcy = (pc - pcx) / W;
    workAt = { x: pcx + (pondSide === "w" ? 9 : -9), y: pcy + 2, name: theme === "desert" ? "대상 마당" : theme === "snow" ? "얼음낚시터" : spec.feature === "none" ? "타작마당" : "고기 말림터" };
    cluster(spec.work, workAt.x, workAt.y, 5, 4);
  }
  planStep("일터");
  // ---------- 7. 집: 길의 북쪽 띠, 문이 길을 본다 ----------
  const placedHouses: { id: string; x: number; y: number }[] = [];
  const lastIds: string[] = [];
  const retryShorter = !!palette && roofs !== "red" || houseLimit !== Infinity;
  /** 같은 자리에 들어가는 더 낮은 주색(없으면 둘째) 집 — 키 순. */
  const shorterAlternative = (k0: Kit, maxW: number, ok: (k: Kit) => boolean): Kit | null => {
    // 둘째(돌벽 작은 집)는 대신 들어가도 집의 40% 까지만 — 넘치면 팔레트가 둘째 색으로 뒤집힌다(청회색 마을이 돌집 마을이 됐다)
    const accentRoom = placedHouses.filter((p) => accentHouses.includes(p.id)).length < 0.4 * (placedHouses.length + 1);
    for (const ids of accentRoom ? [houses, accentHouses] : [houses]) {
      const alt = ids.map(K).filter((k) => k.id !== k0.id && k.w <= maxW && k.h < k0.h && k.id !== lastIds[lastIds.length - 1]).sort((a, b) => a.h - b.h || a.w - b.w);
      for (const k of alt) if (ok(k)) return k;
    }
    return null;
  };
  const pickHouse = (maxW: number): Kit | null => {
    if (placedHouses.length >= houseLimit) return null;
    const fitting = (ids: readonly string[]) => ids.filter((id) => K(id).w <= maxW && !lastIds.includes(id));
    // 주색 80%·둘째 20% — 둘째(돌벽 작은 집 등)는 다섯 채에 한 채꼴, 주색이 그 폭에 없으면 둘째로
    const accentShare = placedHouses.filter((p) => accentHouses.includes(p.id)).length;
    const wantAccent = accentHouses.length > 0 && accentShare < Math.floor((placedHouses.length + 1) / 5) && rand() < 0.7;
    const main = fitting(houses), accent = fitting(accentHouses);
    // 팔레트 주색 키트가 적다(청회색·통나무 4~5종) — 바로 앞 두 채와 겹쳐 비면 바로 앞 한 채만 피해 주색을 지킨다
    const mainLoose = palette && !main.length ? houses.filter((id) => K(id).w <= maxW && id !== lastIds[lastIds.length - 1]) : main;
    const pool = wantAccent && accent.length ? accent : mainLoose.length ? mainLoose : accent;
    if (!pool.length) return null;
    // 많이 쓴 키트는 덜 고른다
    const uses = (id: string) => placedHouses.filter((p) => p.id === id).length;
    // 중세 건물 마을은 종류가 많다 — 한 바퀴 다 쓰기 전에는 같은 집을 다시 고르지 않는다(2026-10-25 VQA: 오두막·박공 오두막이 다섯 채씩)
    const scored = pool.map((id) => ({ id, s: rand() + uses(id) * (roofs === "medieval" ? 3 : 0.6) })).sort((a, b) => a.s - b.s);
    return K(scored[0]!.id);
  };
  const isPath = (v: number) => v === ROAD || v === PLAZAC;
  const lineStreet = (s: Street, cap = Infinity) => {
    if (!s.horizontal) return;
    const start = placedHouses.length;
    const xs = [...s.cells].map((c) => c % W); const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let x = xMin + ri(0, 2);
    while (x < xMax - 2 && placedHouses.length - start < cap) {
      const k0 = pickHouse(9); if (!k0) break;
      if (!retryShorter && yAt(s, x + k0.door!.dx) === null) { x += 1; continue; } // (난수 순서를 예전 그대로 — 물러앉음은 문 자리 길이 있을 때만 뽑는다)
      const setback = rand() < 0.35 ? 1 : 0;
      const tryKit = (k: Kit): boolean => {
        const d = k.door!;
        const doorX = x + d.dx; const top = yAt(s, doorX);
        if (top === null) return false;
        const y = top - setback - k.h; // 문 칸 = y + d.dy (맨 아래 줄), 문 앞 = y + k.h
        const frontY = y + d.dy + 1;
        let ok = y >= 1 && fits(k, x, y, 0);
        // 이웃 건물과 1칸 띄우기(지붕 겹침 방지) — 옆 칸만 본다
        if (ok) for (let j = 0; j < k.h; j += 1) if (at(x - 1, y + j) === BLD || at(x + k.w, y + j) === BLD) { ok = false; break; }
        // 문 앞 칸은 길이거나(물러앉음 0) 빈 땅이고 그 아래가 길(물러앉음 1)
        if (ok && setback === 1 && !(at(doorX, frontY) === FREE && isPath(at(doorX, frontY + 1)) && flatCells([idx(doorX, frontY), idx(doorX, frontY + 1)]))) ok = false;
        if (ok && setback === 0 && !isPath(at(doorX, frontY))) ok = false;
        return ok;
      };
      // 팔레트 집(허용 건물)은 키가 커서 좁은 띠에 안 들어가는 일이 잦다 — 같은 자리에서 낮은 주색 집을 한 번 더 본다(붉은 기와 기본 마을은 예전 그대로)
      const k = tryKit(k0) ? k0 : retryShorter ? shorterAlternative(k0, 9, tryKit) : null;
      if (!k) { x += 1; continue; }
      const d = k.door!;
      const doorX = x + d.dx; const top = yAt(s, doorX)!;
      const y = top - setback - k.h;
      const frontY = y + d.dy + 1;
      claim(k, x, y, BLD, true);
      if (setback === 1) set(doorX, frontY, ROAD);
      set(doorX, frontY, at(doorX, frontY) === PLAZAC ? PLAZAC : ROAD);
      doorFronts.push({ x: doorX, y: frontY, kit: k.id });
      placedHouses.push({ id: k.id, x, y });
      lastIds.push(k.id); if (lastIds.length > 2) lastIds.shift();
      // 집 옆 살림 소품(45%) — 집 오른쪽 아래 1~2칸 자리
      x += k.w + (form === "scatter" ? ri(4, 8) : rand() < 0.12 ? ri(4, 6) : rand() < 0.6 ? 1 : 2);
    }
  };
  /** 길 북쪽에 문이 길을 보는 큰 건물 하나(높은 곳의 망루·예배당·사원, 낮은 단의 헛간) — 살림집 수에 세지 않고 앵커로 남긴다. 길 가운데에 가까운 자리부터. */
  const lineLandmark = (s: Street, ids: readonly string[]): boolean => {
    if (!s.horizontal || !ids.length) return false;
    const xs = [...s.cells].map((c) => c % W); const xMin = Math.min(...xs), xMax = Math.max(...xs), mid = Math.round((xMin + xMax) / 2);
    const order = ids.map((id) => ({ k: K(id), r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.k);
    const tryXs = Array.from({ length: xMax - xMin + 1 }, (_, i) => xMin + i).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
    for (const k of order) for (const x of tryXs) {
      const d = k.door!; const doorX = x + d.dx; const top = yAt(s, doorX); if (top === null) continue;
      const y = top - 1 - d.dy; // 문 앞 칸 = 길 윗줄
      if (y < 0 || !fits(k, x, y, 0)) continue;
      let ok = true; for (let j = 0; j < k.h && ok; j += 1) if (at(x - 1, y + j) === BLD || at(x + k.w, y + j) === BLD) ok = false;
      if (!ok) continue;
      claim(k, x, y, BLD, true); anchors.push(k.id); doorFronts.push({ x: doorX, y: top, kit: k.id });
      return true;
    }
    return false;
  };
  // 세로 이음길 양옆: 문 앞 칸에서 이음길까지 옆으로 짧은 문 앞 길(같은 줄)
  const lineLane = (s: Street) => {
    const ys = [...s.cells].map((c) => Math.floor(c / W)); const yMin = Math.min(...ys), yMax = Math.max(...ys);
    const laneX = (y: number, side: -1 | 1): number | null => {
      let best: number | null = null;
      for (let x = 0; x < W; x += 1) if (s.cells.has(idx(x, y))) { if (side < 0) return x; best = x; }
      return best;
    };
    for (const side of [-1, 1] as const) {
      let y = yMin + 2;
      while (y < yMax - 2) {
        const k0 = pickHouse(7); if (!k0) break;
        if (!retryShorter && (laneX(y + k0.h, side) === null || y + k0.h >= yMax)) { y += 1; continue; }
        const gap = ri(1, 2);
        let x = 0, doorX = 0, frontY = 0, lx = 0, stub: number[] = [];
        const tryKit = (k: Kit): boolean => {
          const d = k.door!;
          frontY = y + k.h; const l = laneX(frontY, side);
          if (l === null || frontY >= yMax) return false;
          lx = l; x = side < 0 ? lx - gap - k.w : lx + gap + 1;
          doorX = x + d.dx;
          let ok = fits(k, x, y, 0);
          if (ok) for (let j = 0; j < k.h; j += 1) if (at(x - 1, y + j) === BLD || at(x + k.w, y + j) === BLD) { ok = false; break; }
          stub = [];
          if (ok) for (let xx = Math.min(doorX, lx) + (side < 0 ? 0 : 1); xx <= Math.max(doorX, lx) - (side < 0 ? 1 : 0); xx += 1) {
            const v = at(xx, frontY); if (v !== FREE && v !== ROAD) { ok = false; break; } if (v === FREE) stub.push(idx(xx, frontY));
          }
          if (ok && (!flatCells([idx(doorX, frontY), ...stub, idx(lx, frontY)]) || !offRim([idx(doorX, frontY), ...stub]))) ok = false; // 문 앞 토막 길은 한 단(이음길이 경사로인 줄 옆에 붙지 않게)·절벽 끝 위 아님
          return ok;
        };
        const k = tryKit(k0) ? k0 : retryShorter ? shorterAlternative(k0, 7, tryKit) : null;
        if (!k) { y += 1; continue; }
        tryKit(k); // 고른 집의 자리 값(x·문 앞·토막 길)으로 되돌린다
        claim(k, x, y, BLD, true);
        for (const c of stub) occ[c] = ROAD;
        doorFronts.push({ x: doorX, y: frontY, kit: k.id });
        placedHouses.push({ id: k.id, x, y });
        lastIds.push(k.id); if (lastIds.length > 2) lastIds.shift();
        y += k.h + (form === "scatter" ? ri(3, 6) : ri(1, 2));
      }
    }
  };
  if (codePlan) {
    for (const sp of codePlan.spots) if (sp.role === "house" && claimCodeSpot(sp)) { placedHouses.push({ id: sp.k.id, x: sp.x, y: sp.y }); lastIds.push(sp.k.id); if (lastIds.length > 2) lastIds.shift(); }
  } else if (form === "riverbank") {
    // 둑길·뒷길(남북)은 양옆에 문 앞 길을 내고, 이음길·들길(동서)은 북쪽 띠에 집을 앉힌다
    for (const s of streets) if (s.horizontal) lineStreet(s);
    for (const s of streets) if (!s.horizontal) lineLane(s);
  } else {
    // 지형이 정착 모양을 정한다(인류사처럼): 맨 윗단 길에는 높은 곳의 큰 건물(망루 집·예배당·사원·사당) 한 채,
    // 단마다 그 단 길에 집 한 채, 낮은 단 아랫길에는 헛간·곳간 — 그다음 큰길·뒷길·아랫길에 나머지 집(ab9 「위·아래 단이 빈 땅」).
    const tierStreets = climbs.filter((c) => c.street).sort((a, b) => b.level - a.level).map((c) => c.street!);
    for (const st of topStreets) if (!tierStreets.includes(st)) tierStreets.unshift(st);
    if (hf) {
      const high = have(TIER_LANDMARKS[theme] ?? []).filter((id) => K(id).door && !anchors.includes(id));
      // 높은 곳 건물은 가장 높은 단 길부터 앉을 자리가 있는 단에(없으면 위 단을 따라가는 북쪽 뒷길에) — 맨 위 단에 길만 남지 않게
      let landmarked = false;
      for (const st of tierStreets) if (!landmarked && high.length) landmarked = lineLandmark(st, high);
      if (!landmarked && high.length && north) landmarked = lineLandmark(north.s, high);
      tierStreets.forEach((st) => lineStreet(st, 1));
      const low = have(LOW_WORKS[theme] ?? []).filter((id) => K(id).door && !anchors.includes(id));
      for (const st of souths) if (st.name === "아랫길" && low.length) lineLandmark(st, low);
    } else for (const s of topStreets) lineStreet(s, 1);
    for (const s of [main, ...(north ? [north.s] : []), ...souths]) lineStreet(s);
    for (const c of connectors) lineLane(c);
  }

  planStep("집 자리");
  // 울타리 계획: 사각 테두리 칸마다 조각 종류 — 네 모서리는 모서리 기둥(tl·tr·bl·br), 위·아래 줄은 가로, 옆은 세로.
  // 문 한 칸은 길에 가까운 변(모서리 옆 칸은 피한다)에 비우고, 문 양옆은 난간이 기둥에서 끝나는 끝 조각(endW·endE·endN·endS)이다.
  // (2026-10-11 사용자 「울타리 외곽 마감이 별로, 이어져 있다는 느낌이 안 든다」 — 옛 조각 셋은 위 모서리가 반 칸 삐져나가고 세로와 끊겼다.)
  type FenceKind = "h" | "v" | "tl" | "tr" | "bl" | "br" | "endW" | "endE" | "endN" | "endS";
  /** 계획 격자 위에서 길에서 걸어 닿는 높은 단 칸 수(나무·소품 칸은 나중에 걷어 낼 수 있어 걷는 칸으로 본다). blocked 칸은 막힌 것으로. */
  const upperReach = (blocked: Set<number>): number => {
    const seen = new Uint8Array(W * H); const q: number[] = [];
    const ok = (c: number) => { const v = occ[c]; return !blocked.has(c) && (v === FREE || v === POND_RING || v === CLEAR || v === ROAD || v === PLAZAC || v === KEEP || v === PROP); };
    for (let c = 0; c < W * H; c += 1) if ((occ[c] === ROAD || occ[c] === PLAZAC) && !blocked.has(c) && !branch(c)) { seen[c] = 1; q.push(c); }
    let n = 0;
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W; if (lv[c]! > 0) n += 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const nn = idx(nx, ny);
        if (seen[nn] || !ok(nn) || !trustStep(x, y, nx, ny)) continue; seen[nn] = 1; q.push(nn); } }
    return n;
  };
  const keepsUpperOpen = (rect: Set<number>): boolean => {
    let own = 0; for (const c of rect) if (lv[c]! > 0) own += 1;
    return upperReach(rect) >= upperReach(new Set()) - own;
  };
  const fenceAt = new Map<number, FenceKind>();
  const gateTrack = new Set<number>(); // 울타리 문 → 길 걸음 자리(모랫길로 칠한다)
  const fenceGates: number[] = []; // 울타리 문 칸 — 13단계에서 입구로부터 닿는지 잰다
  const fenceInside = new Set<number>(); // 울타리 안 칸(밭·텃밭) — 문으로 드는 울타리 안이라 「갇힌 빈터」로 세지 않는다
  const planFence = (x0: number, y0: number, x1: number, y1: number, near: (c: number) => number): boolean => {
    if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H || x1 - x0 < 3 || y1 - y0 < 2) return false;
    const ring: number[] = [];
    for (let x = x0; x <= x1; x += 1) ring.push(idx(x, y0), idx(x, y1));
    for (let y = y0 + 1; y < y1; y += 1) ring.push(idx(x0, y), idx(x1, y));
    if (ring.some((c) => occ[c] !== FREE)) return false;
    if (!flatCells(ring)) return false;
    const nearCorner = (c: number) => { const x = c % W, y = (c - x) / W; return (x - x0 <= 1 || x1 - x <= 1) && (y - y0 <= 1 || y1 - y <= 1); };
    // 문은 길에 가까운 변에서 고르되, 문 바깥 칸에서 길까지 실제로 걸어갈 수 있는 자리만(2026-10-11 — 문 바로 밖에 나무가 앉거나
    // 이웃 밭 울타리 사이 골에 갇히거나 올라갈 길 없는 단 위에 있으면 문까지 못 갔다). 그 걸음 자리는 CLEAR 로 비워 둔다.
    const inside = (x: number, y: number) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
    const outsideOf = (c: number): number => { const x = c % W, y = (c - x) / W; const [ox, oy] = y === y0 ? [x, y - 1] : y === y1 ? [x, y + 1] : x === x0 ? [x - 1, y] : [x + 1, y]; return inMap(ox, oy) ? idx(ox, oy) : -1; };
    const walkTo = (start: number): number[] | null => {
      if (start < 0 || (occ[start] !== FREE && occ[start] !== POND_RING && occ[start] !== CLEAR)) return null;
      const prev = new Int32Array(W * H).fill(-2); prev[start] = -1; const q = [start];
      for (let h = 0; h < q.length; h += 1) {
        const c = q[h]!; const x = c % W, y = (c - x) / W;
        if ((occ[c] === ROAD || occ[c] === PLAZAC) && !branch(c)) { const path: number[] = []; for (let t = prev[c]!; t >= 0; t = prev[t]!) path.push(t); return path; }
        for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
          const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || inside(nx, ny)) continue; const n = idx(nx, ny);
          if (prev[n] !== -2) continue; const v = occ[n];
          if (v !== FREE && v !== POND_RING && v !== CLEAR && v !== ROAD && v !== PLAZAC) continue;
          if (!trustStep(x, y, nx, ny)) continue;
          prev[n] = c; q.push(n);
        }
      }
      return null;
    };
    let gate = -1, gatePath: number[] | null = null;
    const order = ring.filter((c) => !nearCorner(c)).sort((a, b) => near(a) - near(b));
    for (const c of order) {
      const o = outsideOf(c); if (o < 0 || (rel && !reliefAllowsStep(rel, c % W, Math.floor(c / W), o % W, Math.floor(o / W)))) continue; // 문에서 바깥 칸으로 단 없이
      const p = walkTo(o); if (p) { gate = c; gatePath = p; break; }
    }
    if (gate < 0 || !gatePath) return false;
    // 높은 단 위 울타리는 그 단의 걸을 수 있는 땅을 둘로 가르지 않아야 한다(절벽 끝 띠·맵 가장자리와 함께 대지 한쪽을 막으면 그 너머가 고립된다)
    if (hasTerrain && rel) {
      const rect: number[] = []; for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) rect.push(idx(x, y));
      if (rect.some((c) => lv[c]! > 0) && !keepsUpperOpen(new Set(rect))) return false;
    }
    for (const c of gatePath) if (occ[c] === FREE) occ[c] = CLEAR;
    // 밭 울타리 문 길은 맨 풀밭이면 안 보였다(2026-10-25 VQA 「문·길 없는 밭」) — 모랫길로 칠한다(통행은 그대로 빈 땅)
    if (fenced) { for (const c of gatePath) gateTrack.add(c); gateTrack.add(gate); }
    for (let y = y0 + 1; y < y1; y += 1) for (let x = x0 + 1; x < x1; x += 1) fenceInside.add(idx(x, y));
    const gx = gate % W, gy = (gate - gx) / W;
    for (const c of ring) {
      if (c === gate) { occ[c] = PROP; fenceGates.push(c); continue; } // 문 칸: 비워 두되 나무·소품이 앉지 않게
      const x = c % W, y = (c - x) / W;
      let kind: FenceKind = y === y0 ? (x === x0 ? "tl" : x === x1 ? "tr" : "h") : y === y1 ? (x === x0 ? "bl" : x === x1 ? "br" : "h") : "v";
      if (gate >= 0 && kind === "h" && y === gy && Math.abs(x - gx) === 1) kind = x < gx ? "endE" : "endW";
      if (gate >= 0 && kind === "v" && x === gx && Math.abs(y - gy) === 1) kind = y < gy ? "endS" : "endN";
      fenceAt.set(c, kind); occ[c] = FENCE;
    }
    return true;
  };
  // ---------- 9. 집 옆 살림 소품 ----------
  // 흩어진 마을: 집마다 옆에 마당(풀밭 마을은 울타리 친 텃밭 — 채소 밭두렁·배추 상자)
  if (form === "scatter") for (const h of placedHouses) {
    const k = K(h.id);
    const gw = ri(4, 5), gh = 3;
    const sides = rand() < 0.5 ? [1, -1] : [-1, 1];
    for (const sd of sides) {
      const x0 = sd > 0 ? h.x + k.w + 1 : h.x - gw - 3, y0 = h.y + k.h - gh - 2; // 테두리 포함 (gw+2)×(gh+2)
      if (fenced) {
        if (!planFence(x0, y0, x0 + gw + 1, y0 + gh + 1, (c) => Math.abs(c % W - (h.x + k.door!.dx)) + Math.abs(Math.floor(c / W) - (h.y + k.h)))) continue;
        for (let t = 0; t < 12; t += 1) { const bed = K(choice(have(YARD_BEDS))); const bx = x0 + 1 + ri(0, gw - bed.w), by = y0 + 1 + ri(0, gh - bed.h); if (fits(bed, bx, by)) claim(bed, bx, by, FIELD, false); }
        for (let y = y0 + 1; y <= y0 + gh; y += 1) for (let x = x0 + 1; x <= x0 + gw; x += 1) if (occ[idx(x, y)] === FREE) occ[idx(x, y)] = PROP; // 텃밭 안은 비운 흙 — 나무가 들어오지 않게
      } else cluster(spec.home.filter((id) => !WALL_HUG.test(id)), x0 + Math.floor(gw / 2), y0 + gh, 2, 2); // 화단·화분은 마당 한가운데가 아니라 벽에(아래)
      break;
    }
  }
  for (const h of placedHouses) {
    if (rand() > 0.5) continue;
    const k = K(h.id); const pool = have(spec.home); if (!pool.length) break;
    const p = K(choice(pool));
    // 화분·화단 상자·장작더미는 벽에 붙인다(틈 0칸) — 한 칸 띄우면 「벽에 붙지 않고 풀밭에 홀로 놓인 화단」으로 읽혔다(2026-10-29 야외 VQA vm1 argon·vm2 flash).
    // 빨래 건조대·그물 걸이처럼 서 있는 것만 한 칸 띄운다. 붙일 자리가 없으면 화단은 놓지 않는다(띄워 놓으면 다시 떠 보인다).
    const gaps = WALL_HUG.test(p.id) ? [0] : [1];
    const sides = rand() < 0.5 ? [1, -1] : [-1, 1];
    let done = false;
    for (const gap of gaps) {
      for (const sd of sides) {
        const x = sd > 0 ? h.x + k.w + gap : h.x - p.w - gap;
        const y = h.y + k.h - p.h;
        if (propFits(p, x, y)) { claim(p, x, y, PROP, false); done = true; break; }
      }
      if (done) break;
    }
  }

  planStep("살림 소품");
  // ---------- 10. 바깥: 밭 → 숲 덩이 → 덤불·풀꽃 ----------
  // 늪: 마을이 선 땅(길·집·소품에서 2~4칸)만 진흙 섬으로 남기고 나머지는 물. 물가 한 줄은 이끼 늪(막힘).
  if (spec.feature === "bog" && spec.pond) {
    const dist = new Int16Array(W * H).fill(99); const q: number[] = [];
    for (let c = 0; c < W * H; c += 1) if (occ[c] !== FREE && occ[c] !== POND_RING) { dist[c] = 0; q.push(c); }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (dist[n]! > dist[c]! + 1) { dist[n] = dist[c]! + 1; q.push(n); } } }
    const ph = rand() * 6.28, ph2 = rand() * 6.28;
    // 부드러운 값 잡음(5칸 격자 이중선형) — 길에서 같은 거리로만 물가를 그으면 곧은 길을 따라 곧은 물가·네모 물이 됐다(ab10 늪 「물이 네모」).
    // 물가가 들쭉날쭉 들어오고 나가며, 넓은 물 안에는 진흙 둔덕 섬이 선다.
    const gs = 5, gw = Math.ceil(W / gs) + 2, gh = Math.ceil(H / gs) + 2;
    const grid = (): Float32Array => { const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i += 1) g[i] = rand() * 2 - 1; return g; };
    const g1 = grid(), g2 = grid();
    const noise = (g: Float32Array, x: number, y: number) => { const fx = x / gs, fy = y / gs, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const v = (i: number, j: number) => g[j * gw + i]!; const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      return (v(ix, iy) * (1 - sx) + v(ix + 1, iy) * sx) * (1 - sy) + (v(ix, iy + 1) * (1 - sx) + v(ix + 1, iy + 1) * sx) * sy; };
    for (let c = 0; c < W * H; c += 1) {
      if (occ[c] !== FREE || lv[c]! > 0) continue; const x = c % W, y = (c - x) / W; // 마른 둔덕(높은 단)은 늪물이 되지 않는다
      // 넓은 물 가운데의 진흙 둔덕 섬(길에서 7칸 넘게 떨어진 곳만 — 마을 땅과 붙지 않게)
      if (dist[c]! > 7 && noise(g2, x, y) > 0.42) continue;
      const reach = 3 + 1.0 * Math.sin(x / 4.3 + ph) * Math.cos(y / 3.7 + ph2) + 2.6 * noise(g1, x, y);
      if (dist[c]! > reach + 0.8) { occ[c] = WATERC; pondCells.push(c); surfaceAt.set(c, spec.pond.water); }
      else if (dist[c]! > reach - 0.4) { occ[c] = WATERC; surfaceAt.set(c, spec.pond.ring!); bogRing.add(c); }
    }
  }
  const distRoad = new Int16Array(W * H).fill(99);
  { const q: number[] = []; for (let c = 0; c < W * H; c += 1) if (occ[c] !== FREE && occ[c] !== POND_RING && occ[c] !== FIELD && occ[c] !== CLEAR) { distRoad[c] = 0; q.push(c); }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const n = idx(x + dx, y + dy); if (inMap(x + dx, y + dy) && distRoad[n]! > distRoad[c]! + 1) { distRoad[n] = distRoad[c]! + 1; q.push(n); } } } }
  // 물 위 소품(배·얼음 구멍·오리)
  if (spec.workOnWater?.length) {
    const pool = have(spec.workOnWater); let n = 0;
    for (let t = 0; t < 200 && n < (theme === "coast" ? 6 : 4) && pool.length; t += 1) {
      const k = K(choice(pool)); const x = ri(1, W - k.w - 1), y = ri(1, H - k.h - 1);
      let ok = true;
      // 물 칸 위에만, 둘레 1칸도 물(물가에 붙지 않게)
      for (let j = -1; j <= k.h && ok; j += 1) for (let i = -1; i <= k.w; i += 1) { const v = at(x + i, y + j); if ((v !== WATERC && v !== 255) || onWater.has(idx(x + i, y + j))) { ok = false; break; } }
      if (!ok) continue;
      // 물 위 소품 칸은 물로 남긴다(소품 칸으로 덮으면 1층이 풀밭으로 칠해지고 둘레에 물가 둑이 생겼다) — 겹침은 onWater 로 막는다
      stamps.push({ kit: k.id, x, y, record: false }); for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) onWater.add(idx(x + i, y + j)); n += 1;
    }
  }

  // 쓰임 덩이 마당 자리(options.yard): 밭·숲보다 먼저. 한 단 FREE 사각형이고, 테두리 바깥 한 칸이 길에 닿을수록·가운데에 가까울수록 좋다.
  if (options.yard) {
    // 큰 자리부터, 없으면 dress_village_quarter 의 줄인 마당 크기(가로 −3·세로 −2, −6·−3)에 맞춰 줄여 찾는다.
    for (const [dw, dh] of [[0, 0], [3, 2], [6, 3]] as const) {
      const yw = Math.min(W - 2, options.yard.w - dw), yh = Math.min(H - 2, options.yard.h - dh);
      let best: { x: number; y: number; s: number } | null = null;
      for (let y = 1; y + yh < H - 1; y += 1) for (let x = 1; x + yw < W - 1; x += 1) {
        const l0 = lv[idx(x, y)] ?? 0; let ok = true;
        for (let j = 0; j < yh && ok; j += 1) for (let i = 0; i < yw; i += 1) { const c = idx(x + i, y + j); if (occ[c] !== FREE || (lv[c] ?? 0) !== l0) { ok = false; break; } }
        if (!ok) continue;
        let road = 0;
        for (let i = 0; i < yw; i += 1) { if (occ[idx(x + i, y - 1)] === ROAD) road += 1; if (occ[idx(x + i, y + yh)] === ROAD) road += 1; }
        for (let j = 0; j < yh; j += 1) { if (occ[idx(x - 1, y + j)] === ROAD) road += 1; if (occ[idx(x + yw, y + j)] === ROAD) road += 1; }
        const sc = Math.min(road, 12) * 4 - Math.hypot(x + yw / 2 - W / 2, y + yh / 2 - H / 2) * 0.4 + rand();
        if (!best || sc > best.s) best = { x, y, s: sc };
      }
      if (!best) continue;
      for (let j = 0; j < yh; j += 1) for (let i = 0; i < yw; i += 1) occ[idx(best.x + i, best.y + j)] = CLEAR;
      break;
    }
  }
  let fields = 0;
  if (spec.field) {
    // 풀밭 마을의 높은 단(오르막·윗길을 낸 곳)은 밭 자리 — 그 단 안에서 먼저 두 번까지 고른다(단 위의 쓰임). 나머지는 예전처럼 맵 전체에서.
    const upperTries: { cells: number[]; climb: Climb }[] = fenced ? climbs.map((cl) => ({ cells: cl.cells, climb: cl })) : [];
    let upperLeft = upperTries.length ? 40 * upperTries.length : 0;
    // 숲속 빈터 마을은 밭을 둘까지 — 나머지 땅은 숲이 맡는다
    const fieldCap = denseWoods ? 2 : 5;
    const fieldPts = (codePlan?.layout.fields ?? []).flatMap((p) => [p, { x: p.x + ri(-3, 3), y: p.y + ri(-2, 2) }, { x: p.x + ri(-4, 4), y: p.y + ri(-3, 3) }]);
    let fieldFromLayout = 0;
    for (let t = 0; t < 140 + upperLeft + fieldPts.length && fields < fieldCap + upperTries.length; t += 1) {
      const fw = ri(5, 9), fh = ri(3, 5);
      const fp = fieldFromLayout < (codePlan?.layout.fields?.length ?? 0) ? fieldPts.shift() : undefined;
      const ut = upperLeft > 0 ? upperTries[upperLeft % upperTries.length]! : null;
      if (ut && ut.climb.use.filter((u) => u === "밭").length >= 2) { upperLeft -= 1; continue; }
      let x: number, y: number;
      if (ut) { upperLeft -= 1; const c = ut.cells[Math.floor(rand() * ut.cells.length)]!; x = (c % W) - Math.floor(fw / 2); y = Math.floor(c / W) - Math.floor(fh / 2); if (x < 1 || y < 1 || x + fw >= W || y + fh >= H) continue; }
      else if (fp) { x = fp.x - Math.floor(fw / 2); y = fp.y - Math.floor(fh / 2); if (x < 1 || y < 1 || x + fw >= W || y + fh >= H) continue; }
      else { if (fields >= fieldCap || (codePlan && !codePlan.report.auto)) break; x = ri(1, W - fw - 1); y = ri(1, H - fh - 1); }
      let ok = true;
      for (let j = -1; j <= fh && ok; j += 1) for (let i = -1; i <= fw; i += 1) { const v = at(x + i, y + j); if (v !== FREE && v !== 255) { ok = false; break; } }
      if (ok && hasTerrain) { const fl: number[] = []; for (let j = -1; j <= fh; j += 1) for (let i = -1; i <= fw; i += 1) if (inMap(x + i, y + j)) fl.push(idx(x + i, y + j)); ok = flatCells(fl); }
      if (!ok) continue;
      // 모서리 한두 칸을 깎아 네모 판을 피한다(울타리를 두르는 밭은 아래에서 네 귀퉁이만 — 둥근 울타리 모서리에 맞춘다)
      const cut = new Set<number>(); for (const [cx, cy] of [[x, y], [x + fw - 1, y], [x, y + fh - 1], [x + fw - 1, y + fh - 1]] as const) if (rand() < 0.5) cut.add(idx(cx, cy));
      // 풀밭 마을의 밭은 울타리를 두르고 문까지 걸어갈 수 있어야 한다 — 문 자리를 못 찾으면(오를 길 없는 단·갇힌 골) 밭을 두지 않는다
      // 울타리는 모서리가 둥글다(2026-10-11) — 밭도 네 귀퉁이 칸을 풀로 남겨 네모 귀퉁이가 둥근 울타리 곡선 밖으로 비어져 보이지 않게
      if (fenced) { if (!planFence(x - 1, y - 1, x + fw, y + fh, (c) => distRoad[c]!)) continue; cut.clear(); for (const [cx, cy] of [[x, y], [x + fw - 1, y], [x, y + fh - 1], [x + fw - 1, y + fh - 1]] as const) cut.add(idx(cx, cy)); }
      // 포도밭 키트는 제 울타리(위층)를 가진 작은 밭이라 울타리 두른 밭 안에 넣으면 울타리가 겹치고 안이 ㄱ자로 빈다 — 울타리 밭에는 쓰지 않는다
      if (!fenced && spec.field.kit && kitIndex.has(spec.field.kit) && fw >= K(spec.field.kit).w && fh >= K(spec.field.kit).h && rand() < 0.5) {
        const k = K(spec.field.kit); claim(k, x, y, FIELD, false);
      } else {
        for (let j = 0; j < fh; j += 1) for (let i = 0; i < fw; i += 1) {
          const c = idx(x + i, y + j); if (cut.has(c)) continue; occ[c] = FIELD;
          if (spec.field.sample) surfaceAt.set(c, spec.field.sample);
        }
        if (spec.field.decals?.length) { const d = choice(have(spec.field.decals)); for (let j = 0; j < fh; j += 1) for (let i = 0; i < fw; i += 1) if (!cut.has(idx(x + i, y + j))) { stamps.push({ kit: d, x: x + i, y: y + j, record: false }); decalAt.add(idx(x + i, y + j)); } }
      }
      fields += 1; if (ut) ut.climb.use.push("밭");
      if (fp) { fieldFromLayout += 1; const want = codePlan!.layout.fields!; const k = want.findIndex((w) => Math.abs(w.x - fp.x) <= 4 && Math.abs(w.y - fp.y) <= 3); if (k >= 0) for (let i = fieldPts.length - 1; i >= 0; i -= 1) if (Math.abs(fieldPts[i]!.x - want[k]!.x) <= 4 && Math.abs(fieldPts[i]!.y - want[k]!.y) <= 3) fieldPts.splice(i, 1); }
      cluster(spec.field.edge, x + fw + 1, y + fh - 1, 1, 1);
    }
  }
  // 숲 덩이(2026-10-18 사용자 반려 「버들 마을은 풀이 뭉쳐진 .. '숲' 을 구현하질 못함」): 나무 키트를 3~7그루씩 흩어 심으면
  // 수관 사이로 잔디가 보이는 덤불 뭉치가 된다. 풀밭·설원 마을은 길에서 떨어진 빈 땅에 둥근 숲 덩이(FOREST, 막힘)를 잡고
  // 12b 에서 이어진 수관 오토타일(BEODEUL_NATURE.forestCanopy)로 한 장에 덮는다. 낱 나무 덩이는 숲 가장자리 몇 그루로만 남긴다.
  const canopyStyle: "leaf" | "snow" | null = theme === "snow" ? "snow" : theme === "river" || theme === "coast" ? "leaf" : null;
  const forestSet = new Set<number>();
  if (canopyStyle) {
    const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    // 숲 칸은 한 단 위에만(남쪽 칸도 같은 단 — 절벽 끝에 수관이 걸치지 않게), 길·집에서 한 칸(그늘 줄)을 띄운다
    // 길에서 띄우는 거리는 2~4칸으로 물결친다(3칸 격자 값 잡음) — 늘 2칸이면 곧은 길 옆 숲이 자로 그은 벽이 된다(VQA r1 「곧은 숲 벽」)
    const hv = (gx: number, gy: number) => { let h = Math.imul(gx * 73856093 ^ gy * 19349663 ^ seed * 83492791, 0x27d4eb2d); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
    const vnoise = (c: number, grid: number, salt: number) => {
      const x = (c % W) / grid, y = Math.floor(c / W) / grid + salt, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
      return hv(x0, y0) * (1 - fx) * (1 - fy) + hv(x0 + 1, y0) * fx * (1 - fy) + hv(x0, y0 + 1) * (1 - fx) * fy + hv(x0 + 1, y0 + 1) * fx * fy;
    };
    const roadGap = (c: number) => 2 + Math.floor(vnoise(c, denseWoods || highWoods ? 3 : 4, 0) * (denseWoods || highWoods ? 3.99 : 2.99)); // 3칸 격자 — 4칸 격자·숲속 빈터 2~3칸은 곧은 길 옆 숲 벽이 남았다(VQA r6 산골 남쪽 빈터)
    const okCell = (c: number, L: number) => occ[c] === FREE && distRoad[c]! >= roadGap(c) && lv[c] === L && !rampCells.has(c) && (c + W >= W * H || lv[c + W] === L);
    // 침엽·혼효 마을은 숲 덩이를 크게·넓게(독립 검수 D10 「덩어리 없이 듬성듬성」) — 활엽 마을은 그대로
    const bigGroves = canopyStyle === "leaf" && forestType !== "broadleaf";
    // 숲속 빈터(woods dense): 빈 땅의 절반 가까이를 숲으로 — 씨앗은 길에서 3칸, 덩이는 더 크게, 더 여러 번
    // 산골(highland): 윗단 비탈은 숲이 덮는다(「산골인데 산이 없다」) — 씨앗을 2단 이상에서 주로 뽑는다
    const highWoods = terrainName === "highland";
    const goal = Math.round(W * H * (denseWoods ? 0.5 : highWoods ? 0.3 : canopyStyle === "snow" ? 0.1 : bigGroves ? 0.2 : 0.14));
    // 지형 먼저: 절벽 띠가 비스듬히 사라지는 끝은 숲 덩이가 덮는다(「끝이 숲·바위로 사라진다」) — 끝의 위·아래 단에 씨앗을 먼저 둔다
    const endSeeds: [number, number][] = [];
    for (const e of hf?.cliffEnds ?? []) for (const [dx, dy] of [[0, -3], [0, 3], [-3, 1], [3, 1]] as const) endSeeds.push([e.x + dx, e.y + dy]);
    for (let t = 0; t < endSeeds.length + (denseWoods || highWoods ? 400 : codeT ? 320 : 90) && forestSet.size < goal + endSeeds.length * 12; t += 1) {
      const fromEnd = t < endSeeds.length;
      if (!fromEnd && forestSet.size >= goal) break;
      const [sx, sy] = fromEnd ? endSeeds[t]! : [ri(0, W - 1), ri(0, H - 1)];
      if (!inMap(sx, sy)) continue;
      const s = idx(sx, sy);
      if (occ[s] !== FREE || distRoad[s]! < (fromEnd ? 3 : denseWoods ? 3 : 4) || forestSet.has(s)) continue;
      if (codeT && rand() > codeT.forest[s]! * 1.3) continue; // 코드 지형의 숲 어울림(물기·비탈·높이)이 높은 곳에 덩이를 세운다
      const L = lv[s]!, rx = fromEnd ? ri(5, 8) : denseWoods ? ri(7, 14) : bigGroves ? ri(5, 9) : ri(3, 8), ry = fromEnd ? ri(3, 5) : denseWoods ? ri(5, 9) : bigGroves ? ri(3, 6) : ri(2, 5), wob = rand() * 6.28;
      const blob = new Set<number>([s]); const q = [s];
      for (let h = 0; h < q.length; h += 1) {
        const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
          if (blob.has(n) || !okCell(n, L)) continue;
          const ex = (nx - sx) / rx, ey = (ny - sy) / ry;
          if (ex * ex + ey * ey > 1 + 0.35 * Math.sin(Math.atan2(ey, ex) * 3 + wob)) continue;
          blob.add(n); q.push(n);
        }
      }
      if (blob.size >= (bigGroves ? 24 : 10)) for (const c of blob) forestSet.add(c);
    }
    for (const c of summit) forestSet.add(c);
    // (단 동서 끝 1px 선을 숲으로 둘러 덮던 단계는 걷었다 — 수관 오토타일은 단 너머로 잇지 못해 선 따라 곧게 썰린 숲 벽만 남았다, VQA r1·r2)
    // 다듬기: 이웃 숲이 하나 이하인 혹은 지우고, 셋 이상 숲에 둘러싸인 빈 칸(같은 단)은 메운다 — 가는 가지·바늘구멍 수관이 생기지 않게
    const n4 = (c: number) => { const x = c % W, y = (c - x) / W; let k = 0; for (const [dx, dy] of N4) if (!inMap(x + dx, y + dy) || forestSet.has(idx(x + dx, y + dy))) k += 1; return k; };
    for (let pass = 0; pass < 2; pass += 1) {
      for (const c of [...forestSet]) if (n4(c) <= 1) forestSet.delete(c);
      for (let c = 0; c < W * H; c += 1) if (!forestSet.has(c) && n4(c) >= 3 && okCell(c, lv[c]!) && (!hasTerrain || N4.every(([dx, dy]) => { const x = (c % W) + dx, y = Math.floor(c / W) + dy; return !inMap(x, y) || lv[idx(x, y)] === lv[c]; }))) forestSet.add(c);
    }
    // 수관은 2×2 숲 덩이에만 선다 — 어떤 2×2 에도 못 드는 칸(한 칸 띠·뾰족한 끝)은 수관 없는 덤불 낱칸·칸 계단으로 보이니 지운다
    const sameLv = (a: number, b: number) => lv[a] === lv[b];
    // 깎은 칸(잡음 깎기·곧은 변 홈) — 뒤 다듬기의 「이웃 셋 메우기」가 도로 메우면 깎기 전 곧은 변으로 돌아간다(VQA r6~r8 산골 빈터 벽)
    const carved = new Set<number>();
    // 가장자리 물결(VQA r3 「길·단을 따라 자로 그은 사각 숲」): 숲 밖(맵 안 빈 땅·길·다른 단)까지 거리가 잡음 깊이(0~2칸) 이하인 칸을 깎는다 —
    // 길 간격·단 경계·덩이 합집합이 남긴 곧은 변이 들쭉날쭉한 숲 끝이 된다. 맵 가장자리는 숲 밖으로 보지 않는다(맵 밖으로 이어지는 숲은 깔끔히 잘린다).
    {
      const dist = new Int16Array(W * H).fill(-1); const q: number[] = [];
      for (const c of forestSet) {
        const x = c % W, y = (c - x) / W;
        if (N4.some(([dx, dy]) => inMap(x + dx, y + dy) && (!forestSet.has(idx(x + dx, y + dy)) || !sameLv(c, idx(x + dx, y + dy))))) { dist[c] = 0; q.push(c); }
      }
      for (let h = 0; h < q.length; h += 1) {
        const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of N4) { const n = idx(x + dx, y + dy); if (inMap(x + dx, y + dy) && forestSet.has(n) && dist[n] < 0) { dist[n] = dist[c]! + 1; q.push(n); } }
      }
      // 잡음 칸 4 — 3칸 격자 한 칸 물림은 다듬기(이웃 셋 메우기)가 도로 메워 곧은 변이 남았다(VQA r6 산골 숲 빈터 벽)
      const erode = (c: number) => Math.floor(vnoise(c, 3, 977) * (highWoods ? 3 : 0)) - 1; // -1 깎지 않음 · 빈터·산골만 0~2(작은 숲 덩이는 홈만 — 깎으면 작은 덩이가 사라졌다) 가장자리에서 그 깊이까지
      for (const c of [...forestSet]) if (dist[c]! >= 0 && dist[c]! <= erode(c)) { forestSet.delete(c); carved.add(c); }
    }
    // 숲 속 구멍(길 간격 잡음·깎기가 남긴 4칸 이하 빈 땅, 사방이 같은 단 숲)은 메운다 — 수관 속 검은 구멍으로 보였다(VQA r4)
    {
      const seen = new Set<number>();
      for (let c0 = 0; c0 < W * H; c0 += 1) {
        if (forestSet.has(c0) || seen.has(c0) || occ[c0] !== FREE || rampCells.has(c0)) continue;
        const comp = [c0]; seen.add(c0); let open = false;
        for (let h = 0; h < comp.length && comp.length <= 4; h += 1) {
          const c = comp[h]!, x = c % W, y = (c - x) / W;
          for (const [dx, dy] of N4) {
            if (!inMap(x + dx, y + dy)) { open = true; continue; }
            const n = idx(x + dx, y + dy);
            if (forestSet.has(n) && lv[n] === lv[c0]) continue;
            if (occ[n] !== FREE || lv[n] !== lv[c0] || rampCells.has(n)) { open = true; continue; }
            if (!seen.has(n)) { seen.add(n); comp.push(n); }
          }
        }
        if (!open && comp.length <= 4) for (const c of comp) forestSet.add(c);
      }
    }
    shapeBeodeulCanopyMask(W, H, forestSet, { canFill: (c) => okCell(c, lv[c]!) && !carved.has(c), joins: sameLv, minComponent: canopyStyle === "snow" ? 12 : 16, minExtent: canopyStyle === "snow" ? 3 : 4, minInterior: 0.15, block: 2 });
    // 곧은 변 끊기(VQA r6·r7 「자로 그은 숲 벽·평평한 윗변」): 잡음 깎기가 못 끊은 5칸 이상 곧은 숲 변에 5~8칸마다 너비 2~3·깊이 1~2칸 홈을 판다.
    // 3칸 미만 홈은 다듬기(이웃 셋 메우기)가 도로 메우므로 다듬기 뒤에 파고 너비 2 이상·깊이 방향 셀까지 함께 판다.
    {
      const edgeIn = (c: number, dx: number, dy: number) => {
        const x = c % W, y = (c - x) / W, nx = x + dx, ny = y + dy;
        return forestSet.has(c) && inMap(nx, ny) && (!forestSet.has(idx(nx, ny)) || !sameLv(c, idx(nx, ny)));
      };
      const cut: number[] = [];
      // 작은 숲 덩이(48칸 미만)는 홈을 파지 않는다 — 파면 낱 나무 몇 그루·검은 판 조각으로 흩어졌다(VQA r13 어촌·강가 장터)
      const compSize = new Map<number, number>();
      for (const c0 of forestSet) {
        if (compSize.has(c0)) continue;
        const comp = [c0]; compSize.set(c0, 0);
        for (let h = 0; h < comp.length; h += 1) {
          const c = comp[h]!, x = c % W, y = (c - x) / W;
          for (const [ddx, ddy] of N4) { const nx = x + ddx, ny = y + ddy; if (!inMap(nx, ny)) continue; const nb = idx(nx, ny); if (forestSet.has(nb) && !compSize.has(nb) && sameLv(c, nb)) { compSize.set(nb, 0); comp.push(nb); } }
        }
        for (const c of comp) compSize.set(c, comp.length);
      }
      for (const [dx, dy] of N4) {
        const ax = dy === 0 ? 0 : 1, ay = dy === 0 ? 1 : 0; // 변을 따라가는 축
        const done = new Set<number>();
        for (let c0 = 0; c0 < W * H; c0 += 1) {
          if (done.has(c0) || !edgeIn(c0, dx, dy)) continue;
          // 한 칸 어긋남(계단)은 같은 변으로 잇는다 — 1칸 계단으로 끊긴 짧은 조각들이 1배에서는 곧은 벽으로 읽혔다(실제 입력창 VQA 강가 장터)
          const run: number[] = [];
          for (let x = c0 % W, y = Math.floor(c0 / W); ;) {
            run.push(idx(x, y));
            const nx = x + ax, ny = y + ay;
            const next = [[nx, ny], [nx + dx, ny + dy], [nx - dx, ny - dy]].find(([px, py]) => inMap(px!, py!) && !done.has(idx(px!, py!)) && !run.includes(idx(px!, py!)) && edgeIn(idx(px!, py!), dx, dy));
            if (!next) break;
            x = next[0]!; y = next[1]!;
          }
          for (const c of run) done.add(c);
          if (run.length < 5 || (compSize.get(run[0]!) ?? 0) < 48) continue;
          // 짧은 변은 가운데 근처에(끝 쪽 홈은 모서리 깎기로만 읽혀 곧은 변이 그대로 남았다 — 실제 입력창 VQA), 7칸 이상 변은 깊이 2
          let i = run.length < 10 ? Math.max(1, Math.floor((run.length - 3) / 2) + Math.floor(hv(run[0]!, dx * 3 + dy + 11) * 2) - 1) : 1 + Math.floor(hv(run[0]!, dx * 3 + dy + 11) * 3);
          while (i + 2 <= run.length - 1) {
            const len = 2 + Math.floor(hv(run[i]!, 5) * 2), dep = run.length >= 7 ? 2 : 1 + Math.floor(hv(run[i]!, 9) * 2);
            for (let k = 0; k < len && i + k < run.length - 1; k += 1) {
              const c = run[i + k]!, x = c % W, y = (c - x) / W;
              for (let d = 0; d < dep; d += 1) { const xx = x - dx * d, yy = y - dy * d; if (inMap(xx, yy)) cut.push(idx(xx, yy)); }
            }
            i += len + 3 + Math.floor(hv(run[i]!, 13) * 3);
          }
        }
      }
      for (const c of cut) { forestSet.delete(c); carved.add(c); }
    }
    // 남쪽 끝 줄(2층) 수관은 단 동서 끝 1px 선(relief over 띠)보다 먼저 그려져 그 선에 썰린다(VQA r14 작은 마을 B) — 동·서 이웃이 다른 단인 남쪽 끝 칸은 뺀다
    for (let pass = 0; pass < 3; pass += 1) {
      const drop = [...forestSet].filter((c) => { const x = c % W; return (c + W >= W * H || !forestSet.has(c + W)) && ((x > 0 && lv[c - 1] !== lv[c]) || (x < W - 1 && lv[c + 1] !== lv[c])); });
      if (!drop.length) break;
      for (const c of drop) forestSet.delete(c);
    }
    shapeBeodeulCanopyMask(W, H, forestSet, { canFill: () => false, joins: sameLv, minComponent: canopyStyle === "snow" ? 12 : 16, minExtent: canopyStyle === "snow" ? 3 : 4, minInterior: 0.15, block: 2 }); // 홈이 남긴 가는 끝만 걷는다(메우지 않음)
    for (let c = 0; c < W * H; c += 1) if (occ[c] === FOREST && !forestSet.has(c)) occ[c] = FREE; // 다듬기로 빠진 산마루(summit) 칸은 풀밭으로
    for (const c of forestSet) occ[c] = FOREST;
  }
  // 낱 나무 덩이: 길에서 3칸 이상 떨어진 빈 땅에 덩이 중심, 덩이마다 3~7그루(숲 덩이가 있으면 몇 덩이만)
  const trees = have(spec.trees), shrubs = have(spec.shrubs);
  let treeCount = 0;
  const treeFits = (k: Kit, x: number, y: number, gap: number) => {
    if (!fits(k, x, y, 0, (v) => v === FREE || v === POND_RING)) return false;
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (distRoad[idx(x + i, y + j)]! < gap) return false;
    // 나무 한 그루는 한 단 위에만 — 단 동서 끝 너머로 걸치면 두 단이 다른 높이로 그려져 수관이 선을 따라 썰린다(VQA r4)
    const base = lv[idx(x, y + k.h - 1)]; for (let j = 0; j < k.h; j += 1) for (let i = -1; i <= k.w; i += 1) if (inMap(x + i, y + j) && lv[idx(x + i, y + j)] !== base) return false; // 옆 한 칸도 같은 단 — 단 끝 선에 수관이 붙으면 선이 수관 가장자리를 긋는다
    return true;
  };
  // 숲 둘레 나무(침엽·혼효 마을): 수관 오토타일은 활엽·전나무가 섞인 한 장이라 침엽 마을 숲도 활엽으로 읽혔다(VQA r1) —
  // 숲 덩이 남·동·서 바로 바깥 풀밭에 그 마을 나무(전나무·측백)를 띄엄띄엄 세워 숲 가장자리가 침엽 숲으로 읽히게 한다.
  if (forestType !== "broadleaf" && forestSet.size && trees.length) {
    const rim = [...forestSet].filter((c) => { const x = c % W, y = (c - x) / W; return [[0, 1], [1, 0], [-1, 0]].some(([dx, dy]) => inMap(x + dx!, y + dy!) && occ[idx(x + dx!, y + dy!)] === FREE); });
    rim.sort((a, b) => ((Math.imul(a, 2654435761) ^ seed) >>> 0) - ((Math.imul(b, 2654435761) ^ seed) >>> 0));
    let budget = Math.ceil(rim.length / 5);
    for (const c of rim) {
      if (budget <= 0) break;
      const x = c % W, y = (c - x) / W; const k = K(choice(trees));
      for (const [tx, ty] of [[x - Math.floor(k.w / 2), y + 1], [x + 1, y - k.h + 1], [x - k.w, y - k.h + 1]] as const) {
        if (treeFits(k, tx, ty, 2) && LV(tx, ty + k.h - 1) === lv[c]) { claim(k, tx, ty, PROP, false); treeCount += 1; budget -= 1; break; }
      }
    }
  }
  if (spec.pond?.ringTrees.length && pondCells.length) {
    const ringIds = have(spec.pond.ringTrees);
    for (let t = 0; t < 120 && ringIds.length; t += 1) {
      const c = pondCells[Math.floor(rand() * pondCells.length)]!; const k = K(choice(ringIds));
      const x = (c % W) + ri(-3, 3), y = Math.floor(c / W) + ri(-3, 3);
      if (treeFits(k, x, y, 1)) { claim(k, x, y, PROP, false); treeCount += 1; }
    }
  }
  // 골 가장자리 덤불 띠: 강·못을 깎은 골의 남북 가장자리는 3/4 렌더가 옆 절벽 면을 그리지 않아(사용자 결정 r3 「동·서 옆면은 없는 게 낫다」)
  // 땅이 어긋난 가는 선으로만 보인다 — 높은 단 쪽 가장자리 칸을 따라 덤불·나무를 이어 심어 비탈 숲처럼 덮는다.
  // 낮은 골 쪽 가장자리 칸에도 띄엄띄엄 심어 선이 덤불 사이로 지나가게 한다(키트는 한 단 위에만 — 선 위에 걸쳐 심을 수는 없다).
  if (hasTerrain && (shrubs.length || trees.length)) for (const cv of terrain.coves) for (const [ex, side, high] of [[cv.x0 - 1, -1, true], [cv.x1 + 1, 1, true], [cv.x0, 1, false], [cv.x1, -1, false]] as const) {
    if (ex < 0 || ex >= W) continue;
    for (let y = 1; y < H; y += 1) {
      const nb = ex - side; // 선 건너 칸 — 높은 단 쪽이면 골, 골 쪽이면 높은 단
      if (at(ex, y) !== FREE || (high ? lv[idx(ex, y)] === 0 : !inMap(nb, y) || lv[idx(nb, y)] === 0) || (!high && rand() < 0.45)) continue;
      const k = K(choice(shrubs.length && (rand() < 0.65 || !trees.length) ? shrubs : trees));
      const x = side < 0 ? ex - k.w + 1 : ex, yy = y + k.h - 1 < H ? y : H - k.h;
      if (treeFits(k, x, yy, 1)) { claim(k, x, yy, PROP, false); treeCount += 1; y += k.h - 1; }
    }
  }
  // 단 위의 쓰임(풀밭 마을이 아니면): 윗길 양옆 높은 단에 숲·덤불 덩이 두셋 — 숲길·고갯길. 오르막 머리 절벽 끝에 전망 의자(있는 theme 만).
  for (const cl of climbs) {
    if (!fenced && trees.length) {
      let groves = 0;
      for (let t = 0; t < 40 && groves < 3; t += 1) {
        const c = cl.cells[Math.floor(rand() * cl.cells.length)]!; const cx = c % W, cy = (c - cx) / W;
        if (at(cx, cy) !== FREE || distRoad[c]! < 3) continue;
        let n = 0;
        for (let m = 0; m < 12 && n < 4; m += 1) { const k = K(choice(rand() < 0.7 ? trees : shrubs.length ? shrubs : trees)); const x = cx + ri(-3, 3) - Math.floor(k.w / 2), y = cy + ri(-2, 2) - k.h + 1;
          if (treeFits(k, x, y, 2)) { claim(k, x, y, PROP, false); treeCount += 1; n += 1; } }
        if (n) groves += 1;
      }
      if (groves) cl.use.push(theme === "desert" ? "덤불 언덕" : "숲길");
    }
    const bench = have(theme === "snow" ? ["bd-pick-snowfield-bench"] : fenced ? ["bd-prop-bench_wood"] : [])[0];
    if (bench) {
      const k = K(bench); const lx = cl.lanes[0]!;
      let rim = -1; for (let y = 0; y < H; y += 1) if (rampCells.has(idx(lx, y)) || ramps[idx(lx, y)]) { rim = y - 1; break; }
      if (rim > 0) for (const x of [lx + 2, lx - k.w - 1]) if (fits(k, x, rim)) { claim(k, x, rim, PROP, true); cl.lookout = { x, y: rim }; cl.use.push("전망 의자"); break; }
    }
  }
  // 밀도(2026-10-11 사용자 지적 「오브젝트 밀도가 너무 높다」 두 번): 덩이 시도·크기를 줄이고 빈 땅을 더 남긴다.
  // 화면당 빈 바닥 상한도 46%→58%(모래·눈 62%→74%) — 그림자가 생겨 덜 채워도 땅이 평평해 보이지 않는다.
  for (let t = 0; t < (forestSet.size ? 8 : openLand ? 32 : 30) && trees.length; t += 1) {
    const cx = ri(1, W - 2), cy = ri(1, H - 2);
    if (at(cx, cy) !== FREE || distRoad[idx(cx, cy)]! < 3) continue;
    const n = openLand ? ri(2, 3) : ri(3, 5);
    // 덩이는 붙여 키운다(2026-10-28 생활 마을 「흩뿌린 덤불」): 둘째 그루부터는 이미 선 그루 바로 곁(옆 한 키트 폭·위아래 한 칸)에만 —
    // 가운데서 ±3칸 아무 데나 두면 덤불이 1~2칸씩 떨어진 낱개로 고르게 흩어져 점박이·격자로 읽혔다.
    const members: { x: number; y: number; w: number; h: number }[] = []; let placed = 0;
    for (let m = 0; m < n * 8 && placed < n; m += 1) {
      const k = K(choice(rand() < 0.75 ? trees : shrubs.length ? shrubs : trees));
      const p = members.length ? members[Math.floor(rand() * members.length)]! : undefined;
      const [x, y] = p ? clumpNext(p, k) : [cx - Math.floor(k.w / 2), cy - k.h + 1];
      if (treeFits(k, x, y, 2)) { claim(k, x, y, PROP, false); treeCount += 1; placed += 1; members.push({ x, y, w: k.w, h: k.h }); }
    }
  }
  // 남은 빈 땅: 큰 빈 덩이에만 작은 덩이(덤불 1~3 + 풀꽃 2~4)를 씨앗처럼 — 고르게 흩지 않는다(점박이 금지).
  // 풀밭 마을은 덩이 8칸까지, 모래·눈 마을은 트인 땅이 자연이라 30칸까지 둔다. 그다음 20×15 화면마다 빈 바닥 38% 이하로.
  const decals = have(spec.decals);
  const blobLimit = openLand ? 90 : 14;
  let filler = 0;
  const bareBlobs = (limit: number): number[][] => {
    const seen = new Uint8Array(W * H); const out: number[][] = [];
    for (let c = 0; c < W * H; c += 1) {
      if (seen[c] || (occ[c] !== FREE && occ[c] !== POND_RING)) continue;
      const q = [c]; seen[c] = 1;
      for (let h = 0; h < q.length; h += 1) { const a = q[h]!, x = a % W, y = (a - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy);
          if (!seen[n] && (occ[n] === FREE || occ[n] === POND_RING)) { seen[n] = 1; q.push(n); } } }
      if (q.length > limit) out.push(q);
    }
    return out;
  };
  const tuft = (cx: number, cy: number, grove = false): number => {
    let n = 0;
    const items = grove ? ri(3, 6) : ri(2, 3);
    const members: { x: number; y: number; w: number; h: number }[] = [];
    for (let m = 0; m < items * 4 && members.length < items && shrubs.length; m += 1) {
      const k = K(choice(grove && trees.length && rand() < 0.6 ? trees : shrubs));
      const p = members.length ? members[Math.floor(rand() * members.length)]! : undefined; // 덩이로 붙여 키운다(위 낱 나무 덩이와 같은 규칙)
      const [x, y] = p ? clumpNext(p, k) : [cx, cy - k.h + 1];
      if (treeFits(k, x, y, 1)) { claim(k, x, y, PROP, false); n += 1; members.push({ x, y, w: k.w, h: k.h }); } }
    // 풀꽃 키트는 2×1 도 있다 — 키트 전체 칸이 빈 땅일 때만(길 위로 삐져나오지 않게)
    for (let m = 0; m < (openLand ? ri(0, 1) : ri(1, 2)) && decals.length; m += 1) {
      const k = K(choice(decals)); const x = cx + ri(-2, 2), y = cy + ri(-1, 1);
      if (!treeFits(k, x, y, 1)) continue;
      claim(k, x, y, FIELD, false); for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) decalAt.add(idx(x + i, y + j)); n += 1;
    }
    return n;
  };
  for (let pass = 0; pass < 8; pass += 1) {
    const blobs = bareBlobs(blobLimit); if (!blobs.length) break;
    for (const b of blobs) for (let t = 0; t < Math.max(1, Math.round(b.length / (blobLimit * 2.5))); t += 1) {
      const c = b[Math.floor(rand() * b.length)]!; filler += tuft(c % W, Math.floor(c / W));
    }
  }
  // 성벽 띠(WALLB) 칸은 화면 몫에서 뺀다 — 세면 성벽 앞 화면이 늘 「덜 비었다」로 나와 성벽 안쪽 아래 줄이 빈 모래 띠로 남았다(2026-10-22 VQA r7, 사막 성벽 마을)
  const openShare = (x0: number, y0: number) => { let n = 0, o = 0;
    for (let y = y0; y < Math.min(H, y0 + 15); y += 1) for (let x = x0; x < Math.min(W, x0 + 20); x += 1) {
      const c = idx(x, y), v = occ[c]!; if (v === WALLB) continue; n += 1;
      if (!cover[c] && (v === FREE || v === POND_RING || v === CLEAR || v === PROP || v === BLD || (v === FIELD && !decalAt.has(c)))) o += 1; }
    return n ? o / n : 0; };
  // 화면 창은 늘 20×15 온 창으로 잰다(2026-10-28 조선·생활 마을): 맵 끝 화면(아래 4줄·오른쪽 2열 같은 자투리 띠)을 따로 재면
  // 그 좁은 띠만 58% 로 채우느라 덤불·측백이 맵 가장자리를 따라 한 줄로 늘어섰다.
  // 채울 자리는 이미 있는 덩이(나무·덤불·소품·숲·집) 곁을 먼저 고른다 — 빈 땅 한가운데 낱개로 흩뿌리면 점박이로 읽혔다(덩이로 자라게).
  const nearClump = (x: number, y: number) => {
    for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) {
      if (!inMap(x + dx, y + dy) || (dx === 0 && dy === 0)) continue; const v = occ[idx(x + dx, y + dy)];
      if (v === PROP || v === FOREST || v === BLD) return true;
    }
    return false;
  };
  const screens: [number, number][] = [];
  for (let y0 = 0; y0 < H; y0 += 15) for (let x0 = 0; x0 < W; x0 += 20) screens.push([Math.max(0, Math.min(x0, W - 20)), Math.max(0, Math.min(y0, H - 15))]);
  for (const [x0, y0] of screens) {
    for (let t = 0; t < 200 && openShare(x0, y0) > (openLand ? 0.74 : 0.58); t += 1) {
      const x = x0 + ri(0, Math.min(19, W - 1 - x0)), y = y0 + ri(0, Math.min(14, H - 1 - y0));
      if (occ[idx(x, y)] !== FREE || distRoad[idx(x, y)]! < 2) continue;
      if (t < 150 && !nearClump(x, y)) continue;
      filler += tuft(x, y, openLand);
    }
  }

  // 성벽 마을의 성벽 안쪽 발치: 모래·눈 마을은 트인 땅이라 큰 빈 덩이 채우기가 성벽 앞 몇 줄에 거의 닿지 않아 빈 띠로 남았다
  // (2026-10-22 VQA r7, 사막 성벽 마을 아래쪽). 남·북 성벽 앞 두세 줄(성벽 발치 한 줄은 비움)에 4~8칸마다 작은 덩이(덤불·돌·풀꽃)를 둔다.
  if (wallLayout && openLand) {
    const WL = wallLayout;
    for (const [ya, yb] of [[WL.y1 - 5, WL.y1 - 3], [WL.y0 + 8, WL.y0 + 10]] as const)
      for (let x = WL.x0 + 4 + ri(0, 3); x < WL.x1 - 3; x += ri(4, 8)) {
        const y = ri(ya, yb); if (!inMap(x, y) || occ[idx(x, y)] !== FREE || distRoad[idx(x, y)]! < 2) continue;
        filler += tuft(x, y);
      }
  }

  planStep("밭·숲·덤불");
  // 둘째 문 잇기: 문이 둘 이상 그려진 건물(ㄱ자 공공 건물·연립)은 등록된 문 하나만 길에 이어져, 다른 문은 풀밭에 바로 붙었다
  // (2026-10-29 야외 VQA vm2 argon jrpg 「돌벽 집 문 앞에는 길이 없어 문까지 갈 수 없어 보인다」). 그림에 문이 있는 칸마다
  // 문 앞 칸에서 가장 가까운 길·광장까지 6걸음 안이면 1칸 폭 문 앞 길을 낸다(밭·건물·물은 피한다 — 못 이으면 그대로 둔다).
  {
    const meta = (ts.tileMeta ?? []) as unknown as ({ label?: string } | undefined)[];
    const doorTile = (t: number | undefined) => { if (t === undefined || t < 0) return false; const l = (meta[t]?.label ?? "").replace(/\s*\([^)]*\)/gu, "").replace(/^.*·\s*/u, "").trim(); return /(?:문|문 ?통로|문칸|door|gate)$/iu.test(l) && !/금고|창문|창틀|문양|문장|포문|뚜껑문|수문|천문|window|safe|hatch/iu.test(l); }; // eventReach isDoorArtLabel 과 같은 판정
    const fronts = new Set(doorFronts.map((d) => idx(d.x, d.y)));
    for (const st of stamps) {
      if (st.v !== BLD) continue;
      const k = kitIndex.get(st.kit); if (!k) continue;
      for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
        const row = k.def.rows[j]; if (!row) continue;
        if (!doorTile(row.upperTiles?.[i]) && !doorTile(row.tiles[i])) continue;
        // 문 그림의 맨 아래 칸만(위아래 두 칸 문은 아랫칸), 바로 아래가 건물 밖
        const below = k.def.rows[j + 1];
        if (below && (doorTile(below.upperTiles?.[i]) || doorTile(below.tiles[i]))) continue;
        // 문 아래 칸이 키트 밖이거나 키트 안 투명 칸(ㄱ자 건물의 들어간 쪽)이어야 사람이 선다
        // (아래층 tiles 는 키트가 깐 바탕 땅일 수 있어 윗층만 본다)
        if (below && (below.upperTiles?.[i] ?? -1) >= 0) continue;
        const fx = st.x + i, fy = st.y + j + 1;
        if (!inMap(fx, fy) || fronts.has(idx(fx, fy))) continue;
        // 키트 상자 안 투명 칸(ㄱ자 건물의 들어간 마당)은 계획상 건물 칸이다 — 길 찾기에서는 빈 땅으로 본다
        const hollow = new Set<number>();
        for (let jj = 0; jj < k.h; jj += 1) for (let ii = 0; ii < k.w; ii += 1) if ((k.def.rows[jj]?.upperTiles?.[ii] ?? -1) < 0 && at(st.x + ii, st.y + jj) === BLD) hollow.add(idx(st.x + ii, st.y + jj));
        const open = (n: number) => occ[n] === FREE || hollow.has(n);
        if (hollow.has(idx(fx, fy))) set(fx, fy, FREE);
        const v0 = at(fx, fy);
        if (v0 === ROAD || v0 === PLAZAC) { fronts.add(idx(fx, fy)); doorFronts.push({ x: fx, y: fy, kit: k.id }); continue; }
        if (v0 !== FREE) continue;
        // 6걸음 BFS(빈 땅만)
        const prev = new Map<number, number>([[idx(fx, fy), -1]]); const q = [idx(fx, fy)]; let hit = -1;
        for (let h = 0; h < q.length && hit < 0; h += 1) {
          const c = q[h]!, x = c % W, y = (c - x) / W;
          let depth = 0; for (let t = c; prev.get(t)! >= 0; t = prev.get(t)!) depth += 1;
          if (depth >= 6) continue;
          for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]] as const) {
            const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
            if (prev.has(n)) continue;
            if (rel && !reliefAllowsStep(rel, x, y, nx, ny)) continue;
            const v = occ[n];
            if (v === ROAD || v === PLAZAC) { prev.set(n, c); hit = n; break; }
            if (open(n)) { prev.set(n, c); q.push(n); }
          }
        }
        if (hit < 0) continue;
        for (let t = prev.get(hit)!; t >= 0; t = prev.get(t)!) occ[t] = ROAD;
        fronts.add(idx(fx, fy)); doorFronts.push({ x: fx, y: fy, kit: k.id });
      }
    }
  }
  // 막다른 토막 다듬기: 이웃 포장 칸이 1개 이하인 길 칸(문 앞·맵 가장자리 제외)을 지운다 — 이음길 끝의 혹이 남지 않게
  {
    const front = new Set([...doorFronts.map((d) => idx(d.x, d.y)), ...keepRoad]);
    const paved = (x: number, y: number) => { const v = at(x, y); return v === ROAD || v === PLAZAC || v === KEEP; };
    // 흩어진 마을의 갈래길은 마지막 집 문 앞까지 깎여야 한다 — 끝까지 반복
    for (let pass = 0; pass < (form === "plaza" ? 6 : W + H); pass += 1) {
      let removed = 0;
      for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
        if (at(x, y) !== ROAD || front.has(idx(x, y))) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => paved(x + dx!, y + dy!)).length;
        if (n <= 1) { occ[idx(x, y)] = FREE; removed += 1; }
      }
      if (!removed) break;
    }
  }

  // 판석 조각 거두기: 앵커 문 맞은편 어귀 판석을 나중에 낸 갈래길이 가로질러 2~6칸 조각으로 쪼개면, 길과 따로 노는 돌바닥 조각 위에
  // 사과 상자 하나만 남았다(2026-10-29 야외 VQA vm2 flash jrpg 「돌바닥 조각 두 개가 잔디 위에 떠 있다」). 광장 형태가 아니면
  // 8칸 미만 판석 조각은 풀밭으로 되돌리고 그 위에만 선 소품도 거둔다.
  if (form !== "plaza") {
    const isPl = (c: number) => occ[c] === PLAZAC || (plazaSet.has(c) && occ[c] === PROP);
    const seenPl = new Uint8Array(W * H);
    for (let s0 = 0; s0 < W * H; s0 += 1) {
      if (seenPl[s0] || !isPl(s0)) continue;
      const comp: number[] = [s0]; seenPl[s0] = 1;
      for (let h = 0; h < comp.length; h += 1) { const c = comp[h]!, x = c % W;
        for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1 && !seenPl[n] && isPl(n)) { seenPl[n] = 1; comp.push(n); } }
      if (comp.length >= 8) continue;
      const inComp = new Set(comp);
      for (let k = stamps.length - 1; k >= 0; k -= 1) {
        const st = stamps[k]!; if (st.v !== PROP) continue;
        const kk = kitIndex.get(st.kit); if (!kk) continue;
        const cells: number[] = [];
        for (let j = 0; j < kk.h; j += 1) for (let i = 0; i < kk.w; i += 1) if (inMap(st.x + i, st.y + j)) cells.push(idx(st.x + i, st.y + j));
        if (!cells.length || !cells.some((c) => inComp.has(c))) continue;
        stamps.splice(k, 1); if ([...spec.trees, ...spec.shrubs, ...(spec.pond?.ringTrees ?? [])].includes(st.kit)) treeCount -= 1;
        for (const c of cells) { if (occ[c] === PROP) occ[c] = FREE; cover[c] = 0; plazaSet.delete(c); }
      }
      for (const c of comp) { if (occ[c] === PLAZAC) occ[c] = FREE; plazaSet.delete(c); }
    }
  }

  planStep("막다른 길 다듬기");
  // ---------- 11. 칠하기 ----------
  const map = draft.maps[mapId]!;
  const tileOf = (surf: Surface, x: number, y: number): number => {
    if ("kit" in surf) { const k = kitIndex.get(surf.kit); if (!k) return map.lowerTiles[idx(x, y)]!; const r = k.def.rows[y % k.h]!; const t = r.tiles[x % k.w]!; return t >= 0 ? t : k.def.rows[0]!.tiles[0]!; }
    return -1;
  };
  const fill = (rect: { x: number; y: number; w: number; h: number }, material: string, clearUpper?: boolean, exact?: boolean) => {
    try { fillRegionTool.run(draft, { mapId, rect, material, ...(clearUpper !== undefined ? { clearUpper } : {}), ...(exact ? { _exactCells: true } : {}) }); return true; } catch (e) { warnings.push(`칠하기 실패(${material}): ${(e as Error).message.slice(0, 80)}`); return false; }
  };
  const paintCells = (cells: Iterable<number>, surf: Surface, exact?: boolean) => {
    if ("kit" in surf) { for (const c of cells) { const x = c % W, y = (c - x) / W; map.lowerTiles[c] = tileOf(surf, x, y); map.upperTiles[c] = -1; } return; }
    // 재료: 행마다 연속 구간을 사각형으로
    const rows = new Map<number, number[]>(); for (const c of cells) { const y = Math.floor(c / W); const l = rows.get(y); if (l) l.push(c % W); else rows.set(y, [c % W]); }
    for (const [y, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0]!, p = s;
      for (let i = 1; i <= xs.length; i += 1) { const v = xs[i]; if (v === p + 1) { p = v; continue; } fill({ x: s, y, w: p - s + 1, h: 1 }, surf.mat, undefined, exact); if (v !== undefined) { s = v; p = v; } } }
  };
  beginConstructionTiles(draft.maps[mapId]!);
  const paintStep = (label: string, realizes: number[]) => logConstructionTiles(draft.maps[mapId]!, "paint", label, { realizes });
  // 바탕
  if ("mat" in spec.base) fill({ x: 0, y: 0, w: W, h: H }, spec.base.mat, true);
  else { const all: number[] = []; for (let c = 0; c < W * H; c += 1) all.push(c); paintCells(all, spec.base); }
  paintStep("바탕 깔기", [FREE]);
  // 물(강·바다 = 버들항 물 오토타일, 못·늪 = 표본)
  const waterMat: number[] = [], roadCells: number[] = [], plazaPaint: number[] = [];
  for (let c = 0; c < W * H; c += 1) {
    const v = occ[c]!;
    if (v === WATERC && !surfaceAt.has(c)) waterMat.push(c);
    else if (v === ROAD) roadCells.push(c);
    else if (v === PLAZAC || (plazaSet.has(c) && v === PROP)) plazaPaint.push(c); // 광장 소품 밑도 판석
  }
  // 다리·잔교 자리(KEEP)도 물이다 — 키트가 위에 앉는다
  for (let c = 0; c < W * H; c += 1) if (occ[c] === KEEP && (spec.feature === "river" || spec.feature === "coast" || codeT)) waterMat.push(c);
  // 물·길 사이 아래 띠: 돌·잔교가 놓일 물을 먼저
  const bySurface = new Map<Surface, number[]>();
  for (const [c, s] of surfaceAt) { if (occ[c] === WATERC || occ[c] === POND_RING || occ[c] === FIELD || occ[c] === PROP) { const l = bySurface.get(s); if (l) l.push(c); else bySurface.set(s, [c]); } }
  for (const [s, cells] of bySurface) paintCells(cells, s);
  paintStep("물가·밭 바닥", spec.field?.sample ? [POND_RING, FIELD] : [POND_RING]);
  // 길 → 광장 → 물 순서: fill_region 은 「벽」과 1칸 틈을 메우므로 물이 먼저 있으면 물가 1칸 틈이 길로 메워져 혹이 생긴다
  paintCells(roadCells.filter((c) => !trackCells.has(c)), spec.road);
  // 단 위 윗길·오르막(풀밭 마을)은 모랫길 — 큰길 포석과 다른 밭길·고갯길
  paintCells(roadCells.filter((c) => trackCells.has(c)), { mat: SAND_PATH });
  paintCells([...gateTrack].filter((c) => occ[c] === CLEAR || fenceGates.includes(c)), { mat: SAND_PATH });
  paintStep("길 깔기", [ROAD]);
  paintCells(plazaPaint, spec.plaza);
  paintStep("광장 판석", [PLAZAC]);
  if (waterMat.length) paintCells(waterMat, { mat: WATER });
  // 자연 물: 운하 오토타일의 돌 둑 가장자리 대신 몸통 물 한 가지만 1층에 두고, 둑은 2층 덧그림이 그린다(아래 12b).
  const canal = ts.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47");
  const canalMembers = new Set(canal?.memberTileIds ?? []);
  const fullWater = canal?.variantMap?.["255"] ?? -1;
  const flattenWater = () => {
    if (!naturalWater || fullWater < 0) return;
    const m = draft.maps[mapId]!;
    for (let c = 0; c < W * H; c += 1) if ((occ[c] === WATERC || occ[c] === KEEP) && canalMembers.has(m.lowerTiles[c]!)) m.lowerTiles[c] = fullWater;
  };
  flattenWater();
  paintStep("물 넣기", [WATERC, KEEP]);

  // ---------- 12. 찍기 ----------
  let stamped = 0, failed = 0;
  let natureStats = { overlay: 0, shadowCells: 0, forestCells: 0 };
  const treeKits = new Set([...spec.trees, ...spec.shrubs, ...(spec.pond?.ringTrees ?? [])]);
  const stampKind = (s: Stamp): string => s.v === BLD ? (anchors.includes(s.kit) ? "큰 건물" : "집")
    : treeKits.has(s.kit) ? "나무·덤불" : s.v === FIELD || decalAt.has(idx(s.x, s.y)) ? "풀꽃·밭" : "소품";
  const kindTotal = new Map<string, number>(), kindSeen = new Map<string, number>();
  for (const s of stamps) { const kind = stampKind(s); kindTotal.set(kind, (kindTotal.get(kind) ?? 0) + 1); }
  // 나중에 걷어 낼 수 있는 찍기(나무·덤불·풀꽃·소품 — 기록하지 않는 것)는 찍기 전 네 층을 남긴다(13 앞에서 갇힌 빈터를 여는 데 쓴다)
  const undo = new Map<Stamp, { w: number; h: number; layers: number[][] }>();
  const shadowOwner = new Map<number, Stamp>();
  const reviewedStamps: Stamp[] = [];
  for (const s of stamps) {
    const k = kitIndex.get(s.kit); if (!k) { failed += 1; warnings.push(`키트 없음: ${s.kit}`); continue; }
    const rect = { x: s.x, y: s.y, w: k.w, h: k.h };
    const before = s.record ? captureStructureTiles(draft.maps[mapId]!, rect) : null;
    if (!s.record && (s.v === PROP || s.v === FIELD)) {
      const mm = draft.maps[mapId]!; const layers: number[][] = [[], [], [], []];
      for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) { const c = inMap(s.x + i, s.y + j) ? idx(s.x + i, s.y + j) : -1; for (const L of [1, 2, 3, 4] as const) layers[L - 1]!.push(c < 0 ? -1 : layerTileAt(mm, L, c)); }
      undo.set(s, { w: k.w, h: k.h, layers });
    }
    try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/${s.kit}`, mapId, x: s.x, y: s.y }); stamped += 1; }
    catch (e) { failed += 1; if (failed <= 3) warnings.push(`찍기 실패 ${s.kit}@(${s.x},${s.y}): ${(e as Error).message.slice(0, 200)}`); continue; }
    if (reviewedPrefix(s.kit)) reviewedStamps.push(s);
    if (before) appendStructurePlacement(draft.maps[mapId]!, { kitId: s.kit, rect, before });
    // 물레방아 맨 아래 줄은 운하 돌 둑에 맞춘 물보라 기둥(반투명 파란 막대)이라 들판 물에서는 떠 보인다 — 바퀴가 물에 잠긴 모습으로 둔다
    if (s.kit === "bd-pick-riverside-mill-waterwheel" && naturalWater) for (let i = 0; i < k.w; i += 1) if (inMap(s.x + i, s.y + k.h - 1)) draft.maps[mapId]!.upperTiles[idx(s.x + i, s.y + k.h - 1)] = -1;
    const kind = stampKind(s); const n = (kindSeen.get(kind) ?? 0) + 1; kindSeen.set(kind, n);
    logConstructionTiles(draft.maps[mapId]!, "stamp", `${kind} ${n}/${kindTotal.get(kind)}`, { rect, major: s.v === BLD });
  }
  // 허용 건물의 그림자·기초는 모든 키트를 찍은 뒤 빈 칸에만 — 한 칸 넓은 그림자가 이웃 나무·소품 자리를 미리 막지 않게
  for (const s of reviewedStamps) stampReviewedCompanions(draft.maps[mapId]!, ts, s.kit, s.x, s.y);
  for (const b of [bridge, millBridge]) {
    if (!b) continue; const bridge = b;
    const br = kitIndex.get(bridge.kit);
    if (br) { try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/${bridge.kit}`, mapId, x: bridge.x, y: bridge.y }); stamped += 1; } catch (e) { failed += 1; warnings.push(`다리: ${(e as Error).message.slice(0, 160)}`); } }
    if (br) logConstructionTiles(draft.maps[mapId]!, "stamp", "다리", { rect: { x: bridge.x, y: bridge.y, w: br.w, h: br.h }, major: true });
    // 돌다리 상판(가운데 두 줄)은 큰 마름돌 벽면 그림이라 길이 벽에 막힌 것처럼 보였다(2026-10-28 장부 120 「다리가 벽처럼 보임」).
    // 상판 두 줄과 양 끝 길 마감 칸을 그 줄의 큰길 포석으로 바꿔 길이 다리 위로 이어지게 한다 — 뒷난간·앞난간·아치 줄은 그대로.
    if (br && bridge.kit === "bd-pick-mountain-pass-stone-bridge") {
      const m = draft.maps[mapId]!;
      for (const y of [bridge.y + 1, bridge.y + 2]) {
        const src: number[] = [];
        for (let x = bridge.x - 2; x >= Math.max(0, bridge.x - 6); x -= 1) if (occ[idx(x, y)] === ROAD) src.push(m.lowerTiles[idx(x, y)]!);
        for (let x = bridge.x + br.w + 1; x <= Math.min(W - 1, bridge.x + br.w + 5); x += 1) if (occ[idx(x, y)] === ROAD) src.push(m.lowerTiles[idx(x, y)]!);
        if (!src.length) continue;
        const cells: number[] = [];
        for (let x = bridge.x; x < bridge.x + br.w; x += 1) cells.push(x);
        for (const x of [bridge.x - 1, bridge.x + br.w]) if (inMap(x, y) && occ[idx(x, y)] === ROAD) cells.push(x);
        cells.forEach((x, i) => { m.lowerTiles[idx(x, y)] = src[i % src.length]!; });
      }
    }
  }

  // 울타리: 공용 기초 칩셋(beodeul_ground)의 숲 울타리 조각을 이 타일셋에 옮겨 층 3에 잇는다
  if (fenceAt.size) {
    // 조각 그림은 자연 덧그림 팩(beodeul_nature)의 울타리 조각 — 통행·우선순위는 공용 기초 칩셋의 숲 울타리 가로 조각을 따른다(막힘, 3층)
    const common = draft.tilesets.beodeul_ground ??= createBeodeulGroundTileset(); ensureBeodeulGroundReferences(common);
    const srcH = groundCatalog.recipes.find((r) => r.id === "bdg-woodland-fence-horizontal")!.rows[0]![0]!;
    const nat = natureTileset();
    const pieces = BEODEUL_NATURE.fence;
    const tr = translateTiles(nat, ts, new Set([...fenceAt.values()].map((k) => pieces[k])));
    for (const to of tr.map.values()) { ts.priority[to] = common.priority[srcH]!; ts.passability[to] = structuredClone(common.passability[srcH]!); }
    for (const [c, kind] of fenceAt) setLayerTileAt(draft.maps[mapId]!, 3, c, tr.map.get(pieces[kind])!);
    logConstructionTiles(draft.maps[mapId]!, "stamp", "울타리", { major: false });
  }

  // ---------- 12b. 자연 덧그림(2층): 물가 둑 → 풀밭 가장자리 → 그림자 ----------
  {
    const m = draft.maps[mapId]!;
    flattenWater();
    const want = new Map<number, number>(); // 칸 → beodeul_nature 칸 번호
    const N8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const;
    const maskOf = (c: number, same: (n: number) => boolean) => {
      const x = c % W, y = (c - x) / W; let mask = 0;
      N8.forEach(([dx, dy], b) => { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny) || same(idx(nx, ny))) mask |= 1 << b; });
      return mask;
    };
    if (naturalWater) {
      const wet = (n: number) => occ[n] === WATERC || occ[n] === KEEP;
      for (let c = 0; c < W * H; c += 1) if (occ[c] === WATERC && m.lowerTiles[c] === fullWater) {
        const t = BEODEUL_NATURE.bankGrass[maskOf(c, wet)]!; if (t >= 0) want.set(c, t);
      }
    }
    // 설원 얼음 못: 눈 둑 / 늪: 물은 이끼 둑, 이끼 늪 칸은 진흙 둑 — 칸 모양 네모 가장자리를 둥글게
    if (theme === "snow" && pondCells.length) {
      const pond = new Set(pondCells);
      for (const c of pond) { const t = BEODEUL_NATURE.bankSnow[maskOf(c, (n) => pond.has(n))]!; if (t >= 0) want.set(c, t); }
    }
    if (spec.feature === "bog") {
      const water = new Set(pondCells);
      for (const c of water) { const t = BEODEUL_NATURE.bankBog[maskOf(c, (n) => water.has(n) || onWater.has(n))]!; if (t >= 0 && layerTileAt(m, 2, c) < 0) want.set(c, t); }
      for (const c of bogRing) { const t = BEODEUL_NATURE.bankMud[maskOf(c, (n) => bogRing.has(n) || water.has(n))]!; if (t >= 0 && layerTileAt(m, 2, c) < 0) want.set(c, t); }
    }
    if (lawnOverlay && lawnSet.size) {
      const pond = new Set(pondCells);
      for (const c of lawnSet) {
        const t = pond.has(c) ? BEODEUL_NATURE.bankLawn[maskOf(c, (n) => pond.has(n))]! : BEODEUL_NATURE.edgeLawn[maskOf(c, (n) => lawnSet.has(n))]!;
        if (t >= 0) want.set(c, t);
      }
    }
    // 숲 수관: 숲 칸마다 이웃 비트·P×P 위상으로 고른 수관 칸(막힘 ×), 숲 바로 남쪽 빈 칸에는 물결치는 그늘(★)
    const canopyAt = new Map<number, number>();
    // 숲 수관(2026-10-22 「숲 오토타일을 제대로」): 풀밭·설원 숲 덩이 모두 이어진 수관 오토타일 한 장 — 숲 칸마다 이웃 비트·P×P 위상 수관(막힘 ×),
    // 숲 남쪽 바로 아래 빈 칸에는 물결치는 숲 그늘·이끼 치마(★). 짙은 풀 위 낱 나무(composer, 10-20)는 듬성듬성한 과수원·네모 짙은 풀 판으로 읽혀 걷었다.
    if (canopyStyle && forestSet.size) {
      const plan = planBeodeulCanopy(W, H, canopyStyle, forestSet, (s) => occ[s] !== WATERC && occ[s] !== KEEP && occ[s] !== FOREST && layerTileAt(m, 2, s) < 0 && !want.has(s) && !rampCells.has(s) && lv[s] === lv[s - W], (a, b) => lv[a] === lv[b]);
      for (const [c, t] of plan.canopy) canopyAt.set(c, t);
      for (const [c, t] of plan.shade) want.set(c, t);
    }
    // 그림자: 찍힌 키트마다 그 그림 모양으로 잰 그림자(나무·야자·선인장 = 밑동 타원, 집·소품·바위 = 오른쪽 아래로 비낀 그림자)
    // 2층 덧그림은 ★(통행 + 상위) — 통행은 위층부터 ★·빈칸을 건너뛰고 처음 만난 타일이 정하므로 ○ 로 두면 물·이끼 늪의 × 를 덮어
    // 물 위를 걷게 된다(openwiki/editor-ai-tools.md 「나무 밑 그림자」 같은 함정). 2층은 캐릭터 밑 묶음이라 상위여도 인물 아래에 그린다.
    // 길·광장 칸은 2층이 길 가장자리 그림이라 차 있어 그림자를 두지 않는다(4층은 상위면 인물 위에 그려지므로 쓰지 않는다).
    let shadowCells = 0;
    for (const st of stamps) {
      if (st.v === FIELD) continue;
      const sh = BEODEUL_NATURE.shadows[st.kit]; if (!sh) continue;
      sh.rows.forEach((row, j) => row.forEach((t, i) => {
        if (t < 0) return; const x = st.x + sh.dx + i, y = st.y + sh.dy + j; if (!inMap(x, y)) return;
        const c = idx(x, y); if (occ[c] === WATERC || occ[c] === KEEP || occ[c] === FOREST || want.has(c) || layerTileAt(m, 2, c) >= 0) return;
        if (hasTerrain && (lv[c] !== LV(st.x, st.y + (kitIndex.get(st.kit)?.h ?? 1) - 1) || rampCells.has(c))) return; // 단 너머·경사로에는 그림자를 두지 않는다
        want.set(c, t); shadowCells += 1; shadowOwner.set(c, st);
      }));
    }
    if (want.size || canopyAt.size) {
      const nat = natureTileset();
      const tr = translateTiles(nat, ts, new Set([...want.values(), ...canopyAt.values()]));
      const blocked = new Set(canopyAt.values());
      for (const [from, to] of tr.map) {
        ts.priority[to] = "upper";
        ts.passability[to] = blocked.has(from) ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true };
      }
      for (const [c, t] of want) setLayerTileAt(m, 2, c, tr.map.get(t)!);
      // 남쪽도 숲인 수관 칸은 3층 — 2층은 높이 지형 동서 끝 1px 선보다 먼저 그려져 그 선이 숲을 갈랐다(writeBeodeulCanopy 와 같은 규칙)
      for (const [c, t] of canopyAt) setLayerTileAt(m, c + W < W * H && canopyAt.has(c + W) ? 3 : 2, c, tr.map.get(t)!);
      logConstructionTiles(m, "stamp", canopyAt.size ? "물가·숲 수관·그림자" : "물가·그림자", { major: false });
    }
    natureStats = { overlay: want.size + canopyAt.size, shadowCells, forestCells: canopyAt.size };
  }

  // 마감 점검: 도시 형태 자(check_city_form 과 같은 계산)가 짚는 막다른 토막을 바탕으로 되돌린다(문 앞 칸은 두고)
  {
    const front = new Set([...doorFronts.map((d) => idx(d.x, d.y)), ...keepRoad]);
    for (let pass = 0; pass < 3; pass += 1) {
      const report = analyzeCityForm(draft, draft.maps[mapId]!);
      const cells: number[] = [];
      for (const d of report.deadEnds) {
        const [x, y] = d.at;
        // 한 칸 혹만 지운다 — 폭 2~3 토막은 방향을 모르는 채 지우면 이음길을 갉아먹는다(실측: 사막 seed 11 이음길 소실)
        if (d.kind === "cell") cells.push(idx(x, y));
      }
      const drop = [...new Set(cells)].filter((c) => !front.has(c) && occ[c] === ROAD);
      if (!drop.length) break;
      for (const c of drop) occ[c] = FREE;
      if ("mat" in spec.base) for (const c of drop) fill({ x: c % W, y: Math.floor(c / W), w: 1, h: 1 }, spec.base.mat);
      else paintCells(drop, spec.base);
    }
  }

  logConstructionTiles(draft.maps[mapId]!, "tidy", "막다른 길 정리");
  // 막다른 길을 깎아 아무 데도 안 오르게 된 경사로(갈래길 끝이 언덕 앞에서 깎인 것)는 경사로 표시를 지운다 —
  // 경사로 칸이 길이 아니거나, 오르막 끝·내리막 끝 칸이 길도 경사로도 아니면 지우고, 줄 전체가 지워질 때까지 되풀이
  if (rampCells.size) {
    const DV: Record<number, [number, number]> = { 1: [0, -1], 2: [0, 1], 3: [1, 0], 4: [-1, 0] };
    const pathy = (c: number) => occ[c] === ROAD || occ[c] === PLAZAC || occ[c] === KEEP;
    for (let changed = true; changed;) {
      changed = false;
      for (const c of [...rampCells]) {
        const [dx, dy] = DV[((ramps[c]! - 1) % 4) + 1]!; /* 5~8 = 같은 방향 계단 */ const x = c % W, y = (c - x) / W;
        const ends = [[x + dx, y + dy], [x - dx, y - dy]].map(([X, Y]) => (inMap(X!, Y!) ? idx(X!, Y!) : -1));
        if (!pathy(c) || ends.some((n) => n < 0 || !(pathy(n) || ramps[n] === ramps[c]))) { ramps[c] = 0; rampCells.delete(c); changed = true; }
      }
    }
    rampCount = 0; { const seen = new Set<number>(); for (const c of rampCells) { if (seen.has(c)) continue; rampCount += 1; const q = [c]; seen.add(c);
      for (let h = 0; h < q.length; h += 1) { const a = q[h]!, x = a % W, y = (a - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (rampCells.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } } } }
  }

  // 나루 널다리: 물 위 칸마다 어촌 포구 「서쪽 작은 부두」(1칸 폭 널판, 1층 땅 타일 — 걸음) 가운데 줄을 깐다. 물가 덧그림(12b)이 끝난 뒤라 둑 덧칠이 널판을 덮지 않는다.
  // (징검돌 1×1 은 위층 장식(decal)이라 게임 화면에서 그려지지 않았고 정적 그림에서도 점 몇 개로만 보였다 — 2026-10-29 게임 캡처.)
  if (fordStones.length) {
    const plank = kitIndex.get("bd-pick-fishing-port-jetty-west");
    const mids = (plank?.def.rows ?? []).map((r) => r.tiles?.[0] ?? -1).filter((t) => t >= 0);
    const m = draft.maps[mapId]!;
    if (mids.length) for (const [i, f] of fordStones.entries()) {
      m.lowerTiles[f.c] = mids[1 + (i % Math.max(1, mids.length - 1))] ?? mids[0]!;
      for (const L of [2, 3, 4] as const) setLayerTileAt(m, L, f.c, -1);
      stamped += 1;
    }
  }
  // ---------- 12c. 지형을 맵에 싣는다 ----------
  // 0단계 지형 + 3b 경사로를 map.relief 로. 칠하기·찍기 도구는 높이를 모르므로 찍기가 끝난 뒤에 넣는다(마을이 이미 지형을 따라 앉았다).
  let stairTiles = 0;
  let reliefInfo: { terrain: string; note: string; levels: Record<string, number>; ramps: number; cuts: number; fails: number; straddle: number; rampsOffRoad: number; roadOnRim?: number; lowered?: number; climbs?: number; stairTiles?: number } | null = null;
  {
    const m0 = draft.maps[mapId]!;
    if (hasTerrain && rel && lv.some((v) => v > 0)) {
      m0.relief = { ...rel, levels: Array.from(lv), ramps: ramps.slice(), style: RELIEF_STYLE[theme] };
      invalidateReliefSlopes(m0.relief);
      // 계단 칸 그림(2026-10-30 「경사로를 전부 계단으로 — 버들항 칩셋 계단 조각」): 남북으로 오르는 계단 칸의 1층을 칩셋 돌계단 조각 화소 그대로 —
      // 폭 1·2 계단은 왕도 선착 계단 윗칸(bd-capital-quay-steps-w/-e 0줄, 양옆 볼돌 — 아랫칸은 물이 비쳐 안 쓴다)을 세로로 되풀이(폭 2 = 서·동 한 줄씩),
      // 폭 3 이상은 bd-mpart-stairs 가운데 세 열(왼끝 1열·가운데 2열·오른끝 3열), 아래부터 조각 아랫줄·윗줄을 번갈아(단 1 = 두 칸, 단 2 = 세 칸). *-steps 양식은 계단을 비탈 높이로 잇고 그 칸의 1층 타일을 그대로 그린다.
      // 동서로 오르는 계단 조각은 칩셋에 없다 — 코드 지형의 길 찾기는 단을 남북으로만 건넌다(beodeulCodeLayout climbNS).
      {
        const quay = kitIndex.get("bd-capital-quay-steps-w"), quayE = kitIndex.get("bd-capital-quay-steps-e") ?? quay, mp = kitIndex.get("bd-mpart-stairs");
        const tileAt = (k: Kit | undefined, col: number, row: number) => k?.def.rows[row]?.tiles?.[col] ?? -1;
        const ns = (c: number) => { const v = ramps[c]!; return v > 0 && ((v - 1) % 4 === 0 || (v - 1) % 4 === 1); };
        const seenS = new Uint8Array(W * H);
        for (let c0 = 0; c0 < W * H; c0 += 1) {
          if (seenS[c0] || !ns(c0)) continue;
          const fl = [c0]; seenS[c0] = 1;
          for (let h = 0; h < fl.length; h += 1) { const c = fl[h]!, x = c % W, y = (c - x) / W;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (!seenS[n] && ns(n)) { seenS[n] = 1; fl.push(n); } } }
          const xs = fl.map((c) => c % W), ys = fl.map((c) => Math.floor(c / W));
          const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys);
          for (const c of fl) {
            const x = c % W, y = Math.floor(c / W), row = (y1 - y) % 2 === 0 ? 1 : 0;
            const t = x1 - x0 <= 1 ? tileAt(x === x0 ? quay : quayE, 0, 0) : tileAt(mp, x === x0 ? 1 : x === x1 ? 3 : 2, row);
            if (t < 0) continue;
            m0.lowerTiles[c] = t; for (const L of [2, 3, 4] as const) setLayerTileAt(m0, L, c, -1);
            stairTiles += 1;
          }
        }
      }
      const counts: Record<string, number> = {}; for (const v of lv) counts[v] = (counts[v] ?? 0) + 1;
      // 자가 점검: 두 단에 걸친 찍기(다리·물 위 소품은 0단 물 위라 제외 대상이 아니다 — 물과 둑은 0단), 길이 아닌 경사로 칸
      let straddle = 0;
      for (const st of stamps) { const k = kitIndex.get(st.kit); if (!k) continue; const set = new Set<number>();
        for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (inMap(st.x + i, st.y + j)) set.add(lv[idx(st.x + i, st.y + j)]!);
        if (set.size > 1) { straddle += 1; if (straddle <= 3) warnings.push(`두 단에 걸친 키트 ${st.kit}@(${st.x},${st.y})`); } }
      const rampsOffRoad = [...rampCells].filter((c) => occ[c] !== ROAD && occ[c] !== PLAZAC).length;
      // 절벽 끝 위의 길 칸(바로 남쪽이 낮은 단이고 경사로가 아닌 칸) — 경사로 윗 층계참은 뺀다
      let roadOnRim = 0;
      for (let c = 0; c < W * H - W; c += 1) if ((occ[c] === ROAD || occ[c] === PLAZAC) && lv[c + W]! < lv[c]! && !rampCells.has(c + W)) roadOnRim += 1;
      reliefInfo = { terrain: terrain.name, note: terrain.note, levels: counts, ramps: rampCount, cuts: cutCells, fails: rampFails, straddle, rampsOffRoad, roadOnRim, lowered, climbs: climbs.length, stairTiles };
      logConstructionTiles(m0, "stamp", "지형 높이", { major: false });
    } else {
      delete m0.relief;
      reliefInfo = { terrain: terrain.name, note: terrain.note, levels: { 0: W * H }, ramps: 0, cuts: 0, fails: 0, straddle: 0, rampsOffRoad: 0 };
    }
  }

  // ---------- 12d. 성벽 둘레(walls) ----------
  // 비워 둔 띠에 성벽을 싣는다. 길이 가로 성벽(북·남)을 지나는 곳은 4×8 성문루(가운데 두 열 통로), 세로 성벽(서·동)을 지나는 곳은 쪽문 문루(성벽 위로 솟은 네모 문루 ★ + 터널 입 그늘).
  // 망루는 성문과 겹치지 않는 후보 자리에, 계단은 북쪽 성벽 안쪽 앞면에서 아래 땅이 걸을 수 있는 자리 둘.
  let wallInfo: { gates: WallGate[]; gaps: WallGap[]; towers: WallTower[]; stairs: number[]; blockedRoads: number; southGateRoad?: { x: number; from: number } } | null = null;
  if (wallLayout) {
    const L = wallLayout, mw = draft.maps[mapId]!;
    const roadAt = (x: number, y: number) => inMap(x, y) && (occ[idx(x, y)] === ROAD || occ[idx(x, y)] === PLAZAC);
    const runs = (n: number, hit: (i: number) => boolean, lo: number, hi: number): [number, number][] => {
      const out: [number, number][] = []; let a = -1;
      for (let i = lo; i <= hi + 1; i += 1) { const h = i <= hi && i < n && hit(i); if (h && a < 0) a = i; if (!h && a >= 0) { out.push([a, i - 1]); a = -1; } }
      return out;
    };
    let blockedRoads = 0;
    const gates: WallGate[] = [], gaps: WallGap[] = [];
    // 2026-10-22 조수 시험(「남쪽에 성문 하나」): 길이 성벽을 지나는 곳마다 문을 내니 동서에 틈 셋, 남문은 남동 모서리 곁에 섰다.
    // 이제 성문 쪽(wallGate)마다 가운데에 가장 가까운 길 하나만 성문루가 되고, 나머지 성벽을 지나는 길은 성벽 안에서 끊는다(풀밭으로 되돌림).
    // 서·동 틈은 wallSideGaps 일 때만. 성문 쪽에 지나는 길이 없으면 큰길에서 맵 끝까지 두 칸 길을 낸다(걷어 낼 수 있는 덤불·소품만 치움).
    const gateSides: ("N" | "S")[] = options.wallGate === "N" ? ["N"] : options.wallGate === "NS" ? ["S", "N"] : ["S"];
    const bandRows = (side: "N" | "S") => [0, 1, 2, 3, 4, 5].map((i) => (side === "N" ? L.y0 : L.y1) + i); // 윗면 두 줄 + 앞면 네 줄
    const gxMin = L.x0 + 4, gxMax = L.x1 - 4;
    const owner = new Map<number, Stamp>();
    for (const [st, u] of undo) if (st.v === PROP) for (let j = 0; j < u.h; j += 1) for (let i = 0; i < u.w; i += 1) if (inMap(st.x + i, st.y + j)) owner.set(idx(st.x + i, st.y + j), st);
    const open = (c: number) => occ[c] === FREE || occ[c] === CLEAR || occ[c] === WALLB || occ[c] === ROAD || occ[c] === PLAZAC || (occ[c] === PROP && owner.has(c));
    const doorFrontsSet = new Set(doorFronts.map((d) => idx(d.x, d.y)));
    const dropProps = (cells: number[]) => {
      const drop = new Set<Stamp>();
      for (const c of cells) { const o = owner.get(c); if (o) drop.add(o); }
      const asked = new Set(cells), stray: number[] = [];
      for (const st of drop) {
        const u = undo.get(st)!;
        for (let j = 0; j < u.h; j += 1) for (let i = 0; i < u.w; i += 1) { const x = st.x + i, y = st.y + j; if (!inMap(x, y)) continue; const c = idx(x, y);
          for (const Lr of [1, 2, 3, 4] as const) setLayerTileAt(mw, Lr, c, u.layers[Lr - 1]![j * u.w + i]!);
          if (occ[c] === PROP) { occ[c] = FREE; if (!asked.has(c)) stray.push(c); } owner.delete(c); }
        for (const [c, ow] of shadowOwner) if (ow === st) { setLayerTileAt(mw, 2, c, -1); shadowOwner.delete(c); }
        undo.delete(st); stamps.splice(stamps.indexOf(st), 1); if (treeKits.has(st.kit)) treeCount -= 1;
      }
      // 걷어 낸 소품이 길 밖으로 걸친 칸: 찍기 전 1층을 되돌리면 그 사이 바뀐 땅(지운 옛 길의 가장자리)이 되살아난다
      // (2026-10-22 VQA r7: 남문 새 길 옆 열에 길 가장자리가 번지고 그 위에 들꽃) — 바닥 재료로 다시 칠한다
      if (stray.length) { if ("mat" in spec.base) for (const c of stray) fill({ x: c % W, y: Math.floor(c / W), w: 1, h: 1 }, spec.base.mat); else paintCells(stray, spec.base); }
    };
    // 길 재료로 칠한다(가장자리 오토타일이 이어진다) — 길 칸 하나를 복사하면 네모 판석이 줄지어 보였다(r4)
    const paveCells = (cells: number[]) => {
      const fresh = cells.filter((c) => occ[c] !== ROAD && occ[c] !== PLAZAC);
      if (!fresh.length) return;
      for (const c of fresh) { for (const Lr of [2, 3, 4] as const) setLayerTileAt(mw, Lr, c, -1); occ[c] = ROAD; }
      // 정확한 칸만(틈 메우기 끔) — 틈 메우기가 새 길 옆 길 아닌 칸에 길 가장자리를 번지게 했고 그 위에 들꽃이 남았다(2026-10-22 VQA r7, 남문 새 길)
      paintCells(fresh, spec.road, true);
    };
    let southSpur: { x: number; from: number } | null = null;
    for (const side of gateSides) {
      const rows = bandRows(side);
      const cand = runs(W, (x) => rows.some((y) => roadAt(x, y)), L.x0 + 1, L.x1 - 1)
        .map(([a, b]) => ({ gx: Math.max(gxMin, Math.min(gxMax, b - a + 1 >= 2 ? a + Math.floor((b - a - 1) / 2) : a)), a, b }))
        .filter((r) => r.gx <= r.b && r.gx + 1 >= r.a) // 성문 통로가 그 길에 걸쳐야 한다(모서리에 붙은 길은 성문이 못 된다)
        .sort((p, q) => Math.abs(p.gx + 1 - W / 2) - Math.abs(q.gx + 1 - W / 2));
      // 가운데에서 폭의 12% 안에 지나는 길이 있으면 그 길이 성문. 아니면 가운데 쪽으로 새 길을 먼저 내 보고(실측: 남동 모서리 곁 성문), 못 내면 그 길을 쓴다.
      if (cand[0] && Math.abs(cand[0].gx + 1 - W / 2) <= W * 0.12) { gates.push({ side, x: cand[0].gx }); continue; }
      // 가운데에서 가까운 두 열 중 안쪽 길에서 맵 끝까지 빈 곳에 길을 낸다
      const cols = [...Array(W).keys()].filter((x) => x >= gxMin && x <= gxMax && (!cand[0] || Math.abs(x + 1 - W / 2) <= W * 0.12)).sort((p, q) => Math.abs(p + 1 - W / 2) - Math.abs(q + 1 - W / 2));
      let made = false;
      for (const cx of cols) {
        let top = -1;
        // 한 칸 폭 오솔길(설원·사막)도 잇는다 — 두 칸 모두 길이어야 하면 설원 마을 남문이 남동 모서리 곁으로 밀렸다(2026-10-22 r8)
        if (side === "S") { for (let y = L.y1 - 3; y > L.y0 + 6; y -= 1) if (roadAt(cx, y) || roadAt(cx + 1, y)) { top = y; break; } }
        else for (let y = L.y0 + 7; y < L.y1 - 2; y += 1) if (roadAt(cx, y) || roadAt(cx + 1, y)) { top = y; break; }
        if (top < 0) continue;
        const cells: number[] = [];
        const ys = side === "S" ? [...Array(H - top - 1).keys()].map((i) => top + 1 + i) : [...Array(top).keys()];
        let ok = true;
        for (const y of ys) for (const x of [cx, cx + 1]) { const c = idx(x, y); if (!open(c) || (lv[c] ?? 0) !== 0) ok = false; cells.push(c); }
        if (!ok) continue;
        dropProps(cells); paveCells(cells);
        if (side === "S") southSpur = { x: cx, from: top + 1 };
        gates.push({ side, x: cx }); made = true; break;
      }
      if (!made && cand[0]) { gates.push({ side, x: cand[0].gx }); made = true; }
      if (!made) warnings.push(`${side === "S" ? "남" : "북"}쪽 성문루 자리를 못 찾았다 — 안쪽 길에서 맵 끝까지 빈 두 칸 줄이 없다.`);
    }
    if (options.wallSideGaps === true) for (const side of ["W", "E"] as const) {
      const x = side === "W" ? L.x0 : L.x1;
      for (const [a, b] of runs(H, (y) => roadAt(x, y), L.y0 + 2, L.y1 - 1)) {
        // 쪽문 문루(윗면이 길 위 두세 줄까지 올라간다)가 모서리 망루(북 y0−2..y0+6, 남 y1−2..)와 겹치지 않게 — 모서리에 붙은 길은 성벽이 막는다(r18)
        if (a < L.y0 + 10 || b > L.y1 - 4) continue;   // r19: 남쪽 모서리 망루(y1−2 부터)와 한 줄 이상 띄운다
        if (gaps.some((g) => g.side === side && a - 4 <= g.y + g.rows)) continue;
        gaps.push({ side, y: a, rows: b - a + 1 });
      }
    }
    // 남기는 길: 성문 통로 두 열(성문 머리 한 줄 위부터 맵 끝까지), 틈 줄(성벽 열부터 맵 끝까지). 그 밖에 성벽 띠·성벽 밖의 길은 풀밭으로.
    const keep = new Set<number>();
    for (const g of gates) {
      const yw = g.side === "S" ? L.y1 : L.y0;
      const ys = g.side === "S" ? [...Array(H - (yw - 2)).keys()].map((i) => yw - 2 + i) : [...Array(yw + 8).keys()];
      const cells = ys.filter((y) => inMap(0, y)).flatMap((y) => [idx(g.x, y), idx(g.x + 1, y)]);
      dropProps(cells); paveCells(cells); for (const c of cells) keep.add(c);
    }
    for (const g of gaps) for (let y = g.y; y < g.y + g.rows; y += 1) for (let x = 0; x < W; x += 1) if (g.side === "W" ? x <= L.x0 + 1 : x >= L.x1 - 1) keep.add(idx(x, y));
    const cut: number[] = [];
    for (let c = 0; c < W * H; c += 1) {
      if (occ[c] !== ROAD && occ[c] !== PLAZAC) continue;
      const x = c % W, y = (c - x) / W;
      if (keep.has(c) || !(x <= L.x0 + 1 || x >= L.x1 - 1 || y <= L.y0 + 5 || y >= L.y1)) continue;
      cut.push(c);
    }
    if (cut.length) {
      // 끊긴 길 수: 성벽 띠를 지나던 길 줄기
      const seen = new Set<number>();
      for (const c of cut) { if (seen.has(c)) continue; blockedRoads += 1; const q = [c]; seen.add(c);
        for (let h = 0; h < q.length; h += 1) { const d = q[h]!, x = d % W; for (const n of [d - 1, d + 1, d - W, d + W]) if (n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1 && !seen.has(n) && cut.includes(n)) { seen.add(n); q.push(n); } } }
      for (const c of cut) occ[c] = WALLB;
      // 끊긴 길이 성벽 앞에서 토막으로 끝나지 않게(2026-10-22 조수 시험 판정 「길이 성벽에 막혀 갈 곳을 잃는다」):
      // 성벽 띠에 닿은 끊긴 줄기를 안쪽으로 따라가며, 옆으로 갈라지는 길·문 앞·광장이 나올 때까지 지운다.
      const doorFront = new Set(doorFronts.map((d) => idx(d.x, d.y)));
      const isRoad = (x: number, y: number) => inMap(x, y) && occ[idx(x, y)] === ROAD;
      const trimmed: number[] = [];
      const trimRun = (cells: (k: number) => [number, number][], side: (k: number) => [number, number][], k0: number, step: number, kEnd: number) => {
        for (let k = k0; k !== kEnd; k += step) {
          const line = cells(k);
          if (!line.every(([x, y]) => isRoad(x, y) && !doorFront.has(idx(x, y)) && !keep.has(idx(x, y)))) return;
          if (side(k).some(([x, y]) => inMap(x, y) && (occ[idx(x, y)] === ROAD || occ[idx(x, y)] === PLAZAC))) return; // 갈림목
          const next = cells(k + step);
          if (!next.some(([x, y]) => isRoad(x, y) || (inMap(x, y) && occ[idx(x, y)] === PLAZAC))) return; // 안쪽이 끊겼으면 손대지 않는다
          for (const [x, y] of line) { occ[idx(x, y)] = WALLB; trimmed.push(idx(x, y)); }
        }
      };
      const cutSet = new Set(cut);
      const spans = (hit: (i: number) => boolean, lo: number, hi: number) => runs(hi + 1, hit, lo, hi);
      for (const [a, b] of spans((y) => cutSet.has(idx(L.x0 + 1, y)), L.y0 + 2, L.y1 - 1))
        trimRun((x) => [...Array(b - a + 1).keys()].map((i) => [x, a + i]), (x) => [[x, a - 1], [x, b + 1]], L.x0 + 2, 1, L.x1 - 2);
      for (const [a, b] of spans((y) => cutSet.has(idx(L.x1 - 1, y)), L.y0 + 2, L.y1 - 1))
        trimRun((x) => [...Array(b - a + 1).keys()].map((i) => [x, a + i]), (x) => [[x, a - 1], [x, b + 1]], L.x1 - 2, -1, L.x0 + 2);
      for (const [a, b] of spans((x) => cutSet.has(idx(x, L.y0 + 5)), L.x0 + 2, L.x1 - 2))
        trimRun((y) => [...Array(b - a + 1).keys()].map((i) => [a + i, y]), (y) => [[a - 1, y], [b + 1, y]], L.y0 + 6, 1, L.y1 - 1);
      for (const [a, b] of spans((x) => cutSet.has(idx(x, L.y1)), L.x0 + 2, L.x1 - 2))
        trimRun((y) => [...Array(b - a + 1).keys()].map((i) => [a + i, y]), (y) => [[a - 1, y], [b + 1, y]], L.y1 - 1, -1, L.y0 + 6);
      const repaint = [...cut, ...trimmed];
      if ("mat" in spec.base) for (const c of repaint) fill({ x: c % W, y: Math.floor(c / W), w: 1, h: 1 }, spec.base.mat);
      else paintCells(repaint, spec.base);
    }
    // 성문 길이 마을 길망에 닿게(2026-10-22 r3: 끊긴 길을 줄기째 지우자 성문 안쪽 두 칸 길만 섬처럼 남았다):
    // 성문 머리 위 칸에서 성벽 안쪽 길·광장까지 빈 땅으로 가장 짧은 길을 찾아 두 칸 폭으로 깐다(걷어 낼 수 있는 소품만 치움).
    for (const g of gates) {
      const inner = g.side === "S" ? L.y1 - 2 : L.y0 + 7, dir = g.side === "S" ? -1 : 1;
      const target = (c: number) => (occ[c] === ROAD || occ[c] === PLAZAC) && !keep.has(c);
      const inside = (x: number, y: number) => x > L.x0 + 1 && x < L.x1 - 2 && y > L.y0 + 6 && y < L.y1 - 1;
      const starts = [idx(g.x, inner), idx(g.x + 1, inner)];
      if ([g.x - 1, g.x, g.x + 1, g.x + 2].some((x) => inMap(x, inner + dir) && target(idx(x, inner + dir))) || [g.x - 1, g.x + 2].some((x) => target(idx(x, inner)))) continue;
      const prev = new Map<number, number>(); const q = [...starts]; for (const c of starts) prev.set(c, -1);
      let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[0, dir], [-1, 0], [1, 0], [0, -dir]] as const) { const nx = x + dx, ny = y + dy; if (!inside(nx, ny) || !inside(nx + 1, ny)) continue;
          const n = idx(nx, ny); if (prev.has(n)) continue;
          if (target(n) || target(idx(nx + 1, ny))) { prev.set(n, c); hit = n; break; }
          if (!open(n) || !open(idx(nx + 1, ny)) || (lv[n] ?? 0) !== 0 || (lv[idx(nx + 1, ny)] ?? 0) !== 0 || doorFrontsSet.has(n)) continue;
          prev.set(n, c); q.push(n); } }
      if (hit < 0) { warnings.push(`${g.side === "S" ? "남" : "북"}문 안쪽 길을 마을 길에 잇지 못했다(빈 땅이 막혔다).`); continue; }
      const path: number[] = [];
      for (let c = prev.get(hit)!; c >= 0; c = prev.get(c)!) { path.push(c, c + 1); }
      dropProps(path); paveCells(path);
    }
    // 성벽이 끊은 길이 성벽 안에서 토막으로 남는다(2026-10-22 r3 판정 「길 끝이 목적지 없이 끊기는 토막」 — 굽은 큰길은 옆 칸이 길이라
    // 위 줄기 깎기가 갈림목으로 보고 멈췄다). 성벽 없는 같은 마을은 막다른 길이 0 이므로, 성벽 마을의 막다른 길은 성벽이 만든 것이다.
    // 도시 형태 자가 짚는 끝 줄을 한 줄씩 걷어 갈림목·문 앞·광장에 닿을 때까지 되풀이한다(성문 길·문 앞은 두고).
    {
      const front = new Set([...doorFrontsSet, ...keepRoad, ...keep]);
      // 집 문으로 가는 길은 막다른 길이어도 남긴다 — 성문 길에서 길을 따라 각 문 앞(과 그 옆 길 칸)까지 가장 짧은 줄기를 지킨다
      {
        const pathy = (c: number) => occ[c] === ROAD || occ[c] === PLAZAC;
        const prev = new Int32Array(W * H).fill(-2); const q: number[] = [];
        for (const c of keep) if (pathy(c)) { prev[c] = -1; q.push(c); }
        for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W;
          for (const n of [c - 1, c + 1, c - W, c + W]) if (n >= 0 && n < W * H && Math.abs((n % W) - x) <= 1 && prev[n] === -2 && pathy(n)) { prev[n] = c; q.push(n); } }
        for (const d of doorFronts) { const dc = idx(d.x, d.y);
          const ends = [dc, dc - 1, dc + 1, dc + W].filter((n) => n >= 0 && n < W * H && prev[n] !== -2);
          const end = ends[0]; if (end === undefined) continue;
          for (let c = end; c >= 0; c = prev[c]!) front.add(c); }
        // 길은 두 칸 폭으로 그려진다 — 지킨 줄기 옆 길 칸도 지켜야 한 칸 폭으로 깎여 풀밭처럼 그려지지 않는다(2026-10-22 VQA: 북쪽 집 문 앞이 풀로 보였다)
        // 지킨 칸과 2×2 길 덩이를 이루는 칸만 더한다 — 한 칸 폭 오솔길(설원·사막)의 곁가지·한 칸 혹은 지키지 않는다
        const sq = (x: number, y: number) => x >= 0 && y >= 0 && x + 1 < W && y + 1 < H && [idx(x, y), idx(x + 1, y), idx(x, y + 1), idx(x + 1, y + 1)].every(pathy);
        for (const c of [...front]) { const x = c % W, y = (c - x) / W;
          for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]] as const) if (sq(x + ox, y + oy))
            for (const n of [idx(x + ox, y + oy), idx(x + ox + 1, y + oy), idx(x + ox, y + oy + 1), idx(x + ox + 1, y + oy + 1)]) front.add(n); }
      }
      const peeled: number[] = [];
      for (let pass = 0; pass < 48; pass += 1) {
        const report = analyzeCityForm(draft, mw);
        const drop = new Set<number>();
        for (const d of report.deadEnds) { const cap = (d.cells ?? [d.at]).map(([x, y]) => idx(x, y));
          if (cap.some((c) => front.has(c))) continue;
          for (const c of cap) if (occ[c] === ROAD) drop.add(c); }
        if (!drop.size) break;
        for (const c of drop) { occ[c] = FREE; peeled.push(c); }
        if ("mat" in spec.base) for (const c of drop) fill({ x: c % W, y: Math.floor(c / W), w: 1, h: 1 }, spec.base.mat);
        else paintCells([...drop], spec.base);
      }
      if (peeled.length) logConstructionTiles(mw, "tidy", "성벽이 끊은 길 토막 정리");
    }
    const used = (side: "N" | "S", x0: number, x1: number) => gates.some((g) => g.side === side && x1 >= g.x - 2 && x0 <= g.x + 3);
    const towers = L.towers.filter((t) => (t.corner === true || (t.x >= L.x0 + 3 && t.x + 2 <= L.x1 - 3)) && !used(t.side, t.x - 1, t.x + 3)
      && [0, 1, 2].every((i) => [...Array(9).keys()].every((j) => { const y = (t.side === "S" ? L.y1 : L.y0) - 2 + j; return !roadAt(t.x + i, y) && (!inMap(t.x + i, y) || occ[idx(t.x + i, y)] === WALLB); })));
    const stairs: number[] = [];
    // 옆 계단 3×4(x..x+2, 북쪽 앞면 네 줄): 왼쪽 아래(x, y0+5)에서 땅(x, y0+6 → y0+7)으로 내려선다
    const stairOk = (x: number) => x > L.x0 + 2 && x + 2 < L.x1 - 2 && !used("N", x - 1, x + 3) && !towers.some((t) => t.side === "N" && x <= t.x + 3 && x + 2 >= t.x - 1)
      && !stairs.some((s) => Math.abs(s - x) < 6) && [FREE, ROAD, PLAZAC, CLEAR].includes(occ[idx(x, L.y0 + 7)]!) && (lv[idx(x, L.y0 + 7)] ?? 0) === 0;
    // 계단 자리도 seed 로(늘 양 끝 대칭 둘이면 마을마다 같은 틀로 보였다, r8)
    const sh = (k: number) => (Math.imul((seed | 0) + k * 7919, 2654435761) >>> 0);
    const STAIR_SETS = [[0.1 + (sh(1) % 34) / 100, 0.56 + (sh(2) % 34) / 100], [0.1 + (sh(3) % 70) / 100]];
    for (const want of STAIR_SETS[sh(4) % 3 === 0 ? 1 : 0]!.map((f) => Math.round(W * f) - (f > 0.5 ? 2 : 0))) for (let d = 0; d <= 6; d += 1) { const x = want + (d % 2 ? -1 : 1) * Math.ceil(d / 2); if (stairOk(x)) { stairs.push(x); break; } }
    // 원하는 자리가 다 막혔으면 가운데에서 바깥으로 훑어 하나는 둔다(성벽 위로 오를 길이 없으면 망루가 장식이 된다)
    if (!stairs.length) for (let d = 0; d < W; d += 1) { const x = (W >> 1) + (d % 2 ? -1 : 1) * Math.ceil(d / 2); if (stairOk(x)) { stairs.push(x); break; } }
    const plan: TownWallPlan = { x0: L.x0, y0: L.y0, x1: L.x1, y1: L.y1, gates, gaps, towers, stairs };
    // 성문 통로 두 칸의 바닥은 길로(폭 1 길이면 옆 칸도), 성문 앞뒤 한 칸도 길에 잇는다
    const roadTile = (() => { for (let c = 0; c < W * H; c += 1) if (occ[c] === ROAD) return mw.lowerTiles[c]!; return -1; })();
    for (const g of gates) {
      const yw = g.side === "S" ? L.y1 : L.y0;
      for (let cy = -2; cy <= 7; cy += 1) for (const cx of [g.x, g.x + 1]) {
        const y = yw + cy; if (!inMap(cx, y)) continue; const c = idx(cx, y);
        if (occ[c] !== ROAD && occ[c] !== PLAZAC && roadTile >= 0) { mw.lowerTiles[c] = roadTile; setLayerTileAt(mw, 2, c, -1); setLayerTileAt(mw, 3, c, -1); setLayerTileAt(mw, 4, c, -1); occ[c] = ROAD; }
      }
    }
    stampTownWall(mw, plan, theme === "snow" ? "snow" : theme === "desert" ? "desert" : null);
    logConstructionTiles(mw, "stamp", "성벽 둘레", { major: true });
    if (blockedRoads) warnings.push(`성벽이 길 ${blockedRoads}곳을 막았다(모서리·성문 곁에 붙은 길).`);
    wallInfo = { gates, gaps, towers, stairs, blockedRoads, ...(southSpur ? { southGateRoad: southSpur } : {}) };
  }

  // ---------- 13. 문 앞 도달(입구 = 큰길 서쪽 끝) ----------
  const m = draft.maps[mapId]!;
  const pass = (t: number) => { if (t < 0) return true; const p = ts.passability?.[t]; return !p || p.up || p.down || p.left || p.right; };
  const walk = (x: number, y: number) => inMap(x, y) && pass(m.lowerTiles[idx(x, y)]!) && pass(m.upperTiles[idx(x, y)]!);
  // 입구: 큰길 서쪽 끝(물가 띠 마을은 들길 동쪽 끝)
  // 성벽 마을의 입구는 첫 성문루 바깥 끝(남문이면 맵 아래 끝, 북문이면 위 끝) — 다른 길은 성벽이 끊었다
  const gate0 = wallInfo?.gates[0];
  const entrance = gate0 ? { x: gate0.x, y: gate0.side === "S" ? H - 1 : 0 }
    : codePlan?.entrance ? codePlan.entrance
    : form === "riverbank" && entryLane ? { x: W - 1, y: yAt(entryLane, W - 1) ?? yMainBase } : { x: 0, y: yMainAt(0) };
  const startY = entrance.y;
  const reachMap = (): Uint8Array => {
    const seen = new Uint8Array(W * H); const q: number[] = [];
    for (let o = 0; o < 2; o += 1) if (walk(entrance.x, startY + o)) { seen[idx(entrance.x, startY + o)] = 1; q.push(idx(entrance.x, startY + o)); }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy;
        if (walk(nx, ny) && !seen[idx(nx, ny)] && reliefAllowsStep(m.relief, x, y, nx, ny)) { seen[idx(nx, ny)] = 1; q.push(idx(nx, ny)); } } }
    return seen;
  };
  // 갇힌 빈터 열기(2026-10-11 「고립을 방지하라」): 높은 단 위 걸을 수 있는 칸이 집 뒤·나무 사이에 갇혀 입구에서 못 닿으면,
  // 그 빈터와 닿는 쪽 사이를 막은 나무·덤불·소품(기록하지 않은 찍기) 중 가장 작은 것을 걷어 낸다(찍기 전 네 층과 그 그림자를 되돌린다). 없어질 때까지.
  // 집·큰 건물 키트 사각형 안의 투명 귀퉁이 칸(박공 지붕 위 모서리)은 지붕 그림에 속한다 — 단 위 땅으로 세지 않는다
  // (실측: 포구 길가 88×56 seed 11 — 오르막 바로 옆 집 지붕 귀퉁이 한 칸이 절벽·경사로 옆구리·지붕에 둘러싸여 「못 닿는 단 위 칸」으로 셌다)
  const bldRect = new Set<number>();
  for (const st of stamps) if (st.v === BLD) { const k = kitIndex.get(st.kit); if (k) for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (inMap(st.x + i, st.y + j)) bldRect.add(idx(st.x + i, st.y + j)); }
  let opened = 0;
  // 평지 마을도 같다(2026-10-28 jrpg 버들마을: 밀밭 울타리·허수아비·나무가 북쪽 초원의 유일한 입구를 막아 초원 한 덩이가 통째로 갇혔다).
  // 높은 단이 아니면 여섯 칸 이상 덩이만 연다 — 숲 가장자리 나무 틈 한두 칸 때문에 숲을 갉지 않게.
  const lostOf = (seen: Uint8Array): Set<number> => {
    const cand = new Set<number>();
    for (let c = 0; c < W * H; c += 1) if (!seen[c] && !fenceInside.has(c) && !bldRect.has(c) && occ[c] !== WATERC && walk(c % W, Math.floor(c / W))) cand.add(c);
    const out = new Set<number>(); const done = new Set<number>();
    for (const c0 of cand) {
      if (done.has(c0)) continue;
      const comp = [c0]; done.add(c0);
      for (let h = 0; h < comp.length; h += 1) { const c = comp[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny); if (cand.has(n) && !done.has(n)) { done.add(n); comp.push(n); } } }
      if (comp.length >= 6 || comp.some((c) => lv[c]! > 0)) for (const c of comp) out.add(c);
    }
    return out;
  };
  for (let it = 0; it < 60; it += 1) {
    const seen = reachMap();
    const lost = lostOf(seen);
    if (!lost.size) break;
    // 닿는 칸에서 갇힌 칸까지, 걷어 낼 찍기를 가장 적게 지나는 길(0-1 BFS: 빈 땅 0, 걷어 낼 찍기에 들어갈 때 1)
    const owner = new Map<number, Stamp>();
    for (const [st, u] of undo) for (let j = 0; j < u.h; j += 1) for (let i = 0; i < u.w; i += 1) if (inMap(st.x + i, st.y + j)) owner.set(idx(st.x + i, st.y + j), st);
    const dist = new Int32Array(W * H).fill(1 << 30), prev = new Int32Array(W * H).fill(-1); const dq: number[] = []; let head = 0;
    const deque: number[] = []; // 다음 비용 단계(걷어 낼 찍기를 하나 더 지나는 칸)
    for (let c = 0; c < W * H; c += 1) if (seen[c]) { dist[c] = 0; dq.push(c); }
    let hit = -1;
    for (let round = 0; round < 8 && hit < 0; round += 1) {
      while (head < dq.length && hit < 0) {
        const c = dq[head++]!; const x = c % W, y = (c - x) / W;
        if (lost.has(c)) { hit = c; break; }
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
          const on = owner.get(n);
          if (!on && !walk(nx, ny)) continue;
          if (!reliefAllowsStep(m.relief, x, y, nx, ny)) continue;
          const cost = on && on !== owner.get(c) ? 1 : 0;
          const nd = dist[c]! + cost; if (nd >= dist[n]!) continue;
          dist[n] = nd; prev[n] = c; (cost ? deque : dq).push(n);
        }
      }
      if (hit >= 0) break;
      dq.push(...deque.splice(0)); // 다음 비용 단계
    }
    if (hit < 0) break;
    const drop = new Set<Stamp>(); for (let t = hit; t >= 0; t = prev[t]!) { const on = owner.get(t); if (on) drop.add(on); }
    if (!drop.size) break;
    for (const best of drop) {
      const u = undo.get(best)!;
      for (let j = 0; j < u.h; j += 1) for (let i = 0; i < u.w; i += 1) { const x = best.x + i, y = best.y + j; if (!inMap(x, y)) continue; const c = idx(x, y);
        for (const L of [1, 2, 3, 4] as const) setLayerTileAt(m, L, c, u.layers[L - 1]![j * u.w + i]!);
        if (occ[c] === PROP || occ[c] === FIELD) occ[c] = FREE; }
      for (const [c, ow] of shadowOwner) if (ow === best) { setLayerTileAt(m, 2, c, -1); shadowOwner.delete(c); }
      undo.delete(best); stamps.splice(stamps.indexOf(best), 1); if (treeKits.has(best.kit)) treeCount -= 1;
      opened += 1;
    }
  }
  const seen = reachMap();
  const unreached = doorFronts.filter((d) => !seen[idx(d.x, d.y)]);
  if (unreached.length) warnings.push(`입구에서 닿지 않는 문 앞 ${unreached.length}곳: ${unreached.slice(0, 5).map((d) => `${d.kit}@(${d.x},${d.y})`).join(", ")}`);
  // 울타리 문·단마다 걸을 수 있는 칸 중 입구에서 닿는 몫(단 위의 밭·쓰임이 배경으로 남지 않았는지)
  const gateInfo = fenceGates.map((c) => ({ x: c % W, y: Math.floor(c / W), level: lv[c]!, reached: !!seen[c] }));
  const gatesUnreached = gateInfo.filter((g) => !g.reached);
  if (gatesUnreached.length) warnings.push(`입구에서 닿지 않는 울타리 문 ${gatesUnreached.length}곳: ${gatesUnreached.slice(0, 4).map((g) => `(${g.x},${g.y}) ${g.level}단`).join(", ")}`);
  // wild = 일부러 오를 길 없이 둔 산 숲·숲 덩이 칸(산비탈 맨 윗단 등) — 못 닿는 칸으로 세지 않고 따로 센다(「숲이면 의도 표시」)
  const levelReach: Record<string, { walk: number; reached: number; wild: number }> = {};
  const upperLost: { x: number; y: number; level: number }[] = []; // 못 닿는 높은 단 칸(앞 8개) — 프로브가 자리를 짚는다
  if (hasTerrain) for (let c = 0; c < W * H; c += 1) {
    const L = lv[c]!; if (L === 0 || fenceInside.has(c) || bldRect.has(c) || !walk(c % W, Math.floor(c / W))) continue;
    const e = (levelReach[L] ??= { walk: 0, reached: 0, wild: 0 });
    if (!seen[c] && (summit.has(c) || occ[c] === FOREST)) { e.wild += 1; continue; }
    e.walk += 1; if (seen[c]) e.reached += 1;
    else if (upperLost.length < 8) upperLost.push({ x: c % W, y: Math.floor(c / W), level: L });
  }

  const distinct = new Set(placedHouses.map((h) => h.id)).size;
  function skeletonText(): string {
    const side = streets.length - 1;
    if (codePlan) return `코드 지형 위 ${codePlan.report.auto ? "자동 배치" : "조수 배치"} — 큰길 ${streets.filter((s0) => s0.name === "큰길").length}토막·골목 ${streets.filter((s0) => s0.name !== "큰길").length}토막${form === "plaza" ? `, 광장(${plazaX},${Math.round(plazaCy)})` : ""}${fordStones.length ? `, 널다리 ${fordStones.length}칸` : ""}`;
    if (form === "riverbank") return `강 동쪽 둑을 따라 남북 둑길(폭 2)·뒷길 고리·동쪽 들길(입구)${ferry ? `, 나루(${ferry.x},${ferry.y})와 나룻배·건너편 들길` : ""}`;
    if (form === "scatter") return `${"mat" in spec.road ? "모랫길 " : ""}오솔길(폭 1)·갈래길 ${side}개, 집 사이 4~8칸`;
    return `큰길 하나(굽은 폭 2)·${side}개 갈래길${form === "plaza" ? `, 광장(${plazaX},${Math.round(plazaCy)})` : ", 광장 없음"}`;
  }
  const streetNames = streets.map((s) => s.name);
  return {
    summary: `${terrainSwapped ? `${terrainNote} ` : ""}버들항 ${spec.label} · ${FORM_LABEL[form]}(form ${form}) · 지형 ${TERRAIN_LABEL[terrain.name]}(terrain ${terrain.name}${terrain.name !== terrainName ? `, 요청 ${terrainName} → ${terrain.note}` : hasTerrain ? `, ${terrain.note}, 길 경사로 ${rampCount}곳` : ""}) ${W}×${H} (맵 ${mapId}, seed ${seed}): ${skeletonText()}, 모이는 곳 = ${gather.why}${gatherDoor ? `(${gatherDoor.x},${gatherDoor.y})` : "(자리 없음)"}, ` +
      `집 ${placedHouses.length}채(${distinct}종${roofs ? `, 지붕 ${ROOF_PALETTE_LABEL[roofs]}(roofs ${roofs})` : ""})${anchors.length ? `, 앵커 ${anchors.map((a) => a.replace(/^bd-(pick-|house-)/, "")).join("·")}` : ""}` +
      `${workAt ? `, 일터 「${workAt.name}」` : ""}, 밭 ${fields}${fenceAt.size ? `(울타리 ${fenceAt.size}칸)` : ""}, 나무 ${treeCount}, ${form === "plaza" ? "광장" : "모이는 곳"} 소품 ${plazaProps}. 문 앞 ${doorFronts.length - unreached.length}/${doorFronts.length} 도달. ` +
      (wallInfo ? `성벽 둘레: 성문루 ${wallInfo.gates.length}·틈 ${wallInfo.gaps.length}·망루 ${wallInfo.towers.length}·계단 ${wallInfo.stairs.length}(data.walls). ` : "") +
      (codePlan ? `배치 검사: 집 ${placedHouses.length}/${codePlan.report.requested.houses}채 앉음${codePlan.report.moved.length ? ` · 옮김 ${codePlan.report.moved.length}(${codePlan.report.moved.slice(0, 4).join(", ")})` : ""}${codePlan.report.failed.length ? ` · 못 놓음 ${codePlan.report.failed.length}(${codePlan.report.failed.slice(0, 4).join("; ")})` : ""}${codePlan.report.roadsFailed.length ? ` · 길 못 냄 ${codePlan.report.roadsFailed.length}(${codePlan.report.roadsFailed.slice(0, 3).join(", ")})` : ""}. ` : "") +
      "다음: check_city_form·check_reachability 로 점검하고, NPC·출입구 이벤트는 문 앞 칸(data.doors)에 얹는다.",
    data: {
      mapId, width: W, height: H, seed, theme, form, ...(roofs ? { roofs } : {}), ...(water ? { water } : {}), ...(denseWoods ? { woods: "dense" } : {}), tilesetId: TS_ID,
      streets: streetNames, ...(form === "plaza" ? { plaza: { x: plazaX, y: Math.round(plazaCy), rx: prx, ry: pry } } : {}),
      gathering: { why: gather.why, ...(gatherDoor ? { door: gatherDoor } : {}) }, fenceCells: fenceAt.size, ...(ferry ? { ferry } : {}), ...(ford ? { ford: { x: ford.x, y: ford.top, stones: fordStones.length } } : {}),
      anchors, work: workAt, ...(coastWork.length ? { coastWork } : {}), houses: placedHouses.length, distinctHouses: distinct,
      doors: doorFronts.map((d) => ({ kit: d.kit, x: d.x, y: d.y, reached: !!seen[idx(d.x, d.y)] })),
      fenceGates: gateInfo, levelReach, ...(upperLost.length ? { upperLost } : {}), opened,
      ...(bridge ? { bridge } : {}), ...(millBridge ? { millBridge } : {}), fields, trees: treeCount, filler, stamped, stampFailed: failed, nature: natureStats,
      terrain: terrain.name, ...(hf && !hfFlat ? { landform: hf.landform, settle: hf.settle, tiers: hf.tiers, high: hf.high } : { landform: "flat", ...(hfFlat ? { settle: "low" } : {}) }), ...(requestedTerrain !== null ? { requestedTerrain, terrainSwapped } : {}), ...(reliefInfo ? { relief: reliefInfo } : {}),
      upper: climbs.map((cl) => ({ level: cl.level, lanes: cl.lanes, path: cl.path, to: cl.to, use: cl.use, ...(cl.lookout ? { lookout: cl.lookout } : {}),
        reach: levelReach[cl.level] ? Math.round((levelReach[cl.level]!.reached / Math.max(1, levelReach[cl.level]!.walk)) * 100) : 0 })),
      entrance, ...(wallInfo ? { walls: wallInfo } : {}),
      ...(codePlan && codeT ? { codeTerrain: { character: codeT.character, high: codeT.high, maxLevel: codeT.maxLevel, note: codeT.note }, layout: { ...codePlan.layout, auto: codePlan.report.auto, gather: codePlan.g, moved: codePlan.report.moved, failed: codePlan.report.failed, roadsFailed: codePlan.report.roadsFailed, placedHouses: placedHouses.length, requestedHouses: codePlan.report.requested.houses } } : {}),
    },
    warnings,
  };
}

/** 허용·검수 통과 건물 묶음(beodeulReviewed bd-house-rv-* · beodeulMassing bd-house-mk-*): 본체 id 머리 → 그림자·기초 id 머리. */
const REVIEWED_SETS = [
  { house: "bd-house-rv-", shadow: "bd-rv-shadow-", foundation: "bd-rv-foundation-" },
  { house: "bd-house-mk-", shadow: "bd-mk-shadow-", foundation: "bd-mk-foundation-" },
] as const;
function reviewedPrefix(kitId: string): (typeof REVIEWED_SETS)[number] | undefined { return REVIEWED_SETS.find((r) => kitId.startsWith(r.house)); }
/** 허용 건물은 본체(3층)와 같은 원점에 바닥 그림자(2층 *-shadow-*)·기초(4층 *-foundation-*)를 함께 놓는다(beodeulReviewed 배치 규칙). */
function stampReviewedCompanions(map: import("@/project/types").GameMap, ts: TilesetDef, kitId: string, x0: number, y0: number): void {
  const set = reviewedPrefix(kitId);
  if (!set) return;
  const id = kitId.slice(set.house.length);
  for (const [prefix, layer] of [[set.shadow, 2], [set.foundation, 4]] as const) {
    const kit = (ts.structureKits ?? []).find((k) => k.id === prefix + id);
    if (!kit) continue;
    kit.rows.forEach((row, j) => (row.upperTiles ?? []).forEach((t, i) => {
      const x = x0 + i, y = y0 + j;
      if (t >= 0 && x >= 0 && y >= 0 && x < map.width && y < map.height && layerTileAt(map, layer, y * map.width + x) < 0) setLayerTileAt(map, layer, y * map.width + x, t);
    }));
  }
}
