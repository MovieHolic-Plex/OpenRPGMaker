// 버들항 던전 시공기(author_beodeul_dungeon) 순수 계산 — 방 목록 → 타일 배열 + 앵커. 프로젝트를 건드리지 않는다.
//
// 왜(2026-10-14, 사용자 스크린샷 · field-enemy fe1): 던전 층을 시킨 Argon 조수가 참고문서의 「키트를 stamp_object 로 한 개씩 찍는다」를 따라
// 112번 stamp_object + 67번 paint_tiles(호출당 평균 4초·3초)를 절대 좌표로 불렀고, 25분 시간 초과 시점의 맵은 횃불·화로·통·상자·기둥이
// 허공에 뜨고 벽 조각이 바닥 한가운데 서고 상자 이벤트가 천장 칸에 놓인 상태였다. 좌표를 모델이 계산하는 한 이 결함은 줄이는 것이지 없어지지 않는다.
// 이 시공기는 「방 목록(종류·크기·어느 방에서 어느 쪽으로)」만 받고 바닥 마스크 → 천장·벽 앞면 → 장식을 마스크에서 **유도**한다.
//
// 2판(2026-10-14 적대 QA, 같은 날): 1판 출력은 받침은 맞았지만 그림이 나빴다 —
//   · 천장을 테두리 없는 허공 한 칸으로만 깔아 바닥이 검은 허공에 그대로 잘렸다(앞 턱·옆벽 없음, 종이 오린 방) → 천장 오토타일
//     `beodeul_dungeon_ceiling`(변형 던전 렌더와 같은 벽 두께 띠, bake_dungeon_ceiling.py)로 바닥·벽과 닿는 쪽마다 띠를 두른다
//   · 방이 가로 한 줄로만 이어졌다(99×28) → 동서남북 네 쪽 + 화면 비(가로:세로 ≈ 4:3)에 가까운 자리를 고르고, 이웃 방 사이에 고리 통로를 하나 더 낸다
//   · 같은 종류 방이 판박이였다 → 크기 흔들기·모서리 모따기·감방 칸막이, 장식은 종류별 가중 무작위·모둠·벽 사이 간격 흔들기
//   · 계단·아치가 벽 끝(마구리) 칸에 반쯤 걸렸다 → 양옆이 같은 줄 벽인 칸에만
//   · 벽 앞면 위에 천장이 한 줄도 없는 「떠 있는 벽 토막」이 생길 수 있었다 → 배치 간격 규칙 + 검사(stranded-wall)
//   · 서사 앵커가 없었다 → 입구(올라가는 계단)·보스방(입구에서 가장 먼 방)·보물 방·잠긴 문 자리(gate)를 결과로 돌려준다
import { checkGroundSupportForStamp, groundSupportIssues, kitSupportKind, supportSurfaceOf } from "@/project/groundSupport";
import { autotileVariantForMask, cellHash } from "@/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap, StructureKitDef, TilesetDef } from "@/project/types";
import { DungeonComposeError } from "../errors";
import { WALL_ROWS, hash01, rng, vnoise } from "../grid";
import { layoutBlob, layoutMaze } from "../layouts";
import { layoutDungeon } from "../layoutRooms";
import { buildMask } from "../mask";
import { PROFILES, TK, type KitPref } from "./profiles";
import { dressCorridor, dressTyped, type DressCtx } from "./dress";
import { DUNGEON_DIRS, DUNGEON_ROOM_KINDS, DUNGEON_SIZES, DUNGEON_STYLES, DUNGEON_TYPES } from "../types";
import type { DungeonCompose, DungeonStairCell, DungeonDir, DungeonLayout, DungeonRoomInput, DungeonRoomKind, DungeonSize, DungeonSpec, DungeonStyle, DungeonType, PlacedCorridor, PlacedRoom } from "../types";

export type { DungeonCompose } from "../types";
export { DUNGEON_DIRS, DUNGEON_ROOM_KINDS, DUNGEON_SIZES, DUNGEON_STYLES, DUNGEON_TYPES, DungeonComposeError };
export type { DungeonDir, DungeonLayout, DungeonRoomInput, DungeonRoomKind, DungeonSize, DungeonSpec, DungeonStyle, DungeonType, PlacedCorridor, PlacedRoom };
export { layoutDungeon };

const K = {
  ceiling: "bd-pick-aqueduct-sewer-ceiling",
  stairsUp: "bd-pick-aqueduct-sewer-stairs-up-face", stairsDown: "bd-pick-temple-ruins-stairs-down",
  torch: "bd-pick-aqueduct-sewer-torch-wall", banner: "bd-pick-aqueduct-sewer-banner-cult", chains: "bd-pick-aqueduct-sewer-chains",
  nicheSkull: "bd-pick-castle-catacombs-niche-skull", nicheUrn: "bd-pick-castle-catacombs-niche-urn", nicheShroud: "bd-pick-castle-catacombs-niche-shroud",
  archBars: "bd-pick-aqueduct-sewer-arch-bars", archDark: "bd-pick-aqueduct-sewer-arch-dark",
  column: "bd-pick-castle-catacombs-column-cata", columnBroken: "bd-pick-aqueduct-sewer-column-sewer-broken", fallenColumn: "bd-pick-aqueduct-sewer-fallen-column",
  brazier: "bd-pick-aqueduct-sewer-brazier", crate: "bd-pick-aqueduct-sewer-crate",
  crateStack: "bd-pick-aqueduct-sewer-crate-stack", barrel: "bd-pick-aqueduct-sewer-barrel", bucket: "bd-pick-aqueduct-sewer-bucket",
  coffin: "bd-pick-aqueduct-sewer-coffin", candles: "bd-pick-aqueduct-sewer-candles", altar: "bd-pick-castle-catacombs-altar-stone",
  altarCult: "bd-pick-aqueduct-sewer-altar-cult",
  strawBed: "bd-pick-castle-catacombs-straw-bed", skulls: "bd-pick-aqueduct-sewer-skulls", boneHeap: "bd-pick-aqueduct-sewer-bone-heap",
  bones: "bd-pick-aqueduct-sewer-bones", rubble: "bd-pick-aqueduct-sewer-rubble", rubbleCastle: "bd-pick-castle-catacombs-rubble",
  grate: "bd-pick-aqueduct-sewer-grate-floor", ironMaiden: "bd-pick-castle-catacombs-iron-maiden", rack: "bd-pick-castle-catacombs-rack-32",
  anvilTable: "bd-pick-castle-catacombs-anvil-table", lantern: "bd-pick-aqueduct-sewer-lantern-post",
  floorBone: "bd-pick-aqueduct-sewer-floor-bone", floorCell: "bd-pick-castle-catacombs-floor-cell",
  doorWood: "bd-pick-temple-ruins-door-wood", ritual: "bd-pick-temple-ruins-mosaic-medallion-5x5",
} as const;
/** 천장 오토타일(bake_dungeon_ceiling.py). 없는 옛 사본이면 테두리 없는 허공 한 칸으로 물러선다. */
export const DUNGEON_CEILING_GROUPS = ["beodeul_dungeon_ceiling", "beodeul_dungeon_ceiling_b"] as const;
/**
 * gap 묶음(2026-10-23, scripts/content/beodeul-dungeon/bake_gap.py) — 동굴 종류는 방 사이를 검은 허공 대신 그 줄의 바위 윗면 오토타일
 * `beodeul_dungeon_rock_<줄>` + 앞면 2단(`bd-dg-rock-<줄>-face`)으로 채우고, 물·용암도 그 줄 오토타일(`beodeul_dungeon_water_<줄>` · `_lava_<줄>`, 4장면)로 칠한다.
 * 키트가 없는 옛 사본은 예전 천장·운하 물·용암 무늬로 물러선다(경고 없음 — 기본 동작). spec.rockLine 으로 줄을 고르거나 none 으로 끈다.
 */
export const GAP_ROCK_LINE: Partial<Record<DungeonType, "A" | "B" | "C">> = { cave: "A", mine: "B", volcano: "C", ice: "C" };
export const GAP_KIT = {
  door: "bd-dg-door-closed", doorOpen: "bd-dg-door-open", leverUp: "bd-dg-lever-up", leverDown: "bd-dg-lever-down",
  windowDark: "bd-dg-tower-window-dark", windowLit: "bd-dg-tower-window-lit",
  towerRing: "bd-dg-tower-ring-", towerPassS: "bd-dg-tower-pass-s",
} as const;
/** 오토타일 한 칸: 8방이 다 이어진 칸은 몸통 변형(interiorVariants[0])을 엔진과 같은 cellHash 로 고른다. */
/** 벽가·다른 물건 곁에만 서는 잡동사니 키트(id 일부). */
const CLUTTER_RE = /crate|barrel|bucket|sack|-rack|ore\b|ore-|ingots|coal-pile|slagheap|bones|bone-heap|skulls|rubble|loot|plank-pile|straw-bed/;

function autoCell(g: AutotileGroup, m: number, x: number, y: number): number {
  // 위치 위상 변형(32×32 몸통 용암 등): 엔진 그리기와 같은 규칙으로 칸 위치가 고른다.
  if (g.phaseVariants) { const v = autotileVariantForMask(g, m, x, y); if (v !== undefined) return v; }
  const iv = g.interiorVariants?.[0];
  if (m === 255 && iv?.length) return iv[cellHash(x, y) % iv.length]!;
  return g.variantMap[String(m)] ?? g.variantMap["255"]!;
}


/**
 * 천장 오토타일 칸: 굽힌 모양만 그림이 있고 나머지 모양은 테두리 없는 검은 칸(255 그림)으로 접혀 있다 — 바닥 바로 옆 천장이 「검은 네모 구멍」으로
 * 그려졌다(2026-10-23 dg-r3 VQA 고블린 굴 major). 그림 없는 모양은 열린 쪽(네 변 먼저, 그다음 모서리)이 가장 가까운 그려진 모양으로 바꾼다.
 */
const ceilingNearest = new WeakMap<AutotileGroup, Map<number, number>>();
function ceilingTile(g: AutotileGroup, m: number): number | undefined {
  const voidT = g.variantMap["255"];
  const own = g.variantMap[String(m)];
  if (m === 255 || own === undefined || own !== voidT) return own;
  let cache = ceilingNearest.get(g);
  if (!cache) { cache = new Map(); ceilingNearest.set(g, cache); }
  const hit = cache.get(m);
  if (hit !== undefined) return hit;
  const bits = (v: number) => { let n = 0; for (let b = v; b; b &= b - 1) n += 1; return n; };
  let best = own, bestCost = Infinity;
  for (const [key, tile] of Object.entries(g.variantMap)) {
    const k = Number(key);
    if (tile === voidT) continue;
    const diff = k ^ m;
    // 열린 변을 닫는 것(테두리가 사라짐)보다 닫힌 변을 여는 것(테두리가 하나 더)이 낫다
    const cost = bits(diff & 15 & m) * 4 + bits(diff & 15 & ~m) * 6 + bits(diff & 240);
    if (cost < bestCost) { bestCost = cost; best = tile; }
  }
  cache.set(m, best);
  return best;
}

// ---------- 2. 타일 ----------

