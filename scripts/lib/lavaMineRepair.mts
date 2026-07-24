/**
 * 용암동굴(map_sc_dungeon_lava) 수리 파이프라인 — 공용 lib.
 * gen-lava-analysis-report.mts(분석)와 apply-lava-mine-fix.mts(적용)가 공유한다.
 * 규칙 정본:
 *  - 벽: {밴드 시공 → 앵커 환원 → 천장 포기} 전역 고정점 → 모든 벽면이 동등한 세로 2칸(103+133)
 *  - 레일: 개구 정본 114{S} 144{N,S} 174{N} · 115{E} 116{E,W} 117{W} · 코너 54/55/84/85,
 *    런(run) 레벨 의도 복원 + T분기 목록화
 */
import type { GameMap } from "../../src/project/types.ts";

export const LAVA = new Set([243, 244, 245, 273, 274, 275, 303, 304, 305, 333, 334, 335]);
export const FLOOR = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332]);
export const CEIL = new Set([249, 250, 251, 279, 280, 281, 309, 310, 311, 339, 340, 341]);
export const BAND = new Set([102, 103, 104]);
export const BAND_BODY = new Set([132, 133, 134]);
export const ROCKWALL = new Set([255, 256, 257]);
export const TORCH = new Set([208, 263, 264, 293]);
export const RAIL = new Set([54, 55, 56, 57, 58, 59, 84, 85, 86, 87, 88, 89, 114, 115, 116, 117, 144, 174]);
export const FLOOR_FILL = 301;
export const CEIL_FILL = 310;
export const isFloorTile = (t: number): boolean => FLOOR.has(t) || t === 141 || t === 142 || t === 143;

export type LavaRepairStats = {
  abandonedCeiling: number;
  directBorderLeft: number;
  badFaceHeight: number;
  railGapsFilled: number;
  railIsolatedRemoved: number;
  railJunctionPending: [number, number][];
  railDangling: [number, number][];
  railOneWay: [number, number][];
};

export type LavaRepairResult = { m: GameMap; unanchored: number; stats: LavaRepairStats };

