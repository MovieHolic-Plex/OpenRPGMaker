// Retained relief pixels in fixed world-coordinate pages. Raster dependencies
// are rendered with the same window halo as the full-image patch reference.
// A brush patch bakes each planned window once and overwrites only its exact
// rectangle in the pages it crosses (2026-10-07: whole-page rebakes made one
// brush sample ~5x slower than the #1978 window patch).
import { renderRelief, reliefPadPx, type ReliefRender } from "./render";
import { cropReliefGrid, reliefPartAt, reliefWindowFor, type ReliefScene, type ReliefWindowPlan } from "./window";
import { RELIEF_TILE as T } from "./types";

export const RELIEF_PAGE = 256;
interface Page {
  readonly x: number;
  readonly y: number;
  readonly rgba: Uint32Array;
  readonly owner: Int16Array;
  readonly part: Uint8Array;
  revision: string;
}
export interface ReliefPixelRect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
export interface ReliefPageView { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export class ReliefPagedImage {
  readonly PW: number;
  SH: number;
  pad = 0;
  private readonly pages = new Map<string, Page>();
  private revision = "";
  constructor(readonly W: number, readonly H: number) { this.PW = W * T; this.SH = H * T; }

  /** Pages baked whole vs planned rectangles overwritten (diagnostics). */
  readonly bakes = { pages: 0, patches: 0 };
  get stats(): { pages: number; bytes: number; pad: number; originY: number; bakes: { pages: number; patches: number } } {
    return { pages: this.pages.size, bytes: this.pages.size * RELIEF_PAGE ** 2 * 7, pad: this.pad, originY: -this.pad, bakes: { ...this.bakes } };
  }

