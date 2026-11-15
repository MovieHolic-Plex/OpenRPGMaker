// 절벽 습관(게임 겉모습 cliff — 단 높이 1·2·3칸, 절벽 줄 굽이): 지형 생성기와 마을 시공기.
// 습관이 없으면(옛 게임·열쇠 없는 편집) 땅이 예전과 한 칸도 다르지 않아야 하고, 있으면 단 높이가 그 값이고 긴 곧은 절벽 줄이 끊긴다.
import { describe, expect, it } from "vitest";
import { generateCodeTerrain, longestTierEdgeRuns, scallopTierEdges, type TerrainGenInput } from "@/editor/tools/beodeulTerrainGen";
import { tilesetLookCliff, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { reliefSlopes } from "@/project/relief/walk";
import { reliefRenderOptions } from "@/project/relief/screen";
import type { Project } from "@/project/types";
import { isPassable } from "@/project/collision";

const BASE: TerrainGenInput[] = [
  { W: 42, H: 42, seed: 11, water: "river", character: "hill" },
  { W: 40, H: 46, seed: 23, water: "river", character: "slope" },
  { W: 44, H: 44, seed: 31, water: "river", character: "terraces" },
  { W: 42, H: 42, seed: 7, water: "river", character: "hill", tiers: 1, bands: true },
];
const tiersOf = (levels: ArrayLike<number>): number[] => [...new Set(Array.from(levels))].sort((a, b) => a - b);

describe("terrain cliff habit — tier heights and the scalloped cliff line", () => {
  it("no habit: the terrain is exactly what it was (one tier = two cells)", () => {
    for (const input of BASE) {
      const t = generateCodeTerrain(input);
      expect(t.tierStep).toBe(2);
      expect(t.habit).toBe(false);
      for (const v of tiersOf(t.levels)) expect(v % 2).toBe(0);
      expect(t.note).not.toMatch(/굽이/);
    }
  });

  it("tier height: one, two or three cells by the habit — a lone tier takes `lone`, three tiers never more than two cells each", () => {
    const two = BASE[0]!, lone = BASE[3]!;
    for (const step of [1, 2, 3]) {
      const t = generateCodeTerrain({ ...two, cliff: { step } });
      expect(t.tierStep).toBe(step);
      expect(tiersOf(t.levels)).toEqual([0, step, 2 * step]);
      // neighbours differ by at most one tier
      for (let y = 0; y < t.H; y += 1) for (let x = 0; x + 1 < t.W; x += 1) expect(Math.abs(t.levels[y * t.W + x]! - t.levels[y * t.W + x + 1]!)).toBeLessThanOrEqual(step);
      // the same land without the scallop: only the heights are scaled
      const plain = generateCodeTerrain(two);
      expect(Array.from(t.levels)).toEqual(Array.from(plain.levels, (v) => (v / 2) * step));
      expect(Array.from(t.water)).toEqual(Array.from(plain.water));
    }
    const single = generateCodeTerrain({ ...lone, cliff: { step: 1, lone: 3 } });
    expect(tiersOf(single.levels)).toEqual([0, 3]);
    expect(single.tierStep).toBe(3);
    const three = generateCodeTerrain({ ...BASE[2]!, tiers: 3, cliff: { step: 3, lone: 3 } });
    if (tiersOf(three.levels).length >= 4) expect(three.tierStep).toBe(2);
  });

  it("scallop: the generator leaves the cliff line alone and hands the limit to the builder (cliffStraight) — roads and stairs are found on the unbent land", () => {
    for (const input of BASE) {
      const plain = generateCodeTerrain(input), bent = generateCodeTerrain({ ...input, cliff: { step: 2, straight: 4 } });
      expect(Array.from(bent.levels)).toEqual(Array.from(plain.levels));
      expect(Array.from(bent.water)).toEqual(Array.from(plain.water));
      expect(bent.river).toEqual(plain.river);
      expect(bent.cliffBreaks).toEqual(plain.cliffBreaks);
      expect(bent.cliffStraight).toBe(4);
      expect(plain.cliffStraight).toBe(0);
      expect(generateCodeTerrain({ ...input, cliff: { step: 2 } }).cliffStraight).toBe(0);
      // the limit is never under three cells
      expect(generateCodeTerrain({ ...input, cliff: { step: 2, straight: 1 } }).cliffStraight).toBe(3);
    }
  });

  it("scallopTierEdges: a ruler-straight 30-cell cliff gets bends of two to four cells and no straight run over the limit plus the bend", () => {
    const W = 34, H = 16, lv = new Uint8Array(W * H), water = new Uint8Array(W * H);
    for (let y = 0; y < 8; y += 1) for (let x = 0; x < W; x += 1) lv[y * W + x] = 1;
    let seed = 12345; const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
    expect(longestTierEdgeRuns(lv, W, H).south).toBe(W);
    const made = scallopTierEdges(lv, water, W, H, 4, rand);
    expect(made).toBeGreaterThanOrEqual(3);
    expect(longestTierEdgeRuns(lv, W, H).south).toBeLessThanOrEqual(8);
    // only the rows beside the old edge moved, by one cell
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) if (y < 7 || y > 8) expect(lv[y * W + x]).toBe(y < 8 ? 1 : 0);
  });

  it("scallopTierEdges: locked cells keep their level, a refused bend is undone, and water cells and their neighbours never move", () => {
    const W = 34, H = 16, straight = () => { const lv = new Uint8Array(W * H); for (let y = 0; y < 8; y += 1) for (let x = 0; x < W; x += 1) lv[y * W + x] = 1; return lv; };
    const rand = (seed: number) => () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return seed / 2 ** 32; };
    // a road and its stair at columns 10..13: nothing within the locked columns moves
    const a = straight(), locked = (c: number) => { const x = c % W; return x >= 8 && x <= 15; };
    expect(scallopTierEdges(a, new Uint8Array(W * H), W, H, 4, rand(12345), locked)).toBeGreaterThanOrEqual(1);
    for (let y = 0; y < H; y += 1) for (let x = 8; x <= 15; x += 1) expect(a[y * W + x]).toBe(y < 8 ? 1 : 0);
    // every bend refused: the land is what it was, and the refusal saw the bend already written
    const b = straight(); let asked = 0;
    expect(scallopTierEdges(b, new Uint8Array(W * H), W, H, 4, rand(12345), undefined, (cells, was) => { asked += 1; expect(cells.length).toBeGreaterThanOrEqual(2); cells.forEach((c, k) => expect(b[c]).not.toBe(was[k])); return false; })).toBe(0);
    expect(asked).toBeGreaterThanOrEqual(3);
    expect(Array.from(b)).toEqual(Array.from(straight()));
    // water at the foot of columns 20..24: those columns and one beside them keep the straight edge
    const c = straight(), water = new Uint8Array(W * H); for (let x = 20; x <= 24; x += 1) water[9 * W + x] = 1;
    scallopTierEdges(c, water, W, H, 4, rand(777));
    for (let x = 19; x <= 25; x += 1) { expect(c[8 * W + x]).toBe(0); }
  });

  it("look table: every cliff look names a style and a habit the generator accepts", () => {
    const table = tilesetLookTableFor("beodeul_city")!;
    for (const name of Object.keys(table.parts.cliff!.options)) {
      const cliff = tilesetLookCliff("beodeul_city", { textureKey: table.texture, cliff: name })!;
      const t = generateCodeTerrain({ ...BASE[0]!, cliff });
      expect(t.habit).toBe(true);
      expect(t.tierStep).toBe(cliff.step);
    }
  });

  it("village: a three-cell cliff game gets stone-stair pieces long enough for the climb, and the upper tier is reached", () => {
    const table = tilesetLookTableFor("beodeul_city")!;
    const project = createBlankProject() as Project;
    project.tilesets.beodeul_city!.look = { textureKey: table.texture, cliff: "crag" };
    const ctx = { project };
    const res = runTool(ctx as never, "author_beodeul_town", { theme: "river", seed: 7, id: "crag_village", name: "바위벽 마을" } as never);
    expect(res.ok, res.summary).toBe(true);
    const map = ctx.project.maps.crag_village!, relief = map.relief!;
    expect(relief.style).toBe("cliff-crag");
    // the terrain's own tiers are 0 and 3. Back-bank cells (data.hillBehind — hidden cells behind the hill raised to in-between heights on purpose,
    // see the next test) are not tiers: where the settlement's earth leaves a hidden cell walkable, one of them appears here too.
    const banks = (res.data as { hillBehind?: { raised: number; sample: { x: number; y: number }[] } }).hillBehind ?? { raised: 0, sample: [] };
    expect(banks.raised).toBe(banks.sample.length);
    const bankCells = new Set(banks.sample.map((p) => p.y * map.width + p.x));
    expect(tiersOf(Array.from(relief.levels).filter((_, i) => !bankCells.has(i)))).toEqual([0, 3]);
    const slopes = reliefSlopes(relief), art = reliefRenderOptions(relief).slopeArt ?? [];
    expect(slopes.length).toBeGreaterThanOrEqual(1);
    slopes.forEach((s, k) => {
      expect(s.hi - s.lo).toBe(3);
      expect(s.steps).toBeUndefined();
      // the whole-flight chipset piece: a north climb's picture is (rise + 1) cells tall
      expect(art[k], `${s.dir}@${s.x},${s.y}`).toBeTruthy();
      if (s.dir === "n") expect(art[k]!.h).toBe((s.hi - s.lo + 1) * 16);
    });
    const data = res.data as { doors: { reached: boolean }[]; relief: { fails: number }; levelReach: Record<string, { walk: number; reached: number }> };
    expect(data.relief.fails).toBe(0);
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
    expect(data.levelReach["3"]!.reached / data.levelReach["3"]!.walk).toBeGreaterThan(0.6);
  }, 240_000);

  it("village: behind a two-cell hill nobody walks where the hero would be fully hidden — those cells become a stepped back bank", () => {
    const table = tilesetLookTableFor("beodeul_city")!;
    const project = createBlankProject() as Project;
    project.tilesets.beodeul_city!.look = { textureKey: table.texture, cliff: "rock" };
    const ctx = { project };
    const res = runTool(ctx as never, "author_beodeul_town", { theme: "river", seed: 11, landform: "hill", terrain: "hillside", id: "hill_village", name: "언덕 마을" } as never);
    expect(res.ok, res.summary).toBe(true);
    const map = ctx.project.maps.hill_village!, relief = map.relief!, W = map.width, H = map.height, lv = relief.levels;
    const data = res.data as { hillBehind: { raised: number; open: number; road: number; sample: { x: number; y: number }[] }; doors: { reached: boolean }[] };
    expect(data.hillBehind.raised).toBeGreaterThan(20);
    // fully hidden = some cell k rows south is at least k + 1 cells higher (the lifted top covers the whole 32px sprite); stair columns are cut open
    const ramp = (c: number) => (relief.ramps?.[c] ?? 0) > 0;
    const hidden = (c: number) => { if (ramp(c)) return false; for (let k = 1; k <= 6 && c + k * W < W * H; k += 1) { if (ramp(c + k * W)) return false; if (lv[c + k * W]! - lv[c]! >= k + 1) return true; } return false; };
    let left = 0;
    for (let c = 0; c < W * H; c += 1) if (hidden(c) && isPassable(ctx.project, map, c % W, Math.floor(c / W))) left += 1;
    // what is left walkable is what the builder reports (roads, door fronts, cells whose bank would cut other ground off) plus hidden cells nobody can reach
    expect(left).toBeGreaterThanOrEqual(data.hillBehind.open + data.hillBehind.road);
    expect(data.hillBehind.open + data.hillBehind.road).toBeLessThan(data.hillBehind.raised / 4);
    // a bank cell is raised ground one step per row down from the hill, with no stair on it; the two tiers are still there
    for (const { x, y } of data.hillBehind.sample) { const c = y * W + x; expect(lv[c]! % 2).toBe(1); expect(ramp(c)).toBe(false); expect(hidden(c)).toBe(false); }
    expect(tiersOf(lv)).toEqual(expect.arrayContaining([0, 2, 4]));
    expect(data.doors.filter((d) => !d.reached)).toEqual([]);
  }, 240_000);
});
