// 버들항 물(2026-11-14) — 게임마다 다른 물빛 · 물가 둑과 깊이 띠(2층 덧그림) · 흐르는 강 모양 · 폭포 · 수련 무리.
// 물 칸의 번호·통행·«물인가» 검사는 그대로이고 그림만 겹친다. 겉모습이 없는 게임(옛 저장본)은 한 화소도 달라지지 않는다.
import { describe, expect, it } from "vitest";
import water from "@/assets/beodeulWater.json";
import sheet from "@/assets/beodeulCitySheet.json";
import { activeTileGrafts } from "@/assets/tileGrafts";
import { tilesetLookGrafts, tilesetLookOptions, tilesetLookTableFor, TILESET_LOOK_PARTS } from "@/assets/tilesetLooks";
import { tilesetWaterTableFor, waterLookPairs, waterOverlaySource } from "@/assets/tilesetWater";
import { bundledChipsetFrameCount, BUNDLED_REFERENCE_CHIPSET_ASSETS } from "@/assets/bundled";
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { createBlankProject } from "@/project/defaults";
import { chooseTilesetLook } from "@/project/tilesetLook";
import { isPassable } from "@/project/collision";
import { layerTileAt } from "@/project/mapLayers";
import { generateCodeTerrain } from "@/editor/tools/beodeulTerrainGen";
import { flowingRiverCells, riverFalls } from "@/editor/tools/beodeulRiverShape";
import { fallBridgeCells, hangBeodeulWaterfalls, layBeodeulWaterSurface, waterDepth } from "@/editor/tools/beodeulWater";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import type { PlaceSpec } from "@/ai/v2/shared/types";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project } from "@/project/types";

const TS = "beodeul_city";
const looks = tilesetLookTableFor(TS)!;
const table = tilesetWaterTableFor(TS)!;
const GAMES = Array.from({ length: 200 }, (_, n) => JSON.stringify(["project", `water-${n}`]));

function village(key: string | undefined, hints: Record<string, unknown> = {}, salt = 4242): { project: Project; map: GameMap } {
  const project = createBlankProject() as Project;
  const ctx = { project, currentMapId: project.startMapId, assistantRun: true, ...(key ? { lookKey: key } : {}) } as ToolContext;
  const spec = { type: "village", name: "버들 마을", salt, variety: `${key}|강가에 작은 마을을 만들어 줘`, ...(Object.keys(hints).length ? { hints } : {}) } as PlaceSpec;
  const res = builderFor(spec)!.build(createBuildRun(ctx), spec);
  expect(res.ok).toBe(true);
  return { project: ctx.project, map: ctx.project.maps[res.mapIds[0]!]! };
}
const canal = (project: Project) => new Set(project.tilesets[TS]!.autotileGroups!.find((g) => g.id === "beodeul_canal_lake_47")!.memberTileIds);
const sourceOf = (project: Project) => new Map((project.tilesets[TS]!.tileGrafts ?? []).filter((g) => g.sourceChipset === table.texture).map((g) => [g.targetTile, g.sourceTile] as const));

