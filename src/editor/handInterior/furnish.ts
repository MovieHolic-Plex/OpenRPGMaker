// 배치한 방마다 방 견본의 가구 한 벌을 옮겨 심는다. 방 크기에 맞는 견본을 고르고(templates.ts fittingTemplate),
// 붙은 가구 덩이(식탁+의자 등)마다 자리 후보(clusterShifts)를 차례로 넣어 본다 — 조립기 오류가 새로 생기거나, 닿지 못하는
// 바닥이 늘거나, 문 앞 칸·다른 덩이를 덮는 가구는 빠진다. 덩이 안에서는 몸통(가장 큰 가구)부터 넣고 넣은 가구에 붙은 것만 이어 넣어
// 식탁 없는 의자 같은 반쪽 세트를 남기지 않는다(2026-10-09). 몸통이 빠지면 다음으로 큰 가구에서 다시 잇는다.
// 후보 자리 여섯 곳까지 보고 가장 많이 들어간 자리를 쓴다.
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import type { LayoutRoom } from "./layout";
import { clusterShifts, fittingTemplate, itemArea, itemBox as itemBoxOf, roomTemplates, shiftItems, templateClusters, type InteriorStyleVariant, type InteriorTemplateItem } from "./templates";
import type { TilesetDef } from "@/project/types";
import { FACILITY_PROGRAMS } from "./facilityVenues";
/** 탁자에 딸린 앉을 것 — 혼자서는 놓지 않는다(다다미 방석 zabuton 은 좌탁 없이도 단상·차실에 단독 배치 가능). */
const SEAT = /chair|stool|bench|seat|cushion|sofa-single/u;

