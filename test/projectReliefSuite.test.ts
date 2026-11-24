import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { planReliefRamp } from "@/editor/reliefRampPlan";
import { LONG_RAMP_RUNOUT } from "@/project/relief/cutPieces";
import { reliefAllowsStep, RELIEF_LADDER, RELIEF_VINE, reliefClimbAt, reliefSlopes } from "@/project/relief/walk";
import type { GameMap } from "@/project/types";
import { createBlankProject } from "@/project/defaults";
import { clearReliefAffectedObjects } from "@/project/relief/affectedObjects";
import { setLayerTileAt, cloneExtraLayers, cropExtraLayers, layerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { carryReliefExtras, emptyRelief, normalizeRelief, copyRelief } from "@/project/relief/edit";
import { reliefTileSlotChangedCells, reliefPickCell, cellLift, footLift, reliefLiftField, reliefRenderOptions, reliefPickPoint, reliefSignature, reliefReadSignature } from "@/project/relief/screen";
import { type ReliefData, gridFromRelief } from "@/project/relief/types";
import { buildReliefOps } from "@/project/relief/ops";
import { RELIEF_TIDY_MIN_AREA, roughReliefStroke, tidyReliefRegion } from "@/project/relief/roughBrush";
import { effectiveHeights, renderRelief, reliefPadPx, type ReliefGroundSurface } from "@/project/relief/render";
import { compileReliefStyle, RELIEF_DEFAULT_RIM, RELIEF_STYLES, reliefFaceRows } from "@/project/relief/styles";
import { cropReliefGrid, reliefGrids, reliefWindowFor, SHEER_REACH, planReliefPatch, reliefImageFromRender, type ReliefScene } from "@/project/relief/window";
import { checkRelief } from "@/project/relief/check";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import { ReliefPagedImage, RELIEF_PAGE, type ReliefPageView } from "@/project/relief/paged";
import { bindReliefRevision, invalidateReliefRevision } from "@/project/relief/revision";
import { normalizeTerrainDesign, normalizeTerrainStamps } from "@/project/terrainDesign";
import { restoreLockedTerrainCells } from "@/project/terrainLocks";
import { captureTerrainStamp, transformTerrainStamp, transformedRamp, symmetricStampPlacement } from "@/editor/terrainStamps";
import { runtimeMap } from "@/project/runtimeMap";
import { canMove, isPassable } from "@/project/collision";
import { isolateTimers } from "./mergedTeardown";

describe("rampTallCliff", () => {
  isolateTimers();
  function cliff(rise: number): GameMap {
    const w = 12, h = 12, n = w * h, levels = new Array<number>(n).fill(0);
    for (let y = 1; y <= 5; y++) for (let x = 2; x < 10; x++) levels[y * w + x] = rise;
    return { id: "m", name: "m", width: w, height: h, tileSize: 16, tilesetId: "t", lowerTiles: new Array(n).fill(0), upperTiles: new Array(n).fill(-1), events: [], relief: { width: w, height: h, levels } } as GameMap;
  }
  function climbs(map: GameMap, rise: number): boolean {
    const r = map.relief!;
    let y = 9;
    while (y > 1) {
      if (!reliefAllowsStep(r, 5, y, 5, y - 1)) return false;
      y--;
      if (r.levels[y * map.width + 5] === rise && !r.ramps?.[y * map.width + 5]) return true;
    }
    return false;
  }
  describe("높은 절벽 경사로", () => {
    for (const [rise, rows] of [[1, 1], [2, LONG_RAMP_RUNOUT], [3, LONG_RAMP_RUNOUT], [4, LONG_RAMP_RUNOUT], [6, LONG_RAMP_RUNOUT], [8, LONG_RAMP_RUNOUT]] as const) it(`${rise}단 절벽: 발치 ${rows}줄, 걸어서 오른다`, () => {
      const map = cliff(rise);
      const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
      expect(plan.ok).toBe(true);
      plan.apply!(map);
      const rampRows = new Set(map.relief!.ramps!.flatMap((v, i) => (v ? [Math.floor(i / map.width)] : [])));
      expect(rampRows.size).toBe(rows);
      expect(climbs(map, rise)).toBe(true);
    });

    // 북향 긴 비탈은 높이 제한이 없다(133d84ccb9). 그림이 단 차에 묶이는 건 돌계단(stairs, 최대 CUT_MAX_RISE=4단)뿐이다.
    it("긴 비탈은 10단도 놓는다", () => {
      const map = cliff(10);
      const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, false);
      expect(plan.ok).toBe(true);
      plan.apply!(map);
      expect(climbs(map, 10)).toBe(true);
    });

    it("그림이 없는 높이의 돌계단(10단)은 이유와 한 번에 고치는 길을 준다", () => {
      const map = cliff(10);
      const plan = planReliefRamp(map, { x: 5, y: 6, face: "top" }, 2, true);
      expect(plan.ok).toBe(false);
      expect(plan.fix).toBeDefined();
      plan.fix!.apply(map);
      expect(map.relief!.levels[3 * map.width + 5]).toBe(4);
      expect(climbs(map, 4)).toBe(true);
    });
  });
});