export function repairLavaMineMap(map: GameMap, anchor: boolean): LavaRepairResult {
  const W = map.width, H = map.height;
  const lower = map.lowerTiles, upper = map.upperTiles;
  const at = (x: number, y: number) => y * W + x;
  const isFloor = isFloorTile;
  const fl = [...lower], fu = [...upper];
  const stats: LavaRepairStats = {
    abandonedCeiling: 0, directBorderLeft: 0, badFaceHeight: 0, railGapsFilled: 0, railIsolatedRemoved: 0, railJunctionPending: [], railDangling: [], railOneWay: [],
  };
  // (a) 콘페티 회수
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const t = fl[at(x, y)]!;
    if (!BAND.has(t) && !BAND_BODY.has(t)) continue;
    let ceilN = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      if (CEIL.has(fl[at(nx, ny)]!)) ceilN += 1;
    }
    fl[at(x, y)] = ceilN > 0 ? CEIL_FILL : FLOOR_FILL;
  }
  // (b) 스펙클 흡수 2패스
  for (let pass = 0; pass < 2; pass += 1) {
    const snap = [...fl];
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      const t = snap[at(x, y)]!;
      let fn = 0, cn = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = snap[at(x + dx, y + dy)]!;
        if (isFloor(n)) fn += 1;
        if (CEIL.has(n)) cn += 1;
      }
      if ((CEIL.has(t) || ROCKWALL.has(t)) && fn >= 3) fl[at(x, y)] = FLOOR_FILL;
      else if (isFloor(t) && cn === 4) fl[at(x, y)] = CEIL_FILL;
    }
  }
  // (c) 벽면 합성 — 전역 고정점: {밴드 시공 → 앵커 환원 → 천장 포기}를 변화가 없을 때까지 반복.
  //     포기로 새로 노출된 경계에도 벽이 시공되므로, 수렴 시 모든 바닥↔어둠 경계가
  //     '동등한 세로 2칸 벽(밴드+밴드바디)+그 위 천장' 이 된다.
  const wallPass = (): number => {
    let changed = 0;
    // 밴드 시공: 천장 남단에 밴드바디, 그 위 천장에 밴드
    for (let y = 0; y < H - 1; y += 1) for (let x = 0; x < W; x += 1) {
      if (CEIL.has(fl[at(x, y)]!) && isFloor(fl[at(x, y + 1)]!)) {
        fl[at(x, y)] = 133; changed += 1;
        if (y > 0 && CEIL.has(fl[at(x, y - 1)]!)) { fl[at(x, y - 1)] = 103; changed += 1; }
      }
    }
    if (anchor) {
      // 앵커 환원: 스택 불완전(밴드바디 위 ≠ 밴드, 밴드 위 ≠ 천장) → 천장으로
      for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
        const t = fl[at(x, y)]!;
        if (BAND_BODY.has(t) && !(y > 0 && BAND.has(fl[at(x, y - 1)]!))) { fl[at(x, y)] = CEIL_FILL; changed += 1; continue; }
        if (BAND.has(t) && !(y > 0 && (CEIL.has(fl[at(x, y - 1)]!) || BAND.has(fl[at(x, y - 1)]!)))) { fl[at(x, y)] = CEIL_FILL; changed += 1; }
      }
      // 천장 포기: 그래도 아래가 바닥인 천장은 바닥으로 흡수 (외곽 2칸 프레임 유지)
      for (let y = 2; y < H - 2; y += 1) for (let x = 2; x < W - 2; x += 1) {
        if (CEIL.has(fl[at(x, y)]!) && isFloor(fl[at(x, y + 1)]!)) { fl[at(x, y)] = FLOOR_FILL; changed += 1; stats.abandonedCeiling += 1; }
      }
    }
    return changed;
  };
  for (let iter = 0; iter < 64 && wallPass() > 0; iter += 1);
  // 사후조건 검증: ① 무지지 직접 경계 0 ② 미고정 벽면 0 ③ 모든 벽면 높이 정확히 2
  let unanchored = 0, directBorderLeft = 0, badFaceHeight = 0;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const t = fl[at(x, y)]!;
    if (BAND_BODY.has(t)) {
      if (!(y > 0 && BAND.has(fl[at(x, y - 1)]!))) unanchored += 1;
      // 벽면 높이: 밴드바디 아래는 바닥, 위는 밴드 1장 뿐이어야 '세로 2칸'
      if (y > 1 && BAND.has(fl[at(x, y - 2)]!)) badFaceHeight += 1; // 3행 이상 벽면
      if (y < H - 1 && !isFloor(fl[at(x, y + 1)]!) && !LAVA.has(fl[at(x, y + 1)]!)) badFaceHeight += 1; // 아래가 바닥 아님
    }
    if (BAND.has(t) && !(y > 0 && (CEIL.has(fl[at(x, y - 1)]!) || BAND.has(fl[at(x, y - 1)]!)))) unanchored += 1;
    if (y < H - 1 && CEIL.has(t) && isFloor(fl[at(x, y + 1)]!) && x >= 2 && x < W - 2) directBorderLeft += 1;
  }
  stats.directBorderLeft = directBorderLeft;
  stats.badFaceHeight = badFaceHeight;
  // (d) 용암 위 레일/횃불 철거
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (LAVA.has(fl[at(x, y)]!) && (RAIL.has(fu[at(x, y)]!) || TORCH.has(fu[at(x, y)]!))) fu[at(x, y)] = -1;
  }
  // (e) 레일 배선 — 런(run) 레벨 의도 복원.
  //     개구 정본(칩셋 픽셀 측정 확정): 114{S} 144{N,S} 174{N} · 115{E} 116{E,W} 117{W}
  //     코너 54{S,E} 55{S,W} 84{N,E} 85{N,W}. 원본은 좌캡 115를 중간 타일로 오용했으므로
  //     타일 변형이 아니라 '위치(런)'만으로 연결 의도를 복원하고, 개구 정본으로 재타일한다.
  const H_TILES = new Set([115, 116, 117]);
  const V_TILES = new Set([114, 144, 174]);
  const CORNER_FOR: Record<string, number> = { ES: 54, SW: 55, EN: 84, NW: 85 };
  const opensFinal: Record<number, readonly string[]> = {
    114: ["S"], 144: ["N", "S"], 174: ["N"], 115: ["E"], 116: ["E", "W"], 117: ["W"],
    54: ["S", "E"], 55: ["S", "W"], 84: ["N", "E"], 85: ["N", "W"],
  };
  const railAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && RAIL.has(fu[at(x, y)]!);
  const hAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && H_TILES.has(fu[at(x, y)]!);
  const vAt = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && V_TILES.has(fu[at(x, y)]!);
  // ① 동일선 1칸 갭 브리지: 빈 바닥 셀의 좌/우가 가로 런이면 연결, 상/하가 세로 런이면 연결
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (fu[at(x, y)]! !== -1 || !isFloor(fl[at(x, y)]!)) continue;
    if (hAt(x - 1, y) && hAt(x + 1, y)) { fu[at(x, y)] = 116; stats.railGapsFilled += 1; }
    else if (vAt(x, y - 1) && vAt(x, y + 1)) { fu[at(x, y)] = 144; stats.railGapsFilled += 1; }
  }
  // ② 런 스캔 (가로/세로 직선 최대 연속)
  type Run = { axis: "h" | "v"; cells: [number, number][] };
  const runs: Run[] = [];
  const runOf = new Map<string, { run: Run; idx: number }>();
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!hAt(x, y) || runOf.has(x + "," + y)) continue;
    const cells: [number, number][] = [];
    let i = x;
    while (hAt(i, y)) { cells.push([i, y]); i += 1; }
    const run: Run = { axis: "h", cells };
    runs.push(run);
    cells.forEach((c, idx) => runOf.set(c[0] + "," + c[1], { run, idx }));
    x = i - 1;
  }
  for (let x = 0; x < W; x += 1) for (let y = 0; y < H; y += 1) {
    if (!vAt(x, y) || runOf.has(x + "," + y)) continue;
    const cells: [number, number][] = [];
    let i = y;
    while (vAt(x, i)) { cells.push([x, i]); i += 1; }
    const run: Run = { axis: "v", cells };
    runs.push(run);
    cells.forEach((c, idx) => runOf.set(c[0] + "," + c[1], { run, idx }));
    y = i - 1;
  }
  // ③④ 개구방향(openDirs) 구성: 런 구조로 각 셀이 열어야 할 방향을 모으고, 정본 개구와
  //    정확히 일치하는 타일을 배정. 방향이 3개 이상이면 T분기(방향 잠정)로 목록화.
  const openDirs = new Map<string, Set<string>>();
  const addDir = (x: number, y: number, d: string): void => {
    const k = x + "," + y;
    if (!openDirs.has(k)) openDirs.set(k, new Set());
    openDirs.get(k)!.add(d);
  };
  const opp = (d: string): string => (d === "E" ? "W" : d === "W" ? "E" : d === "S" ? "N" : "S");
  for (const run of runs) {
    run.cells.forEach(([cx, cy], idx) => {
      // 축 방향 기본 개구 (런 안쪽)
      if (run.axis === "h") {
        if (idx < run.cells.length - 1) addDir(cx, cy, "E");
        if (idx > 0) addDir(cx, cy, "W");
      } else {
        if (idx < run.cells.length - 1) addDir(cx, cy, "S");
        if (idx > 0) addDir(cx, cy, "N");
      }
    });
  }
  // 굴절: 가로 런 끝 ↔ 세로 런 끝 / 가로 런 끝 ↔ 가로 런 끝(수직 인접, S자)
  for (const run of runs) {
    if (run.axis !== "h") continue;
    const ends: [number, number][] = [run.cells[0]!, run.cells[run.cells.length - 1]!];
    for (const [ex, ey] of ends) {
      const dirs: [number, number, string][] = [[0, -1, "N"], [0, 1, "S"], [1, 0, "E"], [-1, 0, "W"]];
      for (const [dx, dy, dir] of dirs) {
        const nx = ex + dx, ny = ey + dy;
        const nb = runOf.get(nx + "," + ny);
        if (!nb || nb.run === run) continue;
        const isEnd = nb.idx === 0 || nb.idx === nb.run.cells.length - 1;
        if (!isEnd) {
          // 끝 ↔ 런 중앙: T분기 후보 — 목록화만 하고 개구는 추가하지 않음
          if (!stats.railJunctionPending.some(([jx, jy]) => jx === nx && jy === ny)) stats.railJunctionPending.push([nx, ny]);
          continue;
        }
        if (nb.run.axis === "v" || dir === "N" || dir === "S") {
          addDir(ex, ey, dir);
          addDir(nx, ny, opp(dir));
        }
      }
    }
  }
  const TILE_FOR: Record<string, number> = { EW: 116, E: 115, W: 117, NS: 144, N: 174, S: 114, ES: 54, SW: 55, EN: 84, NW: 85 };
  for (const run of runs) {
    run.cells.forEach(([cx, cy]) => {
      const dirs = [...(openDirs.get(cx + "," + cy) ?? new Set<string>())].sort();
      const key = dirs.join("");
      const t = TILE_FOR[key];
      if (t !== undefined) { fu[at(cx, cy)] = t; return; }
      // T분기 이상: 주축 직선으로 임시 유지 + 목록화
      if (!stats.railJunctionPending.some(([jx, jy]) => jx === cx && jy === cy)) stats.railJunctionPending.push([cx, cy]);
      fu[at(cx, cy)] = dirs.includes("E") || dirs.includes("W") ? 116 : 144;
    });
  }
  // ⑤ 고립 제거: 열 방향이 하나도 없는 런(1칸 고립)은 삭제
  for (const run of runs) {
    const connected = run.cells.some(([cx, cy]) => (openDirs.get(cx + "," + cy)?.size ?? 0) > 0);
    if (connected) continue;
    for (const [cx, cy] of run.cells) { fu[at(cx, cy)] = -1; stats.railIsolatedRemoved += 1; }
  }
  // ⑥ 엄밀 사후조건(개구 정본): 일방 개구 = 단절
  const openAt = (x: number, y: number, dir: string) => railAt(x, y) && (opensFinal[fu[at(x, y)]!] ?? []).includes(dir);
  const dangling: [number, number][] = [];
  const oneWay: [number, number][] = [];
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const t = fu[at(x, y)]!;
    const o = opensFinal[t];
    if (!o) continue;
    for (const dir of o) {
      const [dx, dy] = dir === "E" ? [1, 0] : dir === "W" ? [-1, 0] : dir === "S" ? [0, 1] : [0, -1];
      const back = dir === "E" ? "W" : dir === "W" ? "E" : dir === "S" ? "N" : "S";
      if (!railAt(x + dx, y + dy)) dangling.push([x, y]);
      else if (!openAt(x + dx, y + dy, back)) oneWay.push([x, y]);
    }
  }
  stats.railDangling = dangling;
  stats.railOneWay = oneWay;
  return { m: { ...map, lowerTiles: fl, upperTiles: fu } as GameMap, unanchored, stats };
}
