// 설계한 높이 단 → map.relief(2026-10-30 「높이(단·계단)를 설계 항목에」). 마을 지형과 같은 relief 와 같은 버들항 돌계단(bd-mpart-stairs 화소, *-steps 양식).
// 방 높이는 모델이 정했다(rooms[].level). 함수가 하는 일: 통로 칸 높이를 가까운 방 높이로 채우고, 높이가 다른 굴이 입구에서 닿도록
// 경계마다 곧은 계단 한 줄(폭 1~3, 단 차 + 1칸 길이, 양 끝 층계참)을 놓는다. 계단 자리가 없으면 그 방을 낮춰 「고침:」으로 알린다.
import type { PlacedRoom } from "./types";

export interface DungeonReliefPlan {
  levels: number[];
  /** relief.ramps: 0 없음 · 5~8 계단(오르막 n·s·e·w + 4). */
  ramps: number[];
  /** 계단·층계참 칸 — 장식·이벤트 자리에서 뺀다. */
  reserved: number[];
  fixes: string[];
  stairs: number;
}

const DIRS = [["n", 0, -1], ["s", 0, 1], ["e", 1, 0], ["w", -1, 0]] as const;
const RAMP: Record<string, number> = { n: 5, s: 6, e: 7, w: 8 };

/**
 * floor: 열린 칸 · roomAt: 방 번호(-1 통로) · liquid · bridge · protect(문 앞 칸) — compose 의 마스크 그대로.
 * wallRows: 벽 앞면 줄 수(벽 칸 높이는 바로 아래 바닥 높이를 따른다).
 */
