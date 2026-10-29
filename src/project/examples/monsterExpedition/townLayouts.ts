import type { GameMap, Project } from "@/project/types";
import { autotileGroupsForTileset } from "@/project/defaults/autotileGroups";
import { shapeAllAutotileGroupsAround } from "@/project/defaults/autotileEngine";

// 마을 네 곳(별싹·새순·모래종·달그림자)이 한 템플릿(overworld/map)을 지붕 색만 바꿔 썼다 — 2026-10-06 시각 QA 에서
// 「같은 마을 네 번」으로 걸렸다. 이 파일은 같은 시트의 재료(바닥·오토타일·물체·건물 킷)로 마을마다 다른 판을 짠다.
// 판은 글자 그림(rows)이고, 건물은 템플릿 킷 그대로 찍어서 world.ts 의 doorways() 가 문을 다시 찾는다.

interface Kit { name: string; width: number; height: number; rowsLower: number[][]; rowsUpper: number[][] }
export interface TownTemplate { width: number; height: number; lower: number[]; upper: number[]; tilesetId: string; names: Record<string, number>; buildings: Kit[] }

type Legend =
  | { ground: string[] }            // 바닥 칸(이름 여럿이면 위치 해시로 고른다)
  | { group: string }               // 오토타일 그룹의 꽉 찬 칸 — 다 깐 뒤 엔진이 이웃으로 모양을 고른다
  | { tile: string[] }              // 낱칸 소품(시트 사전의 홈 층에 놓고 그 밑엔 바닥)
  | { prop: string; on?: string[] } // 여러 칸 물체(타일셋 구조 킷)의 왼쪽 위 칸. on = 그 밑 바닥(판 기본 바닥과 다를 때 — 모래 위 야자)
  | { frame: true }                 // 숲 벽 — 템플릿 둘레를 주기 2 로 이어 붙인다
  | { stamp: { from: string; x: number; y: number; w: number; h: number } }; // 다른 템플릿의 네모를 그대로(눈 풀숲 덩이 — 가장자리 술이 위층 낱칸이라 오토타일이 없다)

export interface TownSketch {
  rows: string[];
  ground: string[];
  legend: Record<string, Legend>;
  kits: [name: string, x: number, y: number][];
}

function cellHash(x: number, y: number): number {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ 0x51ed27;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** 글자 그림을 맵 칸으로 깐다. 맵 크기는 그림 크기를 따른다. */
export function composeTown(project: Project, map: GameMap, t: TownTemplate, sketch: TownSketch, templates: Readonly<Record<string, TownTemplate>> = {}): void {
  const H = sketch.rows.length, W = sketch.rows[0]!.length;
  if (sketch.rows.some(r => r.length !== W)) throw Error(`Town sketch ${map.id} rows differ in width`);
  const tileset = project.tilesets[t.tilesetId]!;
  const groups = autotileGroupsForTileset(tileset);
  const named = (name: string) => {
    const id = t.names[name];
    if (id === undefined) throw Error(`Town sketch ${map.id}: no tile named ${name}`);
    return id;
  };
  const pick = (names: string[], x: number, y: number) => named(names[cellHash(x, y) % names.length]!);
  const lower = Array.from({ length: W * H }, (_, i) => pick(sketch.ground, i % W, Math.floor(i / W)));
  const upper = new Array<number>(W * H).fill(-1);
  const put = (x: number, y: number, tile: number, layer: "lower" | "upper") => {
    if (x < 0 || y < 0 || x >= W || y >= H || tile < 0) return;
    (layer === "lower" ? lower : upper)[y * W + x] = tile;
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const ch = sketch.rows[y]![x]!;
    if (ch === ".") continue;
    const legend = sketch.legend[ch];
    if (!legend) throw Error(`Town sketch ${map.id}: unknown mark ${ch} at ${x},${y}`);
    if ("ground" in legend) put(x, y, pick(legend.ground, x, y), "lower");
    else if ("group" in legend) {
      const group = groups.find(g => g.id === legend.group);
      if (!group) throw Error(`Town sketch ${map.id}: no autotile group ${legend.group}`);
      put(x, y, group.variantMap[String(group.neighborhood === 8 ? 255 : 15)]!, "lower");
    } else if ("tile" in legend) {
      const tile = pick(legend.tile, x, y);
      // 키트가 덧그림으로만 쓰는 칸(표지판 등)도 위층 — 1층에 두면 투명 부분이 검게 뚫린다(2026-10-06 숲속·달맞이 표지판).
      const kitUpperOnly = tileset.structureKits?.some(k => k.rows.some(r => r.upperTiles?.includes(tile)))
        && !tileset.structureKits.some(k => k.rows.some(r => r.tiles.includes(tile)));
      put(x, y, tile, tileset.tileMeta?.[tile]?.defaultLayer === "upper" || kitUpperOnly ? "upper" : "lower");
    } else if ("stamp" in legend) {
      const { from, x: sx, y: sy, w, h } = legend.stamp;
      const source = templates[from];
      if (!source || source.tilesetId !== t.tilesetId) throw Error(`Town sketch ${map.id}: no stamp template ${from} on ${t.tilesetId}`);
      for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
        const cell = (sy + dy) * source.width + sx + dx;
        put(x + dx, y + dy, source.lower[cell]!, "lower");
        put(x + dx, y + dy, source.upper[cell]!, "upper");
      }
    } else if ("prop" in legend) {
      const kit = tileset.structureKits?.find(k => k.name === legend.prop);
      if (!kit) throw Error(`Town sketch ${map.id}: no structure kit ${legend.prop}`);
      kit.rows.forEach((row, dy) => row.tiles.forEach((tile, dx) => {
        if (legend.on) put(x + dx, y + dy, pick(legend.on, x + dx, y + dy), "lower");
        put(x + dx, y + dy, tile, "lower");
        put(x + dx, y + dy, row.upperTiles?.[dx] ?? -1, "upper");
      }));
    } else {
      // 템플릿 둘레(가로 2칸·세로 3칸 띠)를 같은 짝수 주기로 늘인다 — 둘레 그림은 2칸 단위 반복이다.
      const tx = x < 2 ? x : x >= W - 2 ? x - (W - t.width) : 2 + ((x - 2) & 1);
      const ty = y < 3 ? y : y >= H - 3 ? y - (H - t.height) : 3 + ((y - 3) & 1);
      lower[y * W + x] = t.lower[ty * t.width + tx]!;
      upper[y * W + x] = t.upper[ty * t.width + tx]!;
    }
  }
  for (const [name, ox, oy] of sketch.kits) {
    const kit = t.buildings.find(b => b.name === name);
    if (!kit) throw Error(`Town sketch ${map.id}: no building kit ${name}`);
    for (let y = 0; y < kit.height; y++) for (let x = 0; x < kit.width; x++) {
      const cell = (oy + y) * W + ox + x;
      if (kit.rowsLower[y]![x]! >= 0) lower[cell] = kit.rowsLower[y]![x]!;
      upper[cell] = kit.rowsUpper[y]![x]!;
    }
  }
  map.width = W; map.height = H; map.lowerTiles = lower; map.upperTiles = upper;
  const points = Array.from({ length: W * H }, (_, i) => ({ x: i % W, y: Math.floor(i / W) }));
  shapeAllAutotileGroupsAround(map, groups, points);
}