describe("reliefAffectedObjects", () => {
  isolateTimers();
  describe("height edit object cleanup", () => {
    it("removes overlapping structures, doodads, events, and untracked upper tiles", () => {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.width = map.height = 8;
      map.lowerTiles = Array(64).fill(1);
      map.upperTiles = Array(64).fill(-1);
      const structureIndex = 2 * 8 + 2;
      setLayerTileAt(map, 1, structureIndex, 7);
      map.structurePlacements = [{ id: "house", kitId: "house", x: 2, y: 2, w: 2, h: 2, before: { lower: [1, 1, 1, 1], upper: [-1, -1, -1, -1] }, afterHash: "" }];
      map.doodadGroups = [{ id: "tree", label: "나무", kitId: "tree", cells: [{ index: 4 * 8 + 4, tile: 9, before: -1 }] }];
      setLayerTileAt(map, 3, 4 * 8 + 4, 9);
      setLayerTileAt(map, 3, 5 * 8 + 5, 10);
      map.events = [{ id: "npc", x: 5, y: 5, trigger: { kind: "action" }, commands: [] }];

      const result = clearReliefAffectedObjects(map, new Set([structureIndex, 4 * 8 + 4, 5 * 8 + 5]));

      expect(result.structureCount).toBe(1);
      expect(result.doodadCount).toBe(1);
      expect(result.eventIds).toEqual(["npc"]);
      expect(map.structurePlacements).toBeUndefined();
      expect(map.doodadGroups).toBeUndefined();
      expect(map.events).toEqual([]);
      expect(map.lowerTiles[structureIndex]).toBe(1);
      expect(map.upperTiles[4 * 8 + 4]).toBe(-1);
      expect(map.upperTiles[5 * 8 + 5]).toBe(-1);
    });
  });
});

// test/reliefEditorSync.test.ts
// 높이 붓·조수 도구가 경사로·장식·양식을 잃지 않는지(carryReliefExtras), 편집기가 들림이 바뀐 칸만 다시 그리는지(reliefTileSlotChangedCells).
describe("reliefEditorSync", () => {
  isolateTimers();
  const W = 8, H = 6;
  const flat = (): ReliefData => ({ width: W, height: H, levels: new Array(W * H).fill(0) });
  const block = (level: number): ReliefData => {
    const r = flat();
    for (let y = 1; y <= 3; y++) for (let x = 2; x <= 5; x++) r.levels[y * W + x] = level;
    return r;
  };
  describe("reliefTileSlotChangedCells", () => {
    it("같은 relief(또는 둘 다 없음)는 바뀐 칸이 없다", () => {
      const a = block(3);
      expect(reliefTileSlotChangedCells(a, a, W, H)).toEqual([]);
      expect(reliefTileSlotChangedCells(undefined, undefined, W, H)).toEqual([]);
    });
    it("평지에 덩이를 올리면 덩이 자리만 바뀐다", () => {
      const changed = reliefTileSlotChangedCells(undefined, block(3), W, H);
      expect(changed.length).toBeGreaterThan(0);
      for (const { x, y } of changed) {
        expect(x).toBeGreaterThanOrEqual(2);
        expect(x).toBeLessThanOrEqual(5);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(3);
      }
    });
    it("덩이를 다시 평지로 내리면 올렸던 자리가 같이 바뀐다", () => {
      const up = reliefTileSlotChangedCells(undefined, block(3), W, H);
      const down = reliefTileSlotChangedCells(block(3), undefined, W, H);
      expect(down).toEqual(up);
    });
  });
  describe("carryReliefExtras", () => {
    const prev = (): ReliefData => ({
      ...block(3),
      ramps: Object.assign(new Array(W * H).fill(0), { [2 * W + 3]: 1, [3 * W + 4]: 1 }),
      wallDecor: [{ x: 2, y: 1, row: 1, tile: 5 }, { x: 5, y: 3, row: 1, tile: 6 }],
      style: "grass-cliff",
    });

    it("단이 안 바뀐 칸의 경사로·장식과 양식을 잇는다", () => {
      const next = { ...block(3) };
      next.levels = next.levels.slice();
      next.levels[3 * W + 5] = 1; // (5,3) 의 단만 바뀐다
      const out = carryReliefExtras(prev(), next);
      expect(out.style).toBe("grass-cliff");
      expect(out.ramps?.[2 * W + 3]).toBe(1);
      expect(out.wallDecor).toEqual([{ x: 2, y: 1, row: 1, tile: 5 }]);
    });
    it("단이 바뀐 칸의 경사로는 버린다", () => {
      const next = { ...block(3) };
      next.levels = next.levels.slice();
      next.levels[3 * W + 4] = 0; // (4,3) 의 경사로 칸 단이 바뀐다
      const out = carryReliefExtras(prev(), next);
      expect(out.ramps?.[3 * W + 4] ?? 0).toBe(0);
      expect(out.ramps?.[2 * W + 3]).toBe(1);
    });
    it("맵 크기가 다르면 양식만 잇는다", () => {
      const out = carryReliefExtras(prev(), { width: 4, height: 4, levels: new Array(16).fill(1) });
      expect(out.style).toBe("grass-cliff");
      expect(out.ramps).toBeUndefined();
      expect(out.wallDecor).toBeUndefined();
    });
    it("이전 relief 가 없으면 새 relief 를 그대로 돌려준다", () => {
      const next = block(2);
      expect(carryReliefExtras(undefined, next)).toBe(next);
    });
  });
});

