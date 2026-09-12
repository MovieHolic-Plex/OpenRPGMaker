import { describe, expect, it } from "vitest";
import { planOrganicVillageLake, paintOrganicVillageLake } from "@/editor/tools/village/organicLake";
import { boulevardCells, villageBoulevard } from "@/editor/tools/village/roads";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { createBlankMap } from "@/project/defaults/defaultMaps";
import { TILE } from "@/project/defaults/constants";
import { isLakeAutotileTile, lakeAutotileQuarterSources } from "@/project/defaults/lakeAutotile";
import { deserialize, serialize } from "@/project/io";
import { spatialFixture } from "./support/spatialSchemaFixture";

const pointKey = (p: { x: number; y: number }) => `${p.x},${p.y}`;
function fixture() {
  const project = createBlankProject(), map = createBlankMap("Lake contract", 100, 100);
  project.maps[map.id] = map;
  const plan = planOrganicVillageLake({ x: 0, y: 0, w: 100, h: 100 }, 71);
  const last = plan.cells.at(-1)!, index = last.y * map.width + last.x;
  return { project, map, plan, last, index };
}

describe("organic village lake planning", () => {
  it.each([80, 90, 100])("keeps %i maps at 3.5–8% water with one elongated body, broad bays and no holes", size => {
    for (let seed = 0; seed < 32; seed++) {
      const plan = planOrganicVillageLake({ x: 0, y: 0, w: size, h: size }, seed), b = plan.bounds;
      expect(plan.cells.length / (size * size)).toBeGreaterThanOrEqual(0.035);
      expect(plan.cells.length / (size * size)).toBeLessThanOrEqual(0.08);
      expect(b.w / b.h).toBeGreaterThan(2);
      expect(b.x + b.w / 2).toBeGreaterThan(size * 0.60);
      expect(b.y).toBeGreaterThan(size * 0.65);
      expect(b.x + b.w).toBeLessThan(size - 2);
      expect(b.y + b.h).toBeLessThan(size - 2);
      const set = new Set(plan.cells.map(pointKey));
      const seen = new Set<string>(), queue = [plan.cells[0]!];
      while (queue.length) {
        const p = queue.pop()!, key = pointKey(p);
        if (seen.has(key) || !set.has(key)) continue;
        seen.add(key);
        queue.push({ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 });
      }
      expect(seen.size).toBe(plan.cells.length);
      const north: number[] = [], south: number[] = [];
      for (let x = b.x; x < b.x + b.w; x++) {
        const column = plan.cells.filter(p => p.x === x).map(p => p.y);
        const top = Math.min(...column), bottom = Math.max(...column);
        // A solid vertical slice cannot enclose a stray dry island.
        expect(column.length).toBe(bottom - top + 1);
        expect(column.length).toBeGreaterThanOrEqual(2);
        north.push(top); south.push(bottom);
      }
      const middleBay = Math.max(...north.slice(Math.floor(b.w * 0.40), Math.floor(b.w * 0.62)));
      expect(middleBay - Math.min(...north.slice(0, Math.floor(b.w * 0.35)))).toBeGreaterThanOrEqual(3);
      expect(middleBay - Math.min(...north.slice(Math.floor(b.w * 0.65)))).toBeGreaterThanOrEqual(3);
      // A few broad curves, rather than independent one-cell shoreline jitter.
      for (const bank of [north, south]) {
        const directions = bank.slice(1).map((v, i) => Math.sign(v - bank[i]!)).filter(Boolean);
        const turns = directions.slice(1).filter((d, i) => d !== directions[i]).length;
        expect(turns).toBeLessThanOrEqual(4);
      }
      const reflectedOverlap = plan.cells.filter(p => set.has(pointKey({ x: p.x, y: 2 * b.y + b.h - 1 - p.y }))).length;
      expect(reflectedOverlap / plan.cells.length).toBeLessThan(0.90);
    }
  });

  it("is deterministic, seed-sensitive and translation invariant", () => {
    const area = { x: 0, y: 0, w: 90, h: 80 }, plan = planOrganicVillageLake(area, 7);
    expect(planOrganicVillageLake(area, 7)).toEqual(plan);
    expect(planOrganicVillageLake(area, 8)).not.toEqual(plan);
    const moved = planOrganicVillageLake({ ...area, x: 11, y: 23 }, 7);
    expect(moved.cells).toEqual(plan.cells.map(p => ({ x: p.x + 11, y: p.y + 23 })));
    expect(moved.bounds).toEqual({ ...plan.bounds, x: plan.bounds.x + 11, y: plan.bounds.y + 23 });
  });

  it.each([16, 20, 32])("keeps the minimum %i map connected and horizontally elongated", size => {
    const project = createBlankProject();
    for (let seed = 0; seed < 32; seed++) {
      const map = createBlankMap("Small lake contract", size, size);
      project.maps[map.id] = map;
      const plan = planOrganicVillageLake({ x: 0, y: 0, w: size, h: size }, seed);
      expect(plan.bounds.w / plan.bounds.h).toBeGreaterThanOrEqual(1.8);
      expect(plan.cells.every(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size)).toBe(true);
      // The independent painter validates tight bounds, uniqueness and four-way connectivity.
      expect(paintOrganicVillageLake(project, map, plan)).toBe(plan.cells.length);
    }
  });

  it.each([[80, 33], [88, 37]])("keeps the actual %i×80 compact request thin and curved beside its seeded boulevard and market", (width, plazaX) => {
    const area = { x: 0, y: 0, w: width, h: 80 }, seed = 20260913;
    const plaza = { rect: { x: plazaX, y: 35, w: 16, h: 10 }, centerX: plazaX + 8, centerRow: 40 };
    const avoid = new Set(boulevardCells(area, villageBoulevard(area, plaza)!, seed).map(p => p.y * area.w + p.x));
    for (let y = plaza.rect.y - 1; y <= plaza.rect.y + plaza.rect.h; y++) {
      for (let x = plaza.rect.x - 1; x <= plaza.rect.x + plaza.rect.w; x++) avoid.add(y * area.w + x);
    }
    const before = [...avoid], plan = planOrganicVillageLake(area, seed, { avoid, mapWidth: area.w }), b = plan.bounds;
    expect(plan.cells.every(p => !avoid.has(p.y * area.w + p.x))).toBe(true);
    expect([...avoid]).toEqual(before);
    expect(plan.cells.length / (area.w * area.h)).toBeGreaterThanOrEqual(0.035);
    expect(plan.cells.length / (area.w * area.h)).toBeLessThanOrEqual(0.08);
    expect(b.w / b.h).toBeGreaterThanOrEqual(2);
    const north = Array.from({ length: b.w }, (_, dx) => Math.min(...plan.cells.filter(p => p.x === b.x + dx).map(p => p.y)));
    const bay = Math.max(...north.slice(Math.floor(b.w * 0.40), Math.floor(b.w * 0.62)));
    expect(bay - Math.min(...north.slice(0, Math.floor(b.w * 0.35)))).toBeGreaterThanOrEqual(3);
    expect(bay - Math.min(...north.slice(Math.floor(b.w * 0.65)))).toBeGreaterThanOrEqual(3);
    const { project } = fixture(), map = createBlankMap("Actual compact lake reservation", area.w, area.h);
    project.maps[map.id] = map;
    for (const i of avoid) map.lowerTiles[i] = 421;
    expect(paintOrganicVillageLake(project, map, plan)).toBe(plan.cells.length);
    expect([...avoid].every(i => map.lowerTiles[i] === 421)).toBe(true);
  });

  it.each([52, 53])("retains whole-village water area southeast of a boulevard reaching column %i", roadRight => {
    const area = { x: 7, y: 11, w: 80, h: 80 }, mapWidth = 104, avoid = new Set<number>();
    for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
      // Includes the curve envelope, rather than pretending the road is one cell wide.
      if ((x >= area.x + 48 && x <= area.x + roadRight) || (y >= area.y + 45 && y <= area.y + 49)) avoid.add(y * mapWidth + x);
    }
    for (let seed = 0; seed < 24; seed++) {
      const plan = planOrganicVillageLake(area, seed, { avoid, mapWidth });
      expect(plan.cells.every(p => !avoid.has(p.y * mapWidth + p.x))).toBe(true);
      expect(plan.cells.length).toBeGreaterThanOrEqual(224);
      expect(plan.cells.length).toBeLessThanOrEqual(512);
      expect(plan.bounds.x).toBeGreaterThan(area.x + roadRight);
      expect(plan.bounds.y).toBeGreaterThan(area.y + 49);
      expect(plan.bounds.w / plan.bounds.h).toBeGreaterThanOrEqual(1.8);
      const { project } = fixture(), map = createBlankMap("Offset reservation", mapWidth, 104);
      project.maps[map.id] = map;
      // Painter independently rejects a disconnected plan, proving the fallback was not clipped.
      expect(paintOrganicVillageLake(project, map, plan)).toBe(plan.cells.length);
      const quarterKinds = new Set(plan.cells.flatMap(p => lakeAutotileQuarterSources(map, p.x, p.y).map(q => q.tile)));
      expect(quarterKinds.has(90)).toBe(true);
    }
  });

  it("rejects an impossible avoidance mask and a missing map stride without weakening the mask", () => {
    const area = { x: 0, y: 0, w: 80, h: 80 }, avoid = new Set(Array.from({ length: 6400 }, (_, i) => i));
    expect(() => planOrganicVillageLake(area, 71, { avoid, mapWidth: 80 })).toThrow(/우하단에 길을 피하면서/);
    expect(() => planOrganicVillageLake(area, 71, { avoid })).toThrow(/mapWidth/);
    expect(avoid.size).toBe(6400);
  });
});