export function planDungeonRelief(
  W: number, H: number, floor: Uint8Array, roomAt: Int16Array, liquid: Uint8Array, bridge: Uint8Array, protect: Uint8Array,
  rooms: readonly PlacedRoom[], wallRows: number,
): DungeonReliefPlan | undefined {
  void protect;   // 문 앞 칸에도 계단을 놓는다(걷는 칸이라 막지 않는다)
  const roomLevel = rooms.map((r) => Math.max(0, Math.min(2, Math.round(r.level ?? 0))));
  if (!roomLevel.some((v) => v > 0)) return undefined;
  const fixes: string[] = [];
  const idx = (x: number, y: number) => y * W + x;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const walk = (i: number) => floor[i] === 1 && (!liquid[i] || bridge[i] === 1);
  let levels = new Array<number>(W * H).fill(0);
  let ramps = new Array<number>(W * H).fill(0);
  let reserved = new Set<number>();
  let stairs = 0;
  for (let round = 0; round <= rooms.length; round += 1) {
    // 1) 바닥 높이: 방 칸은 그 방, 통로 칸은 가장 가까운 방(낮은 방 먼저 퍼뜨려 동률은 낮은 쪽)
    levels = new Array<number>(W * H).fill(-1);
    ramps = new Array<number>(W * H).fill(0);
    reserved = new Set<number>();
    stairs = 0;
    const order = [...new Set(roomLevel)].sort((a, b) => a - b);
    let q: number[] = [];
    for (const lv of order) for (let i = 0; i < W * H; i += 1) if (floor[i] && roomAt[i]! >= 0 && roomLevel[roomAt[i]!] === lv) { levels[i] = lv; q.push(i); }
    for (let k = 0; k < q.length; k += 1) {
      const c = q[k]!, x = c % W, y = (c - x) / W;
      for (const [, dx, dy] of DIRS) { const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (floor[n] && levels[n]! < 0) { levels[n] = levels[c]!; q.push(n); } }
    }
    for (let i = 0; i < W * H; i += 1) if (floor[i] && levels[i]! < 0) levels[i] = 0;
    // 2) 입구에서 닿는 칸을 넓히며 경계마다 계단 한 줄
    const entryCell = (() => { for (let i = 0; i < W * H; i += 1) if (roomAt[i] === 0 && walk(i)) return i; return -1; })();
    if (entryCell < 0) return undefined;
    const reach = new Uint8Array(W * H);
    const flood = (from: number[]) => {
      const qq = [...from]; for (const s of from) reach[s] = 1;
      for (let k = 0; k < qq.length; k += 1) {
        const c = qq[k]!, x = c % W, y = (c - x) / W;
        for (const [, dx, dy] of DIRS) {
          const X = x + dx, Y = y + dy; if (!inb(X, Y)) continue; const n = idx(X, Y);
          if (reach[n] || !walk(n)) continue;
          // 계단 칸은 축 방향으로만, 높이가 다르면 계단 끝 층계참으로만
          if (levels[n] !== levels[c] && !(ramps[n] || ramps[c])) continue;
          if (ramps[c] || ramps[n]) { if (!stepOk(c, n)) continue; }
          reach[n] = 1; qq.push(n);
        }
      }
    };
    /** 계단 칸 걷기: 계단 줄 안에서는 축 방향만, 낮은 끝 ↔ 낮은 층계참, 높은 끝 ↔ 높은 층계참. */
    const flights: { cells: Set<number>; dx: number; dy: number; lo: number; hi: number; first: Set<number>; last: Set<number> }[] = [];
    const flightOf = (i: number) => flights.find((f) => f.cells.has(i));
    function stepOk(a: number, b: number): boolean {
      const fa = flightOf(a), fb = flightOf(b);
      const ax = a % W, ay = (a - ax) / W, bx = b % W, by = (b - bx) / W, sx = bx - ax, sy = by - ay;
      if (fa && fb) return fa === fb && sx * fa.dy === 0 && sy * fa.dx === 0;
      const f = (fa ?? fb)!;
      if (sx * f.dy !== 0 || sy * f.dx !== 0) return false;   // 옆구리
      const rampCell = fa ? a : b, plain = fa ? b : a, out = fa ? [sx, sy] : [-sx, -sy];
      const up = out[0] === f.dx && out[1] === f.dy;
      return up ? f.last.has(rampCell) && levels[plain] === f.hi : f.first.has(rampCell) && levels[plain] === f.lo;
    }
    flood([entryCell]);
    for (let guard = 0; guard < 24; guard += 1) {
      // 닿은 칸과 4이웃으로 붙은, 높이가 다른 닿지 않은 칸 → 계단 후보
      let best: { lanes: number[][]; dx: number; dy: number; lo: number; hi: number; score: number; hiLanding: number[] } | null = null;
      for (let c = 0; c < W * H; c += 1) {
        if (!reach[c] || ramps[c] || reserved.has(c)) continue;
        const x = c % W, y = (c - x) / W;
        for (const [, dx, dy] of DIRS) {
          const n = idx(x + dx, y + dy);
          if (!inb(x + dx, y + dy) || reach[n] || !walk(n) || levels[n] === levels[c]) continue;
          const a = levels[c]!, b = levels[n]!, dl = Math.abs(a - b);
          // 오르막 방향(낮은 쪽 → 높은 쪽): 닿은 쪽이 낮으면 d, 높으면 -d
          const goingUp = b > a;
          const ux = goingUp ? dx : -dx, uy = goingUp ? dy : -dy;
          const L = dl + 1;
          // 줄: 낮은 층계참 · 계단 L칸 · 높은 층계참 — 닿은 칸 c 에서 시작한다(오르막이면 c 가 낮은 층계참, 내리막이면 c 가 높은 층계참)
          const lane = (o: number): number[] | null => {
            const px = dy !== 0 ? o : 0, py = dx !== 0 ? o : 0;
            const sx = x + px, sy = y + py;
            const cells: number[] = [];
            for (let k = 0; k <= L + 1; k += 1) { const X = sx + dx * k, Y = sy + dy * k; if (!inb(X, Y)) return null; cells.push(idx(X, Y)); }
            if (!cells.every((i) => walk(i) && !ramps[i])) return null;
            // 닿은 쪽 끝(첫 칸)은 닿은 칸이고 그 높이, 반대 끝은 닿지 않은 쪽 높이여야 한다
            if (!reach[cells[0]!] || levels[cells[0]!] !== a || levels[cells[L + 1]!] !== b) return null;
            if (cells.some((i) => liquid[i])) return null;
            return cells;
          };
          const lanes: number[][] = [];
          const l0 = lane(0); if (!l0) continue;
          lanes.push(l0);
          for (const s of [1, -1]) for (let o = s; Math.abs(o) <= 2 && lanes.length < 3; o += s) { const l = lane(o); if (!l) break; if (s > 0) lanes.push(l); else lanes.unshift(l); }
          // 점수: 폭 2~3, 계단 줄 옆이 벽(좁은 통로), 남북 계단(3/4 에서 잘 읽힌다), 방 안보다 통로
          const sideWall = (() => {
            const first = lanes[0]!, last = lanes[lanes.length - 1]!; let walls = 0;
            const px = dy !== 0 ? 1 : 0, py = dx !== 0 ? 1 : 0;
            for (let k = 1; k <= L; k += 1) {
              const f = first[k]!, g = last[k]!; const fx = f % W, fy = (f - fx) / W, gx = g % W, gy = (g - gx) / W;
              if (!inb(fx - px, fy - py) || !floor[idx(fx - px, fy - py)]) walls += 1;
              if (!inb(gx + px, gy + py) || !floor[idx(gx + px, gy + py)]) walls += 1;
            }
            return walls / (2 * L);
          })();
          const inRoom = lanes.flat().filter((i) => roomAt[i]! >= 0).length / lanes.flat().length;
          // 남북 계단이 먼저 — 버들항 칩셋 돌계단 조각은 남북으로 오르는 것뿐(동서는 바닥 비탈로 그린다)
          const score = Math.min(lanes.length, 3) * 2 + sideWall * 4 + (uy !== 0 ? 12 : 0) - inRoom * 2;
          if (!best || score > best.score) best = { lanes: lanes.map((l) => (goingUp ? l : [...l].reverse())), dx: ux, dy: uy, lo: Math.min(a, b), hi: Math.max(a, b), score, hiLanding: [] };
        }
      }
      if (!best) break;
      // 놓기: 줄마다 [낮은 층계참, 계단 L칸, 높은 층계참] (오르막 순서로 뒤집어 두었다)
      const dir = DIRS.find(([, dx, dy]) => dx === best!.dx && dy === best!.dy)![0];
      const f = { cells: new Set<number>(), dx: best.dx, dy: best.dy, lo: best.lo, hi: best.hi, first: new Set<number>(), last: new Set<number>() };
      for (const l of best.lanes) {
        const L = l.length - 2;
        levels[l[0]!] = best.lo; levels[l[L + 1]!] = best.hi;
        for (let k = 1; k <= L; k += 1) { levels[l[k]!] = best.lo; ramps[l[k]!] = RAMP[dir]!; f.cells.add(l[k]!); }
        f.first.add(l[1]!); f.last.add(l[L]!);
        for (const i of l) reserved.add(i);
      }
      flights.push(f); stairs += 1;
      reach.fill(0); flood([entryCell]);
    }
    // 3) 닿지 않은 방: 가장 높은 것부터 한 단 낮춰 다시
    const lost = rooms.map((_, k) => k).filter((k) => { for (let i = 0; i < W * H; i += 1) if (roomAt[i] === k && reach[i]) return false; for (let i = 0; i < W * H; i += 1) if (roomAt[i] === k && walk(i)) return true; return false; });
    if (!lost.length) break;
    const k = lost.sort((a, b) => roomLevel[b]! - roomLevel[a]!)[0]!;
    if (roomLevel[k] === 0) break;
    roomLevel[k] = roomLevel[k]! - 1;
    fixes.push(`고침: 방 ${rooms[k]!.id} 으로 오르는 곧은 계단 자리(길 폭·층계참)가 없어 한 단 낮췄다(높이 ${roomLevel[k]! + 1} → ${roomLevel[k]}).`);
    if (!roomLevel.some((v) => v > 0)) return { levels: new Array<number>(W * H).fill(0), ramps: new Array<number>(W * H).fill(0), reserved: [], fixes, stairs: 0 };
  }
  // 4) 벽·천장 칸: 바로 아래(벽 앞면 줄 + 한 줄 안) 바닥 높이를 따른다 — 들린 방의 벽 앞면이 같이 들린다. 그 밖은 0.
  for (let x = 0; x < W; x += 1) for (let y = 0; y < H; y += 1) {
    const i = idx(x, y); if (floor[i]) continue;
    let v = 0;
    for (let k = 1; k <= wallRows + 1 && y + k < H; k += 1) { const j = idx(x, y + k); if (floor[j]) { v = levels[j]!; break; } }
    levels[i] = v;
  }
  return { levels, ramps, reserved: [...reserved], fixes, stairs };
}

/** 던전 종류 → 절벽·계단 양식(relief/styles.ts). 계단은 모두 버들항 bd-mpart-stairs 돌계단 화소(*-steps). */
export function dungeonReliefStyle(type: string): string {
  if (type === "forest") return "grass-steps";
  if (type === "swamp") return "peat-steps";
  if (type === "ice") return "snow-steps";
  if (type === "pyramid") return "sand-steps";
  return "cave-steps";
}
