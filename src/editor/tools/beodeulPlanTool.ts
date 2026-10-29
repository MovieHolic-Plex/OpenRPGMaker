// editor/tools/beodeulPlanTool.ts
// paint_beodeul_plan — 버들항 칩셋 맵(또는 그 한 구역)을 「글자 평면도 + 소품 목록 + 불탄 집 목록」 하나로 칠한다.
//
// 왜(2026-10-29, 폴른 스타 2막 B5·B6): 참고 지도 그림(화산 지대 필드·폐허 마을·눈 덮인 산 요새)의 배치를 그대로 옮기려면
// 칸마다 「바위 능선 / 땅 / 길 / 돌바닥」을 정하고, 그 위에 키트를 찍고, 몇 채는 불탄 집터로 만들어야 했다.
// 도구가 없어 데모 코드가 맵 배열을 직접 칠했다 — 그러면 「조수와 에디터로 만들 수 있다」의 증거가 못 된다.
// 이제 같은 일을 조수도 한 번의 호출로 한다. 새 그림은 없다 — 칩셋에 이미 있는 땅 키트·바위 오토타일·소품 키트만 쓴다.
//
// 평면도 글자: `#` 바위 능선(윗면 오토타일 + 열린 칸 바로 북쪽 두 줄은 앞면 — 던전 gap 바위와 같은 규칙),
// `.` 땅(groundKit 칸을 흩뿌림), `:` 길(pathKit — pattern 이면 키트 무늬 그대로, scatter 면 흩뿌림),
// `f` 해진 돌바닥(floorKit, floorWear % 만큼 땅이 덮음), `W` 깨끗한 돌바닥.
// 불탄 집(burnt)은 집 키트 자리를 돌 기단 테두리 + 숯 바닥으로 바꾸고 숯 기둥·선 서까래·내려앉은 지붕 판·숯더미·불씨를 놓는다.

import { autotileVariantForMask, cellHash } from "@/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap, Project, StructureKitDef } from "@/project/types";
import { requireMap } from "./mapHelpers";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export type PlanRockLine = "A" | "B" | "C" | "ice";
export type BurntCollapse = "left" | "right" | "whole";

export interface BeodeulPlanSpec {
  readonly plan: readonly string[];
  /** 평면도 왼쪽 위가 맵의 어느 칸인가(기본 0,0). 평면도가 맵 전체면 맵 크기와 같아야 한다. */
  readonly x?: number;
  readonly y?: number;
  readonly props?: readonly { readonly kit: string; readonly x: number; readonly y: number }[];
  readonly burnt?: readonly { readonly kit: string; readonly x: number; readonly y: number; readonly collapse?: BurntCollapse }[];
  readonly rockLine?: PlanRockLine;
  readonly groundKit?: string;
  readonly pathKit?: string;
  readonly pathStyle?: "pattern" | "scatter";
  readonly floorKit?: string;
  readonly floorWear?: number;
  readonly pathBlend?: number;
  readonly seed?: number;
}

export interface BeodeulPlanReport {
  readonly cells: number;
  readonly rock: number;
  readonly props: number;
  readonly burnt: number;
  readonly whole: boolean;
}

const DEFAULTS = {
  groundKit: "bd-pick-mining-valley-ground-slagg",
  pathKit: "bd-pick-mining-valley-ground-yard",
  floorKit: "bd-pick-temple-ruins-floor-ruin",
} as const;

type Kit = StructureKitDef & { rows: { tiles: number[]; upperTiles?: number[] }[] };

const h32 = (x: number, y: number, s: number): number => {
  let k = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(s, 83492791)) >>> 0;
  k ^= k >>> 16; k = Math.imul(k, 0x85ebca6b) >>> 0; k ^= k >>> 13; k = Math.imul(k, 0xc2b2ae35) >>> 0; k ^= k >>> 16;
  return k >>> 0;
};

