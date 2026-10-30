// bbox-chipsets round 2: measure space + variety of a layout / example / finished map (same functions as the validator).
//   bun measure.mts indoor-layout  <tilesetId> <layout.json>  <base dir>
//   bun measure.mts indoor-example <tilesetId> <example.json> <base dir>      (HandInteriorInput: plan, objects, tables, rooms/zones)
//   bun measure.mts outdoor-map    <tilesetId> <project.json | region snapshot.json> <base dir> [mapKey] [x,y,w,h]
// Prints one JSON line: {emptyPct (whole map), rooms[], largest, types (distinct piece kinds), pieces}
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { indoorSpace, outdoorSpace, type Rect } from "./space.mts";
import { effectiveSpec } from "./spec.mts";
import type { HandInteriorSpec } from "../../../src/editor/handInterior/builder";

/** Occupied footprints of a layout's placements (furniture, sized tables, daises). Decals, carpets, wall-mounted, doors and overlays occupy nothing. */
export function footprints(S: HandInteriorSpec, objs: { id: string; x: number; y: number }[], tables: Rect[], daises: Rect[]): Rect[] {
  const out: Rect[] = [...tables, ...daises];
  for (const p of objs) {
    const d = S.objects[p.id] as any;
    if (!d || !["floor", "wall"].includes(d.kind) || !(d.h >= 1)) continue;
    out.push({ x: p.x, y: p.y, w: d.w, h: d.h });
  }
  return out;
}
export function expandLayout(L: any): { id: string; x: number; y: number }[] {
  const out: { id: string; x: number; y: number }[] = [];
  for (const o of [...(L.landmark ? [L.landmark] : []), ...(Array.isArray(L.objects) ? L.objects : [])]) {
    if (typeof o?.id !== "string") continue;
    const n = Math.max(1, o.repeat?.count ?? o.repeat?.n ?? 1), dx = o.repeat?.dx ?? 0, dy = o.repeat?.dy ?? 0;
    for (let i = 0; i < n; i++) out.push({ id: o.id, x: o.x + i * dx, y: o.y + i * dy });
  }
  return out;
}
/** distinct piece kinds: catalog ids, sized pieces by style (table 2x1 and table 3x2 = one kind). Doors/decals/carpets excluded, wall-mounted included. */
export function typesOf(S: HandInteriorSpec | null, ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    const sized = /^([a-z][a-z0-9-]*) (\d+)x(\d+)$/u.exec(id);
    if (S && !S.objects[id] && sized) { set.add(sized[1]!); continue; }
    const d = S?.objects[id] as any;
    if (d && ["door", "sidedoor", "flat"].includes(d.kind)) continue;
    set.add(id);
  }
  return [...set].sort();
}