const GRASS = ["grass0", "grass0", "grass1", "grass2", "grass3"];
const OVERWORLD: Record<string, Legend> = {
  "#": { frame: true },
  "=": { group: "clearing" },
  "~": { group: "water" },
  f: { tile: ["flower_red", "flower_white", "flower_yellow", "flower_pink"] },
  F: { tile: ["flowerbed_red", "flowerbed_yellow", "flowerbed_pink", "flowerbed_white"] },
  b: { tile: ["bush0", "bush1"] },
  o: { tile: ["boulder0", "boulder1"] },
  S: { tile: ["sign"] },
  M: { tile: ["mailbox"] },
  T: { prop: "tree_a" },
  U: { prop: "tree_b" },
  P: { prop: "pine_a" },
};

const DESERT: Record<string, Legend> = {
  "#": { group: "dcliff" },
  "^": { group: "dface" },
  "=": { group: "ashpath" },
  g: { group: "dgrass" },
  "~": { group: "oasis" },
  c: { tile: ["cactus"] },
  r: { tile: ["drock0", "drock1"] },
  d: { tile: ["dbush"] },
  S: { tile: ["sign"] },
  P: { prop: "palm_a" },
  R: { prop: "dcone" },
  Q: { prop: "dcone_c" },
  B: { prop: "dcone_b" },
};


/**
 * 화산 시작 마을·1번길 — 새 그림 없이 잿빛 온천 마을(climate/ash_town)의 재료(재 바닥·잿길·온천·증기 분출구·용암 바위·재 더미·재 나무·화산 절벽)만 쓴다.
 * 기획서가 「화산 섬」인데 coast 로 조용히 바뀌어 풀밭 마을에서 시작했다(2026-10-14 자유도 감사 v5).
 */
const VOLCANO: Record<string, Legend> = {
  "#": { group: "vcliff" },
  "^": { group: "vface" },
  "=": { group: "ashpath" },
  "~": { group: "spring" },
  p: { tile: ["ash_pile0", "ash_pile1"] },
  r: { tile: ["lava_rock0", "lava_rock1"] },
  S: { tile: ["sign_metal"] },
  M: { tile: ["mailbox"] },
  v: { prop: "steam_vent" },
  T: { prop: "atree_a" },
  C: { prop: "vcone" },
  Z: { prop: "vcone_c" },
  A: { stamp: { from: "climate/ash_town", x: 14, y: 15, w: 7, h: 4 } },
};