describe("organic lake atomic painter", () => {
  it("writes exactly reserved lower cells using real lake quarters and preserves every other field through IO", () => {
    const { project, map, plan } = fixture(), reserved = new Set(plan.cells.map(pointKey));
    map.lowerTiles[0] = 421; map.upperTiles[0] = 327;
    const before = structuredClone(project);
    expect(paintOrganicVillageLake(project, map, plan)).toBe(plan.cells.length);
    const quarterTiles = new Set<number>();
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      expect(isLakeAutotileTile(map.lowerTiles[i]!)).toBe(reserved.has(`${x},${y}`));
      if (reserved.has(`${x},${y}`)) {
        for (const part of lakeAutotileQuarterSources(map, x, y, project.tilesets[map.tilesetId])) quarterTiles.add(part.tile);
      } else expect(map.lowerTiles[i]).toBe(before.maps[map.id]!.lowerTiles[i]);
    }
    expect([...quarterTiles].sort((a, b) => a - b)).toEqual([0, 30, 60, 90, 120]);
    const expected = structuredClone(before);
    expected.maps[map.id]!.lowerTiles = [...map.lowerTiles];
    expect(project).toEqual(expected);
    expect(deserialize(serialize(project)).maps[map.id]!.lowerTiles).toEqual(map.lowerTiles);
  });

  it.each(["road", "trunk", "canopy", "lower stack", "upper stack", "house", "event", "start", "transfer"])("rejects a final-cell %s conflict without a partial lake", kind => {
    const { project, map, plan, last, index } = fixture();
    if (kind === "road") map.lowerTiles[index] = 421;
    if (kind === "trunk") map.lowerTiles[index] = 290;
    if (kind === "canopy") map.upperTiles[index] = 260;
    if (kind === "lower stack") map.lowerTileStacks = { [index]: [TILE.GRASS, 177] };
    if (kind === "upper stack") map.upperTileStacks = { [index]: [327] };
    if (kind === "house") map.layoutPlan = { version: 1, kind: "houses", regions: [{ id: "sealed", role: "house", ...last, w: 1, h: 1 }] };
    if (kind === "event") map.events.push({ id: "event", ...last, trigger: { kind: "action" }, commands: [] });
    if (kind === "start") { project.startMapId = map.id; project.startPos = { ...last }; }
    if (kind === "transfer") project.commonEvents.push({ id: "arrival", name: "Arrival", trigger: "none",
      commands: [{ kind: "loop", body: [{ kind: "transfer", mapId: map.id, ...last }] }] });
    const before = JSON.stringify(project);
    expect(() => paintOrganicVillageLake(project, map, plan)).toThrow(/호수 예약 칸/);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("protects a canonical owned region even when its accepted raster is empty grass", () => {
    const { project, map, plan, last } = fixture(), spatial = spatialFixture(), { document } = spatial;
    project.tilesets = spatial.project.tilesets;
    const owner = document.occurrences["occ-a"];
    project.spatialAuthoring = deserialize(JSON.stringify({ ...project, spatialAuthoring: { ...document, occurrences: {
      ...document.occurrences, "occ-a": { ...owner, bindings: [{ mapId: map.id, rect: { ...last, width: 1, height: 1 },
        eventIds: [], connectionIds: [], ports: [], contentDigest: "a".repeat(64) }] },
    } } })).spatialAuthoring;
    const before = JSON.stringify(project);
    expect(() => paintOrganicVillageLake(project, map, plan)).toThrow(/공간 저작 영역/);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("protects a non-anchor body cell on a later event page", () => {
    const { project, map, plan, last } = fixture();
    map.events.push({ id: "large-event", x: last.x, y: last.y + 1, trigger: { kind: "action" }, commands: [], pages: [
      { id: "small", name: "Small", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
      { id: "large", name: "Large", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
        footprint: { width: 1, height: 2 }, movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] },
    ] });
    const before = JSON.stringify(project);
    expect(() => paintOrganicVillageLake(project, map, plan)).toThrow(/이벤트/);
    expect(JSON.stringify(project)).toBe(before);
  });

  it("rejects clipping, duplicate cells, disconnected water and mismatched reservation bounds atomically", () => {
    const { project, map, plan } = fixture(), before = JSON.stringify(project);
    const invalid = [
      { ...plan, cells: [...plan.cells, plan.cells[0]!] },
      { ...plan, bounds: { ...plan.bounds, w: plan.bounds.w + 1 } },
      { bounds: { x: 99, y: 99, w: 2, h: 1 }, cells: [{ x: 99, y: 99 }, { x: 100, y: 99 }] },
      { bounds: { x: 2, y: 2, w: 3, h: 1 }, cells: [{ x: 2, y: 2 }, { x: 4, y: 2 }] },
    ];
    for (const candidate of invalid) {
      expect(() => paintOrganicVillageLake(project, map, candidate)).toThrow(/호수 예약은/);
      expect(JSON.stringify(project)).toBe(before);
    }
  });

  it("refuses a foreign atlas that happens to reuse Town tile IDs", () => {
    const { project, map, plan } = fixture();
    project.tilesets[map.tilesetId]!.image = { type: "bundled", id: "foreign-atlas" };
    const before = JSON.stringify(project);
    expect(() => paintOrganicVillageLake(project, map, plan)).toThrow(/합본 마을 칩셋/);
    expect(JSON.stringify(project)).toBe(before);
  });
});
