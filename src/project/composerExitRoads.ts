// 구성기 공용 — 장소의 길 그물에서 맵 가장자리까지 나가는 길 찾기.
// 구성기는 제 길을 한 변(대개 남쪽)으로만 낸다. 다른 맵으로 나가는 출구가 그 밖의 변에 서면 길 없는 맨땅에 서게 되므로,
// 짓는 쪽이 «이 변으로 나간다»(exits)를 주면 구성기가 그 변까지 길을 낸다. 칠하기는 구성기마다 다르므로 여기서는 칸만 고른다.
export type ExitSide = "north" | "south" | "east" | "west";

export interface ExitRoadBoard {
  readonly W: number;
  readonly H: number;
  /** 이미 길(포석·광장 포함)인 칸. */
  isRoad(x: number, y: number): boolean;
  /** 길로 바꿔도 되는 빈 땅 — 건물·소품·물·벽이 아니고 다른 쓰임이 없는 칸. */
  canPave(x: number, y: number): boolean;
  /** 그 칸을 지나는 덧값(칸 수) — 걷어야 하는 것이 있는 칸을 덜 지나게. */
  penalty?(x: number, y: number): number;
}

/** 구성기가 트인 땅에 흩어 둔 소품 하나의 발자국 — 나가는 길이 지나면 걷는다. */
export interface WildProp { readonly x: number; readonly y: number; readonly w: number; readonly h: number }
/** 흩어 둔 소품 하나를 걷는 값(칸 수). */
const WILD_COST = 2;

/**
 * exitRoadCells 와 같되 흩어 둔 소품(덤불·바위·나무) 칸도 지난다. wild[i] 는 구성기 props[i] 의 발자국(걷으면 안 되는 것은 undefined).
 * 돌려주는 drop 은 길과 길섶(둘레 한 칸)에 걸쳐 걷어야 하는 소품 번호(큰 번호부터) — 구성기가 그 소품을 지우고 cells 를 길로 칠한다.
 */
export function exitRoadThroughWild(board: ExitRoadBoard, side: ExitSide, wild: readonly (WildProp | undefined)[], width = 2): { cells: Cell[]; drop: number[] } | undefined {
  const at = new Map<number, number>();
  wild.forEach((p, i) => { if (p) for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (x >= 0 && y >= 0 && x < board.W && y < board.H) at.set(y * board.W + x, i); });
  const hit = (x: number, y: number): number | undefined => (x >= 0 && y >= 0 && x < board.W && y < board.H ? at.get(y * board.W + x) : undefined);
  const cells = exitRoadCells({ W: board.W, H: board.H, isRoad: (x, y) => board.isRoad(x, y), canPave: (x, y) => board.canPave(x, y) || hit(x, y) !== undefined, penalty: (x, y) => (hit(x, y) !== undefined ? WILD_COST : 0) }, side, width);
  if (!cells) return undefined;
  const drop = new Set<number>();
  for (const c of cells) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const p = hit(c.x + i, c.y + j); if (p !== undefined) drop.add(p); }
  return { cells, drop: [...drop].sort((a, b) => b - a) };
}

/** 구성 도구의 `exits` 인자 스키마(구성 도구들이 같이 쓴다). */
export const EXIT_SIDES_SCHEMA = {
  type: "array", items: { type: "string", enum: ["north", "south", "east", "west"] }, maxItems: 4,
  description: "다른 맵으로 나가는 변 — 장소의 길에서 그 변의 가장자리까지 길을 낸다(이미 길이 닿은 변은 그대로). 맵 사이 출구는 그 길 끝에 둔다",
} as const;

/** 도구의 `exits` 인자에서 변 목록을 읽는다 — 모르는 값은 버린다. */
export function exitSidesArg(value: unknown): ExitSide[] {
  return Array.isArray(value) ? value.filter((v): v is ExitSide => v === "north" || v === "south" || v === "east" || v === "west") : [];
}

type Cell = { readonly x: number; readonly y: number };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const INWARD: Readonly<Record<ExitSide, readonly [number, number]>> = { north: [0, 1], south: [0, -1], west: [1, 0], east: [-1, 0] };
/** 꺾임 하나의 값(칸 수) — 곧게 나가는 길을 먼저 고른다. */
const TURN_COST = 3;

/** 그 변의 가장자리 줄에 길이 닿아 있는가(가장자리 칸과 그 안쪽 칸이 길 — 모서리 칸은 뺀다). */
export function roadReachesEdge(board: ExitRoadBoard, side: ExitSide): boolean {
  const [ix, iy] = INWARD[side];
  const horizontal = ix === 0, line = horizontal ? (iy > 0 ? 0 : board.H - 1) : (ix > 0 ? 0 : board.W - 1);
  for (let k = 1; k < (horizontal ? board.W : board.H) - 1; k++) {
    const x = horizontal ? k : line, y = horizontal ? line : k;
    if (board.isRoad(x, y) && board.isRoad(x + ix, y + iy)) return true;
  }
  return false;
}

