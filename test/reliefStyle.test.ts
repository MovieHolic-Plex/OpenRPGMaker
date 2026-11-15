import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { normalizeRelief, resizeRelief } from "@/project/relief/edit";
import { effectiveHeights, renderRelief } from "@/project/relief/render";
import { cellLift, reliefLiftField, reliefPaintsCell, reliefRenderOptions, reliefSignature } from "@/project/relief/screen";
import { compileReliefStyle, RELIEF_STYLES, RELIEF_WALL_FAMILIES, reliefRampArt, reliefStyleForGround, reliefStyleForTileset } from "@/project/relief/styles";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { createBlankProject } from "@/project/defaults";
import { reliefSlopes } from "@/project/relief/walk";

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
