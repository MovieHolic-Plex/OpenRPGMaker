import { describe, expect, it } from "vitest";
import { generateCodeTerrain, longestTierEdgeRuns, scallopTierEdges, type TerrainGenInput } from "@/editor/tools/beodeulTerrainGen";
import { tilesetLookCliff, tilesetLookTableFor } from "@/assets/tilesetLooks";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { reliefSlopes } from "@/project/relief/walk";
import { reliefRenderOptions } from "@/project/relief/screen";
import type { Project, GameMap } from "@/project/types";
import { isPassable } from "@/project/collision";
import { villageArgsFromRead } from "@/ai/imagePlan";
import { yardParts } from "@/editor/tools/beodeulYardLayout";
import type { ToolContext } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

// 절벽 습관(게임 겉모습 cliff — 단 높이 1·2·3칸, 절벽 줄 굽이): 지형 생성기와 마을 시공기.
// 습관이 없으면(옛 게임·열쇠 없는 편집) 땅이 예전과 한 칸도 다르지 않아야 하고, 있으면 단 높이가 그 값이고 긴 곧은 절벽 줄이 끊긴다.
describe("beodeulTerrainCliffHabit", () => {
  isolateTimers();
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
});

describe("beodeulTerrainGiven", () => {
  isolateTimers();
  const ROWS = [
    "000000011110000000000000",
    "000000111110~~0000000000",
    "000011111100|~0000000000",
    "000011221100|~~000000000",
    "000001222110~~~000000000",
    "000001122100~~0000000000",
    "000000111000~~0000000000",
    "00000000000~~00000000000",
  ];
  describe("village terrain from an image-plan cell map", () => {
    const t = generateCodeTerrain({ W: 56, H: 44, seed: 7, water: "river", given: { rows: ROWS } });
    const cellOf = (col: number, row: number) => Math.floor((row + 0.5) * 44 / ROWS.length) * 56 + Math.floor((col + 0.5) * 56 / 24);

    it("puts the given tiers and water where the map says (one tier step = two levels)", () => {
      expect(t.water[cellOf(13, 3)]).toBe(1);
      expect(t.water[cellOf(2, 1)]).toBe(0);
      expect(t.levels[cellOf(6, 3)]).toBe(2 * 2);
      expect(t.levels[cellOf(8, 3)]).toBe(2 * 1);
      expect(t.levels[cellOf(1, 1)]).toBe(0);
      expect(t.maxLevel).toBeGreaterThanOrEqual(4);
    });

    it("keeps every neighbour step at most one tier (two levels) apart", () => {
      for (let y = 0; y < 44; y += 1) for (let x = 0; x < 56; x += 1) {
        const c = y * 56 + x;
        if (x + 1 < 56) expect(Math.abs(t.levels[c]! - t.levels[c + 1]!)).toBeLessThanOrEqual(2);
        if (y + 1 < 44) expect(Math.abs(t.levels[c]! - t.levels[c + 56]!)).toBeLessThanOrEqual(2);
      }
    });

    it("passes the read terrain rows to the builder as terrainMap and keeps river water", () => {
      const read = { subject: "village" as const, cols: 24, rows: 8, data: { terrain: ROWS, water: "none", houses: [] } };
      const args = villageArgsFromRead(read, 56, 44);
      expect(args.terrainMap).toEqual(ROWS);
      expect(args.water).toBeUndefined();
    });
  });
});