/** 맵 키 → 판(마을과 관측탑). 없는 맵은 템플릿 그대로. 북·남 출구는 가운데 두 칸(world.ts connect 가 (w/2, 2)·(w/2, h-2) 근처를 고른다). */
export const TOWN_SKETCHES: Record<string, TownSketch> = {
  // 새순 마을: 나무를 심는 마을 — 잎 체육관이 북동쪽을 차지하고, 길가에 과수 줄과 꽃밭.
  grove: {
    ground: GRASS, legend: OVERWORLD,
    kits: [["gym_leaf", 13, 3], ["center", 3, 4], ["mart", 3, 12], ["cabin_a", 16, 13]],
    rows: [
      "###########==###########",
      "###########==###########",
      "###########==###########",
      "##.....fT..==.........##",
      "##.........==.......U.##",
      "##.........==.........##",
      "##........f==.........##",
      "##.........==.........##",
      "##..==.....==.........##",
      "##..==.f...==.........##",
      "##..================..##",
      "##..================..##",
      "##.....T.T.==.......T.##",
      "##.........==FFF......##",
      "##.........==FFF......##",
      "##.........==.S.......##",
      "##..==.f...==.........##",
      "##..================..##",
      "##..================..##",
      "###########==###########",
      "###########==###########",
      "###########==###########",
    ],
  },
  // 달그림자 마을: 등불을 띄우는 호숫가 — 동남쪽 호수, 침엽수, 물빛 체육관.
  moon: {
    ground: GRASS, legend: OVERWORLD,
    kits: [["gym_water", 13, 3], ["mart", 3, 4], ["cabin_c", 2, 13], ["center", 7, 13]],
    rows: [
      "###########==###########",
      "###########==###########",
      "###########==###########",
      "##.........==.........##",
      "##.....P...==.......P.##",
      "##.........==.........##",
      "##.......P.==.........##",
      "##.........==.......P.##",
      "##..==.....==.........##",
      "##..==.....==.........##",
      "##..================..##",
      "##..================..##",
      "##.........==P........##",
      "##.........==..~~~~~~.##",
      "##.........==..~~~~~~.##",
      "##.........==P.~~~~~~.##",
      "##.........==..~~~~~~.##",
      "##..=========..~~~~~~.##",
      "##..=========.fS......##",
      "###########==###########",
      "###########==###########",
      "###########==###########",
    ],
  },
  // 모래종 마을: 사암 벼랑에 안긴 사막 마을 — 북쪽 벼랑 틈 출구, 오아시스, 기백 도장(불꽃 지붕 체육관), 모래 지붕 집.
  dune: {
    ground: ["dsand0", "dsand0", "dsand1", "dsand2", "dsand3"],
    legend: DESERT,
    kits: [["gym_fire", 13, 5], ["center", 3, 5], ["mart", 2, 13], ["house_ash_a", 18, 12]],
    rows: [
      "###########==###########",
      "###########==###########",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##...r.....==...d.....##",
      "##.........==.........##",
      "##.......c.==.........##",
      "##.........==.........##",
      "##.........==.........##",
      "##..=========.........##",
      "##..=========.........##",
      "##.........==.........##",
      "##.....gggg==...==....##",
      "##.....g~~g==...==....##",
      "##.....g~~g==...==....##",
      "##.....g~~g==...==....##",
      "##.....gggg==...=====.##",
      "##.==================.##",
      "##.==================.##",
      "##P....P...==..P....P.##",
      "##..R....B.==Q...R....##",
      "##....c....==......c..##",
    ],
  },
  // 옛 별 관측탑(무영과의 마지막 대결): 8번길 유적과 같은 템플릿 복제였다 — 같은 재료로 미로 대신 의식의 홀을 짠다.
  // 북쪽 제단까지 돌 길, 양옆 기둥 줄, 점자 석판, 제단 앞 두 받침돌. 출구는 템플릿과 같은 (10,14).
  observatory: {
    ground: ["ru_sand0", "ru_sand1", "ru_sand2", "ru_sand3"],
    legend: {
      L: { tile: ["ru_edge_r"] }, R: { tile: ["ru_edge_l"] },
      W: { tile: ["ru_wall_up"] }, w: { tile: ["ru_wall_dn"] },
      P: { tile: ["ru_wall_up_p"] }, p: { tile: ["ru_wall_dn_p"] },
      G: { tile: ["ru_wall_up_g0"] }, g: { tile: ["ru_wall_dn_g0"] },
      H: { tile: ["ru_wall_up_g1"] }, h: { tile: ["ru_wall_dn_g1"] },
      s: { tile: ["ru_sand_s"] },
      e: { tile: ["ru_fl0_e"] }, f: { tile: ["ru_fl1"] }, E: { tile: ["ru_fl2_e"] }, F: { tile: ["ru_fl3"] },
      a: { tile: ["ru_edge_rt"] }, b: { tile: ["ru_edge_lt"] }, _: { tile: ["ru_edge_t"] }, M: { tile: ["ru_edge_mat"] },
      X: { tile: ["ru_exit"] },
      u: { tile: ["ru_urn"] },
      r: { tile: ["ru_rubble0", "ru_rubble1"] },
      "=": { group: "ru_pb" },
      I: { prop: "ru_pillar" },
      A: { prop: "ru_altar" },
      B: { prop: "ru_braille" },
    },
    kits: [],
    rows: [
      "LWWPWWGWWWWWWWWHWWPWWR",
      "LwwpwwgwwwwwwwwhwwpwwR",
      "LsssssssssA.sssssssssR",
      "Lu..................uR",
      "L...I.....ef.....I...R",
      "L.B....==.EF.==...B..R",
      "L......==.ef.==......R",
      "L...I.....EF.....I...R",
      "L.........ef.........R",
      "L.....r...EF.......r.R",
      "L...I.....ef.....I...R",
      "L.........EF...r.....R",
      "L.u.......ef.......u.R",
      "L..r......EF..r......R",
      "L.........X..........R",
      "a_________M__________b",
    ],
  },
};

/**
 * 시작 마을 테마 — 기획서가 사막·눈·바닷가 마을에서 시작하는데 별싹 마을(풀밭 템플릿)이 그대로 나왔다(2026-10-06 사막 기획서 실편집기 녹화).
 * 판마다 집 둘(북서=주인공 집, 북동=연구소 — 킷 목록 순서상 앞 킷이 집이 된다)·마트(남서)·센터(남동)를 같은 자리에 두어
 * world.ts 의 문 찾기·안내 대사(「북동쪽 집이 연구소」)가 그대로 맞는다. 출구는 북쪽 가운데 두 칸 하나뿐이다(home 은 connect 의 a 쪽만 된다).
 */
export type StartTheme = "desert" | "snow" | "coast" | "volcano";
export const START_TOWNS: Record<StartTheme, { template: string; sketch: TownSketch }> = {
  desert: { template: "climate/desert", sketch: {
    ground: ["dsand0", "dsand0", "dsand1", "dsand2", "dsand3"], legend: DESERT,
    kits: [["house_ash_a", 3, 4], ["house_ash_b", 15, 4], ["mart", 3, 14], ["center", 15, 14]],
    rows: [
      "##########==##########",
      "##########==##########",
      "##^^^^^^^^==^^^^^^^^##",
      "##^^^^^^^^==^^^^^^^^##",
      "##........==..r.....##",
      "##......c.==........##",
      "##........==.d......##",
      "##........==S.......##",
      "##.================.##",
      "##.================.##",
      "##.P...P.c==.gggggg.##",
      "##........==.g~~~~g.##",
      "##...B....==.g~~~~g.##",
      "##.d....r.==.ggggggc##",
      "##........==........##",
      "##........==........##",
      "##........==........##",
      "##........==........##",
      "##.================.##",
      "######################",
    ],
  } },
  snow: { template: "climate/snow_town", sketch: {
    ground: ["snow0", "snow0", "snow1", "snow2", "snow3"],
    legend: {
      "#": { frame: true },
      "=": { group: "snowpath" },
      "~": { group: "pond" },
      p: { tile: ["snow_pile0", "snow_pile1"] },
      b: { tile: ["frost_bush"] },
      S: { tile: ["sign_snow"] },
      P: { prop: "spine_a" },
      M: { prop: "snowman" },
    },
    kits: [["house_snow_a", 3, 3], ["house_snow_b", 15, 3], ["mart", 3, 9], ["center_snow", 15, 9]],
    rows: [
      "##########==##########",
      "##########==##########",
      "##########==##########",
      "##........==........##",
      "##......b.==........##",
      "##........==.p......##",
      "##........==........##",
      "##.================.##",
      "##........==S.......##",
      "##......M.==........##",
      "##........==........##",
      "##........==.b......##",
      "##........==........##",
      "##.================.##",
      "##.P...P.....~~~~~~.##",
      "##...M.......~~~~~~.##",
      "##........pb.~~~~~~.##",
      "######################",
      "######################",
      "######################",
    ],
  } },
  volcano: { template: "climate/ash_town", sketch: {
    ground: ["ash0", "ash1", "ash2", "ash3"], legend: VOLCANO,
    kits: [["house_ash_a", 3, 4], ["house_ash_b", 15, 4], ["mart", 3, 14], ["center_ash", 15, 14]],
    rows: [
      "###Z######==#####C####",
      "##########==##########",
      "##^^^^^^^^==^^^^^^^^##",
      "##^^^^^^^^==^^^^^^^^##",
      "##........==..r.....##",
      "##.....p..==.v......##",
      "##........==........##",
      "##........==S.......##",
      "##.================.##",
      "##.================.##",
      "##.v....r.==.~~~~~~.##",
      "##...p....==.~~~~~~.##",
      "##........==.~~~~~~.##",
      "##........==........##",
      "##........==...p....##",
      "##.r......==........##",
      "##........==....v...##",
      "##........==........##",
      "##.================.##",
      "######################",
    ],
  } },
  coast: { template: "coast/port", sketch: {
    ground: ["grass0", "grass0", "grass1", "grass2", "grass3"],
    legend: {
      "#": { frame: true },
      "=": { group: "pave" },
      "~": { group: "shore" },
      s: { ground: ["sand0", "sand0", "sand1"] },
      f: { tile: ["flower_red", "flower_pink"] },
      F: { tile: ["flowerbed_red", "flowerbed_pink"] },
      b: { tile: ["bush0", "bush1"] },
      S: { tile: ["sign"] },
      P: { prop: "palm", on: ["sand0", "sand1"] },
      L: { prop: "lamp" },
      R: { prop: "parasol_red", on: ["sand0", "sand1"] },
      B: { prop: "bench", on: ["sand0", "sand1"] },
      // 항구 템플릿의 오른쪽 둘레는 잔교·배라 테두리로 옮기면 배가 세로로 늘어선다 — 오른쪽은 나무로 막는다.
      T: { prop: "tree_a" },
    },
    kits: [["cabin_a", 3, 3], ["house_c", 15, 3], ["mart", 3, 8], ["center", 15, 8]],
    rows: [
      "##########==########T.",
      "##########==########..",
      "##########==########..",
      "##......FF==..........",
      "##......FF==L.......T.",
      "##........==..f.......",
      "##........==..........",
      "##.================...",
      "##........==S.......T.",
      "##......f.==..........",
      "##........==.b........",
      "##........==..........",
      "##.================.bb",
      "sssPsssssssssssssPssss",
      "sssssssRsssssBssssssss",
      "ssssssssssssssssssssss",
      "~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~",
      "~~~~~~~~~~~~~~~~~~~~~~",
    ],
  } },
};

