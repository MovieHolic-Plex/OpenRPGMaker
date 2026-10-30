// 모델이 선언한 방 그래프 → 방 사각형·문·출구(rooms.ts 의 rooms·connect·exit).
//
// 왜(2026-10-30 mapvqa ③ 1·2회차): 판정자가 이긴 기준 방은 모두 «여러 방 + 계단·곁방 + 큰 랜드마크»였고, 진 방은 9×9 한 칸 상자였다.
// 구역 이름표·검사(room_zones)만으로는 공간 구조가 바뀌지 않았다(0/52 → 0/52). 그래서 구조 자체를 모델이 그래프로 선언한다:
//   방마다 크기(design.w·h)·대략의 자리(x,y), 방 쌍의 연결(door 문 · open 트인 칸), 입구 방, 계단, 랜드마크.
// 이 함수는 «조화»만 한다 — 방 수·크기·자리·연결을 고르지 않는다:
//   - 연결된 두 방 사이를 정확히 칸막이 1칸으로 붙인다(문을 뚫을 수 있게). 붙는 쪽(위·아래·좌·우)은 모델의 대략 자리에서 읽는다.
//   - 붙는 축과 수직인 방향의 어긋남은 모델 값을 지키되, 문이 날 만큼(세로 칸막이는 3줄, 가로 칸막이는 1열) 겹치게만 민다.
//   - 다른 방과 부딪히면 그 축 안에서 가장 가까운 빈 자리로 민다. 그래도 안 되면 거절하고 고친 호출을 영어로 보인다.
//   - 연결 없는 방·이어지지 않는 그래프·입구 방이 남쪽 끝이 아닌 평면은 거절한다(고칠 말과 함께).
// 모델이 보는 글(오류)은 영어다(2026-10-30 사용자 결정 — 모델이 받는 글은 영어).
import { notchRect, type HandInteriorConnect, type HandInteriorExit, type HandInteriorNotch } from "./rooms";

export interface GraphRoomIn {
  readonly id: string; readonly kind: string;
  /** 바닥 가로(칸). */
  readonly w: number;
  /** 방 세로(벽면 두 줄 포함 — layout 방과 같은 뜻). */
  readonly h: number;
  /** 대략의 왼쪽 위(칸, x 오른쪽·y 아래). 원점은 아무 데나. */
  readonly x?: number; readonly y?: number;
  readonly floor?: string; readonly wall?: string;
  readonly notches?: readonly HandInteriorNotch[];
}
export interface GraphConnIn { readonly a: string; readonly b: string; readonly type?: string }
export interface GraphIn { readonly rooms: readonly GraphRoomIn[]; readonly connections: readonly GraphConnIn[]; readonly entrance?: string; readonly exitAt?: number }
export interface GraphRoomOut { readonly id: string; readonly kind: string; readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly floor?: string; readonly wall?: string; readonly notches?: readonly HandInteriorNotch[] }
export interface GraphOut { readonly rooms: GraphRoomOut[]; readonly connect: HandInteriorConnect[]; readonly exit: HandInteriorExit; readonly notes: string[]; readonly width: number; readonly height: number }

export class RoomGraphError extends Error {
  constructor(message: string, readonly fixed?: string) { super(message); this.name = "RoomGraphError"; }
}

export const GRAPH_MAX_W = 52, GRAPH_MAX_H = 44;
/** 세로 칸막이 문은 겹친 줄 3줄 이상(위 두 줄은 칸막이 끝 벽면) — rooms.ts 와 같다. */
const V_OVERLAP = 3;

type Rect = { x0: number; y0: number; x1: number; y1: number };
type Side = "north" | "south" | "east" | "west";
const touchOrOverlap = (a: Rect, b: Rect) => a.x0 <= b.x1 + 1 && b.x0 <= a.x1 + 1 && a.y0 <= b.y1 + 1 && b.y0 <= a.y1 + 1;