describe("버들항 물 그림판", () => {
  it("표: 그림판 칸은 시트 안이고, 물빛은 넷 이상이며 물 칸마다 다시 칠한 칸이 있다", () => {
    expect(water.tilesetId).toBe(TS);
    expect(bundledChipsetFrameCount(table.texture)).toBe(table.count);
    expect(bundledChipsetTilesPerRow(table.texture)).toBe(table.tilesPerRow);
    expect(BUNDLED_REFERENCE_CHIPSET_ASSETS.some((asset) => asset.textureKey === table.texture)).toBe(true);
    const inSheet = (cell: number) => cell === -1 || (cell > 0 && cell < table.count);
    expect(table.shore).toHaveLength(256);
    expect(table.shore.every(inSheet)).toBe(true);
    expect(table.shore[255]).toBe(-1); // 둘레가 모두 물인 칸에는 둑이 없다
    expect(table.deep).toHaveLength(3);
    for (const band of table.deep) { expect(band).toHaveLength(256); expect(band.every(inSheet)).toBe(true); }
    for (const full of table.deepFull) expect(full.length).toBeGreaterThanOrEqual(4);
    for (const part of [table.fall.top, table.fall.body, table.fall.foot]) { expect(part).toHaveLength(4); for (const first of part) expect(first + table.fall.frames).toBeLessThanOrEqual(table.count); }
    expect(Object.keys(table.looks).length).toBeGreaterThanOrEqual(3);
    expect(table.cells).toHaveLength(table.targets.length);
    expect(new Set(table.targets).size).toBe(table.targets.length);
    for (const tile of table.targets) expect(tile).toBeLessThan(sheet.count);
    // 자연 물의 몸통 칸과 그 물결 프레임 여덟 장이 모두 물빛 대상이다
    const body = createBlankProject().tilesets[TS]!.autotileGroups!.find((g) => g.id === "beodeul_canal_lake_47")!.variantMap["255"]!;
    for (let frame = 0; frame < 8; frame += 1) expect(table.targets).toContain(body + frame);
    for (const look of Object.values(table.looks)) {
      for (const base of [look.base, ...Object.values(look.grounds), ...Object.values(look.surfaces)]) expect(base).toBeGreaterThan(0);
      expect(Object.keys(look.grounds).sort()).toEqual(Object.keys(looks.grounds).sort());
    }
    // 바닥 겉모습마다 둑 한 벌
    for (const ground of Object.keys(looks.grounds)) expect(table.shoreGrounds[ground]!.length).toBeGreaterThan(0);
  });

  it("덧그림 칸은 모두 ★(통행 + 상위) — 2층에 얹어도 물 위를 걷게 되지 않는다", () => {
    const source = waterOverlaySource(table);
    expect(source.count).toBe(table.count);
    expect(source.priority.every((p) => p === "upper")).toBe(true);
    expect(source.passability.every((p) => p.up && p.down && p.left && p.right)).toBe(true);
    expect(source.tileMeta![table.shore[0]!]!.label).toBe("물가 둑");
  });

  it("고르기: 물빛 갈래에는 «원래 그림» 이 없다 — 겉모습을 받는 새 게임은 늘 물빛 하나를 받고, 모든 물빛이 나온다", () => {
    expect(TILESET_LOOK_PARTS).toContain("water");
    expect(tilesetLookOptions(looks, "water")).toEqual(Object.keys(table.looks));
    const picks = GAMES.map((key) => chooseTilesetLook(looks, key));
    expect(GAMES.map((key) => chooseTilesetLook(looks, key))).toEqual(picks);
    for (const look of picks) { expect(table.looks[look!.water!]).toBeDefined(); expect(look!.waterKey).toBe(table.texture); }
    expect(new Set(picks.map((look) => look!.water)).size).toBe(Object.keys(table.looks).length);
  });

  it("그리기: 물빛은 물 칸마다 그림 하나를 겹치고, 바닥·길 겉모습과 함께 실린 칸은 그 겉모습 위에 칠한 칸을 쓴다", () => {
    const tileset = createBlankProject().tilesets[TS]!;
    expect(tilesetLookGrafts({ ...tileset, look: { textureKey: looks.texture, woods: "wall" } })).toEqual([]);
    const only = activeTileGrafts({ ...tileset, look: { textureKey: looks.texture, water: "clear", waterKey: table.texture } });
    const byTarget = new Map(only.map((g) => [g.targetTile, g] as const));
    for (const tile of table.targets) expect(byTarget.get(tile)?.sourceChipset).toBe(table.texture);
    expect(only.filter((g) => g.sourceChipset === table.texture)).toHaveLength(table.targets.length);
    const surface = Object.entries(looks.parts.surface.options).find(([, option]) => option.ground)!;
    const both = activeTileGrafts({ ...tileset, look: { textureKey: looks.texture, surface: surface[0], water: "clear", waterKey: table.texture } });
    const bothBy = new Map(both.map((g) => [g.targetTile, g] as const));
    const mixed = table.mixed.ground[0]!;
    expect(bothBy.get(mixed)!.sourceChipset).toBe(table.texture);
    expect(bothBy.get(mixed)!.sourceTile).toBe(table.looks.clear!.grounds[surface[1].ground!]! + 0);
    expect(waterLookPairs(table, undefined, undefined, undefined)).toEqual([]);
    expect(waterLookPairs(table, "clear", undefined, undefined)).toHaveLength(table.targets.length);
  });
});

