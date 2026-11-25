import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { cloneExtraLayers, cropExtraLayers, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { normalizeTerrainDesign, normalizeTerrainStamps } from "@/project/terrainDesign";
import { restoreLockedTerrainCells } from "@/project/terrainLocks";
import { captureTerrainStamp, transformTerrainStamp, transformedRamp, symmetricStampPlacement } from "@/editor/terrainStamps";
import { emptyRelief, normalizeRelief } from "@/project/relief/edit";
import { runtimeMap } from "@/project/runtimeMap";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { effectiveHeights, renderRelief, reliefPadPx } from "@/project/relief/render";
import { cellLift, footLift, reliefLiftField, reliefRenderOptions } from "@/project/relief/screen";
import { compileReliefStyle, RELIEF_DEFAULT_RIM, RELIEF_STYLES, reliefFaceRows } from "@/project/relief/styles";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { RELIEF_LADDER, RELIEF_VINE, reliefAllowsStep, reliefClimbAt, reliefSlopes, rampCode } from "@/project/relief/walk";
import { cropReliefGrid, reliefGrids, reliefWindowFor, SHEER_REACH } from "@/project/relief/window";
import { checkRelief } from "@/project/relief/check";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import { deserialize, serialize } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { prepareWebExport } from "@/project/webExport";
import { isolateTimers } from "./mergedTeardown";

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

// test/reliefPersistence.test.ts
// 높이 지형(map.relief)이 저장·다시 열기·웹 내보내기를 거쳐도 단·경사로·벽면 장식이 그대로 남는다.
describe("reliefPersistence", () => {
  isolateTimers();
  // x ≥ 6 은 2단 대지, (5, 3) 은 동쪽으로 오르는 경사로, (6, 4) 남쪽 벽에 장식 한 장.
  function reliefProject(): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const levels = new Array(map.width * map.height).fill(0).map((_, i) => ((i % map.width) >= 6 ? 2 : 0));
    const ramps = new Array(map.width * map.height).fill(0);
    ramps[3 * map.width + 5] = rampCode("e");
    map.relief = { width: map.width, height: map.height, levels, ramps, wallDecor: [{ x: 6, y: 4, row: 1, tile: 7 }] };
    return project;
  }
  describe("relief persistence", () => {
    it("serialize → deserialize 가 relief 를 지키고, 두 번째 왕복도 같다", () => {
      const project = reliefProject();
      const expected = project.maps[project.startMapId]!.relief;
      const once = deserialize(serialize(project));
      expect(once.maps[project.startMapId]!.relief).toEqual(expected);
      const twice = deserialize(serialize(once));
      expect(twice.maps[project.startMapId]!.relief).toEqual(once.maps[project.startMapId]!.relief);
    });

    it(".oprn 패키지로 저장했다 다시 열어도 relief 가 같다", async () => {
      const project = reliefProject();
      const reopened = await readProjectPackage(createProjectPackage(project));
      expect(reopened.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
    });

    it("웹 내보내기 project.json 에 relief 가 남는다", () => {
      const project = reliefProject();
      const prepared = prepareWebExport(project);
      const exported = deserialize(prepared.projectJson);
      expect(exported.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
      expect(prepared.project.maps[project.startMapId]!.relief).toEqual(project.maps[project.startMapId]!.relief);
    });
  });
});
