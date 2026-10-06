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
  | { frame: true };                // 숲 벽 — 템플릿 둘레를 주기 2 로 이어 붙인다

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
export function composeTown(project: Project, map: GameMap, t: TownTemplate, sketch: TownSketch): void {
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
export type StartTheme = "desert" | "snow" | "coast";
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
};