export function composeDungeon(ts: TilesetDef, spec: DungeonSpec): DungeonCompose {
  const type: DungeonType = spec.type ?? spec.style ?? "catacomb";
  const profile = PROFILES[type];
  const specT: DungeonSpec = { ...spec, type };
  const layout = profile.grammar === "maze" ? layoutMaze(specT) : profile.grammar === "blob" ? layoutBlob(specT, profile) : layoutDungeon(specT);
  const seed = spec.seed ?? 7;
  const random = rng(seed);
  const kits = new Map<string, StructureKitDef>((ts.structureKits ?? []).map((kit) => [kit.id, kit]));
  const kit = (id: string): StructureKitDef => {
    const found = kits.get(id);
    if (!found) throw new DungeonComposeError(`이 프로젝트의 버들항 타일셋에 던전 키트 ${id} 가 없다 — 버들항 장소 조각(beodeul-picks-dungeon)이 들어 있는 타일셋이 필요하다.`, "kit-missing");
    return found;
  };
  const hasKit = (id: string) => kits.has(id);
  const autos = new Map((ts.autotileGroups ?? []).map((g) => [g.id, g] as const));
  // gap 바위 줄: 바위 윗면 오토타일 + 앞면 키트가 둘 다 있어야 쓴다. 앞면이 2단이라 벽 높이도 2줄이다.
  const gapLine = spec.rockLine === "none" ? null : (spec.rockLine ?? GAP_ROCK_LINE[type] ?? null);
  const rockGroup = gapLine ? autos.get(`beodeul_dungeon_rock_${gapLine}`) : undefined;
  const rockFace = gapLine && hasKit(`bd-dg-rock-${gapLine}-face`) ? kits.get(`bd-dg-rock-${gapLine}-face`)! : undefined;
  const rockSingle = gapLine && hasKit(`bd-dg-rock-${gapLine}-face-single`) ? kits.get(`bd-dg-rock-${gapLine}-face-single`)! : undefined;
  const useRock = !!(rockGroup && rockFace);
  const WR = useRock ? 2 : WALL_ROWS;
  const gapWater = useRock && gapLine ? autos.get(`beodeul_dungeon_water_${gapLine}`) : undefined;
  // 32px 위상 몸통 용암(gap-lava-r2, 주제 꼬리)이 있으면 그것 — 16px 몸통 반복이 안 보인다. 없으면 gap 용암.
  const gapLava = (gapLine ? autos.get(`beodeul_dungeon_theme_lava_${gapLine}`) ?? autos.get(`beodeul_dungeon_lava_${gapLine}`) : undefined)
    ?? autos.get("beodeul_dungeon_theme_lava_C") ?? autos.get("beodeul_dungeon_theme_lava_B") ?? autos.get("beodeul_dungeon_lava_C") ?? autos.get("beodeul_dungeon_lava_B");
  /** 키트 후보 목록에서 이 타일셋에 있는 첫 키트(새 테마 그림 → 기존 키트 순). */
  const pick = (v: KitPref): string => (typeof v === "string" ? v : v.find(hasKit) ?? v[v.length - 1]!);
  /** 야외 던전(숲·늪): 벽 앞면 줄이 없고 벽 칸은 수관 숲으로 덮는다(dungeonTools 가 writeBeodeulCanopy 로 2·3층에 쓴다). */
  const outdoor = profile.walls === "canopy";
  const voidLiquid = profile.liquid === "void";
  const { width: W, height: H, rooms, corridors } = layout;
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const lower = new Array<number>(W * H).fill(-1);
  const upper = new Array<number>(W * H).fill(-1);
  // 배치 → 바닥 마스크(칩셋을 모르는 단계, mask.ts) — 몬스터 키트 어댑터도 같은 마스크를 쓴다.
  const mask = buildMask(layout, profile, type, spec, seed);
  const g = mask.grid;
  const floorMask = g.floor;
  const roomAt = g.roomAt;
  const liquid = g.liquid;
  const bridge = g.bridge;
  const warnings: string[] = mask.warnings;
  if (spec.rockLine && spec.rockLine !== "none" && !useRock) warnings.push(`이 타일셋 사본에 바위 줄 ${spec.rockLine} 조각(beodeul_dungeon_rock_${spec.rockLine}·bd-dg-rock-${spec.rockLine}-face)이 없어 옛 검은 천장으로 지었다 — 프로젝트를 다시 열면 번들 꼬리가 붙는다.`);
  const doorstep = g.protect;
  const partitions = mask.partitions;
  const bridgeCount = mask.bridgeCount;
  /** 열린 칸(걷는 바닥 + 액체 + 다리) — 천장·벽 앞면이 이것에서 유도된다. */
  const isFloor = (x: number, y: number) => inb(x, y) && floorMask[idx(x, y)] === 1;
  /** 걸을 수 있는 바닥(액체 아님, 다리 포함). 장식·방 안 칸 고르기는 이것만 본다. */
  const isWalk = (x: number, y: number) => inb(x, y) && floorMask[idx(x, y)] === 1 && liquid[idx(x, y)] === 0;
  // 마계: 허공 위 돌다리 한 칸은 «끊긴 계단»으로 읽힌다(dt r2 otherworld-b M3·M9) — 다리 칸은 섬을 잇는 땅 목으로 둔다.
  // 바닥 사이에 갇힌 작은 벽 덩이(기둥, ≤40칸)는 떠 있는 ㄱ자 벽 토막으로 읽히므로 허공 구멍으로 바꾼다.
  if (voidLiquid) {
    for (let i = 0; i < W * H; i += 1) if (bridge[i]) { bridge[i] = 0; liquid[i] = 0; }
    const seen = new Uint8Array(W * H);
    for (let s = 0; s < W * H; s += 1) {
      if (seen[s] || floorMask[s] === 1) continue;
      const comp: number[] = [s]; seen[s] = 1; let edge = false;
      for (let k = 0; k < comp.length; k += 1) {
        const c = comp[k]!; const x = c % W, y = (c - x) / W;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) edge = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const X = x + dx, Y = y + dy;
          if (!inb(X, Y) || seen[idx(X, Y)] || floorMask[idx(X, Y)] === 1) continue;
          seen[idx(X, Y)] = 1; comp.push(idx(X, Y));
        }
      }
      if (!edge && comp.length <= 40) for (const c of comp) { floorMask[c] = 1; liquid[c] = 1; }
    }
  }

  // ---- 둥근 탑 링 방(shape "ring", 2026-10-23 dungeon-themes): 방 바닥 w×h 가 링 지름 N=w+2(h=N-4)이면 gap 링 키트를 통째로 찍는다.
  // 바닥 마스크를 링 안 칸으로 바꾸고(벽·천장이 링 둘레에서 유도된다), 장식 전에 키트 그림으로 덮는다. 남쪽 가운데 두 칸 = 통로(bd-dg-tower-pass-s).
  // 다음 층으로 올라가는 방(가장 깊은 방)은 12칸 계단 링 — 계단 끝 칸이 이동 칸이다. 키트가 없으면 mask 의 팔각(round)으로 남는다.
  const ringExitRoom = spec.exitStair === "up" ? (rooms.find((r) => r.kind === "boss") ?? (rooms.length > 2 ? [...rooms].filter((r) => r.kind !== "vault" && r.kind !== "entrance").sort((a, b) => b.depth - a.depth)[0] : undefined) ?? (rooms.length > 1 ? rooms[rooms.length - 1] : undefined)) : undefined;
  const rings: { r: PlacedRoom; def: StructureKitDef; ox: number; oy: number; N: number; stair: boolean; walk: Uint8Array }[] = [];
  const kitWalk = (t: number) => t < 0 || (() => { const p = ts.passability[t]; return !!p && Object.values(p).some(Boolean); })();
  for (const r of rooms) {
    if (r.shape !== "ring") continue;
    const N = r.w + 2;
    const stair = r === ringExitRoom && N === 12 && hasKit(`${GAP_KIT.towerRing}12-stair`);
    const id = stair ? `${GAP_KIT.towerRing}12-stair` : `${GAP_KIT.towerRing}${N}`;
    if (r.h + 4 !== N || !hasKit(id)) continue;
    const def = kit(id);
    const ox = r.x - 1, oy = r.y - 3;
    const walk = new Uint8Array(N * N);
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
      const lo = def.rows[y]!.tiles[x]!, up = def.rows[y]!.upperTiles?.[x] ?? -1;
      walk[y * N + x] = kitWalk(lo) && kitWalk(up) ? 1 : 0;
    }
    // 남쪽 통로 두 칸(통로가 링 아래 띠를 지난다)
    const pc = Math.floor(N / 2) - 1;
    const south = corridors.some((c) => c.rect.y === oy + N - 1 && c.rect.x <= ox + pc && c.rect.x + c.rect.w >= ox + pc + 2);
    if (south) for (const dx of [0, 1]) { walk[(N - 2) * N + pc + dx] = 1; walk[(N - 1) * N + pc + dx] = 1; }
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
      const X = ox + x, Y = oy + y;
      if (!inb(X, Y)) continue;
      const inRoom = X >= r.x && X < r.x + r.w && Y >= r.y && Y < r.y + r.h;
      if (!inRoom && !(south && y >= N - 2 && (x === pc || x === pc + 1))) continue;
      floorMask[idx(X, Y)] = walk[y * N + x]!;
      roomAt[idx(X, Y)] = walk[y * N + x] ? (inRoom ? rooms.indexOf(r) : -1) : -1;
      liquid[idx(X, Y)] = 0; bridge[idx(X, Y)] = 0;
    }
    rings.push({ r, def, ox, oy, N, stair, walk });
  }

  // ---- 벽 앞면 = 바닥 북쪽 변 위 세 줄(위에 천장이 한 줄 이상 남게). 둘이면 두 줄. ----
  const wallB = new Int8Array(W * H).fill(-1);
  const wallH = new Int8Array(W * H).fill(0);
  const stranded: string[] = [];
  // 야외 출구: 입구 빈터 아랫변 가운데에서 맵 남쪽 끝까지 길을 낸다(숲·늪을 걸어 나가는 길 — 계단 대신 맵 끝 칸이 바깥 출구).
  let trailExit: DungeonStairCell | null = null;
  if (outdoor) {
    const e = rooms[0]!;
    const ex = e.x + Math.floor(e.w / 2);
    let y0 = -1;
    for (let y = H - 1; y >= 0; y -= 1) if (floorMask[idx(ex, y)] === 1 && !liquid[idx(ex, y)]) { y0 = y; break; }
    if (y0 >= 0) {
      for (let y = y0; y < H; y += 1) for (let x = ex - 1; x <= ex + 1; x += 1) if (inb(x, y)) { floorMask[idx(x, y)] = 1; liquid[idx(x, y)] = 0; if (roomAt[idx(x, y)]! < 0) roomAt[idx(x, y)] = 0; }
      trailExit = { x: ex, y: H - 1, front: { x: ex, y: H - 2 }, kind: "up" };
    }
  }
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (outdoor) break;
    if (!isFloor(x, y) || isFloor(x, y - 1)) continue;
    if (voidLiquid && liquid[idx(x, y)]) continue;   // 허공(천장으로 그린다) 위에는 벽 앞면을 세우지 않는다 — 앞면이 허공을 마주 본다

    let run = 0;
    while (y - 1 - run >= 0 && !isFloor(x, y - 1 - run) && run < WR + 1) run += 1;
    const h = Math.min(WR, run >= WR + 1 ? WR : run - 1);
    if (h < 2) { stranded.push(`(${x},${y})`); continue; }
    for (let b = 0; b < h; b += 1) { wallB[idx(x, y - 1 - b)] = b; wallH[idx(x, y - 1 - b)] = h; }
  }
  if (stranded.length) throw new DungeonComposeError(`시공기 내부 오류(stranded-wall): 벽 앞면 위에 천장이 남지 않는 칸 ${stranded.length}곳 ${stranded.slice(0, 4).join(" ")} — 방 사이 세로 간격이 4칸보다 좁다.`, "stranded-wall");
  const isWall = (x: number, y: number) => inb(x, y) && wallB[idx(x, y)]! >= 0;
  const face = profile.face;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const b = wallB[idx(x, y)]!;
    if (b < 0) continue;
    const h = wallH[idx(x, y)]!;
    if (useRock) {
      // gap 바위 앞면 2단: 열 0 서끝 · 1 가운데 · 2 동끝, 한 칸 폭 벽은 홑칸 키트
      const left = x > 0 && wallB[idx(x - 1, y)] === b, right = x + 1 < W && wallB[idx(x + 1, y)] === b;
      const rr = rockFace!.rows[1 - b]!.tiles;
      lower[idx(x, y)] = !left && !right && rockSingle ? rockSingle.rows[1 - b]!.tiles[0]! : left && right ? rr[1]! : !left && right ? rr[0]! : left && !right ? rr[2]! : rr[1]!;
      continue;
    }
    const faceId = pick(h >= 3 ? face.h3 : face.h2);
    const rows = kit(faceId).rows;
    const row = rows[(h >= 3 ? 3 : 2) - 1 - b]!.tiles;
    // 이웃 열도 같은 줄이 벽 앞면이면(단 번호가 달라도) 이어진 벽 — 단만 보고 끝 칸(테두리)을 고르면 1칸 계단진 벽 한가운데에 세로 테두리 줄이 섰다(2026-10-25 floor VQA r5 「stepped walls with vertical shadow seams」).
    const left = x > 0 && wallB[idx(x - 1, y)]! >= 0, right = x + 1 < W && wallB[idx(x + 1, y)]! >= 0;
    // 새김 가운데 열(`<앞면 키트>-glyph`, 1칸 폭 같은 높이)이 구워져 있으면 벽 가운데 칸을 드문드문 그것으로 — 같은 열의 단끼리는 같은 해시라 새김이 끊기지 않는다.
    const glyph = left && right && hasKit(`${faceId}-glyph`) && hash01(x, y + b, seed * 13 + 5) < 0.14 ? kit(`${faceId}-glyph`) : undefined;
    if (glyph && glyph.rows.length === rows.length) { lower[idx(x, y)] = glyph.rows[rows.length - 1 - b]!.tiles[0]!; continue; }
    // 가운데 덩이(`<앞면 키트>-mid`, 3칸 폭 같은 높이)가 구워져 있으면 벽 가운데 칸은 그 덩이의 x % 3 열 — 반복 주기 48px(얼음굴 큰 면이 칸 경계를 넘는다).
    const midKit = left && right && hasKit(`${faceId}-mid`) ? kit(`${faceId}-mid`) : undefined;
    if (midKit && midKit.rows.length === rows.length) { lower[idx(x, y)] = midKit.rows[rows.length - 1 - b]!.tiles[x % midKit.rows[0]!.tiles.length]!; continue; }
    lower[idx(x, y)] = left && right ? row[1]! : !left && right ? row[0]! : left && !right ? row[2]! : row[1]!;
  }

  // 둥근 탑 링 둘레는 키트 그림이 벽이다 — 시공기 벽 앞면을 지워 링 위·옆 천장에 테두리가 새지 않게 한다(링 위 가운데 돌 조각).
  for (const g0 of rings) for (let y = 0; y < g0.N; y += 1) for (let x = 0; x < g0.N; x += 1) {
    if (!g0.walk[y * g0.N + x] && inb(g0.ox + x, g0.oy + y)) wallB[idx(g0.ox + x, g0.oy + y)] = -1;
  }
  // ---- 천장: 바닥·벽이 아닌 칸. 오토타일 47 모양(벽 두께 띠), 결 두 가지를 칸마다 섞는다. ----
  const findGroups = (ids: readonly string[]) => ids.map((id) => (ts.autotileGroups ?? []).find((g) => g.id === id)).filter((g): g is AutotileGroup => !!g);
  // 테마 테두리(사암·얼음·보랏빛 허공)가 구워져 있으면 그것, 없으면 기본 회색 테두리.
  const themed = profile.ceiling ? findGroups(profile.ceiling) : [];
  const groups = themed.length ? themed : findGroups(DUNGEON_CEILING_GROUPS);
  const voidTile = kit(K.ceiling).rows[1]!.tiles[1]!;
  // 마계의 허공(void 액체)은 천장과 같은 어둠이다 — 떠 있는 땅 가장자리에 테두리(땅 끝)가 그려진다. 다리는 열린 칸.
  const isOpen = (x: number, y: number) => inb(x, y) && ((floorMask[idx(x, y)] === 1 && !(voidLiquid && liquid[idx(x, y)] === 1)) || wallB[idx(x, y)]! >= 0);
  let rimmed = 0;
  const canopyCells: number[] = [];
  const groundTile = (x: number, y: number): number => {
    if (profile.floor.tile !== undefined) return profile.floor.tile;
    const rows = kit(pick(profile.floor.base)).rows; return rows[y % rows.length]!.tiles[x % rows[0]!.tiles.length]!;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (isOpen(x, y)) continue;
    if (outdoor) { lower[idx(x, y)] = groundTile(x, y); canopyCells.push(idx(x, y)); continue; }
    if (!groups.length && !useRock) { lower[idx(x, y)] = voidTile; continue; }
    let m = 0;
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (const [dx, dy, bit] of bits) if (!isOpen(x + dx, y + dy)) m |= bit;
    // 한 줄 두께 천장(위 = 방 바닥 남쪽 끝, 아래 = 다음 방 벽 앞면): 위·아래 테두리를 둘 다 그리면 두 회색 테두리 사이 2px 검은 틈으로 읽혔다(2026-10-25 floor VQA r4 castle·catacomb).
    // 아래 벽 앞면이 제 윗선을 갖고 있으니 아래쪽은 닫힌 것으로 보고 위(바닥 쪽) 테두리 하나만 그린다.
    if (!(m & 1) && !(m & 4) && inb(x, y + 1) && wallB[idx(x, y + 1)]! >= 0) m |= 4 | 32 | 64;
    if (useRock) { lower[idx(x, y)] = autoCell(rockGroup!, m, x, y); if (m !== 255) rimmed += 1; continue; }
    const g = groups[groups.length > 1 && hash01(x, y, seed) < 0.5 ? 1 : 0]!;
    lower[idx(x, y)] = ceilingTile(g, m) ?? voidTile;
    if (m !== 255) rimmed += 1;
  }
  /** 천장 한가운데 칸(사방이 천장) — 링 바깥 어둠 자리를 둘레 천장과 같은 결로 채운다. */
  const ceilAt = (x: number, y: number): number => useRock ? autoCell(rockGroup!, 255, x, y) : groups.length ? (ceilingTile(groups[groups.length > 1 && hash01(x, y, seed) < 0.5 ? 1 : 0]!, 255) ?? voidTile) : voidTile;
  if (!groups.length && !useRock) warnings.push("이 타일셋 사본에 천장 테두리 오토타일(beodeul_dungeon_ceiling)이 없어 천장을 테두리 없는 허공으로 깔았다 — 프로젝트를 다시 열면 번들 꼬리가 붙는다.");

  // ---- 바닥 칸: 종류별 바닥 키트(2×2·3×3 무늬) + 잡음 덩이 변형 + 칸마다 흩뿌림 + 물가 바닥. 액체·다리는 따로 칠한다. ----
  const fl = profile.floor;
  const tileOf = (id: string, x: number, y: number): number => { const rows = kit(id).rows; return rows[y % rows.length]!.tiles[x % rows[0]!.tiles.length]!; };
  const nearLiquid = (x: number, y: number): boolean => {
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if (inb(x + dx, y + dy) && (liquid[idx(x + dx, y + dy)] || bridge[idx(x + dx, y + dy)])) return true;
    return false;
  };
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!isWalk(x, y) || bridge[idx(x, y)]) continue;
    const ri = roomAt[idx(x, y)]!;
    const r = ri >= 0 ? rooms[ri]! : null;
    let id: string = pick(fl.base);
    const byKindPref = r ? (r.kind === "lake" && profile.lakeFloor ? profile.lakeFloor : fl.byKind?.[r.kind]) : undefined;
    const byKind = byKindPref ? pick(byKindPref) : undefined;
    // 감방 윗 3줄만 황토 판(floor-cell)을 깔던 규칙은 뺐다 — 방 위쪽만 덮고 16px 가로선으로 끊긴 「반쪽 바닥」으로 읽혔다(2026-10-25 floor VQA r5 catacomb). 감방 바닥은 프로필 byKind 가 정한다.
    if (byKind && hasKit(byKind)) id = byKind;
    else {
      for (const [k, p] of fl.patches.entries()) if (hasKit(p.kit) && vnoise(x, y, p.scale ?? 4, seed * 11 + k * 37) > p.at) id = p.kit;
      for (const [k, sc] of (fl.scatter ?? []).entries()) if (sc.p > 0 && hasKit(sc.kit) && hash01(x, y, seed * 17 + k) < sc.p) id = sc.kit;
    }
    if (fl.shore && hasKit(fl.shore) && nearLiquid(x, y) && hash01(x, y, seed + 71) < 0.8) id = fl.shore;
    if (fl.tile !== undefined && id === pick(fl.base)) { lower[idx(x, y)] = fl.tile; continue; }
    // 섞음: 바닥 칸을 키트 무늬 순서 대신 해시로 고른다 — 키트 무늬 그대로 깔면 2~3칸 주기 반복이 넓은 방에서 격자로 드러났다(2026-10-25 floor VQA r4).
    if (fl.mix || kit(id).ai?.tags?.includes("섞음")) {
      const rows = kit(id).rows, w = rows[0]!.tiles.length;
      // mixCells 는 첫 후보 키트 기준 번호 — 옛 사본이 다른(작은) 키트로 물러섰으면 범위 안 번호만 남는다.
      const all = Array.from({ length: rows.length * w }, (_, k) => k);
      const listed = id === pick(fl.base) ? (fl.mixCells ?? []).filter((k) => k < all.length) : [];
      const cells = listed.length ? listed : all;
      const k = cells[Math.floor(hash01(x, y, seed * 5 + 3) * cells.length)]!;
      lower[idx(x, y)] = rows[Math.floor(k / w)]!.tiles[k % w]!;
    }
    else lower[idx(x, y)] = tileOf(id, x, y);
  }
  // 오토타일 바닥(얼음굴): 걷는 바닥 = ground 오토타일(이웃 = 걷는 바닥·다리), 호수 방 + 잡음 덩이 = 빙판 오토타일(이웃 = 빙판 칸).
  const af = profile.autoFloor;
  const afGround = af ? autos.get(af.ground) : undefined;
  if (af && afGround) {
    const afSheet = af.sheet ? autos.get(af.sheet) : undefined;
    const sheetCell = new Uint8Array(W * H);
    if (afSheet) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!isWalk(x, y) || bridge[idx(x, y)]) continue;
      const ri = roomAt[idx(x, y)]!;
      const lake = ri >= 0 && rooms[ri]!.kind === "lake";
      if (lake || vnoise(x, y, af.sheetScale ?? 5, seed * 13 + 3) > (af.sheetAt ?? 0.75)) sheetCell[idx(x, y)] = 1;
    }
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (!isWalk(x, y) || bridge[idx(x, y)]) continue;
      let m = 0;
      if (sheetCell[idx(x, y)]) {
        for (const [dx, dy, bit] of bits) if (!inb(x + dx, y + dy) || sheetCell[idx(x + dx, y + dy)]) m |= bit;
        lower[idx(x, y)] = autoCell(afSheet!, m, x, y);
      } else {
        for (const [dx, dy, bit] of bits) if (!inb(x + dx, y + dy) || isWalk(x + dx, y + dy) || bridge[idx(x + dx, y + dy)]) m |= bit;
        lower[idx(x, y)] = autoCell(afGround, m, x, y);
      }
    }
  }
  // 광산: 갱도 한가운데 줄을 널판 선로 바닥으로(입구·갈림 방은 가로지르는 줄, 그 밖 방은 통로 구간만). 선로 그림이 따로 없어 널판 바닥이 임시다.
  if (type === "mine" && hasKit("bd-pick-aqueduct-sewer-floor-plank")) {
    const plank = "bd-pick-aqueduct-sewer-floor-plank";
    const paintRow = (y: number, x0: number, x1: number) => { for (let x = x0; x < x1; x += 1) if (isWalk(x, y) && !bridge[idx(x, y)]) lower[idx(x, y)] = tileOf(plank, x, y); };
    // 방마다 선로 한 줄 — 높이가 다른 통로 둘이 한 방에 두 줄을 칠해 두꺼운 널판 띠가 됐고, 통로 가운데 줄이 방 줄과 달라 문목에서 한 칸 꺾였다(2026-10-25 floor VQA r5 mine).
    const roomRow = new Map<string, number>();
    const horiz = corridors.filter((c) => c.dir === "E" || c.dir === "W");
    for (const c of horiz) {
      const mid = c.rect.y + Math.floor(c.rect.h / 2);
      for (const id of [c.a, c.b]) { const rm = rooms.find((q) => q.id === id); if (rm && (rm.kind === "junction" || rm.kind === "entrance") && !roomRow.has(rm.id) && mid >= rm.y && mid < rm.y + rm.h) roomRow.set(rm.id, mid); }
    }
    for (const c of horiz) {
      const mid = c.rect.y + Math.floor(c.rect.h / 2);
      const near = [c.a, c.b].map((id) => roomRow.get(id)).find((r) => r !== undefined && r >= c.rect.y && r < c.rect.y + c.rect.h);
      paintRow(near ?? mid, c.rect.x, c.rect.x + c.rect.w);
    }
    for (const [id, ty] of roomRow) { const rm = rooms.find((q) => q.id === id)!; paintRow(ty, rm.x, rm.x + rm.w); }
  }
  // 액체: 물은 운하 오토타일(돌 둑 테두리), 용암은 용암 키트 무늬. 다리 칸 밑도 같은 액체로 이어 보이게 마스크에 센다.
  const liqLike = (x: number, y: number) => inb(x, y) && (liquid[idx(x, y)] === 1 || bridge[idx(x, y)] === 1);
  const canal = (ts.autotileGroups ?? []).find((a) => a.id === "beodeul_canal_lake_47");
  const LAVA_KIT = "bd-pick-volcano-cave-lava-strip";
  let liquidCells = 0;
  const bankCells: number[] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!liquid[idx(x, y)] || !isFloor(x, y)) continue;
    liquidCells += 1;
    if (voidLiquid) continue;   // 허공은 천장 오토타일이 이미 칠했다
    if (profile.bank && (profile.liquid !== "lava" || !gapLava)) bankCells.push(idx(x, y));   // 용암은 gap 용암 오토타일이 식은 껍질 테두리를 그리면 둑을 얹지 않는다
    if (profile.bank && profile.liquid !== "lava" && canal) {
      // 몸통은 gap 물 속 변형 6종(늪 = 초록 B, 그 밖 = A)을 칸 해시로 — 운하 몸통 한 칸은 흰 점이 같은 자리라 연못에 16px 점 격자가 섰다(2026-10-25 floor VQA r5 swamp).
      const body = autos.get(profile.id === "swamp" ? "beodeul_dungeon_water_B" : "beodeul_dungeon_water_A")?.interiorVariants?.[0];
      lower[idx(x, y)] = body?.length ? body[cellHash(x, y) % body.length]! : canal.variantMap["255"] ?? voidTile; continue;
    }   // 자연 물가: 가득 찬 물 칸 + 2층 둑 덧그림
    if (profile.liquidKit && hasKit(pick(profile.liquidKit))) { const rows = kit(pick(profile.liquidKit)).rows; lower[idx(x, y)] = rows[Math.floor(hash01(x, y, seed * 3 + 5) * rows.length)]!.tiles[Math.floor(hash01(y, x, seed * 9 + 2) * rows[0]!.tiles.length)]!; continue; }
    let m = 0;
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (const [dx, dy, bit] of bits) if (liqLike(x + dx, y + dy)) m |= bit;
    // 용암: gap 용암 오토타일(식은 껍질 테두리 + 4장면)이 있으면 그것, 없으면 옛 용암 띠 무늬
    if (profile.liquid === "lava") { lower[idx(x, y)] = gapLava ? autoCell(gapLava, m, x, y) : tileOf(LAVA_KIT, x, y); continue; }
    if (gapWater) { lower[idx(x, y)] = autoCell(gapWater, m, x, y); continue; }
    lower[idx(x, y)] = canal?.variantMap[String(m)] ?? canal?.variantMap["255"] ?? voidTile;
  }
  // 마계 허공(주제 그림 other.void_edge 가 구워져 있으면): 허공 칸 = 별빛 허공 몸통, 섬 바닥 바로 남쪽 두 칸 = 섬 밑 바위(1·2단),
  // 허공에 닿는 바닥 칸 = 턱 오토타일(허공 쪽만 열림). 없으면 위 천장 오토타일 어둠 그대로.
  const voidEdge = voidLiquid ? (ts.autotileGroups ?? []).find((a) => a.id === "beodeul_dungeon_theme_void_edge") : undefined;
  if (voidEdge && hasKit(TK("void-body")) && hasKit(TK("void-underside"))) {
    const isVoid = (x: number, y: number) => inb(x, y) && isFloor(x, y) && liquid[idx(x, y)] === 1 && !bridge[idx(x, y)];
    const isGround = (x: number, y: number) => inb(x, y) && isFloor(x, y) && liquid[idx(x, y)] !== 1;
    const bodies = kit(TK("void-body")).rows[0]!.tiles;
    const under = kit(TK("void-underside")).rows;
    const depth = (x: number, y: number): number => (!isVoid(x, y) ? 0 : isGround(x, y - 1) ? 1 : isVoid(x, y - 1) && isGround(x, y - 2) ? 2 : 0);
    const bits: [number, number, number][] = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (isVoid(x, y)) {
        const d = depth(x, y);
        lower[idx(x, y)] = d ? under[d - 1]!.tiles[(depth(x - 1, y) !== d ? 2 : 0) + (depth(x + 1, y) !== d ? 1 : 0)]! : bodies[Math.floor(hash01(x, y, seed * 7 + 11) * bodies.length)]!;
        continue;
      }
      if (!isGround(x, y)) continue;
      let touches = false;
      let m = 0;
      for (const [dx, dy, bit] of bits) { if (isVoid(x + dx, y + dy)) touches = true; else m |= bit; }
      if (touches) lower[idx(x, y)] = autoCell(voidEdge, m, x, y);
    }
  }
  if (liquidCells && profile.liquid === "water" && !canal && !gapWater) warnings.push("이 타일셋 사본에 물 오토타일(beodeul_canal_lake_47)이 없어 물이 그려지지 않았다.");
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!bridge[idx(x, y)]) continue;
    const ew = (isWalk(x - 1, y) || bridge[idx(x - 1, y)]) && (isWalk(x + 1, y) || bridge[idx(x + 1, y)]);
    if (profile.bridge) { lower[idx(x, y)] = tileOf(pick(ew ? profile.bridge.ew : profile.bridge.ns), x, y); continue; }
    lower[idx(x, y)] = kit(ew ? "bd-pick-aqueduct-sewer-bridge-ew-stone" : "bd-pick-aqueduct-sewer-bridge-ns-stone").rows[0]!.tiles[0]!;
  }

  // 둥근 탑 링: 키트 그림을 통째로. 남쪽 통로 칸은 pass-s 키트로 덮는다.
  for (const g0 of rings) {
    const { def, ox, oy, N } = g0;
    for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) {
      const X = ox + x, Y = oy + y;
      if (!inb(X, Y)) continue;
      const lo = def.rows[y]!.tiles[x]!, up = def.rows[y]!.upperTiles?.[x] ?? -1;
      // 바깥 어둠 칸도 키트 그림(어둠)으로 — 둘레 천장 테두리가 링 모서리 밑 벽 윗단에 돌 조각처럼 떠 보였다(10칸 링).
      // 링 바깥 어둠(29775)은 둘레 천장과 같은 결로 — 평평한 어둠이 링 둘레에 네모로 떠 보였다.
      const dark = !g0.walk[y * N + x] && supportSurfaceOf(ts, lo) === "ceiling";
      lower[idx(X, Y)] = dark ? ceilAt(X, Y) : lo; upper[idx(X, Y)] = up;
    }
    const pc = Math.floor(N / 2) - 1;
    if (g0.walk[(N - 1) * N + pc] && hasKit(GAP_KIT.towerPassS)) {
      const ps = kit(GAP_KIT.towerPassS);
      for (let y = 0; y < 2; y += 1) for (let x = 0; x < 2; x += 1) {
        const X = ox + pc + x, Y = oy + N - 2 + y;
        if (!inb(X, Y)) continue;
        lower[idx(X, Y)] = ps.rows[y]!.tiles[x]!; upper[idx(X, Y)] = ps.rows[y]!.upperTiles?.[x] ?? -1;
      }
    }
  }

  // ---- 장식 ----
  const pseudo = { id: "compose", name: "compose", width: W, height: H, tilesetId: ts.id, events: [], lowerTiles: lower, upperTiles: upper } as unknown as GameMap;
  const counts: Record<string, number> = {};
  if (rings.length) counts["tower-ring"] = rings.length;
  const blocked = new Uint8Array(W * H);
  const passTile = (tile: number) => { const pass = ts.passability[tile]; return !!pass && Object.values(pass).some(Boolean); };
  const stand = (x: number, y: number) => isFloor(x, y) && !blocked[idx(x, y)] && passTile(lower[idx(x, y)]!) && (upper[idx(x, y)]! < 0 || passTile(upper[idx(x, y)]!));
  // 입구 칸과 문 칸들 — 물건 하나를 놓을 때마다 여기서 모두 닿는지 본다(줄째 비워 두는 대신 길만 지킨다: 큰 홀 가운데가 비지 않게).
  const keyCells: [number, number][] = [];
  for (const c of corridors) keyCells.push([c.rect.x + Math.floor(c.rect.w / 2), c.rect.y + Math.floor(c.rect.h / 2)]);
  rooms.forEach((r, ri) => {
    // 방 대표 칸 = 방 아랫변 가운데에 가장 가까운 걸을 수 있는 칸(호수·수로 방은 가운데가 물이다)
    const tx = r.x + Math.floor(r.w / 2), ty = r.y + r.h - 1;
    let best: [number, number] | null = null; let bd = Infinity;
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (!isWalk(x, y) || bridge[idx(x, y)] || roomAt[idx(x, y)] !== ri) continue;
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d < bd) { bd = d; best = [x, y]; }
    }
    if (best) keyCells.push(best);
  });
  const connected = (): boolean => {
    const start = keyCells.find(([x, y]) => stand(x, y));
    if (!start) return false;
    const seen = new Uint8Array(W * H);
    const stack: [number, number][] = [start]; seen[idx(start[0], start[1])] = 1;
    while (stack.length) {
      const [x, y] = stack.pop()!;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
        seen[idx(nx, ny)] = 1; stack.push([nx, ny]);
      }
    }
    // 방마다: 그 방 바닥 중 걸을 수 있는 칸이 하나라도 닿았나 + 모든 문 칸이 닿았나
    for (const [x, y] of keyCells) if (stand(x, y) && !seen[idx(x, y)]) return false;
    return rooms.every((r, ri) => { for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (roomAt[idx(x, y)] === ri && seen[idx(x, y)]) return true; return false; });
  };
  const put = (kitId: string, x: number, y: number, opts: { label?: string; free?: boolean; liquidOk?: boolean } = {}): boolean => {
    if (!hasKit(kitId)) return false;
    const def = kit(kitId);
    if (x < 0 || y < 0 || x + def.width > W || y + def.height > H) return false;
    if (checkGroundSupportForStamp(pseudo, ts, def, x, y)) return false;
    const ownSupport = kitSupportKind(def) === null;   // 던전 테마 밖 키트(광산 골짜기 등)는 groundSupport 가 안 본다 — 같은 규칙을 여기서 직접
    const cells: { x: number; y: number; lo: number; up: number }[] = [];
    for (let dy = 0; dy < def.height; dy += 1) for (let dx = 0; dx < def.width; dx += 1) {
      const row = def.rows[dy]!;
      const lo = row.tiles[dx] ?? -1, up = row.upperTiles?.[dx] ?? -1;
      if (lo < 0 && up < 0) continue;
      const X = x + dx, Y = y + dy;
      // 물·용암·다리 위에는 아무것도 놓지 않는다(액체는 걸을 수 없는 칸, 다리는 길이다)
      if (inb(X, Y) && (liquid[idx(X, Y)] || bridge[idx(X, Y)]) && !opts.liquidOk) return false;
      if (opts.liquidOk && /boat/.test(kitId) && !liquid[idx(X, Y)]) return false;   // 배는 물 위에만 — 바닥에 얹힌 배가 「뭍에 오른 배」로 읽혔다(2026-10-25 floor VQA r5 cave)
      if (ownSupport && up >= 0 && !opts.liquidOk) {
        const bottom = dy === def.height - 1;
        if (bottom ? !isWalk(X, Y) : !(isWalk(X, Y) || isWall(X, Y))) return false;
      }
      if (upper[idx(X, Y)]! >= 0 || blocked[idx(X, Y)]) return false;
      if (doorstep[idx(X, Y)] && isFloor(X, Y)) return false;
      cells.push({ x: X, y: Y, lo, up });
    }
    if (!cells.length) return false;
    // 잡동사니(상자·통·자루·광석·뼈·잔해)는 벽가 또는 다른 물건 곁에만 — 방 한가운데 홀로 선 상자 더미가 길을 막는 「떠 있는 물건」으로 읽혔다(2026-10-25 floor VQA r4 castle·catacomb).
    if (!opts.free && CLUTTER_RE.test(kitId)) {
      const anchored = cells.some((c) => {
        for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
          const X = c.x + dx, Y = c.y + dy;
          if (!inb(X, Y) || cells.some((q) => q.x === X && q.y === Y)) continue;
          if (!isFloor(X, Y) || isWall(X, Y) || upper[idx(X, Y)]! >= 0) return true;
        }
        return false;
      });
      if (!anchored) return false;
    }
    const before = cells.map((c) => [lower[idx(c.x, c.y)]!, upper[idx(c.x, c.y)]!] as const);
    for (const c of cells) {
      if (c.lo >= 0) lower[idx(c.x, c.y)] = c.lo;
      if (c.up >= 0) upper[idx(c.x, c.y)] = c.up;
    }
    // 길을 막는 물건이면 되돌린다(바닥 위 걸을 수 없는 칸이 새로 생긴 경우만 검사).
    const blocks = cells.some((c) => isFloor(c.x, c.y) && !passTile(c.up >= 0 ? c.up : c.lo));
    if (blocks && !opts.free && !connected()) {
      cells.forEach((c, i) => { lower[idx(c.x, c.y)] = before[i]![0]; upper[idx(c.x, c.y)] = before[i]![1]; });
      return false;
    }
    const label = opts.label ?? kitId.replace(/^bd-pick-/, "");
    counts[label] = (counts[label] ?? 0) + 1;
    return true;
  };
  const putAny = (kitId: string, cands: readonly (readonly [number, number])[], opts?: { label?: string }): [number, number] | null => {
    for (const [x, y] of cands) if (put(kitId, x, y, opts)) return [x, y];
    return null;
  };
  const weighted = <T,>(rs: () => number, list: readonly (readonly [T, number])[]): T => {
    const total = list.reduce((a, [, w]) => a + w, 0);
    let r = rs() * total;
    for (const [v, w] of list) { r -= w; if (r <= 0) return v; }
    return list[list.length - 1]![0];
  };
  const shuffle = <T,>(rs: () => number, list: readonly T[]): T[] => {
    const out = [...list];
    for (let i = out.length - 1; i > 0; i -= 1) { const j = Math.floor(rs() * (i + 1)); [out[i], out[j]] = [out[j]!, out[i]!]; }
    return out;
  };

  /** 방의 북쪽 벽 가운데 줄(b=1) 칸 중 양옆도 같은 줄 벽인 칸(벽 끝 마구리 칸에는 걸지 않는다). */
  /** 납골 벽 n 개: 벽 앞면이 3단이면 3×3(가운데 줄 한 칸 위부터), 2단이면 3×2. 5칸 간격. */
  const ossuaryWalls = (slots: { x: number; y: number }[], rs: () => number, n: number): void => {
    if (!hasKit(TK("ossuary-2h"))) return;
    let k = 0, last = -99;
    for (const q of shuffle(rs, slots)) {
      if (k >= n) break;
      if (Math.abs(q.x - last) < 5) continue;
      const tall = hasKit(TK("ossuary-3h")) && [-1, 0, 1].every((d) => wallB[idx(q.x + d, q.y - 1)] === 1);
      if (tall ? put(TK("ossuary-3h"), q.x - 1, q.y - 1) : put(TK("ossuary-2h"), q.x - 1, q.y)) { k += 1; last = q.x; }
    }
  };
  const wallSlots = (r: PlacedRoom): { x: number; y: number }[] => {
    const out: { x: number; y: number }[] = [];
    for (let x = r.x - 1; x <= r.x + r.w; x += 1) {
      // 이 칸의 벽 가운데 줄 = 그 열 바닥 첫 칸 위 둘째 줄
      let fy = -1;
      for (let y = r.y; y < r.y + r.h; y += 1) if (isWalk(x, y) && !bridge[idx(x, y)] && roomAt[idx(x, y)] === rooms.indexOf(r)) { fy = y; break; }
      if (fy < 0) continue;
      const y = fy - 2;
      if (!isWall(x, y) || wallB[idx(x, y)] !== 1) continue;
      if (wallB[idx(x - 1, y)] !== 1 || wallB[idx(x + 1, y)] !== 1) continue;
      if (doorstep[idx(x, fy)]) continue;
      out.push({ x, y });
    }
    return out;
  };
  /** 방 바닥 칸(벽에서 inset 칸 안쪽). */
  const floorCells = (r: PlacedRoom, inset = 0): [number, number][] => {
    const out: [number, number][] = [];
    const ri = rooms.indexOf(r);
    for (let y = r.y + inset; y < r.y + r.h - inset; y += 1) for (let x = r.x + inset; x < r.x + r.w - inset; x += 1) if (isWalk(x, y) && !bridge[idx(x, y)] && roomAt[idx(x, y)] === ri) out.push([x, y]);
    return out;
  };
  /** 벽(또는 천장)에 붙은 바닥 칸 — 잡동사니는 가장자리·구석에 모인다. 구석(두 쪽이 막힌 칸)이 앞에 온다. */
  const edgeCells = (r: PlacedRoom, rs: () => number): [number, number][] => {
    const cells = floorCells(r).filter(([x, y]) => !isWalk(x - 1, y) || !isWalk(x + 1, y) || !isWalk(x, y - 1) || !isWalk(x, y + 1));
    const closed = (x: number, y: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isWalk(x + dx!, y + dy!)).length;
    return shuffle(rs, cells).sort((a, b) => closed(b[0], b[1]) - closed(a[0], a[1]));
  };
  /** 벽걸이를 간격을 흔들어 건다(최소 간격 2, 평균 gap). */
  const hangAlong = (slots: { x: number; y: number }[], rs: () => number, gap: number, pick: () => string, max = 99): number => {
    let n = 0, next = slots[0] ? slots[0].x + 1 + Math.floor(rs() * gap) : 0;
    for (const s of slots) {
      if (n >= max) break;
      if (s.x < next) continue;
      if (upper[idx(s.x - 1, s.y)]! >= 0 || upper[idx(s.x + 1, s.y)]! >= 0) continue;   // 이미 건 물건 바로 옆에는 걸지 않는다
      if (put(pick(), s.x, s.y)) { n += 1; next = s.x + 2 + Math.floor(rs() * gap); }
    }
    return n;
  };
  /** 잡동사니 한 모둠: 기준 칸 둘레 반지름 2 안에 n 개. */
  const cluster = (rs: () => number, cx: number, cy: number, n: number, kinds: readonly (readonly [string, number])[]) => {
    const around: [number, number][] = [];
    const home = inb(cx, cy) ? roomAt[idx(cx, cy)]! : -1;
    // 모둠은 기준 칸과 같은 방 안에만(통로로 넘치지 않게)
    for (let dy = -2; dy <= 2; dy += 1) for (let dx = -2; dx <= 2; dx += 1) if (inb(cx + dx, cy + dy) && roomAt[idx(cx + dx, cy + dy)] === home) around.push([cx + dx, cy + dy]);
    let placed = 0;
    for (const [x, y] of shuffle(rs, around).sort((a, b) => Math.abs(a[0] - cx) + Math.abs(a[1] - cy) - Math.abs(b[0] - cx) - Math.abs(b[1] - cy))) {
      if (placed >= n) break;
      if (rs() < 0.35) continue;
      if (put(weighted(rs, kinds), x, y)) placed += 1;
    }
  };
  const litter: readonly (readonly [string, number])[] = [[K.bones, 3], [K.rubble, 3], [K.skulls, 1], [K.rubbleCastle, 1]];

  // 서사 앵커: 보스방 = kind boss(없으면 입구에서 가장 깊은 방), 보물 방 = kind vault.
  const bossRoom = rooms.find((r) => r.kind === "boss") ?? (rooms.length > 2 ? [...rooms].filter((r) => r.kind !== "vault" && r.kind !== "entrance").sort((a, b) => b.depth - a.depth)[0] ?? null : null);
  const vaultRoom = rooms.find((r) => r.kind === "vault") ?? null;

  const ctx: DressCtx = {
    W, H, rooms, corridors, seed, grid: !!layout.grid, hasKit, kit, put, putAny, weighted, shuffle, wallSlots, floorCells, edgeCells, hangAlong, cluster,
    isFloor, isWalk, isWall, idx, inb, wallB, roomAt, liquid, bridge, upper, lower, blocked, doorstep, counts, litter, lair: !!spec.lair, seats: {},
  };
  let stairsUp: DungeonCompose["stairsUp"] = null;
  let stairsDown: DungeonCompose["stairsDown"] = null;
  // 여러 층 던전(2026-10-22): 들어오는 계단·나가는 계단의 종류를 층마다 고른다. 기본(up/down)은 옛 출력과 같다.
  const entryKind = spec.entryStair ?? "up";
  const exitKind = spec.exitStair ?? "down";
  let entryStair: DungeonStairCell | null = null;
  let exitStair: DungeonStairCell | null = null;
  let sideDoor: (DungeonStairCell & { room: string }) | null = null;
  const deepRoomPre = bossRoom ?? (rooms.length > 1 ? rooms[rooms.length - 1]! : null);
  const sideRoom = spec.sideDoor
    ? vaultRoom ?? [...rooms].filter((r) => r.kind !== "entrance" && r !== deepRoomPre).sort((a, b) => b.depth - a.depth)[0] ?? null
    : null;
  /** 북쪽 벽 가운데 줄(b=1)에서 양옆 두 칸까지 같은 높이 벽인 칸(가운데 쪽 먼저). 앞 칸(바닥 첫 줄)이 비어 있어야 한다. */
  const flatWall = (_r: PlacedRoom, centerFirst: { x: number; y: number }[], width = 1): { x: number; y: number } | null => {
    const flat = (q: { x: number; y: number }) => [-2, -1, ...Array.from({ length: width + 1 }, (_, k) => k + 1)].every((d) => wallB[idx(q.x + d, q.y)] === 1 && wallB[idx(q.x + d, q.y + 1)] === 0)
      && Array.from({ length: width }, (_, k) => k).every((d) => upper[idx(q.x + d, q.y)]! < 0 && upper[idx(q.x + d, q.y + 1)]! < 0 && !blocked[idx(q.x + d, q.y + 2)] && isWalk(q.x + d, q.y + 2));
    return centerFirst.find(flat) ?? centerFirst.find((q) => wallB[idx(q.x - 1, q.y + 1)] === 0 && wallB[idx(q.x + 1, q.y + 1)] === 0 && upper[idx(q.x, q.y)]! < 0 && isWalk(q.x, q.y + 2) && !blocked[idx(q.x, q.y + 2)]) ?? null;
  };
  /** 올라가는 계단 그림을 벽 두 줄에 깐다(앞 칸 = 바닥 첫 줄, 비워 둔다). */
  const wallStairs = (q: { x: number; y: number }): DungeonStairCell => {
    const def = kit(K.stairsUp);
    for (let dy = 0; dy < def.height; dy += 1) lower[idx(q.x, q.y + dy)] = def.rows[dy]!.tiles[0]!;
    blocked[idx(q.x, q.y + 2)] = 1;
    return { x: q.x, y: q.y + 1, front: { x: q.x, y: q.y + 2 }, kind: "up" };
  };
  /** 나무 문(1×2)을 벽 두 줄에 건다 — 이동 이벤트는 문 아랫칸(부딪쳐 들어간다), 앞 칸은 비워 둔다. */
  const wallDoor = (q: { x: number; y: number }): DungeonStairCell | null => {
    // gap 문(bd-dg-door-closed/open, 버들항 화풍 돌 문틀 + 쇠띠 문)이 있으면 그것 — 상태 짝 그림 번호를 돌려줘 이벤트가 changeTile 로 연다.
    const gapDoor = hasKit(GAP_KIT.door) && hasKit(GAP_KIT.doorOpen);
    const id = gapDoor ? GAP_KIT.door : K.doorWood;
    if (!hasKit(id) || !put(id, q.x, q.y, { label: "door" })) return null;
    blocked[idx(q.x, q.y + 2)] = 1;
    const cell: DungeonStairCell = { x: q.x, y: q.y + 1, front: { x: q.x, y: q.y + 2 }, kind: "door" };
    if (gapDoor) {
      const t = (k: string): [number, number] => { const rows = kit(k).rows; return [rows[0]!.upperTiles![0]!, rows[1]!.upperTiles![0]!]; };
      cell.doorTiles = { closed: t(GAP_KIT.door), open: t(GAP_KIT.doorOpen) };
    }
    return cell;
  };
  /** 바닥에 내려가는 계단(1×1, 아무 쪽에서 밟는다)을 놓는다 — 여덟 이웃이 바닥인 칸 중 score 가 낮은 칸. 길이 끊기면 다음 칸. */
  const floorHole = (r: PlacedRoom, score: (x: number, y: number) => number): DungeonStairCell | null => {
    const def = kit(K.stairsDown);
    const inset = r.w >= 8 && r.h >= 7 ? 2 : 1;
    const cands = floorCells(r, inset).filter(([x, y]) => !blocked[idx(x, y)] && upper[idx(x, y)]! < 0 && !doorstep[idx(x, y)] && y > r.y + 1
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => isWalk(x + dx, y + dy) && !bridge[idx(x + dx, y + dy)] && upper[idx(x + dx, y + dy)]! < 0 && !blocked[idx(x + dx, y + dy)])));
    for (const [x, y] of cands.sort((a, b) => score(a[0], a[1]) - score(b[0], b[1]))) {
      const was = lower[idx(x, y)]!;
      lower[idx(x, y)] = def.rows[0]!.tiles[0]!;
      blocked[idx(x, y)] = 1;
      if (!connected()) { lower[idx(x, y)] = was; blocked[idx(x, y)] = 0; continue; }
      blocked[idx(x, y + 1)] = 1;   // 도착 칸(남쪽 앞 칸)은 물건·이벤트 자리로 쓰지 않는다
      return { x, y, front: { x, y: y + 1 }, kind: "down" };
    }
    return null;
  };

  rooms.forEach((r, i) => {
    const rs = rng(seed * 7 + i * 101 + 3);
    const slots = wallSlots(r);
    const cx = r.x + Math.floor(r.w / 2);
    const centerFirst = [...slots].sort((a, b) => Math.abs(a.x - cx) - Math.abs(b.x - cx) || a.x - b.x);
    const torch = () => K.torch;
    // 올라가는 계단: 북쪽 벽 아래 두 줄(양옆이 벽인 칸, 가운데 쪽). 앞 칸 = 방 맨 윗줄 바닥. 모든 종류 공통.
    // 계단 칸 양옆 두 칸까지 같은 높이 벽(벽 끝 마구리·계단 옆 단차에 반쯤 걸리지 않게), 가운데에 가까운 칸.
    let s: { x: number; y: number } | null = null;
    if (r.kind === "entrance" && entryKind !== "none" && outdoor) {
      // 숲·늪: 입구 빈터에서 맵 남쪽 끝으로 나가는 길 끝 칸이 바깥 출구다(벽이 없어 계단을 걸 수 없다).
      entryStair = trailExit;
      if (trailExit) { stairsUp = { x: trailExit.x, y: trailExit.y, front: trailExit.front }; blocked[idx(trailExit.front.x, trailExit.front.y)] = 1; counts["trail-exit"] = 1; }
      else warnings.push("입구 빈터에서 맵 끝으로 나가는 길을 내지 못했다.");
    } else if (r.kind === "entrance" && entryKind !== "none") {
      if (entryKind === "down") {
        // 탑 위층: 아래층에서 올라온 계단(바닥 내려가는 계단) — 입구 방 위쪽 가운데.
        // 둥근 탑 층: 내려가는 계단은 방 한가운데가 아니라 벽 곁(층마다 좌우를 바꾼다) — 「계단이 바닥 한가운데 박혔다」(2026-10-23 VQA).
        const wallSide = r.shape === "round" ? (seed % 2 === 0 ? r.x + 1 : r.x + r.w - 2) : null;
        entryStair = floorHole(r, wallSide !== null ? (x, y) => Math.abs(x - wallSide) * 3 + Math.abs(y - (r.y + Math.floor(r.h / 2))) : (x, y) => Math.abs(x - cx) * 2 + Math.abs(y - (r.y + 2)) * 3);
        if (entryStair) counts["stairs-down"] = (counts["stairs-down"] ?? 0) + 1;
        else warnings.push("입구 방 바닥에 내려가는 계단을 놓을 자리가 없다.");
      } else {
        s = flatWall(r, centerFirst);
        if (s && entryKind === "door") entryStair = wallDoor(s);
        // 문 그림을 못 걸면 계단으로 — 입구가 아예 없는 것보다 낫다.
        if (s && entryKind === "door" && entryStair) { /* 문 */ } else if (s) {
          entryStair = wallStairs(s);
          stairsUp = { x: entryStair.x, y: entryStair.y, front: entryStair.front };
          counts["stairs-up"] = 1;
        }
        if (!s) warnings.push(`입구 방 북쪽 벽에 ${entryKind === "door" ? "문" : "올라가는 계단"}을 놓을 평평한 벽이 없다.`);
      }
    }
    // 탑: 다음 층으로 올라가는 계단은 가장 깊은 방 북쪽 벽(장식보다 먼저 자리를 잡는다).
    const ringHere = rings.find((g0) => g0.r === r);
    if (exitKind === "up" && ringHere?.stair) {
      // 12칸 계단 링: 안벽을 따라 오르는 돌계단 끝 칸(링 원점 +2,+4)이 이동 칸, 바로 아래 계단 칸이 도착 칸. 계단 칸에는 물건을 두지 않는다.
      const { ox, oy } = ringHere;
      exitStair = { x: ox + 2, y: oy + 4, front: { x: ox + 2, y: oy + 5 }, kind: "up" };
      // 계단 칸은 위층 그림이 차 있어 물건이 못 앉는다. 계단 앞 칸을 길 지킴 칸에 넣어 물건이 계단 발치를 막지 않게 한다.
      keyCells.push([ox + 2, oy + 5]);
      blocked[idx(ox + 3, oy + 7)] = 1;
      counts["stairs-up"] = (counts["stairs-up"] ?? 0) + 1;
    } else if (exitKind === "up" && r === deepRoomPre && r.kind !== "entrance") {
      const q = flatWall(r, centerFirst);
      if (q) { exitStair = wallStairs(q); counts["stairs-up"] = (counts["stairs-up"] ?? 0) + 1; }
      else warnings.push(`${r.id} 북쪽 벽에 다음 층으로 올라가는 계단을 놓을 평평한 벽이 없다.`);
    }
    if (sideRoom && r === sideRoom && !sideDoor) {
      const q = flatWall(r, [...centerFirst].reverse());
      const d = q ? wallDoor(q) : null;
      if (d) sideDoor = { ...d, room: r.id };
      else warnings.push(`${r.id} 북쪽 벽에 곁 맵으로 가는 문을 낼 자리가 없다.`);
    }
    if (type !== "catacomb" && dressTyped(ctx, type, r, rs, s, slots, centerFirst)) return;
    switch (r.kind) {
      case "entrance": {
        const rest = slots.filter((q) => !s || Math.abs(q.x - s.x) > 1);
        // 계단 양옆 횃불 한 쌍(입구 표지) + 나머지 벽은 드문드문
        if (s) { put(K.torch, s.x - 2, s.y); put(K.torch, s.x + 2, s.y); }
        hangAlong(rest, rs, 4, torch, 2);
        const e = edgeCells(r, rs);
        cluster(rs, e[0]?.[0] ?? r.x + 1, e[0]?.[1] ?? r.y + 1, 3, [[K.crate, 2], [K.barrel, 2], [K.crateStack, 1], [K.bucket, 1]]);
        put(K.brazier, r.x + 1 + Math.floor(rs() * 2), r.y + r.h - 2);
        put(K.brazier, r.x + r.w - 2 - Math.floor(rs() * 2), r.y + r.h - 2);
        for (const [x, y] of e.slice(3, 5)) if (rs() < 0.5) put(weighted(rs, litter), x, y);
        // 입구 앵커: 계단 앞 길 양옆 기둥 한 쌍 — 「거의 빈 10×8 바닥」으로 읽혔다(2026-10-23 dg2-r1 VQA 지하 묘지). 길(계단 앞 세로 줄)은 비운다.
        if (s && r.w >= 9 && r.h >= 5) { const y = Math.min(r.y + r.h - 3, s.y + 3); if (put(K.column, s.x - 2, y - 1)) put(K.column, s.x + 2, y - 1); }
        break;
      }
      case "hall": {
        // 큰 홀: 기둥 두 줄(간격 흔들기, 몇 개는 부러진 기둥) 또는 쓰러진 기둥이 있는 폐허 홀
        const ruined = rs() < 0.35;
        const rowsY = r.h >= 8 ? [r.y + 2, r.y + r.h - 2] : [r.y + Math.floor(r.h / 2)];
        let x = r.x + 2 + Math.floor(rs() * 2);
        while (x < r.x + r.w - 2) {
          for (const y of rowsY) {
            const k = ruined && rs() < 0.45 ? K.columnBroken : K.column;
            put(k, x, y - 1);
          }
          x += 3 + Math.floor(rs() * 2);
        }
        if (ruined) { const f = shuffle(rs, floorCells(r, 2))[0]; if (f) put(K.fallenColumn, f[0], f[1]); }
        // 기둥 줄 사이 가운데 줄: 가운데 길 양옆 화로 한 쌍 + 잔해 한 무더기 — 기둥 두 줄 사이가 맨바닥 띠로 읽혔다(2026-10-23 VQA 「빈 바닥」).
        if (r.h >= 7 && r.w >= 11) {
          const my = r.y + Math.floor(r.h / 2);
          if (put(K.brazier, cx - 3, my)) put(K.brazier, cx + 3, my);
          rs();   // 가운데 잔해 무더기는 뺐다 — 기둥 줄 사이 길이 잔해로 막혀 보였다(2026-10-25 floor VQA r0). 난수 한 번은 그대로 소비.
        }
        hangAlong(slots, rs, 4, () => (rs() < 0.75 ? K.torch : K.banner));
        // 벽 장식 아치는 두지 않는다 — 열린 아치도 쇠창살 아치도 「어디로도 안 가는 문」으로 읽혔다(2026-10-23 VQA r1·r2). 난수 한 번은 그대로 소비해 배치를 흔들지 않는다.
        rs();
        const e = edgeCells(r, rs);
        // 잔해 모둠은 구석 한 곳만(edgeCells 는 구석이 앞), 작게.
        rs();
        if (e[0]) cluster(rs, e[0][0], e[0][1], 2, litter);
        // 지하묘지 홀: 벽가에 동서 석관 두엇(주제 그림) — 홀이 그냥 기둥 방으로 읽혔다.
        if (type === "catacomb") ossuaryWalls(slots, rs, 1);
        if (type === "catacomb" && hasKit(TK("sarcophagus-ew"))) { let n = 0; for (const [x, y] of e.slice(10)) { if (n >= 2) break; if (put(rs() < 0.2 && hasKit(TK("sarcophagus-ew-open")) ? TK("sarcophagus-ew-open") : TK("sarcophagus-ew"), x, y)) n += 1; } }
        break;
      }
      case "crypt": {
        // 묘실: 벽감 줄(종류 섞고 군데군데 비움) + 관 줄(빈자리 흔들기) + 구석 뼈 더미·촛불
        // 주제 그림(theme-earth, 2026-10-23)이 있으면 관 줄은 남북 석관(가끔 뚜껑 열린 것), 바닥에 묘석 판 한두 장.
        const niches = [K.nicheSkull, K.nicheUrn, K.nicheShroud];
        // 납골 벽(theme-earth r2): 벽 앞면을 뼈로 채운 판 하나둘 — 벽감보다 먼저(벽감이 그 자리를 먹지 않게).
        if (type === "catacomb") ossuaryWalls(slots, rs, 1 + (r.w >= 12 ? 1 : 0));
        for (const s of slots) if (rs() < 0.55) put(niches[Math.floor(rs() * 3)]!, s.x, s.y);
        hangAlong(slots, rs, 5, torch, 2);
        // 관: 3칸 간격 격자 자리를 섞어 넓이에 맞는 수만큼(줄이 반듯하되 군데군데 빈다)
        const want = Math.max(2, Math.round((r.w * r.h) / 22));
        const grid: [number, number][] = [];
        for (let y = r.y + 2; y < r.y + r.h - 1; y += 3) for (let x = r.x + 1; x < r.x + r.w - 2; x += 3) grid.push([x, y]);
        let coffins = 0;
        for (const [x, y] of shuffle(rs, grid)) {
          if (coffins >= want) break;
          const coffinId = hasKit(TK("sarcophagus-ns")) && rs() < 0.75 ? (hasKit(TK("sarcophagus-ns-open")) && rs() < 0.15 ? TK("sarcophagus-ns-open") : TK("sarcophagus-ns")) : K.coffin;
          if (put(coffinId, x, y - 1)) { coffins += 1; if (rs() < 0.35) put(K.candles, x + 2, y); }
        }
        if (hasKit(TK("tomb-slab"))) { let n = 0; for (const [x, y] of shuffle(rs, floorCells(r, 1))) { if (n >= 1 + (r.w * r.h > 60 ? 1 : 0)) break; if (put(TK("tomb-slab"), x, y)) n += 1; } }
        const e = edgeCells(r, rs);
        if (e[0]) put(K.boneHeap, e[0][0], e[0][1] - 1);
        for (const [x, y] of e.slice(1, 9)) if (rs() < 0.5) put(weighted(rs, [[K.skulls, 2], [K.bones, 3], [K.candles, 1]]), x, y);
        break;
      }
      case "cell": {
        // 감방: 칸막이로 나뉜 칸마다 짚 침상·양동이·사슬(칸마다 다르게), 앞쪽 복도에 간수 탁자·고문대
        const ps = partitions.filter((p) => p.room === r.id).map((p) => p.x);
        const bounds = [r.x - 1, ...ps, r.x + r.w];
        for (let k = 0; k + 1 < bounds.length; k += 1) {
          const x0 = bounds[k]! + 1, x1 = bounds[k + 1]! - 1;
          if (x1 < x0) continue;
          const xs = Array.from({ length: x1 - x0 + 1 }, (_, j) => x0 + j);
          put(K.strawBed, xs[Math.floor(rs() * xs.length)]!, r.y + (rs() < 0.5 ? 0 : 1));
          if (rs() < 0.6) put(K.bucket, xs[Math.floor(rs() * xs.length)]!, r.y + 2);
          if (rs() < 0.4) put(weighted(rs, litter), xs[Math.floor(rs() * xs.length)]!, r.y + 2);
          const wall = slots.filter((s) => s.x >= x0 && s.x <= x1);
          if (wall.length && rs() < 0.8) put(K.chains, wall[Math.floor(rs() * wall.length)]!.x, wall[0]!.y);
        }
        const front = floorCells(r).filter(([, y]) => y >= r.y + 4);
        const f = shuffle(rs, front);
        if (f[0]) put(rs() < 0.5 ? K.anvilTable : K.rack, f[0][0], f[0][1] - 1);
        if (f[1] && rs() < 0.5) put(K.ironMaiden, f[1][0], f[1][1] - 1);
        if (f[2]) put(K.brazier, f[2][0], f[2][1]);
        break;
      }
      case "shrine":
      case "boss": {
        const isBoss = r.kind === "boss";
        // 제단은 북쪽 벽 앞 가운데, 깃발은 제단 양옆 대칭(서사 축), 그 밖 벽은 흔들기
        const ax = cx - 1;
        const altar = putAny(isBoss || rs() < 0.5 ? K.altar : K.altarCult, [0, 1, -1, 2, -2].map((d) => [ax + d, r.y] as [number, number]));
        if (altar) {
          for (const d of [2, 3]) { const l = slots.find((s) => s.x === altar[0] - d), rr = slots.find((s) => s.x === altar[0] + 1 + d); if (l && rr) { if (put(K.banner, l.x, l.y)) put(K.banner, rr.x, rr.y); break; } }
          put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1);
          // 묘지·성 제단 곁은 쇠 촛대(주제 그림)가 있으면 그것 — 하수도 화로는 묘실에 어울리지 않았다.
          const stand2 = (type === "catacomb" || type === "castle") && hasKit(TK("iron-candelabra")) ? TK("iron-candelabra") : K.brazier;
          put(stand2, altar[0] - 2, altar[1] + 2); put(stand2, altar[0] + 3, altar[1] + 2);
        }
        hangAlong(slots, rs, 3, torch);
        if (isBoss) {
          // 보스방: 가운데 의식 원(모자이크) — 넓은 맨바닥이 「목적 없는 빈 방」으로 읽혔다(2026-10-23 VQA). 보스는 그 위에 선다.
          put(K.ritual, cx - 2, r.y + Math.floor(r.h / 2) - 1);
          // 기둥이 바닥 가운데를 둘러싸고(싸울 자리는 비운다) 구석에 뼈 더미
          const ys = [r.y + 2, r.y + r.h - 2];
          for (const y of ys) for (const x of [r.x + 2, r.x + r.w - 3]) put(K.column, x, y - 1);
          const e = edgeCells(r, rs);
          if (e[0]) put(K.boneHeap, e[0][0], e[0][1] - 1);
          for (const [x, y] of e.slice(1, 8)) if (rs() < 0.55) put(weighted(rs, [[K.skulls, 2], [K.bones, 2], [K.rubble, 1]]), x, y);
        } else {
          for (const [x, y] of edgeCells(r, rs).slice(0, 5)) if (rs() < 0.5) put(weighted(rs, [[K.candles, 2], [K.skulls, 1], [K.bones, 1]]), x, y);
        }
        break;
      }
      case "storage": {
        // 창고: 벽을 따라 상자·통 모둠 2~3개(모둠마다 섞임), 가운데는 지나다니게
        const e = edgeCells(r, rs);
        const n = 2 + Math.floor(rs() * 2);
        for (let c = 0; c < n; c += 1) { const p = e[c * 4]; if (p) cluster(rs, p[0], p[1], 3 + Math.floor(rs() * 2), [[K.crate, 3], [K.barrel, 3], [K.crateStack, 2], [K.bucket, 1]]); }
        hangAlong(slots, rs, 4, torch, 2);
        if (rs() < 0.6) { const f = shuffle(rs, floorCells(r, 1))[0]; if (f) put(K.lantern, f[0], f[1] - 1); }
        break;
      }
      case "vault": {
        // 보물 방: 벽감 항아리, 가운데 제단, 상자 모둠, 촛불
        for (const s of centerFirst.slice(0, 4)) if (rs() < 0.7) put(K.nicheUrn, s.x, s.y);
        hangAlong(slots, rs, 3, torch, 2);
        const altar = putAny(K.altar, [0, 1, -1].map((d) => [cx - 1 + d, r.y + 1] as [number, number]));
        if (altar) { put(K.candles, altar[0] - 1, altar[1] + 1); put(K.candles, altar[0] + 2, altar[1] + 1); }
        const e = edgeCells(r, rs);
        if (e[0]) cluster(rs, e[0][0], e[0][1], 3, [[K.crate, 2], [K.crateStack, 1], [K.barrel, 1]]);
        break;
      }
    }
  });
  // 탑 층(여러 층 탑: 다음 층으로 올라가는 계단·바닥 계단 입구·문 입구)은 북쪽 벽 앞면 위 두 줄에 화살 구멍 창(gap bd-dg-tower-window-*)을 방마다 한두 개.
  const towerish = exitKind === "up" || entryKind === "down" || entryKind === "door";
  if (towerish && hasKit(GAP_KIT.windowDark)) {
    rooms.forEach((r, i) => {
      const rs = rng(seed * 31 + i * 17 + 5);
      let n = 0, lastX = -99;
      for (const s of wallSlots(r)) {
        if (n >= 2) break;
        if (s.x - lastX < 4 || rs() < 0.45) continue;
        const y = wallB[idx(s.x, s.y - 1)] === 2 ? s.y - 1 : s.y;   // 3줄 벽은 위 두 줄, 2줄 벽은 두 줄 그대로
        if (![0, 1].every((d) => isWall(s.x, y + d) && upper[idx(s.x, y + d)]! < 0 && upper[idx(s.x - 1, y + d)]! < 0 && upper[idx(s.x + 1, y + d)]! < 0)) continue;
        const id = hasKit(GAP_KIT.windowLit) && rs() < 0.5 ? GAP_KIT.windowLit : GAP_KIT.windowDark;
        if (put(id, s.x, y, { label: "window" })) { n += 1; lastX = s.x; }
      }
    });
  }

  // 통로: 가로 통로 벽에 횃불 하나(가끔), 바닥에 배수 창살·뼈 조금
  (layout.grid ? [] : corridors).forEach((c, i) => {
    const rs = rng(seed * 13 + i * 71 + 9);
    const r = c.rect;
    if (dressCorridor(ctx, type, c, rs)) return;
    if ((c.dir === "E" || c.dir === "W") && r.w >= 4 && rs() < 0.6) {
      const x = r.x + 1 + Math.floor(rs() * (r.w - 2));
      if (wallB[idx(x, r.y - 2)] === 1 && wallB[idx(x - 1, r.y - 2)] === 1 && wallB[idx(x + 1, r.y - 2)] === 1) put(K.torch, x, r.y - 2);
    }
    for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) {
      if (doorstep[idx(x, y)]) continue;
      // 배수 창살은 하수도·미궁만(성·묘지 통로 바닥 창살 띠가 「납작한 쇠 띠」로 읽혔다), 잔해는 드물게 — 2026-10-25 floor VQA r0.
      const v = hash01(x, y, seed + i);
      if (v < 0.03 && (type === "sewer" || type === "labyrinth")) put(K.grate, x, y, { free: true });
      else if (v > 0.975) put(weighted(rs, litter), x, y);
    }
  });

  // 내려가는 계단: 보스방(없으면 가장 깊은 방) 안쪽 구석 쪽 바닥 칸.
  const deepRoom = deepRoomPre;
  if (deepRoom && exitKind === "down") {
    const def = kit(K.stairsDown);
    // 바닥 한가운데 쪽(여덟 이웃이 모두 바닥, 벽 바로 밑 줄 제외)에서 들어온 문과 가장 먼 칸 — 벽에 붙으면 벽으로 들어가는 계단처럼 보인다.
    const doors = corridors.filter((c) => c.a === deepRoom.id || c.b === deepRoom.id).map((c) => [c.rect.x + c.rect.w / 2, c.rect.y + c.rect.h / 2] as const);
    const inset = deepRoom.w >= 8 && deepRoom.h >= 7 ? 2 : 1;
    const cands = floorCells(deepRoom, inset).filter(([x, y]) => !blocked[idx(x, y)] && upper[idx(x, y)]! < 0 && !doorstep[idx(x, y)] && y > deepRoom.y + 1
      && [-1, 0, 1].every((dy) => [-1, 0, 1].every((dx) => isWalk(x + dx, y + dy) && !bridge[idx(x + dx, y + dy)] && upper[idx(x + dx, y + dy)]! < 0)));
    const doorDist = (x: number, y: number) => Math.min(...doors.map(([dx, dy]) => Math.abs(dx - x) + Math.abs(dy - y)), 99);
    const far = cands.sort((a, b) => doorDist(b[0], b[1]) - doorDist(a[0], a[1]));
    for (const [x, y] of far) {
      const was = lower[idx(x, y)]!;
      lower[idx(x, y)] = def.rows[0]!.tiles[0]!;
      blocked[idx(x, y)] = 1;
      if (!connected()) { lower[idx(x, y)] = was; blocked[idx(x, y)] = 0; continue; }
      stairsDown = { x, y };          // 계단 칸은 이벤트 자리로 비워 둔다(blocked 유지 — spots 에 들지 않게)
      // 도착 칸: 남쪽이 바닥이면 남쪽, 아니면 걸을 수 있는 이웃(계약: 아무 쪽에서나 밟는다)
      const fr = [[0, 1], [-1, 0], [1, 0], [0, -1]].map(([dx, dy]) => ({ x: x + dx!, y: y + dy! })).find((q) => isWalk(q.x, q.y) && !blocked[idx(q.x, q.y)]) ?? { x, y: y + 1 };
      blocked[idx(fr.x, fr.y)] = 1;
      exitStair = { x, y, front: fr, kind: "down" };
      counts["stairs-down"] = (counts["stairs-down"] ?? 0) + 1;
      break;
    }
  }

  // ---- 검사 1: 같은 규칙(groundSupport)으로 자기 결과를 본다. 어긋나면 맵을 만들지 않는다.
  const own = groundSupportIssues(pseudo, ts, { events: false }).filter((i) => i.severity === "error");
  if (own.length) throw new DungeonComposeError(`시공기 내부 오류: 받침 없는 물체 ${own.length}건 — ${own[0]!.message}`, "support-violation");

  // ---- 검사 2: 입구에서 모든 방·통로 바닥이 걸어서 닿는지.
  // 계단·문 앞 칸은 장식이 못 놓게 막아 두었다 — 걸어서 닿는지 볼 때는 바닥이고, 이벤트 자리(spots)에서는 뺀다.
  const reservedFront = new Set<number>();
  for (const st of [entryStair as DungeonStairCell | null, exitStair as DungeonStairCell | null, sideDoor as DungeonStairCell | null]) {
    if (!st) continue;
    reservedFront.add(idx(st.front.x, st.front.y));
    blocked[idx(st.front.x, st.front.y)] = 0;
  }
  const en = entryStair as DungeonStairCell | null;
  const entranceGuess = en ? { x: en.front.x, y: en.front.y } : { x: rooms[0]!.x + Math.floor(rooms[0]!.w / 2), y: rooms[0]!.y + rooms[0]!.h - 2 };
  const findStand = (x0: number, y0: number): [number, number] => {
    for (let r = 0; r < 8; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) if (stand(x0 + dx, y0 + dy)) return [x0 + dx, y0 + dy];
    throw new DungeonComposeError("입구 방에 설 수 있는 바닥이 없다.", "no-entrance");
  };
  const startCell = findStand(entranceGuess.x, entranceGuess.y);
  const seen = new Uint8Array(W * H);
  const queue: [number, number][] = [startCell]; seen[idx(startCell[0], startCell[1])] = 1;
  while (queue.length) {
    const [x, y] = queue.pop()!;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (!stand(nx, ny) || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1; queue.push([nx, ny]);
    }
  }
  const unreachable = rooms.filter((r) => !floorCells(r).some(([x, y]) => seen[idx(x, y)]));
  if (unreachable.length) throw new DungeonComposeError(`시공기 내부 오류: 입구에서 걸어 닿지 않는 방 ${unreachable.map((r) => r.id).join(", ")}`, "unreachable");
  const sd = stairsDown as { x: number; y: number } | null;
  if (sd && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[idx(sd.x + dx!, sd.y + dy!)])) throw new DungeonComposeError("시공기 내부 오류: 내려가는 계단에 닿지 않는다", "unreachable");
  const su = stairsUp as DungeonCompose["stairsUp"];
  if (su && !seen[idx(su.front.x, su.front.y)] && ![[1, 0], [-1, 0], [0, 1]].some(([dx, dy]) => seen[idx(su.front.x + dx!, su.front.y + dy!)])) throw new DungeonComposeError("시공기 내부 오류: 올라가는 계단 앞에 닿지 않는다", "unreachable");
  for (const st of [exitStair as DungeonStairCell | null, sideDoor as DungeonStairCell | null]) {
    if (st && !seen[idx(st.front.x, st.front.y)]) throw new DungeonComposeError(`시공기 내부 오류: ${st.kind === "door" ? "곁 문" : "다음 층 계단"} 앞 칸 (${st.front.x},${st.front.y}) 에 닿지 않는다`, "unreachable");
  }

  // ---- 잠긴 문 자리: 보물 방(없으면 보스방)으로 들어가는 통로 가운데 칸 ----
  const gateRoom = vaultRoom ?? bossRoom;
  const gateCorridor = gateRoom ? corridors.find((c) => c.b === gateRoom.id && !c.loop) : null;
  const gate = gateCorridor && gateRoom ? (() => {
    const r = gateCorridor.rect;
    const x = r.x + Math.floor(r.w / 2), y = r.y + Math.floor(r.h / 2);
    return stand(x, y) && seen[idx(x, y)] ? { x, y, to: gateRoom.id } : null;
  })() : null;

  // 이벤트·적을 둘 만한 빈 바닥 칸(방마다) — 위층 그림이 없고 네 이웃도 걸을 수 있고 입구에서 닿는 칸, 방 가운데에서 가까운 순.
  const spots: Record<string, { x: number; y: number }[]> = {};
  for (const r of rooms) {
    // 보스가 설 자리(우두머리 자리·뼈 제단 앞)가 있으면 그 칸에서 가까운 순 — 보스가 자리에서 떨어져 졸개처럼 서 있었다(2026-10-23 dg2-r1 VQA).
    const seat = ctx.seats[r.id];
    const ccx = seat ? seat.x : r.x + (r.w - 1) / 2, ccy = seat ? seat.y : r.y + (r.h - 1) / 2;
    const cells: { x: number; y: number; d: number }[] = [];
    for (const [x, y] of floorCells(r, 1)) {
      if (upper[idx(x, y)]! >= 0 || blocked[idx(x, y)] || !seen[idx(x, y)] || doorstep[idx(x, y)] || reservedFront.has(idx(x, y))) continue;
      if (![[1, 0], [-1, 0], [0, 1], [0, -1]].every(([ox, oy]) => stand(x + ox!, y + oy!))) continue;
      cells.push({ x, y, d: Math.abs(x - ccx) + Math.abs(y - ccy) });
    }
    cells.sort((a, b) => a.d - b.d);
    const picked: { x: number; y: number }[] = [];
    for (const c of cells) { if (picked.every((p) => Math.abs(p.x - c.x) + Math.abs(p.y - c.y) >= 3)) picked.push({ x: c.x, y: c.y }); if (picked.length >= 6) break; }
    spots[r.id] = picked;
  }

  void rimmed;
  void random;
  const picture = drawPicture(W, H, isFloor, isWall, upper, liquid, bridge);
  return {
    type, liquid: { kind: profile.liquid ?? (liquidCells && spec.flooded ? "water" : null), cells: liquidCells, bridges: bridgeCount },
    width: W, height: H, lower, upper, rooms, corridors, entrance: { x: startCell[0], y: startCell[1] }, stairsUp: su, stairsDown: sd,
    entryStair, exitStair, sideDoor,
    ...(outdoor ? { canopy: { style: profile.canopy ?? "leaf", cells: canopyCells } } : {}),
    ...(profile.bank && bankCells.length ? { banks: { style: profile.bank, cells: bankCells } } : {}),
    anchors: { boss: bossRoom?.id ?? null, treasure: vaultRoom?.id ?? null, gate }, spots, picture, counts, warnings,
  };
}

function drawPicture(W: number, H: number, isFloor: (x: number, y: number) => boolean, isWall: (x: number, y: number) => boolean, upper: readonly number[], liquid: Uint8Array, bridge: Uint8Array): string[] {
  const rows: string[] = [];
  for (let y = 0; y < H; y += 1) {
    let line = "";
    for (let x = 0; x < W; x += 1) line += upper[y * W + x]! >= 0 ? "o" : liquid[y * W + x] ? "~" : bridge[y * W + x] ? "=" : isFloor(x, y) ? "." : isWall(x, y) ? "W" : "#";
    rows.push(line);
  }
  return rows;
}