/** 평면도대로 칠한다. 평면도 밖 칸은 건드리지 않는다. 이벤트는 건드리지 않는다. */
export function paintBeodeulPlan(project: Project, map: GameMap, spec: BeodeulPlanSpec): BeodeulPlanReport {
  const plan = spec.plan;
  const PH = plan.length, PW = plan[0]?.length ?? 0;
  const ox = spec.x ?? 0, oy = spec.y ?? 0;
  const bad = (message: string): never => { throw new ToolError(message, { code: "invalid-args", mapId: map.id }); };
  if (PH === 0 || PW === 0) bad("plan 은 같은 길이의 문자열 줄 배열이어야 한다.");
  plan.forEach((row, i) => { if (row.length !== PW) bad(`plan[${i}] 길이 ${row.length} ≠ 첫 줄 ${PW}`); if (/[^#.:fW]/.test(row)) bad(`plan[${i}] 에 모르는 글자: ${row.match(/[^#.:fW]/)![0]} (# . : f W 만)`); });
  if (ox < 0 || oy < 0 || ox + PW > map.width || oy + PH > map.height) bad(`평면도 ${PW}×${PH} @(${ox},${oy}) 가 맵 ${map.width}×${map.height} 밖으로 나간다.`);
  const ts = project.tilesets[map.tilesetId];
  if (!ts) bad(`맵 ${map.id} 의 타일셋이 없다.`);
  const kits = new Map((ts!.structureKits ?? []).map((k) => [k.id, k as Kit]));
  const kit = (id: string): Kit => kits.get(id) ?? bad(`키트 ${id} 가 이 칩셋(${map.tilesetId})에 없다 — list_structure_kits 로 확인.`);
  const flat = (id: string): number[] => kit(id).rows.flatMap((r) => r.tiles).filter((t) => t >= 0);
  const seed = spec.seed ?? 0;
  const groundKit = spec.groundKit ?? DEFAULTS.groundKit;
  // 광재 땅 3×3 의 (2,0) 칸은 주황 줄이 그려져 있어 흩뿌리면 줄무늬 격자로 읽힌다 — 뺀다.
  const ground = flat(groundKit).filter((_, i) => !(groundKit === DEFAULTS.groundKit && i === 2));
  const pathK = kit(spec.pathKit ?? DEFAULTS.pathKit);
  const pathFlat = pathK.rows.flatMap((r) => r.tiles).filter((t) => t >= 0);
  const floor = kit(spec.floorKit ?? DEFAULTS.floorKit);
  if (!ground.length || !pathFlat.length) bad("땅·길 키트에 바닥 칸이 없다.");
  const W = map.width, N = W * map.height;
  const lower = map.lowerTiles.slice();
  const upper = (map.upperTiles ?? new Array<number>(N).fill(-1)).slice();
  const at = (px: number, py: number) => plan[py]?.[px] ?? "#";
  const idx = (px: number, py: number) => (oy + py) * W + ox + px;
  const pathTile = (px: number, py: number) => spec.pathStyle === "scatter"
    ? pathFlat[h32(px, py, seed + 2) % pathFlat.length]!
    : pathK.rows[py % pathK.rows.length]!.tiles[px % pathK.rows[0]!.tiles.length]!;
  const groundTile = (px: number, py: number) => ground[h32(px, py, seed + 3) % ground.length]!;
  const blend = spec.pathBlend ?? 18, wear = spec.floorWear ?? 0;
  for (let py = 0; py < PH; py += 1) for (let px = 0; px < PW; px += 1) {
    const c = at(px, py), i = idx(px, py);
    upper[i] = -1;
    if (c === ":") lower[i] = pathTile(px, py);
    else if (c === "f" && h32(px, py, seed + 17) % 100 < wear) lower[i] = groundTile(px, py);
    else if (c === "f" || c === "W") lower[i] = floor.rows[py % floor.rows.length]!.tiles[px % floor.rows[0]!.tiles.length]!;
    else {
      // 길 가장자리는 땅과 섞여 해진다(곧은 띠로 보이지 않게).
      const nearPath = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(px + dx!, py + dy!) === ":");
      lower[i] = c === "." && nearPath && h32(px, py, seed + 9) % 100 < blend ? pathTile(px, py) : groundTile(px, py);
    }
  }
  const isRock = (px: number, py: number) => px < 0 || py < 0 || px >= PW || py >= PH || plan[py]![px] === "#";
  const strip = new Array<number>(PW * PH);
  for (let py = 0; py < PH; py += 1) for (let px = 0; px < PW; px += 1) strip[py * PW + px] = lower[idx(px, py)]!;
  const rockCells = paintRock(ts!.autotileGroups ?? [], kits, spec.rockLine ?? "C", isRock, PW, PH, strip);
  for (let py = 0; py < PH; py += 1) for (let px = 0; px < PW; px += 1) lower[idx(px, py)] = strip[py * PW + px]!;

  const inPlan = (mx: number, my: number) => mx >= ox && my >= oy && mx < ox + PW && my < oy + PH;
  const stamp = (id: string, x: number, y: number): void => {
    kit(id).rows.forEach((row, dy) => {
      row.tiles.forEach((t, dx) => { if (t >= 0 && inPlan(ox + x + dx, oy + y + dy)) lower[idx(x + dx, y + dy)] = t; });
      (row.upperTiles ?? []).forEach((t, dx) => { if (t >= 0 && inPlan(ox + x + dx, oy + y + dy)) upper[idx(x + dx, y + dy)] = t; });
    });
  };
  // 불탄 집터 — 멀쩡한 통나무 벽·덩굴이 남으면 불탄 집으로 안 읽혔다(폴른 스타 감독 검수 B5 6/10).
  // 벽은 다 걷고 돌 기단 테두리만 남긴다. 그 안에 숯 기둥 그루터기·선 채 남은 서까래·내려앉은 지붕 판 조각·
  // 숯더미·탄 판자·쓰러진 들보·불씨. 지붕 판은 그 집 키트의 지붕 칸을 땅에 떨어뜨린 것이다.
  const rimTiles = kits.has("bd-pick-mining-valley-ground-rock") ? flat("bd-pick-mining-valley-ground-rock") : [];
  const sooty = kits.has(DEFAULTS.groundKit) ? flat(DEFAULTS.groundKit).filter((_, i) => i !== 2) : ground;
  for (const b of spec.burnt ?? []) {
    const k = kit(b.kit);
    const x = b.x, y = b.y, side = b.collapse ?? "whole";
    const top = k.height <= 4 ? y + 1 : y + 2;
    const x1 = x + k.width - 1, y1 = y + k.height - 1;
    if (x < 0 || top < 0 || x1 >= PW || y1 >= PH) bad(`불탄 집 ${b.kit} @(${x},${y}) 가 평면도 밖으로 나간다.`);
    const doorX = x + Math.floor(k.width / 2);
    for (let yy = top; yy <= y1; yy += 1) for (let xx = x; xx <= x1; xx += 1) {
      const i = idx(xx, yy);
      upper[i] = -1;
      const edge = yy === top || yy === y1 || xx === x || xx === x1;
      // 기단 돌 — 문 자리 한 칸과 군데군데 빠진 칸.
      if (edge && rimTiles.length && !(yy === y1 && xx === doorX) && h32(xx, yy, seed + 21) % 100 < 70) lower[i] = rimTiles[h32(xx, yy, seed + 22) % rimTiles.length]!;
      else lower[i] = sooty[h32(xx, yy, seed + 23) % sooty.length]!;
    }
    const occupied = new Set<number>([y1 * PW + doorX]);   // 문 앞 칸은 비운다(집터 안으로 걸어 들어갈 수 있게).
    const tryStamp = (id: string, sx: number, sy: number): boolean => {
      const d = kits.get(id);
      if (!d) return false;
      const cells: number[] = [];
      for (let dy = 0; dy < d.height; dy += 1) for (let dx = 0; dx < d.width; dx += 1) {
        const tx = sx + dx, ty = sy + dy;
        if (tx < x || tx > x1 || ty < top - 1 || ty > y1 || occupied.has(ty * PW + tx)) return false;
        cells.push(ty * PW + tx);
      }
      cells.forEach((c) => occupied.add(c));
      stamp(id, sx, sy);
      return true;
    };
    // 귀퉁이 숯 기둥(1×2): 앞 두 귀퉁이, 넓은 집이면 뒤 한 귀퉁이.
    tryStamp("bd-pick-volcano-cave-pillar-broken-a", x, y1 - 1);
    tryStamp("bd-pick-volcano-cave-pillar-broken-b", x1, y1 - 1);
    if (k.width >= 6) tryStamp("bd-pick-volcano-cave-pillar-broken-b", side === "left" ? x1 : x, top);
    // 선 채 남은 서까래.
    const ribX = side === "left" ? x + 1 : x1 - 2;
    if (!tryStamp(k.width >= 8 ? "bd-pick-shipwreck-reef-rib-big" : "bd-pick-shipwreck-reef-rib-small", ribX, top - 1)) tryStamp("bd-pick-shipwreck-reef-rib-small", ribX, top);
    // 내려앉은 지붕 판 — 지붕 키트 둘째·셋째 줄 가운데 3칸을 무너진 쪽 아래에 떨어뜨리고 군데군데 탄 구멍.
    if (side !== "whole" && k.width >= 6) {
      const sx0 = Math.floor(k.width / 2) - 1, slabX = side === "left" ? x1 - 3 : x + 1, slabY = y1 - 2;
      for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
        const t = k.rows[1 + dy]?.upperTiles?.[sx0 + dx] ?? -1;
        const tx = slabX + dx, ty = slabY + dy, local = ty * PW + tx;
        if (t < 0 || occupied.has(local) || h32(tx, ty, seed + 25) % 100 < 30) continue;
        upper[idx(tx, ty)] = t;
        occupied.add(local);
      }
    }
    const heaps = ["bd-pick-volcano-cave-coal-pile", "bd-pick-shipwreck-reef-plank-pile", "bd-pick-volcano-cave-pillar-fallen", "bd-pick-dungeon-theme-rubble-heap"];
    let placed = 0;
    for (let n = 0; n < 40 && placed < (k.width >= 8 ? 4 : 2); n += 1) {
      const id = heaps[(h32(x, y, seed + 30 + n) + placed) % heaps.length]!;
      const sx = x + 1 + (h32(x, n, seed + 31) % Math.max(1, k.width - 2));
      const sy = top + (h32(n, y, seed + 32) % Math.max(1, y1 - top));
      if (tryStamp(id, sx, sy)) placed += 1;
    }
    for (let n = 0, e = 0; n < 30 && e < 2; n += 1) {
      const sx = x + 1 + (h32(x, n, seed + 41) % Math.max(1, k.width - 2)), sy = top + 1 + (h32(n, y, seed + 42) % Math.max(1, y1 - top - 1));
      if (tryStamp(e === 0 ? "bd-pick-volcano-cave-ember-a" : "bd-pick-aqueduct-sewer-rubble", sx, sy)) e += 1;
    }
  }
  for (const p of spec.props ?? []) {
    const k = kit(p.kit);
    if (p.x < 0 || p.y < 0 || p.x + k.width > PW || p.y + k.height > PH) bad(`소품 ${p.kit} @(${p.x},${p.y}) 가 평면도 밖으로 나간다.`);
    stamp(p.kit, p.x, p.y);
  }
  map.lowerTiles = lower;
  map.upperTiles = upper;
  const whole = ox === 0 && oy === 0 && PW === W && PH === map.height;
  for (const key of ["lowerOverlayTiles", "upperOverlayTiles"] as const) {
    const layer = map[key] ?? new Array<number>(N).fill(-1);
    for (let py = 0; py < PH; py += 1) for (let px = 0; px < PW; px += 1) layer[idx(px, py)] = -1;
    map[key] = layer;
  }
  const shadow = map.shadowBits ?? new Array<number>(N).fill(0);
  for (let py = 0; py < PH; py += 1) for (let px = 0; px < PW; px += 1) shadow[idx(px, py)] = 0;
  map.shadowBits = shadow;
  if (whole) {
    // 맵 전체를 다시 칠했다 — 옛 높이·덩이·지형 설계·칸 겹은 새 그림과 어긋난다.
    delete map.relief;
    delete map.doodadGroups;
    delete map.terrainDesign;
    delete map.lowerTileStacks;
    delete map.upperTileStacks;
  }
  return { cells: PW * PH, rock: rockCells, props: spec.props?.length ?? 0, burnt: spec.burnt?.length ?? 0, whole };
}

/** 바위 능선 — 던전 gap 바위(compose.ts)와 같은 규칙: 열린 칸 바로 북쪽 두 줄이 앞면, 나머지는 윗면 오토타일. 칠한 바위 칸 수를 돌려준다. */
function paintRock(groups: readonly AutotileGroup[], kits: Map<string, Kit>, line: PlanRockLine, isRock: (x: number, y: number) => boolean, W: number, H: number, lower: number[]): number {
  const g = groups.find((a) => a.id === (line === "ice" ? "beodeul_dungeon_ice_rock" : `beodeul_dungeon_rock_${line}`));
  const stem = line === "ice" ? "bd-dg-ice-rock" : `bd-dg-rock-${line}`;
  const face = kits.get(`${stem}-face`), single = kits.get(`${stem}-face-single`);
  let any = false;
  for (let y = 0; y < H && !any; y += 1) for (let x = 0; x < W && !any; x += 1) any = isRock(x, y);
  if (!any) return 0;
  if (!g || !face || !single) throw new ToolError(`바위 줄 ${line} 조각(오토타일 ${line === "ice" ? "beodeul_dungeon_ice_rock" : `beodeul_dungeon_rock_${line}`}, 키트 ${stem}-face)이 이 칩셋에 없다 — rockLine 을 A·B·C 중 있는 것으로.`, { code: "invalid-args" });
  const wallB = new Int8Array(W * H).fill(-1);
  for (let y = 1; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (isRock(x, y) || !isRock(x, y - 1)) continue;
    let run = 0;
    while (y - 1 - run >= 0 && isRock(x, y - 1 - run) && run < 3) run += 1;
    if (run < 3) continue;   // 위에 윗면 한 줄이 남지 않는 얇은 능선은 앞면 없이 윗면 테두리만
    for (let b = 0; b < 2; b += 1) wallB[(y - 1 - b) * W + x] = b;
  }
  let n = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const b = wallB[y * W + x]!;
    if (b < 0) continue;
    const left = x > 0 && wallB[y * W + x - 1] === b, right = x + 1 < W && wallB[y * W + x + 1] === b;
    const rr = face.rows[1 - b]!.tiles;
    lower[y * W + x] = !left && !right ? single.rows[1 - b]!.tiles[0]! : left && right ? rr[1]! : right ? rr[0]! : rr[2]!;
    n += 1;
  }
  const open = (x: number, y: number) => !isRock(x, y) || (x >= 0 && y >= 0 && x < W && y < H && wallB[y * W + x]! >= 0);
  const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (open(x, y)) continue;
    let m = 0;
    for (const [dx, dy, bit] of bits) if (!open(x + dx, y + dy)) m |= bit;
    if (!(m & 1) && !(m & 4) && y + 1 < H && wallB[(y + 1) * W + x]! >= 0) m |= 4 | 32 | 64;
    const iv = g.interiorVariants?.[0];
    let t: number | undefined;
    if (g.phaseVariants) t = autotileVariantForMask(g, m, x, y);
    if (t === undefined) t = m === 255 && iv?.length ? iv[cellHash(x, y) % iv.length] : (g.variantMap[String(m)] ?? g.variantMap["255"]);
    lower[y * W + x] = t!;
    n += 1;
  }
  return n;
}

