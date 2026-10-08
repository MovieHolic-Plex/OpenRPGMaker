// 배치한 방마다 방 견본의 가구 한 벌을 옮겨 심는다(templates.ts placeTemplateItems) — 한 점씩 넣어 보며
// 조립기 오류가 새로 생기거나, 닿지 못하는 바닥이 늘거나, 문 앞 칸을 덮으면 그 가구만 뺀다.
import { buildHandInteriorLayers, type HandInteriorInput, type HandInteriorSpec } from "./builder";
import type { ComposedRooms } from "./rooms";
import type { LayoutRoom } from "./layout";
import { placeTemplateItems, roomTemplates, type InteriorTemplateItem } from "./templates";
import type { TilesetDef } from "@/project/types";

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

/** 문 틈 둘레(지나가는 칸) — 가구가 덮으면 안 된다. */
function doorwayCells(composed: ComposedRooms): Set<string> {
  const keep = new Set<string>();
  for (const o of composed.openings) {
    if (o.kind === "h") for (const dy of [-1, 1, 2, 3]) keep.add(`${o.x},${o.y + dy}`);
    else for (const dx of [-1, 1]) keep.add(`${o.x + dx},${o.y}`);
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

export function furnishRooms(base: HandInteriorInput, rooms: readonly LayoutRoom[], composed: ComposedRooms, tilesetId: string, tileset: TilesetDef, S: HandInteriorSpec): FurnishResult {
  const byId = new Map(roomTemplates(tilesetId).map((t) => [t.id, t]));
  const keep = doorwayCells(composed);
  let input = base;
  const first = buildHandInteriorLayers(input, tileset, S);
  let errors = first.issues.filter((i) => i.severity === "error").length, unreached = first.unreachedFloor.length;
  const perRoom: FurnishResult["perRoom"] = {};
  for (const room of rooms) {
    const t = room.template ? byId.get(room.template) : undefined;
    if (!t) continue;
    const items = placeTemplateItems(t, { x0: room.x0, y0: room.y0, w: room.x1 - room.x0 + 1, h: room.y1 - room.y0 + 1 }, S);
    let placed = 0, dropped = 0;
    const taken = new Set<string>();
    for (const it of items) {
      const cells = it.t === "o" && S.objects[it.id]?.kind === "flat" || it.t === "l" ? flatCells(it, S) : footprint(it, S);
      if (footprint(it, S).some((c) => keep.has(c)) || cells.some((c) => taken.has(`${it.t === "l" || S.objects[it.id]?.kind === "flat" ? "f" : "s"}:${c}`))) { dropped++; continue; }
      const next = withItems(input, [it]);
      const built = buildHandInteriorLayers(next, tileset, S);
      const e = built.issues.filter((i) => i.severity === "error").length;
      if (e > errors || built.unreachedFloor.length > unreached) { dropped++; continue; }
      input = next; errors = e; unreached = built.unreachedFloor.length; placed++;
      for (const c of cells) taken.add(`${it.t === "l" || S.objects[it.id]?.kind === "flat" ? "f" : "s"}:${c}`);
    }
    perRoom[room.id] = { template: t.id, placed, dropped };
  }
  return { input, perRoom };
}