/**
 * 시작 테마의 첫 도로. 사막 기획서는 「마을 북쪽 1번 모랫길」인데 풀밭 1번길이 나왔다 — 모래 위 굽은 흙길·오아시스 풀 덩이(풀숲 자리)·
 * 선인장·바위. 출구는 북·남 가운데 두 칸(connect 가 (w/2,2)·(w/2,h-2) 근처를 고른다). 조우는 맵 서식지 사각형 전체라 바닥 그림과 무관하다.
 */
export const START_ROUTES: Partial<Record<StartTheme, { template: string; sketch: TownSketch }>> = {
  desert: { template: "climate/desert", sketch: {
    ground: ["dsand0", "dsand0", "dsand1", "dsand2", "dsand3"], legend: DESERT, kits: [],
    rows: [
      "###########==###########",
      "###########==###########",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##.........==....d..c.##",
      "##.P....c..==...gggg..##",
      "##.......r.==..ggggggg##",
      "##...d.....==.gggggggg##",
      "##.........==.ggggggg.##",
      "##..c.=======...gggc..##",
      "##....=======.........##",
      "##.r..==.......c......##",
      "##.ggg==...gg......ggg##",
      "##gggg==.gggggg....ggg##",
      "##gggg==.gggggg....ggg##",
      "##gggg==.gggggg.r..ggg##",
      "##gggg==.gggggg....ggg##",
      "##.ggg==...gg.......gg##",
      "##....==..d...........##",
      "##....============....##",
      "##.c..============..r.##",
      "##.......B......==....##",
      "##............c.==P...##",
      "##...........r..==....##",
      "##.ggggg........==....##",
      "##.ggggggg.=======....##",
      "##gggggggg.=======....##",
      "##gggggggg.==.......R.##",
      "##.gggggggc==.........##",
      "##..gggg...==.........##",
      "##..c......==.......c.##",
      "###########==###########",
    ],
  } },
  // 눈 기획서의 1번길: 눈 숲 사이 굽은 눈길, 눈 풀숲 덩이(얼음 고개 템플릿에서 그대로 떠 온다), 전나무·눈더미·서리 덤불, 뛰어내리는 눈 둔덕.
  // 둘레는 눈 마을 템플릿(안쪽을 보는 숲 가장자리) — 아래 둘레는 두 줄만 쓴다(템플릿 아래 띠 첫 줄이 눈길이다).
  snow: { template: "climate/snow_town", sketch: {
    ground: ["snow0", "snow0", "snow1", "snow2", "snow3"],
    legend: {
      "#": { frame: true },
      "=": { group: "snowpath" },
      A: { stamp: { from: "climate/ice_route", x: 4, y: 1, w: 6, h: 4 } },
      B: { stamp: { from: "climate/ice_route", x: 12, y: 1, w: 7, h: 4 } },
      p: { tile: ["snow_pile0", "snow_pile1"] },
      b: { tile: ["frost_bush"] },
      r: { tile: ["ice_rock0", "ice_rock1"] },
      l: { tile: ["sledge_s_l"] },
      m: { tile: ["sledge_s_mid", "sledge_s_mid1"] },
      n: { tile: ["sledge_s_r"] },
      P: { prop: "spine_a" },
      M: { prop: "snowman" },
    },
    kits: [],
    rows: [
      "###########==###########",
      "###########==###########",
      "###########==###########",
      "##.P.......==.A.......##",
      "##.......p.==.........##",
      "##.........==.........##",
      "##....=======.........##",
      "##....=======.....r...##",
      "##....==.............b##",
      "##..b.==.....B........##",
      "##....==..............##",
      "##....==.r............##",
      "##lmmn==lmn...........##",
      "##....==..............##",
      "##..r.===========.....##",
      "##....===========...P.##",
      "##.............==.....##",
      "##A............==.....##",
      "##........b....==.....##",
      "##.............==..p..##",
      "##.......M.....==.....##",
      "##.............==.....##",
      "##.........======.....##",
      "##.........======.....##",
      "##.A.......==.........##",
      "##.........==.B.......##",
      "##.........==.........##",
      "##.........==.........##",
      "##.........==.........##",
      "##......p..==.........##",
      "###########==###########",
      "###########==###########",
    ],
  } },
  volcano: { template: "climate/ash_town", sketch: {
    ground: ["ash0", "ash1", "ash2", "ash3"], legend: VOLCANO, kits: [],
    rows: [
      "####Z######==#######C###",
      "###########==###########",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##^^^^^^^^^==^^^^^^^^^##",
      "##.T.......==.A.......##",
      "##.........==.........##",
      "##....=======.....r...##",
      "##....=======.....v...##",
      "##....==..............##",
      "##..p.==.....A........##",
      "##....==..............##",
      "##....==.r............##",
      "##....==..............##",
      "##....==......p.......##",
      "##..r.===========.....##",
      "##....===========.v...##",
      "##.............==.....##",
      "##A............==.....##",
      "##........p....==.....##",
      "##.............==..r..##",
      "##.......v.....==.....##",
      "##.............==.....##",
      "##.........======.....##",
      "##.........======.....##",
      "##.A.......==.........##",
      "##.........==.A.......##",
      "##.........==.........##",
      "##.........==.........##",
      "##.........==.........##",
      "##......p..==.........##",
      "###########==###########",
      "###########==###########",
    ],
  } },
};

