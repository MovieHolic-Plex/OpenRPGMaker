// 방 자리를 직접 준 배치(2026-11-04 그림 도안): rooms[]{x,y,w,h} 와 links 를 받으면 그 자리에 방을 놓고 통로를 잇는다.
// 함수가 자리를 고르지 않는다 — 겹치는 방만 가장 가까운 빈자리로 밀고(「고침:」 줄), 곧게 닿지 못하는 방끼리는 ㄴ자 통로로 잇는다.
import { WALL_ROWS } from "./grid";
import { DungeonComposeError } from "./errors";
import type { DungeonDir, DungeonLayout, DungeonRoomInput, DungeonRoomKind, DungeonSpec, PlacedCorridor, PlacedRoom, Rect } from "./types";

const MARGIN = 2;
const inter = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const footprint = (r: Rect): Rect => ({ x: r.x - 1, y: r.y - WALL_ROWS - 1, w: r.w + 2, h: r.h + WALL_ROWS + 1 });
const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.round(v)));

/** 방 하나라도 자리(x,y)가 있으면 자리 배치로 간다. */
export function hasRoomPositions(inputs: readonly DungeonRoomInput[]): boolean {
  return inputs.some((r) => Number.isInteger(r.x) && Number.isInteger(r.y));
}

/** 통로 목록(링크) 읽기: [a,b] · {from,to} · "a-b". 알 수 없는 모양은 버린다. */
export function readRoomLinks(raw: unknown): [string, string][] {
  if (!Array.isArray(raw)) return [];
  const out: [string, string][] = [];
  for (const item of raw) {
    if (Array.isArray(item) && item.length >= 2) out.push([String(item[0]), String(item[1])]);
    else if (item && typeof item === "object" && "from" in item && "to" in item) out.push([String((item as { from: unknown }).from), String((item as { to: unknown }).to)]);
    else if (typeof item === "string" && item.includes("-")) { const [a, b] = item.split("-"); if (a && b) out.push([a.trim(), b.trim()]); }
  }
  return out;
}

/** 통로가 그림 도안에서 읽은 칸을 실어 왔으면({from,to,rects:[{x,y,w,h}]}) 그 칸을 그대로 깔다 — 곧은·휘는 통로, 폭 1~2, 고리(2026-11-05 imageplan-follow). */
export function readRoomLinkRects(raw: unknown): Map<string, Rect[]> {
  const out = new Map<string, Rect[]>();
  if (!Array.isArray(raw)) return out;
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item) || !("rects" in item)) continue;
    const o = item as { from?: unknown; to?: unknown; rects?: unknown };
    if (!Array.isArray(o.rects)) continue;
    const rects = o.rects.flatMap((r) => {
      const q = r as Record<string, unknown>;
      return [q.x, q.y, q.w, q.h].every((v) => Number.isInteger(v)) && (q.w as number) > 0 && (q.h as number) > 0 ? [{ x: q.x as number, y: q.y as number, w: q.w as number, h: q.h as number }] : [];
    });
    const a = String(o.from), b = String(o.to);
    if (rects.length) out.set(a < b ? `${a}|${b}` : `${b}|${a}`, rects);
  }
  return out;
}

/** 조각이 이웃(방·다른 조각)과 맞닿은 면으로 방향을 정한다 — 위·아래로 닿으면 세로(N/S), 옆으로 닿으면 가로(E/W). 짧은 세로 토막이 모양만 보고 가로로 읽혔다(AMEND3 2). */
function touchDir(rect: Rect, neighbours: readonly Rect[]): DungeonDir | null {
  // 이웃(방·조각)과 닿은 자리들의 가운데가 퍼진 축 = 통로가 흐르는 축(AMEND5 2). 닿은 곳이 하나뿐이면 그 점과 조각 가운데 사이로 본다.
  // Z·U 가운데 다리(위·아래 면에 닿지만 양 끝에서)는 가로로, 옆방 사이 짧은 문은 가로로, 세로 다리는 세로로 읽힌다. 비기면 모양으로.
  const pts: { x: number; y: number }[] = [];
  for (const n of neighbours) {
    const x0 = Math.max(rect.x, n.x), x1 = Math.min(rect.x + rect.w, n.x + n.w), y0 = Math.max(rect.y, n.y), y1 = Math.min(rect.y + rect.h, n.y + n.h);
    if (x1 < x0 || y1 < y0 || (x1 === x0 && y1 === y0)) continue;
    pts.push({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  }
  if (pts.length === 1) pts.push({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
  const dx = pts.length ? Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)) : 0;
  const dy = pts.length ? Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)) : 0;
  if (dx === dy) return rect.w === rect.h ? null : rect.w > rect.h ? "E" : "S";
  return dy > dx ? "S" : "E";
}

