// 몬스터 수집(oprn-monster) 키트 어댑터 — 중립 마스크(mask.ts)를 몬스터 던전 시트(monster_dungeon)의 오토타일 벽·바닥·액체로 칠한다(2026-10-15).
//
// 버들항 어댑터와의 차이: 버들항은 「벽 앞면 키트 3줄 + 천장 오토타일」이라 마스크가 3줄 두께를 지켜야 했다. 몬스터 시트는 8이웃 오토타일 벽 한 종류
// (`*_wall`: 앞면·모서리·속 변형 포함)가 전부이므로 열린 칸이 아닌 모든 칸을 벽 그룹으로 칠하고 variantMap 이 앞면·가장자리를 정한다.
// 새 그림은 그리지 않는다 — 시트에 이미 있는 그룹·칸·키트만 쓴다. 시트에 없는 종류는 어댑터가 거절한다(capabilities.ts).
//
// 시트가 그릴 수 있는 것: cave(젖은 바위 동굴+물웅덩이·바위섬 둑길) · volcano(화산암 벽+용암+식은 껍질 다리) · ice(얼음 동굴 벽+눈 바닥+미끄럼 판)
//                      · labyrinth(유적 돌담 미로 — 아래 RUIN 키트). 방+통로 사각 문법(catacomb/castle/sewer/temple/mine)은 ru_/pw_/gh_ 조각이
//                      고정 직사각 방이라 마스크를 못 따라가므로 지원하지 않는다.
import type { AutotileGroup, StructureKitDef, TilesetDef } from "@/project/types";
import { AUTOTILE_DIR, shadeAutotileInterior } from "@/project/defaults/autotileEngine";
import { DungeonComposeError } from "../errors";
import { hash01, rng, vnoise } from "../grid";
import { layoutBlob, layoutMaze } from "../layouts";
import { layoutDungeon } from "../layoutRooms";
import { buildMask } from "../mask";
import { GRAMMAR } from "../grammar";
import type { DungeonCompose, DungeonSpec, DungeonType, PlacedRoom } from "../types";

export type MonsterSheet = "dungeon" | "overworld";

/** 한 종류를 그리는 시트 조각표. 번호는 monster-dungeon.json 의 칸 번호(라벨은 시트 tileMeta 가 정본). */
interface Deco {
  /** 키트 id(1×2·2×2 소품) 또는 위층 단칸 번호. */
  readonly kit?: string;
  readonly upper?: number;
  /** 걸을 수 있는 장식(위층 덧그림)이면 true — 길을 막지 않으므로 연결 검사를 건너뛴다. */
  readonly walk?: boolean;
  readonly w: number;
  /** 방 하나당 놓을 개수 범위 [min, max] — 방 크기에 따라 비례. */
  readonly per: readonly [number, number];
  /** 벽에서 떨어질 칸(바깥 가장자리 한 줄은 비운다). */
  readonly inset?: number;
  readonly kinds?: readonly string[];
}

interface MonsterKit {
  readonly label: string;
  /** 이 조각표가 쓰는 시트: dungeon = monster_dungeon(바다·화산·얼음·유적), overworld = monster_overworld(마른 갈색 동굴). */
  readonly sheet: MonsterSheet;
  readonly wall: string;
  readonly voidTile: number;
  /** 바닥 변형 번호(칸 해시로 섞는다). */
  readonly floor: readonly number[];
  readonly floorWeights?: readonly number[];
  /** 가끔 섞는 바닥(불씨·웅덩이). */
  readonly speck?: { readonly tiles: readonly number[]; readonly p: number };
  readonly liquid?: { readonly group: string; readonly bridge: string };
  /** 얼음: 방 안쪽을 미끄럼 판 오토타일로 덮는다. */
  readonly plate?: string;
  readonly deco: readonly Deco[];
  /** 입구(올라가는 곳) 위층 덧그림: 굴 입구 / 사다리. */
  readonly mouth: number;
  readonly ladder: number;
  /** 바닥 구멍 사다리(아래층으로). */
  readonly hole: number;
  /**
   * 벽 모양: field = 열린 칸이 아닌 모든 칸이 벽(동굴 — 맨 바깥 한 줄만 어둠 + 속 변형), plateau = 열린 칸이 아닌 모든 칸이 같은 벽 오토타일(유적 돌담:
   * 속 변형이 없어 바깥이 한 장짜리 높은 대지가 된다 — 시트의 「방 바깥 여백」 줄무늬 칸은 쓰지 않는다). 기본 field.
   */
  readonly wallStyle?: "field" | "plateau";
  /** field 벽을 열린 칸에서 이만큼 안쪽까지만 벽 그림으로 두고 그 바깥은 허공 칸으로 둔다(벽과 바닥 명암이 비슷한 동굴을 어두운 덩이로 읽히게). 생략하면 끝까지 벽. */
  readonly wallReach?: number;
  /** 입구 표시: 어디에(N 북쪽 벽 앞면 위 / S 입구 방 아래 벽 줄), 어느 층에 그리나. 기본 N·upper(mouth). */
  readonly entry?: { readonly side: "N" | "S"; readonly tile: number; readonly layer: "lower" | "upper" };
  /** 층마다 바닥을 종류별로(방 종류 → 변형 번호). */
  readonly floorByKind?: Partial<Record<string, readonly number[]>>;
  /** 신전 연출: nave 에 열주, boss 에 제단. */
  readonly temple?: { readonly pillar: string; readonly altar: string };
}

