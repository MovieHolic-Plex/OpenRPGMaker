// editor/tools/planGridInterior.ts
// 도면 코드(ai/planGrid.ts) → 손 도트 실내(build_hand_interior_room 의 rooms·connect·objects). 집 도안은 가구를 실제보다 두 배쯤 크게 그리므로
// 도안 칸을 반으로 줄여 방 사각형을 옮기고(맨 위 두 줄은 벽면, 방 사이 1칸은 칸막이), 도안 길·문은 connect 로, 도안 물건은 칩셋 가구 이름(한국어)으로 찾아 그 자리에 놓는다.
import type { PlanGrid } from "@/ai/planGrid";

export interface InteriorPart { readonly id: string; readonly ko: string; readonly kind: string; readonly w: number; readonly h: number }
export interface PlanInteriorResult {
  readonly args: { rooms: { id: string; x0: number; y0: number; x1: number; y1: number; floor?: string; wall?: string }[]; connect: { a: string; b: string; at?: number }[]; objects: { id: string; x: number; y: number }[]; start?: { x: number; y: number }[] };
  readonly notes: string[];
  readonly missing: { name: string; x: number; y: number; w: number; h: number }[];
  readonly scale: number;
}

const FLOOR: Record<string, string> = { wood: "plank", carpet: "plank", stone: "flag", tile: "ktile", dirt: "earth", grass: "earth", sand: "earth", snow: "flag", water: "flag" };
const ROOM_KINDS = new Set(["room", "hall", "corridor", "stairs"]);

