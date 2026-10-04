import { describe, expect, it } from "vitest";
import { emptyRelief, copyRelief } from "@/project/relief/edit";
import { ReliefPagedImage, RELIEF_PAGE, type ReliefPageView } from "@/project/relief/paged";
import { renderRelief, type ReliefGroundSurface } from "@/project/relief/render";
import { bindReliefRevision, invalidateReliefRevision } from "@/project/relief/revision";
import { reliefLiftField, reliefPickPoint, reliefRenderOptions, reliefSignature, reliefReadSignature } from "@/project/relief/screen";
import type { ReliefData } from "@/project/relief/types";
import { planReliefPatch, reliefGrids, reliefImageFromRender, type ReliefScene } from "@/project/relief/window";

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
