import { describe, expect, it } from "vitest";
import { deserialize, serialize } from "@/project/io";
import { normalizeRelief, resizeRelief } from "@/project/relief/edit";
import { effectiveHeights, renderRelief } from "@/project/relief/render";
import { cellLift, reliefLiftField, reliefPaintsCell, reliefRenderOptions, reliefSignature } from "@/project/relief/screen";
import { compileReliefStyle, RELIEF_STYLES, RELIEF_WALL_FAMILIES, reliefStyleForTileset } from "@/project/relief/styles";
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

  it("default stairs own their stone treads, including the ground-level foot", () => {
    const relief: ReliefData = { width: W, height: H, levels: new Array(W * H).fill(0), ramps: new Array(W * H).fill(0) };
    for (let y = 1; y < 4; y++) for (let x = 1; x < W - 1; x++) relief.levels[y * W + x] = 3;
    for (let y = 4; y < 8; y++) for (const x of [4, 5]) relief.ramps![y * W + x] = 5;
    expect(reliefPaintsCell(relief, 4, 4)).toBe(true);
    expect(reliefPaintsCell(relief, 4, 7)).toBe(true);
    const rendered = renderRelief(effectiveHeights(gridFromRelief(relief)), reliefRenderOptions(relief));
    const foot = Array.from(rendered.src.keys()).filter(i => rendered.kind[i] === 0 && rendered.slope[i] > 0 && rendered.height[i] === 0);
    expect(foot.length).toBeGreaterThan(0);
    for (const i of foot) {
      const rgb = Array.from(rendered.rgba.slice(i * 4, i * 4 + 3));
      expect(rendered.rgba[i * 4 + 3]).toBe(255);
      expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(25);
    }
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
