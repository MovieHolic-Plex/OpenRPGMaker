import { describe, expect, it, afterAll, beforeAll } from "vitest";
import { cloneExtraLayers, cropExtraLayers, layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { normalizeTerrainDesign, normalizeTerrainStamps } from "@/project/terrainDesign";
import { restoreLockedTerrainCells } from "@/project/terrainLocks";
import { captureTerrainStamp, transformTerrainStamp, transformedRamp, symmetricStampPlacement } from "@/editor/terrainStamps";
import { emptyRelief, normalizeRelief, resizeRelief, brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { runtimeMap } from "@/project/runtimeMap";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { canMove, isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import { effectiveHeights, renderRelief, reliefPadPx } from "@/project/relief/render";
import { cellLift, footLift, MIN_RELIEF_STEP_DURATION_FACTOR, reliefLiftField, reliefRenderOptions, reliefStepMotion, pointLift, reliefRowStrips, reliefSignature, reliefPaintsCell } from "@/project/relief/screen";
import { compileReliefStyle, RELIEF_DEFAULT_RIM, RELIEF_STYLES, reliefFaceRows, RELIEF_WALL_FAMILIES, reliefRampArt, reliefStyleForGround, reliefStyleForTileset } from "@/project/relief/styles";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { RELIEF_LADDER, RELIEF_VINE, reliefAllowsStep, reliefClimbAt, reliefSlopes, rampCode } from "@/project/relief/walk";
import { cropReliefGrid, reliefGrids, reliefWindowFor, SHEER_REACH, applyReliefPatch, emptyReliefImage, planReliefPatch, reliefImageFromRender, type ReliefImage, type ReliefScene } from "@/project/relief/window";
import { checkRelief } from "@/project/relief/check";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";
import { deserialize, serialize } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { prepareWebExport } from "@/project/webExport";
import { isolateTimers } from "./mergedTeardown";
import { buildReliefOps } from "@/project/relief/ops";

describe("projectReliefSuite", () => {
  isolateTimers();
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

describe("render", () => {
  isolateTimers();
  // test/reliefLift.test.ts
  // 높이 지형의 화면 들림(relief/screen.ts)과 절벽 줄 띠: 타일·캐릭터가 그림의 윗면에 앉는 값, 경사로 보간, 줄 소유.
  describe("reliefLift", () => {
    isolateTimers();
    const W = 12, H = 12;
    // y ≤ 5 가 2단 대지(북쪽 고지대), 그 남쪽은 0단. x = 5 칸 (5, 6)·(5, 7) 은 북쪽으로 오르는 경사로(낮은 끝 0단).
    function plateau(): ReliefData {
      const levels = Array.from({ length: W * H }, (_, i) => (Math.floor(i / W) <= 5 ? 2 : 0));
      const ramps = new Array(W * H).fill(0);
      ramps[6 * W + 5] = rampCode("n");
      ramps[7 * W + 5] = rampCode("n");
      return { width: W, height: H, levels, ramps };
    }
    describe("relief lift", () => {
      it("고지대 칸은 그 단, 평지는 0, 맵 밖은 0 이다", () => {
        const field = reliefLiftField(plateau());
        expect(cellLift(field, 3, 2)).toBe(2);
        expect(cellLift(field, 3, 9)).toBe(0);
        expect(cellLift(field, -1, 2)).toBe(0);
      });

      it("매끈한 경사로 칸은 낮은 끝에서 높은 끝으로 칸 중심 위치만큼 오른다", () => {
        const field = reliefLiftField(plateau());
        // 경사로 길이 2칸, 오르막 북쪽: 남쪽 칸 중심은 1/4, 북쪽 칸 중심은 3/4 지점
        expect(cellLift(field, 5, 7)).toBeCloseTo(0.5);
        expect(cellLift(field, 5, 6)).toBeCloseTo(1.5);
      });

      it("계단 칸은 칸 중심이 딛는 디딤판 단에 선다", () => {
        const relief = plateau();
        relief.ramps![6 * W + 5] = rampCode("n", true);
        relief.ramps![7 * W + 5] = rampCode("n", true);
        const field = reliefLiftField(relief);
        // 계단 4단(길이 2 × 2): 칸 중심 1/4·3/4 은 디딤판 경계에 걸리고 그 위 디딤판(0.5·1.5단)을 딛는다
        expect(cellLift(field, 5, 7)).toBeCloseTo(0.5);
        expect(cellLift(field, 5, 6)).toBeCloseTo(1.5);
      });

      it("걷는 중 실수 좌표는 두 칸 사이를 보간하고 정수 좌표에서는 칸 값과 같다", () => {
        const field = reliefLiftField(plateau());
        expect(pointLift(field, 5, 7)).toBeCloseTo(cellLift(field, 5, 7));
        expect(pointLift(field, 5, 6.5)).toBeCloseTo((cellLift(field, 5, 6) + cellLift(field, 5, 7)) / 2);
      });

      it("들림은 렌더러가 실제로 그리는 높이를 따른다 — 1칸 폭 돌기는 깎여 0 이다", () => {
        const levels = new Array(W * H).fill(0);
        levels[6 * W + 6] = 3;
        const field = reliefLiftField({ width: W, height: H, levels });
        expect(cellLift(field, 6, 6)).toBe(0);
      });

      it("서명은 단·경사로·벽면 장식 어느 하나가 바뀌어도 달라진다", () => {
        const base = plateau();
        const withDecor = { ...base, wallDecor: [{ x: 3, y: 5, row: 1, tile: 7 }] };
        const otherDecor = { ...base, wallDecor: [{ x: 3, y: 5, row: 2, tile: 7 }] };
        const noRamp = { ...base, ramps: new Array(W * H).fill(0) };
        const signatures = new Set([base, withDecor, otherDecor, noRamp].map(reliefSignature));
        expect(signatures.size).toBe(4);
        expect(reliefSignature(plateau())).toBe(reliefSignature(base));
      });

      it("경사로 걸음은 4방향 모두 화면 이동 속도가 평지(1.0x)와 일정하게 유지된다", () => {
        const measureSpeeds = (field: ReturnType<typeof reliefLiftField>, path: readonly [number, number][], baseFrames = 20): number[] => {
          const speeds: number[] = [];
          for (let i = 0; i < path.length - 1; i += 1) {
            const [fx, fy] = path[i]!, [tx, ty] = path[i + 1]!;
            const motion = reliefStepMotion(field, fx, fy, tx, ty);
            const frames = Math.max(1, Math.round(baseFrames * motion.durationFactor));
            let prevX = fx + 0.5, prevY = fy + 1 - footLift(field, fx + 0.5, fy + 1);
            for (let f = 1; f <= frames; f += 1) {
              const a = motion.progress(f / frames);
              const x = fx + (tx - fx) * a + 0.5;
              const y = fy + (ty - fy) * a + 1;
              const sy = y - footLift(field, x, y);
              speeds.push(Math.hypot(x - prevX, sy - prevY) * baseFrames);
              prevX = x; prevY = sy;
            }
          }
          return speeds;
        };

        // 북향 2단 경사로(길이 2): 경사로 안 걸음은 2.0배 화면 거리 → 2.0배 시간, 전 구간 1.0x 균속
        const northField = reliefLiftField(plateau());
        expect(reliefStepMotion(northField, 5, 8, 5, 7).durationFactor).toBe(1);
        expect(reliefStepMotion(northField, 5, 7, 5, 6).durationFactor).toBeCloseTo(2);
        expect(reliefStepMotion(northField, 5, 6, 5, 5).durationFactor).toBeCloseTo(2);
        expect(reliefStepMotion(northField, 5, 5, 5, 4).durationFactor).toBe(1);
        for (const v of measureSpeeds(northField, [[5, 8], [5, 7], [5, 6], [5, 5], [5, 4]])) {
          expect(v).toBeCloseTo(1, 2);
        }

        // 남향 2단 경사로(길이 4): 경사로 안 걸음은 0.5배 화면 거리 → 0.5배 시간, 전 구간 1.0x 균속
        const sLevels = Array.from({ length: W * H }, (_, i) => (Math.floor(i / W) >= 8 ? 2 : 0));
        const sRamps = new Array<number>(W * H).fill(0);
        for (let y = 4; y <= 7; y += 1) sRamps[y * W + 5] = rampCode("s");
        const southField = reliefLiftField({ width: W, height: H, levels: sLevels, ramps: sRamps });
        expect(reliefStepMotion(southField, 5, 3, 5, 4).durationFactor).toBeCloseTo(0.5);
        expect(reliefStepMotion(southField, 5, 4, 5, 5).durationFactor).toBeCloseTo(0.5);
        expect(reliefStepMotion(southField, 5, 7, 5, 8).durationFactor).toBe(1);
        for (const v of measureSpeeds(southField, [[5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [5, 7], [5, 8]])) {
          expect(v).toBeCloseTo(1, 2);
        }

        // 동향 2단 경사로(길이 2): 진입·탈출 걸음의 평지/경사 경계도 호 길이 보간으로 전 프레임 1.0x 균속
        const eLevels = Array.from({ length: W * H }, (_, i) => ((i % W) >= 7 ? 2 : 0));
        const eRamps = new Array<number>(W * H).fill(0);
        eRamps[5 * W + 5] = rampCode("e");
        eRamps[5 * W + 6] = rampCode("e");
        const eastField = reliefLiftField({ width: W, height: H, levels: eLevels, ramps: eRamps });
        expect(reliefStepMotion(eastField, 4, 5, 5, 5).durationFactor).toBeCloseTo(0.5 + Math.SQRT1_2);
        expect(reliefStepMotion(eastField, 5, 5, 6, 5).durationFactor).toBeCloseTo(Math.SQRT2);
        expect(reliefStepMotion(eastField, 6, 5, 7, 5).durationFactor).toBeCloseTo(0.5 + Math.SQRT1_2);
        for (const v of measureSpeeds(eastField, [[3, 5], [4, 5], [5, 5], [6, 5], [7, 5]], 40)) {
          expect(v).toBeGreaterThan(0.95);
          expect(v).toBeLessThan(1.05);
        }

        // 벽면에 판 계단(carvedStairs)도 전체 1배속 걸음 시간을 유지하면서 디딤판 단차 점프 기믹을 보존한다
        const carved = { ...plateau(), style: "desert" };
        carved.ramps![6 * W + 5] = rampCode("n", true);
        carved.ramps![7 * W + 5] = rampCode("n", true);
        const carvedField = reliefLiftField(carved);
        expect(reliefStepMotion(carvedField, 5, 7, 5, 6).durationFactor).toBeCloseTo(2);
        expect(reliefStepMotion(carvedField, 5, 6, 5, 5).durationFactor).toBeCloseTo(2);
        expect(footLift(carvedField, 5.5, 7.2)).toBe(0);
        expect(footLift(carvedField, 5.5, 6.5)).toBe(1);

        // 화면 거리가 0이 되는 퇴화 남향 1칸 경사로도 최소 배수(MIN_RELIEF_STEP_DURATION_FACTOR)로 보호된다
        const degLevels = Array.from({ length: W * H }, (_, i) => (Math.floor(i / W) >= 6 ? 1 : 0));
        const degRamps = new Array<number>(W * H).fill(0);
        degRamps[5 * W + 5] = rampCode("s");
        const degField = reliefLiftField({ width: W, height: H, levels: degLevels, ramps: degRamps });
        expect(reliefStepMotion(degField, 5, 4, 5, 5).durationFactor).toBe(MIN_RELIEF_STEP_DURATION_FACTOR);
      });
    });
    describe("relief transparent ground", () => {
      it("경사로 아랫도리는 반올림 단이 0 이어도 불투명하다 — 들린 만큼 비는 자리에 타일이 없다", () => {
        const relief = plateau();
        const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
        let checked = 0;
        for (let i = 0; i < render.kind.length; i++) {
          if (render.kind[i] !== 0 || render.slope[i] === 0 || render.height[i] < 1e-6) continue;
          expect(render.rgba[i * 4 + 3]).toBe(255);
          checked++;
        }
        expect(checked).toBeGreaterThan(0);
        // 평지(높이 0) 화소는 여전히 투명해 밑 타일이 보인다
        const flat = (render.pad + 10 * 16 + 4) * render.PW + 2 * 16 + 4;
        expect(render.height[flat]).toBe(0);
        expect(render.rgba[flat * 4 + 3]).toBeLessThan(255);
      });
    });
    describe("relief row strips", () => {
      it("대지 남쪽 끝 줄의 벽 띠는 그 줄 윗면 바로 아래에 단 수만큼 내려온다", () => {
        const relief = plateau();
        const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
        const wall = reliefRowStrips(render, W, "over").find((strip) => strip.row === 5);
        expect(wall).toBeDefined();
        // 줄 5 윗면은 화면 y = 5·16 + pad - 2·16, 벽은 그 아래(줄 6 자리)에서 2단 = 32px
        const topOfRow = 5 * 16 + render.pad - 2 * 16;
        // 띠 상자에는 맵 가장자리 테두리(edge)도 든다 — 벽 화소(kind≠0)만 따로 재서 그 위치를 본다.
        let wallTop = Infinity, wallBottom = -1;
        for (let i = 0; i < render.src.length; i++) {
          if (render.src[i] < 0 || Math.floor(render.src[i] / W) !== 5 || render.kind[i] === 0 || render.rgba[i * 4 + 3] === 0) continue;
          const sy = (i / render.PW) | 0;
          wallTop = Math.min(wallTop, sy);
          wallBottom = Math.max(wallBottom, sy);
        }
        expect(wallTop).toBeGreaterThanOrEqual(topOfRow + 16);
        expect(wallBottom).toBeLessThanOrEqual(topOfRow + 16 + 2 * 16 + 1);
      });

      it("윗면 띠(under)에는 고지대 줄만 있고 평지 줄은 없다", () => {
        const relief = plateau();
        const render = renderRelief(effectiveHeights(gridFromRelief(relief)), { transparentGround: true, slopes: reliefSlopes(relief) });
        const rows = new Set(reliefRowStrips(render, W, "under").map((strip) => strip.row));
        expect(rows.has(2)).toBe(true);
        expect(rows.has(10)).toBe(false);
      });
    });
  });
  describe("reliefStyle", () => {
    isolateTimers();
    const W = 12, H = 10;
    const terrace = (): ReliefData => {
      const levels = new Array(W * H).fill(0);
      for (let y = 0; y < 4; y++) for (let x = 0; x < W; x++) levels[y * W + x] = 3;
      return { width: W, height: H, levels };
    };
    const wallPixels = (style?: string) => {
      const r = renderRelief(effectiveHeights(gridFromRelief(terrace())), { style });
      const px: number[] = [];
      for (let i = 0; i < r.kind.length; i++) if (r.kind[i] === 1) px.push(r.rgba[i * 4]!, r.rgba[i * 4 + 1]!, r.rgba[i * 4 + 2]!);
      return px;
    };
    describe("relief wall styles", () => {
      it("natural ramps remain one opaque surface with continuous lift even without biome art", () => {
        const relief: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ramps: new Array(W * H).fill(0) };
        for (let y = 1; y < 4; y++) for (let x = 1; x < W - 1; x++) relief.levels[y * W + x] = 3;
        for (let y = 4; y < 8; y++) for (const x of [3, 4, 5, 6]) relief.ramps![y * W + x] = 1;
        expect(reliefSlopes(relief)[0]?.steps).toBeUndefined();
        expect(reliefPaintsCell(relief, 4, 4)).toBe(true);
        expect(reliefPaintsCell(relief, 4, 7)).toBe(true);
        const lift = reliefLiftField(relief);
        expect(cellLift(lift, 4, 4)).toBeCloseTo(2.625);
        expect(cellLift(lift, 4, 5)).toBeCloseTo(1.875);
        const rendered = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief));
        const surface = Array.from(rendered.src.keys()).filter(i => rendered.kind[i] === 0 && rendered.slope[i] > 0);
        expect(surface.length).toBeGreaterThan(0);
        for (const i of surface) {
          expect(rendered.rgba[i * 4 + 3]).toBe(255);
          expect(rendered.overSlope?.[i]).toBe(1);
        }
      });

      // 2026-11-14 오너 「계단을 이딴 식으로 하면 절대 안 된다니까 ?」: 렌더러가 디딤판 계단을 회색 벽돌로 칠하던 길은 없다.
      const GRAY_BRICK = new Set(["47,49,46", "72,75,70", "103,107,98", "137,141,129", "176,180,165", "210,213,199"]);
      const stairScene = (style?: string): ReliefData => {
        const relief: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ramps: new Array(W * H).fill(0), ...(style ? { style } : {}) };
        for (let y = 1; y < 4; y++) for (let x = 1; x < W - 1; x++) relief.levels[y * W + x] = 3;
        for (let y = 4; y < 8; y++) for (const x of [4, 5]) relief.ramps![y * W + x] = 5;
        return relief;
      };

      it("default stairs are the chipset stone-stair art on a continuous flight, opaque down to the foot", () => {
        const relief = stairScene();
        expect(reliefPaintsCell(relief, 4, 4)).toBe(true);
        expect(reliefPaintsCell(relief, 4, 7)).toBe(true);
        expect(reliefSlopes(relief)[0]?.steps).toBeUndefined();
        const rendered = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief));
        const flight = Array.from(rendered.src.keys()).filter(i => rendered.kind[i] === 0 && rendered.slope[i] > 0);
        expect(flight.length).toBeGreaterThan(0);
        const art = reliefRampArt("grass-steps")!.lit, artColours = new Set<string>();
        for (let q = 0; q < art.rgba.length; q += 4) artColours.add(`${art.rgba[q]},${art.rgba[q + 1]},${art.rgba[q + 2]}`);
        let fromArt = 0;
        for (const i of flight) {
          expect(rendered.rgba[i * 4 + 3]).toBe(255);
          expect(rendered.overSlope?.[i]).toBe(1);
          if (artColours.has(Array.from(rendered.rgba.slice(i * 4, i * 4 + 3)).join(","))) fromArt += 1;
        }
        expect(fromArt / flight.length).toBeGreaterThan(0.9);
      });

      it("no style paints the renderer's gray brick stair — every stair is carved in its own material or the chipset stair art", () => {
        for (const style of [undefined, ...Object.keys(RELIEF_STYLES)]) {
          const relief = stairScene(style), spec = style ? RELIEF_STYLES[style]! : undefined;
          // stepped flights exist only where the style carves them into its own face
          expect(reliefSlopes(relief).some((s) => !!s.steps), style).toBe(!!spec?.carvedStairs);
          // even a caller that hands the renderer stepped slopes for a non-carving style gets a continuous flight, never bricks
          const forced = { ...reliefRenderOptions(relief), slopes: reliefSlopes(relief).map((s) => ({ ...s, steps: 8 })) };
          for (const opts of [reliefRenderOptions(relief), forced]) {
            const r = renderRelief(effectiveHeights(gridFromRelief(relief)), opts);
            const ramp = new Set([...(spec ? [...spec.top, ...spec.wall, ...spec.accent] : [])].map((hex) => [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)).join(",")));
            let gray = 0;
            for (let i = 0; i < r.src.length; i++) {
              if (!r.slope[i] || !r.rgba[i * 4 + 3]) continue;
              const rgb = `${r.rgba[i * 4]},${r.rgba[i * 4 + 1]},${r.rgba[i * 4 + 2]}`;
              if (GRAY_BRICK.has(rgb) && !ramp.has(rgb)) gray += 1;
            }
            expect(gray, style).toBe(0);
          }
        }
      });

      it("cliff looks: natural faces do not repeat a 16px tile, keep the walk shape, and take the chipset stair pieces", () => {
        const LOOKS = ["cliff-earth", "cliff-strata", "cliff-rubble", "cliff-ledge", "cliff-crag", "cliff-rock"];
        // a long straight three-cell face: 40 cells wide
        const BW = 40, BH = 8, levels = new Array(BW * BH).fill(0);
        for (let y = 1; y < 4; y++) for (let x = 0; x < BW; x++) levels[y * BW + x] = 3;
        // same geometry as the grass bank they replace (both draw the back slope on the low ground's own cells)
        const grass = renderRelief(effectiveHeights(gridFromRelief({ width: BW, height: BH, levels, style: "grass-steps" })), { style: "grass-steps" });
        for (const style of LOOKS) {
          const spec = RELIEF_STYLES[style]!;
          expect(spec.natural, style).toBeDefined();
          expect(spec.carvedStairs, style).toBeUndefined();
          expect(reliefRampArt(style), style).toBe(reliefRampArt("grass-steps"));
          const r = renderRelief(effectiveHeights(gridFromRelief({ width: BW, height: BH, levels, style })), { style });
          expect(Array.from(r.kind), style).toEqual(Array.from(grass.kind));
          expect(Array.from(r.src), style).toEqual(Array.from(grass.src));
          // wall rows 8..40 px below the lip: compare each 16px column block with the next one — a tiled face repeats exactly
          const y0 = r.pad + 4 * 16 - 3 * 16 + 8, block = (bx: number) => { const out: number[] = []; for (let y = y0; y < y0 + 32; y++) for (let x = bx * 16; x < bx * 16 + 16; x++) out.push(r.rgba[(y * r.PW + x) * 4]!, r.rgba[(y * r.PW + x) * 4 + 1]!); return out.join(","); };
          const blocks = Array.from({ length: BW - 2 }, (_, k) => block(k + 1));
          expect(new Set(blocks).size, style).toBe(blocks.length);
          for (let i = 0; i < r.kind.length; i++) if (r.kind[i] === 1) expect(r.rgba[i * 4 + 3]).toBe(255);
        }
        // the tiled families do repeat (what the natural faces replace)
        const tiled = renderRelief(effectiveHeights(gridFromRelief({ width: BW, height: BH, levels, style: "elf" })), { style: "elf" });
        const y0 = tiled.pad + 4 * 16 - 3 * 16 + 8, tb = (bx: number) => { const out: number[] = []; for (let y = y0; y < y0 + 8; y++) for (let x = bx * 16; x < bx * 16 + 16; x++) out.push(tiled.rgba[(y * tiled.PW + x) * 4]!); return out.join(","); };
        expect(new Set(Array.from({ length: 12 }, (_, k) => tb(k + 2))).size).toBeLessThan(12);
        // ground variants of a cliff look exist without a table row and keep its face
        expect(reliefStyleForGround("cliff-rock", "ground-sand")).toBe("cliff-rock@ground-sand");
        expect(compileReliefStyle("cliff-rock@ground-sand")!.natural).toBe("rock");
        expect(compileReliefStyle("cliff-rock@ground-sand")!.ramps[0]).toEqual(compileReliefStyle("grass-steps@ground-sand")!.ramps[0]);
        expect(reliefStyleForGround("cliff-rock", "ground-nope")).toBe("cliff-rock");
        expect(RELIEF_STYLES["cliff-rock@ground-sand"]).toBeUndefined();
      });

      it("renders a bridge underside with the default two-ramp palette and biome accent palettes", () => {
        for (const style of [undefined, "grass-cliff"]) {
          const relief: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ramps: new Array(W * H).fill(0), ...(style ? { style } : {}) };
          for (let y = 2; y < 7; y++) for (let x = 1; x < W - 1; x++) {
            if (x < 4 || x > 7) relief.levels[y * W + x] = 3;
            else if (y === 4 || y === 5) { relief.levels[y * W + x] = 3; relief.ramps![y * W + x] = 9; }
          }
          const result = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief));
          const underside = Array.from(result.kind.keys()).filter(i => result.kind[i] === 1 && relief.ramps![result.src[i]!] === 9);
          expect(underside.length).toBeGreaterThan(0);
          expect(underside.some(i => result.rgba[i * 4 + 3]! > 0)).toBe(true);
        }
      });

      it("every family is a literal pixel grid of even rows and legal glyphs", () => {
        for (const [name, art] of Object.entries(RELIEF_WALL_FAMILIES)) {
          for (const g of [art.lip, ...art.body]) {
            expect(g.length, name).toBeGreaterThan(0);
            for (const row of g) {
              expect(row.length, `${name} ${row}`).toBe(g[0]!.length);
              expect(row, name).toMatch(/^[0-5a-fA-F.]+$/);
            }
          }
        }
        expect(Object.keys(RELIEF_WALL_FAMILIES).sort()).toEqual(["basalt", "crystal", "earth", "masonry", "peat", "snow", "strata"]);
      });

      it("every biome style compiles and names a known family", () => {
        for (const [name, spec] of Object.entries(RELIEF_STYLES)) {
          expect(RELIEF_WALL_FAMILIES[spec.family], name).toBeDefined();
          for (const ramp of [spec.top, spec.wall, spec.accent]) expect(ramp, name).toHaveLength(6);
          expect(compileReliefStyle(name), name).not.toBeNull();
        }
        expect(compileReliefStyle("no-such-style")).toBeNull();
        expect(reliefStyleForTileset("atlas_biome_tundra")).toBe("tundra");
        expect(reliefStyleForTileset("village")).toBeUndefined();
      });

      it("the style changes the wall pixels, and unknown style falls back to the default wall", () => {
        const plain = wallPixels(), tundra = wallPixels("tundra"), dwarf = wallPixels("dwarf");
        expect(plain.length).toBeGreaterThan(0);
        expect(tundra).toHaveLength(plain.length);
        expect(tundra).not.toEqual(plain);
        expect(dwarf).not.toEqual(tundra);
        expect(wallPixels("no-such-style")).toEqual(plain);
        // the walkable shape does not depend on the style: same wall cells in the same places
        const a = renderRelief(effectiveHeights(gridFromRelief(terrace())));
        const b = renderRelief(effectiveHeights(gridFromRelief(terrace())), { style: "crystal" });
        expect(Array.from(b.kind)).toEqual(Array.from(a.kind));
        expect(Array.from(b.src)).toEqual(Array.from(a.src));
      });

      it("grass-steps paints a back slope behind the crest, on the low ground's own cells", () => {
        // a two-level block in the middle of a flat map: its north edge is the crest, the rows north of it are level 0 ground
        const BW = 12, BH = 12, levels = new Array(BW * BH).fill(0);
        for (let y = 6; y <= 8; y++) for (let x = 3; x <= 8; x++) levels[y * BW + x] = 2;
        const draw = (style: string) => { const relief: ReliefData = { width: BW, height: BH, levels, style }; return renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief)); };
        const px = 6 * 16 + 4;
        const at = (r: ReturnType<typeof draw>, k: number) => {
          const i = (r.pad + 6 * 16 - 2 * 16 - k) * r.PW + px;   // k px north of the crest outline on screen
          return { rgba: Array.from(r.rgba.slice(i * 4, i * 4 + 4)), kind: r.kind[i], lev: r.lev[i], row: Math.floor(r.src[i]! / BW) };
        };
        const ramp = (style: string, n: number) => { const hex = RELIEF_STYLES[style]!.top[n]!; return [1, 3, 5].map((o) => parseInt(hex.slice(o, o + 2), 16)); };
        for (const style of ["grass-steps", "grass-steps@ground-sand"]) {
          const r = draw(style);
          expect(compileReliefStyle(style)!.rim!.back).toBe(12);
          expect(at(r, 0)).toMatchObject({ kind: 0, lev: 2, row: 6 });                                   // the crest outline belongs to the raised cell
          // right behind the crest: two solid rows of the top ramp's shade, then a lighter band, thinning out to nothing after 12 px —
          // every one of them still a top pixel of the level 0 cell it lies on (a character standing there is not covered, a click picks that cell)
          for (const k of [1, 2]) expect(at(r, k)).toEqual({ rgba: [...ramp(style, 1), 255], kind: 0, lev: 0, row: 3 });
          for (const k of [3, 12]) expect(at(r, k)).toEqual({ rgba: [...ramp(style, 2), 255], kind: 0, lev: 0, row: 3 });
          expect(at(r, 13)).toEqual({ rgba: [0, 0, 0, 0], kind: 0, lev: 0, row: 3 });
        }
        // styles without rim.back keep the short earth bank: wall pixels owned by the raised cell, nothing beyond it
        for (const style of ["grass-cliff", "snow-steps", "sand-steps"]) {
          const r = draw(style);
          expect(compileReliefStyle(style)!.rim!.back).toBeUndefined();
          expect(at(r, 2)).toMatchObject({ kind: 1, row: 6 });
          expect(at(r, 6).rgba[3]).toBe(0);
        }
      });

      it("style survives normalize, resize, signature and a save / reload round trip", () => {
        const relief = { ...terrace(), style: "tundra" };
        expect(normalizeRelief(relief, W, H)?.style).toBe("tundra");
        expect(resizeRelief(relief, W + 2, H).style).toBe("tundra");
        expect(reliefSignature(relief)).not.toBe(reliefSignature(terrace()));
        const project = createBlankProject();
        const map = project.maps[project.startMapId]!;
        const lv = new Array(map.width * map.height).fill(0);
        for (let x = 0; x < map.width; x++) lv[x] = 2;
        map.relief = { width: map.width, height: map.height, levels: lv, style: "badlands" };
        const back = deserialize(serialize(project));
        expect(back.maps[project.startMapId]!.relief?.style).toBe("badlands");
      });
    });
  });
  // test/reliefWindow.test.ts
  // 높이 붓 부분 다시 굽기(relief/window.ts)가 전체 굽기와 화소 하나 다르지 않은지 — 무작위로 더 많이 돌리는 확인은 scripts/check-relief-window.mts.
  describe("reliefWindow", () => {
    isolateTimers();
    const sceneOf = (r: ReliefData): ReliefScene => ({ grids: reliefGrids(r), opts: reliefRenderOptions(r) });
    const full = (r: ReliefData): ReliefImage => reliefImageFromRender(renderRelief(reliefGrids(r).eff, reliefRenderOptions(r)), r.width, r.height);
    /** 다른 화소 수(RGBA·주인 줄·띠 중 하나라도 다르면 1) */
    function differing(a: ReliefImage, b: ReliefImage): number {
      expect([a.PW, a.SH, a.pad]).toEqual([b.PW, b.SH, b.pad]);
      let n = 0;
      for (let i = 0; i < a.owner.length; i++) {
        if (a.owner[i] !== b.owner[i] || a.part[i] !== b.part[i]) { n++; continue; }
        for (let c = 0; c < 4; c++) if (a.rgba[i * 4 + c] !== b.rgba[i * 4 + c]) { n++; break; }
      }
      return n;
    }
    function hill(W: number, H: number, style?: string): ReliefData {
      const r: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ...(style ? { style } : {}) };
      brushRelief(r, Math.floor(W / 2), Math.floor(H / 2), "set", { radius: 5, level: 3 });
      return r;
    }
    /** 붓질들을 차례로 칠하며 매번 창 굽기 결과 == 전체 굽기. 창 굽기를 실제로 쓴 횟수를 돌려준다. */
    function paint(start: ReliefData | null, base: ReliefData, strokes: readonly [number, number, ReliefBrushMode, number?][]): number {
      let relief = start ?? { ...base, levels: base.levels.map(() => 0) };
      let image = start ? full(start) : emptyReliefImage(base.width, base.height);
      let prev: ReliefScene | null = start ? sceneOf(start) : null;
      let windowed = 0;
      for (const [x, y, mode, level] of strokes) {
        const next: ReliefData = { ...relief, levels: relief.levels.slice() };
        brushRelief(next, x, y, mode, { radius: 2, ...(level === undefined ? {} : { level }) });
        const scene = sceneOf(next), truth = full(next);
        expect(reliefPadPx(scene.grids.pruned, scene.opts.slopes ?? [])).toBe(truth.pad);
        const plan = planReliefPatch(prev, scene, image);
        if (plan === null) image = truth;
        else if (plan !== "same") { applyReliefPatch(image, scene, plan); windowed++; }
        expect(differing(image, truth)).toBe(0);
        relief = next; prev = scene;
      }
      return windowed;
    }
    describe("relief 부분 다시 굽기", () => {
      it("언덕을 올리고 내리는 붓질이 전체 굽기와 같다", () => {
        expect(paint(hill(40, 34), hill(40, 34), [[12, 10, "raise"], [13, 11, "raise"], [25, 20, "lower"], [20, 17, "set", 1]])).toBeGreaterThan(0);
      });
      it("최고 단이 바뀌어 pad 가 바뀌어도 같다(버퍼를 밀고 맨 위 띠를 다시 굽는다)", () => {
        expect(paint(hill(40, 34, "grass-cliff"), hill(40, 34), [[8, 4, "set", 6], [8, 4, "set", 0], [30, 2, "mountain", 5]])).toBeGreaterThan(0);
      });
      it("가장 높은 땅을 낮춰 pad 가 줄어도 같다(옛 그림의 화소는 옛 최고 단까지 들려 있다)", () => {
        // 6단 둔덕 하나뿐인 맵에서 그 둔덕을 3단으로 낮춘다 — pad 96 → 48. 창 높이를 새 pad 로만 잡으면 옛 둔덕 윗부분이 그림에 남았다.
        const mound = (style?: string): ReliefData => {
          const r: ReliefData = { width: 40, height: 33, levels: new Array(40 * 33).fill(0), ...(style ? { style } : {}) };
          brushRelief(r, 20, 16, "set", { radius: 2, level: 6 });
          return r;
        };
        for (const style of [undefined, "grass-steps", "grass-cliff"]) expect(paint(mound(style), mound(style), [[20, 16, "set", 3]])).toBe(1);
      });
      it("빈 맵에 처음 칠할 때 평지 그림에서 창으로 굽는다", () => {
        expect(paint(null, hill(40, 34, "swamp-peat"), [[20, 16, "raise"], [22, 16, "raise"], [24, 17, "set", 4]])).toBeGreaterThan(0);
      });
      it("맵 가장자리 붓(줄 끝이 반대쪽 끝을 읽는 곳)도 같다", () => {
        expect(paint(hill(40, 34), hill(40, 34), [[0, 15, "set", 4], [39, 16, "set", 3], [20, 33, "set", 5], [20, 0, "set", 2]])).toBeGreaterThan(0);
      });
      it("경사로·계단 둘레에서 단이 바뀌어도 같다", () => {
        const r = hill(40, 34, "tundra-snow");
        const ramps = new Array(40 * 34).fill(0);
        for (let x = 18; x < 21; x++) { ramps[23 * 40 + x] = rampCode("n", true); r.levels[23 * 40 + x] = r.levels[22 * 40 + x]!; }
        r.ramps = ramps;
        paint(r, r, [[19, 20, "raise"], [10, 12, "lower"], [19, 25, "set", 2]]);
      });
    });
  });
});