const KIT = (id: string) => `mk-monster-dungeon-${id}`;

export const MONSTER_KITS: Record<string, MonsterKit> = {
  // 마른 갈색 동굴(포켓몬 길 동굴): monster_overworld 의 cave_wall + 동굴 바닥 + 석순. 물은 없다.
  cave: {
    label: "마른 동굴(갈색 바위 벽 + 동굴 모래 바닥)", sheet: "overworld", wall: "cave_wall", voidTile: 693, wallReach: 3,
    floor: [688, 689, 690, 691, 692], floorWeights: [4, 3, 3, 2, 2],
    deco: [
      { kit: "mk-monster-overworld-stalag", w: 1, per: [1, 3], inset: 1 },
      { kit: "mk-monster-overworld-stalag_b", w: 1, per: [0, 2], inset: 1 },
    ],
    mouth: 753, ladder: 753, hole: 752, entry: { side: "N", tile: 753, layer: "lower" },
  },
  "cave:wet": {
    label: "바다 동굴(젖은 바위 벽 + 물웅덩이)", sheet: "dungeon", wall: "se_wall", voidTile: 1520, wallReach: 3,
    floor: [1056, 1057, 1058, 1059, 1060], floorWeights: [5, 3, 3, 2, 2], speck: { tiles: [1061], p: 0.012 },
    liquid: { group: "se_pool", bridge: "se_isle" },
    deco: [
      { kit: KIT("se_stal"), w: 1, per: [1, 3], inset: 1 },
      { upper: 1063, walk: true, w: 1, per: [0, 2], inset: 1 },
      { upper: 1067, w: 1, per: [0, 2], inset: 2 },
      { upper: 1066, w: 1, per: [0, 1], inset: 1, kinds: ["lake", "grotto"] },
    ],
    mouth: 1506, ladder: 1505, hole: 1507,
  },
  volcano: {
    label: "화산 동굴(화산암 벽 + 용암 + 식은 껍질 다리)", sheet: "dungeon", wall: "lv_wall", voidTile: 960, wallReach: 3,
    floor: [176, 177, 178, 179, 180, 181, 182], floorWeights: [3, 3, 3, 3, 2, 1, 1], speck: { tiles: [183], p: 0.02 },
    liquid: { group: "lv_lava", bridge: "lv_cb" },
    deco: [
      { kit: KIT("lv_stal"), w: 1, per: [1, 3], inset: 1 },
      { kit: KIT("lv_vent"), w: 1, per: [0, 2], inset: 2, kinds: ["forge", "cavern", "lake"] },
      { upper: 186, w: 1, per: [0, 2], inset: 2 },
      { upper: 251, walk: true, w: 1, per: [0, 3], inset: 1 },
    ],
    mouth: 945, ladder: 944, hole: 946,
  },
  ice: {
    label: "얼음 동굴(얼음 벽 + 눈 바닥 + 미끄럼 판)", sheet: "dungeon", wall: "ic_wall", voidTile: 80,
    floor: [0, 1, 2, 3, 4], floorWeights: [4, 3, 3, 2, 1],
    plate: "ic_ice",
    deco: [
      { kit: KIT("ic_stal"), w: 1, per: [1, 3], inset: 1 },
      { upper: 9, w: 1, per: [0, 2], inset: 1 },
      { upper: 10, w: 1, per: [0, 2], inset: 1 },
      { upper: 7, w: 1, per: [0, 2], inset: 2 },
    ],
    mouth: 65, ladder: 64, hole: 66,
  },
  labyrinth: {
    label: "유적 미궁(유적 돌담 칸막이 미로 + 모래 바닥)", sheet: "dungeon", wall: "ru_pb", voidTile: 1520, wallStyle: "plateau",
    floor: [1776, 1777, 1778, 1779], floorWeights: [4, 3, 2, 2],
    deco: [
      { upper: 1840, w: 1, per: [0, 2], inset: 0 },
      { upper: 1842, w: 1, per: [0, 2], inset: 0 },
    ],
    mouth: 1792, ladder: 1792, hole: 1792, entry: { side: "S", tile: 1792, layer: "lower" },
  },
  temple: {
    label: "유적 신전(유적 돌담 + 열주 홀 + 제단)", sheet: "dungeon", wall: "ru_pb", voidTile: 1520, wallStyle: "plateau",
    floor: [1776, 1777, 1778, 1779], floorWeights: [4, 3, 2, 2],
    floorByKind: { nave: [1780, 1781, 1782, 1783], boss: [1780, 1781, 1782, 1783], vault: [1780, 1781, 1782, 1783], shrine: [1780, 1781, 1782, 1783] },
    deco: [
      { upper: 1840, w: 1, per: [0, 2], inset: 1 },
      { upper: 1842, w: 1, per: [0, 2], inset: 1, kinds: ["shrine", "crypt", "storage", "hall", "vault"] },
    ],
    temple: { pillar: KIT("ru_pillar"), altar: KIT("ru_altar") },
    mouth: 1792, ladder: 1792, hole: 1792, entry: { side: "S", tile: 1792, layer: "lower" },
  },
};