/**
 * 화산 캠페인의 재 마을·재 길 변주 — 시작 마을·1번길 한 판으로 끝내지 않고 캠페인 전체를 같은 재(ash) 재료로 깐다.
 * 화산 기획서(「화산 섬 … 체육관 세 개」)가 첫 두 곳만 재 판이고 셋째 마을부터 풀밭·꽃밭이 나왔다(2026-10-14 자유도 감사 v5).
 * 새 그림은 없다: 재 마을 템플릿(climate/ash_town)의 재료로 같은 문법(START_TOWNS.volcano·START_ROUTES.volcano)에서 판만 변주한다 —
 * 좌우 뒤집기·소품(재 더미·용암 바위·증기구멍)·재 풀 덩이(stamp A) 자리를 번호마다 해시로 다시 흩는다.
 * 건물 위치는 안내 문장(「북동쪽 건물이 체육관」)과 world.ts 문 찾기가 기대하는 자리에 고정이다.
 */
export const VOLCANO_TOWN_KEYS = ["home", "grove", "ember", "dune", "frost", "moon"] as const;
export const VOLCANO_ROUTE_KEYS = ["meadow", "forest", "river", "snow", "marsh"] as const;

function variantHash(variant: number, i: number): number {
  let n = Math.imul(variant + 1, 374761393) ^ Math.imul(i + 7, 668265263) ^ 0x6a09e667;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}

/** 격자에서 w×h 빈 땅('.')에 주변 한 칸까지 빈 땅인 자리를 해시 순서로 고른다. 못 찾으면 undefined. */
function freeSpot(grid: string[][], variant: number, salt: number, w: number, h: number, margin: number, boxes: readonly (readonly [number, number, number, number])[]): [number, number] | undefined {
  const H = grid.length, W = grid[0]!.length;
  const spots: [number, number][] = [];
  for (let y = margin; y + h <= H - margin; y++) for (let x = margin; x + w <= W - margin; x++) spots.push([x, y]);
  const start = variantHash(variant, salt) % Math.max(1, spots.length);
  for (let k = 0; k < spots.length; k++) {
    const [x, y] = spots[(start + k * 37) % spots.length]!;
    let ok = true;
    for (let dy = -1; dy <= h && ok; dy++) for (let dx = -1; dx <= w && ok; dx++) {
      const c = grid[y + dy]?.[x + dx];
      if (c !== undefined && c !== ".") ok = false;
    }
    if (ok && boxes.some(([bx, by, bw, bh]) => x < bx + bw + 1 && x + w > bx - 1 && y < by + bh + 1 && y + h > by - 1)) ok = false;
    if (ok) return [x, y];
  }
  return undefined;
}

function variantSketch(base: readonly string[], kits: TownSketch["kits"], kitSizes: Record<string, number>, variant: number, plan: { stamps: number; props: number; big?: number }, seed = variant): TownSketch {
  const grid = base.map(r => [...r]);
  // 번호 판마다 옛 장식(재 더미·바위·증기구멍·재 풀 덩이)은 걷어 다시 흩는다. 길(=)·벼랑(#^)·샘(~)·표지판(S)·꼭대기 원뿔(Z C)은 그대로.
  for (const row of grid) for (let x = 0; x < row.length; x++) if ("prvA".includes(row[x]!)) row[x] = ".";
  const flipped = variant % 2 === 1;
  if (flipped) for (const row of grid) row.reverse();
  const W = grid[0]!.length;
  // 뒤집어도 건물은 안내 문장이 기대하는 자리(집 북서·체육관/연구소 북동·도구점 남서·센터 남동)에 둔다 — 건물 자리는 비워 둔다.
  const boxes = kits.map(([name, x, y]) => [x, y, kitSizes[name] ?? 4, kitSizes[name] ?? 4] as const);
  // 뒤집힌 판은 건물이 원래 자리에 있어야 하므로 그 자리의 칸(길·샘 포함)이 건물 밑에 덮인다 — 길을 깐 칸은 그대로 두고 건물만 얹는다.
  let salt = 0;
  for (let n = 0; n < plan.stamps; n++) {
    const at = freeSpot(grid, seed, salt++, 7, 4, 3, boxes);
    if (at) { grid[at[1]]![at[0]] = "A"; for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 7; dx++) if (dx || dy) grid[at[1] + dy]![at[0] + dx] = "*"; }
  }
  // 큰 소품(재 나무 2×4·화산 원뿔 2×2)을 먼저 흩고 작은 것(재 더미·바위·증기구멍)을 그 틈에 채운다 — 길 판이 빈 회색 평지로 보이던 것을 줄인다.
  const bigMarks: readonly (readonly [string, number, number])[] = [["C", 2, 2], ["C", 2, 2], ["T", 2, 4]];
  for (let n = 0; n < (plan.big ?? 0); n++) {
    const [mark, w, h] = bigMarks[variantHash(seed, 300 + n) % bigMarks.length]!;
    const at = freeSpot(grid, seed, 400 + n, w, h, 2, boxes);
    if (at) { grid[at[1]]![at[0]] = mark; for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (dx || dy) grid[at[1] + dy]![at[0] + dx] = "*"; }
  }
  const marks = ["p", "r", "v"];
  for (let n = 0; n < plan.props; n++) {
    const mark = marks[variantHash(seed, 100 + n) % marks.length]!;
    const h = mark === "v" ? 2 : 1;
    const at = freeSpot(grid, seed, 200 + n, 1, h, 2, boxes);
    if (at) { grid[at[1]]![at[0]] = mark; if (h === 2) grid[at[1] + 1]![at[0]] = "*"; }
  }
  const rows = grid.map(r => r.map(c => (c === "*" ? "." : c)).join(""));
  void W;
  return { ground: ["ash0", "ash1", "ash2", "ash3"], legend: VOLCANO, kits, rows };
}

