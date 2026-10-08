// 방 목록 → 평면. 조수가 '#'·'.' 글자 그림을 손으로 그리지 않고 방 사각형과 이을 방 쌍만 주면
// 칸막이·문 틈·남쪽 출구·방별 바닥/벽면(zones)·문 기물을 계산한다(2026-10-08 조수 시험: 일본 집 1층을 칸막이 없이
// 바닥 무늬 구역만 바꿔 깔았다 — 다다미방이 마루 한가운데 떠 있었다).
//
//  방 = 바닥 사각형(x0..x1, y0..y1, 맨 위 두 줄은 벽면). 방 밖은 전부 '#'. 방 사이가 1칸이면 그 칸이 칸막이,
//  0칸(맞닿음)이면 칸막이 없이 하나로 트인다(ㄱ·ㄷ자 방), 2칸 이상이면 두꺼운 벽.
//  connect = 1칸 칸막이를 사이에 둔 두 방을 문으로 잇는다.
//    가로 칸막이(위·아래 방): 1칸 틈 — 틈과 그 아래 벽면 두 줄이 통로가 된다.
//    세로 칸막이(왼·오른 방): 3줄 틈 — 위 두 줄은 칸막이 끝 벽면, 셋째 줄이 통로.
//  문 기물: 사양에 door·sidedoor 종류가 있으면(jp_city) 틈에 단다. 없으면 틈만 연다(손 도트 v5 는 도구가 문을 맞춘다).
import type { HandInteriorInput, HandInteriorObject, HandInteriorSpec, HandInteriorZone } from "./builder";
import { HandInteriorError } from "./builder";

export interface HandInteriorRoom {
  readonly id: string;
  readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number;
  readonly floor?: string; readonly wall?: string;
}
export interface HandInteriorConnect {
  readonly a: string; readonly b: string;
  /** 문 자리: 가로 칸막이면 x, 세로 칸막이면 통로 줄 y. 생략하면 겹친 구간 가운데. */
  readonly at?: number;
  /** 문 기물 id(jp_city 의 fusuma-open·door-open-toilet·door-side-sliding 등). 생략하면 사양의 첫 문. "none" 이면 틈만. */
  readonly door?: string;
  /** 칸막이를 겹친 구간 전체에서 걷어 두 방을 트인 한 공간으로 잇는다(현관↔복도, 부엌↔거실). 문 기물은 달지 않는다. */
  readonly open?: boolean;
}
export interface HandInteriorExit { readonly room: string; readonly x?: number; readonly width?: number }

export interface ComposedRooms {
  readonly plan: string[];
  readonly zones: HandInteriorZone[];
  readonly doors: HandInteriorObject[];
  readonly exit: { readonly x: number; readonly y: number; readonly width: number };
  /** 이은 문마다 실제 틈 자리(조수가 가구를 문 앞에 놓지 않도록 돌려준다). */
  readonly openings: { readonly a: string; readonly b: string; readonly x: number; readonly y: number; readonly kind: "h" | "v" }[];
}

const fail = (message: string, code = "rooms-invalid"): never => { throw new HandInteriorError(message, code); };

