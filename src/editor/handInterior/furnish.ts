// 배치한 방마다 방 견본의 가구 한 벌을 옮겨 심는다. 방 크기에 맞는 견본을 고르고(templates.ts fittingTemplate),
// 붙은 가구 덩이(식탁+의자 등)마다 자리 후보(clusterShifts)를 차례로 넣어 본다 — 조립기 오류가 새로 생기거나, 닿지 못하는
// 바닥이 늘거나, 문 앞 칸·다른 덩이를 덮는 가구는 빠진다. 덩이 안에서는 몸통(가장 큰 가구)부터 넣고 넣은 가구에 붙은 것만 이어 넣어
// 식탁 없는 의자 같은 반쪽 세트를 남기지 않는다(2026-10-09). 몸통이 빠지면 다음으로 큰 가구에서 다시 잇는다.
// 후보 자리 여섯 곳까지 보고 가장 많이 들어간 자리를 쓴다.
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import type { LayoutRoom } from "./layout";
import { clusterShifts, fittingTemplate, itemArea, itemBox as itemBoxOf, roomTemplates, shiftItems, templateClusters, type InteriorStyleVariant, type InteriorTemplateItem } from "./templates";
import { notchRect } from "./rooms";
import { HALL_KIND, hallItems } from "./archHall";
import type { TilesetDef } from "@/project/types";

/** 탁자에 딸린 앉을 것 — 혼자서는 놓지 않는다. */
const SEAT = /chair|stool|bench|seat|cushion|zabuton|sofa-single/u;

export interface FurnishResult {
  readonly input: HandInteriorInput;
  /** 방 id → [견본 id, 심은 수, 뺀 수] */
  readonly perRoom: Record<string, { template: string; placed: number; dropped: number; missing?: string[] }>;
}

function withItems(base: HandInteriorInput, items: readonly InteriorTemplateItem[]): HandInteriorInput {
  return {
    ...base,
    objects: [...(base.objects ?? []), ...items.filter((i) => i.t === "o").map((i) => ({ id: i.id, x: i.x, y: i.y }))],
    tables: [...(base.tables ?? []), ...items.filter((i) => i.t === "t").map((i) => ({ style: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! }))],
    goods: [...(base.goods ?? []), ...items.filter((i) => i.t === "g").map((i) => ({ id: i.id, x: i.x, y: i.y }))],
    daises: [...(base.daises ?? []), ...items.filter((i) => i.t === "d").map((i) => ({ id: i.id, x: i.x, y: i.y, w: i.w!, h: i.h! }))],
    lines: [...(base.lines ?? []), ...items.filter((i) => i.t === "l").map((i) => ({ id: i.id, cells: i.cells!.map(([x, y]) => ({ x, y })) }))],
  };
}

/** 문 틈 둘레(지나가는 칸) — 가구가 덮으면 안 된다. 문 양쪽으로 곧게 두 칸(2026-10-19 「집같은 작은 공간은 통행 안되는 곳도 많은거같음」 -
 *  한 칸만 비우면 둘째 칸 가구 때문에 문 앞에서 옆으로 꺾어 들어가야 했다). 가로 문의 아래 방은 벽면 두 줄 뒤 바닥 두 칸까지. */
export function doorwayCells(composed: ComposedRooms): Set<string> {
  const keep = new Set<string>();
  for (const o of composed.openings) {
    if (o.open) continue;   // 칸막이를 통째로 걷은 쌍은 어디로든 지나간다 — 닿는지는 조립기 검사가 본다
    if (o.kind === "h") for (const dy of [-2, -1, 1, 2, 3]) keep.add(`${o.x},${o.y + dy}`);
    else for (const dx of [-2, -1, 1, 2]) keep.add(`${o.x + dx},${o.y}`);
  }
  for (let x = composed.exit.x; x < composed.exit.x + composed.exit.width; x++) for (const dy of [1, 2]) keep.add(`${x},${composed.exit.y - dy}`);
  return keep;
}

function footprint(it: InteriorTemplateItem, S: HandInteriorSpec): string[] {
  if (it.t === "l") return it.cells!.map(([x, y]) => `${x},${y}`);
  if (it.t === "g") return [];
  const o = it.t === "o" ? S.objects[it.id] : undefined;
  const w = it.t === "o" ? (o?.w ?? 1) : (it.w ?? 1), h = it.t === "o" ? Math.max(1, o?.h ?? 1) : (it.h ?? 1);
  if (o && (o.kind === "hang" || o.kind === "flat")) return [];
  return Array.from({ length: w * h }, (_, i) => `${it.x + (i % w)},${it.y + Math.floor(i / w)}`);
}