describe("버들항 물 — 시공", () => {
  it("깊이: 뭍에서의 거리로 띠를 나누고, 물가 칸에는 둑·그 안쪽에는 깊이 띠를 2층에 깐다(1층·통행은 그대로)", () => {
    const W = 24, H = 20;
    const wet = (c: number) => { const x = c % W, y = Math.floor(c / W); return x >= 3 && x <= 20 && y >= 3 && y <= 16; };
    const depth = waterDepth(W, H, wet);
    expect(depth[0]).toBe(0);
    expect(depth[3 * W + 3]).toBe(3);
    expect(depth[10 * W + 12]).toBeGreaterThanOrEqual(21);
    const project = createBlankProject() as Project, tileset = project.tilesets[TS]!;
    const body = tileset.autotileGroups!.find((g) => g.id === "beodeul_canal_lake_47")!.variantMap["255"]!;
    const map = { ...project.maps[project.startMapId]!, width: W, height: H, lowerTiles: Array.from({ length: W * H }, (_, c) => (wet(c) ? body : 737)), upperTiles: Array(W * H).fill(-1) } as GameMap;
    delete map.lowerOverlayTiles; delete map.upperOverlayTiles; delete map.relief;
    project.maps[map.id] = map;
    const before = map.lowerTiles.slice();
    const laid = layBeodeulWaterSurface(map, tileset, { seed: 7, wet, open: wet });
    expect(map.lowerTiles).toEqual(before);
    expect(laid.shore).toBeGreaterThan(40);
    expect(laid.bands.every((n) => n > 0)).toBe(true); // 넓은 못에는 띠 셋이 다 선다
    for (let c = 0; c < W * H; c += 1) {
      if (!wet(c)) { expect(layerTileAt(map, 2, c)).toBe(-1); continue; }
      expect(layerTileAt(map, 2, c)).toBeGreaterThanOrEqual(0); // 물 칸마다 둑이거나 깊이 띠
      expect(isPassable(project, map, c % W, Math.floor(c / W))).toBe(false);
    }
  });

  it("강 모양: 굽이에서 넓어지고(소) 곧은 데서 좁아진다 — 폭이 한 가지가 아니고, 물길은 끊기지 않는다", () => {
    for (const seed of [3, 7, 11, 23]) {
      const t = generateCodeTerrain({ W: 44, H: 44, seed, water: "river", character: "hill", tiers: 1 });
      expect(t.river.length).toBeGreaterThan(20);
      for (const c of t.river) expect(t.water[c]).toBe(1);
      const widths = new Set<number>();
      for (let y = 0; y < t.H; y += 1) { let n = 0; for (let x = 0; x < t.W; x += 1) if (t.water[y * t.W + x] === 1) n += 1; if (n) widths.add(n); }
      for (let x = 0; x < t.W; x += 1) { let n = 0; for (let y = 0; y < t.H; y += 1) if (t.water[y * t.W + x] === 1) n += 1; if (n) widths.add(n); }
      expect(widths.size).toBeGreaterThanOrEqual(3);
      // 강 칸은 한 덩이다
      const seen = new Set<number>([t.river[0]!]), queue = [t.river[0]!];
      for (let i = 0; i < queue.length; i += 1) { const c = queue[i]!, x = c % t.W, y = Math.floor(c / t.W);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= t.W || ny >= t.H) continue; const n = ny * t.W + nx; if (t.water[n] === 1 && !seen.has(n)) { seen.add(n); queue.push(n); } } }
      expect(seen.size).toBe(t.water.reduce((n, v) => n + (v === 1 ? 1 : 0), 0));
      for (const p of t.pools) expect(t.water[p]).toBeGreaterThan(0);
    }
    const line = Array.from({ length: 30 }, (_, i) => i * 40 + 20);
    const straight = flowingRiverCells(line, 40, 30, 5);
    expect(straight.pools).toHaveLength(1); // 곧은 강에도 소 하나
    for (const c of straight.line) expect(straight.cells.has(c)).toBe(true);
  });

  it("폭포: 강은 단을 따라 내려오고, 단이 내려가는 자리는 남쪽으로 떨어지는 좁은 줄이다 — 그 줄 옆의 강은 위아래로 같은 단", () => {
    let withFalls = 0;
    for (const seed of [7, 11, 23, 31, 41, 53]) {
      const t = generateCodeTerrain({ W: 44, H: 44, seed, water: "river", character: "terraces", tiers: 2, high: "north" });
      const falls = riverFalls(t.levels, t.water, t.W, t.H);
      expect(t.falls.length).toBeLessThanOrEqual(falls.length);
      for (const f of t.falls) {
        withFalls += 1;
        expect(f.x1 - f.x0).toBeLessThanOrEqual(6);
        expect(f.drop).toBeGreaterThan(0);
        for (let x = f.x0; x <= f.x1; x += 1) { expect(t.water[f.y * t.W + x]).toBe(1); expect(t.water[(f.y + 1) * t.W + x]).toBe(1); }
      }
      // 강 칸끼리 동서로는 단이 같다(옆으로 떨어지는 폭포는 그릴 수 없다)
      for (let y = 0; y < t.H; y += 1) for (let x = 0; x + 1 < t.W; x += 1) { const a = y * t.W + x; if (t.water[a] === 1 && t.water[a + 1] === 1) expect(t.levels[a]).toBe(t.levels[a + 1]); }
    }
    expect(withFalls).toBeGreaterThan(0);
  });

  it("폭포는 세 칸~다섯 칸 폭이고, 두 단 비탈의 강은 폭포 둘로 내려오며, 강이 단을 평평하게 가르는 골짜기는 없다", () => {
    let twice = 0, gorges = 0, hidden = 0, cells = 0;
    for (const high of ["north", "west", "east"] as const) for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const t = generateCodeTerrain({ W: 44, H: 44, seed, water: "river", character: "slope", tiers: 2, high });
      if (/골짜기로 내려온 단/u.test(t.note)) gorges += 1;
      if (t.falls.length >= 2) twice += 1;
      for (const f of t.falls) { expect(f.x1 - f.x0 + 1).toBeGreaterThanOrEqual(3); expect(f.x1 - f.x0 + 1).toBeLessThanOrEqual(5); }
      // 강은 남쪽 높은 땅 밑에 숨지 않는다(3/4 시점에서 한 단 높은 땅은 두 칸 위로 올라가 그려진다)
      for (let c = 0; c < t.W * t.H; c += 1) {
        if (t.water[c] !== 1) continue; cells += 1;
        for (let k = 1; k <= 4; k += 1) { const m = c + k * t.W; if (m >= t.W * t.H || t.water[m]) break; if (t.levels[m]! - t.levels[c]! >= k) { hidden += 1; break; } }
      }
    }
    expect(gorges).toBe(0);
    expect(twice).toBeGreaterThanOrEqual(5);
    expect(hidden).toBeLessThanOrEqual(cells * 0.002);
  });

  it("폭포 곁 다리: 폭포 서너 줄 아래 곧은 두 줄을 건너고, 길이 이미 그 곁에서 건너면 놓지 않는다", () => {
    const W = 12, H = 16, wet = (c: number) => { const x = c % W; return x >= 4 && x <= 6; };
    const input = { W, H, falls: [{ x0: 4, x1: 6, y: 5 }], wet, free: (c: number) => !wet(c), level: (c: number) => (Math.floor(c / W) <= 5 ? 2 : 0) };
    const cells = fallBridgeCells({ ...input, crossing: () => false });
    expect(cells.map((c) => `${c % W},${Math.floor(c / W)}`)).toEqual(["4,8", "5,8", "6,8", "4,9", "5,9", "6,9"]);
    expect(fallBridgeCells({ ...input, crossing: (c) => c === 9 * W + 5 })).toEqual([]);
  });

  it("폭포 그림: 절벽면에 움직이는 폭포 칸을 걸고 물마루·용소를 얹는다 — 프레임 띠가 타일셋에 등록된다", () => {
    const project = createBlankProject() as Project, tileset = project.tilesets[TS]!;
    const body = tileset.autotileGroups!.find((g) => g.id === "beodeul_canal_lake_47")!.variantMap["255"]!;
    const W = 12, H = 12, wet = (c: number) => { const x = c % W; return x >= 4 && x <= 6; };
    const map = { ...project.maps[project.startMapId]!, width: W, height: H, lowerTiles: Array.from({ length: W * H }, (_, c) => (wet(c) ? body : 737)), upperTiles: Array(W * H).fill(-1),
      relief: { width: W, height: H, levels: Array.from({ length: W * H }, (_, c) => (Math.floor(c / W) < 6 ? 2 : 0)) } } as GameMap;
    delete map.lowerOverlayTiles; delete map.upperOverlayTiles;
    const strips = tileset.animationStrips?.length ?? 0;
    expect(hangBeodeulWaterfalls(map, tileset, wet)).toBe(1);
    const decor = map.relief!.wallDecor!;
    expect(decor).toHaveLength(3 * 2); // 세 칸 폭 × 두 줄
    expect(new Set(decor.map((d) => d.y))).toEqual(new Set([5]));
    expect(tileset.animationStrips!.length).toBeGreaterThan(strips);
    for (const d of decor) expect(tileset.animationStrips!.some((s) => s.baseTile === d.tile && s.frames === table.fall.frames)).toBe(true);
    expect(layerTileAt(map, 4, 5 * W + 5)).toBeGreaterThanOrEqual(0); // 물마루
    expect(layerTileAt(map, 4, 6 * W + 5)).toBeGreaterThanOrEqual(0); // 용소
    expect(hangBeodeulWaterfalls({ ...map, relief: undefined } as GameMap, tileset, wet)).toBe(0);
  });

  it("마을: 겉모습을 받은 게임의 강가 마을은 물빛·둑·깊이 띠를 쓰고, 물 칸은 그대로 물이며 걷지 못한다", () => {
    const key = GAMES[3]!;
    const { project, map } = village(key);
    const look = project.tilesets[TS]!.look!;
    expect(table.looks[look.water!]).toBeDefined();
    const members = canal(project), from = sourceOf(project);
    const shore = new Set([...table.shore, ...Object.values(table.shoreGrounds).flat()]), deep = new Set([...table.deep.flat(), ...table.deepFull.flat()]);
    let waterCells = 0, shoreCells = 0, deepCells = 0;
    for (let c = 0; c < map.width * map.height; c += 1) {
      if (!members.has(map.lowerTiles[c]!) || layerTileAt(map, 3, c) >= 0) continue;
      waterCells += 1;
      expect(isPassable(project, map, c % map.width, Math.floor(c / map.width))).toBe(false);
      const source = from.get(layerTileAt(map, 2, c));
      if (source !== undefined && shore.has(source)) shoreCells += 1;
      if (source !== undefined && deep.has(source)) deepCells += 1;
    }
    expect(waterCells).toBeGreaterThan(30);
    expect(shoreCells).toBeGreaterThan(20);
    expect(deepCells).toBeGreaterThan(0);
  });

  it("겉모습이 없는 게임(열쇠 없음)은 물빛을 받지 않는다 — 타일셋에 look 이 적히지 않는다", () => {
    const { project } = village(undefined);
    expect(project.tilesets[TS]!.look).toBeUndefined();
    expect(tilesetLookGrafts(project.tilesets[TS]!)).toEqual([]);
  });
});