export interface FurnishResult {
  readonly input: HandInteriorInput;
  /** 방 id → [견본 id, 심은 수, 뺀 수] */
  readonly perRoom: Record<string, { template: string; placed: number; dropped: number }>;
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

/** 문 틈 둘레(지나가는 칸) + 같은 방 안 문↔문·출구 최단 동선 척추(폭 16↑ 방은 2칸 폭) — 가구가 덮으면 안 된다. */
function doorwayCells(composed: ComposedRooms, rooms: readonly LayoutRoom[], byId: Map<string, { w: number; h: number; items: readonly InteriorTemplateItem[] }>, S: HandInteriorSpec): Set<string> {
  const keep = new Set<string>();
  for (const o of composed.openings) {
    if (o.open) continue;   // 칸막이를 통째로 걷은 쌍은 어디로든 지나간다 — 닿는지는 조립기 검사가 본다
    if (o.kind === "h") for (const dy of [-1, 1, 2, 3]) keep.add(`${o.x},${o.y + dy}`);
    else for (const dx of [-1, 1]) keep.add(`${o.x + dx},${o.y}`);
  }
  for (let x = composed.exit.x; x < composed.exit.x + composed.exit.width; x++) for (const dy of [1, 2]) keep.add(`${x},${composed.exit.y - dy}`);
  for (const room of rooms) {
    const t = room.template ? byId.get(room.template) : undefined;
    if (!t || !(room.template!.split(":")[0] && Object.values(FACILITY_PROGRAMS).some((ms) => ms.some((m) => m.map === room.template!.split(":")[0])))) continue;
    const rw = room.x1 - room.x0 + 1;
    const blocked = new Set<string>();
    if (rw === t.w && room.y1 - room.y0 + 1 === t.h) {
      for (const it of t.items) {
        for (const c of footprint({ ...it, x: it.x + room.x0, y: it.y + room.y0 }, S)) blocked.add(c);
      }
    }
    const pts: [number, number][] = [];
    for (const o of composed.openings) {
      if (o.open) continue;
      if (o.kind === "h" && o.x >= room.x0 && o.x <= room.x1) {
        if (o.y === room.y1 + 1) pts.push([o.x, room.y1]);
        else if (o.y === room.y0 - 1) pts.push([o.x, room.y0 + 2]);
      } else if (o.kind === "v" && o.y >= room.y0 + 2 && o.y <= room.y1) {
        if (o.x === room.x1 + 1) pts.push([room.x1, o.y]);
        else if (o.x === room.x0 - 1) pts.push([room.x0, o.y]);
      }
    }
    if (composed.exit.y === room.y1 + 1 && composed.exit.x >= room.x0 && composed.exit.x <= room.x1) {
      pts.push([composed.exit.x, room.y1]);
    }
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const [ax, ay] = pts[i]!, [bx, by] = pts[j]!;
      const findPath = (avoidItems: boolean): Record<string, string> => {
        const q: [number, number][] = [[ax, ay]];
        const prev: Record<string, string> = { [`${ax},${ay}`]: "" };
        while (q.length) {
          const [cx, cy] = q.shift()!;
          if (cx === bx && cy === by) break;
          for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
            const nx = cx + dx, ny = cy + dy, k = `${nx},${ny}`;
            if (nx < room.x0 || nx > room.x1 || ny < room.y0 + 2 || ny > room.y1 || k in prev) continue;
            if (avoidItems && blocked.has(k) && !(nx === bx && ny === by)) continue;
            prev[k] = `${cx},${cy}`;
            q.push([nx, ny]);
          }
        }
        return prev;
      };
      let prev = findPath(true);
      if (!(`${bx},${by}` in prev)) prev = findPath(false);
      let cur = `${bx},${by}`;
      while (cur && cur in prev) {
        const [px, py] = cur.split(",").map(Number) as [number, number];
        keep.add(cur);
        if (rw >= 16) {
          const adj = `${px < room.x1 ? px + 1 : px - 1},${py}`;
          if (!blocked.has(adj)) keep.add(adj);
        }
        cur = prev[cur]!;
      }
    }
  }
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
  const keep = doorwayCells(composed, rooms, byId, S);
  let input = base;
  const first = buildHandInteriorLayers(input, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const perRoom: FurnishResult["perRoom"] = {};
  const isMat = (it: InteriorTemplateItem) => it.t === "l" || (it.t === "o" && /tatami|rug|mat|carpet|lane/u.test(it.id));
  const isFlat = (it: InteriorTemplateItem) => it.t === "l" || (it.t === "o" && S.objects[it.id]?.kind === "flat");
  const cellsOf = (it: InteriorTemplateItem) => (isFlat(it) ? flatCells(it, S) : footprint(it, S)).map((c) => `${isFlat(it) ? (isMat(it) ? "f" : "fc") : "s"}:${c}`);
  for (const room of rooms) {
    const t0 = room.template ? byId.get(room.template) : undefined;
    if (!t0) continue;
    const w = room.x1 - room.x0 + 1, h = room.y1 - room.y0 + 1;
    const t = fittingTemplate(tilesetId, t0, w, h);
    const tabooPlant = /kitchen|lab|cell|bath|garage|factory|temple|platform|pachinko|cook|prep|wash|on-men|on-women|cp-bath|ry-bath|ta-bath/iu.test(room.id) || /temple|pachinko|factory/iu.test(t.building);
    const maxPlants = tabooPlant ? 0 : 1;
    let plantsSeen = 0;
    const tallCols = new Set<number>();
    if (tilesetId === "modern_city") {
      for (const it of t.items) {
        if (it.t === "o" && it.y === 2 && (S.objects[it.id]?.up ?? 0) >= 32) {
          const iw = Math.max(1, S.objects[it.id]?.w ?? 1);
          for (let dx = 0; dx < iw; dx++) tallCols.add(it.x + dx);
        }
      }
    }
    const effectiveItems: InteriorTemplateItem[] = [];
    for (const it of t.items) {
      if (it.t === "o" && it.id === "mci-plant-tall") {
        plantsSeen++;
        if (plantsSeen > maxPlants) continue;
      }
      if (tilesetId === "modern_city" && it.t === "o" && it.y === 0 && S.objects[it.id]?.kind === "hang") {
        const iw = Math.max(1, S.objects[it.id]?.w ?? 1);
        const fits = (px: number) => px >= 0 && px + iw <= t.w && Array.from({ length: iw }, (_, d) => px + d).every((c) => !tallCols.has(c));
        let nx = it.x;
        if (!fits(nx)) {
          for (let d = 1; d < t.w; d++) {
            if (fits(it.x + d)) { nx = it.x + d; break; }
            if (fits(it.x - d)) { nx = it.x - d; break; }
          }
        }
        if (fits(nx)) {
          for (let d = 0; d < iw; d++) tallCols.add(nx + d);
          effectiveItems.push({ ...it, x: nx });
        }
        continue;
      }
      effectiveItems.push(it);
    }
    const te: typeof t = { ...t, items: effectiveItems };
    const inside = (it: InteriorTemplateItem) => {
      const pts = it.t === "l" ? it.cells!.map(([x, y]) => [x, y] as const) : [[it.x, it.y] as const];
      return pts.every(([x, y]) => x >= room.x0 && x <= room.x1 && y >= room.y0 && y <= room.y1);
    };
    let placed = 0, dropped = 0;
    let taken = new Set<string>();
    /** 한 점을 넣어 본다 — 싼 검사(방 안·문 앞·겹침) 뒤 조립기 검사. 되면 반영하고 true. */
    const tryPut = (it: InteriorTemplateItem): boolean => {
      const cells = cellsOf(it);
      if (!inside(it) || footprint(it, S).some((c) => keep.has(c)) || cells.some((c) => taken.has(c))) return false;
      const next = withItems(input, [it]);
      const built = buildHandInteriorLayers(next, tileset, S);
      const e = built.issues.filter((i) => i.severity === "error").length;
      if (e > errors || built.unreachedFloor.length > unreached) return false;
      input = next; errors = e; unreached = built.unreachedFloor.length;
      for (const c of cells) taken.add(c);
      return true;
    };
    const exactFacility = styleVariant === "A" && t.building in FACILITY_PROGRAMS && w === te.w && h === te.h;
    const clusters = templateClusters(te, S).sort((a, b) =>
      Number(b.pinTop) - Number(a.pinTop)
      || (styleVariant === "D" ? a.area - b.area : b.area - a.area)
      || (styleVariant === "B" || styleVariant === "D" ? b.box[0] - a.box[0] : a.box[0] - b.box[0]),
    );
    for (const c of clusters) {
      // 덩이 안 이웃: 견본 좌표에서 붙어 있는 쌍. 몸통(가장 큰 가구)부터 넣고, 넣은 가구에 붙은 것만 이어 넣는다 —
      // 식탁이 안 들어가면 의자도 안 들어간다.
      const nb = new Map<number, number[]>(c.members.map((k) => [k, c.links.filter(([p, q]) => p === k || q === k).map(([p, q]) => (p === k ? q : p))]));
      const primary = [...c.members].sort((p, q) => itemArea(te.items[q]!, S) - itemArea(te.items[p]!, S))[0]!;
      const saved = { input, errors, unreached, taken: new Set(taken) };
      let best: { input: HandInteriorInput; errors: number; unreached: number; taken: Set<string>; n: number } | undefined;
      let tried = 0;
      const shifts = exactFacility ? ([[0, 0]] as [number, number][]) : clusterShifts(te, c, w, h, styleVariant);
      for (const [sx, sy] of shifts) {
        if (tried >= 6) break;
        const items = new Map(c.members.map((k, i) => [k, shiftItems(te, c, sx, sy, room)[i]!]));
        tried++;
        input = saved.input; errors = saved.errors; unreached = saved.unreached; taken = new Set(saved.taken);
        const put = new Set<number>(), moved = new Map<number, [number, number]>();
        const shifted = (it: InteriorTemplateItem, ex: number, ey: number): InteriorTemplateItem =>
          it.t === "l" ? { ...it, cells: it.cells!.map(([x, y]) => [x + ex, y + ey] as [number, number]) } : { ...it, x: it.x + ex, y: it.y + ey };
        /** 제자리에 안 들어가면 1~3칸 비켜 본다(벽 가구는 옆으로만) — 문 앞·다른 가구에 한 칸 걸려 통째로 빠지는 것을 막는다. */
        const seat = (k: number): boolean => {
          const it = items.get(k)!;
          if (tryPut(it)) { put.add(k); return true; }
          if (it.t === "g") return false;
          const wallish = it.t === "o" && ["wall", "hang", "door", "sidedoor"].includes(S.objects[it.id]?.kind ?? "");
          for (const [ex, ey] of [[1, 0], [-1, 0], [2, 0], [-2, 0], [0, 1], [0, -1], [3, 0], [-3, 0], [1, 1], [-1, 1]] as const) {
            if (wallish && ey) continue;
            if (tryPut(shifted(it, ex, ey))) { put.add(k); moved.set(k, [ex, ey]); return true; }
          }
          return false;
        };
        // 몸통에서 못 이은 가구는 따로 다시 잇는다 — 의자·걸상·탁상 물건만은 씨앗이 되지 못한다(식탁 없는 의자를 남기지 않게).
        const seen = new Set<number>();
        const seeds = [primary, ...[...c.members].filter((k) => k !== primary && te.items[k]!.t !== "g" && !SEAT.test(te.items[k]!.id)).sort((p, q) => itemArea(te.items[q]!, S) - itemArea(te.items[p]!, S))];
        for (const seed of seeds) {
          if (seen.has(seed)) continue;
          seen.add(seed);
          if (!seat(seed)) continue;
          const queue = [seed];
          while (queue.length) {
            for (const k of nb.get(queue.shift()!) ?? []) {
              if (seen.has(k) || te.items[k]!.t === "g") continue; seen.add(k);
              if (seat(k)) queue.push(k);
            }
          }
        }
        // 탁상 물건은 받칠 가구가 다 들어간 뒤에 — 받침이 비켜 앉았으면 같이 비킨다
        for (const k of c.members) {
          if (te.items[k]!.t !== "g") continue;
          const g = te.items[k]!;
          const base = (nb.get(k) ?? []).find((q) => put.has(q) && te.items[q]!.t !== "g" && !SEAT.test(te.items[q]!.id) && (() => { const [bx, by, bw, bh] = itemBoxOf(te.items[q]!, S); return g.x >= bx - 1 && g.x <= bx + bw && g.y >= by - 1 && g.y <= by + bh; })());
          if (base === undefined) continue;
          const [ex, ey] = moved.get(base) ?? [0, 0];
          const gShifted = shifted(items.get(k)!, ex, ey);
          if (tryPut(gShifted)) {
            put.add(k);
          } else {
            const [bx, by, bw, bh] = itemBoxOf(te.items[base]!, S);
            for (let dy = 0; dy < bh; dy++) {
              let ok = false;
              for (let dx = 0; dx < bw; dx++) {
                if (tryPut({ ...gShifted, x: bx + dx + sx + ex + room.x0, y: by + dy + sy + ey + room.y0 })) {
                  put.add(k);
                  ok = true;
                  break;
                }
              }
              if (ok) break;
            }
          }
        }
        const n = put.size;
        if (n && (!best || n > best.n)) best = { input, errors, unreached, taken, n };
        if (n === c.members.length) break;
      }
      ({ input, errors, unreached, taken } = best ?? saved);
      placed += best?.n ?? 0; dropped += c.members.length - (best?.n ?? 0);
    }
    perRoom[room.id] = { template: te.id, placed, dropped };
  }
  return { input, perRoom };
}
