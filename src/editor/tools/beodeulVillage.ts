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
import { invalidateReliefSlopes, rampCode, reliefAllowsStep } from "@/project/relief/walk";
import type { ReliefData } from "@/project/relief/types";
import { planVillageTerrain, resolveVillageTerrain, TERRAIN_LABEL, VILLAGE_TERRAINS } from "./beodeulTerrain";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
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
  river: ["street", "riverbank", "scatter", "plaza"], coast: ["street", "scatter", "plaza"],
  desert: ["plaza", "scatter"], snow: ["plaza", "scatter"], swamp: ["plaza", "scatter"],
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
  feature: "river" | "coast" | "pond" | "bog";
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
const LEAF_TREES = ["bd-tree-03a8f7", "bd-tree-a80c85", "bd-tree-e9d9b3", "bd-tree-cc0fcb", "bd-tree-47e17a", "bd-tree-d43edd", "bd-tree-5844f6", "bd-tree-3e8732", "bd-tree-1a786c", "bd-tree-d61d7e", "bd-tree-7ecdb8", "bd-tree-1e09f0", "bd-tree-bdd36e", "bd-tree-b1d104"];
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
const FREE = 0, ROAD = 1, WATERC = 2, PLAZAC = 3, BLD = 4, PROP = 5, FIELD = 6, KEEP = 7, POND_RING = 8, FENCE = 9;
/** 시공 기록(constructionLog)에 싣는 계획 분류 이름 — 편집기가 밑그림 색을 고른다. */
const PLAN_CLASSES: Record<number, string> = { [ROAD]: "road", [WATERC]: "water", [PLAZAC]: "plaza", [BLD]: "building", [PROP]: "prop", [FIELD]: "field", [KEEP]: "keep", [POND_RING]: "ring", [FENCE]: "prop" };
const SAND_PATH = "버들항 모랫길";