export function composeHandInteriorRooms(
  rooms: readonly HandInteriorRoom[], connect: readonly HandInteriorConnect[], exit: HandInteriorExit | undefined, S: HandInteriorSpec,
): ComposedRooms {
  if (!rooms.length) fail("rooms 가 비었다 — 방 사각형을 하나 이상 준다");
  const byId = new Map<string, HandInteriorRoom>();
  for (const r of rooms) {
    if (!r.id) fail("방마다 id 가 필요하다");
    if (byId.has(r.id)) fail(`방 id "${r.id}" 가 두 번 나온다`);
    if (r.x0 < 1 || r.y0 < 1) fail(`방 ${r.id}: x0·y0 는 1 이상(0 줄·열은 바깥 벽)`);
    if (r.x1 < r.x0 || r.y1 < r.y0) fail(`방 ${r.id}: x1≥x0, y1≥y0 이어야 한다`);
    if (r.y1 - r.y0 + 1 < 3) fail(`방 ${r.id}: 세로 ${r.y1 - r.y0 + 1}줄 — 맨 위 두 줄은 벽면이라 3줄 이상이어야 걸을 바닥이 생긴다`);
    byId.set(r.id, r);
  }
  for (let i = 0; i < rooms.length; i++) for (let j = i + 1; j < rooms.length; j++) {
    const a = rooms[i]!, b = rooms[j]!;
    if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1) fail(`방 ${a.id} 와 ${b.id} 가 겹친다 — 칸막이를 두려면 사이를 1칸 띄운다`);
  }
  const W = Math.max(...rooms.map((r) => r.x1)) + 2, H = Math.max(...rooms.map((r) => r.y1)) + 2;
  const g: string[][] = Array.from({ length: H }, () => new Array<string>(W).fill("#"));
  for (const r of rooms) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) g[y]![x] = ".";

  const doorOf = (kind: "door" | "sidedoor", want: string | undefined): string | undefined => {
    if (want === "none") return undefined;
    if (want) {
      const o = S.objects[want];
      if (!o) fail(`문 "${want}" 이 이 칩셋에 없다 — ${Object.entries(S.objects).filter(([, d]) => d.kind === kind).map(([id]) => id).join(", ") || "문 기물 없음(생략하면 틈만 연다)"}`);
      if (o!.kind !== kind) fail(`문 "${want}" 은 ${o!.kind} 종류 — ${kind === "door" ? "위·아래 방(가로 칸막이)은 door" : "왼·오른 방(세로 칸막이)은 sidedoor"} 종류를 쓴다`);
      return want;
    }
    return Object.entries(S.objects).find(([, d]) => d.kind === kind)?.[0];
  };

  const doors: HandInteriorObject[] = [];
  const openings: { a: string; b: string; x: number; y: number; kind: "h" | "v" }[] = [];
  for (const c of connect) {
    const A = byId.get(c.a) ?? fail(`connect: 방 "${c.a}" 이 없다`), B = byId.get(c.b) ?? fail(`connect: 방 "${c.b}" 이 없다`);
    const [top, bot] = A.y1 < B.y0 ? [A, B] : B.y1 < A.y0 ? [B, A] : [undefined, undefined];
    const [left, right] = A.x1 < B.x0 ? [A, B] : B.x1 < A.x0 ? [B, A] : [undefined, undefined];
    if (top && bot && bot.y0 - top.y1 === 2) {
      const ox0 = Math.max(top.x0, bot.x0), ox1 = Math.min(top.x1, bot.x1);
      if (ox0 > ox1) fail(`connect ${c.a}–${c.b}: 위아래로 겹치는 열이 없다`);
      if (c.open) { for (let x = ox0; x <= ox1; x++) g[top.y1 + 1]![x] = "."; openings.push({ a: c.a, b: c.b, x: ox0, y: top.y1 + 1, kind: "h" }); continue; }
      const x = c.at ?? Math.floor((ox0 + ox1) / 2), y = top.y1 + 1;
      if (x < ox0 || x > ox1) fail(`connect ${c.a}–${c.b}: at=${x} 는 두 방이 겹치는 열 ${ox0}~${ox1} 밖`);
      g[y]![x] = ".";
      const d = doorOf("door", c.door);
      if (d) doors.push({ id: d, x, y });
      openings.push({ a: c.a, b: c.b, x, y, kind: "h" });
    } else if (left && right && right.x0 - left.x1 === 2) {
      const oy0 = Math.max(left.y0, right.y0), oy1 = Math.min(left.y1, right.y1);
      if (c.open) { if (oy0 > oy1) fail(`connect ${c.a}–${c.b}: 옆으로 겹친 줄이 없다`); for (let y = oy0; y <= oy1; y++) g[y]![left.x1 + 1] = "."; openings.push({ a: c.a, b: c.b, x: left.x1 + 1, y: oy1, kind: "v" }); continue; }
      // 통로 줄 p: 두 방 모두 벽면 아래(맨 위 두 줄 제외)이고, 틈 세 줄(p-2..p)이 겹친 구간 안.
      const lo = oy0 + 2, hi = oy1;
      if (lo > hi) fail(`connect ${c.a}–${c.b}: 옆으로 겹친 줄이 ${Math.max(0, oy1 - oy0 + 1)}줄 — 세로 칸막이 문은 겹친 줄 3줄 이상(위 두 줄은 칸막이 끝 벽면)`);
      const p = c.at ?? Math.min(hi, Math.max(lo, Math.floor((oy0 + oy1) / 2) + 1));
      if (p < lo || p > hi) fail(`connect ${c.a}–${c.b}: at=${p} — 통로 줄은 ${lo}~${hi}`);
      const x = left.x1 + 1;
      for (let y = p - 2; y <= p; y++) g[y]![x] = ".";
      const d = doorOf("sidedoor", c.door);
      if (d) doors.push({ id: d, x, y: p });
      openings.push({ a: c.a, b: c.b, x, y: p, kind: "v" });
    } else {
      fail(`connect ${c.a}–${c.b}: 두 방 사이가 정확히 1칸 칸막이가 아니다 — 문으로 이으려면 사이를 1칸 띄우고(맞닿으면 이미 트여 있다), 위아래 또는 좌우로 겹치게 놓는다`);
    }
  }

  const exitRoom = exit ? (byId.get(exit.room) ?? fail(`exit: 방 "${exit.room}" 이 없다`)) : [...rooms].sort((a, b) => b.y1 - a.y1)[0]!;
  if (exitRoom.y1 !== H - 2) fail(`출구 방 ${exitRoom.id} 가 맨 아래(y1=${H - 2})에 닿지 않는다 — 출구는 남쪽 바깥벽에 낸다. 출구 방을 바닥 줄까지 내리거나 다른 방을 exit 로`);
  const width = Math.max(1, exit?.width ?? 1);
  const ex = exit?.x ?? Math.floor((exitRoom.x0 + exitRoom.x1 + 1 - width) / 2);
  if (ex < exitRoom.x0 || ex + width - 1 > exitRoom.x1) fail(`exit.x=${ex} — 출구는 방 ${exitRoom.id} 의 열 ${exitRoom.x0}~${exitRoom.x1} 안`);
  for (let x = ex; x < ex + width; x++) g[H - 1]![x] = ".";

  const zones: HandInteriorZone[] = rooms.filter((r) => r.floor || r.wall)
    .map((r) => ({ x0: r.x0, y0: r.y0 - 1, x1: r.x1, y1: r.y1, ...(r.floor ? { floor: r.floor } : {}), ...(r.wall ? { wall: r.wall } : {}) }));
  return { plan: g.map((row) => row.join("")), zones, doors, exit: { x: ex, y: H - 1, width }, openings };
}

/** 도구 인자에 rooms 가 있으면 평면·zones·문을 채운 입력으로 바꾼다. plan 과 같이 주면 거부한다. */
export function withComposedRooms(input: HandInteriorInput & { rooms?: readonly HandInteriorRoom[]; connect?: readonly HandInteriorConnect[]; exit?: HandInteriorExit },
  S: HandInteriorSpec): { input: HandInteriorInput; composed?: ComposedRooms } {
  if (!input.rooms) return { input };
  if (input.plan?.length) fail("plan 과 rooms 를 함께 줄 수 없다 — 하나만 준다(rooms 가 평면을 만든다)", "rooms-and-plan");
  const composed = composeHandInteriorRooms(input.rooms, input.connect ?? [], input.exit, S);
  const { rooms: _r, connect: _c, exit: _e, ...rest } = input;
  return {
    composed,
    input: { ...rest, plan: composed.plan, exitWidth: composed.exit.width, zones: [...composed.zones, ...(input.zones ?? [])],
      objects: [...composed.doors, ...(input.objects ?? [])] },
  };
}
