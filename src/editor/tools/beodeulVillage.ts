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
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";
import { appendStructurePlacement, captureStructureTiles } from "@/project/structurePlacements";
import { CONSTRUCTION_TOOLS_V3 } from "./v3/constructionTools";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition } from "./types";
import { analyzeCityForm } from "./cityForm";

export const BEODEUL_VILLAGE_THEMES = ["river", "coast", "desert", "snow", "swamp"] as const;
export type BeodeulVillageTheme = (typeof BEODEUL_VILLAGE_THEMES)[number];

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
    trees: pick("desert-oasis", "palm cactus rock"), shrubs: pick("desert-oasis", "cactus rock scrub"), decals: pick("desert-oasis", "scrub bones scrub"),
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
const FREE = 0, ROAD = 1, WATERC = 2, PLAZAC = 3, BLD = 4, PROP = 5, FIELD = 6, KEEP = 7, POND_RING = 8;

interface Kit { id: string; w: number; h: number; door: { dx: number; dy: number } | null; def: StructureKitDef }
interface Stamp { kit: string; x: number; y: number; record: boolean }
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
export function buildBeodeulVillage(draft: Project, mapId: string, theme: BeodeulVillageTheme, seed: number): VillageResult {
  const spec = THEMES[theme];
  const ts: TilesetDef = draft.tilesets[TS_ID]!;
  const map0 = draft.maps[mapId]!;
  const W = map0.width, H = map0.height;
  const rand = rng(seed * 7919 + theme.length * 131 + 17);
  const ri = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const choice = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const warnings: string[] = [];
  const openLand = theme === "desert" || theme === "snow"; // 모래·눈은 트인 땅이 자연 — 빈 덩이 40칸까지, 화면당 40%까지

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
  const surfaceAt = new Map<number, Surface>(); // 바닥 덧칠(물 고리·밭 표본)
  const decalAt = new Set<number>(); // 바닥 소품(풀꽃·밀) 찍은 칸

  // ---------- 1. 자연 앵커 ----------
  let riverX = -1; // 강 왼쪽 열(다리 자리)
  let riverLeft = false;
  const shoreY: number[] = new Array(W).fill(H);
  const yMainBase = theme === "coast" ? Math.round(H * 0.4) : Math.round(H * 0.5) + ri(-2, 2);
  if (spec.feature === "river") {
    // 강은 seed 에 따라 동쪽(0.6) 또는 서쪽(0.36) — 넓은 쪽 둑이 광장·뒷길을 갖는다
    riverLeft = rand() < 0.5;
    riverX = riverLeft ? Math.round(W * 0.36) + ri(-2, 2) : Math.round(W * 0.6) + ri(-3, 3);
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
  // 못·늪은 길을 정한 뒤(길을 피해서) 깐다 — 자리만 먼저 정한다
  const pondSide = rand() < 0.5 ? "w" : "e";

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
  const yAt = (s: Street, x: number): number | null => { for (let y = 0; y < H; y += 1) if (s.cells.has(idx(x, y))) return y; return null; };

  let mainKeys: [number, number][];
  if (theme === "coast") {
    const top = Math.min(...shoreY) - 9;
    const yM = Math.max(10, Math.min(yMainBase, top));
    const sg = rand() < 0.5 ? 1 : -1;
    mainKeys = [[0, yM + sg * 2], [Math.round(W * 0.3), yM - sg * ri(1, 2)], [Math.round(W * 0.62), yM + sg * ri(1, 2)], [W - 1, yM - sg * 2]];
  } else if (riverX >= 0) {
    const yc = yMainBase;
    const sg = rand() < 0.5 ? 1 : -1;
    mainKeys = riverLeft
      ? [[0, yc + sg], [riverX - 4, yc], [riverX + 7, yc], [riverX + 7 + Math.round((W - riverX) * 0.35), yc - sg], [riverX + 7 + Math.round((W - riverX) * 0.7), yc - sg * 2], [W - 1, yc - sg * 2]]
      : [[0, yc + sg * 2], [Math.round(riverX * 0.25), yc + sg * 2], [Math.round(riverX * 0.6), yc + sg], [riverX - 4, yc], [riverX + 7, yc], [W - 1, yc - sg]];
  } else {
    const sg = rand() < 0.5 ? 1 : -1;
    mainKeys = [[0, yMainBase + sg * ri(2, 3)], [Math.round(W * 0.33), yMainBase - sg * ri(1, 2)], [Math.round(W * 0.66), yMainBase + sg * ri(1, 2)], [W - 1, yMainBase - sg * ri(2, 3)]];
  }
  const main = hStreet("큰길", mainKeys, 2);
  // 다리 칸: 큰길이 물을 지나는 곳은 길 대신 다리 키트
  let bridge: { x: number; y: number } | null = null;
  if (riverX >= 0) {
    const yb = yAt(main, riverX)!;
    bridge = { x: riverX, y: yb - 1 };
    for (let x = riverX; x < riverX + 4; x += 1) for (let y = yb - 1; y <= yb + 3; y += 1) set(x, y, KEEP);
    for (const c of [...main.cells]) if (occ[c] === WATERC || occ[c] === KEEP) main.cells.delete(c);
  }
  const markStreet = (s: Street) => { for (const c of s.cells) if (occ[c] !== WATERC && occ[c] !== KEEP) occ[c] = ROAD; };
  markStreet(main);
  const yMainAt = (x: number) => yAt(main, x) ?? yMainBase;

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
  const north: { s: Street; x0: number; x1: number } | null = (() => {
    // 큰길 북쪽 띠(집 한 줄, 6~8칸) + 뒷길 북쪽 띠(집 한 줄)가 들어가게: 큰길에서 10~12칸 위, 맵 위에서 7칸 아래
    const yN = Math.max(7, yMainBase - 10 - ri(0, 2));
    if (yMainBase - yN < 9) return null;
    const toWestEdge = riverX >= 0 ? !riverLeft : pondSide === "e";
    // 강이 서쪽이면 뒷길은 동쪽 둑(방앗간 자리 10칸을 비우고 동쪽 끝까지)
    const x0 = toWestEdge ? 0 : riverLeft ? eastStart + 10 : Math.round(W * 0.3) + ri(-3, 3);
    const x1 = toWestEdge ? Math.min(westEnd, Math.round(W * (riverX >= 0 ? 0.55 : 0.7)) + ri(-3, 3)) : W - 1;
    const sg = rand() < 0.5 ? 1 : -1, span = x1 - x0;
    const s = hStreet("뒷길(북)", [[x0, yN], [x0 + Math.round(span / 3), yN - sg], [x0 + Math.round(span * 2 / 3), yN + sg], [x1, yN]], theme === "coast" ? 2 : 1 + (rand() < 0.4 ? 1 : 0));
    markStreet(s);
    return { s, x0, x1 };
  })();
  const connectors: Street[] = [];
  /** 이음길. align "r" = x 가 길 끝 칸이고 이음길이 그 왼쪽으로 붙는다(끝에 혹이 남지 않게). */
  const connect = (name: string, xEnd: number, sTop: Street, sBot: Street, align: "l" | "r" | "m" = "m") => {
    const cw = 1 + (rand() < 0.3 ? 1 : 0);
    const x = align === "r" ? xEnd - cw + 1 : xEnd;
    const y0 = (yAt(sTop, xEnd) ?? 0) + sTop.width - 1, y1 = yAt(sBot, xEnd) ?? H - 1;
    if (y1 - y0 < 3) return;
    const bend = align === "m" ? ri(-2, 2) : 0;
    const c = vStreet(name, [[x, y0], [x + bend, Math.round((y0 + y1) / 2)], [x, y1]], cw);
    markStreet(c); connectors.push(c);
  };
  if (north) {
    const cx = north.x0 === 0 ? north.x1 : north.x0;
    connect("이음길", cx, north.s, main, north.x0 === 0 ? "r" : "l");
    // 긴 뒷길이면 가운데에 이음길 하나 더(작은 고리)
    if (Math.abs(north.x1 - north.x0) > 30) connect("이음길", Math.round((north.x0 + north.x1) / 2) + ri(-3, 3), north.s, main);
  }
  let south: Street | null = null;
  const souths: Street[] = [];
  if (theme === "coast") {
    // 물가 길: 해안선 3칸 위를 따라 동서로(곶 앞에서 멈춤)
    const keys: [number, number][] = [];
    for (let x = 0; x <= W - 10; x += 6) keys.push([x, Math.min(...shoreY.slice(Math.max(0, x - 3), x + 4)) - 3]);
    keys.push([W - 10, Math.min(...shoreY.slice(W - 13, W - 7)) - 3]);
    south = hStreet("물가 길", keys, 2); markStreet(south);
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
      const sg = rand() < 0.5 ? 1 : -1, span = x1 - x0;
      const st = hStreet("뒷길(남)", [[x0, yS], [x0 + Math.round(span / 3), yS + sg * 2], [x0 + Math.round(span * 2 / 3), yS + sg], [x1, yS - sg]], 1 + (rand() < 0.4 ? 1 : 0));
      markStreet(st); souths.push(st);
      const ends = [x0 > 0 ? x0 : -1, x1 < W - 1 ? x1 : -1].filter((x) => x >= 0);
      if (!ends.length) ends.push(Math.round((x0 + x1) / 2));
      for (const x of ends) connect("이음길", x, main, st, x === x1 && x1 < W - 1 ? "r" : x === x0 && x0 > 0 ? "l" : "m");
      if (x1 - x0 > 30) connect("이음길", Math.round((x0 + x1) / 2) + ri(-3, 3), main, st);
    }
  }
  if (south) souths.push(south);

  // ---------- 4. 광장 ----------
  const plazaX0 = (() => {
    if (riverX >= 0) return riverLeft ? eastStart + Math.round((W - eastStart) * 0.5) + ri(-3, 3) : Math.round(riverX * 0.5) + ri(-3, 3);
    if (spec.feature === "pond") return pondSide === "w" ? Math.round(W * 0.6) + ri(-3, 3) : Math.round(W * 0.4) + ri(-3, 3);
    return Math.round(W * 0.48) + ri(-4, 4);
  })();
  // 광장은 큰길 남쪽으로 부풀린다 — 북쪽 띠는 앵커 건물(광장을 보는 여관·회관)이 쓴다
  const prx = ri(5, 6), pry = ri(3, 4);
  // 남쪽으로 내려가는 이음길이 광장을 가르지 않는 자리로 민다(길이 판석을 가르면 결절점이 둘로 쪼개진다)
  const southLaneXs = connectors.filter((c) => [...c.cells].some((i) => Math.floor(i / W) > (yAt(main, i % W) ?? 0))).map((c) => Math.min(...[...c.cells].map((i) => i % W)));
  const plazaX = (() => {
    const clear = (x: number) => x - prx - 1 > 0 && x + prx + 1 < W - 1 && southLaneXs.every((lx) => Math.abs(lx - x) > prx + 2)
      && (riverX < 0 || x + prx + 2 < riverX || x - prx - 2 > riverX + 4);
    for (let d = 0; d < W; d += 1) for (const x of [plazaX0 + d, plazaX0 - d]) if (clear(x)) return x;
    return plazaX0;
  })();
  const plazaCy = yMainAt(plazaX) + 1.5 + pry;
  // 큰길은 광장 북쪽 가장자리를 그대로 지나간다(길망이 광장에서 끊기지 않게)
  const plazaCells = blob(plazaX, plazaCy, prx, pry, 0.08).filter((c) => occ[c] !== WATERC && occ[c] !== KEEP && !main.cells.has(c));
  // 광장은 판석 46칸 안팎 — 소품이 아래층을 덮어도 결절점(24칸)이 남게, 모자라면 가로로 넓힌다
  for (let grow = 1; plazaCells.length < 46 && grow <= 4; grow += 1) {
    for (const c of blob(plazaX, plazaCy, prx + grow, pry, 0.08)) if (!plazaCells.includes(c) && occ[c] !== WATERC && occ[c] !== KEEP && !main.cells.has(c)) plazaCells.push(c);
  }
  for (const c of plazaCells) occ[c] = PLAZAC;
  const plazaSet = new Set(plazaCells);
  let plazaTop = H; for (const c of plazaCells) if (c % W === plazaX) plazaTop = Math.min(plazaTop, Math.floor(c / W));

  // ---------- 5. 못·늪 (길을 피해) ----------
  const nearStreet = (c: number, d: number) => {
    const x = c % W, y = (c - x) / W;
    for (let dy = -d; dy <= d; dy += 1) for (let dx = -d; dx <= d; dx += 1) { const v = at(x + dx, y + dy); if (v === ROAD || v === PLAZAC || v === KEEP) return true; }
    return false;
  };
  const pondCells: number[] = [];
  if (spec.feature === "pond" && spec.pond) {
    const cx = pondSide === "w" ? Math.round(W * 0.2) : Math.round(W * 0.8), cy = Math.round(yMainBase - H * 0.22) + ri(-1, 1);
    const rx = ri(6, 8), ry = ri(4, 5);
    const ring = spec.pond.ring ? blob(cx, cy, rx + 2.5, ry + 2.2, 0.12) : [];
    for (const c of ring) if (occ[c] === FREE && !nearStreet(c, 0)) { occ[c] = POND_RING; surfaceAt.set(c, spec.pond.ring!); }
    for (const c of blob(cx, cy, rx, ry, 0.14)) if ((occ[c] === FREE || occ[c] === POND_RING) && !nearStreet(c, 1)) { occ[c] = WATERC; pondCells.push(c); surfaceAt.set(c, spec.pond.water); }
  }

  // ---------- 6. 앵커 건물(광장 북쪽) ----------
  const fits = (k: Kit, x: number, y: number, margin = 0, allow: (v: number) => boolean = (v) => v === FREE || v === POND_RING) => {
    if (x < 0 || y < 0 || x + k.w > W || y + k.h > H) return false;
    for (let j = -margin; j < k.h + margin; j += 1) for (let i = -margin; i < k.w + margin; i += 1) {
      const inside = i >= 0 && j >= 0 && i < k.w && j < k.h;
      const v = at(x + i, y + j);
      if (inside) { if (!allow(v)) return false; } else if (v === BLD) return false;
    }
    return true;
  };
  const claim = (k: Kit, x: number, y: number, v: number, record: boolean) => {
    for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) {
      set(x + i, y + j, v);
      const r = k.def.rows[j]; if (r && ((r.tiles[i] ?? -1) >= 0 || (r.upperTiles?.[i] ?? -1) >= 0) && inMap(x + i, y + j)) cover[idx(x + i, y + j)] = 1;
    }
    stamps.push({ kit: k.id, x, y, record });
  };
  const anchors: string[] = [];
  /** 문 앞 칸에서 가장 가까운 길·광장까지 빈 땅으로 BFS 해 1칸 폭 문 앞 길을 낸다(건물·물은 피한다). */
  const linkToRoad = (fx: number, fy: number): boolean => {
    if (!inMap(fx, fy)) return false;
    const prev = new Int32Array(W * H).fill(-2); const start = idx(fx, fy); prev[start] = -1; const q = [start];
    for (let h = 0; h < q.length; h += 1) {
      const c = q[h]!; const x = c % W, y = (c - x) / W;
      if (c !== start && (occ[c] === ROAD || occ[c] === PLAZAC)) {
        for (let t = prev[c]!; t >= 0; t = prev[t]!) if (occ[t] === FREE || occ[t] === POND_RING) occ[t] = ROAD;
        if (occ[start] === FREE || occ[start] === POND_RING) occ[start] = ROAD;
        return true;
      }
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
        const nx = x + dx, ny = y + dy; if (!inMap(nx, ny)) continue; const n = idx(nx, ny);
        if (prev[n] !== -2) continue; const v = occ[n];
        if (v === FREE || v === POND_RING || v === ROAD || v === PLAZAC) { prev[n] = c; q.push(n); }
      }
    }
    return false;
  };
  const doorFronts: { x: number; y: number; kit: string }[] = [];
  {
    const cand = have(spec.anchors).filter((id) => K(id).door);
    const order = cand.map((id) => ({ id, r: rand() })).sort((a, b) => a.r - b.r).map((o) => o.id);
    let done = false;
    for (const off of [0, -2, 2, -4, 4, -6, 6]) {
      for (const id of order) {
        const k = K(id); const d = k.door!; const fx = plazaX + off; const top = yAt(main, fx) ?? -1;
        if (top < 0) continue;
        const x = fx - d.dx, y = top - 1 - d.dy;
        if (fits(k, x, y)) { claim(k, x, y, BLD, true); anchors.push(id); doorFronts.push({ x: fx, y: top, kit: id }); done = true; break; }
      }
      if (done) break;
    }
    if (!done) warnings.push("광장 맞은편(큰길 북쪽)에 앵커 건물이 들어갈 자리가 없었다.");
  }

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
  // 광장: 가운데 우물·모닥불, 둘레 좌판·벤치, 가장자리 등
  const plazaProps = (() => {
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
    // 방앗간: 북쪽 강둑, 물레방아는 강 오른쪽 둑에 걸쳐
    const wy = Math.max(4, Math.round(yMainBase * 0.45));
    const rowX = (y: number) => { for (let x = 0; x < W; x += 1) if (at(x, y) === WATERC) return x; return riverX; };
    const wheel = kitIndex.get("bd-pick-riverside-mill-waterwheel");
    if (wheel) { const x = rowX(wy + 3) + 3; const y = wy; let ok = true;
      for (let j = 0; j < wheel.h; j += 1) for (let i = 0; i < wheel.w; i += 1) { const v = at(x + i, y + j); if (v !== FREE && v !== WATERC) ok = false; }
      if (ok) { claim(wheel, x, y, PROP, true); workAt = { x: x + 4, y: y + 2, name: "방앗간" }; } }
    const mill = kitIndex.get("bd-house-h109_0") ?? kitIndex.get("bd-house-h109_1");
    if (mill && workAt) { const x = workAt.x, y = workAt.y - mill.h + 3;
      if (fits(mill, x, y)) { claim(mill, x, y, BLD, true); anchors.push(mill.id); const d = mill.door; if (d) { doorFronts.push({ x: x + d.dx, y: y + d.dy + 1, kit: mill.id }); linkToRoad(x + d.dx, y + d.dy + 1); } workAt = { x: x + 2, y: y + mill.h + 1, name: "방앗간" }; } }
    if (workAt) cluster(spec.work, workAt.x, workAt.y, 4, 4);
  } else if (theme === "coast") {
    // 포구: 물가 길 아래 해안에 생선 시장·잔교, 동쪽 곶에 등대, 바다에 배
    const px = Math.round(W * 0.5);
    const market = kitIndex.get("bd-pick-fishing-port-fish-market");
    // 생선 시장: 물가 길 바로 아래, 물가에 걸쳐 앉는다(포구 변형과 같다 — 좌판 앞은 물가 길에서 본다)
    if (market) for (const off of [-9, 9, -13, 13, -5, 5]) {
      const x = px + off - 3; const top = yAt(south!, px + off); if (top === null) continue;
      const y = top + 2;
      if (fits(market, x, y, 0, (v) => v === FREE || v === WATERC)) { claim(market, x, y, BLD, true); anchors.push(market.id); break; }
    }
    const stem = kitIndex.get("bd-pick-fishing-port-jetty-stem"), head = kitIndex.get("bd-pick-fishing-port-jetty-head");
    const jx = px + 5; const sy = shoreY[jx]!;
    if (stem && head && sy + 8 < H) {
      const len = Math.min(stem.h, H - sy - head.h - 1);
      if (len >= 4) {
        stamps.push({ kit: stem.id, x: jx, y: sy - 1, record: false });
        for (let j = -1; j < len; j += 1) { set(jx, sy + j, KEEP); set(jx + 1, sy + j, KEEP); }
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
      if (ok && setback === 1 && !(at(doorX, frontY) === FREE && isPath(at(doorX, frontY + 1)))) ok = false;
      if (ok && setback === 0 && !isPath(at(doorX, frontY))) ok = false;
      if (!ok) { x += 1; continue; }
      claim(k, x, y, BLD, true);
      if (setback === 1) set(doorX, frontY, ROAD);
      set(doorX, frontY, at(doorX, frontY) === PLAZAC ? PLAZAC : ROAD);
      doorFronts.push({ x: doorX, y: frontY, kit: k.id });
      placedHouses.push({ id: k.id, x, y });
      lastIds.push(k.id); if (lastIds.length > 2) lastIds.shift();
      // 집 옆 살림 소품(45%) — 집 오른쪽 아래 1~2칸 자리
      x += k.w + (rand() < 0.12 ? ri(4, 6) : rand() < 0.6 ? 1 : 2);
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
        if (!ok) { y += 1; continue; }
        claim(k, x, y, BLD, true);
        for (const c of stub) occ[c] = ROAD;
        doorFronts.push({ x: doorX, y: frontY, kit: k.id });
        placedHouses.push({ id: k.id, x, y });
        lastIds.push(k.id); if (lastIds.length > 2) lastIds.shift();
        y += k.h + ri(1, 2);
      }
    }
  };
  for (const s of [main, ...(north ? [north.s] : []), ...souths]) lineStreet(s);
  for (const c of connectors) lineLane(c);

  // ---------- 9. 집 옆 살림 소품 ----------
  for (const h of placedHouses) {
    if (rand() > 0.5) continue;
    const k = K(h.id); const pool = have(spec.home); if (!pool.length) break;
    const p = K(choice(pool));
    for (const x of rand() < 0.5 ? [h.x + k.w + 1, h.x - p.w - 1] : [h.x - p.w - 1, h.x + k.w + 1]) {
      const y = h.y + k.h - p.h;
      if (propFits(p, x, y)) { claim(p, x, y, PROP, false); break; }
    }
  }

  // ---------- 10. 바깥: 밭 → 숲 덩이 → 덤불·풀꽃 ----------
  // 늪: 마을이 선 땅(길·집·소품에서 2~4칸)만 진흙 섬으로 남기고 나머지는 물. 물가 한 줄은 이끼 늪(막힘).
  if (spec.feature === "bog" && spec.pond) {
    const dist = new Int16Array(W * H).fill(99); const q: number[] = [];
    for (let c = 0; c < W * H; c += 1) if (occ[c] !== FREE && occ[c] !== POND_RING) { dist[c] = 0; q.push(c); }
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]] as const) { if (!inMap(x + dx, y + dy)) continue; const n = idx(x + dx, y + dy); if (dist[n]! > dist[c]! + 1) { dist[n] = dist[c]! + 1; q.push(n); } } }
    const ph = rand() * 6.28, ph2 = rand() * 6.28;
    for (let c = 0; c < W * H; c += 1) {
      if (occ[c] !== FREE) continue; const x = c % W, y = (c - x) / W;
      const reach = 3 + 1.4 * Math.sin(x / 4.3 + ph) * Math.cos(y / 3.7 + ph2);
      if (dist[c]! > reach + 0.8) { occ[c] = WATERC; pondCells.push(c); surfaceAt.set(c, spec.pond.water); }
      else if (dist[c]! > reach - 0.4) { occ[c] = WATERC; surfaceAt.set(c, spec.pond.ring!); }
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
      for (let j = -1; j <= k.h && ok; j += 1) for (let i = -1; i <= k.w; i += 1) { const v = at(x + i, y + j); if (v !== WATERC && v !== 255) { ok = false; break; } }
      if (!ok) continue;
      stamps.push({ kit: k.id, x, y, record: false }); for (let j = 0; j < k.h; j += 1) for (let i = 0; i < k.w; i += 1) set(x + i, y + j, PROP); n += 1;
    }
  }

  let fields = 0;
  if (spec.field) {
    for (let t = 0; t < 140 && fields < 5; t += 1) {
      const fw = ri(5, 9), fh = ri(3, 5), x = ri(1, W - fw - 1), y = ri(1, H - fh - 1);
      let ok = true;
      for (let j = -1; j <= fh && ok; j += 1) for (let i = -1; i <= fw; i += 1) { const v = at(x + i, y + j); if (v !== FREE && v !== 255) { ok = false; break; } }
      if (!ok) continue;
      // 모서리 한두 칸을 깎아 네모 판을 피한다
      const cut = new Set<number>(); for (const [cx, cy] of [[x, y], [x + fw - 1, y], [x, y + fh - 1], [x + fw - 1, y + fh - 1]] as const) if (rand() < 0.5) cut.add(idx(cx, cy));
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
  for (let t = 0; t < (openLand ? 110 : 60) && trees.length; t += 1) {
    const cx = ri(1, W - 2), cy = ri(1, H - 2);
    if (at(cx, cy) !== FREE || distRoad[idx(cx, cy)]! < 3) continue;
    const n = ri(3, 7);
    for (let m = 0; m < n * 6; m += 1) {
      const k = K(choice(rand() < 0.75 ? trees : shrubs.length ? shrubs : trees));
      const x = cx + ri(-3, 3) - Math.floor(k.w / 2), y = cy + ri(-2, 2) - k.h + 1;
      if (treeFits(k, x, y, 2)) { claim(k, x, y, PROP, false); treeCount += 1; }
    }
  }
  // 남은 빈 땅: 큰 빈 덩이에만 작은 덩이(덤불 1~3 + 풀꽃 2~4)를 씨앗처럼 — 고르게 흩지 않는다(점박이 금지).
  // 풀밭 마을은 덩이 8칸까지, 모래·눈 마을은 트인 땅이 자연이라 30칸까지 둔다. 그다음 20×15 화면마다 빈 바닥 38% 이하로.
  const decals = have(spec.decals);
  const blobLimit = openLand ? 40 : 8;
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
    for (let m = 0; m < (openLand ? ri(0, 1) : ri(2, 4)) && decals.length; m += 1) {
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
    for (let t = 0; t < 200 && openShare(x0, y0) > (openLand ? 0.38 : 0.34); t += 1) {
      const x = x0 + ri(0, Math.min(19, W - 1 - x0)), y = y0 + ri(0, Math.min(14, H - 1 - y0));
      if (occ[idx(x, y)] === FREE && distRoad[idx(x, y)]! >= 2) filler += tuft(x, y, openLand);
    }
  }

  // 막다른 토막 다듬기: 이웃 포장 칸이 1개 이하인 길 칸(문 앞·맵 가장자리 제외)을 지운다 — 이음길 끝의 혹이 남지 않게
  {
    const front = new Set(doorFronts.map((d) => idx(d.x, d.y)));
    const paved = (x: number, y: number) => { const v = at(x, y); return v === ROAD || v === PLAZAC || v === KEEP; };
    for (let pass = 0; pass < 6; pass += 1) {
      let removed = 0;
      for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
        if (at(x, y) !== ROAD || front.has(idx(x, y))) continue;
        const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => paved(x + dx!, y + dy!)).length;
        if (n <= 1) { occ[idx(x, y)] = FREE; removed += 1; }
      }
      if (!removed) break;
    }
  }

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
  // 바탕
  if ("mat" in spec.base) fill({ x: 0, y: 0, w: W, h: H }, spec.base.mat, true);
  else { const all: number[] = []; for (let c = 0; c < W * H; c += 1) all.push(c); paintCells(all, spec.base); }
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
  // 길 → 광장 → 물 순서: fill_region 은 「벽」과 1칸 틈을 메우므로 물이 먼저 있으면 물가 1칸 틈이 길로 메워져 혹이 생긴다
  paintCells(roadCells, spec.road);
  paintCells(plazaPaint, spec.plaza);
  if (waterMat.length) paintCells(waterMat, { mat: WATER });

  // ---------- 12. 찍기 ----------
  let stamped = 0, failed = 0;
  for (const s of stamps) {
    const k = kitIndex.get(s.kit); if (!k) { failed += 1; continue; }
    const rect = { x: s.x, y: s.y, w: k.w, h: k.h };
    const before = s.record ? captureStructureTiles(draft.maps[mapId]!, rect) : null;
    try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/${s.kit}`, mapId, x: s.x, y: s.y }); stamped += 1; }
    catch { failed += 1; continue; }
    if (before) appendStructurePlacement(draft.maps[mapId]!, { kitId: s.kit, rect, before });
  }
  if (bridge) {
    const br = kitIndex.get("bd-bridge-arch");
    if (br) { try { stampObjectTool.run(draft, { objectId: `kit:${TS_ID}/bd-bridge-arch`, mapId, x: bridge.x, y: bridge.y }); stamped += 1; } catch { failed += 1; } }
  }

  // 마감 점검: 도시 형태 자(check_city_form 과 같은 계산)가 짚는 막다른 토막을 바탕으로 되돌린다(문 앞 칸은 두고)
  {
    const front = new Set(doorFronts.map((d) => idx(d.x, d.y)));
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

  // ---------- 13. 문 앞 도달(입구 = 큰길 서쪽 끝) ----------
  const m = draft.maps[mapId]!;
  const pass = (t: number) => { if (t < 0) return true; const p = ts.passability?.[t]; return !p || p.up || p.down || p.left || p.right; };
  const walk = (x: number, y: number) => inMap(x, y) && pass(m.lowerTiles[idx(x, y)]!) && pass(m.upperTiles[idx(x, y)]!);
  const startY = yMainAt(0);
  const seen = new Uint8Array(W * H); const q: number[] = [];
  for (let o = 0; o < 2; o += 1) if (walk(0, startY + o)) { seen[idx(0, startY + o)] = 1; q.push(idx(0, startY + o)); }
  for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (walk(nx, ny) && !seen[idx(nx, ny)]) { seen[idx(nx, ny)] = 1; q.push(idx(nx, ny)); } } }
  const unreached = doorFronts.filter((d) => !seen[idx(d.x, d.y)]);
  if (unreached.length) warnings.push(`입구에서 닿지 않는 문 앞 ${unreached.length}곳: ${unreached.slice(0, 5).map((d) => `${d.kit}@(${d.x},${d.y})`).join(", ")}`);

  const distinct = new Set(placedHouses.map((h) => h.id)).size;
  const streetNames = streets.map((s) => s.name);
  return {
    summary: `버들항 ${spec.label} ${W}×${H} (맵 ${mapId}, seed ${seed}): 큰길 하나(굽은 폭 2)·${streetNames.length - 1}개 갈래길, 광장(${plazaX},${Math.round(plazaCy)}), ` +
      `집 ${placedHouses.length}채(${distinct}종)${anchors.length ? `, 앵커 ${anchors.map((a) => a.replace(/^bd-(pick-|house-)/, "")).join("·")}` : ""}` +
      `${workAt ? `, 일터 「${workAt.name}」` : ""}, 밭 ${fields}, 나무 ${treeCount}, 광장 소품 ${plazaProps}. 문 앞 ${doorFronts.length - unreached.length}/${doorFronts.length} 도달. ` +
      "다음: check_city_form·check_reachability 로 점검하고, NPC·출입구 이벤트는 문 앞 칸(data.doors)에 얹는다.",
    data: {
      mapId, width: W, height: H, seed, theme, tilesetId: TS_ID,
      streets: streetNames, plaza: { x: plazaX, y: Math.round(plazaCy), rx: prx, ry: pry },
      anchors, work: workAt, houses: placedHouses.length, distinctHouses: distinct,
      doors: doorFronts.map((d) => ({ kit: d.kit, x: d.x, y: d.y, reached: !!seen[idx(d.x, d.y)] })),
      ...(bridge ? { bridge } : {}), fields, trees: treeCount, filler, stamped, stampFailed: failed,
      entrance: { x: 0, y: startY },
    },
    warnings,
  };
}
