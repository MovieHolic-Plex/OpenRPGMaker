// 설계한 높이 단 → map.relief(2026-10-30 「높이(단·계단)를 설계 항목에」). 마을 지형과 같은 relief 와 같은 버들항 돌계단(bd-mpart-stairs 화소, *-steps 양식).
// 방 높이는 모델이 정했다(rooms[].level). 함수가 하는 일: 통로 칸 높이를 가까운 방 높이로 채우고, 높이가 다른 굴이 입구에서 닿도록
// 경계마다 절벽을 깎은 계단 한 줄(폭 2~3, 남북만 — 북쪽 오르막 발치 한 줄 · 남쪽 오르막 단 차 + 2줄, 양 끝 층계참)을 놓는다. 계단 자리가 없으면 그 방을 낮춰 「고침:」으로 알린다.
import { reverseCutLength } from "@/project/relief/cutPieces";
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
    const reachedRoomCells = () => { let n = 0; for (let i = 0; i < W * H; i += 1) if (reach[i] && roomAt[i]! >= 0) n += 1; return n; };
    type Best = { lanes: number[][]; dx: number; dy: number; lo: number; hi: number; score: number; hiLanding: number[] };
    /** 닿은 칸과 4이웃으로 붙은, 높이가 다른 닿지 않은 칸 → 계단 후보 중 가장 좋은 것. */
    const findBest = (): Best | null => {
      let best: Best | null = null;
      for (let c = 0; c < W * H; c += 1) {
        if (!reach[c] || ramps[c] || reserved.has(c)) continue;
        const x = c % W, y = (c - x) / W;
        // 절벽을 깎은 계단 조각(rampArt *-steps, cutPieces.ts)은 남북으로 오르는 것뿐이다 — 동서 경계는 건너지 않는다(2026-11-04).
        // 계단 칸은 모두 낮은 단: 북쪽 오르막(높은 땅이 북쪽) = 절벽 발치 한 줄, 남쪽 오르막 = 절벽 북쪽 단 차 + 2줄(앞 단 차 줄은 높은 단 뒤에 숨는다).
        for (const dy of [-1, 1] as const) {
          if (!inb(x, y + dy)) continue;
          const n = idx(x, y + dy);
          if (reach[n] || !walk(n) || levels[n] === levels[c]) continue;
          const a = levels[c]!, b = levels[n]!, lo = Math.min(a, b), hi = Math.max(a, b);
          const loY = a < b ? y : y + dy, up = a < b ? dy : -dy; // 절벽 발치 줄(낮은 쪽)·오르막 방향
          const L = up < 0 ? 1 : reverseCutLength(hi - lo);
          // 줄(오르막 순서): 낮은 층계참 · 계단 L칸(낮은 단) · 높은 층계참. 입구에서 닿은 칸 c 는 계단 칸이거나 높은 층계참이다.
          const rows = Array.from({ length: L + 2 }, (_, k) => loY - up * L + up * k);
          const lane = (X: number): number[] | null => {
            if (!rows.every((r) => inb(X, r))) return null;
            const cells = rows.map((r) => idx(X, r));
            if (!cells.every((i) => walk(i) && !ramps[i] && !liquid[i])) return null;
            // 닿은 쪽 층계참(낮은 쪽에서 오르면 첫 칸, 높은 쪽에서 내려오면 끝 칸)은 이미 닿은 칸이다
            if (!reach[cells[a < b ? 0 : L + 1]!]) return null;
            return cells.every((i, k) => levels[i] === (k === L + 1 ? hi : lo)) ? cells : null;
          };
          // 옆면(lay.mts 규칙): 계단 양옆은 같은 절벽 면(발치 줄 낮은 단 · 그 너머 높은 단)이거나 바위·물·맵 밖 — 절벽이 꺾이는 자리면 조각 옆벽이 바닥에 선다.
          // 북쪽 오르막은 그 너머가 바위 벽이어도 된다(대각선 통로 — 벽 앞면이 절벽 면을 잇는다). 계단 줄 옆에 다른 계단이 붙으면 한 비탈로 합쳐져 폭이 넘친다.
          const flank = (X: number) => !inb(X, loY) || !walk(idx(X, loY)) || (levels[idx(X, loY)] === lo && inb(X, loY + up) && (levels[idx(X, loY + up)] === hi || (up < 0 && !floor[idx(X, loY + up)])));
          const besideFree = (X: number) => !rows.slice(1, L + 1).some((r) => inb(X, r) && ramps[idx(X, r)]);
          for (const w of [3, 2]) for (let x0 = x - w + 1; x0 <= x; x0 += 1) {
            const lanes: number[][] = [];
            for (let X = x0; X < x0 + w; X += 1) { const l = lane(X); if (!l) break; lanes.push(l); }
            if (lanes.length !== w || !flank(x0 - 1) || !flank(x0 + w) || !besideFree(x0 - 1) || !besideFree(x0 + w)) continue;
            // 점수: 폭 3 먼저, 계단 줄 옆이 벽(좁은 통로), 방 안보다 통로
            let walls = 0;
            for (const r of rows.slice(1, L + 1)) for (const X of [x0 - 1, x0 + w]) if (!inb(X, r) || !floor[idx(X, r)]) walls += 1;
            const inRoom = lanes.flat().filter((i) => roomAt[i]! >= 0).length / lanes.flat().length;
            const score = w * 2 + (walls / (2 * L)) * 4 - inRoom * 2;
            if (!best || score > best.score) best = { lanes, dx: 0, dy: up, lo, hi, score, hiLanding: [] };
          }
        }
      }
      return best;
    };
    /**
     * 계단 자리가 없을 때(동서 통로·빗금 경계): 통로 안 곧은 남북 자리(계단 줄 양옆이 바위)로 경계를 옮긴다. 통로 칸 높이는 정하기 나름이다(방 칸은 그대로).
     * 그 자리가 통로를 둘로 가르면 — 닿은 방에 붙은 쪽(A, 높이 a)과 닿지 않은 방에만 붙은 쪽(B, 높이 b) — A 의 b 칸을 a 로, B 의 a 칸을 b 로 바꾼다.
     * 닿은 방 칸이 줄지 않고 계단이 서면 받는다. 폭 3 먼저, 바뀜 칸이 적은 자리 먼저.
     */
    const recut = (): Best | null => {
      const corr = (i: number) => walk(i) && roomAt[i]! < 0 && !reserved.has(i) && !ramps[i] && !liquid[i];
      const wall = (X: number, Y: number) => !inb(X, Y) || !floor[idx(X, Y)];
      type Cand = { score: number; next: number[] };
      const cands: Cand[] = [];
      for (let y = 1; y < H - 1; y += 1) for (let x0 = 0; x0 < W; x0 += 1) for (const w of [3, 2]) for (const L of [1, 3, 4]) {
        // L = 1 북쪽 오르막(계단 줄 y, 높은 층계참 y−1) · 3·4 남쪽 오르막(계단 y..y+L−1, 높은 층계참 y+L, 단 차 L−2)
        const north = L === 1, stairRows = Array.from({ length: L }, (_, k) => y + k);
        const hiRow = north ? y - 1 : y + L, loRow = north ? y + 1 : y - 1;
        if (!inb(x0, hiRow) || !inb(x0, loRow) || x0 + w > W) continue;
        const xs = Array.from({ length: w }, (_, k) => x0 + k);
        if (!stairRows.every((r) => wall(x0 - 1, r) && wall(x0 + w, r) && xs.every((X) => corr(idx(X, r))))) continue;
        if (!xs.every((X) => [hiRow, loRow].every((r) => { const i = idx(X, r); return walk(i) && !ramps[i] && !liquid[i] && !reserved.has(i); }))) continue;
        const stairSet = new Set(stairRows.flatMap((r) => xs.map((X) => idx(X, r))));
        const side = (row: number): Set<number> => {
          const s = new Set<number>(xs.map((X) => idx(X, row))), q = [...s];
          for (let k = 0; k < q.length; k += 1) { const c = q[k]!, cx = c % W, cy = (c - cx) / W;
            if (roomAt[c]! >= 0) continue;
            for (const [, dx, dy] of DIRS) { const X = cx + dx, Y = cy + dy; if (!inb(X, Y)) continue; const n = idx(X, Y); if (!s.has(n) && !stairSet.has(n) && corr(n)) { s.add(n); q.push(n); } } }
          return s;
        };
        const hiS = side(hiRow), loS = side(loRow);
        if ([...hiS].some((i) => loS.has(i))) continue;
        const touch = (s: Set<number>) => { const out: number[] = []; for (const c of s) { if (roomAt[c]! >= 0) { out.push(c); continue; } const cx = c % W, cy = (c - cx) / W;
          for (const [, dx, dy] of DIRS) { const X = cx + dx, Y = cy + dy; if (inb(X, Y) && roomAt[idx(X, Y)]! >= 0 && walk(idx(X, Y))) out.push(idx(X, Y)); } } return out; };
        const tHi = touch(hiS), tLo = touch(loS);
        const reachedLv = (t: number[]) => [...new Set(t.filter((i) => reach[i]).map((i) => levels[i]!))];
        const rHi = reachedLv(tHi), rLo = reachedLv(tLo);
        if ((rHi.length > 0) === (rLo.length > 0) || rHi.length + rLo.length !== 1) continue;
        const aHi = rHi.length > 0, A = aHi ? hiS : loS, B = aHi ? loS : hiS, a = (aHi ? rHi : rLo)[0]!;
        const bLv = [...new Set((aHi ? tLo : tHi).filter((i) => !reach[i] && levels[i] !== a).map((i) => levels[i]!))];
        for (const b of bLv) {
          const lo = Math.min(a, b), hi = Math.max(a, b);
          if (aHi !== (a === hi) || (!north && L !== reverseCutLength(hi - lo))) continue;
          const next = levels.slice();
          let changed = 0;
          for (const i of A) if (roomAt[i]! < 0 && next[i] === b) { next[i] = a; changed += 1; }
          for (const i of B) if (roomAt[i]! < 0 && next[i] === a) { next[i] = b; changed += 1; }
          for (const i of stairSet) { if (next[i] !== lo) changed += 1; next[i] = lo; }
          if (!xs.every((X) => next[idx(X, hiRow)] === hi && next[idx(X, loRow)] === lo)) continue;
          cands.push({ score: w * 1000 - changed, next });
        }
      }
      cands.sort((p, q) => q.score - p.score);
      const keep = levels, before = reachedRoomCells();
      for (const c of cands.slice(0, 24)) {
        levels = c.next; reach.fill(0); flood([entryCell]);
        const got = reachedRoomCells() >= before ? findBest() : null;
        if (got) return got;
      }
      levels = keep; reach.fill(0); flood([entryCell]);
      return null;
    };
    /**
     * 통로가 동서로만 닿아 어디에도 남북 계단 자리가 없으면: 닿지 않은 높은 방의 남쪽(또는 북쪽) 띠를 방 폭 그대로 한 단 낮춰 턱을 만든다 —
     * 방 안에 동서로 곧게 달리는 절벽이 생기고, 그 절벽에 깎은 계단이 선다(「턱 위 제단」). 방의 절반 이상은 높은 단으로 남긴다.
     * 띠에 이어진, 아직 닿지 않은 같은 높이 통로 칸도 함께 낮춘다(닿은 쪽과 같은 단으로 잇게).
     */
    const terrace = (): Best | null => {
      const before = reachedRoomCells(), keep = levels;
      let pick: { keepHi: number; next: number[] } | null = null;
      for (let k = 0; k < rooms.length; k += 1) {
        const cells: number[] = []; for (let i = 0; i < W * H; i += 1) if (roomAt[i] === k && walk(i)) cells.push(i);
        if (!cells.length || cells.some((i) => reach[i])) continue;
        const hi = levels[cells[0]!]!; if (hi <= 0) continue;
        const ys = cells.map((i) => (i - (i % W)) / W), y0 = Math.min(...ys), y1 = Math.max(...ys);
        for (const south of [true, false]) for (let y = y0 + 2; y <= y1 - 2; y += 1) {
          const next = levels.slice(), band = cells.filter((i) => { const r = (i - (i % W)) / W; return south ? r >= y : r <= y; });
          const keepHi = 1 - band.length / cells.length; if (keepHi < 0.5 || (pick && keepHi <= pick.keepHi)) continue;
          const q = [...band]; for (const i of band) next[i] = hi - 1;
          for (let h = 0; h < q.length; h += 1) { const c = q[h]!, cx = c % W, cy = (c - cx) / W;
            for (const [, dx, dy] of DIRS) { const X = cx + dx, Y = cy + dy; if (!inb(X, Y)) continue; const n = idx(X, Y);
              if (roomAt[n]! < 0 && walk(n) && !reach[n] && !ramps[n] && next[n] === hi) { next[n] = hi - 1; q.push(n); } } }
          levels = next; reach.fill(0); flood([entryCell]);
          if (reachedRoomCells() >= before && findBest()) pick = { keepHi, next };
          levels = keep;
        }
      }
      if (!pick) { reach.fill(0); flood([entryCell]); return null; }
      levels = pick.next; reach.fill(0); flood([entryCell]);
      return findBest();
    };
    for (let guard = 0; guard < 24; guard += 1) {
      const best = findBest() ?? recut() ?? terrace();
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