/** 시작 마을 판에 남쪽 출구를 더한 것 — 이어지는 마을은 북·남 출구가 둘 다 있어야 길이 앞뒤로 이어진다(home 은 북쪽 하나뿐). */
const ASH_THROUGH_TOWN_ROWS: readonly string[] = [
  ...START_TOWNS.volcano.sketch.rows.slice(0, 19),
  "##########==##########",
  "##########==##########",
];

/** 화산 캠페인의 마을 판(home 제외). gym = 그 마을에 체육관이 있다 — 북동 건물이 체육관(7×7, 문은 아래 가운데), 없으면 북동 집. */
export function volcanoTownSketch(index: number, gym: boolean): TownSketch {
  const kits: TownSketch["kits"] = gym
    ? [["house_ash_a", 3, 4], ["gym_fire", 13, 2], ["mart", 3, 14], ["center_ash", 15, 14]]
    : START_TOWNS.volcano.sketch.kits;
  return variantSketch(ASH_THROUGH_TOWN_ROWS, kits, { house_ash_a: 4, house_ash_b: 4, gym_fire: 7, mart: 4, center_ash: 4 }, index, { stamps: 0, props: 9 }, index);
}

/** 길 판 둘: 시작 길(START_ROUTES.volcano)과 다른 굽이의 길. 안쪽 줄을 위아래로 뒤집으면 세 번째 굽이가 된다(출구는 가운데 두 칸이라 대칭). */
const ASH_ROUTE_B: readonly string[] = [
  "####Z######==######C####",
  "###########==###########",
  "##^^^^^^^^^==^^^^^^^^^##",
  "##^^^^^^^^^==^^^^^^^^^##",
  "##.........==.........##",
  "##.........==.........##",
  "##.........==.........##",
  "##.........==.........##",
  "##.........=========..##",
  "##.........=========..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##................==..##",
  "##....==============..##",
  "##....==============..##",
  "##....==..............##",
  "##....==..............##",
  "##....==..............##",
  "##....==..............##",
  "##....=======.........##",
  "##....=======.........##",
  "##.........==.........##",
  "##.........==.........##",
  "##.........==.........##",
  "##.........==.........##",
  "###########==###########",
  "###########==###########",
];
const ASH_ROUTE_C: readonly string[] = [...ASH_ROUTE_B.slice(0, 4), ...ASH_ROUTE_B.slice(4, 28).reverse(), ...ASH_ROUTE_B.slice(28)];

/** 화산 캠페인의 길 판 — 같은 문법에서 굽이(A·B·C)·좌우·재 풀 덩이(A)·소품 자리를 길마다 다르게 한다. index 1~5 = 2·3·5·6·7번길. */
export function volcanoRouteSketch(index: number): TownSketch {
  const [rows, flip]: readonly [readonly string[], boolean] = ([[ASH_ROUTE_B, false], [ASH_ROUTE_C, false], [ASH_ROUTE_B, true], [ASH_ROUTE_C, true], [START_ROUTES.volcano!.sketch.rows, true]] as const)[(index - 1) % 5]!;
  return variantSketch(rows, [], {}, flip ? 1 : 0, { stamps: 6, props: 14, big: 9 }, index);
}

// ─── 시작 마을 판을 판마다 다르게 (2026-10-24 v2 다양성 검수 「몬스터 마을은 늘 같은 19맵」) ───
// 크기·길 짜임·건물 자리와 킷·연못·나무를 손잡이(모델이 고르면 그대로)와 씨앗으로 정한다. 문 넷(집·연구소·센터·도구점)은 늘 같다 —
// 문이 더 있으면 들어갈 방이 없는 문이 생긴다. 연구소는 큰 박공(gable_*) 킷이라 world.ts 가 그 문을 연구소로 잇는다.
export type HomeTownSize = "small" | "medium" | "large";
export type HomeTownStreets = "cross" | "ladder" | "loop" | "jog";
export interface HomeTownLayout { readonly size?: HomeTownSize; readonly streets?: HomeTownStreets; readonly pond?: boolean; readonly seed?: number }
export const HOME_TOWN_SIZES: readonly HomeTownSize[] = ["small", "medium", "large"];
export const HOME_TOWN_STREETS: readonly HomeTownStreets[] = ["cross", "ladder", "loop", "jog"];