  /** Rectangles use padded raster coordinates at the public strip boundary;
   * page coordinates are always ground coordinates, independent of max height.
   */
  visit(rect: ReliefPixelRect, take: (x: number, y: number, owner: number, part: number, rgba: number) => void): void {
    for (const p of this.pages.values()) {
      const x0 = Math.max(rect.x0, p.x), x1 = Math.min(rect.x1, p.x + RELIEF_PAGE);
      const y0 = Math.max(rect.y0 - this.pad, p.y), y1 = Math.min(rect.y1 - this.pad, p.y + RELIEF_PAGE);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y - p.y) * RELIEF_PAGE + x - p.x;
        if (p.part[i]) take(x, y + this.pad, p.owner[i]!, p.part[i]!, p.rgba[i]!);
      }
    }
  }

  /** Keep the view plus a one-page pan margin. Offscreen geometry remains in
   * scene.grids/options and is reconstructed on return, including source rows
   * below the view that lift into it. No geometry/height cap is applied.
   */
  sync(scene: ReliefScene, revision: string, view?: ReliefPageView, reference?: ReliefRender, dirtyRects?: readonly ReliefWindowPlan[]): { shift: number; rows: Set<number>; rects: ReliefPixelRect[] } {
    const oldPad = this.pad;
    if (revision !== this.revision || reference) this.pad = reference?.pad ?? reliefPadPx(scene.grids.pruned, scene.opts.slopes);
    this.revision = revision;
    this.SH = this.H * T + this.pad;
    const left = Math.max(0, (view?.x ?? 0) - RELIEF_PAGE), right = Math.min(this.PW, (view ? view.x + view.width : this.PW) + RELIEF_PAGE);
    const top = Math.max(-this.pad, (view?.y ?? -this.pad) - RELIEF_PAGE), bottom = Math.min(this.H * T, (view ? view.y + view.height : this.H * T) + RELIEF_PAGE);
    const wanted = new Set<string>(), rows = new Set<number>(), rects: ReliefPixelRect[] = [], whole: Page[] = [];
    // One bake per planned window, shared by every page the window crosses.
    const renders = new Map<ReliefWindowPlan, { win: ReliefWindowPlan; render: ReliefRender }>();
    const windowRender = (plan: ReliefWindowPlan) => {
      let baked = renders.get(plan);
      if (!baked) {
        const win = this.withFlights(plan, scene);
        baked = { win, render: this.bake(win, scene) };
        renders.set(plan, baked);
      }
      return baked;
    };
    const dirty = (p: Page) => {
      for (const row of p.owner) if (row >= 0) rows.add(row);
      rects.push({ x0: p.x, y0: p.y + this.pad, x1: Math.min(this.PW, p.x + RELIEF_PAGE), y1: p.y + this.pad + RELIEF_PAGE });
    };
    for (let y = Math.floor(top / RELIEF_PAGE) * RELIEF_PAGE; y < bottom; y += RELIEF_PAGE) for (let x = Math.floor(left / RELIEF_PAGE) * RELIEF_PAGE; x < right; x += RELIEF_PAGE) {
      const key = `${x},${y}`; wanted.add(key);
      let page = this.pages.get(key);
      if (!page) {
        const n = RELIEF_PAGE ** 2;
        page = { x, y, rgba: new Uint32Array(n), owner: new Int16Array(n).fill(-1), part: new Uint8Array(n), revision: "" };
        this.pages.set(key, page);
      }
      if (page.revision === revision && oldPad === this.pad && !reference) continue;
      if (page.revision && dirtyRects && !reference) {
        const hits = dirtyRects.filter(r => r.x0 < x + RELIEF_PAGE && r.x1 > x && r.y0 < y + this.pad + RELIEF_PAGE && r.y1 > y + this.pad);
        // Same pad: page pixels outside the planned rectangles are already exact.
        // A pad change can leave old pixels above the raster top, so it repaints whole pages.
        if (!hits.length || oldPad === this.pad) {
          for (const plan of hits) { this.patch(page, plan, windowRender(plan), rows, rects); this.bakes.patches++; }
          page.revision = revision; continue;
        }
      }
      dirty(page);
      whole.push(page);
      page.revision = revision;
    }
    // Pages in one row band share a single bake: page windows reach the map's
    // side edges (and on narrow maps span the whole width), so baking each page
    // separately repeated most of the band's raster.
    const bands = new Map<number, Page[]>();
    for (const page of whole) { const band = bands.get(page.y); if (band) band.push(page); else bands.set(page.y, [page]); }
    for (const band of bands.values()) {
      this.paintBand(band, scene, reference);
      for (const page of band) for (const row of page.owner) if (row >= 0) rows.add(row);
    }
    for (const [key, page] of this.pages) if (!wanted.has(key)) { dirty(page); this.pages.delete(key); }
    return { shift: this.pad - oldPad, rows, rects };
  }

  /** Bake whole pages of one row band from one window (or the full reference raster). */
  private paintBand(band: readonly Page[], scene: ReliefScene, reference?: ReliefRender): void {
    for (const page of band) { page.rgba.fill(0); page.owner.fill(-1); page.part.fill(0); }
    const y = band[0]!.y;
    const x0 = Math.min(...band.map(p => p.x)), x1 = Math.min(this.PW, Math.max(...band.map(p => p.x)) + RELIEF_PAGE);
    const y0 = Math.max(0, y + this.pad), y1 = Math.min(this.SH, y + this.pad + RELIEF_PAGE);
    if (y1 <= y0 || x1 <= x0) return;
    this.bakes.pages += band.length;
    const win = reference ? undefined : this.withFlights(reliefWindowFor(x0, y0, x1, y1, this.W, this.H, this.pad), scene);
    const render = reference ?? this.bake(win!, scene);
    for (const page of band) this.paint(page, render, win);
  }

  private paint(page: Page, render: ReliefRender, win: ReliefWindowPlan | undefined): void {
    const x0 = page.x, x1 = Math.min(this.PW, x0 + RELIEF_PAGE);
    const y0 = Math.max(0, page.y + this.pad), y1 = Math.min(this.SH, page.y + this.pad + RELIEF_PAGE);
    if (y1 <= y0 || x1 <= x0) return;
    const ox = win ? win.cx * T : 0, oy = win ? win.cy * T : 0, width = win ? win.w : this.W;
    const rgba = new Uint32Array(render.rgba.buffer, render.rgba.byteOffset, render.rgba.length / 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const src = (y - oy) * render.PW + x - ox, dst = (y - this.pad - page.y) * RELIEF_PAGE + x - page.x;
      const part = reliefPartAt(render, src);
      page.part[dst] = part;
      if (part) { page.owner[dst] = Math.floor(render.src[src]! / width) + (win?.cy ?? 0); page.rgba[dst] = rgba[src]!; }
    }
  }

  /** Overwrite one planned rectangle inside a resident page (the window patch of relief/window.ts, per page). */
  private patch(page: Page, plan: ReliefWindowPlan, baked: { win: ReliefWindowPlan; render: ReliefRender }, rows: Set<number>, rects: ReliefPixelRect[]): void {
    const x0 = Math.max(plan.x0, page.x, 0), x1 = Math.min(plan.x1, page.x + RELIEF_PAGE, this.PW);
    const y0 = Math.max(plan.y0, page.y + this.pad, 0), y1 = Math.min(plan.y1, page.y + this.pad + RELIEF_PAGE, this.SH);
    if (y1 <= y0 || x1 <= x0) return;
    const { win, render } = baked;
    const ox = win.cx * T, oy = win.cy * T;
    const rgba = new Uint32Array(render.rgba.buffer, render.rgba.byteOffset, render.rgba.length / 4);
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const src = (y - oy) * render.PW + x - ox, dst = (y - this.pad - page.y) * RELIEF_PAGE + x - page.x;
      const before = page.owner[dst]!;
      if (before >= 0) rows.add(before);
      const part = reliefPartAt(render, src);
      page.part[dst] = part;
      if (part) {
        const row = Math.floor(render.src[src]! / win.w) + win.cy;
        page.owner[dst] = row; page.rgba[dst] = rgba[src]!; rows.add(row);
      } else { page.owner[dst] = -1; page.rgba[dst] = 0; }
    }
    rects.push({ x0, y0, x1, y1 });
  }

  private bake(win: ReliefWindowPlan, scene: ReliefScene): ReliefRender {
    return renderRelief(cropReliefGrid(scene.grids.eff, win), {
      ...scene.opts, window: { cx: win.cx, cy: win.cy, pad: this.pad, PW: this.PW, SH: this.SH, pruned: cropReliefGrid(scene.grids.pruned, win) },
    });
  }

  /** Carved stair painting measures the entire flight's owned screen span.
   * Keep complete intersecting flights and their square-edge neighbours. */
  private withFlights(start: ReliefWindowPlan, scene: ReliefScene): ReliefWindowPlan {
    let win = start, grown = true;
    while (grown) {
      grown = false;
      for (const s of scene.opts.slopes ?? []) {
        if (s.x + s.w < win.cx || s.x > win.cx + win.w || s.y + s.h < win.cy || s.y > win.cy + win.h) continue;
        const dep = reliefWindowFor(
          Math.max(0, (s.x - 1) * T - 24), Math.max(0, (s.y - Math.ceil(s.hi) - 1) * T + this.pad - 24),
          Math.min(this.PW, (s.x + s.w + 1) * T + 24), Math.min(this.SH, (s.y + s.h + 1) * T + this.pad + 24),
          this.W, this.H, this.pad,
        );
        const cx = Math.min(win.cx, dep.cx), cy = Math.min(win.cy, dep.cy);
        const right = Math.max(win.cx + win.w, dep.cx + dep.w), bottom = Math.max(win.cy + win.h, dep.cy + dep.h);
        if (cx !== win.cx || cy !== win.cy || right !== win.cx + win.w || bottom !== win.cy + win.h) {
          win = { ...win, cx, cy, w: right - cx, h: bottom - cy }; grown = true;
        }
      }
    }
    return win;
  }
}