/** 밟는 무늬(깔개·줄·flat 가구)가 덮는 칸 — 같은 칸에 무늬 둘을 겹치지 않게. */
function flatCells(it: InteriorTemplateItem, S: HandInteriorSpec): string[] {
  if (it.t === "l") return it.cells!.map(([x, y]) => `${x},${y}`);
  const o = S.objects[it.id]; const w = o?.w ?? 1, h = Math.max(1, o?.h ?? 1);
  return Array.from({ length: w * h }, (_, i) => `${it.x + (i % w)},${it.y + Math.floor(i / w)}`);
}

export function furnishRooms(base: HandInteriorInput, rooms: readonly LayoutRoom[], composed: ComposedRooms, tilesetId: string, tileset: TilesetDef, S: HandInteriorSpec, styleVariant: InteriorStyleVariant = "A"): FurnishResult {
  const byId = new Map(roomTemplates(tilesetId).map((t) => [t.id, t]));
  const keep = doorwayCells(composed);
  let input = base;
  const firstInput = composed.exit.width === 0 && !input.start?.length
    ? { ...input, start: [{ x: composed.exit.x, y: Math.max(2, composed.exit.y - 1) }] }
    : input;
  const first = buildHandInteriorLayers(firstInput, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const perRoom: FurnishResult["perRoom"] = {};
  const isTravelItem = (it: InteriorTemplateItem | undefined): boolean => {
    const o = it?.t === "o" ? S.objects[it.id] : undefined;
    return Boolean(o && (o.use?.includes("travel") || o.stairs));
  };
  const roomHasTravel = (rm: LayoutRoom): number => {
    const t0 = rm.template ? byId.get(rm.template) : undefined;
    return t0?.items.some(isTravelItem) ? 1 : 0;
  };
  const orderedRooms = composed.exit.width === 0 ? [...rooms].sort((a, b) => roomHasTravel(b) - roomHasTravel(a)) : rooms;
  const cellsOf = (it: InteriorTemplateItem): string[] => {
    const isFlat = it.t === "l" || (it.t === "o" && S.objects[it.id]?.kind === "flat");
    if (isFlat) return flatCells(it, S).map((c) => `f:${c}`);
    const o = it.t === "o" ? S.objects[it.id] : undefined;
    if (o?.kind === "hang") {
      const w = Math.max(1, o.w);
      const out = Array.from({ length: w * 2 }, (_, i) => `h:${it.x + (i % w)},${it.y + Math.floor(i / w)}`);
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < 2; dy++) out.push(`wcol:${it.x + dx},${it.y + dy}`);
      return out;
    }
    const out = footprint(it, S).map((c) => `s:${c}`);
    // 키 큰 가구가 벽면(두 줄)에 걸린 게시판·창·칠판을 가리지 않게 한다 — 그림 꼭대기 줄(up 만큼 솟은 칸)을 벽면 칸으로 잡는다.
    // 벽에 붙는 가구(wall)는 첫 바닥 줄에서 벽면 맨 윗줄까지 닿는다. 한 줄 앞(y+1)에 놓인 키 큰 바닥 가구도 꼭대기가 벽면에 닿으면 막힌다.
    // 꼭대기 줄 하나만 잡아 바닥 가구끼리 앞뒤로 놓는 배치는 막지 않는다.
    if (o && (o.kind === "wall" || (o.kind === "floor" && o.up >= 8))) {
      const w = Math.max(1, o.w);
      const top = it.y - (o.kind === "wall" ? 2 : Math.min(2, Math.ceil(o.up / 16)));
      for (let dx = 0; dx < w; dx++) out.push(`wcol:${it.x + dx},${top}`);
    }
    return out;
  };
  /** 한 점을 넣어 본다 — 싼 검사(방 안·문 앞·겹침) 뒤 조립기 검사. 되면 반영하고 true. */
  // 견본이 일부러 겹쳐 그린 벽면 짝(전철 롱시트 위 손잡이 끈처럼)은 벽면 칸을 같이 쓴다 — 「키 큰 가구가 게시판을 가린다」 규칙이
  // 견본 자체의 배치를 지워 북쪽 좌석이 통째로 빠졌다(J45). 짝은 견본 좌표에서 벽면 칸이 겹치는 두 물건 id 다.
  let wallShare = new Map<string, Set<string>>();
  const wallSharesOf = (t: { readonly items: readonly InteriorTemplateItem[] }): Map<string, Set<string>> => {
    const byCell = new Map<string, string[]>();
    for (const it of t.items) for (const c of cellsOf(it)) if (c.startsWith("wcol:")) byCell.set(c, [...(byCell.get(c) ?? []), it.id]);
    const out = new Map<string, Set<string>>();
    for (const ids of byCell.values()) for (const a of ids) for (const b of ids) if (a !== b) out.set(a, (out.get(a) ?? new Set<string>()).add(b));
    return out;
  };
  const clashes = (it: InteriorTemplateItem, c: string, taken: Set<string>): boolean => {
    if (!taken.has(c)) return false;
    if (!c.startsWith("wcol:")) return true;
    const mates = wallShare.get(it.id);
    if (!mates) return true;
    const xy = c.slice(5);
    const owners = [...taken].filter((k) => k.startsWith(`wown:${xy}=`)).map((k) => k.slice(k.indexOf("=") + 1));
    return !owners.length || owners.some((o) => !mates.has(o));
  };
  const tryPutIn = (it: InteriorTemplateItem, taken: Set<string>, inside: (it: InteriorTemplateItem) => boolean): boolean => {
    const cells = cellsOf(it);
    if (!inside(it) || footprint(it, S).some((c) => keep.has(c)) || cells.some((c) => clashes(it, c, taken))) return false;
    const next = withItems(input, [it]);
    const built = buildHandInteriorLayers(next, tileset, S);
    const e = built.issues.filter((i) => i.severity === "error").length;
    if (e > errors || built.unreachedFloor.length > unreached) return false;
    input = next; errors = e; unreached = built.unreachedFloor.length;
    for (const c of cells) { taken.add(c); if (c.startsWith("wcol:")) taken.add(`wown:${c.slice(5)}=${it.id}`); }
    return true;
  };
  for (const room of orderedRooms) {
    if (room.kind === HALL_KIND && room.dress) {
      // 복도는 견본이 없다 - 벽 가구·걸이·벤치를 archHall.ts 후보대로 놓고, 문 앞·겹침에 걸리면 옆으로 비킨다.
      const hallTaken = new Set<string>();
      wallShare = new Map();
      const inHall = (it: InteriorTemplateItem) => it.t !== "l" && it.x >= room.x0 && it.x <= room.x1 && it.y >= room.y0 && it.y <= room.y1;
      let hPlaced = 0, hDropped = 0;
      for (const it of hallItems(room, room.dress, (id) => S.objects[id]?.w ?? 1)) {
        if (!S.objects[it.id]) { hDropped++; continue; }
        let ok = false;
        for (const dx of [0, 1, -1, 2, -2, 3, -3]) { if (tryPutIn({ ...it, x: it.x + dx }, hallTaken, inHall)) { ok = true; break; } }
        if (ok) hPlaced++; else hDropped++;
      }
      perRoom[room.id] = { template: HALL_KIND, placed: hPlaced, dropped: hDropped };
      continue;
    }
    const t0 = room.template ? byId.get(room.template) : undefined;
    if (!t0) continue;
    const w = room.x1 - room.x0 + 1, h = room.y1 - room.y0 + 1;
    const t = fittingTemplate(tilesetId, t0, w, h);
    wallShare = wallSharesOf(t);
    const nrs = (room.notches ?? []).map((n) => notchRect(room, n));
    const inside = (it: InteriorTemplateItem) => {
      const pts = it.t === "l" ? it.cells!.map(([x, y]) => [x, y] as const) : [[it.x, it.y] as const];
      if (!pts.every(([x, y]) => x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1)) return false;
      return !nrs.length || !footprint(it, S).some((c) => { const [cx, cy] = c.split(",").map(Number) as [number, number]; return nrs.some((nr) => cx >= nr.x0 - 1 && cx <= nr.x1 + 1 && cy >= nr.y0 - 1 && cy <= nr.y1); });
    };
    let placed = 0, dropped = 0;
    const missing: string[] = [];
    let taken = new Set<string>();
    /** 한 점을 넣어 본다 — 싼 검사(방 안·문 앞·겹침) 뒤 조립기 검사. 되면 반영하고 true. */
    const tryPut = (it: InteriorTemplateItem): boolean => tryPutIn(it, taken, inside);
    const clusterHasTravel = (c: { readonly members: readonly number[] }): number =>
      c.members.some((k) => isTravelItem(t.items[k])) ? 1 : 0;
    const clusters = templateClusters(t, S).sort((a, b) =>
      clusterHasTravel(b) - clusterHasTravel(a)
      || Number(b.pinTop) - Number(a.pinTop)
      || (styleVariant === "D" ? a.area - b.area : b.area - a.area)
      || (styleVariant === "B" || styleVariant === "D" ? b.box[0] - a.box[0] : a.box[0] - b.box[0]),
    );
    for (const c of clusters) {
      // 덩이 안 이웃: 견본 좌표에서 붙어 있는 쌍. 몸통(가장 큰 가구)부터 넣고, 넣은 가구에 붙은 것만 이어 넣는다 —
      // 식탁이 안 들어가면 의자도 안 들어간다.
      const nb = new Map<number, number[]>(c.members.map((k) => [k, c.links.filter(([p, q]) => p === k || q === k).map(([p, q]) => (p === k ? q : p))]));
      const primary = [...c.members].sort((p, q) => itemArea(t.items[q]!, S) - itemArea(t.items[p]!, S))[0]!;
      const saved = { input, errors, unreached, taken: new Set(taken) };
      let best: { input: HandInteriorInput; errors: number; unreached: number; taken: Set<string>; n: number; put: Set<number> } | undefined;
      let tried = 0;
      for (const [sx, sy] of clusterShifts(t, c, w, h, styleVariant)) {
        if (tried >= 6) break;
        const items = new Map(c.members.map((k, i) => [k, shiftItems(t, c, sx, sy, room)[i]!]));
        tried++;
        input = saved.input; errors = saved.errors; unreached = saved.unreached; taken = new Set(saved.taken);
        const put = new Set<number>(), moved = new Map<number, [number, number]>();
        const shifted = (it: InteriorTemplateItem, ex: number, ey: number): InteriorTemplateItem =>
          it.t === "l" ? { ...it, cells: it.cells!.map(([x, y]) => [x + ex, y + ey] as [number, number]) } : { ...it, x: it.x + ex, y: it.y + ey };
        /** 제자리에 안 들어가면 1~3칸 비켜 본다(벽 가구는 옆으로만) — 문 앞·다른 가구에 한 칸 걸려 통째로 빠지는 것을 막는다. */
        const seat = (k: number, parentShift: readonly [number, number] = [0, 0]): boolean => {
          const it = items.get(k)!;
          const [px, py] = parentShift;
          if (tryPut(shifted(it, px, py))) {
            put.add(k);
            if (px || py) moved.set(k, [px, py]);
            return true;
          }
          if (it.t === "g" || SEAT.test(it.id)) return false;
          const wallish = it.t === "o" && ["wall", "hang", "door", "sidedoor"].includes(S.objects[it.id]?.kind ?? "");
          const shifts = wallish
            ? [[1, 0], [-1, 0], [2, 0], [-2, 0], [3, 0], [-3, 0], [4, 0], [-4, 0], [5, 0], [-5, 0], [6, 0], [-6, 0]] as const
            : [[1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1], [3, 0], [-3, 0], [1, 1], [-1, 1]] as const;
          for (const [ex, ey] of shifts) {
            if (tryPut(shifted(it, px + ex, py + ey))) { put.add(k); moved.set(k, [px + ex, py + ey]); return true; }
          }
          return false;
        };
        // 몸통에서 못 이은 가구는 따로 다시 잇는다 — 의자·걸상·탁상 물건만은 씨앗이 되지 못한다(식탁 없는 의자를 남기지 않게).
        const seen = new Set<number>();
        const seeds = [primary, ...[...c.members].filter((k) => k !== primary && t.items[k]!.t !== "g" && !SEAT.test(t.items[k]!.id)).sort((p, q) => itemArea(t.items[q]!, S) - itemArea(t.items[p]!, S))];
        for (const seed of seeds) {
          if (seen.has(seed)) continue;
          seen.add(seed);
          if (!seat(seed)) continue;
          const queue = [seed];
          while (queue.length) {
            const p = queue.shift()!;
            const pShift = moved.get(p) ?? [0, 0];
            for (const k of nb.get(p) ?? []) {
              if (seen.has(k) || t.items[k]!.t === "g") continue; seen.add(k);
              if (seat(k, pShift)) queue.push(k);
            }
          }
        }
        // 탁상 물건은 받칠 가구가 다 들어간 뒤에 — 받침이 비켜 앉았으면 같이 비킨다
        for (const k of c.members) {
          if (t.items[k]!.t !== "g") continue;
          const g = t.items[k]!;
          const base = (nb.get(k) ?? []).find((q) => put.has(q) && t.items[q]!.t !== "g" && (() => { const [bx, by, bw, bh] = itemBoxOf(t.items[q]!, S); return g.x >= bx && g.x < bx + bw && g.y >= by - 1 && g.y < by + bh; })());
          if (base === undefined) continue;
          const [ex, ey] = moved.get(base) ?? [0, 0];
          if (tryPut(shifted(items.get(k)!, ex, ey))) put.add(k);
        }
        const n = put.size;
        if (n && (!best || n > best.n)) best = { input, errors, unreached, taken, n, put: new Set(put) };
        if (n === c.members.length) break;
      }
      ({ input, errors, unreached, taken } = best ?? saved);
      placed += best?.n ?? 0; dropped += c.members.length - (best?.n ?? 0);
      // 빠진 견본 가구(어떤 것이 왜 안 들어갔는지 견본 저작·검수에서 본다)
      for (const k of c.members) if (!best?.put.has(k)) { const it = t.items[k]!; missing.push(`${it.id}@${it.x},${it.y}`); }
    }
    perRoom[room.id] = { template: t.id, placed, dropped, ...(missing.length ? { missing } : {}) };
  }
  return { input, perRoom };
}