// 마당 먼저, 집은 그 테두리(editor/tools/beodeulYardLayout.ts): 코드 지형 자동 배치는 한 단 마른 터에 마당을 잡고 집이 그 가장자리에 문을 마당으로 내고 선다.
// 조수가 자리를 준 마을(layout.gather·houses)은 마당을 잡지 않고 그 자리 그대로다. 집 수·문 도달은 예전 고리 배치보다 나빠지지 않는다.
describe("beodeulYardLayout", () => {
  isolateTimers();
  type Rect = { x0: number; y0: number; x1: number; y1: number };
  type Yard = Rect & { level: number; lobes: Rect[]; courts: Rect[]; woods: { x: number; y: number }[]; frame: { x: number; y: number; w: number; h: number; front: { x: number; y: number }; role: string; at: string }[] };
  type Door = { kit: string; x: number; y: number; reached: boolean };
  type Data = { mapId: string; houses: number; nature: { forestCells: number }; anchors: string[]; doors: Door[]; layout: { auto: boolean; gather: { x: number; y: number }; yard?: Yard; moved: string[]; houses?: { x: number; y: number }[] } };
  function town(args: Record<string, unknown>): { project: Project; map: GameMap; data: Data } {
    const project = createBlankProject() as Project;
    const ctx = { project, currentMapId: project.startMapId } as ToolContext;
    const res = runTool(ctx, "author_beodeul_town", { theme: "river", ...args });
    expect(res.ok, res.summary).toBe(true);
    const data = res.data as unknown as Data;
    return { project: ctx.project, map: ctx.project.maps[data.mapId]!, data };
  }
  /** 마당(가운데 네모 + 날개)에서 6칸 안 · 같은 단에 문을 낸 살림집 수. */
  function housesOnYard(map: GameMap, data: Data): number {
    const y = data.layout.yard!, W = map.width, lv = map.relief?.levels ?? [];
    const cells: number[] = [];
    for (const r of [y, ...y.lobes]) for (let Y = r.y0; Y <= r.y1; Y += 1) for (let X = r.x0; X <= r.x1; X += 1) cells.push(Y * W + X);
    const anchors = new Set(data.anchors);
    return data.doors.filter((d) => !anchors.has(d.kit)).filter((d) => cells.some((c) => (lv[c] ?? 0) === (lv[d.y * W + d.x] ?? 0) && Math.max(Math.abs((c % W) - d.x), Math.abs(Math.floor(c / W) - d.y)) <= 6)).length;
  }
  describe("코드 지형 자동 배치 — 마당 먼저", () => {
    it.each([
      ["강가 마을", { seed: 7, houseCount: 4 }],
      ["강 없는 들판 농가", { seed: 3, houseCount: 3, water: "none" }],
      ["포구", { seed: 5, houseCount: 4, theme: "coast" }],
    ] as const)("%s: 집 셋(집이 셋이면 전부)이 마당에 문을 내고, 요청한 집이 다 앉고, 문마다 길이 닿는다", (_name, args) => {
      const { map, data } = town(args);
      const yard = data.layout.yard;
      expect(yard, "자동 배치는 마당을 잡는다").toBeTruthy();
      expect(data.layout.auto).toBe(true);
      expect(data.houses).toBe(args.houseCount);
      expect(data.doors.filter((d) => !d.reached)).toEqual([]);
      expect(housesOnYard(map, data)).toBeGreaterThanOrEqual(3);
      // 숲 몫: 집을 모아도 마당 둘레 밖 빈 땅에 숲 자리를 남기고 거기 숲 덩이가 선다(남긴 칸 목록은 결과에 싣지 않는다)
      expect(yard!.woods.length).toBeGreaterThanOrEqual(1);
      expect("woodCells" in yard!).toBe(false);
      expect(data.nature.forestCells).toBeGreaterThan(0);
      // 우물은 마당 안에 서되 한가운데 축이 아니다
      const g = data.layout.gather;
      expect(g.x >= yard!.x0 && g.x <= yard!.x1 && g.y >= yard!.y0 && g.y <= yard!.y1).toBe(true);
      expect(g.x).not.toBe(Math.round((yard!.x0 + yard!.x1) / 2));
      // 테두리 건물은 마당 북쪽 가장자리에 서고(집 아랫줄이 마당 윗줄 위), 문 앞이 마당 줄에서 세 칸 안이다
      const onYard = yard!.frame.filter((f) => f.at === "yard");
      expect(onYard.length).toBeGreaterThanOrEqual(2);
      for (const f of onYard) {
        const rects = [yard!, ...yard!.lobes];
        expect(rects.some((r) => f.y + f.h - 1 < r.y0 && r.y0 - f.front.y <= 3 && f.front.x >= r.x0 - 9 && f.front.x <= r.x1 + 9), JSON.stringify(f)).toBe(true);
      }
      // 결과 data 에는 칸 목록을 싣지 않는다(조수가 읽는 결과가 불어나지 않게)
      expect(Object.keys(yard!)).not.toContain("cells");
    }, 120_000);

    it("언덕 마을: 집 수와 문 도달이 그대로이고 마당을 잡는다", () => {
      const { data } = town({ seed: 11, houseCount: 4, landform: "hill" });
      expect(data.houses).toBe(4);
      expect(data.doors.filter((d) => !d.reached)).toEqual([]);
      expect(data.layout.yard).toBeTruthy();
    }, 120_000);

    it("조수가 자리를 주면 마당을 잡지 않고 그 자리에 짓는다", () => {
      const auto = town({ seed: 7, houseCount: 4 });
      const layout = { gather: { x: 20, y: 30 }, houses: [{ x: 8, y: 30 }, { x: 30, y: 33 }, { x: 34, y: 20 }], exits: ["west", "east"] };
      const given = town({ seed: 7, houseCount: 4, layout });
      expect(given.data.layout.auto).toBe(false);
      expect(given.data.layout.yard).toBeUndefined();
      expect(given.data.layout.houses).toEqual(layout.houses);
      expect(given.data.houses).toBeLessThanOrEqual(3);
      expect(auto.data.layout.yard).toBeTruthy();
    }, 120_000);
  });
  describe("yardParts", () => {
    it("잇닿은 덩이로 나누고 첫 칸이 든 덩이를 맨 앞에 둔다", () => {
      const W = 10;
      const parts = yardParts([0, 1, 11, 5, 6, 30], W, 6);
      expect(parts.map((p) => [...p].sort((a, b) => a - b))).toEqual([[5, 6], [0, 1, 11], [30]]);
      // 줄 끝 칸과 다음 줄 첫 칸은 이웃이 아니다
      expect(yardParts([9, 10], W, 9).length).toBe(2);
    });
  });
});