export function planToInterior(g: PlanGrid, parts: readonly InteriorPart[]): PlanInteriorResult {
  const notes: string[] = [], missing: PlanInteriorResult["missing"] = [];
  const { code } = g;
  const s = 0.7;
  const zoneBox = (i: number) => {
    let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
    g.masks[i]!.forEach((v, k) => { if (!v) return; const x = k % g.cols, y = (k - x) / g.cols; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); });
    return x1 < 0 ? null : { x0, y0, x1, y1 };
  };
  type Room = { id: string; zone: number; x0: number; y0: number; x1: number; y1: number; floor?: string };
  const rooms: Room[] = [];
  code.zones.forEach((z, i) => {
    if (!ROOM_KINDS.has(z.kind)) return;
    const b = zoneBox(i); if (!b) return;
    const r = { id: z.id, zone: i, x0: Math.max(1, Math.round(b.x0 * s) + 1), y0: Math.max(1, Math.round(b.y0 * s) + 1), x1: Math.round((b.x1 + 1) * s), y1: Math.round((b.y1 + 1) * s) + 1, ...(FLOOR[z.floor ?? ""] ? { floor: FLOOR[z.floor!]! } : {}) };
    r.x1 = Math.max(r.x1, r.x0 + 2); r.y1 = Math.max(r.y1, r.y0 + (z.kind === "corridor" || z.kind === "stairs" ? 3 : 4));
    rooms.push(r);
  });
  // 겹치거나 맞닿은 방: 작은 방 쪽 변을 물려 1칸 칸막이를 둔다(맞닿음은 트인 한 방이 되므로)
  for (let pass = 0; pass < 6; pass += 1) {
    let moved = false;
    for (const a of rooms) for (const b of rooms) {
      if (a === b) continue;
      const ox = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) + 1, oy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) + 1;
      if (ox < 0 || oy < 0 || (ox === 0 && oy === 0)) continue;
      const small = (a.x1 - a.x0) * (a.y1 - a.y0) <= (b.x1 - b.x0) * (b.y1 - b.y0) ? a : b, big = small === a ? b : a;
      if (ox <= oy) { if ((small.x0 + small.x1) / 2 < (big.x0 + big.x1) / 2) small.x1 = big.x0 - 2; else small.x0 = big.x1 + 2; }
      else { if ((small.y0 + small.y1) / 2 < (big.y0 + big.y1) / 2) small.y1 = big.y0 - 2; else small.y0 = big.y1 + 2; }
      moved = true;
    }
    if (!moved) break;
  }
  const live = rooms.filter((r) => r.x1 - r.x0 >= 1 && r.y1 - r.y0 >= 3);
  if (live.length < rooms.length) notes.push(`${rooms.length - live.length} room(s) too small after scaling were dropped`);
  const minX = Math.min(...live.map((r) => r.x0)), minY = Math.min(...live.map((r) => r.y0));
  for (const r of live) { r.x0 -= minX - 1; r.x1 -= minX - 1; r.y0 -= minY - 1; r.y1 -= minY - 1; }
  const at = (x: number, y: number) => ({ x: Math.round(x * s) + 1 - (minX - 1), y: Math.round(y * s) + 1 - (minY - 1) });
  // 문: 도안 길·문 꺾은선 양 끝이 걸친 방 쌍, 그리고 1칸 칸막이로 이웃한 방 쌍(도안에서 맞닿은 구역)
  const roomAt = (x: number, y: number) => live.find((r) => x >= r.x0 - 1 && x <= r.x1 + 1 && y >= r.y0 - 1 && y <= r.y1 + 1);
  const pairs = new Set<string>();
  const connect: { a: string; b: string }[] = [];
  const add = (a?: Room, b?: Room) => { if (!a || !b || a === b) return; const k = [a.id, b.id].sort().join("|"); if (pairs.has(k)) return; pairs.add(k); connect.push({ a: a.id, b: b.id }); };
  for (const p of code.paths) {
    const ends = [p.points[0]!, p.points[p.points.length - 1]!].map(([x, y]) => at(x, y));
    add(roomAt(ends[0]!.x, ends[0]!.y), roomAt(ends[1]!.x, ends[1]!.y));
  }
  const adjacent = (a: Room, b: Room) => (Math.abs(a.x1 + 2 - b.x0) <= 0 || Math.abs(b.x1 + 2 - a.x0) <= 0) && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) >= 2
    || (Math.abs(a.y1 + 2 - b.y0) <= 0 || Math.abs(b.y1 + 2 - a.y0) <= 0) && Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) >= 0;
  const reach = new Set<string>(); const first = live.slice().sort((a, b) => b.y1 - a.y1)[0];
  const grow = () => { reach.clear(); if (!first) return; reach.add(first.id); for (let k = 0; k < live.length; k += 1) for (const c of connect) { if (reach.has(c.a)) reach.add(c.b); if (reach.has(c.b)) reach.add(c.a); } };
  grow();
  for (const r of live) if (!reach.has(r.id)) { const nb = live.find((o) => reach.has(o.id) && adjacent(r, o)); if (nb) { add(r, nb); grow(); notes.push(`linked ${code.zones[r.zone]!.name} to ${code.zones[nb.zone]!.name} (no drawn door)`); } }
  const connectOk = connect.filter((c) => { const a = live.find((r) => r.id === c.a)!, b = live.find((r) => r.id === c.b)!; return adjacent(a, b); });
  if (connectOk.length < connect.length) notes.push(`${connect.length - connectOk.length} drawn link(s) between rooms that are not wall neighbours after scaling were skipped`);
  // 가구: 칩셋 가구 한국어 이름이 도안 물건 이름에 들어 있으면 그것(긴 이름 먼저)
  const byId = new Map(parts.map((p) => [p.id, p] as const));
  const byKo = [...parts].filter((p) => p.ko && p.kind !== "flat").sort((a, b) => b.ko.length - a.ko.length);
  const WORD: readonly [RegExp, string][] = [
    [/아궁이|가마솥|조리대|레인지/u, "kitchen range"], [/화덕/u, "stove"], [/벽난로/u, "fireplace"], [/개수대|싱크/u, "kitchen sink"],
    [/찬장|장식장|식기/u, "bookshelf 2w"], [/서랍/u, "apothecary drawers"], [/책장|서가/u, "bookshelf 2w"], [/옷장/u, "wardrobe"],
    [/이부자리|침대/u, "bed blue"], [/협탁/u, "nightstand"], [/책상/u, "desk 2x1"], [/식탁/u, "dining 2x1"], [/탁자|테이블/u, "tea 1x1"],
    [/소파|벤치/u, "bench 2"], [/안락/u, "armchair"], [/의자/u, "chair S"], [/화분|분재|덩굴/u, "potted fern"],
    [/항아리|장독|독/u, "water jar"], [/보물/u, "treasure chest"], [/상자|궤짝/u, "chest"], [/장작/u, "firewood rack"], [/바구니|사과/u, "barrel"],
    [/등불|등잔|랜턴|램프|등/u, "wall sconce"], [/창고 선반|선반/u, "bookshelf 1w"], [/그림|액자/u, "picture"], [/창문|창/u, "window"],
  ];
  const objects: { id: string; x: number; y: number }[] = [];
  for (const o of code.objects) {
    const alias = WORD.find(([re]) => re.test(o.name))?.[1];
    const part = (alias ? byId.get(alias) : undefined) ?? byKo.find((p) => p.ko.length >= 2 && o.name.includes(p.ko.replace(/ \d.*$/u, "")));
    const pos = at(o.x, o.y + o.h - 1);
    if (!part) { missing.push({ name: o.name, x: pos.x, y: pos.y, w: Math.max(1, Math.round(o.w * s)), h: Math.max(1, Math.round(o.h * s)) }); continue; }
    const room = live.find((r) => pos.x >= r.x0 && pos.x <= r.x1 && pos.y >= r.y0 && pos.y <= r.y1);
    if (!room) { notes.push(`plan object «${o.name}» fell outside every room`); continue; }
    const y = part.kind === "hang" ? room.y0 : part.kind === "wall" ? room.y0 + 2 : Math.max(room.y0 + 2, Math.min(room.y1 - (part.h || 1) + 1, pos.y - (part.h || 1) + 1));
    if (objects.some((q) => q.id === part.id && Math.abs(q.x - pos.x) < 2 && Math.abs(q.y - y) < 2)) continue;
    objects.push({ id: part.id, x: Math.max(room.x0, Math.min(room.x1 - part.w + 1, pos.x)), y });
  }
  const ent = code.entrance ? at(code.entrance.x, code.entrance.y) : null;
  const entRoom = ent ? live.slice().sort((a, b) => Math.abs((a.x0 + a.x1) / 2 - ent.x) + Math.abs(a.y1 - ent.y) - (Math.abs((b.x0 + b.x1) / 2 - ent.x) + Math.abs(b.y1 - ent.y)))[0] : first;
  return {
    args: {
      rooms: live.map((r) => ({ id: r.id, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1, ...(r.floor ? { floor: r.floor } : {}) })),
      connect: connectOk, objects,
      ...(entRoom ? { start: [{ x: Math.max(entRoom.x0, Math.min(entRoom.x1, ent?.x ?? entRoom.x0)), y: entRoom.y1 }] } : {}),
    },
    notes, missing, scale: s,
  };
}
