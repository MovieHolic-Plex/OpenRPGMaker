import { describe, expect, it } from "vitest";
import { effectiveHeights, renderRelief, reliefPadPx } from "@/project/relief/render";
import { cellLift, pointLift, reliefLiftField, reliefRowStrips, reliefSignature, reliefPaintsCell, reliefRenderOptions } from "@/project/relief/screen";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { rampCode, reliefSlopes } from "@/project/relief/walk";
import { deserialize, serialize } from "@/project/io";
import { normalizeRelief, resizeRelief, brushRelief, type ReliefBrushMode } from "@/project/relief/edit";
import { compileReliefStyle, RELIEF_STYLES, RELIEF_WALL_FAMILIES, reliefRampArt, reliefStyleForGround, reliefStyleForTileset } from "@/project/relief/styles";
import { createBlankProject } from "@/project/defaults";
import { applyReliefPatch, emptyReliefImage, planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefImage, type ReliefScene } from "@/project/relief/window";
import { isolateTimers } from "./mergedTeardown";

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