if (import.meta.main) {
  const [mode, TS, file, baseDir, a5, a6] = process.argv.slice(2);
  const { loadHeadlessProject } = await import("../../../src/headless/index");
  const base = loadHeadlessProject(readFileSync(resolve(baseDir!, "before.json"), "utf8"));
  const t = base.tilesets[TS!]!;
  const J = JSON.parse(readFileSync(file!, "utf8"));
  if (mode === "indoor-layout" || mode === "indoor-example") {
    const S = effectiveSpec(t)!;
    let plan: string[], objs: { id: string; x: number; y: number }[], tables: Rect[], daises: Rect[], rooms: (Rect & { id: string })[], typeIds: string[];
    if (mode === "indoor-layout") {
      const W = J.map.w, H = J.map.h;
      const g = Array.from({ length: H }, () => Array(W).fill("#"));
      for (const r of [...(J.regions ?? []), ...(J.openings ?? [])]) for (let y = r.y; y < r.y + (r.h ?? 1); y++) for (let x = r.x; x < r.x + (r.w ?? 1); x++) if (y >= 0 && x >= 0 && y < H && x < W) g[y]![x] = ".";
      plan = g.map((r) => r.join(""));
      const all = expandLayout(J);
      tables = []; objs = [];
      for (const p of all) { const s = /^([a-z][a-z0-9-]*) (\d+)x(\d+)$/u.exec(p.id); if (!S.objects[p.id] && s) tables.push({ x: p.x, y: p.y, w: +s[2]!, h: +s[3]! }); else objs.push(p); }
      daises = (J.daises ?? []).map((d: any) => ({ x: d.x, y: d.y, w: d.w, h: d.h }));
      rooms = (J.regions ?? []).map((r: any) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h }));
      typeIds = all.map((p) => p.id);
    } else {
      plan = J.plan; objs = J.objects ?? [];
      tables = (J.tables ?? []).map((tb: any) => ({ x: tb.x, y: tb.y, w: tb.w, h: tb.h }));
      daises = (J.daises ?? []).map((d: any) => ({ x: d.x, y: d.y, w: d.w, h: d.h }));
      const rr = J.rooms?.length ? J.rooms.map((r: any) => ({ id: r.room, x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 })) : (J.zones ?? []).map((z: any, i: number) => ({ id: `zone${i}`, ...z }));
      rooms = rr.map((r: any) => ({ id: r.id, x: r.x0, y: r.y0, w: r.x1 - r.x0 + 1, h: r.y1 - r.y0 + 1 }));
      if (!rooms.length) rooms = [{ id: "all", x: 0, y: 0, w: plan[0]!.length, h: plan.length }];
      typeIds = [...objs.map((o) => o.id), ...(J.tables ?? []).map((tb: any) => `${tb.style} ${tb.w}x${tb.h}`), ...(J.goods ?? []).map((g: any) => g.id)];
    }
    const s = indoorSpace(plan, footprints(S, objs, tables, daises), rooms);
    const types = typesOf(S, typeIds);
    console.log(JSON.stringify({ emptyPct: s.total.emptyPct, floor: s.total.floor, largest: s.total.largest, rooms: s.rooms, types: types.length, typeList: types, pieces: typeIds.length }));
  } else {
    const m = J.maps ? (a5 && J.maps[a5] ? J.maps[a5] : J.maps["bbox-room"] ?? Object.values(J.maps)[0]) : J.map;
    const [cx, cy, cw, ch] = (a6 ?? `0,0,${m.width},${m.height}`).split(",").map(Number) as [number, number, number, number];
    const ground = new Set<number>();
    for (const g of (t.tileGroups ?? []) as any[]) if (["terrain", "water", "path", "floor"].includes(g.role)) for (const id of g.tileIds ?? []) ground.add(id);
    for (const g of Object.values(t.autotileGroups ?? {}) as any[]) for (const id of g.memberTileIds ?? []) ground.add(id);
    for (const g of Object.values(t.autotileGroups ?? {}) as any[]) for (const id of Object.values(g.variantMap ?? {}) as number[]) ground.add(id);
    const { passabilityOf } = await import("../../../src/project/collision");
    const at = (x: number, y: number) => (y + cy) * m.width + x + cx;
    const up = (x: number, y: number) => (m.upperTiles?.[at(x, y)] ?? -1);
    const lo = (x: number, y: number) => (m.lowerTiles?.[at(x, y)] ?? -1);
    const drawn = (x: number, y: number) => up(x, y) >= 0 || (lo(x, y) >= 0 && !ground.has(lo(x, y)));
    const walk = (x: number, y: number) => { const q = passabilityOf(t, lo(x, y), -1, up(x, y), -1); return q.up || q.down || q.left || q.right; };
    const s = outdoorSpace(cw, ch, drawn, walk, []);
    // distinct kits: stamped kit ids are not stored on the map; count distinct non-ground tile ids / for runs use the layout instead
    const kinds = new Set<number>(); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { if (up(x, y) >= 0) kinds.add(up(x, y)); else if (drawn(x, y)) kinds.add(lo(x, y)); }
    console.log(JSON.stringify({ emptyPct: s.barePct, bare: s.bare, cells: s.cells, largest: s.largestAny, objectTiles: kinds.size }));
  }
}