function townRng(seed: number): () => number {
  let a = (Math.imul(seed, 0x9e3779b1) + 0x51ed27) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function homeTownSketch(layout: HomeTownLayout = {}): { sketch: TownSketch; used: Required<HomeTownLayout> } {
  const seed = layout.seed ?? 0;
  const r = townRng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const size = layout.size && HOME_TOWN_SIZES.includes(layout.size) ? layout.size : pick(HOME_TOWN_SIZES);
  const streets = layout.streets && HOME_TOWN_STREETS.includes(layout.streets) ? layout.streets : pick(HOME_TOWN_STREETS);
  // 큰 마을(34×30)은 집 넷이 한쪽에 몰리면 반대편이 통째로 빈 초원이었다(2026-10-28 장부 61%) — 고르지 않았으면 연못을 둔다(가장 트인 자리에).
  const pond = typeof layout.pond === "boolean" ? layout.pond : r() < 0.5 || size === "large";
  // 길 자리가 큰 연구소(7×7) 자리를 막으면 다른 길 자리로 다시 짠다. 그래도 안 되면 한 치수 큰 마을로.
  const sizes = [size, ...HOME_TOWN_SIZES.slice(HOME_TOWN_SIZES.indexOf(size) + 1)];
  for (const sz of sizes) for (let k = 0; k < 40; k++) {
    const sketch = homeTownAttempt(sz, streets, pond, seed + k * 7919);
    if (sketch) return { sketch, used: { size: sz, streets, pond, seed } };
  }
  throw Error(`homeTownSketch: no layout for ${size}/${streets} (seed ${seed})`);
}

function homeTownAttempt(size: HomeTownSize, streets: HomeTownStreets, pond: boolean, salt: number): TownSketch | null {
  const r = townRng(salt + 1);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const [W, H] = ({ small: [26, 22], medium: [30, 26], large: [34, 30] } as const)[size];
  const g: string[][] = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y < 3 || y >= H - 3 || x < 2 || x >= W - 2 ? "#" : ".")));
  const cx = W >> 1;
  const inside = (x: number, y: number) => x >= 2 && x < W - 2 && y >= 3 && y < H - 3;
  const path = (x0: number, y0: number, x1: number, y1: number) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (y >= 0 && y < H && x >= 0 && x < W) g[y]![x] = "="; };
  // 북·남 출구(가운데 두 칸) — world.ts connect 가 (w/2, 2) 근처를 문으로 고른다.
  path(cx - 1, 0, cx, 2); path(cx - 1, H - 3, cx, H - 1);
  const rowsAt: number[] = [];
  const top = 3, bot = H - 4;
  if (streets === "cross") {
    const y = top + 4 + Math.floor(r() * (bot - top - 9));
    path(cx - 1, top, cx, bot); path(4, y, W - 5, y + 1); rowsAt.push(y);
  } else if (streets === "ladder") {
    const y1 = top + 3 + Math.floor(r() * 3), y2 = bot - 4 - Math.floor(r() * 3);
    path(cx - 1, top, cx, bot); path(4, y1, W - 5, y1 + 1); path(4, y2, W - 5, y2 + 1); rowsAt.push(y1, y2);
  } else if (streets === "loop") {
    const y1 = top + 3 + Math.floor(r() * 2), y2 = bot - 3 - Math.floor(r() * 2), x1 = 4 + Math.floor(r() * 2), x2 = W - 6 - Math.floor(r() * 2);
    path(cx - 1, top, cx, y1); path(cx - 1, y2, cx, bot);
    path(x1, y1, x2 + 1, y1 + 1); path(x1, y2, x2 + 1, y2 + 1); path(x1, y1, x1 + 1, y2 + 1); path(x2, y1, x2 + 1, y2 + 1); rowsAt.push(y1, y2);
  } else {
    // 꺾인 길: 북쪽에서 내려와 옆으로 비켰다가 다시 가운데로 — 광장 겸 큰 길이 한쪽으로 치우친다.
    const dx = (r() < 0.5 ? -1 : 1) * (4 + Math.floor(r() * 3));
    const y1 = top + 3 + Math.floor(r() * 3), y2 = bot - 3 - Math.floor(r() * 3);
    path(cx - 1, top, cx, y1 + 1); path(Math.min(cx - 1, cx - 1 + dx), y1, Math.max(cx, cx + dx), y1 + 1);
    path(cx - 1 + dx, y1, cx + dx, y2 + 1); path(Math.min(cx - 1, cx - 1 + dx), y2, Math.max(cx, cx + dx), y2 + 1); path(cx - 1, y2, cx, bot);
    rowsAt.push(y1, y2);
  }
  const free = (x: number, y: number, w: number, h: number, pad = 1) => {
    for (let yy = y - pad; yy < y + h + pad; yy++) for (let xx = x - pad; xx < x + w + pad; xx++) {
      if (yy < 3 || yy >= H - 3 || xx < 2 || xx >= W - 2) { if (yy >= y && yy < y + h && xx >= x && xx < x + w) return false; continue; }
      const c = g[yy]![xx]!;
      const inFoot = yy >= y && yy < y + h && xx >= x && xx < x + w;
      if (inFoot ? c !== "." : c !== "." && c !== "=") return false;   // 둘레 한 칸은 길이어도 된다(길가 집)
    }
    return true;
  };
  // 북쪽 출구 둘레(문 둘·표지판 자리)는 비워 둔다.
  const keep = new Set<string>();
  for (let y = 3; y <= 5; y++) for (let x = cx - 3; x <= cx + 2; x++) keep.add(`${x},${y}`);
  const clearOfKeep = (x: number, y: number, w: number, h: number) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (keep.has(`${xx},${yy}`)) return false; return true; };
  const kits: [string, number, number][] = [];
  const mark = (x: number, y: number, w: number, h: number) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) g[yy]![xx] = "K"; };
  /** 문 앞(below 줄)에서 길까지 ㄴ자 샛길: 아래로 0~4칸 내려간 뒤 옆으로 길을 만날 때까지(빈 땅만 지난다). 칸 목록 또는 null. */
  const spurTo = (door: number, below: number): [number, number][] | null => {
    let best: [number, number][] | null = null;
    for (let down = 0; down <= 4; down++) {
      const yy = below + down;
      if (yy >= H - 3) break;
      const col: [number, number][] = [];
      let ok = true;
      for (let y = below; y <= yy; y++) { const c = g[y]![door]!; if (c === "=") { if (!best || col.length < best.length) best = col.slice(); ok = false; break; } if (c !== ".") { ok = false; break; } col.push([door, y]); }
      if (!ok) continue;
      for (const dir of [-1, 1]) {
        const run: [number, number][] = [];
        for (let x = door + dir; x >= 2 && x < W - 2; x += dir) {
          const c = g[yy]![x]!;
          if (c === "=") { const cells = [...col, ...run]; if (!best || cells.length < best.length) best = cells; break; }
          if (c !== ".") break;
          run.push([x, yy]);
        }
      }
    }
    return best;
  };
  const place = (name: string, w: number, h: number): boolean => {
    const cands: [number, number, number][] = [];
    for (let y = 3; y + h <= H - 4; y++) for (let x = 2; x + w <= W - 2; x++) {
      if (!free(x, y, w, h) || !clearOfKeep(x, y, w, h)) continue;
      const door = x + (w >> 1), below = y + h;
      const spur = spurTo(door, below);
      if (!spur || spur.length > 9) continue;
      cands.push([x, y, spur.length + r() * 4]);
    }
    if (!cands.length) return false;
    cands.sort((p, q) => p[2] - q[2]);
    const [x, y] = cands[Math.floor(r() * Math.min(5, cands.length))]!;
    kits.push([name, x, y]); mark(x, y, w, h);
    for (const [sx, sy] of spurTo(x + (w >> 1), y + h) ?? []) g[sy]![sx] = "=";   // 문 앞에서 길까지 샛길
    return true;
  };
  const labKit = pick(["gable_a", "gable_b"]);
  const houseKit = pick(["house_a", "house_b", "house_c", "house_d", "house_e", "house_f", "two_a", "two_b"]);
  const houseH = houseKit.startsWith("two_") ? 6 : 4;
  for (const [name, w, h] of r() < 0.5
    ? [[labKit, 7, 7], [houseKit, 4, houseH], ["center", 4, 4], ["mart", 4, 4]] as const
    : [[labKit, 7, 7], ["center", 4, 4], [houseKit, 4, houseH], ["mart", 4, 4]] as const) {
    if (!place(name, w, h)) return null;
  }
  // 우편함: 집 왼쪽 옆.
  const home = kits.find(([n]) => n === houseKit)!;
  const mbx = home[1] - 1, mby = home[2] + houseH - 1;   // 집 왼쪽 벽 끝 — 문 앞 칸은 비워 둔다(문 자리는 킷마다 다르다)
  if (inside(mbx, mby) && g[mby]![mbx] === ".") g[mby]![mbx] = "M";
  // 빈 땅에 용도를(2026-10-28 장부 「몬스터 마을 61% — 동쪽 빈 초원」): 연못·나무·꽃밭을 상자 안 아무 데나 흩으면 집이 몰린 쪽 반대편이
  // 낱 나무·낱 꽃만 흩어진 빈 초원으로 남았다. 연못과 첫 나무는 가장 트인 자리(둘레 3칸 안 빈 땅이 가장 많은 곳)에, 나머지 나무는
  // 이미 선 나무 곁에 붙여 숲 덩이로, 꽃밭·꽃은 연못·나무 곁에 — 빈 초원이 「연못가 숲」이라는 한 구역이 된다.
  const openness = (x: number, y: number, w: number, h: number) => {
    let n = 0;
    for (let yy = y - 3; yy < y + h + 3; yy++) for (let xx = x - 3; xx < x + w + 3; xx++) if (inside(xx, yy) && g[yy]![xx] === ".") n++;
    return n;
  };
  /** 빈 자리 후보 중 가장 트인 곳(위 셋 가운데 하나). near 를 주면 그 둘레(가로 ±near.r·세로 ±near.r)만. */
  const openSpot = (w: number, h: number, near?: { x: number; y: number; r: number }): [number, number] | null => {
    const spots: [number, number, number][] = [];
    for (let y = 3; y + h <= H - 3; y++) for (let x = 2; x + w <= W - 2; x++) {
      if (near && (Math.abs(x - near.x) > near.r || Math.abs(y - near.y) > near.r)) continue;
      if (free(x, y, w, h) && clearOfKeep(x, y, w, h)) spots.push([x, y, openness(x, y, w, h) + r() * 6]);
    }
    if (!spots.length) return null;
    spots.sort((a, b) => b[2] - a[2]);
    const [x, y] = spots[Math.floor(r() * Math.min(3, spots.length))]!;
    return [x, y];
  };
  const anchors: { x: number; y: number }[] = [];
  if (pond) {
    const pw = 4 + Math.floor(r() * 3), ph = 3 + Math.floor(r() * 2);
    const at = openSpot(pw, ph);
    if (at) { const [x, y] = at; for (let yy = y; yy < y + ph; yy++) for (let xx = x; xx < x + pw; xx++) g[yy]![xx] = "~"; anchors.push({ x: x + (pw >> 1), y: y + (ph >> 1) }); }
  }
  // 나무(2×4): 첫 그루는 연못 곁이나 가장 트인 자리, 다음 그루는 앞 그루 곁(덩이).
  const trees = 2 + Math.floor(r() * 4);
  const planted: { x: number; y: number }[] = [];
  for (let i = 0; i < trees; i++) {
    const prev = planted.length ? planted[Math.floor(r() * planted.length)]! : anchors[0];
    const at = (prev && openSpot(2, 4, { x: prev.x, y: prev.y, r: planted.length ? 3 : 6 })) ?? openSpot(2, 4);
    if (!at) break;
    const [x, y] = at;
    g[y]![x] = r() < 0.6 ? "T" : "U"; for (let yy = y; yy < y + 4; yy++) for (let xx = x; xx < x + 2; xx++) if (!(yy === y && xx === x)) g[yy]![xx] = "_";
    planted.push({ x, y: y + 2 });
  }
  anchors.push(...planted);
  const beds = 1 + Math.floor(r() * 3);
  for (let i = 0; i < beds; i++) {
    const a = anchors.length ? anchors[Math.floor(r() * anchors.length)]! : undefined;
    const at = (a && openSpot(3, 2, { x: a.x, y: a.y, r: 4 })) ?? openSpot(3, 2);
    if (!at) break;
    const [x, y] = at;
    for (let yy = y; yy < y + 2; yy++) for (let xx = x; xx < x + 3; xx++) g[yy]![xx] = "F";
  }
  // 낱 꽃·덤불·바위: 연못·나무·건물 곁 두 칸 안에만(빈 초원 한가운데 낱개 점박이 금지).
  const nearSomething = (x: number, y: number) => {
    for (let yy = y - 2; yy <= y + 2; yy++) for (let xx = x - 2; xx <= x + 2; xx++) { const c = g[yy]?.[xx]; if (c && c !== "." && c !== "=" && c !== "#") return true; }
    return false;
  };
  for (let i = 0, tries = 0; i < 8 + W / 4 && tries < 400; tries++) {
    const x = 2 + Math.floor(r() * (W - 4)), y = 3 + Math.floor(r() * (H - 6));
    if (g[y]![x] !== "." || keep.has(`${x},${y}`) || !free(x, y, 1, 1) || !nearSomething(x, y)) continue;
    g[y]![x] = pick(["f", "f", "f", "b", "o"]); i++;
  }
  for (const row of g) for (let x = 0; x < W; x++) if (row[x] === "K" || row[x] === "_") row[x] = ".";
  return { ground: GRASS, legend: OVERWORLD, kits, rows: g.map((row) => row.join("")) };
}