interface Kit { id: string; w: number; h: number; door: { dx: number; dy: number } | null; def: StructureKitDef }
/** 언덕 절벽 양식(relief/styles.ts RELIEF_STYLES) — 풀밭은 잔디 둑 흙벽, 사막은 사암, 설원은 눈 둑, 늪은 이탄 둑. */
const RELIEF_STYLE: Record<BeodeulVillageTheme, string> = { river: "grass-cliff", coast: "grass-cliff", desert: "sandstone", snow: "tundra-snow", swamp: "swamp-peat" };
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
export function buildBeodeulVillage(draft: Project, mapId: string, theme: BeodeulVillageTheme, seed: number, formArg?: string, terrainArg?: string): VillageResult {
  const form = resolveVillageForm(theme, seed, formArg);
  let terrainName: ReturnType<typeof resolveVillageTerrain>;
  let terrainNote = "";
  try { terrainName = resolveVillageTerrain(theme, seed, terrainArg); } catch (e) {
    // 다른 theme 의 지형 이름(예: river 에 basin)은 거절하지 않고 이 theme 의 기본 지형으로 짓는다 — 선택 칸을 다 채워 보내는 모델이 있다
    if (!(VILLAGE_TERRAINS as readonly string[]).includes(terrainArg ?? "")) throw new ToolError((e as Error).message, { code: "invalid-args" });
    terrainName = resolveVillageTerrain(theme, seed);
    terrainNote = `${(e as Error).message} 이 theme 의 지형 ${terrainName} 으로 지었다.`;
  }
  const base = THEMES[theme];
  // 흩어진 마을의 길은 포석이 아니라 모랫길(재료 길만 — 모래·눈·늪 표본 길은 그대로 폭 1)
  const spec: ThemeSpec = form === "scatter" && "mat" in base.road ? { ...base, road: { mat: SAND_PATH } } : base;
  const fenced = "mat" in base.base; // 울타리 조각(숲 계열)은 풀밭 마을에만
  const ts: TilesetDef = draft.tilesets[TS_ID]!;
  const map0 = draft.maps[mapId]!;
  const W = map0.width, H = map0.height;
  const rand = rng(seed * 7919 + theme.length * 131 + 17);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const choice = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const warnings: string[] = terrainNote ? [terrainNote] : [];
  const openLand = theme === "desert" || theme === "snow"; // 모래·눈은 트인 땅이 자연 — 빈 덩이 40칸까지, 화면당 40%까지
  // 자연 덧그림(2026-10-11, beodeul_nature): 강·바다는 돌 둑 운하 대신 흙·풀 둑, 오아시스 풀밭은 모래 위에 둥근 가장자리로 얹는다
  const naturalWater = spec.feature === "river" || spec.feature === "coast";
  const lawnOverlay = theme === "desert";
  const lawnSet = new Set<number>(); // 오아시스 풀밭+못(나중에 나무·소품이 앉아도 가장자리 계산은 처음 모양으로)

  const kitIndex = new Map<string, Kit>();
  for (const k of ts.structureKits ?? []) {
    const ent = (k.parts ?? []).find((p) => p.kind === "entrance");
    kitIndex.set(k.id, { id: k.id, w: k.width, h: k.height, door: ent ? { dx: ent.dx, dy: ent.dy } : null, def: k });
  }
  const have = (ids: readonly string[]) => ids.filter((id) => kitIndex.has(id));
  const K = (id: string) => kitIndex.get(id)!;
  const houses = have(spec.houses).filter((id) => { const d = K(id).door; return !!d && d.dy === K(id).h - 1; });
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

  // ---------- 1. 자연 앵커 ----------
  let riverX = -1; // 강 왼쪽 열(다리 자리)
  let riverLeft = false;
  const shoreY: number[] = new Array(W).fill(H);
  const yMainBase = theme === "coast" ? Math.round(H * 0.4) : Math.round(H * 0.5) + ri(-2, 2);
  if (spec.feature === "river") {
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
  // 못·늪은 길을 정한 뒤(길을 피해서) 깐다 — 자리만 먼저 정한다(지형이 못 자리를 알아야 한다)
  const pondSide = rand() < 0.5 ? "w" : "e";
  const pondPlan = spec.feature === "pond" && spec.pond
    ? { cx: pondSide === "w" ? Math.round(W * 0.2) : Math.round(W * 0.8), cy: Math.round(yMainBase - H * 0.22) + ri(-1, 1), rx: ri(6, 8), ry: ri(4, 5) } : null;

  // ---------- 0. 지형(2026-10-11 「지형을 먼저 기획하고 그 위에 마을을」) ----------
  // 물 자리(강 곡선·해안선·못)가 정해진 지금 단 높이 격자를 만든다. 아래 모든 단계가 이 지형을 따른다:
  // 길은 단을 건너는 곳에서 매끈한 경사로로 오르고(3b), 집·밭·나무·소품은 한 단 위에만 앉고(fits), 문 앞 길은 경사로로만 단을 오른다(linkToRoad).
  const mainBase = theme === "coast"
    ? (form === "street" ? Math.min(...shoreY) - 4 : Math.max(10, Math.min(yMainBase, Math.min(...shoreY) - 9))) : yMainBase;
  const terrain = planVillageTerrain({ W, H, theme, form, seed, water: (x, y) => at(x, y) === WATERC, riverLeft, mainBase, pond: pondPlan }, terrainName);
  const lv = terrain.levels;
  const hasTerrain = lv.some((v) => v > 0);
  const rampCells = new Set<number>(); // 길 경사로 칸(코드 1~4) — 문 앞·소품 자리로 쓰지 않는다
  const ramps = new Array<number>(W * H).fill(0);
  let rel: ReliefData | null = null; // 경사로까지 정한 뒤(3b) 만든다 — 문 앞 길 찾기가 단을 안다
  let rampCount = 0, cutCells = 0, rampFails = 0;

  planStep("물 자리");
  // ---------- 2. 큰길 ----------
  const streets: Street[] = [];
  // 굽이는 완만하게: 열쇠점 사이 높이 차는 가로 거리의 1/6 이하(계단 칸이 4칸 이상 이어지게 — 2~3칸 토막은 「막다른 길」 혹이 된다).
  const easeKeys = (keys: [number, number][], along: 0 | 1) => {
    const o = 1 - along;
    for (let i = 1; i < keys.length; i += 1) {
      const span = Math.abs(keys[i]![along] - keys[i - 1]![along]); const lim = Math.floor(span / 6);
      const d = keys[i]![o] - keys[i - 1]![o]; if (Math.abs(d) > lim) keys[i]![o] = keys[i - 1]![o] + Math.sign(d) * lim;
    }
  };
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
  const wavy = (x0: number, x1: number, yBase: number, amp: number, yStart?: number, yEnd?: number): [number, number][] => {
    const keys: [number, number][] = []; let sg = rand() < 0.5 ? 1 : -1;
    keys.push([x0, yStart ?? yBase + sg * ri(1, amp)]);
    for (let x = x0 + ri(12, 16); x < x1 - 8; x += ri(12, 16)) { sg = -sg; keys.push([x, yBase + sg * ri(1, amp)]); }
    keys.push([x1, yEnd ?? yBase - sg * ri(1, amp)]);
    return keys;
  };
  const lanesWidth = form === "scatter" ? 1 : 2; // 흩어진 마을은 오솔길
  const coastStreet = theme === "coast" && form === "street";
  let mainKeys: [number, number][] = [];
  if (form === "riverbank") {
    // 둑길: 강 동쪽 둑을 따라 남북으로(강물에서 물레방아·방앗간·집 한 줄 자리를 비우고)
    let wMax = -1; for (let c = 0; c < W * H; c += 1) if (occ[c] === WATERC) wMax = Math.max(wMax, c % W);
    const rx = Math.min(W - 16, wMax + 1 + ri(9, 11));
    mainKeys = [[rx, 0]];
    for (let y = ri(12, 16), sg = rand() < 0.5 ? 1 : -1; y < H - 8; y += ri(12, 16), sg = -sg) mainKeys.push([rx + sg, y]);
    mainKeys.push([rx, H - 1]);
  } else if (theme === "coast" && form === "street") {
    // 포구 길가 마을: 큰길이 물가를 따라간다(물가 길이 곧 큰길) — 집은 바다를 보고 한 줄로 서고, 뒷길이 그 위에서 고리를 만든다
    // 물가에서 3·4·5·4칸(왔다 갔다 3·4 면 폭 2 큰길이 한 줄로 겹쳐 이어져 88칸 맵에서 48칸 곧은 길이 됐다)
    for (let x = 0, k = 0; x < W - 1; x += 12, k += 1) mainKeys.push([x, Math.min(...shoreY.slice(Math.max(0, x - 6), x + 7)) - [3, 4, 5, 4][k % 4]!]);
    mainKeys.push([W - 1, Math.min(...shoreY.slice(W - 7, W)) - 3]);
  } else if (theme === "coast") {
    const top = Math.min(...shoreY) - 9;
    const yM = Math.max(10, Math.min(yMainBase, top));
    mainKeys = wavy(0, W - 1, yM, 2);
  } else if (riverX >= 0) {
    // 다리 앞뒤(강 왼쪽 4칸 ~ 오른쪽 7칸)는 곧게
    const yc = yMainBase;
    mainKeys = [...wavy(0, riverX - 4, yc, 2, undefined, yc), ...wavy(riverX + 7, W - 1, yc, 2, yc)];
  } else {
    mainKeys = wavy(0, W - 1, yMainBase, 3);
  }
  const main = form === "riverbank" ? vStreet("둑길", mainKeys, 2) : hStreet(form === "scatter" ? "오솔길" : "큰길", mainKeys, lanesWidth);
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
  markStreet(main);
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
  const north: { s: Street; x0: number; x1: number } | null = form === "riverbank" || form === "scatter" ? null : (() => {
    // 큰길 북쪽 띠(집 한 줄, 6~8칸) + 뒷길 북쪽 띠(집 한 줄)가 들어가게: 큰길에서 10~12칸 위, 맵 위에서 7칸 아래
    const yBase = coastStreet ? (yAt(main, Math.round(W / 2)) ?? yMainBase) : yMainBase;
    // 뒷길 북쪽에 집 띠(6~8줄)가 안 들어가는 낮은 맵(포구 큰길 y≈15)이면 뒷길을 더 올려 큰길 북쪽 띠를 앵커 높이(9줄)까지 넓힌다
    const yN0 = yBase - 10 - ri(0, 2);
    const yN = yN0 >= 7 ? yN0 : Math.max(2, Math.min(7, yBase - 12));
    if (!terrain.northSeam && yBase - yN < 9) return null;
    const toWestEdge = riverX >= 0 ? !riverLeft : pondSide === "e";
    // 강이 서쪽이면 뒷길은 동쪽 둑(방앗간 자리 10칸을 비우고 동쪽 끝까지)
    const nx0 = toWestEdge ? 0 : riverLeft ? eastStart + 10 : Math.round(W * 0.3) + ri(-3, 3);
    const nx1 = toWestEdge ? Math.min(westEnd, Math.round(W * (riverX >= 0 ? 0.55 : 0.7)) + ri(-3, 3)) : W - 1;
    const nw = theme === "coast" ? 2 : 1 + (rand() < 0.4 ? 1 : 0);
    // 계단식 비탈: 뒷길은 높은 단 위에서 등고선을 따라간다 — 집은 그 북쪽, 문이 아래 마을을 본다.
    // 절벽 끝 바로 위에 길을 깔면 어색하다(2026-10-11 사용자) — 길과 절벽 끝 사이에 풀밭 한 줄(RIM_GAP)을 남긴다.
    const RIM_GAP = 1;
    const seam = terrain.northSeam;
    let [x0, x1] = [nx0, nx1];
    if (seam) {
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
      const hit = order.map((d) => xEnd0 + d).find((x) => x >= 1 && x < W - 1 && flatAt(sTop, x) && flatAt(sBot, x));
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
  } else if (form === "scatter") {
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
      const up = theme === "coast" || rand() < 0.5;
      const len = ri(9, 14);
      const keys: [number, number][] = up ? [[x, Math.max(2, y0 - len)], [x, y0]] : [[x, y0 + 1], [x, Math.min(H - 3, y0 + len)]];
      const b = vStreet("갈래길", keys, 1); markStreet(b); connectors.push(b);
    }
    junctionX = xs.length ? xs[Math.floor(xs.length / 2)]! : Math.round(W / 2);
  }
  if (form === "riverbank" || (form === "scatter" && theme !== "coast")) {
    // 위에서 뼈대를 다 깔았다
  } else if (coastStreet) {
    south = main; // 큰길이 물가 길이다 — 생선 시장·잔교·그물 터는 큰길 아래 물가에
  } else if (theme === "coast") {
    // 물가 길: 해안선 3칸 위를 따라 동서로(곶 앞에서 멈춤)
    const keys: [number, number][] = [];
    // 열쇠점 12칸마다, 물가에서 3~4칸 위로 번갈아(물가를 따라 굽고 45칸 넘게 곧지 않게)
    for (let x = 0, k = 0; x <= W - 12; x += 12, k += 1) keys.push([x, Math.min(...shoreY.slice(Math.max(0, x - 6), x + 7)) - 3 - (k % 2)]);
    keys.push([W - 10, Math.min(...shoreY.slice(W - 13, W - 7)) - 3]);
    south = hStreet("물가 길", keys, lanesWidth); markStreet(south);
    connect("포구 길", Math.round(W * 0.5) + ri(-4, 4), main, south);
    connect("포구 길", ri(4, 8), main, south);
    connect("포구 길", W - 10, main, south, "r"); // 물가 길 동쪽 끝이 막다른 길이 되지 않게
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
          const lo = Math.min(lp, lq), hi = lo + 1;
          if (Math.abs(lp - lq) > 1) { lowerSec(up > 0 ? q : p, hi); fixed = true; break; }
          // 낮은 쪽 마지막 칸 = b, 경사로 b·b−up, 아랫 층계참 b−2up, 윗 층계참 b+up. 높은 쪽으로 k칸 밀며(그만큼 길을 깎아) 곧은 자리를 찾는다.
          const b0 = up > 0 ? p : q;
          let placed = false;
          for (let k = 0; k <= 6 && !placed; k += 1) {
            const b = b0 + k * up, ps = [b - 2 * up, b - up, b, b + up];
            if (!straight(ps) || !sideFree(b) || !sideFree(b - up)) continue;
            const between = new Set(Array.from({ length: k }, (_, j) => b0 + (j + 1) * up)); // 깎을 높은 쪽 칸들
            if ([...between].some((x) => !sec.has(x) || L(x) !== hi) || L(b + up) !== hi) continue;
            if (ps.slice(0, 3).some((x) => !between.has(x) && L(x) !== lo)) continue;
            for (const x of between) lowerSec(x, lo);
            const dir = st.horizontal ? (up > 0 ? "e" : "w") : (up > 0 ? "s" : "n");
            for (const x of [b, b - up]) for (const c of sec.get(x)!) { ramps[c] = rampCode(dir); rampCells.add(c); }
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
  if (form === "plaza") {
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
  const claim = (k: Kit, x: number, y: number, v: number, record: boolean) => {
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
      set(x + i, y + j, v);
      const r = k.def.rows[j]; if (r && ((r.tiles[i] ?? -1) >= 0 || (r.upperTiles?.[i] ?? -1) >= 0) && inMap(x + i, y + j)) cover[idx(x + i, y + j)] = 1;
    }
    stamps.push({ kit: k.id, x, y, record, v });
  };
  const anchors: string[] = [];
  /** 물가에 걸치는 키트(물레방아·생선 시장): 계획 칸은 잡되 물이던 칸은 물로 남겨 물로 칠해지게 한다. */
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
  const gather: { s: Street; x: number; why: string } = (() => {
    if (form === "plaza") return { s: main, x: plazaX, why: "큰길 위 광장" };
    if (form === "riverbank") return { s: entryLane ?? main, x: Math.max(...[...main.cells].map((c) => c % W)) + 4, why: "들길이 둑길과 만나는 어귀" };
    if (form === "scatter") return { s: main, x: junctionX + (junctionX + 4 < W - 2 ? 3 : -3), why: "오솔길 갈림길" };
    if (riverX >= 0) return { s: main, x: riverLeft ? riverX + 9 : riverX - 6, why: "다리 머리" };
    if (coastStreet) return { s: main, x: Math.round(W * 0.5) + 2, why: "잔교 앞 물가 큰길" };
    if (theme === "coast") { const lane = connectors.find((c) => c.name === "포구 길"); const lx = lane ? Math.min(...[...lane.cells].map((c) => c % W)) : Math.round(W / 2); return { s: main, x: lx + 3, why: "포구 길이 큰길과 만나는 어귀" }; }
    if (spec.feature === "pond") return { s: main, x: pondSide === "w" ? Math.round(W * 0.2) + 10 : Math.round(W * 0.8) - 10, why: "못(오아시스)으로 드는 어귀" };
    return { s: main, x: 7, why: "큰길이 마을로 드는 어귀" };
  })();
  // 모이는 곳은 길이 곧은 자리(앞뒤 4칸 같은 줄)에 — 길이 꺾이는 자리에 앵커·어귀·우물을 두면 폭 2 길의 아랫줄이 2~3칸 턱으로 남는다.
  // 이미 곧으면 그대로(결과 불변).
  if (gather.s.horizontal && form !== "plaza") { // 광장 마을은 광장 맞은편 그대로
    const straightAt = (x: number) => { const y = yAt(gather.s, x); if (y === null) return false; for (let e = -4; e <= 4; e += 1) if (yAt(gather.s, x + e) !== y) return false; return true; };
    const hit = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6].map((d) => gather.x + d).find((x) => x >= 4 && x < W - 4 && straightAt(x));
    if (hit !== undefined) gather.x = hit;
  }
  let gatherDoor: { x: number; y: number } | null = null;
  {
    const cand = have(spec.anchors).filter((id) => K(id).door);
    const order = cand.map((id) => ({ id, r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.id);
    let done = false;
    // 가까운 자리부터, 안 되면 ±10칸까지(길가 집 띠가 지형·물에 좁아진 마을에서 앵커를 놓치지 않게 — 앞 자리에서 찾으면 결과는 그대로)
    // 길에 바로 붙일 자리가 없으면 1~2칸 물러앉히고 문 앞을 길로 잇는다(굽은 길이 집 밑으로 파고드는 자리·좁은 집 띠) — 바로 붙는 자리를 다 본 뒤에만
    for (const setback of [0, 1, 2]) {
      for (const off of [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10]) {
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
  if (gatherDoor && (form === "street" || form === "riverbank")) {
    const yBelow = gatherDoor.y + gather.s.width;
    const gl = lv[idx(gatherDoor.x, gatherDoor.y)]!;
    const apron = blob(gatherDoor.x, yBelow + 1, 2.6, 1.4, 0.05).filter((c) => occ[c] === FREE && lv[c] === gl && !rampCells.has(c));
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
    if (!gatherDoor) return 0;
    let n = 0;
    const spots = (k: Kit): [number, number][] => {
      const out: [number, number][] = [];
      for (let dy = 1; dy <= 4; dy += 1) for (const dx of [0, -2, 2, -3, 3, -4, 4, -5, 5]) out.push([gatherDoor!.x + dx - Math.floor(k.w / 2), gatherDoor!.y + gather.s.width + dy - k.h]);
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
  const plazaProps = form !== "plaza" ? gatherProps() : (() => {
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
      let onMain = false; for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (main.cells.has(idx(x + i, y + j))) onMain = true;
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
  if (riverX >= 0) {
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
        if (!flatCells([...east, idx(ml, fy)]) || !flatCells(west)) continue; // 나루 길은 한 단(경사로 없이 닿는다)
        for (const c of [...east, ...west]) occ[c] = ROAD;
        keepRoad.add(idx(wE + 1, fy)); if (wW > 0) keepRoad.add(idx(wW - 1, fy));
        if (boat && at(wE - 1, fy) === WATERC && at(wE - 2, fy) === WATERC) { stamps.push({ kit: boat.id, x: wE - 2, y: fy, record: false }); onWater.add(idx(wE - 1, fy)); onWater.add(idx(wE - 2, fy)); }
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
  } else if (theme === "coast") {
    // 포구: 물가 길 아래 해안에 생선 시장·잔교, 동쪽 곶에 등대, 바다에 배
    const px = Math.round(W * 0.5);
    const market = kitIndex.get("bd-pick-fishing-port-fish-market");
    // 생선 시장: 물가 길 바로 아래, 물가에 걸쳐 앉는다(포구 변형과 같다 — 좌판 앞은 물가 길에서 본다)
    if (market) for (const off of [-9, 9, -13, 13, -5, 5]) {
      const x = px + off - 3; const top = yAt(south!, px + off); if (top === null) continue;
      const y = top + 2;
      const wetBottom = Array.from({ length: market.w }, (_, i) => at(x + i, y + market.h - 1)).includes(WATERC);
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
    workAt = { x: pcx + (pondSide === "w" ? 9 : -9), y: pcy + 2, name: theme === "desert" ? "대상 마당" : theme === "snow" ? "얼음낚시터" : "고기 말림터" };
    cluster(spec.work, workAt.x, workAt.y, 5, 4);
  }
  planStep("일터");
  // ---------- 7. 집: 길의 북쪽 띠, 문이 길을 본다 ----------
  const placedHouses: { id: string; x: number; y: number }[] = [];
  const lastIds: string[] = [];
  const pickHouse = (maxW: number): Kit | null => {
    const pool = houses.filter((id) => K(id).w <= maxW && !lastIds.includes(id));
    if (!pool.length) return null;
    // 많이 쓴 키트는 덜 고른다
    const uses = (id: string) => placedHouses.filter((p) => p.id === id).length;
    const scored = pool.map((id) => ({ id, s: rand() + uses(id) * 0.6 })).sort((a, b) => a.s - b.s);
    return K(scored[0]!.id);
  };
  const isPath = (v: number) => v === ROAD || v === PLAZAC;
  const lineStreet = (s: Street) => {
    if (!s.horizontal) return;
    const xs = [...s.cells].map((c) => c % W); const xMin = Math.min(...xs), xMax = Math.max(...xs);
    let x = xMin + ri(0, 2);
    while (x < xMax - 2) {
      const k = pickHouse(9); if (!k) break;
      const d = k.door!;
      const doorX = x + d.dx; const top = yAt(s, doorX);
      if (top === null) { x += 1; continue; }
      const setback = rand() < 0.35 ? 1 : 0;
      const y = top - setback - k.h; // 문 칸 = y + d.dy (맨 아래 줄), 문 앞 = y + k.h
      const frontY = y + d.dy + 1;
      let ok = y >= 1 && fits(k, x, y, 0);
      // 이웃 건물과 1칸 띄우기(지붕 겹침 방지) — 옆 칸만 본다
      if (ok) for (let j = 0; j < k.h; j += 1) if (at(x - 1, y + j) === BLD || at(x + k.w, y + j) === BLD) { ok = false; break; }
      // 문 앞 칸은 길이거나(물러앉음 0) 빈 땅이고 그 아래가 길(물러앉음 1)
      if (ok && setback === 1 && !(at(doorX, frontY) === FREE && isPath(at(doorX, frontY + 1)) && flatCells([idx(doorX, frontY), idx(doorX, frontY + 1)]))) ok = false;
      if (ok && setback === 0 && !isPath(at(doorX, frontY))) ok = false;
      if (!ok) { x += 1; continue; }
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
        const k = pickHouse(7); if (!k) break;
        const d = k.door!;
        const frontY = y + k.h; const lx = laneX(frontY, side);
        if (lx === null || frontY >= yMax) { y += 1; continue; }
        const gap = ri(1, 2);
        const x = side < 0 ? lx - gap - k.w : lx + gap + 1;
        const doorX = x + d.dx;
        let ok = fits(k, x, y, 0);
        if (ok) for (let j = 0; j < k.h; j += 1) if (at(x - 1, y + j) === BLD || at(x + k.w, y + j) === BLD) { ok = false; break; }
        const stub: number[] = [];
        if (ok) for (let xx = Math.min(doorX, lx) + (side < 0 ? 0 : 1); xx <= Math.max(doorX, lx) - (side < 0 ? 1 : 0); xx += 1) {
          const v = at(xx, frontY); if (v !== FREE && v !== ROAD) { ok = false; break; } if (v === FREE) stub.push(idx(xx, frontY));
        }
        if (ok && !flatCells([idx(doorX, frontY), ...stub, idx(lx, frontY)])) ok = false; // 문 앞 토막 길은 한 단(이음길이 경사로인 줄 옆에 붙지 않게)
        if (!ok) { y += 1; continue; }
        claim(k, x, y, BLD, true);
        for (const c of stub) occ[c] = ROAD;
        doorFronts.push({ x: doorX, y: frontY, kit: k.id });
        placedHouses.push({ id: k.id, x, y });
        lastIds.push(k.id); if (lastIds.length > 2) lastIds.shift();
        y += k.h + (form === "scatter" ? ri(3, 6) : ri(1, 2));
      }
    }
  };
  if (form === "riverbank") {
    // 둑길·뒷길(남북)은 양옆에 문 앞 길을 내고, 이음길·들길(동서)은 북쪽 띠에 집을 앉힌다
    for (const s of streets) if (s.horizontal) lineStreet(s);
    for (const s of streets) if (!s.horizontal) lineLane(s);
  } else {
    for (const s of [main, ...(north ? [north.s] : []), ...souths]) lineStreet(s);
    for (const c of connectors) lineLane(c);
  }

  planStep("집 자리");
  // 울타리 계획: 사각 테두리 칸마다 조각 종류 — 네 모서리는 모서리 기둥(tl·tr·bl·br), 위·아래 줄은 가로, 옆은 세로.
  // 문 한 칸은 길에 가까운 변(모서리 옆 칸은 피한다)에 비우고, 문 양옆은 난간이 기둥에서 끝나는 끝 조각(endW·endE·endN·endS)이다.
  // (2026-10-11 사용자 「울타리 외곽 마감이 별로, 이어져 있다는 느낌이 안 든다」 — 옛 조각 셋은 위 모서리가 반 칸 삐져나가고 세로와 끊겼다.)
  type FenceKind = "h" | "v" | "tl" | "tr" | "bl" | "br" | "endW" | "endE" | "endN" | "endS";
  const fenceAt = new Map<number, FenceKind>();
  const planFence = (x0: number, y0: number, x1: number, y1: number, near: (c: number) => number): boolean => {
    if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H || x1 - x0 < 3 || y1 - y0 < 2) return false;
    const ring: number[] = [];
    for (let x = x0; x <= x1; x += 1) ring.push(idx(x, y0), idx(x, y1));
    for (let y = y0 + 1; y < y1; y += 1) ring.push(idx(x0, y), idx(x1, y));
    if (ring.some((c) => occ[c] !== FREE)) return false;
    if (!flatCells(ring)) return false;
    const nearCorner = (c: number) => { const x = c % W, y = (c - x) / W; return (x - x0 <= 1 || x1 - x <= 1) && (y - y0 <= 1 || y1 - y <= 1); };
    let gate = -1, best = Infinity;
    for (const c of ring) if (!nearCorner(c)) { const d = near(c); if (d < best) { best = d; gate = c; } }
    const gx = gate % W, gy = (gate - gx) / W;
    for (const c of ring) {
      if (c === gate) { occ[c] = PROP; continue; } // 문 칸: 비워 두되 나무·소품이 앉지 않게
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
      } else cluster(spec.home, x0 + Math.floor(gw / 2), y0 + gh, 2, 2);
      break;
    }
  }
  for (const h of placedHouses) {
    if (rand() > 0.5) continue;
    const k = K(h.id); const pool = have(spec.home); if (!pool.length) break;
    const p = K(choice(pool));
    for (const x of rand() < 0.5 ? [h.x + k.w + 1, h.x - p.w - 1] : [h.x - p.w - 1, h.x + k.w + 1]) {
      const y = h.y + k.h - p.h;
      if (propFits(p, x, y)) { claim(p, x, y, PROP, false); break; }
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
    for (let c = 0; c < W * H; c += 1) {
      if (occ[c] !== FREE || lv[c]! > 0) continue; const x = c % W, y = (c - x) / W; // 마른 둔덕(높은 단)은 늪물이 되지 않는다
      const reach = 3 + 1.4 * Math.sin(x / 4.3 + ph) * Math.cos(y / 3.7 + ph2);
      if (dist[c]! > reach + 0.8) { occ[c] = WATERC; pondCells.push(c); surfaceAt.set(c, spec.pond.water); }
      else if (dist[c]! > reach - 0.4) { occ[c] = WATERC; surfaceAt.set(c, spec.pond.ring!); bogRing.add(c); }
    }
  }
  const distRoad = new Int16Array(W * H).fill(99);
  { const q: number[] = []; for (let c = 0; c < W * H; c += 1) if (occ[c] !== FREE && occ[c] !== POND_RING && occ[c] !== FIELD) { distRoad[c] = 0; q.push(c); }
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

  let fields = 0;
  if (spec.field) {
    for (let t = 0; t < 140 && fields < 5; t += 1) {
      const fw = ri(5, 9), fh = ri(3, 5), x = ri(1, W - fw - 1), y = ri(1, H - fh - 1);
      let ok = true;
      for (let j = -1; j <= fh && ok; j += 1) for (let i = -1; i <= fw; i += 1) { const v = at(x + i, y + j); if (v !== FREE && v !== 255) { ok = false; break; } }
      if (ok && hasTerrain) { const fl: number[] = []; for (let j = -1; j <= fh; j += 1) for (let i = -1; i <= fw; i += 1) if (inMap(x + i, y + j)) fl.push(idx(x + i, y + j)); ok = flatCells(fl); }
      if (!ok) continue;
      // 모서리 한두 칸을 깎아 네모 판을 피한다(울타리를 두르는 밭은 깎지 않는다 — 울타리 안에 빈 귀퉁이가 남는다)
      const cut = new Set<number>(); for (const [cx, cy] of [[x, y], [x + fw - 1, y], [x, y + fh - 1], [x + fw - 1, y + fh - 1]] as const) if (rand() < 0.5) cut.add(idx(cx, cy));
      if (fenced && planFence(x - 1, y - 1, x + fw, y + fh, (c) => distRoad[c]!)) cut.clear();
      if (spec.field.kit && kitIndex.has(spec.field.kit) && fw >= K(spec.field.kit).w && fh >= K(spec.field.kit).h && rand() < 0.5) {
        const k = K(spec.field.kit); claim(k, x, y, FIELD, false);
      } else {
        for (let j = 0; j < fh; j += 1) for (let i = 0; i < fw; i += 1) {
          const c = idx(x + i, y + j); if (cut.has(c)) continue; occ[c] = FIELD;
          if (spec.field.sample) surfaceAt.set(c, spec.field.sample);
        }
        if (spec.field.decals?.length) { const d = choice(have(spec.field.decals)); for (let j = 0; j < fh; j += 1) for (let i = 0; i < fw; i += 1) if (!cut.has(idx(x + i, y + j))) { stamps.push({ kit: d, x: x + i, y: y + j, record: false }); decalAt.add(idx(x + i, y + j)); } }
      }
      fields += 1;
      cluster(spec.field.edge, x + fw + 1, y + fh - 1, 1, 1);
    }
  }
  // 숲 덩이: 길에서 3칸 이상 떨어진 빈 땅에 덩이 중심, 덩이마다 3~7그루
  const trees = have(spec.trees), shrubs = have(spec.shrubs);
  let treeCount = 0;
  const treeFits = (k: Kit, x: number, y: number, gap: number) => {
    if (!fits(k, x, y, 0, (v) => v === FREE || v === POND_RING)) return false;
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) if (distRoad[idx(x + i, y + j)]! < gap) return false;
    return true;
  };
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
  // 밀도(2026-10-11 사용자 지적 「오브젝트 밀도가 너무 높다」 두 번): 덩이 시도·크기를 줄이고 빈 땅을 더 남긴다.
  // 화면당 빈 바닥 상한도 46%→58%(모래·눈 62%→74%) — 그림자가 생겨 덜 채워도 땅이 평평해 보이지 않는다.
  for (let t = 0; t < (openLand ? 32 : 30) && trees.length; t += 1) {
    const cx = ri(1, W - 2), cy = ri(1, H - 2);
    if (at(cx, cy) !== FREE || distRoad[idx(cx, cy)]! < 3) continue;
    const n = openLand ? ri(2, 3) : ri(3, 5);
    for (let m = 0; m < n * 6; m += 1) {
      const k = K(choice(rand() < 0.75 ? trees : shrubs.length ? shrubs : trees));
      const x = cx + ri(-3, 3) - Math.floor(k.w / 2), y = cy + ri(-2, 2) - k.h + 1;
      if (treeFits(k, x, y, 2)) { claim(k, x, y, PROP, false); treeCount += 1; }
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
    const items = grove ? ri(3, 6) : ri(1, 3); const spread = grove ? 3 : 1;
    for (let m = 0; m < items * (grove ? 3 : 1) && n < items && shrubs.length; m += 1) {
      const k = K(choice(grove && trees.length && rand() < 0.6 ? trees : shrubs)); const x = cx + ri(-spread, spread), y = cy + ri(-spread, spread) - k.h + 1;
      if (treeFits(k, x, y, 1)) { claim(k, x, y, PROP, false); n += 1; } }
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
  const openShare = (x0: number, y0: number) => { let n = 0, o = 0;
    for (let y = y0; y < Math.min(H, y0 + 15); y += 1) for (let x = x0; x < Math.min(W, x0 + 20); x += 1) {
      n += 1; const c = idx(x, y), v = occ[c]!;
      if (!cover[c] && (v === FREE || v === POND_RING || v === PROP || v === BLD || (v === FIELD && !decalAt.has(c)))) o += 1; }
    return o / n; };
  for (let y0 = 0; y0 < H; y0 += 15) for (let x0 = 0; x0 < W; x0 += 20) {
    for (let t = 0; t < 200 && openShare(x0, y0) > (openLand ? 0.74 : 0.58); t += 1) {
      const x = x0 + ri(0, Math.min(19, W - 1 - x0)), y = y0 + ri(0, Math.min(14, H - 1 - y0));
      if (occ[idx(x, y)] === FREE && distRoad[idx(x, y)]! >= 2) filler += tuft(x, y, openLand);
    }
  }

  planStep("밭·숲·덤불");
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

  planStep("막다른 길 다듬기");
  // ---------- 11. 칠하기 ----------
  const map = draft.maps[mapId]!;
  const tileOf = (surf: Surface, x: number, y: number): number => {
    if ("kit" in surf) { const k = kitIndex.get(surf.kit); if (!k) return map.lowerTiles[idx(x, y)]!; const r = k.def.rows[y % k.h]!; const t = r.tiles[x % k.w]!; return t >= 0 ? t : k.def.rows[0]!.tiles[0]!; }
    return -1;
  };
  const fill = (rect: { x: number; y: number; w: number; h: number }, material: string, clearUpper?: boolean) => {
    try { fillRegionTool.run(draft, { mapId, rect, material, ...(clearUpper !== undefined ? { clearUpper } : {}) }); return true; } catch (e) { warnings.push(`칠하기 실패(${material}): ${(e as Error).message.slice(0, 80)}`); return false; }
  };
  const paintCells = (cells: Iterable<number>, surf: Surface) => {
    if ("kit" in surf) { for (const c of cells) { const x = c % W, y = (c - x) / W; map.lowerTiles[c] = tileOf(surf, x, y); map.upperTiles[c] = -1; } return; }
    // 재료: 행마다 연속 구간을 사각형으로
    const rows = new Map<number, number[]>(); for (const c of cells) { const y = Math.floor(c / W); const l = rows.get(y); if (l) l.push(c % W); else rows.set(y, [c % W]); }
    for (const [y, xs] of rows) { xs.sort((a, b) => a - b); let s = xs[0]!, p = s;
      for (let i = 1; i <= xs.length; i += 1) { const v = xs[i]; if (v === p + 1) { p = v; continue; } fill({ x: s, y, w: p - s + 1, h: 1 }, surf.mat); if (v !== undefined) { s = v; p = v; } } }
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
  for (let c = 0; c < W * H; c += 1) if (occ[c] === KEEP && (spec.feature === "river" || spec.feature === "coast")) waterMat.push(c);
  // 물·길 사이 아래 띠: 돌·잔교가 놓일 물을 먼저
  const bySurface = new Map<Surface, number[]>();
  for (const [c, s] of surfaceAt) { if (occ[c] === WATERC || occ[c] === POND_RING || occ[c] === FIELD || occ[c] === PROP) { const l = bySurface.get(s); if (l) l.push(c); else bySurface.set(s, [c]); } }
  for (const [s, cells] of bySurface) paintCells(cells, s);
  paintStep("물가·밭 바닥", spec.field?.sample ? [POND_RING, FIELD] : [POND_RING]);
  // 길 → 광장 → 물 순서: fill_region 은 「벽」과 1칸 틈을 메우므로 물이 먼저 있으면 물가 1칸 틈이 길로 메워져 혹이 생긴다
  paintCells(roadCells, spec.road);
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
  let natureStats = { overlay: 0, shadowCells: 0 };
  const treeKits = new Set([...spec.trees, ...spec.shrubs, ...(spec.pond?.ringTrees ?? [])]);
  const stampKind = (s: Stamp): string => s.v === BLD ? (anchors.includes(s.kit) ? "큰 건물" : "집")
    : treeKits.has(s.kit) ? "나무·덤불" : s.v === FIELD || decalAt.has(idx(s.x, s.y)) ? "풀꽃·밭" : "소품";
  const kindTotal = new Map<string, number>(), kindSeen = new Map<string, number>();
  for (const s of stamps) { const kind = stampKind(s); kindTotal.set(kind, (kindTotal.get(kind) ?? 0) + 1); }
  for (const s of stamps) {
    const k = kitIndex.get(s.kit); if (!k) { failed += 1; warnings.push(`키트 없음: ${s.kit}`); continue; }
    const rect = { x: s.x, y: s.y, w: k.w, h: k.h };
    const before = s.record ? captureStructureTiles(draft.maps[mapId]!, rect) : null;
    try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/${s.kit}`, mapId, x: s.x, y: s.y }); stamped += 1; }
    catch (e) { failed += 1; if (failed <= 3) warnings.push(`찍기 실패 ${s.kit}@(${s.x},${s.y}): ${(e as Error).message.slice(0, 200)}`); continue; }
    if (before) appendStructurePlacement(draft.maps[mapId]!, { kitId: s.kit, rect, before });
    // 물레방아 맨 아래 줄은 운하 돌 둑에 맞춘 물보라 기둥(반투명 파란 막대)이라 들판 물에서는 떠 보인다 — 바퀴가 물에 잠긴 모습으로 둔다
    if (s.kit === "bd-pick-riverside-mill-waterwheel" && naturalWater) for (let i = 0; i < k.w; i += 1) if (inMap(s.x + i, s.y + k.h - 1)) draft.maps[mapId]!.upperTiles[idx(s.x + i, s.y + k.h - 1)] = -1;
    const kind = stampKind(s); const n = (kindSeen.get(kind) ?? 0) + 1; kindSeen.set(kind, n);
    logConstructionTiles(draft.maps[mapId]!, "stamp", `${kind} ${n}/${kindTotal.get(kind)}`, { rect, major: s.v === BLD });
  }
  for (const b of [bridge, millBridge]) {
    if (!b) continue; const bridge = b;
    const br = kitIndex.get(bridge.kit);
    if (br) { try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/${bridge.kit}`, mapId, x: bridge.x, y: bridge.y }); stamped += 1; } catch (e) { failed += 1; warnings.push(`다리: ${(e as Error).message.slice(0, 160)}`); } }
    if (br) logConstructionTiles(draft.maps[mapId]!, "stamp", "다리", { rect: { x: bridge.x, y: bridge.y, w: br.w, h: br.h }, major: true });
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
        const c = idx(x, y); if (occ[c] === WATERC || occ[c] === KEEP || want.has(c) || layerTileAt(m, 2, c) >= 0) return;
        if (hasTerrain && (lv[c] !== LV(st.x, st.y + (kitIndex.get(st.kit)?.h ?? 1) - 1) || rampCells.has(c))) return; // 단 너머·경사로에는 그림자를 두지 않는다
        want.set(c, t); shadowCells += 1;
      }));
    }
    if (want.size) {
      const nat = natureTileset();
      const tr = translateTiles(nat, ts, new Set(want.values()));
      for (const to of tr.map.values()) { ts.priority[to] = "upper"; ts.passability[to] = { up: true, down: true, left: true, right: true }; }
      for (const [c, t] of want) setLayerTileAt(m, 2, c, tr.map.get(t)!);
      logConstructionTiles(m, "stamp", "물가·그림자", { major: false });
    }
    natureStats = { overlay: want.size, shadowCells };
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
        const [dx, dy] = DV[ramps[c]!]!; const x = c % W, y = (c - x) / W;
        const ends = [[x + dx, y + dy], [x - dx, y - dy]].map(([X, Y]) => (inMap(X!, Y!) ? idx(X!, Y!) : -1));
        if (!pathy(c) || ends.some((n) => n < 0 || !(pathy(n) || ramps[n] === ramps[c]))) { ramps[c] = 0; rampCells.delete(c); changed = true; }
      }
    }
    rampCount = 0; { const seen = new Set<number>(); for (const c of rampCells) { if (seen.has(c)) continue; rampCount += 1; const q = [c]; seen.add(c);
      for (let h = 0; h < q.length; h += 1) { const a = q[h]!, x = a % W, y = (a - x) / W; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (rampCells.has(n) && !seen.has(n)) { seen.add(n); q.push(n); } } } } }
  }

  // ---------- 12c. 지형을 맵에 싣는다 ----------
  // 0단계 지형 + 3b 경사로를 map.relief 로. 칠하기·찍기 도구는 높이를 모르므로 찍기가 끝난 뒤에 넣는다(마을이 이미 지형을 따라 앉았다).
  let reliefInfo: { terrain: string; note: string; levels: Record<string, number>; ramps: number; cuts: number; fails: number; straddle: number; rampsOffRoad: number; roadOnRim?: number } | null = null;
  {
    const m0 = draft.maps[mapId]!;
    if (hasTerrain && rel) {
      m0.relief = { ...rel, levels: Array.from(lv), ramps: ramps.slice(), style: RELIEF_STYLE[theme] };
      invalidateReliefSlopes(m0.relief);
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
      reliefInfo = { terrain: terrain.name, note: terrain.note, levels: counts, ramps: rampCount, cuts: cutCells, fails: rampFails, straddle, rampsOffRoad, roadOnRim };
      logConstructionTiles(m0, "stamp", "지형 높이", { major: false });
    } else {
      delete m0.relief;
      reliefInfo = { terrain: terrain.name, note: terrain.note, levels: { 0: W * H }, ramps: 0, cuts: 0, fails: 0, straddle: 0, rampsOffRoad: 0 };
    }
  }

  // ---------- 13. 문 앞 도달(입구 = 큰길 서쪽 끝) ----------
  const m = draft.maps[mapId]!;
  const pass = (t: number) => { if (t < 0) return true; const p = ts.passability?.[t]; return !p || p.up || p.down || p.left || p.right; };
  const walk = (x: number, y: number) => inMap(x, y) && pass(m.lowerTiles[idx(x, y)]!) && pass(m.upperTiles[idx(x, y)]!);
  // 입구: 큰길 서쪽 끝(물가 띠 마을은 들길 동쪽 끝)
  const entrance = form === "riverbank" && entryLane ? { x: W - 1, y: yAt(entryLane, W - 1) ?? yMainBase } : { x: 0, y: yMainAt(0) };
  const startY = entrance.y;
  const seen = new Uint8Array(W * H); const q: number[] = [];
  for (let o = 0; o < 2; o += 1) if (walk(entrance.x, startY + o)) { seen[idx(entrance.x, startY + o)] = 1; q.push(idx(entrance.x, startY + o)); }
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy;
      if (walk(nx, ny) && !seen[idx(nx, ny)] && reliefAllowsStep(m.relief, x, y, nx, ny)) { seen[idx(nx, ny)] = 1; q.push(idx(nx, ny)); } } }
  const unreached = doorFronts.filter((d) => !seen[idx(d.x, d.y)]);
  if (unreached.length) warnings.push(`입구에서 닿지 않는 문 앞 ${unreached.length}곳: ${unreached.slice(0, 5).map((d) => `${d.kit}@(${d.x},${d.y})`).join(", ")}`);

  const distinct = new Set(placedHouses.map((h) => h.id)).size;
  function skeletonText(): string {
    const side = streets.length - 1;
    if (form === "riverbank") return `강 동쪽 둑을 따라 남북 둑길(폭 2)·뒷길 고리·동쪽 들길(입구)${ferry ? `, 나루(${ferry.x},${ferry.y})와 나룻배·건너편 들길` : ""}`;
    if (form === "scatter") return `${"mat" in spec.road ? "모랫길 " : ""}오솔길(폭 1)·갈래길 ${side}개, 집 사이 4~8칸`;
    return `큰길 하나(굽은 폭 2)·${side}개 갈래길${form === "plaza" ? `, 광장(${plazaX},${Math.round(plazaCy)})` : ", 광장 없음"}`;
  }
  const streetNames = streets.map((s) => s.name);
  return {
    summary: `버들항 ${spec.label} · ${FORM_LABEL[form]}(form ${form}) · 지형 ${TERRAIN_LABEL[terrain.name]}(terrain ${terrain.name}${terrain.name !== terrainName ? `, 요청 ${terrainName} → ${terrain.note}` : hasTerrain ? `, ${terrain.note}, 길 경사로 ${rampCount}곳` : ""}) ${W}×${H} (맵 ${mapId}, seed ${seed}): ${skeletonText()}, 모이는 곳 = ${gather.why}${gatherDoor ? `(${gatherDoor.x},${gatherDoor.y})` : "(자리 없음)"}, ` +
      `집 ${placedHouses.length}채(${distinct}종)${anchors.length ? `, 앵커 ${anchors.map((a) => a.replace(/^bd-(pick-|house-)/, "")).join("·")}` : ""}` +
      `${workAt ? `, 일터 「${workAt.name}」` : ""}, 밭 ${fields}${fenceAt.size ? `(울타리 ${fenceAt.size}칸)` : ""}, 나무 ${treeCount}, ${form === "plaza" ? "광장" : "모이는 곳"} 소품 ${plazaProps}. 문 앞 ${doorFronts.length - unreached.length}/${doorFronts.length} 도달. ` +
      "다음: check_city_form·check_reachability 로 점검하고, NPC·출입구 이벤트는 문 앞 칸(data.doors)에 얹는다.",
    data: {
      mapId, width: W, height: H, seed, theme, form, tilesetId: TS_ID,
      streets: streetNames, ...(form === "plaza" ? { plaza: { x: plazaX, y: Math.round(plazaCy), rx: prx, ry: pry } } : {}),
      gathering: { why: gather.why, ...(gatherDoor ? { door: gatherDoor } : {}) }, fenceCells: fenceAt.size, ...(ferry ? { ferry } : {}),
      anchors, work: workAt, houses: placedHouses.length, distinctHouses: distinct,
      doors: doorFronts.map((d) => ({ kit: d.kit, x: d.x, y: d.y, reached: !!seen[idx(d.x, d.y)] })),
      ...(bridge ? { bridge } : {}), ...(millBridge ? { millBridge } : {}), fields, trees: treeCount, filler, stamped, stampFailed: failed, nature: natureStats,
      terrain: terrain.name, ...(reliefInfo ? { relief: reliefInfo } : {}),
      entrance,
    },
    warnings,
  };
}