const groupOf = (ts: TilesetDef, id: string): AutotileGroup | undefined => (ts.autotileGroups ?? []).find((g) => g.id === id);

/** 이 타일셋이 몬스터 던전 시트인가(그룹으로 판정 — 에메랄드 재채색 시트도 같은 그룹을 가진다). */
export function isMonsterDungeonTileset(ts: TilesetDef | undefined): boolean {
  return !!ts && !!groupOf(ts, "lv_wall") && !!groupOf(ts, "se_wall") && !!groupOf(ts, "ic_wall");
}
/** 이 타일셋이 몬스터 오버월드 시트(마른 동굴 벽 cave_wall 이 있는 시트)인가. */
export function isMonsterOverworldTileset(ts: TilesetDef | undefined): boolean {
  return !!ts && !!groupOf(ts, "cave_wall") && !!groupOf(ts, "gface");
}
export const isMonsterSheet = (ts: TilesetDef | undefined, sheet: MonsterSheet): boolean => (sheet === "dungeon" ? isMonsterDungeonTileset(ts) : isMonsterOverworldTileset(ts));

/** 종류(+변형)에 맞는 조각표. 없으면 undefined(어댑터가 못 짓는 종류). */
export function monsterKitFor(type: DungeonType, variant?: string): MonsterKit | undefined {
  return (variant ? MONSTER_KITS[`${type}:${variant}`] : undefined) ?? MONSTER_KITS[type];
}
/** type 의 변형 이름 목록(없으면 빈 배열) — 도구 설명·검사에 쓴다. */
export function monsterVariants(type: DungeonType): string[] {
  return Object.keys(MONSTER_KITS).filter((k) => k.startsWith(`${type}:`)).map((k) => k.slice(type.length + 1));
}

const BITS: readonly (readonly [number, number, number])[] = [
  [0, -1, AUTOTILE_DIR.N], [1, 0, AUTOTILE_DIR.E], [0, 1, AUTOTILE_DIR.S], [-1, 0, AUTOTILE_DIR.W],
  [1, -1, AUTOTILE_DIR.NE], [1, 1, AUTOTILE_DIR.SE], [-1, 1, AUTOTILE_DIR.SW], [-1, -1, AUTOTILE_DIR.NW],
];

