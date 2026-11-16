// 깎아지른 지형(relief.style "sheer", 2026-11-16): 단 하나 = 앞면 3칸, 조각에서 읽는 면, 엽 끝에서 도는 면, 빈 곳, 세로 이동 칸(사다리·덩굴).
// 저장소 안 시험은 코드로 만든 자리 표시 조각(sheerArt.ts placeholderSheerArt)만 쓴다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { effectiveHeights, renderRelief, reliefPadPx } from "@/project/relief/render";
import { cellLift, footLift, reliefLiftField, reliefRenderOptions } from "@/project/relief/screen";
import { compileReliefStyle, RELIEF_DEFAULT_RIM, RELIEF_STYLES, reliefFaceRows } from "@/project/relief/styles";
import { gridFromRelief, type ReliefData } from "@/project/relief/types";
import { RELIEF_LADDER, RELIEF_VINE, reliefAllowsStep, reliefClimbAt, reliefSlopes } from "@/project/relief/walk";
import { cropReliefGrid, reliefGrids, reliefWindowFor, SHEER_REACH } from "@/project/relief/window";
import { checkRelief } from "@/project/relief/check";
import { normalizeRelief } from "@/project/relief/edit";
import { placeholderSheerArt, setSheerArt } from "@/project/relief/sheerArt";

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