/** 새 길이 다른 변의 가장자리를 따라 붙어 가지 않게 두는 여백(칸) — 못 내면 줄여 다시 찾는다. */
const EDGE_MARGINS = [3, 1, 0] as const;

/**
 * 길 그물에서 그 변까지 폭 width 의 길이 지날 «새로 길이 될 칸». 이미 닿아 있으면 빈 배열, 낼 자리가 없으면 undefined.
 * 길은 width×width 발자국이 지나는 띠다 — 발자국의 칸이 모두 길이거나 길로 바꿀 수 있는 칸이어야 지난다(건물·소품을 돌아간다).
 */
export function exitRoadCells(board: ExitRoadBoard, side: ExitSide, width = 2): Cell[] | undefined {
  if (roadReachesEdge(board, side)) return [];
  for (const margin of EDGE_MARGINS) {
    const cells = routeToEdge(board, side, width, margin);
    if (cells) return cells;
  }
  return undefined;
}

function routeToEdge(board: ExitRoadBoard, side: ExitSide, width: number, margin: number): Cell[] | undefined {
  const { W, H } = board;
  const spanW = W - width + 1, spanH = H - width + 1;
  if (spanW <= 0 || spanH <= 0) return undefined;
  // 나가는 변이 아닌 가장자리에서 margin 칸 안쪽으로만 지난다.
  const inside = (x: number, y: number): boolean =>
    (side === "west" || x >= margin) && (side === "east" || x + width <= W - margin) && (side === "north" || y >= margin) && (side === "south" || y + width <= H - margin);
  // 발자국(왼쪽 위 칸 기준): 0 = 못 지남, 1 = 지날 수 있음, 2 = 이미 길과 겹침(출발점).
  const kind = new Uint8Array(spanW * spanH);
  for (let y = 0; y < spanH; y++) for (let x = 0; x < spanW; x++) {
    let ok = inside(x, y), road = false;
    for (let j = 0; j < width && ok; j++) for (let i = 0; i < width; i++) {
      if (board.isRoad(x + i, y + j)) road = true;
      else if (!board.canPave(x + i, y + j)) { ok = false; break; }
    }
    kind[y * spanW + x] = ok ? (road ? 2 : 1) : 0;
  }
  const goal = (x: number, y: number): boolean => {
    if (side === "west") return x === 0 && y >= 1 && y + width <= H - 1;
    if (side === "east") return x === spanW - 1 && y >= 1 && y + width <= H - 1;
    if (side === "north") return y === 0 && x >= 1 && x + width <= W - 1;
    return y === spanH - 1 && x >= 1 && x + width <= W - 1;
  };
  // 상태 = 발자국 × 들어온 방향(4) + 출발(4).
  const size = spanW * spanH * 5;
  const dist = new Float64Array(size).fill(Infinity), prev = new Int32Array(size).fill(-1);
  const open: number[] = [];
  for (let i = 0; i < kind.length; i++) if (kind[i] === 2) { dist[i * 5 + 4] = 0; open.push(i * 5 + 4); }
  while (open.length) {
    let best = 0;
    for (let k = 1; k < open.length; k++) if (dist[open[k]!]! < dist[open[best]!]!) best = k;
    const state = open.splice(best, 1)[0]!;
    const at = Math.floor(state / 5), dir = state % 5, x = at % spanW, y = Math.floor(at / spanW);
    if (goal(x, y)) {
      const cells = new Map<number, Cell>();
      for (let s = state; s >= 0; s = prev[s]!) {
        const a = Math.floor(s / 5), ax = a % spanW, ay = Math.floor(a / spanW);
        for (let j = 0; j < width; j++) for (let i = 0; i < width; i++) if (!board.isRoad(ax + i, ay + j)) cells.set((ay + j) * W + ax + i, { x: ax + i, y: ay + j });
      }
      return [...cells.values()];
    }
    DIRS.forEach(([dx, dy], d) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= spanW || ny >= spanH || kind[ny * spanW + nx] === 0) return;
      const next = (ny * spanW + nx) * 5 + d;
      const cost = dist[state]! + 1 + (dir !== 4 && dir !== d ? TURN_COST : 0) + (board.penalty?.(nx, ny) ?? 0);
      if (cost < dist[next]!) { dist[next] = cost; prev[next] = state; open.push(next); }
    });
  }
  return undefined;
}