/** 사각형들이 두 방을 4방향으로 끊김없이 잇으면 그 길에 닿은 사각형만(돌아간 가지는 빼고) 돌려주고, 못 잇으면 null. */
function drawnLinks(rects: readonly Rect[], a: Rect, b: Rect): Rect[] | null {
  const near = (p: Rect, q: Rect) => p.x <= q.x + q.w && q.x <= p.x + p.w && p.y <= q.y + q.h && q.y <= p.y + p.h && !((p.x + p.w === q.x || q.x + q.w === p.x) && (p.y + p.h === q.y || q.y + q.h === p.y));
  const seen = new Set<number>();
  const queue = rects.map((r, i) => (near(r, a) ? i : -1)).filter((i) => i >= 0);
  for (const i of queue) seen.add(i);
  const parent = new Map<number, number>();
  for (let k = 0; k < queue.length; k += 1) {
    const i = queue[k]!, r = rects[i]!;
    if (near(r, b)) { const path: Rect[] = []; for (let j: number | undefined = i; j !== undefined; j = parent.get(j)) path.push(rects[j]!); return path; }
    rects.forEach((q, j) => { if (!seen.has(j) && near(r, q)) { seen.add(j); parent.set(j, i); queue.push(j); } });
  }
  return null;
}

export function layoutPositioned(spec: DungeonSpec, inputs: readonly DungeonRoomInput[], defaultSize: Record<DungeonRoomKind, [number, number]>): DungeonLayout {
  const notes: string[] = [];
  const placed: PlacedRoom[] = [];
  const ids = new Set<string>();
  const freeSpot = (wantX: number, wantY: number, w: number, h: number): { x: number; y: number } => {
    const clear = (x: number, y: number) => placed.every((o) => !inter(footprint({ x, y, w, h }), o) && !inter({ x, y, w, h }, footprint(o)));
    if (clear(wantX, wantY)) return { x: wantX, y: wantY };
    for (let r = 1; r <= 80; r += 1) {
      let best: { x: number; y: number; d: number } | null = null;
      for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !clear(wantX + dx, wantY + dy)) continue;
        const d = dx * dx + dy * dy;
        if (!best || d < best.d) best = { x: wantX + dx, y: wantY + dy, d };
      }
      if (best) return { x: best.x, y: best.y };
    }
    throw new DungeonComposeError("방을 놓을 빈자리가 없다 — 방 수나 크기를 줄여라.", "layout-failed");
  };
  inputs.forEach((input, index) => {
    const kind: DungeonRoomKind = input.kind ?? (index === 0 ? "entrance" : "hall");
    const [dw, dh] = defaultSize[kind];
    const w = clampInt(input.w ?? dw, 6, 40), h = clampInt(input.h ?? dh, 5, 22);
    let id = (input.id ?? `${kind}${index + 1}`).trim() || `${kind}${index + 1}`;
    while (ids.has(id)) id = `${id}_${index + 1}`;
    ids.add(id);
    const given = Number.isInteger(input.x) && Number.isInteger(input.y);
    const prev = placed[placed.length - 1];
    const wantX = given ? input.x! : prev ? prev.x + prev.w + 4 : 0;
    const wantY = given ? input.y! : prev ? prev.y : 0;
    const spot = freeSpot(wantX, wantY, w, h);
    if (given && (spot.x !== wantX || spot.y !== wantY)) notes.push(`고침: 방 ${id} 가 다른 방과 겹쳐 (${wantX},${wantY}) → (${spot.x},${spot.y}) 로 옮겼다.`);
    if (!given && index > 0) notes.push(`고침: 방 ${id} 에 자리가 없어 앞 방 곁 (${spot.x},${spot.y}) 에 놓았다.`);
    placed.push({ id, kind, x: spot.x, y: spot.y, w, h, from: null, dir: null, depth: 0, ...(input.shape ? { shape: input.shape } : {}) });
  });

  const byRef = (ref: string): PlacedRoom | undefined => placed.find((r) => r.id === ref) ?? placed.find((r) => r.kind === ref);
  const edgeKey = (a: PlacedRoom, b: PlacedRoom) => (a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`);
  const edges = new Map<string, [PlacedRoom, PlacedRoom]>();
  const addEdge = (a: PlacedRoom | undefined, b: PlacedRoom | undefined) => { if (a && b && a !== b && !edges.has(edgeKey(a, b))) edges.set(edgeKey(a, b), [a, b]); };
  const links = readRoomLinks(spec.links);
  if (links.length) {
    for (const [ra, rb] of links) {
      const a = byRef(ra), b = byRef(rb);
      if (!a || !b) notes.push(`고침: 통로 ${ra}-${rb} 의 방 이름을 찾지 못해 건너뛰었다(방: ${placed.map((r) => r.id).join(", ")}).`);
      addEdge(a, b);
    }
  } else {
    inputs.forEach((input, index) => { if (index > 0) addEdge(input.from ? byRef(input.from) ?? placed[index - 1] : placed[index - 1], placed[index]); });
  }

  const adj = new Map<string, PlacedRoom[]>(placed.map((r) => [r.id, []]));
  const rewire = () => { for (const list of adj.values()) list.length = 0; for (const [a, b] of edges.values()) { adj.get(a.id)!.push(b); adj.get(b.id)!.push(a); } };
  const centre = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const dist = (a: Rect, b: Rect) => Math.hypot(centre(a).x - centre(b).x, centre(a).y - centre(b).y);
  rewire();
  const reached = new Set<string>([placed[0]!.id]);
  const parent = new Map<string, PlacedRoom>();
  const treeEdges = new Set<string>();
  const flood = () => {
    const queue = [...reached].map((id) => placed.find((r) => r.id === id)!);
    for (let i = 0; i < queue.length; i += 1) {
      const cur = queue[i]!;
      for (const next of adj.get(cur.id)!) {
        if (reached.has(next.id)) continue;
        reached.add(next.id); parent.set(next.id, cur); treeEdges.add(edgeKey(cur, next)); next.depth = cur.depth + 1; queue.push(next);
      }
    }
  };
  flood();
  while (reached.size < placed.length) {
    let best: { a: PlacedRoom; b: PlacedRoom; d: number } | null = null;
    for (const a of placed) if (reached.has(a.id)) for (const b of placed) if (!reached.has(b.id)) { const d = dist(a, b); if (!best || d < best.d) best = { a, b, d }; }
    notes.push(`고침: 방 ${best!.b.id} 가 입구에서 이어지지 않아 가장 가까운 ${best!.a.id} 와 통로를 더했다.`);
    addEdge(best!.a, best!.b); rewire(); flood();
  }

  const crossings = (rects: readonly Rect[], skip: readonly PlacedRoom[]) => placed.filter((o) => !skip.includes(o) && rects.some((r) => inter(r, footprint(o)))).length;
  const pieceDir = (horizontal: boolean, forward: boolean): DungeonDir => (horizontal ? (forward ? "E" : "W") : forward ? "S" : "N");
  const connect = (a: PlacedRoom, b: PlacedRoom, loop: boolean): PlacedCorridor[] => {
    const mk = (dir: DungeonDir, rect: Rect): PlacedCorridor => ({ a: a.id, b: b.id, dir, rect, ...(loop ? { loop: true } : {}) });
    const [upper, lower] = a.y <= b.y ? [a, b] : [b, a];
    const gapV = lower.y - (upper.y + upper.h);
    const vlo = Math.max(a.x, b.x) + 2, vhi = Math.min(a.x + a.w, b.x + b.w) - 2;
    if (gapV >= 1 && vhi - vlo >= 2) {
      const cw = Math.min(3, vhi - vlo);
      return [mk(upper === a ? "S" : "N", { x: vlo + Math.floor((vhi - vlo - cw) / 2), y: upper.y + upper.h, w: cw, h: gapV })];
    }
    const [left, right] = a.x <= b.x ? [a, b] : [b, a];
    const gapH = right.x - (left.x + left.w);
    const hlo = Math.max(a.y, b.y) + 1, hhi = Math.min(a.y + a.h, b.y + b.h) - 1;
    if (gapH >= 1 && hhi - hlo >= 2) {
      const ch = Math.min(3, hhi - hlo);
      return [mk(left === a ? "E" : "W", { x: left.x + left.w, y: hlo + Math.floor((hhi - hlo - ch) / 2), w: gapH, h: ch })];
    }
    const ax = a.x + Math.floor(a.w / 2), bx = b.x + Math.floor(b.w / 2);
    const rowA = a.y + Math.floor((a.h - 3) / 2), rowB = b.y + Math.floor((b.h - 3) / 2);
    const horizontalFirst: [Rect, Rect] = [
      { x: Math.min(ax, bx - 1), y: rowA, w: Math.max(ax, bx + 1) - Math.min(ax, bx - 1) + 1, h: 3 },
      { x: bx - 1, y: Math.min(rowA, rowB + 1), w: 3, h: Math.max(rowA + 2, rowB + 1) - Math.min(rowA, rowB + 1) + 1 },
    ];
    const verticalFirst: [Rect, Rect] = [
      { x: ax - 1, y: Math.min(rowA + 1, rowB), w: 3, h: Math.max(rowA + 1, rowB + 2) - Math.min(rowA + 1, rowB) + 1 },
      { x: Math.min(ax - 1, bx), y: rowB, w: Math.max(ax + 1, bx) - Math.min(ax - 1, bx) + 1, h: 3 },
    ];
    const [first, second] = crossings(horizontalFirst, [a, b]) <= crossings(verticalFirst, [a, b]) ? horizontalFirst : verticalFirst;
    const firstHorizontal = first.w > first.h;
    const goesForward = firstHorizontal ? bx >= ax : b.y >= a.y;
    return [mk(pieceDir(firstHorizontal, goesForward), first), mk(pieceDir(!firstHorizontal, firstHorizontal ? b.y >= a.y : bx >= ax), second)];
  };

  const drawn = readRoomLinkRects(spec.links);
  const corridors: PlacedCorridor[] = [];
  for (const [a, b] of edges.values()) {
    const tree = treeEdges.has(edgeKey(a, b));
    const [from, to] = tree && parent.get(b.id) === a ? [a, b] : tree && parent.get(a.id) === b ? [b, a] : [a, b];
    const drawnCells = drawn.get(edgeKey(a, b));
    // 그린 통로가 두 방에 실제로 닿고(방 바닥과 칸이 겹치거나 바로 옆) 서로 이어져 있을 때만 그대로 깔다 — 아니면 빌더 통로(줄 내림·얼기에 끊긴 통로로 방이 외따로 남았다).
    const cells = drawnCells ? drawnLinks(drawnCells, from, to) : null;
    if (drawnCells && !cells) notes.push(`고침: 도안에 그린 통로 ${from.id}-${to.id} 가 두 방에 닿지 않아 빌더 통로로 이었다.`);
    // 방향은 조각 자기 모양에서, 네모 조각만 통로 전체 상자에서(L 통로의 꺾인 다리까지 한 방향으로 두면 문턱·벽 여백이 틀렸다 — AMEND2 2)
    const box = cells ? cells.reduce((m, r) => ({ x0: Math.min(m.x0, r.x), y0: Math.min(m.y0, r.y), x1: Math.max(m.x1, r.x + r.w), y1: Math.max(m.y1, r.y + r.h) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }) : null;
    const dirAll: DungeonDir = box && box.x1 - box.x0 > box.y1 - box.y0 ? (to.x >= from.x ? "E" : "W") : to.y >= from.y ? "S" : "N";
    const pieces = cells
      ? cells.map((rect): PlacedCorridor => ({ a: from.id, b: to.id, dir: ((d) => (d === "S" ? (to.y >= from.y ? "S" : "N") : d === "E" ? (to.x >= from.x ? "E" : "W") : dirAll))(touchDir(rect, [from, to, ...cells.filter((c) => c !== rect)])), rect, ...(!tree ? { loop: true } : {}) }))
      : connect(from, to, !tree);
    corridors.push(...pieces);
    if (tree) { to.from = from.id; to.dir = pieces[0]!.dir; }
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (r: Rect, north: number) => { minX = Math.min(minX, r.x); minY = Math.min(minY, r.y - north); maxX = Math.max(maxX, r.x + r.w); maxY = Math.max(maxY, r.y + r.h); };
  for (const r of placed) take(r, WALL_ROWS + 1);
  for (const c of corridors) take(c.rect, c.dir === "E" || c.dir === "W" ? WALL_ROWS + 1 : 0);
  const dx = MARGIN - minX, dy = MARGIN - minY;
  const move = <T extends Rect>(r: T): T => ({ ...r, x: r.x + dx, y: r.y + dy });
  return {
    rooms: placed.map(move), corridors: corridors.map((c) => ({ ...c, rect: move(c.rect) })),
    width: maxX - minX + MARGIN * 2, height: maxY - minY + MARGIN * 2, notes,
  };
}