// 지형 리뷰 F6: 산이 같은 간격의 동심 팔각 고리(등고선)로 나왔다. 고리 반지름이 방향마다 달라야 한다.
describe("reliefMountainShape", () => {
  isolateTimers();
  function ringSpread(h: number[][], cx: number, cy: number, level: number): number {
    const radii: number[] = [];
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      let r = 0;
      for (let t = 0; t < 30; t += 0.5) {
        const x = Math.round(cx + Math.cos(a) * t), y = Math.round(cy + Math.sin(a) * t);
        if (y < 0 || x < 0 || y >= h.length || x >= h[0]!.length || h[y]![x]! < level) break;
        r = t;
      }
      radii.push(r);
    }
    return Math.max(...radii) - Math.min(...radii);
  }
  describe("산 모양 (sculpt_relief mountain)", () => {
    it("봉우리 높이는 그대로, 고리 반지름은 방향마다 3칸 이상 다르다", () => {
      for (const seed of [1, 2, 3, 4, 5]) {
        const base = Array.from({ length: 60 }, () => new Array<number>(60).fill(0));
        const { h } = buildReliefOps({ seed, ops: [{ op: "mountain", at: [30, 30], peak: 6, slope: 2 }] }, base);
        expect(Math.max(...h.flat())).toBe(6);
        expect(ringSpread(h, 30, 30, 2)).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

describe("reliefRoughBrush", () => {
  isolateTimers();
  const at = (r: ReliefData, x: number, y: number) => r.levels[y * r.width + x] ?? 0;
  describe("러프 높이 붓 (roughReliefStroke)", () => {
    it("올리기는 한 번에 덩이를 세우고 가운데가 봉우리, 가장자리는 단으로 내려간다", () => {
      const r = emptyRelief(48, 48);
      expect(roughReliefStroke(r, 24, 24, "raise", { radius: 4, base: 0, peak: 3, cap: 4 })).toBe(true);
      expect(at(r, 24, 24)).toBe(3);
      expect(Math.max(...r.levels)).toBe(3);
      // 정밀 붓(반지름 1 원)보다 훨씬 넓다 — 1차 스케치용.
      expect(r.levels.filter((v) => v > 0).length).toBeGreaterThan(60);
      // 붓에서 멀리 떨어진 모서리는 그대로.
      expect(at(r, 0, 0)).toBe(0);
      expect(at(r, 47, 47)).toBe(0);
      // 봉우리 밖에는 그보다 낮은 단(비탈)이 있다 — 벽 하나로 끝나지 않는다.
      expect(r.levels.some((v) => v > 0 && v < 3)).toBe(true);
    });

    it("상한을 넘지 않고, 이미 높은 칸은 깎지 않는다", () => {
      const r = emptyRelief(30, 30);
      r.levels[15 * 30 + 15] = 6;
      roughReliefStroke(r, 15, 15, "raise", { radius: 3, base: 0, peak: 9, cap: 2 });
      expect(at(r, 15, 15)).toBe(6);
      expect(at(r, 14, 15)).toBe(2);
    });

    it("내리기는 덩이 안을 바닥 단까지 판다", () => {
      const r = emptyRelief(30, 30);
      r.levels.fill(3);
      roughReliefStroke(r, 15, 15, "lower", { radius: 3, base: 3, peak: 0, cap: 4 });
      expect(at(r, 15, 15)).toBe(0);
      expect(at(r, 0, 0)).toBe(3);
    });

    it("단 지정·평탄은 덩이 안만 바꾼다", () => {
      const r = emptyRelief(30, 30);
      roughReliefStroke(r, 15, 15, "set", { radius: 3, base: 0, peak: 0, cap: 2 });
      expect(at(r, 15, 15)).toBe(2);
      expect(at(r, 15, 25)).toBe(0);
    });
  });
  describe("붓 뗄 때 정리 (tidyReliefRegion)", () => {
    it("상자 안의 작은 섬·1칸 구멍을 메우고 상자 밖은 건드리지 않는다", () => {
      const r = emptyRelief(20, 20);
      r.levels[5 * 20 + 5] = 2; // 1칸 섬
      for (let y = 10; y < 15; y++) for (let x = 10; x < 15; x++) r.levels[y * 20 + x] = 1; // 25칸 고원
      r.levels[12 * 20 + 12] = 0; // 1칸 구멍
      r.levels[2 * 20 + 18] = 3; // 상자 밖 1칸 섬
      expect(tidyReliefRegion(r, { x0: 0, y0: 0, x1: 15, y1: 15 })).toBe(true);
      expect(at(r, 5, 5)).toBe(0);
      expect(at(r, 12, 12)).toBe(1);
      expect(at(r, 10, 10)).toBe(1);
      expect(at(r, 18, 2)).toBe(3);
    });

    it("작은 섬 문턱보다 큰 덩어리는 남긴다", () => {
      const r = emptyRelief(20, 20);
      for (let i = 0; i < RELIEF_TIDY_MIN_AREA + 1; i++) r.levels[8 * 20 + 3 + i] = 1;
      for (let i = 0; i < RELIEF_TIDY_MIN_AREA + 1; i++) r.levels[9 * 20 + 3 + i] = 1;
      tidyReliefRegion(r, { x0: 0, y0: 0, x1: 19, y1: 19 });
      expect(at(r, 5, 8)).toBe(1);
    });

    it("경사로 칸은 정리하지 않는다", () => {
      const r: ReliefData = { ...emptyRelief(10, 10), ramps: new Array(100).fill(0) };
      r.levels[5 * 10 + 5] = 1;
      r.ramps![5 * 10 + 5] = 5;
      tidyReliefRegion(r, { x0: 0, y0: 0, x1: 9, y1: 9 });
      expect(at(r, 5, 5)).toBe(1);
    });
  });
  describe("보이는 칸 집기 (reliefPickCell)", () => {
    it("들린 칸은 북쪽으로 올라가 보이므로 그 화면 줄을 누르면 그 칸의 윗면·벽을 고른다", () => {
      const r = emptyRelief(12, 12);
      for (let y = 4; y < 8; y++) for (let x = 3; x < 9; x++) r.levels[y * 12 + x] = 2;
      // 칸 (5,7) 은 2단 — 윗면은 땅 줄 5 에, 남쪽 벽은 땅 줄 6~7 에 그려진다.
      expect(reliefPickCell(r, 5, 5)).toEqual({ x: 5, y: 7, face: "top" });
      expect(reliefPickCell(r, 5, 6)).toEqual({ x: 5, y: 7, face: "wall" });
      expect(reliefPickCell(r, 5, 7)).toEqual({ x: 5, y: 7, face: "wall" });
      // 언덕 아래 평지는 그대로.
      expect(reliefPickCell(r, 5, 9)).toEqual({ x: 5, y: 9, face: "top" });
      // relief 없음
      expect(reliefPickCell(undefined, 2, 3)).toEqual({ x: 2, y: 3, face: "top" });
    });
  });
});

// 깎아지른 지형(relief.style "sheer", 2026-11-16): 단 하나 = 앞면 3칸, 조각에서 읽는 면, 엽 끝에서 도는 면, 빈 곳, 세로 이동 칸(사다리·덩굴).
// 저장소 안 시험은 코드로 만든 자리 표시 조각(sheerArt.ts placeholderSheerArt)만 쓴다.
describe("reliefSheer", () => {
  isolateTimers();
  // 구운 조각(sheerArt.json)이 들어와도 이 시험은 코드로 만든 자리 표시 조각으로 돈다.
  beforeAll(() => setSheerArt(placeholderSheerArt()));
  afterAll(() => setSheerArt(null));
  const W = 24, H = 18;
  /** 엽 꼴 고원 둘(2단 · 3단), 남쪽 네 줄은 빈 곳(0 단), 사다리 한 줄. */
  function scene(style: string | null = "sheer"): ReliefData {
    const levels = new Array(W * H).fill(1), ramps = new Array(W * H).fill(0);
    const lobe = (cx: number, cy: number, rx: number, ry: number, lv: number) => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) levels[y * W + x] = Math.max(levels[y * W + x]!, lv);
    };
    lobe(7, 4, 6, 3.5, 2); lobe(16, 6, 4.5, 3.5, 3);
    for (let y = 14; y < H; y++) for (let x = 0; x < W; x++) levels[y * W + x] = 0;
    for (let y = 8; y < 10; y++) ramps[y * W + 5] = RELIEF_LADDER;
    return { width: W, height: H, levels, ramps, ...(style ? { style } : {}) };
  }
  const render = (r: ReliefData) => renderRelief(effectiveHeights(gridFromRelief(r)), reliefRenderOptions(r));
  describe("sheer relief style", () => {
    it("is opt-in: other styles keep one face row a level and the default rim keeps no east/west faces", () => {
      expect(RELIEF_DEFAULT_RIM.sides).toBe("none");
      expect(reliefFaceRows("sheer")).toBe(3);
      for (const name of Object.keys(RELIEF_STYLES)) if (name !== "sheer") expect(compileReliefStyle(name)!.faceRows, name).toBe(1);
      expect(reliefFaceRows(undefined)).toBe(1);
      // the same heights under the default wall: pad = top level × 16, sheer: × 48
      const flat = scene(null), sheer = scene();
      expect(render(flat).pad).toBe(3 * 16);
      expect(render(sheer).pad).toBe(3 * 48);
      expect(reliefPadPx(reliefGrids(sheer).pruned, [], 3)).toBe(3 * 48);
    });

    it("draws a level step as a three-cell face from the face panels, and the void as transparent sky", () => {
      const r = render(scene());
      // a column through the 2-level lobe's south face, over 1-level ground: 48 px of wall under the rim
      const x = 7 * 16 + 8;
      let wall = 0;
      for (let sy = 0; sy < r.SH; sy++) if (r.kind[sy * r.PW + x] === 1 && r.lev[sy * r.PW + x] === 6) wall++;
      expect(wall).toBeGreaterThanOrEqual(48);
      // void rows (level 0) are transparent except the fall-away shade under the faces
      const voidRow = (H - 1) * 16 + r.pad;
      let clear = 0;
      for (let sx = 0; sx < r.PW; sx++) if (r.rgba[(voidRow * r.PW + sx) * 4 + 3] === 0) clear++;
      expect(clear).toBeGreaterThan(r.PW * 0.9);
      // face colours come from the panels (placeholder art) — no pixel of the default earth palette
      const art = placeholderSheerArt(), colours = new Set<string>();
      for (const p of [...art.face48, ...art.face96, art.side, art.rim, art.drop, art.ladder]) for (let q = 0; q < p.rgba.length; q += 4) if (p.rgba[q + 3]) colours.add(`${p.rgba[q]},${p.rgba[q + 1]},${p.rgba[q + 2]}`);
      for (const [k, v] of art.rock.entries()) colours.add(v.join(",")), void k;
      let foreign = 0, walls = 0;
      for (let i = 0; i < r.kind.length; i++) {
        if (r.kind[i] !== 1 || !r.rgba[i * 4 + 3]) continue;
        walls++;
        const rgb = `${r.rgba[i * 4]},${r.rgba[i * 4 + 1]},${r.rgba[i * 4 + 2]}`;
        if (!colours.has(rgb)) foreign++;
      }
      // shaded ground pixels are multiplied (cast shadow on the ground, not on the wall); wall pixels come from the art
      expect(foreign / walls).toBeLessThan(0.02);
    });

    it("raises no side-face bands east or west of a top — every wall pixel hangs under its own top; the east edge casts a shadow", () => {
      const r = render(scene());
      // side bands stood beside a top over low ground: their column had no top of that level above them
      let walls = 0, orphan = 0;
      for (let i = 0; i < r.kind.length; i++) {
        if (r.kind[i] !== 1 || r.lev[i] !== 9) continue;
        walls++;
        let j = i; while (j >= r.PW && r.kind[j] === 1 && r.lev[j] === 9) j -= r.PW;
        if (!(r.kind[j] === 0 && r.lev[j] === 9)) orphan++;
      }
      expect(walls).toBeGreaterThan(1000);
      expect(orphan).toBe(0);
      // east of the 3-level lobe's top, the low ground right beside the edge is darker than 12 px further east
      let rows = 0, shaded = 0;
      for (let sy = 0; sy < r.SH; sy++) {
        let e = -1; for (let sx = 12 * 16; sx < r.PW - 1; sx++) { const i = sy * r.PW + sx; if (r.kind[i] === 0 && r.lev[i] === 9 && !(r.kind[i + 1] === 0 && r.lev[i + 1] === 9)) { e = sx; break; } }
        if (e < 0 || e + 14 >= r.PW) continue;
        const j = sy * r.PW + e + 1, far = sy * r.PW + e + 13;
        if (r.kind[far] !== 0 || r.kind[j] !== 0) continue;
        rows++;
        if (r.rgba[j * 4 + 1]! < r.rgba[far * 4 + 1]!) shaded++;
      }
      expect(rows).toBeGreaterThan(20);
      expect(shaded / rows).toBeGreaterThan(0.8);
    });

    it("a windowed bake (editor pages) matches the full raster pixel for pixel", () => {
      const relief = scene(), g = reliefGrids(relief), opts = reliefRenderOptions(relief), full = renderRelief(g.eff, opts);
      const PW = W * 16, SH = full.SH, pad = full.pad;
      for (const [x0, y0, x1, y1] of [[0, 0, 192, 192], [192, 0, 384, 192], [96, 96, 288, 320], [0, 192, 384, SH]] as const) {
        const win = reliefWindowFor(x0, y0, x1, y1, W, H, pad, SHEER_REACH);
        const part = renderRelief(cropReliefGrid(g.eff, win), { ...opts, window: { cx: win.cx, cy: win.cy, pad, PW, SH, pruned: cropReliefGrid(g.pruned, win) } });
        let bad = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const i = y * PW + x, j = (y - win.cy * 16) * part.PW + (x - win.cx * 16);
          for (let c = 0; c < 4; c++) if (full.rgba[i * 4 + c] !== part.rgba[j * 4 + c]) { bad++; break; }
        }
        expect(bad, `${x0},${y0}`).toBe(0);
      }
    });

    it("land that runs off the south edge gets no face band at the map's last row, and a fall (relief.falls) covers one face band with straight sides", () => {
      // land to the south edge: the last row's level continues off the map — no wall pixels below it
      const land = scene(); for (let y = 14; y < H; y++) for (let x = 0; x < W; x++) land.levels[y * W + x] = 1;
      const r = render(land), lastRow = (H - 1) * 16 + r.pad - 3 * 16;
      let wall = 0; for (let sy = lastRow + 16; sy < r.SH; sy++) for (let sx = 0; sx < r.PW; sx++) if (r.kind[sy * r.PW + sx] === 1) wall++;
      expect(wall).toBe(0);
      // a fall on the 2-level lobe's south face (x 6..8): the face band under it is water, not rock; old maps without falls are unchanged
      const plain = scene(), fall = { ...scene(), falls: [{ x: 6, y: 7, w: 3 }] };
      const a = render(plain), b = render(fall);
      expect(reliefRenderOptions(plain).falls).toBeUndefined();
      let changed = 0, outside = 0;
      for (let i = 0; i < a.kind.length; i++) {
        const same = a.rgba[i * 4] === b.rgba[i * 4] && a.rgba[i * 4 + 1] === b.rgba[i * 4 + 1] && a.rgba[i * 4 + 2] === b.rgba[i * 4 + 2];
        if (same) continue;
        changed++;
        const sx = i % a.PW; if (sx < 6 * 16 - 6 || sx >= 9 * 16 + 6) outside++;
      }
      expect(changed).toBeGreaterThan(3 * 16 * 30);
      expect(outside).toBe(0);
      // straight sides: down the body of the fall the left and right edge columns are the same on every row
      const art = placeholderSheerArt(); void art;
      const edgeCols = new Set<number>();
      const top = 8 * 16 + b.pad - 2 * 48;
      for (let sy = top + 4; sy < top + 40; sy++) { let l = -1; for (let sx = 6 * 16; sx < 9 * 16; sx++) { const i = sy * b.PW + sx; if (a.rgba[i * 4] !== b.rgba[i * 4] || a.rgba[i * 4 + 1] !== b.rgba[i * 4 + 1]) { l = sx; break; } } if (l >= 0) edgeCols.add(l); }
      expect(edgeCols.size).toBeLessThanOrEqual(2);
    });

    it("the hidden-ground check counts three rows a level behind a sheer face", () => {
      const g = gridFromRelief(scene());
      expect(checkRelief(g, "sheer").hidden).toBeGreaterThan(checkRelief(g).hidden);
    });

    it("lifts tiles and characters three cells a level, the same scale the renderer draws", () => {
      const relief = scene(), f = reliefLiftField(relief);
      expect(cellLift(f, 7, 4)).toBe(6);
      expect(cellLift(f, 16, 6)).toBe(9);
      expect(cellLift(f, 0, 12)).toBe(3);
      expect(f.maxLift).toBe(9);
    });
  });
  describe("sheer void and climbing cells (engine)", () => {
    it("nobody walks into the void (level 0) of a sheer map, except on a bridge deck", () => {
      const r = scene();
      expect(reliefAllowsStep(r, 3, 13, 3, 14)).toBe(false);
      expect(reliefAllowsStep(r, 3, 12, 3, 13)).toBe(true);
      // the same heights without the sheer style: level 0 is ordinary low ground (unchanged behaviour)
      expect(reliefAllowsStep(scene(null), 3, 13, 3, 14)).toBe(false); // a level step without a ramp is blocked anyway
      const bridged = scene(); bridged.levels[14 * W + 3] = 1; bridged.ramps![15 * W + 3] = 9; bridged.levels[15 * W + 3] = 1;
      expect(reliefAllowsStep(bridged, 3, 14, 3, 15)).toBe(true);
    });

    it("a ladder climbs the face one cell at a time on its own column, never from the side", () => {
      const r = scene();
      const s = reliefSlopes(r).find((q) => q.climb === RELIEF_LADDER);
      expect(s).toMatchObject({ x: 5, y: 8, w: 1, h: 2, dir: "n", lo: 1, hi: 2 });
      expect(reliefAllowsStep(r, 5, 10, 5, 9)).toBe(true);   // foot onto the ladder
      expect(reliefAllowsStep(r, 5, 9, 5, 8)).toBe(true);    // up the ladder
      expect(reliefAllowsStep(r, 5, 8, 5, 7)).toBe(true);    // off the top onto the plateau
      expect(reliefAllowsStep(r, 4, 9, 5, 9)).toBe(false);   // not from the side
      expect(reliefAllowsStep(r, 6, 8, 6, 7)).toBe(false);   // the face beside it is a wall
      expect(reliefClimbAt(r, 5, 9)).toBe(true);
      expect(reliefClimbAt(r, 6, 9)).toBe(false);
      // a character on the ladder rises along the face; the ladder cells' own tiles stay on the ground
      const f = reliefLiftField(r);
      expect(cellLift(f, 5, 9)).toBe(3);
      expect(footLift(f, 5.5, 8.5)).toBeGreaterThan(3);
      expect(footLift(f, 5.5, 8.5)).toBeLessThan(6);
    });

    it("vines walk like ladders; codes 10 and 11 survive normalize, other values are dropped", () => {
      const r = scene(); for (let y = 8; y < 10; y++) r.ramps![y * W + 5] = RELIEF_VINE;
      expect(reliefSlopes(r).find((q) => q.climb === RELIEF_VINE)).toBeDefined();
      expect(reliefAllowsStep(r, 5, 10, 5, 9)).toBe(true);
      const n = normalizeRelief({ ...r, ramps: r.ramps!.map((v, i) => (i === 0 ? 12 : v)) }, W, H)!;
      expect(n.ramps![0]).toBe(0);
      expect(n.ramps![8 * W + 5]).toBe(RELIEF_VINE);
    });

    it("the renderer hangs the ladder on the face instead of drawing a ramp surface", () => {
      const relief = scene(), opts = reliefRenderOptions(relief);
      expect(opts.climbs?.length).toBe(1);
      expect(opts.slopes?.some((s) => s.climb)).toBe(false);
      const r = render(relief), art = placeholderSheerArt(), wood = new Set<string>();
      for (let q = 0; q < art.ladder.rgba.length; q += 4) if (art.ladder.rgba[q + 3]) wood.add(`${art.ladder.rgba[q]},${art.ladder.rgba[q + 1]},${art.ladder.rgba[q + 2]}`);
      let onFace = 0;
      for (let i = 0; i < r.kind.length; i++) if (r.kind[i] === 1 && wood.has(`${r.rgba[i * 4]},${r.rgba[i * 4 + 1]},${r.rgba[i * 4 + 2]}`)) onFace++;
      expect(onFace).toBeGreaterThan(40);
    });
  });
});

describe("reliefUx2Pages", () => {
  isolateTimers();
  function fixture(style?: string): ReliefData {
    const r = emptyRelief(48, 48);
    r.style = style; r.ramps = r.levels.slice();
    for (let y = 8; y < 16; y++) for (let x = 10; x < 26; x++) r.levels[y * 48 + x] = 2;
    for (let y = 16; y < 18; y++) for (let x = 15; x < 17; x++) r.ramps[y * 48 + x] = 1;
    for (let x = 30; x < 38; x++) { r.levels[24 * 48 + x] = 1; r.ramps[24 * 48 + x] = 9; }
    return r;
  }
  const sceneOf = (r: ReliefData, ground?: ReliefGroundSurface): ReliefScene => ({ grids: reliefGrids(r), opts: reliefRenderOptions(r, ground) });
  const material: ReliefGroundSurface = { cells: new Int32Array(48 * 48), signature: 1, sample(x, y, out, at) {
    out[at] = x % 251; out[at + 1] = y % 239; out[at + 2] = (x + y) % 233; out[at + 3] = 255; return true;
  } };
  /** Check visible RGBA AND owner/under-over against the independent full bake,
   * including transparent holes. Retain only one small full reference at a time. */
  function parity(image: ReliefPagedImage, scene: ReliefScene, view: ReliefPageView): void {
    const full = reliefImageFromRender(renderRelief(scene.grids.eff, scene.opts), image.W, image.H);
    expect(image.pad).toBe(full.pad);
    const x0 = Math.max(0, view.x), x1 = Math.min(image.PW, view.x + view.width);
    const y0 = Math.max(0, view.y + image.pad), y1 = Math.min(image.SH, view.y + view.height + image.pad);
    const w = x1 - x0, n = w * (y1 - y0);
    const owner = new Int16Array(n).fill(-1), part = new Uint8Array(n), rgba = new Uint32Array(n);
    image.visit({ x0, x1, y0, y1 }, (x, y, row, p, color) => {
      const i = (y - y0) * w + x - x0; owner[i] = row; part[i] = p; rgba[i] = color;
    });
    const colors = new Uint32Array(full.rgba.buffer);
    let different = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y - y0) * w + x - x0, j = y * full.PW + x;
      if (owner[i] !== full.owner[j] || part[i] !== full.part[j] || rgba[i] !== (full.part[j] ? colors[j] : 0)) different++;
    }
    expect(different).toBe(0);
  }
  describe("relief UX2 page dependencies", () => {
    it.each([undefined, "grass-cliff", "tundra-snow"])("keeps page seams, ramps, bridge owners and world patterns (%s)", style => {
      const r = fixture(style), image = new ReliefPagedImage(48, 48), scene = sceneOf(r, material);
      const view = { x: 232, y: 216, width: 192, height: 224 }; // crosses x/y page boundaries
      image.sync(scene, "first", view);
      parity(image, scene, view);
      const field = reliefLiftField(r), x = 15.5, y = 16.5 - field.elevation[16 * 48 + 15]!;
      expect(reliefPickPoint(r, x * 16, y * 16, 16)).toMatchObject({ x: 15, y: 16, face: "top" });
      const stairs = copyRelief(r);
      for (let row = 16; row < 18; row++) for (let col = 15; col < 17; col++) stairs.ramps![row * 48 + col] = 5;
      const next = sceneOf(stairs, material);
      image.sync(next, "stairs", view);
      parity(image, next, view);
    });

    it("changes max pad in both directions without changing retained page coordinates", () => {
      let r = fixture(), scene = sceneOf(r), image = new ReliefPagedImage(48, 48);
      const view = { x: 0, y: -32, width: 320, height: 352 };
      image.sync(scene, "base", view);
      for (const level of [4, 1]) {
        const next = copyRelief(r);
        for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) next.levels[y * 48 + x] = level;
        const ns = sceneOf(next), plan = planReliefPatch(scene, ns, image);
        image.sync(ns, `pad-${level}`, view, undefined, plan === "same" ? [] : plan?.windows);
        expect(image.stats.originY).toBe(-image.pad);
        parity(image, ns, view);
        r = next; scene = ns;
      }
    });

    it("evicts pixels on pan and reconstructs on return without exploration growth", () => {
      const r = emptyRelief(96, 96);
      for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++) r.levels[y * 96 + x] = y < 6 ? 2 : 0;
      const scene = sceneOf(r), image = new ReliefPagedImage(96, 96);
      const positions = [64, 400, 768, 1120, 1400, 64];
      let maxPages = 0;
      for (let lap = 0; lap < 3; lap++) for (const x of positions) {
        image.sync(scene, "resident", { x, y: 64, width: 64, height: 64 });
        maxPages = Math.max(maxPages, image.stats.pages);
        expect(image.stats.pages).toBeLessThanOrEqual(16);
        expect(image.stats.bytes).toBe(image.stats.pages * RELIEF_PAGE ** 2 * 7);
      }
      expect(maxPages).toBeLessThan(96 * 96 * 16 * 16 / RELIEF_PAGE ** 2);
      parity(image, scene, { x: 64, y: 64, width: 64, height: 64 });
    });
  });
  describe("relief revision authority", () => {
    it("detects unversioned element/property writes on the same object", () => {
      const r = fixture(), signatures = [reliefSignature(r)];
      r.levels[10 * 48 + 12] = 4; signatures.push(reliefSignature(r));
      r.ramps![16 * 48 + 15] = 5; signatures.push(reliefSignature(r));
      r.style = "grass-cliff"; signatures.push(reliefSignature(r));
      r.wallDecor = [{ x: 12, y: 15, row: 1, tile: 0 }]; signatures.push(reliefSignature(r));
      r.wallDecor[0]!.tile = 1; signatures.push(reliefSignature(r));
      expect(new Set(signatures).size).toBe(signatures.length);
      bindReliefRevision(r, () => "same-generation");
      const old = reliefReadSignature(r);
      r.wallDecor[0]!.row = 2; // shallow draft alias, before store publication
      expect(reliefSignature(r)).not.toBe(old);
      expect(reliefReadSignature(r)).toBe(reliefSignature(r));
    });

    it("does zero warm array reads, then invalidates before a writer queries its draft", () => {
      const r = fixture(); let reads = 0, generation = 0;
      r.levels = new Proxy(r.levels, { get(target, key, receiver) { if (/^\d+$/.test(String(key))) reads++; return Reflect.get(target, key, receiver); } });
      bindReliefRevision(r, () => `${generation}`);
      const signature = reliefReadSignature(r); reads = 0;
      for (let i = 0; i < 100; i++) expect(reliefReadSignature(r)).toBe(signature);
      expect(reads).toBe(0);
      r.levels[10 * 48 + 12] = 4; invalidateReliefRevision(r);
      expect(reliefReadSignature(r)).not.toBe(signature);
      generation++; const next = reliefReadSignature(r); reads = 0;
      expect(reliefReadSignature(r)).toBe(next); expect(reads).toBe(0);
      // Production data is not instrumented: observation uses no proxy/accessor.
      const plain = fixture(); bindReliefRevision(plain, () => "snapshot"); reliefSignature(plain);
      expect(structuredClone(plain)).toEqual(plain);
    });
  });
});

