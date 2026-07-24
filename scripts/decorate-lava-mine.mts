/**
 * map_sc_dungeon_lava(55×55, 사용자 개편 레이아웃)를 "용암 광산"으로 꾸민다.
 * - 사용자 천장/바닥/용암 배치는 보존. 벽 문법 복원(천장 남향 모서리 아래 2행 띠)만 lower에 추가.
 * - 광산 레일(upper) + 용암 위 판자 다리/플랫폼(lower 대체) + 골조(upper).
 * - 장식 40+개, 필드 몬스터 이벤트 6기(buildFieldMonsterEvent).
 * - 저장은 마지막에 한 번: loadProjectFromSupabase → 맵 하나만 교체 → saveProjectToSupabase.
 * 실행: npx tsx scripts/decorate-lava-mine.mts
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PNG } from "pngjs";
import { loadProjectFromSupabase, saveProjectToSupabase } from "../src/project/supabaseProjectSync.ts";
import { chipsetQuarterComposition } from "../src/project/defaults/terrainQuarterAutotile.ts";
import { buildFieldMonsterEvent, defaultFieldMonsterClearSwitchId } from "../src/project/fieldMonsterTemplate.ts";
import { charsetFrameIndex } from "../src/assets/easyrpgRtp.ts";
import type { EventPageGraphic, GameMap, Project } from "../src/project/types.ts";

const OUT = path.resolve("output/evidence/lava-mine-decor");
fs.mkdirSync(OUT, { recursive: true });
const T = 16;
const COLS = 30;
const W = 55;
const H = 55;
const MAP_ID = "map_sc_dungeon_lava";

// ── 타일 어휘 (tileSemanticsDungeon.ts / dungeonThemedLayouts.ts 정본) ──────
const FLOOR = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332]); // redrock
const LAVA = new Set([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335]);
const CEIL = new Set([249, 250, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341]); // pit-gold
const WALL_TOP = [102, 103, 104] as const; // 좌/중/우
const WALL_BODY = [132, 133, 134] as const;
const WALL_ALL = new Set<number>([...WALL_TOP, ...WALL_BODY]);
const ORE_TILES = new Set([255, 256, 257, 373, 403]);

const RAIL_V_TOP = 114;
const RAIL_V = 144;
const RAIL_H = [115, 116] as const;
const PLANK_H = [141, 142, 143] as const; // 좌/중/우 (lower, passable)
const TRESTLE: readonly (readonly number[])[] = [
  [57, 58, 59],
  [87, 88, 89],
];
const MINE_DOOR_TOP = 295;
const MINE_DOOR_BOTTOM = 325;

// ── env / 원격 로드 ─────────────────────────────────────────────────────────
const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
}
const config = {
  url: env.VITE_SUPABASE_URL!.replace(/\/$/, ""),
  anonKey: env.VITE_SUPABASE_ANON_KEY!,
  projectId: "rpg-zzu-showcase",
};
const project = await loadProjectFromSupabase(config);
if (!project) throw new Error("원격 로드 실패");
const map = project.maps[MAP_ID];
if (!map || map.width !== W || map.height !== H) throw new Error("맵 형상이 예상과 다름");

// ── 렌더러 (inspect-showcase-edits.mts 패턴) ────────────────────────────────
const chip = PNG.sync.read(fs.readFileSync("public/assets/easyrpg-chipset-dungeon-transparent.png"));
function renderMap(proj: Project, m: GameMap, file: string): void {
  const tileset = proj.tilesets[m.tilesetId];
  const scale = 2;
  const png = new PNG({ width: m.width * T * scale, height: m.height * T * scale });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 24; png.data[i + 1] = 22; png.data[i + 2] = 28; png.data[i + 3] = 255;
  }
  const blit = (tile: number, dx: number, dy: number, q?: { sx: number; sy: number; sw: number; sh: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * T + (q?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * T + (q?.sy ?? 0);
    const sw = q?.sw ?? T;
    const sh = q?.sh ?? T;
    for (let y = 0; y < sh * scale; y += 1) for (let x = 0; x < sw * scale; x += 1) {
      const si = ((sy0 + Math.floor(y / scale)) * chip.width + (sx0 + Math.floor(x / scale))) * 4;
      const di = ((dy + y) * png.width + (dx + x)) * 4;
      if (chip.data[si + 3] === 0) continue;
      png.data[di] = chip.data[si]!; png.data[di + 1] = chip.data[si + 1]!; png.data[di + 2] = chip.data[si + 2]!; png.data[di + 3] = 255;
    }
  };
  for (let y = 0; y < m.height; y += 1) for (let x = 0; x < m.width; x += 1) {
    const i = y * m.width + x;
    const dx = x * T * scale, dy = y * T * scale;
    const composition = tileset ? chipsetQuarterComposition(m, tileset, x, y) : null;
    if (composition) {
      blit(composition.underlayTile ?? m.lowerTiles[i]!, dx, dy);
      for (const src of composition.sources) {
        blit(src.tile, dx + src.offsetX * scale, dy + src.offsetY * scale, { sx: src.offsetX, sy: src.offsetY, sw: 8, sh: 8 });
      }
    } else if (m.lowerTiles[i]! >= 0) blit(m.lowerTiles[i]!, dx, dy);
    if (m.upperTiles[i]! >= 0) blit(m.upperTiles[i]!, dx, dy);
  }
  for (const ev of m.events ?? []) {
    const px = ev.x * T * scale, py = ev.y * T * scale;
    const s = Math.max(4, 2 * scale);
    for (let y = 0; y < s; y += 1) for (let x = 0; x < s; x += 1) {
      const di = ((py + y) * png.width + (px + (T * scale - s) + x)) * 4;
      if (di < 0 || di + 3 >= png.data.length) continue;
      png.data[di] = 255; png.data[di + 1] = 140; png.data[di + 2] = 0; png.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(OUT, file), PNG.sync.write(png));
  console.log("  rendered", path.join("output/evidence/lava-mine-decor", file));
}

renderMap(project, map, "before.png");

// ── 유틸 ────────────────────────────────────────────────────────────────────
const lower = map.lowerTiles;
const upper = map.upperTiles;
const idx = (x: number, y: number): number => y * W + x;
const inb = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H;
const at = (x: number, y: number): number => lower[idx(x, y)]!;
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260720);

// ── 1) 벽 문법 복원 ─────────────────────────────────────────────────────────
// 천장 셀 (x,y) 의 남쪽 (x,y+1)이 바닥이면 후보. 바닥 깊이(연속 바닥 행수) ≥ 4
// 일 때만 2행 벽(102-104 / 132-134)을 세워 통행로(≥2행)를 보존한다.
const snapshot = lower.slice();
const snapAt = (x: number, y: number): number => snapshot[idx(x, y)]!;
function floorDepth(x: number, y: number): number {
  let d = 0;
  let yy = y;
  while (yy < H && FLOOR.has(snapAt(x, yy))) { d += 1; yy += 1; }
  return d;
}
// 후보 구간 수집(스냅샷 기준). 이후 연결성 보존 그리디로 배치한다:
// 각 구간을 벽으로 막았을 때 인접 바닥들이 서로 연결 유지돼야 커밋.
// 4칸 이하의 자투리 고립(선반형 구석)만 허용 — 사용자 통로를 절대 끊지 않는다.
type WallRun = { y: number; x0: number; x1: number };
const runs: WallRun[] = [];
let skippedShallow = 0;
for (let y = 0; y < H - 2; y += 1) {
  let x = 0;
  while (x < W) {
    const ok = (xx: number): boolean =>
      CEIL.has(snapAt(xx, y)) && FLOOR.has(snapAt(xx, y + 1)) && floorDepth(xx, y + 1) >= 4;
    const edge = (xx: number): boolean =>
      CEIL.has(snapAt(xx, y)) && FLOOR.has(snapAt(xx, y + 1)) && !WALL_ALL.has(snapAt(xx, y + 1));
    if (!ok(x)) {
      if (edge(x)) skippedShallow += 1;
      x += 1;
      continue;
    }
    let x1 = x;
    while (x1 + 1 < W && ok(x1 + 1)) x1 += 1;
    runs.push({ y, x0: x, x1 });
    x = x1 + 1;
  }
}
const wallCells = new Set<number>();
let wallRuns = 0;
let skippedConn = 0;
let strandedCells = 0;
const isFloorNow = (x: number, y: number): boolean => inb(x, y) && FLOOR.has(at(x, y));
for (const run of runs) {
  const cells: { x: number; y: number }[] = [];
  for (let xx = run.x0; xx <= run.x1; xx += 1) {
    cells.push({ x: xx, y: run.y + 1 }, { x: xx, y: run.y + 2 });
  }
  const S = new Set(cells.map((c) => idx(c.x, c.y)));
  const neigh: { x: number; y: number }[] = [];
  for (const c of cells) for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const nx = c.x + dx, ny = c.y + dy;
    if (isFloorNow(nx, ny) && !S.has(idx(nx, ny))) neigh.push({ x: nx, y: ny });
  }
  if (neigh.length === 0) continue;
  // 전역 컴포넌트 라벨링(S 제외)
  const label = new Map<number, number>();
  const compSize = new Map<number, number>();
  let nComp = 0;
  for (let yy = 0; yy < H; yy += 1) for (let xx = 0; xx < W; xx += 1) {
    const i0 = idx(xx, yy);
    if (!isFloorNow(xx, yy) || S.has(i0) || label.has(i0)) continue;
    nComp += 1;
    let size = 0;
    const q = [{ x: xx, y: yy }];
    label.set(i0, nComp);
    while (q.length > 0) {
      const c = q.pop()!;
      size += 1;
      for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const nx = c.x + dx, ny = c.y + dy;
        const ni = idx(nx, ny);
        if (isFloorNow(nx, ny) && !S.has(ni) && !label.has(ni)) { label.set(ni, nComp); q.push({ x: nx, y: ny }); }
      }
    }
    compSize.set(nComp, size);
  }
  const neighLabels = [...new Set(neigh.map((c) => label.get(idx(c.x, c.y))!))];
  const bigLabels = neighLabels.filter((l) => (compSize.get(l) ?? 0) > 4);
  if (bigLabels.length > 1) { skippedConn += 1; continue; } // 통로를 끊는 벽 → 포기
  strandedCells += neighLabels.filter((l) => (compSize.get(l) ?? 0) <= 4)
    .reduce((a, l) => a + (compSize.get(l) ?? 0), 0);
  for (let xx = run.x0; xx <= run.x1; xx += 1) {
    const c = run.x0 === run.x1 ? 1 : xx === run.x0 ? 0 : xx === run.x1 ? 2 : 1;
    lower[idx(xx, run.y + 1)] = WALL_TOP[c]!;
    lower[idx(xx, run.y + 2)] = WALL_BODY[c]!;
    wallCells.add(idx(xx, run.y + 1));
    wallCells.add(idx(xx, run.y + 2));
  }
  wallRuns += 1;
}
console.log(`[벽 복원] 후보 ${runs.length}구간 중 ${wallRuns}구간 채택(${wallCells.size}칸), 통로 보존 포기 ${skippedConn}구간, 얕은 통로 스킵 ${skippedShallow}칸, 자투리 고립 ${strandedCells}칸`);

// ── 2) 갱도 입구 + 레일 경로 (A*, 회전 페널티) ──────────────────────────────
// 입구: 상단 벽면 띠(복원된 벽) 중 x 34..43 에서 아래 2칸이 바닥인 열.
let entrance: { x: number; y: number } | null = null;
for (const x of [38, 39, 40, 41, 42, 43, 37, 36]) {
  if (entrance) break;
  for (let y = 3; y <= 6; y += 1) {
    if (wallCells.has(idx(x, y)) && wallCells.has(idx(x, y + 1)) &&
      FLOOR.has(at(x, y + 2)) && FLOOR.has(at(x, y + 3))) {
      entrance = { x, y };
      break;
    }
  }
}
if (!entrance) throw new Error("입구 후보(복원 벽 + 아래 바닥 2칸)를 찾지 못함");
upper[idx(entrance.x, entrance.y)] = MINE_DOOR_TOP;
upper[idx(entrance.x, entrance.y + 1)] = MINE_DOOR_BOTTOM;
const railStart = { x: entrance.x, y: entrance.y + 2 };
console.log(`[입구] (${entrance.x},${entrance.y}) 어두운 통로 개구부 295/325, 레일 시점 (${railStart.x},${railStart.y})`);

const passable = (x: number, y: number): boolean =>
  inb(x, y) && FLOOR.has(at(x, y)) && upper[idx(x, y)]! < 0;

const GOAL = { x: 23, y: 50 }; // 용암 호수 동안(東岸) — 다리 시점(48-49행은 복원 벽)
type Node = { x: number; y: number; dir: number; g: number; f: number; prev: Node | null };
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]] as const;
function astar(sx: number, sy: number, gx: number, gy: number): { x: number; y: number }[] | null {
  const open: Node[] = [];
  const push = (n: Node): void => {
    open.push(n);
    let i = open.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (open[p]!.f <= open[i]!.f) break;
      [open[p], open[i]] = [open[i]!, open[p]!];
      i = p;
    }
  };
  const pop = (): Node => {
    const top = open[0]!;
    const last = open.pop()!;
    if (open.length > 0) {
      open[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = 2 * i + 2;
        let s = i;
        if (l < open.length && open[l]!.f < open[s]!.f) s = l;
        if (r < open.length && open[r]!.f < open[s]!.f) s = r;
        if (s === i) break;
        [open[s], open[i]] = [open[i]!, open[s]!];
        i = s;
      }
    }
    return top;
  };
  push({ x: sx, y: sy, dir: 1, g: 0, f: 0, prev: null });
  const best = new Map<string, number>();
  while (open.length > 0) {
    const cur = pop();
    if (cur.x === gx && cur.y === gy) {
      const out: { x: number; y: number }[] = [];
      for (let n: Node | null = cur; n; n = n.prev) out.push({ x: n.x, y: n.y });
      return out.reverse();
    }
    const key = `${cur.x},${cur.y},${cur.dir}`;
    if ((best.get(key) ?? Infinity) <= cur.g) continue;
    best.set(key, cur.g);
    for (let d = 0; d < 4; d += 1) {
      const nx = cur.x + DIRS[d]![0]!;
      const ny = cur.y + DIRS[d]![1]!;
      if (!passable(nx, ny)) continue;
      const g = cur.g + 1 + (d === cur.dir ? 0 : 4);
      push({ x: nx, y: ny, dir: d, g, f: g + Math.abs(gx - nx) + Math.abs(gy - ny), prev: cur });
    }
  }
  return null;
}
const railPath = astar(railStart.x, railStart.y, GOAL.x, GOAL.y);
if (!railPath) throw new Error("레일 경로 탐색 실패");
const railSet = new Set(railPath.map((p) => idx(p.x, p.y)));
let corners = 0;
for (let i = 0; i < railPath.length; i += 1) {
  const p = railPath[i]!;
  const prev = i === 0 ? { x: p.x, y: p.y - 1 } : railPath[i - 1]!; // 시점은 갱도(위)에서 나옴
  const next = i === railPath.length - 1 ? { x: p.x - 1, y: p.y } : railPath[i + 1]!; // 종점은 서쪽 다리로
  const vIn = prev.x === p.x;
  const vOut = next.x === p.x;
  let tile: number;
  if (vIn && vOut) tile = i === 0 ? RAIL_V_TOP : RAIL_V;
  else if (!vIn && !vOut) tile = RAIL_H[p.x % 2]!;
  else { tile = RAIL_H[(p.x + p.y) % 2]!; corners += 1; }
  upper[idx(p.x, p.y)] = tile;
}
console.log(`[레일] 본선 ${railPath.length}칸 (${railStart.x},${railStart.y})→(${GOAL.x},${GOAL.y}), 곡점 ${corners}개`);

// ── 3) 용암 위 판자 다리 + 채굴 플랫폼 + 골조 ──────────────────────────────
// 다리: row 50, x17..22 (용암 6칸). 플랫폼: x14..16 × y49..51 (3×3).
// 판자는 lower 대체(불투명·통행 가능), 레일은 upper 로 그 위를 지난다.
const plankCells: [number, number, number][] = [];
// row 49: 플랫폼 서단(141) → 다리 → 호안 접속 동단(143)
plankCells.push([14, 50, PLANK_H[0]!]);
for (let x = 15; x <= 21; x += 1) plankCells.push([x, 50, PLANK_H[1]!]);
plankCells.push([22, 50, PLANK_H[2]!]);
for (const y of [49, 51]) {
  plankCells.push([14, y, PLANK_H[0]!], [15, y, PLANK_H[1]!], [16, y, PLANK_H[2]!]);
}
let plankCount = 0;
for (const [x, y, t] of plankCells) {
  if (!LAVA.has(at(x, y))) throw new Error(`판자 자리 (${x},${y})가 용암이 아님`);
  lower[idx(x, y)] = t;
  plankCount += 1;
}
// 다리 위 레일(upper): 플랫폼 중심 x15 → 호안 x22
for (let x = 15; x <= 22; x += 1) upper[idx(x, 50)] = RAIL_H[x % 2]!;
// 골조(3×2, 투명 오버레이): 플랫폼 북/남측 용암 위
for (const [tx, ty] of [[14, 47], [14, 52]] as const) {
  for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 3; dx += 1) {
    if (LAVA.has(at(tx + dx, ty + dy))) upper[idx(tx + dx, ty + dy)] = TRESTLE[dy]![dx]!;
  }
}
console.log(`[다리] 판자 ${plankCount}칸(다리 6 + 플랫폼 3×3), 다리 레일 8칸, 골조 2기`);

// ── 4) 광맥 패치 (복원 벽 lower 대체) ───────────────────────────────────────
// 금맥 255-257: 벽 몸통(132-134) 가로 3연속 → 2곳. 청광석 373/403: 벽 상/하 세로쌍 → 2곳.
const decorLog = new Map<string, number>();
const bump = (k: string, n = 1): void => { decorLog.set(k, (decorLog.get(k) ?? 0) + n); };
function findWallRun(minLen: number, used: Set<number>): { x: number; y: number } | null {
  const ys = [...new Set([...wallCells].map((i) => Math.floor(i / W)))].sort(() => rand() - 0.5);
  for (const y of ys) {
    for (let x = 1; x < W - minLen; x += 1) {
      let ok = true;
      for (let k = 0; k < minLen; k += 1) {
        const i = idx(x + k, y);
        if (!wallCells.has(i) || !(WALL_BODY as readonly number[]).includes(lower[i]!) || used.has(i)) { ok = false; break; }
      }
      if (ok) return { x, y };
    }
  }
  return null;
}
const oreUsed = new Set<number>();
for (let n = 0; n < 2; n += 1) {
  const run = findWallRun(3, oreUsed);
  if (!run) break;
  for (let k = 0; k < 3; k += 1) {
    lower[idx(run.x + k, run.y)] = [255, 256, 257][k]!;
    oreUsed.add(idx(run.x + k, run.y));
    // 주변 3칸도 재사용 금지(뭉침 방지)
    for (let m = -3; m < 6; m += 1) oreUsed.add(idx(Math.max(0, Math.min(W - 1, run.x + m)), run.y));
  }
  bump("금맥 암반(255-257)", 3);
}
let blueOre = 0;
for (const i of [...wallCells].sort(() => rand() - 0.5)) {
  if (blueOre >= 2) break;
  const x = i % W, y = Math.floor(i / W);
  const top = idx(x, y), body = idx(x, y + 1);
  if (!(WALL_TOP as readonly number[]).includes(lower[top]!) || !wallCells.has(body)) continue;
  if (!(WALL_BODY as readonly number[]).includes(lower[body]!) || oreUsed.has(top) || oreUsed.has(body)) continue;
  if (upper[top]! >= 0 || upper[body]! >= 0) continue;
  lower[top] = 373;
  lower[body] = 403;
  oreUsed.add(top); oreUsed.add(body);
  for (let m = -3; m <= 3; m += 1) if (inb(x + m, y)) { oreUsed.add(idx(x + m, y)); oreUsed.add(idx(x + m, y + 1)); }
  blueOre += 1;
  bump("청광석 암반(373/403)", 2);
}

// ── 5) 장식 배치 ────────────────────────────────────────────────────────────
const blocked = new Set<number>(); // 시각상 solid 장식 칸(통행 검증용)
const placedPts: { x: number; y: number }[] = [];
function farEnough(x: number, y: number, minDist: number): boolean {
  return placedPts.every((p) => Math.abs(p.x - x) + Math.abs(p.y - y) >= minDist);
}
function freeUpper(x: number, y: number): boolean {
  return inb(x, y) && upper[idx(x, y)]! < 0;
}
const isSolidLower = (x: number, y: number): boolean =>
  !inb(x, y) || CEIL.has(at(x, y)) || LAVA.has(at(x, y)) || WALL_ALL.has(at(x, y)) || ORE_TILES.has(at(x, y));
const adjSolid = (x: number, y: number): boolean =>
  isSolidLower(x, y - 1) || isSolidLower(x, y + 1) || isSolidLower(x - 1, y) || isSolidLower(x + 1, y);
// 국소 안전성: 장식 칸들을 막았을 때 주변 통행 셀이 11×11 창 안에서 서로 연결 유지
function localSafe(cells: readonly { x: number; y: number }[]): boolean {
  const block = new Set(cells.map((c) => idx(c.x, c.y)));
  const cx = cells[0]!.x, cy = cells[0]!.y;
  const pass = (x: number, y: number): boolean =>
    inb(x, y) && Math.abs(x - cx) <= 5 && Math.abs(y - cy) <= 5 &&
    FLOOR.has(at(x, y)) && !block.has(idx(x, y)) && !blocked.has(idx(x, y));
  const seeds: { x: number; y: number }[] = [];
  for (const c of cells) for (const [dx, dy] of DIRS) {
    if (pass(c.x + dx, c.y + dy)) seeds.push({ x: c.x + dx, y: c.y + dy });
  }
  if (seeds.length === 0) return false;
  const seen = new Set<number>([idx(seeds[0]!.x, seeds[0]!.y)]);
  const q = [seeds[0]!];
  while (q.length > 0) {
    const c = q.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (pass(nx, ny) && !seen.has(idx(nx, ny))) { seen.add(idx(nx, ny)); q.push({ x: nx, y: ny }); }
    }
  }
  return seeds.every((s) => seen.has(idx(s.x, s.y)));
}
function placeSolid(label: string, cells: readonly { x: number; y: number; tile: number }[], minDist = 4): boolean {
  for (const c of cells) {
    if (!freeUpper(c.x, c.y) || !FLOOR.has(at(c.x, c.y)) || railSet.has(idx(c.x, c.y))) return false;
  }
  if (!farEnough(cells[0]!.x, cells[0]!.y, minDist)) return false;
  if (!localSafe(cells)) return false;
  for (const c of cells) { upper[idx(c.x, c.y)] = c.tile; blocked.add(idx(c.x, c.y)); }
  placedPts.push({ x: cells[0]!.x, y: cells[0]!.y });
  bump(label);
  return true;
}
function placePassable(label: string, x: number, y: number, tile: number, minDist = 4): boolean {
  if (!freeUpper(x, y) || !FLOOR.has(at(x, y)) || railSet.has(idx(x, y)) || !farEnough(x, y, minDist)) return false;
  upper[idx(x, y)] = tile;
  placedPts.push({ x, y });
  bump(label);
  return true;
}
// 후보 스캔(셔플)
const floorCells: { x: number; y: number }[] = [];
for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
  if (FLOOR.has(at(x, y))) floorCells.push({ x, y });
}
const shuffled = <A>(arr: A[]): A[] => arr.map((v) => [rand(), v] as const).sort((a, b) => a[0] - b[0]).map(([, v]) => v);
const nearLava = (x: number, y: number, r: number): boolean => {
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (inb(x + dx, y + dy) && LAVA.has(at(x + dx, y + dy))) return true;
  }
  return false;
};
const nearRail = (x: number, y: number, r: number): boolean => {
  for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (inb(x + dx, y + dy) && railSet.has(idx(x + dx, y + dy))) return true;
  }
  return false;
};

// 5a. 입구 석주 페어(447/477) — 레일 시점 좌우
for (const px of [railStart.x - 2, railStart.x + 2]) {
  placeSolid("석조 기둥(447/477)", [
    { x: px, y: railStart.y, tile: 447 },
    { x: px, y: railStart.y + 1, tile: 477 },
  ], 0);
}
// 5b. 벽걸이 횃불 264 ×8 — 벽 상단(102-104) 위 upper
let wt = 0;
for (const i of shuffled([...wallCells])) {
  if (wt >= 8) break;
  const x = i % W, y = Math.floor(i / W);
  if (!(WALL_TOP as readonly number[]).includes(lower[i]!)) continue;
  if (!freeUpper(x, y) || !farEnough(x, y, 6)) continue;
  upper[i] = 264;
  placedPts.push({ x, y });
  bump("벽걸이 횃불(264)");
  wt += 1;
}
// 5c. 삼각 횃불 263/293 ×5 — 레일 인접 바닥
let st = 0;
for (const c of shuffled(floorCells)) {
  if (st >= 5) break;
  if (!nearRail(c.x, c.y, 2) || railSet.has(idx(c.x, c.y))) continue;
  if (!FLOOR.has(at(c.x, c.y + 1)) || railSet.has(idx(c.x, c.y + 1))) continue;
  if (placeSolid("횃불 화로대(263/293)", [
    { x: c.x, y: c.y, tile: 263 },
    { x: c.x, y: c.y + 1, tile: 293 },
  ], 7)) st += 1;
}
// 5d. 푸른 수정 기둥 119/149 ×3 — 용암 호수 연안
let cp = 0;
for (const c of shuffled(floorCells)) {
  if (cp >= 3) break;
  if (!nearLava(c.x, c.y, 3)) continue;
  if (!FLOOR.has(at(c.x, c.y + 1))) continue;
  if (placeSolid("푸른 수정 기둥(119/149)", [
    { x: c.x, y: c.y, tile: 119 },
    { x: c.x, y: c.y + 1, tile: 149 },
  ], 6)) cp += 1;
}
// 5e. 수정 첨탑 262/292 ×2
let cs = 0;
for (const c of shuffled(floorCells)) {
  if (cs >= 2) break;
  if (!adjSolid(c.x, c.y) || !FLOOR.has(at(c.x, c.y + 1))) continue;
  if (placeSolid("수정 첨탑(262/292)", [
    { x: c.x, y: c.y, tile: 262 },
    { x: c.x, y: c.y + 1, tile: 292 },
  ], 8)) cs += 1;
}
// 5f. 2×2 스탬프: 바위 무더기 ×2, 대형 바위 더미 ×1, 대형 수정 군집 ×1
const stamps: { label: string; m: number[][]; count: number; lava?: boolean }[] = [
  { label: "바위 무더기 2×2(318..349)", m: [[318, 319], [348, 349]], count: 2 },
  { label: "대형 바위 더미 2×2(322..353)", m: [[322, 323], [352, 353]], count: 1 },
  { label: "대형 수정 군집 2×2(320..351)", m: [[320, 321], [350, 351]], count: 1, lava: true },
];
for (const s of stamps) {
  let done = 0;
  for (const c of shuffled(floorCells)) {
    if (done >= s.count) break;
    if (s.lava && !nearLava(c.x, c.y, 4)) continue;
    if (!adjSolid(c.x, c.y)) continue;
    const cells = [
      { x: c.x, y: c.y, tile: s.m[0]![0]! }, { x: c.x + 1, y: c.y, tile: s.m[0]![1]! },
      { x: c.x, y: c.y + 1, tile: s.m[1]![0]! }, { x: c.x + 1, y: c.y + 1, tile: s.m[1]![1]! },
    ];
    if (placeSolid(s.label, cells, 9)) done += 1;
  }
}
// 5g. 단일 바위/잔돌/수정 소품
const singles: { label: string; tiles: number[]; count: number; lava?: boolean }[] = [
  { label: "바위 조각(259/260/290/288)", tiles: [259, 260, 290, 288, 259, 260], count: 6 },
  { label: "잔돌 무더기(382/383/412)", tiles: [382, 383, 412], count: 3 },
  { label: "수정 소품(117/289/413)", tiles: [117, 289, 413, 289], count: 4, lava: true },
];
for (const s of singles) {
  let done = 0;
  for (const c of shuffled(floorCells)) {
    if (done >= s.count) break;
    if (s.lava && !nearLava(c.x, c.y, 5)) continue;
    if (!adjSolid(c.x, c.y)) continue;
    if (placeSolid(s.label, [{ x: c.x, y: c.y, tile: s.tiles[done % s.tiles.length]! }], 6)) done += 1;
  }
}
// 5h. 통행 가능 데코: 해골 299 ×4, 박쥐 267 ×2, 거미줄 268/269 ×2
let sk = 0;
for (const c of shuffled(floorCells)) {
  if (sk >= 4) break;
  if (adjSolid(c.x, c.y) && placePassable("해골과 뼈(299)", c.x, c.y, 299, 8)) sk += 1;
}
let bats = 0;
for (const c of shuffled(floorCells)) {
  if (bats >= 2) break;
  if (isSolidLower(c.x, c.y - 1) && placePassable("박쥐 그림자(267)", c.x, c.y, 267, 10)) bats += 1;
}
let webs = 0;
for (const c of shuffled(floorCells)) {
  if (webs >= 2) break;
  if (isSolidLower(c.x, c.y - 1) && (isSolidLower(c.x - 1, c.y) || isSolidLower(c.x + 1, c.y)) &&
    placePassable("검은 거미줄(268/269)", c.x, c.y, webs === 0 ? 268 : 269, 10)) webs += 1;
}
// 5i. 용암 화염 208 ×3 (다리·플랫폼에서 4칸 이상)
let fires = 0;
for (let y = 36; y < H && fires < 3; y += 1) for (let x = 0; x < 24 && fires < 3; x += 1) {
  if (!LAVA.has(at(x, y)) || !freeUpper(x, y)) continue;
  if (Math.abs(x - 18) + Math.abs(y - 50) < 8) continue;
  if (!farEnough(x, y, 9)) continue;
  if (rand() < 0.85) continue;
  upper[idx(x, y)] = 208;
  placedPts.push({ x, y });
  bump("용암 화염(208)");
  fires += 1;
}
// 5j. 광차 적재장 소품: 플랫폼·호안에 통/물동이/선반/팻말/룬석판
const props: { label: string; x: number; y: number; tile: number; solid: boolean }[] = [
  { label: "고리버들 통(417)", x: 14, y: 49, tile: 417, solid: false }, // 판자 위 — upper 직접
  { label: "나무 물동이(419)", x: 14, y: 51, tile: 419, solid: false },
  { label: "고리버들 통(417)", x: 24, y: 51, tile: 417, solid: true },
  { label: "룬 새김 팻말(298)", x: railStart.x + 1, y: railStart.y + 1, tile: 298, solid: true },
  { label: "나무 선반(297)", x: railStart.x - 1, y: railStart.y + 2, tile: 297, solid: true },
  { label: "룬 석판(265)", x: 25, y: 44, tile: 265, solid: true },
];
for (const p of props) {
  if (p.solid) {
    placeSolid(p.label, [{ x: p.x, y: p.y, tile: p.tile }], 0);
  } else if (freeUpper(p.x, p.y)) {
    upper[idx(p.x, p.y)] = p.tile;
    bump(p.label);
  }
}
const decorTotal = [...decorLog.values()].reduce((a, b) => a + b, 0);
console.log("[장식]", decorTotal, "칸:", [...decorLog.entries()].map(([k, v]) => `${k}×${v}`).join(", "));

// ── 6) 필드 몬스터 6기 ──────────────────────────────────────────────────────
const MON1 = "tex_easyrpg_charset_monster1";
const MON2 = "tex_easyrpg_charset_monster2";
const MON3 = "tex_easyrpg_charset_monster3";
function monGraphic(spriteId: string, characterIndex: number): EventPageGraphic {
  return {
    sprite: { type: "bundled", id: spriteId },
    direction: "down",
    pattern: charsetFrameIndex({ characterIndex, direction: "down", pattern: 1 }),
  };
}
const pathAt = (f: number): { x: number; y: number } => railPath[Math.floor(railPath.length * f)]!;
function offPathFloor(cx: number, cy: number): { x: number; y: number } {
  let bestC: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (const c of floorCells) {
    const i = idx(c.x, c.y);
    if (railSet.has(i) || blocked.has(i) || upper[i]! >= 0) continue;
    const d = Math.abs(c.x - cx) + Math.abs(c.y - cy);
    if (d < bestD) { bestD = d; bestC = c; }
  }
  if (!bestC) throw new Error("오프패스 몬스터 자리 없음");
  return bestC;
}
const monsterSpecs = [
  { id: "ev_lava_mine_bats_1", troop: "troop_bat_swarm", g: monGraphic(MON3, 0), pos: pathAt(0.18), intro: ["갱도 천장에서 화산 박쥐 떼가 쏟아진다!"], victory: ["박쥐 떼가 흩어졌다. 레일이 다시 조용해졌다."] },
  { id: "ev_lava_mine_slimes", troop: "troop_slime_pair", g: monGraphic(MON1, 0), pos: pathAt(0.42), intro: ["끓는 바닥 틈에서 마그마 슬라임들이 스며 나온다!"], victory: ["슬라임이 굳어 바스러졌다."] },
  { id: "ev_lava_mine_golem_1", troop: "troop_golem_guard", g: monGraphic(MON2, 4), pos: pathAt(0.65), intro: ["버려진 광차 곁의 바위가 몸을 일으킨다 — 광산 골렘이다!"], victory: ["골렘이 무너져 통로가 열렸다."] },
  { id: "ev_lava_mine_bats_2", troop: "troop_bat_swarm", g: monGraphic(MON3, 0), pos: offPathFloor(45, 18), intro: ["동쪽 막장의 어둠 속에서 날갯소리가 몰려온다!"], victory: ["막장이 조용해졌다."] },
  { id: "ev_lava_mine_golem_2", troop: "troop_golem_guard", g: monGraphic(MON2, 4), pos: pathAt(0.88), intro: ["호숫가 경비 골렘이 붉게 달아오른 주먹을 치켜든다!"], victory: ["골렘의 핵이 식어 떨어졌다."] },
  { id: "ev_lava_mine_dragon", troop: "troop_dragon", g: monGraphic(MON3, 5), pos: { x: 15, y: 50 }, intro: ["채굴 플랫폼 한복판 — 용암 속에서 붉은 드래곤이 솟아오른다!", "\"내 둥지의 광맥에 손대는 자, 재가 되리라!\""], victory: ["드래곤이 용암 밑으로 가라앉았다.", "광산의 광맥은 이제 안전하다."], canEscape: false },
];
map.events = map.events ?? [];
for (const s of monsterSpecs) {
  const sw = defaultFieldMonsterClearSwitchId(s.id);
  if (!project.switches.some((r) => r.id === sw)) project.switches.push({ id: sw, name: `전투 완료: ${s.id}` });
  project.session.switches[sw] ??= false;
  map.events.push(buildFieldMonsterEvent({
    eventId: s.id,
    troopId: s.troop,
    clearSwitchId: sw,
    graphic: s.g,
    intro: s.intro,
    victory: s.victory,
    canEscape: s.canEscape ?? true,
    x: s.pos.x,
    y: s.pos.y,
  }));
  console.log(`[몹] ${s.id} → ${s.troop} @ (${s.pos.x},${s.pos.y})`);
}

// ── 7) 통행 검증 ────────────────────────────────────────────────────────────
function reach(from: { x: number; y: number }): Set<number> {
  const pass = (x: number, y: number): boolean =>
    inb(x, y) && (FLOOR.has(at(x, y)) || (PLANK_H as readonly number[]).includes(at(x, y))) && !blocked.has(idx(x, y));
  const seen = new Set<number>([idx(from.x, from.y)]);
  const q = [from];
  while (q.length > 0) {
    const c = q.pop()!;
    for (const [dx, dy] of DIRS) {
      const nx = c.x + dx, ny = c.y + dy;
      if (pass(nx, ny) && !seen.has(idx(nx, ny))) { seen.add(idx(nx, ny)); q.push({ x: nx, y: ny }); }
    }
  }
  return seen;
}
const reachable = reach(railStart);
if (!reachable.has(idx(GOAL.x, GOAL.y))) throw new Error("입구→호안 통행 불가");
if (!reachable.has(idx(15, 50))) throw new Error("입구→플랫폼 통행 불가");
for (const s of monsterSpecs) {
  if (!reachable.has(idx(s.pos.x, s.pos.y))) throw new Error(`몬스터 ${s.id} 위치 도달 불가`);
}
const totalFloor = floorCells.filter((c) => !blocked.has(idx(c.x, c.y))).length;
console.log(`[통행] 입구 기준 도달 ${reachable.size}칸 / 비차단 바닥+판자 ${totalFloor + plankCount}칸`);

// ── 8) 저장 (한 번만) → 재로드 검증 → 렌더 ─────────────────────────────────
const hash = (m: GameMap): string =>
  crypto.createHash("sha256").update(JSON.stringify([m.lowerTiles, m.upperTiles, (m.events ?? []).map((e) => [e.id, e.x, e.y])])).digest("hex").slice(0, 16);
const localHash = hash(map);
if (process.argv.includes("--dry")) {
  renderMap(project, map, "after.dry.png");
  console.log(`[드라이런] 저장 생략. localHash=${localHash}`);
  process.exit(0);
}
const saved = await saveProjectToSupabase(project, config);
console.log("[저장]", (saved as { kind?: string })?.kind);
if ((saved as { kind?: string })?.kind !== "saved") throw new Error("저장 실패: " + JSON.stringify(saved));
const reloaded = await loadProjectFromSupabase(config);
if (!reloaded) throw new Error("재로드 실패");
const remoteMap = reloaded.maps[MAP_ID]!;
const remoteHash = hash(remoteMap);
console.log(`[검증] local=${localHash} remote=${remoteHash} 일치=${localHash === remoteHash}`);
renderMap(reloaded, remoteMap, "after.png");
console.log("완료");