export function composeMonsterDungeon(ts: TilesetDef, spec: DungeonSpec): DungeonCompose {
  const type: DungeonType = spec.type ?? "cave";
  const kit = monsterKitFor(type, spec.variant);
  if (!kit) throw new DungeonComposeError(`이 칩셋(몬스터 수집)은 ${type} 을 못 짓는다 — 고정 직사각 방 조각뿐이라 방 배치를 따라 그릴 수 없다. 가장 가까운 종류: cave(바다 동굴).`, "type-unsupported-by-tileset");
  if (!isMonsterSheet(ts, kit.sheet)) throw new DungeonComposeError(`이 타일셋은 몬스터 ${kit.sheet === "dungeon" ? "던전 시트(monster_dungeon — 용암·바다·얼음·유적 벽 그룹)" : "오버월드 시트(monster_overworld — 마른 동굴 벽 cave_wall)"}가 아니다.`, "kit-missing");
  const wallG = groupOf(ts, kit.wall);
  if (!wallG) throw new DungeonComposeError(`타일셋에 벽 그룹 ${kit.wall} 이 없다.`, "kit-missing");
  // 마른 동굴은 물이 없다 — 문법의 액체를 끈다(호수 방도 일반 동굴 방이 된다).
  const info = kit.liquid ? GRAMMAR[type] : { ...GRAMMAR[type], liquid: undefined };
  const specT: DungeonSpec = { ...spec, type };
  const layout = info.grammar === "maze" ? layoutMaze(specT, kit.wallStyle === "plateau") : info.grammar === "blob" ? layoutBlob(specT, info) : layoutDungeon(specT);
  const seed = spec.seed ?? 7;
  const mask = buildMask(layout, info, type, spec, seed);
  const g = mask.grid;
  const { W, H } = g;
  const { rooms, corridors } = layout;
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const open = (x: number, y: number) => inb(x, y) && g.floor[idx(x, y)] === 1;
  const liq = (x: number, y: number) => inb(x, y) && g.liquid[idx(x, y)] === 1;
  const brg = (x: number, y: number) => inb(x, y) && g.bridge[idx(x, y)] === 1;
  const warnings = mask.warnings;
  const lower = new Array<number>(W * H).fill(kit.voidTile);
  const upper = new Array<number>(W * H).fill(-1);
  const view = { width: W, height: H, lowerTiles: lower };
  const maskOf = (x: number, y: number, on: (x: number, y: number) => boolean): number => {
    let m = 0;
    for (const [dx, dy, bit] of BITS) if (on(x + dx, y + dy)) m |= bit;
    return m;
  };

  // ---- 벽: 열린 칸이 아닌 모든 칸. 맨 바깥 한 줄은 「동굴 밖 어둠」. 벽 변형은 이웃이 열렸는지로 정한다(맵 밖은 벽으로 본다). ----
  const ring = false;
  const plateau = kit.wallStyle === "plateau";
  const nearOpen = (x: number, y: number) => { for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (open(x + dx, y + dy)) return true; return false; };
  // plateau(유적 돌담): 속 변형이 없어 방 바깥 전체가 옅은 민트 대지 한 장으로 깔렸다(출하 플레이어에서도 같다 — 칸 1902 = ru_pb 255 마스크). 열린 칸에서 PLATEAU_REACH 칸 안쪽만 돌담 대지로 두고 그 바깥은 어두운 허공 칸으로 둔다.
  const PLATEAU_REACH = kit.wallReach ?? 2;
  const nearOpenR = (x: number, y: number, r: number) => { for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (open(x + dx, y + dy)) return true; return false; };
  const isWall = (x: number, y: number) => inb(x, y) && !open(x, y) && (!ring || nearOpen(x, y)) && ((!plateau && kit.wallReach === undefined) || nearOpenR(x, y, PLATEAU_REACH));
  // field: 맵 밖은 벽으로 본다(가장자리 칸이 이어진 벽). ring: 맵 밖은 바깥 여백.
  const wallOn = (x: number, y: number) => (inb(x, y) ? isWall(x, y) : !ring && !plateau && kit.wallReach === undefined);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (open(x, y)) continue;
    if (!plateau && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) continue;   // 바깥 어둠
    if (!isWall(x, y)) continue;
    lower[idx(x, y)] = wallG.variantMap[String(maskOf(x, y, wallOn))] ?? wallG.variantMap["255"]!;
  }
  if (!plateau) shadeAutotileInterior(view, wallG);

  // ---- 바닥 ----
  const wsum = (kit.floorWeights ?? kit.floor.map(() => 1)).reduce((a, b) => a + b, 0);
  const pickFloor = (x: number, y: number): number => {
    let r = hash01(x, y, seed * 31 + 7) * wsum;
    const ws = kit.floorWeights ?? kit.floor.map(() => 1);
    for (let i = 0; i < kit.floor.length; i += 1) { r -= ws[i]!; if (r <= 0) return kit.floor[i]!; }
    return kit.floor[0]!;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!open(x, y) || liq(x, y) || brg(x, y)) continue;
    const ri = g.roomAt[idx(x, y)]!;
    const byKind = ri >= 0 ? kit.floorByKind?.[rooms[ri]!.kind] : undefined;
    if (byKind) { lower[idx(x, y)] = byKind[(y & 1) * 2 + (x & 1)] ?? byKind[0]!; continue; }
    lower[idx(x, y)] = kit.speck && hash01(x, y, seed + 91) < kit.speck.p ? kit.speck.tiles[Math.floor(hash01(x, y, seed + 5) * kit.speck.tiles.length)]! : pickFloor(x, y);
  }

  // ---- 액체와 다리 ----
  let liquidCells = 0;
  const liqG = kit.liquid ? groupOf(ts, kit.liquid.group) : undefined;
  const brgG = kit.liquid ? groupOf(ts, kit.liquid.bridge) : undefined;
  if (kit.liquid && (!liqG || !brgG)) warnings.push(`타일셋에 액체 그룹(${kit.liquid.group}·${kit.liquid.bridge})이 없어 액체를 그리지 못했다.`);
  if (liqG && brgG) {
    const liqLike = (x: number, y: number) => liq(x, y) || brg(x, y);
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!liq(x, y)) continue;
      liquidCells += 1;
      lower[idx(x, y)] = liqG.variantMap[String(maskOf(x, y, liqLike))] ?? liqG.variantMap["255"]!;
    }
    shadeAutotileInterior(view, liqG);
    // 다리: 용암은 식은 껍질 판, 물은 바위섬 둑길. 끝은 바닥으로 이어 보이게 바닥 이웃을 이어진 것으로 센다.
    const bridgeOn = (x: number, y: number) => brg(x, y) || (open(x, y) && !liq(x, y));
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!brg(x, y)) continue;
      lower[idx(x, y)] = brgG.variantMap[String(maskOf(x, y, bridgeOn))] ?? brgG.variantMap["255"]!;
    }
  }

  // ---- 얼음: 방 안쪽 큰 판(미끄럼) ----
  const plateG = kit.plate ? groupOf(ts, kit.plate) : undefined;
  const plate = new Uint8Array(W * H);
  if (plateG) {
    for (const r of rooms) {
      if (r.kind !== "lake" && r.kind !== "cavern" && r.kind !== "boss") continue;
      if (r.kind === "boss") continue;
      const ri = rooms.indexOf(r);
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
        if (!open(x, y) || g.roomAt[idx(x, y)] !== ri || g.protect[idx(x, y)]) continue;
        let inner = true;
        for (let dy = -2; dy <= 2 && inner; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (!open(x + dx, y + dy) || g.roomAt[idx(x + dx, y + dy)] !== ri) { inner = false; break; }
        if (inner && vnoise(x, y, 6, seed * 5 + ri) > 0.28) plate[idx(x, y)] = 1;
      }
    }
    const plateOn = (x: number, y: number) => inb(x, y) && plate[idx(x, y)] === 1;
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (plate[idx(x, y)]) lower[idx(x, y)] = plateG.variantMap[String(maskOf(x, y, plateOn))] ?? plateG.variantMap["255"]!;
  }

  // ---- 걷기·연결 검사 도구 ----
  const passTile = (tile: number) => { const pass = ts.passability[tile]; return !!pass && Object.values(pass).some(Boolean); };
  const blocked = new Uint8Array(W * H);
  const stand = (x: number, y: number) => open(x, y) && !blocked[idx(x, y)] && passTile(lower[idx(x, y)]!) && (upper[idx(x, y)]! < 0 || passTile(upper[idx(x, y)]!));
  const kitDefs = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((k) => [k.id, k]));
  const roomCells = (r: PlacedRoom, inset = 0): [number, number][] => {
    const ri = rooms.indexOf(r);
    const out: [number, number][] = [];
    for (let y = r.y + inset; y < r.y + r.h - inset; y += 1) for (let x = r.x + inset; x < r.x + r.w - inset; x += 1) if (open(x, y) && g.roomAt[idx(x, y)] === ri) out.push([x, y]);
    return out;
  };
  const reach = (): Uint8Array => {
    const seen = new Uint8Array(W * H);
    const r0 = rooms[0]!;
    const cells = roomCells(r0).filter(([x, y]) => stand(x, y));
    const start = cells[Math.floor(cells.length / 2)];
    if (!start) throw new DungeonComposeError("입구 방에 설 수 있는 바닥이 없다.", "no-entrance");
    const stack: [number, number][] = [start]; seen[idx(start[0], start[1])] = 1;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
        seen[idx(nx, ny)] = 1; stack.push([nx, ny]);
      }
    }
    return seen;
  };
  // 핵심 칸: 방마다 하나(가운데에 가장 가까운 걸을 수 있는 칸) + 통로 가운데 — 물건을 놓을 때마다 이것들이 모두 닿는지 본다.
  const keyCells: [number, number][] = [];
  rooms.forEach((r) => {
    const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
    let best: [number, number] | null = null; let bd = Infinity;
    for (const [x, y] of roomCells(r)) { if (!stand(x, y) || brg(x, y)) continue; const d = Math.abs(x - cx) + Math.abs(y - cy); if (d < bd) { bd = d; best = [x, y]; } }
    if (best) keyCells.push(best);
  });
  for (const c of corridors) { const x = c.rect.x + Math.floor(c.rect.w / 2), y = c.rect.y + Math.floor(c.rect.h / 2); if (stand(x, y)) keyCells.push([x, y]); }
  const connected = (): boolean => {
    const seen = reach();
    return keyCells.every(([x, y]) => !stand(x, y) || seen[idx(x, y)] === 1);
  };

  // ---- 장식: 방마다 개수 범위 안에서, 벽에서 떨어진 칸에, 길을 막지 않을 때만 ----
  const counts: Record<string, number> = {};
  const tooNearOther = (x: number, y: number, h: number): boolean => {
    for (let dy = -1; dy <= h; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inb(x + dx, y + dy) && (upper[idx(x + dx, y + dy)]! >= 0 || blocked[idx(x + dx, y + dy)])) return true;
    return false;
  };
  const putDeco = (d: Deco, x: number, y: number): boolean => {
    const def = d.kit ? kitDefs.get(d.kit) : undefined;
    if (d.kit && !def) return false;
    const w = def?.width ?? 1, h = def?.height ?? 1;
    const cells: { x: number; y: number; up: number; lo: number }[] = [];
    for (let dy = 0; dy < h; dy += 1) for (let dx = 0; dx < w; dx += 1) {
      const X = x + dx, Y = y + dy;
      const up = def ? (def.rows[dy]!.upperTiles?.[dx] ?? -1) : d.upper!;
      const lo = def ? (def.rows[dy]!.tiles[dx] ?? -1) : -1;
      if (up < 0 && lo < 0) continue;
      // 받침: 소품의 맨 아래 칸은 걸을 수 있는 바닥, 윗칸은 바닥이거나 벽(1×2 석순이 벽 앞에 서는 경우). 액체·다리·문 앞·미끄럼 판은 안 된다.
      const bad = !inb(X, Y) || liq(X, Y) || brg(X, Y) || plate[idx(X, Y)] === 1 || g.protect[idx(X, Y)] === 1;
      if (bad) return false;
      if (dy === h - 1 ? !open(X, Y) : (!open(X, Y) && lower[idx(X, Y)] === kit.voidTile)) return false;
      if (upper[idx(X, Y)]! >= 0 || blocked[idx(X, Y)]) return false;
      cells.push({ x: X, y: Y, up, lo });
    }
    if (!cells.length) return false;
    if (!d.walk && tooNearOther(x, y, h)) return false;
    const before = cells.map((c) => [lower[idx(c.x, c.y)]!, upper[idx(c.x, c.y)]!] as const);
    for (const c of cells) {
      if (c.lo >= 0) lower[idx(c.x, c.y)] = c.lo;
      if (c.up >= 0) upper[idx(c.x, c.y)] = c.up;
      if (!d.walk && c.up >= 0 && !passTile(c.up)) blocked[idx(c.x, c.y)] = 1;
    }
    if (!d.walk && !connected()) {
      cells.forEach((c, i) => { lower[idx(c.x, c.y)] = before[i]![0]; upper[idx(c.x, c.y)] = before[i]![1]; blocked[idx(c.x, c.y)] = 0; });
      return false;
    }
    const label = d.kit ? d.kit.replace(/^mk-monster-dungeon-/, "") : `tile${d.upper}`;
    counts[label] = (counts[label] ?? 0) + 1;
    return true;
  };
  rooms.forEach((r, ri) => {
    if (r.kind === "entrance" && r.w * r.h < 40) return;
    const rs = rng(seed * 97 + ri * 31 + 5);
    for (const d of kit.deco) {
      if (d.kinds && !d.kinds.includes(r.kind)) continue;
      const area = roomCells(r).length;
      const scale = Math.min(2, Math.max(0.5, area / 70));
      const n = Math.round((d.per[0] + rs() * (d.per[1] - d.per[0] + 0.99)) * scale);
      const cands = roomCells(r, d.inset ?? 1);
      for (let k = 0; k < n && cands.length; k += 1) {
        for (let tries = 0; tries < 12; tries += 1) {
          const [x, y] = cands[Math.floor(rs() * cands.length)]!;
          if (putDeco(d, x, y)) break;
        }
      }
    }
  });
  // 신전: 신랑(nave)에 양옆 열주, 성소(boss)에 제단
  if (kit.temple) {
    rooms.forEach((r) => {
      if (r.kind === "nave") {
        for (const x of [r.x + 2, r.x + r.w - 3]) for (let y = r.y + 2; y < r.y + r.h - 2; y += 3) putDeco({ kit: kit.temple!.pillar, w: 1, per: [1, 1] }, x, y);
      } else if (r.kind === "boss") {
        const cx = r.x + Math.floor(r.w / 2) - 1;
        for (const dx of [0, -1, 1, -2, 2]) if (putDeco({ kit: kit.temple!.altar, w: 2, per: [1, 1] }, cx + dx, r.y + 1)) break;
        for (const x of [r.x + 2, r.x + r.w - 3]) putDeco({ kit: kit.temple!.pillar, w: 1, per: [1, 1] }, x, r.y + r.h - 4);
      }
    });
  }
  // 얼음 판 위 바위 몇 개(미끄럼을 멈추는 자리)
  if (plateG) {
    const rs = rng(seed * 53 + 11);
    const cells: [number, number][] = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (plate[idx(x, y)]) cells.push([x, y]);
    const rock: Deco = { upper: 8, w: 1, per: [1, 1] };
    for (let k = 0, n = Math.min(10, Math.floor(cells.length / 18)); k < n; k += 1) putDeco(rock, ...cells[Math.floor(rs() * cells.length)]!);
  }
  void warnings;

  // ---- 입구(올라가는 곳)·아래층 구멍 ----
  const entranceRoom = rooms[0]!;
  let stairsUp: DungeonCompose["stairsUp"] = null;
  {
    const entry = kit.entry ?? { side: "N" as const, tile: kit.mouth, layer: "upper" as const };
    const cx = entranceRoom.x + entranceRoom.w / 2;
    const floorCells = roomCells(entranceRoom).filter(([x, y]) => stand(x, y));
    if (entry.side === "N") {
      const cands = floorCells.filter(([x, y]) => !open(x, y - 1) && !open(x, y - 2) && isWall(x, y - 1))
        .sort((a, b) => a[1] - b[1] || Math.abs(a[0] - cx) - Math.abs(b[0] - cx));
      const c = cands[0];
      if (c) { (entry.layer === "upper" ? upper : lower)[idx(c[0], c[1] - 1)] = entry.tile; stairsUp = { x: c[0], y: c[1] - 1, front: { x: c[0], y: c[1] } }; counts["entrance-mouth"] = 1; }
    } else {
      const cands = floorCells.filter(([x, y]) => !open(x, y + 1) && isWall(x, y + 1))
        .sort((a, b) => b[1] - a[1] || Math.abs(a[0] - cx) - Math.abs(b[0] - cx));
      const c = cands[0];
      if (c) { (entry.layer === "upper" ? upper : lower)[idx(c[0], c[1] + 1)] = entry.tile; stairsUp = { x: c[0], y: c[1] + 1, front: { x: c[0], y: c[1] } }; counts["entrance-mouth"] = 1; }
    }
  }
  const dist = (r: PlacedRoom) => r.depth;
  const deep = [...rooms].filter((r) => r.kind === "boss").sort((a, b) => dist(b) - dist(a))[0] ?? [...rooms].sort((a, b) => dist(b) - dist(a))[0] ?? null;
  let stairsDown: DungeonCompose["stairsDown"] = null;
  if (deep && deep !== entranceRoom && kit.hole !== kit.mouth) {
    const cx = deep.x + deep.w / 2, cy = deep.y + deep.h / 2;
    const cands = roomCells(deep, 2).filter(([x, y]) => upper[idx(x, y)]! < 0 && !blocked[idx(x, y)] && !liq(x, y) && !brg(x, y) && !plate[idx(x, y)] && !g.protect[idx(x, y)]
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => stand(x + dx, y + dy))))
      .sort((a, b) => Math.abs(a[0] - cx) + Math.abs(a[1] - cy) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)));
    for (const [x, y] of cands) {
      const was = lower[idx(x, y)]!;
      lower[idx(x, y)] = kit.hole; blocked[idx(x, y)] = 1;
      if (!connected()) { lower[idx(x, y)] = was; blocked[idx(x, y)] = 0; continue; }
      stairsDown = { x, y };
      counts["stairs-down"] = 1;
      break;
    }
  }

  // ---- 검사: 입구에서 모든 방 바닥이 걸어서 닿는다 ----
  const seen = reach();
  const unreachable = rooms.filter((r) => !roomCells(r).some(([x, y]) => seen[idx(x, y)]));
  if (unreachable.length) throw new DungeonComposeError(`시공기 내부 오류: 입구에서 걸어 닿지 않는 방 ${unreachable.map((r) => r.id).join(", ")}`, "unreachable");
  // 위층 장식이 허공(바깥 어둠·벽 속)에 놓였는지 — 소품의 맨 아래 칸은 항상 바닥이어야 한다(위 putDeco 가 보장하지만 결과로 한 번 더).
  const floating: string[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const u = upper[idx(x, y)]!;
    if (u < 0 || u === kit.mouth || u === kit.entry?.tile) continue;
    const cellOpen = open(x, y);
    const belowOpen = open(x, y + 1);
    if (!cellOpen && !belowOpen) floating.push(`(${x},${y})`);
  }
  if (floating.length) throw new DungeonComposeError(`시공기 내부 오류: 받침 없는 장식 ${floating.length}곳 ${floating.slice(0, 4).join(" ")}`, "support-violation");

  // 이벤트 자리(spots): 위층 그림이 없고 네 이웃도 걸을 수 있고 입구에서 닿는 칸, 방 가운데에서 가까운 순, 서로 3칸 이상.
  const spots: Record<string, { x: number; y: number }[]> = {};
  for (const r of rooms) {
    const cx = r.x + (r.w - 1) / 2, cy = r.y + (r.h - 1) / 2;
    const cells = roomCells(r, 1)
      .filter(([x, y]) => upper[idx(x, y)]! < 0 && !blocked[idx(x, y)] && seen[idx(x, y)] && !g.protect[idx(x, y)] && !brg(x, y) && !plate[idx(x, y)]
        && ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).every(([ox, oy]) => stand(x + ox, y + oy)))
      .map(([x, y]) => ({ x, y, d: Math.abs(x - cx) + Math.abs(y - cy) }))
      .sort((a, b) => a.d - b.d);
    const picked: { x: number; y: number }[] = [];
    for (const c of cells) { if (picked.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3)) picked.push({ x: c.x, y: c.y }); if (picked.length >= 6) break; }
    spots[r.id] = picked;
  }

  // 앵커
  const bossRoom = rooms.find((r) => r.kind === "boss") ?? null;
  const vaultRoom = rooms.find((r) => r.kind === "vault") ?? null;
  const gateRoom = vaultRoom ?? bossRoom;
  const gateCorridor = gateRoom ? corridors.find((c) => c.b === gateRoom.id && !c.loop) : null;
  const gate = gateCorridor && gateRoom ? (() => {
    const r = gateCorridor.rect; const x = r.x + Math.floor(r.w / 2), y = r.y + Math.floor(r.h / 2);
    return stand(x, y) && seen[idx(x, y)] ? { x, y, to: gateRoom.id } : null;
  })() : null;
  const startRoomCells = roomCells(entranceRoom).filter(([x, y]) => stand(x, y));
  const entrance = stairsUp ? stairsUp.front : (() => { const c = startRoomCells[Math.floor(startRoomCells.length / 2)]!; return { x: c[0], y: c[1] }; })();

  const picture: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let line = "";
    for (let x = 0; x < W; x += 1) line += upper[idx(x, y)]! >= 0 && !passTile(upper[idx(x, y)]!) ? "o" : liq(x, y) ? "~" : brg(x, y) ? "=" : plate[idx(x, y)] ? "i" : open(x, y) ? "." : lower[idx(x, y)] === kit.voidTile ? "#" : "W";
    picture.push(line);
  }
  return {
    type, liquid: { kind: info.liquid ?? null, cells: liquidCells, bridges: mask.bridgeCount },
    width: W, height: H, lower, upper, rooms, corridors, entrance, stairsUp, stairsDown,
    anchors: { boss: bossRoom?.id ?? null, treasure: vaultRoom?.id ?? null, gate }, spots, picture, counts, warnings,
    adapter: "monster", tilesetId: ts.id,
  };
}