/** 연결 종류 낱말 → door | open. 계단·복도 같은 다른 낱말은 문으로 읽는다(복도는 방으로 선언한다). */
export function connType(raw: unknown): "door" | "open" {
  return /open|arch|트인|아치|without|no.?door/iu.test(String(raw ?? "")) ? "open" : "door";
}

/** 부모 p 에서 본 자식 c 의 대략 자리 → 붙는 쪽. */
function sideOf(p: GraphRoomIn, c: GraphRoomIn): Side {
  const pcx = (p.x ?? 0) + p.w / 2, pcy = (p.y ?? 0) + p.h / 2, ccx = (c.x ?? 0) + c.w / 2, ccy = (c.y ?? 0) + c.h / 2;
  const dx = (ccx - pcx) / Math.max(1, (p.w + c.w) / 2), dy = (ccy - pcy) / Math.max(1, (p.h + c.h) / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "east" : "west";
  return dy > 0 ? "south" : "north";
}

/** 부모 사각형 옆에 자식을 붙이는 후보 자리(수직축 어긋남은 모델 값에서 가까운 순). */
function candidates(p: Rect, pin: GraphRoomIn, c: GraphRoomIn, side: Side): Rect[] {
  const w = c.w, h = c.h;
  const out: Rect[] = [];
  if (side === "south" || side === "north") {
    const y0 = side === "south" ? p.y1 + 2 : p.y0 - 1 - h;
    const want = p.x0 + ((c.x ?? 0) - (pin.x ?? 0));
    const lo = p.x0 - w + 1, hi = p.x1;   // 겹친 열 1 이상
    const order = [...Array(hi - lo + 1).keys()].map((i) => lo + i).sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    for (const x0 of order) out.push({ x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 });
  } else {
    const x0 = side === "east" ? p.x1 + 2 : p.x0 - 1 - w;
    const want = p.y0 + ((c.y ?? 0) - (pin.y ?? 0));
    const lo = p.y0 - h + V_OVERLAP, hi = p.y1 - V_OVERLAP + 1;
    const order = [...Array(Math.max(0, hi - lo + 1)).keys()].map((i) => lo + i).sort((a, b) => Math.abs(a - want) - Math.abs(b - want));
    for (const y0 of order) out.push({ x0, y0, x1: x0 + w - 1, y1: y0 + h - 1 });
  }
  return out;
}

/** 두 방이 정확히 칸막이 1칸으로 붙어 문을 낼 수 있나. */
export function adjacentForDoor(a: Rect, b: Rect): boolean {
  const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1, oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
  if ((b.y0 - a.y1 === 2 || a.y0 - b.y1 === 2) && ox >= 1) return true;
  if ((b.x0 - a.x1 === 2 || a.x0 - b.x1 === 2) && oy >= V_OVERLAP) return true;
  return false;
}

const fmt = (r: GraphRoomIn, at?: Rect) => `{id:"${r.id}", x:${at ? at.x0 : r.x}, y:${at ? at.y0 : r.y}, w:${r.w}, h:${r.h - 2}}`;

export function harmonizeRoomGraph(g: GraphIn): GraphOut {
  const notes: string[] = [];
  const rooms = g.rooms;
  if (rooms.length < 1) throw new RoomGraphError("roomGraph has no rooms — every room is a zone with a design (w, h) and x, y.");
  const byId = new Map<string, GraphRoomIn>();
  for (const r of rooms) {
    if (byId.has(r.id)) throw new RoomGraphError(`room id "${r.id}" appears twice — give each zone its own id.`);
    byId.set(r.id, r);
  }
  const missingPos = rooms.filter((r) => typeof r.x !== "number" || typeof r.y !== "number");
  if (missingPos.length && rooms.length > 1) throw new RoomGraphError(`rooms without a rough position: ${missingPos.map((r) => r.id).join(", ")} — give every zone x and y (rough top-left in cells; the plan origin is free).`,
    `zones:[${missingPos.map((r) => `{id:"${r.id}", x:<cells>, y:<cells>, design:{…}}`).join(", ")}]`);
  const conns = g.connections.map((c) => ({ a: String(c.a), b: String(c.b), type: connType(c.type) }));
  for (const c of conns) {
    if (!byId.has(c.a) || !byId.has(c.b)) throw new RoomGraphError(`connection ${c.a}–${c.b} names a room that is not a zone id (zone ids: ${[...byId.keys()].join(", ")}).`);
    if (c.a === c.b) throw new RoomGraphError(`connection ${c.a}–${c.b} connects a room to itself.`);
  }
  const entrance = g.entrance && byId.has(g.entrance) ? g.entrance : [...rooms].sort((a, b) => ((b.y ?? 0) + b.h) - ((a.y ?? 0) + a.h))[0]!.id;
  if (g.entrance && !byId.has(g.entrance)) notes.push(`entrance "${g.entrance}" is not a zone id — used ${entrance} (the southernmost room)`);
  // 너비 우선 나무: 입구에서 연결을 따라 붙인다.
  const adj = new Map<string, { to: string; type: "door" | "open" }[]>();
  for (const c of conns) { (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push({ to: c.b, type: c.type }); (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push({ to: c.a, type: c.type }); }
  const placed = new Map<string, Rect>();
  const root = byId.get(entrance)!;
  placed.set(root.id, { x0: root.x ?? 1, y0: root.y ?? 1, x1: (root.x ?? 1) + root.w - 1, y1: (root.y ?? 1) + root.h - 1 });
  const tree = new Set<string>();
  const queue = [root.id];
  while (queue.length) {
    const pid = queue.shift()!;
    const p = placed.get(pid)!, pin = byId.get(pid)!;
    for (const e of adj.get(pid) ?? []) {
      if (placed.has(e.to)) continue;
      const c = byId.get(e.to)!;
      const want = sideOf(pin, c);
      const sides: Side[] = [want];
      let got: Rect | undefined;
      for (const side of sides) {
        for (const r of candidates(p, pin, c, side)) {
          if ([...placed.values()].some((o) => o !== p && touchOrOverlap(o, r))) continue;
          if (touchOrOverlap(p, r) && !adjacentForDoor(p, r)) continue;
          got = r; break;
        }
        if (got) break;
      }
      if (!got) {
        // 다른 쪽에 빈 자리가 있으면 그 자리를 고친 호출로 보인다(함수가 쪽을 바꾸지는 않는다).
        let alt: { side: Side; r: Rect } | undefined;
        for (const side of (["north", "south", "east", "west"] as Side[]).filter((s) => s !== want)) {
          const r = candidates(p, pin, c, side).find((q) => ![...placed.values()].some((o) => o !== p && touchOrOverlap(o, q)) && (!touchOrOverlap(p, q) || adjacentForDoor(p, q)));
          if (r) { alt = { side, r }; break; }
        }
        const blockers = [...placed.entries()].filter(([id, o]) => id !== pid && candidates(p, pin, c, want).some((q) => touchOrOverlap(o, q))).map(([id]) => id);
        throw new RoomGraphError(`room "${c.id}" does not fit on the ${want} side of "${pid}"${blockers.length ? ` — it collides with ${blockers.join(", ")}` : ""}. Move it, shrink it, or connect it to another room.`,
          alt ? `zones: ${fmt(c, alt.r)} (on the ${alt.side} side of "${pid}"; coordinates in the snapped plan)` : undefined);
      }
      placed.set(c.id, got);
      tree.add(`${pid}|${c.id}`);
      queue.push(c.id);
      const rx = got.x0 - (p.x0 - (pin.x ?? 0)), ry = got.y0 - (p.y0 - (pin.y ?? 0));
      if (Math.abs(rx - (c.x ?? rx)) + Math.abs(ry - (c.y ?? ry)) >= 1) notes.push(`snapped ${c.id} to the ${want} of ${pid} with a one-cell wall (moved ${rx - (c.x ?? rx)},${ry - (c.y ?? ry)})`);
    }
  }
  const lonely = rooms.filter((r) => !placed.has(r.id));
  if (lonely.length) throw new RoomGraphError(`rooms not connected to the entrance "${entrance}": ${lonely.map((r) => r.id).join(", ")} — add a connection {a, b, type:"door"|"open"} for each.`,
    `connections:[${lonely.map((r) => `{a:"${r.id}", b:"<a connected room id>", type:"door"}`).join(", ")}]`);
  // 나무 밖 연결(고리)은 이미 붙어 있어야 한다.
  for (const c of conns) {
    if (tree.has(`${c.a}|${c.b}`) || tree.has(`${c.b}|${c.a}`)) continue;
    if (!adjacentForDoor(placed.get(c.a)!, placed.get(c.b)!)) throw new RoomGraphError(`connection ${c.a}–${c.b} cannot be carved: after snapping, the rooms are not side by side with a one-cell wall. Drop that connection or place ${c.b} next to ${c.a}.`);
  }
  // 원점 맞추기(바깥 벽 한 칸).
  const minX = Math.min(...[...placed.values()].map((r) => r.x0)), minY = Math.min(...[...placed.values()].map((r) => r.y0));
  const out: GraphRoomOut[] = rooms.map((r) => {
    const p = placed.get(r.id)!;
    return { id: r.id, kind: r.kind, x0: p.x0 - minX + 1, y0: p.y0 - minY + 1, x1: p.x1 - minX + 1, y1: p.y1 - minY + 1, ...(r.floor ? { floor: r.floor } : {}), ...(r.wall ? { wall: r.wall } : {}), ...(r.notches?.length ? { notches: r.notches } : {}) };
  });
  const W = Math.max(...out.map((r) => r.x1)) + 2, H = Math.max(...out.map((r) => r.y1)) + 2;
  if (W > GRAPH_MAX_W || H > GRAPH_MAX_H) throw new RoomGraphError(`the plan is ${W}×${H} cells after snapping (limit ${GRAPH_MAX_W}×${GRAPH_MAX_H}). Shrink rooms or stack them.`);
  const ent = out.find((r) => r.id === entrance)!;
  const bottom = Math.max(...out.map((r) => r.y1));
  if (ent.y1 !== bottom) {
    const below = out.filter((r) => r.y1 > ent.y1).map((r) => r.id);
    throw new RoomGraphError(`the entrance room "${entrance}" must reach the south edge (the exit is in the south outer wall), but ${below.join(", ")} lie further south. Make "${entrance}" deeper, move those rooms north of it, or make one of them the entrance.`,
      `entrance:"${below[0]}"  (or zones: ${below.map((id) => `{id:"${id}", y:<above ${entrance}>}`).join(", ")})`);
  }
  // 출구 자리: 입구 방 폭의 비율(설계 door). 노치 열은 rooms.ts·빌더가 피한다.
  let ex = Math.max(ent.x0, Math.min(ent.x1, ent.x0 + Math.round((g.exitAt ?? 0.5) * (ent.x1 - ent.x0))));
  // 남쪽 귀퉁이를 도려 낸 열(T·ㄱ자)에는 출구를 내지 않는다 — 가장 가까운 바닥 열로.
  const blocked = new Set<number>();
  for (const n of ent.notches ?? []) if (n.corner[0] === "s") { const r = notchRect(ent, n); for (let x = r.x0; x <= r.x1; x++) blocked.add(x); }
  if (blocked.has(ex)) { const free = [...Array(ent.x1 - ent.x0 + 1).keys()].map((i) => ent.x0 + i).filter((x) => !blocked.has(x)).sort((a, b) => Math.abs(a - ex) - Math.abs(b - ex)); if (free[0] !== undefined) ex = free[0]; }
  const connect: HandInteriorConnect[] = conns.map((c) => ({ a: c.a, b: c.b, ...(c.type === "open" ? { open: true } : {}) }));
  return { rooms: out, connect, exit: { room: entrance, x: ex }, notes, width: W, height: H };
}