const EXAMPLE = {
  mapId: "map_ash",
  plan: ["########", "##....##", "#..::..#", "#..::..#", "###::###"],
  rockLine: "C",
  props: [{ kit: "bd-pick-swamp-stilt-snag", x: 2, y: 1 }],
  burnt: [{ kit: "bd-out-cabin-small", x: 4, y: 1, collapse: "whole" }],
  seed: 3,
};

const asInt = (v: unknown): number | undefined => (typeof v === "number" && Number.isInteger(v) ? v : undefined);

export const paintBeodeulPlanTool: ToolDefinition = {
  name: "paint_beodeul_plan",
  description:
    "버들항 칩셋(beodeul_city) 맵 한 장 또는 그 한 구역을 글자 평면도로 다시 칠한다 — 참고 지도의 배치(능선·길·광장·폐허)를 칸 단위로 옮길 때. "
    + "plan 은 같은 길이 문자열 줄 배열: '#' 바위 능선(윗면 + 열린 칸 바로 북쪽 두 줄은 앞면 벼랑), '.' 땅(groundKit 칸 흩뿌림), "
    + "':' 길(pathKit — pathStyle pattern=키트 무늬 그대로·scatter=흩뿌림, 가장자리는 pathBlend% 만큼 땅과 섞임), 'f' 해진 돌바닥(floorKit, floorWear% 는 땅이 덮음), 'W' 깨끗한 돌바닥. "
    + "x·y 를 주면 평면도 왼쪽 위가 그 칸이다(구역만 칠함, 밖은 그대로). 평면도 칸의 위층·덧층·그림자는 비우고 다시 칠한다. 맵 전체면 높이·지형 설계도 지운다. 이벤트는 건드리지 않는다. "
    + "props[{kit,x,y}] 는 평면도 좌표로 찍을 키트(list_structure_kits 의 id — 마른 고목 bd-pick-swamp-stilt-snag, 뼈 bd-pick-aqueduct-sewer-bones, 숯더미 bd-pick-volcano-cave-coal-pile, 눈 소나무 bd-pick-snowfield-pine 등). "
    + "burnt[{kit,x,y,collapse}] 는 그 집 키트 자리를 불탄 집터로 — 돌 기단 테두리·숯 바닥·숯 기둥·선 서까래·숯더미·불씨, collapse left|right 면 그쪽으로 내려앉은 지붕 판(whole=통째 무너짐). "
    + "rockLine A(흙굴)·B(잿빛 산 바위)·C(검푸른 바위)·ice(서리) — 칩셋에 있는 줄만. 같은 seed 면 같은 그림. 새 그림은 그리지 않는다.",
  mode: "write",
  domains: ["map", "tile"],
  preservesAuthoredRaster: true,
  invalidArgsExample: EXAMPLE,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      plan: { type: "array", items: { type: "string" }, description: "평면도 줄(위→아래). 글자: # . : f W" },
      x: { type: "integer", minimum: 0, description: "평면도 왼쪽 위 칸 x(기본 0)" },
      y: { type: "integer", minimum: 0, description: "평면도 왼쪽 위 칸 y(기본 0)" },
      rockLine: { type: "string", enum: ["A", "B", "C", "ice"], description: "바위 능선 줄(기본 C)" },
      groundKit: { type: "string", description: "'.' 땅 키트(기본 bd-pick-mining-valley-ground-slagg 잿빛 광재)" },
      pathKit: { type: "string", description: "':' 길 키트(기본 bd-pick-mining-valley-ground-yard)" },
      pathStyle: { type: "string", enum: ["pattern", "scatter"], description: "길 칠하기(기본 pattern)" },
      pathBlend: { type: "integer", minimum: 0, maximum: 100, description: "길 가장자리 땅 칸이 길로 해질 확률 %(기본 18)" },
      floorKit: { type: "string", description: "'f'·'W' 돌바닥 키트(기본 bd-pick-temple-ruins-floor-ruin)" },
      floorWear: { type: "integer", minimum: 0, maximum: 100, description: "'f' 칸을 땅이 덮을 확률 %(기본 0)" },
      props: {
        type: "array",
        description: "찍을 키트 [{kit,x,y}] — 평면도 좌표(왼쪽 위 칸)",
        items: { type: "object", properties: { kit: { type: "string" }, x: { type: "integer" }, y: { type: "integer" } }, required: ["kit", "x", "y"] },
      },
      burnt: {
        type: "array",
        description: "불탄 집터 [{kit,x,y,collapse}] — 집 키트 자리(평면도 좌표)",
        items: {
          type: "object",
          properties: { kit: { type: "string" }, x: { type: "integer" }, y: { type: "integer" }, collapse: { type: "string", enum: ["left", "right", "whole"] } },
          required: ["kit", "x", "y"],
        },
      },
      seed: { type: "integer", minimum: 0 },
    },
    required: ["mapId", "plan"],
  },
  run(draft, args): ToolExecResult {
    const map = requireMap(draft, String(args.mapId));
    if (!Array.isArray(args.plan) || args.plan.some((r) => typeof r !== "string")) {
      throw new ToolError(`plan 은 문자열 배열이어야 한다. 예: ${JSON.stringify(EXAMPLE)}`, { code: "invalid-args", mapId: map.id });
    }
    const list = <T>(v: unknown, name: string, read: (o: Record<string, unknown>, i: number) => T): T[] => {
      if (v === undefined) return [];
      if (!Array.isArray(v)) throw new ToolError(`${name} 는 배열이어야 한다.`, { code: "invalid-args", mapId: map.id });
      return v.map((o, i) => {
        if (typeof o !== "object" || o === null) throw new ToolError(`${name}[${i}] 는 객체여야 한다.`, { code: "invalid-args", mapId: map.id });
        return read(o as Record<string, unknown>, i);
      });
    };
    const cell = (o: Record<string, unknown>, i: number, name: string) => {
      const x = asInt(o.x), y = asInt(o.y);
      if (typeof o.kit !== "string" || x === undefined || y === undefined) throw new ToolError(`${name}[${i}] 에 kit(문자열)·x·y(정수)가 필요하다.`, { code: "invalid-args", mapId: map.id });
      return { kit: o.kit, x, y };
    };
    const report = paintBeodeulPlan(draft, map, {
      plan: args.plan as string[],
      x: asInt(args.x), y: asInt(args.y),
      rockLine: args.rockLine as PlanRockLine | undefined,
      groundKit: args.groundKit as string | undefined,
      pathKit: args.pathKit as string | undefined,
      pathStyle: args.pathStyle as "pattern" | "scatter" | undefined,
      pathBlend: asInt(args.pathBlend),
      floorKit: args.floorKit as string | undefined,
      floorWear: asInt(args.floorWear),
      seed: asInt(args.seed),
      props: list(args.props, "props", (o, i) => cell(o, i, "props")),
      burnt: list(args.burnt, "burnt", (o, i) => ({ ...cell(o, i, "burnt"), collapse: o.collapse as BurntCollapse | undefined })),
    });
    return {
      summary: `${map.name} 평면도 칠하기 — ${report.cells}칸(바위 ${report.rock}), 소품 ${report.props}, 불탄 집 ${report.burnt}${report.whole ? " · 맵 전체" : ""}`,
      data: report,
    };
  },
};