describe("terrainDesignPersistence", () => {
  isolateTimers();
  function map(): GameMap { return { id: "terrain", name: "terrain", width: 8, height: 8, tileSize: 16, tilesetId: "ground", lowerTiles: new Array(64).fill(0), upperTiles: new Array(64).fill(-1), events: [] }; }
  describe("terrain design persistence and transformed content", () => {
    it("opens shallow water, blocks deep water and props, and permits bridge decks", () => {
      const p = createBlankProject(), m = map(); m.tilesetId = p.maps[p.startMapId].tilesetId;
      const tileset = p.tilesets[m.tilesetId];
      tileset.passability = [{ up: true, down: true, left: true, right: true }, { up: false, down: false, left: false, right: false }];
      tileset.priority = ["lower", "lower"];
      m.terrainDesign = { waterDepth: new Array(64).fill(0) }; m.terrainDesign.waterDepth![18] = 1; setLayerTileAt(m, 1, 18, 1);
      expect(canMove(p, m, 1, 2, 2, 2)).toBe(true);
      setLayerTileAt(m, 4, 18, 1); expect(isPassable(p, m, 2, 2)).toBe(false); setLayerTileAt(m, 4, 18, -1);
      m.terrainDesign.waterDepth![18] = 3; expect(isPassable(p, m, 2, 2)).toBe(false);
      m.relief = emptyRelief(8, 8); m.relief.ramps = new Array(64).fill(0); m.relief.ramps[18] = 9; setLayerTileAt(m, 1, 18, 0);
      expect(isPassable(p, m, 2, 2)).toBe(true);
    });
    it("keeps old maps absent, rejects invalid dimensions, and normalizes cell values", () => {
      expect(normalizeTerrainDesign(undefined, 4)).toBeUndefined();
      expect(normalizeTerrainDesign({ lockedCells: [0, 0, 4, -1], waterDepth: [0, 1, 99, NaN] }, 4)).toEqual({ lockedCells: [0], waterDepth: [0, 1, 14, 0] });
      expect(normalizeTerrainDesign({ waterDepth: [1] }, 4)).toBeUndefined();
    });
    it("clones depth/locks and moves both through a cropped map", () => {
      const before = map(); before.terrainDesign = { lockedCells: [18], waterDepth: new Array(64).fill(0) }; before.terrainDesign.waterDepth![18] = 3;
      const clone = cloneExtraLayers(before); clone.terrainDesign!.waterDepth![18] = 1;
      expect(before.terrainDesign.waterDepth![18]).toBe(3);
      cropExtraLayers(before, 8, 8, 2, 2, 3, 3);
      expect(before.terrainDesign!.lockedCells).toEqual([0]); expect(before.terrainDesign!.waterDepth![0]).toBe(3);
    });
    it("preserves all four layers, shadow, height, ramp and water in locked cells", () => {
      const before = map(); before.relief = emptyRelief(8, 8); before.relief.levels[18] = 2; before.relief.ramps = new Array(64).fill(0); before.relief.ramps[18] = 9;
      before.terrainDesign = { lockedCells: [18], waterDepth: new Array(64).fill(0) }; before.terrainDesign.waterDepth![18] = 2;
      setLayerTileAt(before, 2, 18, 5); setLayerTileAt(before, 4, 18, 7);
      setShadowAt(before, 18, 5);
      const next = { ...before, lowerTiles: before.lowerTiles.slice(), upperTiles: before.upperTiles.slice(), ...cloneExtraLayers(before) };
      for (const layer of [1, 2, 3, 4] as const) setLayerTileAt(next, layer, 18, 9); next.relief!.levels[18] = 4; next.relief!.ramps![18] = 0; next.terrainDesign!.waterDepth![18] = 0;
      setShadowAt(next, 18, 15);
      restoreLockedTerrainCells(before, next);
      for (const layer of [1, 2, 3, 4] as const) expect(layerTileAt(next, layer, 18)).toBe(layerTileAt(before, layer, 18));
      expect(next.relief!.levels[18]).toBe(2); expect(next.relief!.ramps![18]).toBe(9); expect(next.terrainDesign!.waterDepth![18]).toBe(2);
      expect(shadowAt(next, 18)).toBe(5);
    });
    it("composes map reflections after a rotated stamp and reflects its whole rectangle", () => {
      const stamp = captureTerrainStamp(map(), { x: 1, y: 1 }, { x: 3, y: 4 }, "rectangle");
      expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, false, 1, 40, 30)).toEqual({ anchor: { x: 31, y: 6 }, rotation: 3, mirror: true });
      expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, false, 2, 40, 30)).toEqual({ anchor: { x: 5, y: 21 }, rotation: 1, mirror: true });
      expect(symmetricStampPlacement(stamp, { x: 5, y: 6 }, 1, true, 4, 40, 40)).toEqual({ anchor: { x: 31, y: 5 }, rotation: 2, mirror: true });
    });
    it("rotates ramp direction and keeps multipart prop pixels upright", () => {
      const source = map(); source.relief = emptyRelief(8, 8); source.relief.ramps = new Array(64).fill(0); source.relief.ramps[18] = 1;
      setLayerTileAt(source, 3, 27, 7); setLayerTileAt(source, 3, 35, 8);
      const stamp = captureTerrainStamp(source, { x: 1, y: 1 }, { x: 6, y: 6 }, "hill"), rotated = transformTerrainStamp(stamp, 1, false);
      expect(rotated.cells.filter(c => c.ramp === 3)).toHaveLength(1);
      const top = rotated.cells.findIndex(c => c.layers[2] === 7); expect(rotated.cells[top + rotated.width]!.layers[2]).toBe(8);
      expect(normalizeTerrainStamps(JSON.parse(JSON.stringify([rotated])))?.[0]?.cells).toEqual(rotated.cells);
      expect(transformedRamp(3, 0, true)).toBe(4); expect(transformedRamp(5, 1, false)).toBe(7); expect(transformedRamp(9, 1, true)).toBe(9);
    });
    it("clears replaced runtime water depth without altering authored metadata", () => {
      const original = map(); original.terrainDesign = { waterDepth: new Array(64).fill(0) }; original.terrainDesign.waterDepth![18] = 3;
      const projected = runtimeMap(original, { mapOverrides: { terrain: { lower: { "18": 1 }, upper: {} } } });
      expect(projected.terrainDesign!.waterDepth![18]).toBe(0); expect(original.terrainDesign.waterDepth![18]).toBe(3); expect(layerTileAt(original, 1, 18)).toBe(0);
    });
  });
});
