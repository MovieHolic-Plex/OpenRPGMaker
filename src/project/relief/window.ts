// 높이 붓 부분 다시 굽기. 붓 한 번은 몇 칸만 바꾸는데 renderRelief 는 맵 전체를 굽는다(100×100 약 0.8초) —
// 바뀐 칸 둘레의 창만 굽고(renderRelief 의 window 옵션), 창 안쪽 「정확한 사각형」만 전체 그림 버퍼에 덮어쓴다.
// DOM 에 기대지 않는다. 편집기(editor/reliefLiveStrips.ts)가 버퍼를 줄 띠 텍스처로 올린다.
//
// 왜 정확한가(창 크기 계산의 근거):
// - 화면 화소 (sx, sy) 를 칠하는 맵 화소는 같은 열 sx, 맵 y ∈ [sy - pad, sy] 뿐이다 — 윗면은 c 단만큼 위로(sy = py + pad - c·16),
//   벽은 그 윗면에서 남쪽으로 높이차만큼 내려가므로 py + pad 를 넘지 않는다.
// - 화소 높이는 둘레 반 칸(마칭 스퀘어)에, 뒤 패스(벽 무늬·가장자리·그늘·둑)는 화면에서 REACH px 안의 이웃에 기댄다.
// - 깎기(prune)·다듬기(effectiveHeights)는 칸 단위로 맵 전체에서 미리 해 두므로 창 가장자리에서 결과가 달라지지 않는다.
// - 무늬는 절대 좌표(땅 기준 세로)로 읽는다(render.ts window 옵션·PATTERN_BIAS). 그래서 pad 가 바뀌어도 그림은 세로로 밀릴 뿐이다 —
//   버퍼를 pad 차이만큼 밀고, 맨 위 줄 경계(sy = 0 에서 북쪽 외곽선·둑을 안 그림)에 걸린 띠만 다시 굽는다.
// - 줄 끝 화소가 반대쪽 끝을 읽는 곳(sx-1 이 앞줄 끝)이 있어 바뀐 곳이 맵 왼·오른쪽 끝에 닿으면 폭 전체로 넓힌다.
// - 계단 양식은 계단 하나의 화면 높이 전체를 보고 칠하므로 창에 걸친 경사로는 통째로 바뀐 칸에 넣는다. 경사로·다리가 바뀌면
//   (단이 바뀌면 경사로 높낮이·다리 밑 바닥도 바뀐다) 그 칸과 네모 절벽 둘레 한 칸을 바뀐 칸에 넣는다. 번호가 밀린 경사로도 바뀐 것으로 본다.
// 전체 그림과의 화소 일치는 scripts/check-relief-window.mts 가 무작위 붓질로 확인한다.

import { effectiveHeights, prune, reliefPadPx, renderRelief, type ReliefRender, type ReliefRenderOptions, type ReliefSlope } from "./render";
import { gridFromRelief, RELIEF_TILE as T, type HeightGrid, type ReliefData } from "./types";
import { reliefState } from "./revision";

/**
 * 뒤 패스가 화면에서 기대는 이웃 거리(px). 서쪽 긴 그늘 12·북쪽 벽 발치 10 이 가장 멀고, 둑(옆면 6px)은 가장자리 화소(±2)에서 뻗는다.
 * 여유를 두어 24(확인 스크립트로 4 는 틀리고 12 는 맞는 것을 봤다). 줄이면 scripts/check-relief-window.mts 로 다시 확인할 것.
 */
const REACH = 24;
/** 창 넓이 합이 맵의 이 비율을 넘으면 전체를 굽는다 — 창 굽기와 전체 굽기의 비용이 비슷해진다. */
const FULL_RATIO = 0.6;

export interface ReliefGrids {
  /** 렌더가 받는 다듬은 높이(effectiveHeights) */
  readonly eff: HeightGrid;
  /** 화소 높이를 만드는 깎은 높이(prune(eff)) */
  readonly pruned: HeightGrid;
}

const gridsCache = new WeakMap<ReliefData, { readonly sig: number; readonly grids: ReliefGrids }>();

/** relief → 다듬은·깎은 높이. 같은 relief·같은 단이면 다시 계산하지 않는다(편집기 띠·칸 들림 표가 같이 쓴다). */
export function reliefGrids(relief: ReliefData): ReliefGrids {
  const sig = reliefState(relief).signature;
  const cached = gridsCache.get(relief);
  if (cached && cached.sig === sig) return cached.grids;
  const eff = effectiveHeights(gridFromRelief(relief));
  const grids = { eff, pruned: prune(eff) };
  gridsCache.set(relief, { sig, grids });
  return grids;
}

/** 굽기 입력 한 벌: 높이와 renderRelief 옵션(screen.ts reliefRenderOptions — 경사로·다리는 맵 전체 좌표). */
export interface ReliefScene {
  readonly grids: ReliefGrids;
  readonly opts: ReliefRenderOptions;
}

/** 전체 그림 버퍼. 화소마다 RGBA, 주인 줄(맵 y, -1 = 빈 곳), 띠(0 없음 · 1 윗면 under · 2 벽 over). pad 가 바뀌면 SH·배열이 바뀐다. */
export interface ReliefImage {
  readonly W: number;
  readonly H: number;
  readonly PW: number;
  SH: number;
  pad: number;
  rgba: Uint8ClampedArray;
  owner: Int16Array;
  part: Uint8Array;
}

/** 화소 하나가 어느 띠로 가는가 — screen.ts reliefRowStrips 와 같은 규칙. */
export function reliefPartAt(render: ReliefRender, i: number): number {
  if (render.src[i]! < 0 || render.rgba[i * 4 + 3]! === 0) return 0;
  return render.kind[i] === 0 && (render.nativeGround || render.lev[i]! > 0 && !render.overSlope?.[i] && !render.edge[i]) ? 1 : 2;
}

export function reliefImageFromRender(render: ReliefRender, W: number, H: number): ReliefImage {
  const N = render.PW * render.SH;
  const owner = new Int16Array(N).fill(-1), part = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const p = reliefPartAt(render, i);
    if (!p) continue;
    part[i] = p;
    owner[i] = Math.floor(render.src[i]! / W);
  }
  return { W, H, PW: render.PW, SH: render.SH, pad: render.pad, rgba: render.rgba, owner, part };
}

/** 평지(높이 없음)의 그림 — 빈 맵에 처음 칠할 때 여기서부터 창으로 굽는다. */
export function emptyReliefImage(W: number, H: number): ReliefImage {
  const PW = W * T, SH = H * T, N = PW * SH;
  return { W, H, PW, SH, pad: 0, rgba: new Uint8ClampedArray(N * 4), owner: new Int16Array(N).fill(-1), part: new Uint8Array(N) };
}

/** 창 하나: 맵 칸 사각형(cx, cy, w, h)을 굽어 화면 사각형 [x0, x1) × [y0, y1)(새 pad 기준 전체 그림 px)을 덮어쓴다. */
export interface ReliefWindowPlan {
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface ReliefPatchPlan {
  /** 새 그림의 pad */
  readonly pad: number;
  readonly windows: readonly ReliefWindowPlan[];
}

type Box = [number, number, number, number];

/** 화면 사각형을 정확히 굽는 데 필요한 맵 칸 창. */
export function reliefWindowFor(x0: number, y0: number, x1: number, y1: number, W: number, H: number, pad: number): ReliefWindowPlan {
  // 사각형 ± REACH(뒤 패스가 읽는 이웃)의 첫 패스가 정확해야 한다. 화면 줄 sy 는 맵 줄 sy-pad..sy 가 칠하고, 잘린 가장자리 반 칸(8px)은
  // 마칭 스퀘어가 둘레 칸을 못 봐 틀린다. 맨 위 칸 줄 위쪽 맵 줄이 없어 틀리는 화면은 그 줄 + pad 까지, 맨 아래 칸 줄 밑을 0 단으로
  // 보는 벽은 그 줄 아래로만 내려간다.
  let cx = Math.floor((x0 - REACH - 8) / T), cr = Math.ceil((x1 + REACH + 8) / T);
  const cy = Math.max(0, Math.floor((y0 - REACH - pad - 8) / T)), cb = Math.min(H, Math.ceil((y1 + REACH - 8) / T) + 1);
  if (cx <= 0 || cr >= W) { cx = 0; cr = W; }
  return { cx, cy, w: cr - cx, h: cb - cy, x0, y0, x1, y1 };
}

const slopeKey = (s: ReliefSlope | undefined) => (s ? `${s.x},${s.y},${s.w},${s.h},${s.dir},${s.lo},${s.hi},${s.steps ?? 0}` : "");

/**
 * 이전 그림(prev, 평지면 null)에서 다음 굽기 입력으로 가는 창 굽기 계획. 그림이 달라질 칸이 없으면 "same",
 * 창으로 못 하면(맵 크기·절벽 양식이 바뀜, 창이 너무 큼) null — 전체를 굽는다.
 */
export function planReliefPatch(prev: ReliefScene | null, next: ReliefScene, image: Pick<ReliefImage, "W" | "H" | "PW" | "pad">): ReliefPatchPlan | "same" | null {
  const { W, H, PW } = image;
  if (next.grids.eff.length !== H || (next.grids.eff[0]?.length ?? 0) !== W) return null;
  if (prev && (prev.grids.eff.length !== H || (prev.opts.style ?? "") !== (next.opts.style ?? ""))) return null;
  if (!!prev?.opts.ground !== !!next.opts.ground) return null;
  // 평지에서 시작하면 양식은 빈 그림에 영향이 없다. 경사로 도트(rampArt)는 양식을 따른다.
  // 바뀐 칸 상자 [x0, y0, x1, y1](끝 포함). x1 < 0 이면 없음.
  const box: Box = [W, H, -1, -1];
  const grow = (x0: number, y0: number, x1: number, y1: number) => {
    box[0] = Math.min(box[0], Math.max(0, x0)); box[1] = Math.min(box[1], Math.max(0, y0));
    box[2] = Math.max(box[2], Math.min(W - 1, x1)); box[3] = Math.max(box[3], Math.min(H - 1, y1));
  };
  for (let y = 0; y < H; y++) {
    const ne = next.grids.eff[y]!, np = next.grids.pruned[y]!, pe = prev?.grids.eff[y], pp = prev?.grids.pruned[y];
    for (let x = 0; x < W; x++) if ((pe?.[x] ?? 0) !== ne[x] || (pp?.[x] ?? 0) !== np[x]) grow(x, y, x, y);
  }
  if (next.opts.ground && prev?.opts.ground && next.opts.ground !== prev.opts.ground) for (let i = 0; i < W * H; i++) if (next.opts.ground.cells[i] !== prev.opts.ground.cells[i]) grow(i % W - 1, Math.floor(i / W) - 1, i % W + 1, Math.floor(i / W) + 1);
  const prevSlopes = prev?.opts.slopes ?? [], slopes = next.opts.slopes ?? [];
  for (let k = 0; k < Math.max(prevSlopes.length, slopes.length); k++) {
    const a = prevSlopes[k], b = slopes[k];
    if (slopeKey(a) === slopeKey(b)) continue;
    for (const s of [a, b]) if (s) grow(s.x - 1, s.y - 1, s.x + s.w, s.y + s.h);
  }
  const pb = prev?.opts.bridges, nb = next.opts.bridges;
  if (pb || nb) for (let i = 0; i < W * H; i++) if ((pb?.[i] ?? 0) !== (nb?.[i] ?? 0)) grow(i % W - 1, ((i / W) | 0) - 1, i % W + 1, ((i / W) | 0) + 1);
  if (box[2] < 0) return "same";
  const pad = reliefPadPx(next.grids.pruned, slopes);
  const PH = H * T, SH = PH + pad;
  let [dx0, dy0, dx1, dy1] = box;
  for (;;) {
    // 바뀐 칸 둘레(마칭 ±1칸)의 최고 단 — 바뀐 화소는 이 높이까지만 위로 들려 그려진다(경사로는 높은 끝까지)
    let cmax = 0;
    for (let y = Math.max(0, dy0 - 1); y <= Math.min(H - 1, dy1 + 1); y++) {
      for (let x = Math.max(0, dx0 - 1); x <= Math.min(W - 1, dx1 + 1); x++) {
        cmax = Math.max(cmax, prev?.grids.pruned[y]![x] ?? 0, next.grids.pruned[y]![x]!);
      }
    }
    for (const list of [prevSlopes, slopes]) {
      for (const s of list) if (s.x <= dx1 + 1 && s.x + s.w >= dx0 - 1 && s.y <= dy1 + 1 && s.y + s.h >= dy0 - 1) cmax = Math.max(cmax, Math.ceil(Math.max(s.hi, s.lo)));
    }
    cmax = Math.min(cmax, pad / T);
    // 덮어쓸 사각형: 바뀐 화소(마칭 스퀘어라 바뀐 칸 둘레 반 칸까지)가 칠하는 화면(윗면은 cmax 단까지 위, 벽은 땅 높이 pad 까지 아래)
    // + 뒤 패스 이웃
    let x0 = Math.max(0, dx0 * T - 8 - REACH), x1 = Math.min(PW, (dx1 + 1) * T + 8 + REACH);
    if (x0 <= REACH || x1 >= PW - REACH) { x0 = 0; x1 = PW; }
    const y0 = Math.max(0, dy0 * T - 8 + pad - cmax * T - REACH), y1 = Math.min(SH, (dy1 + 1) * T + 8 + pad + REACH);
    const main = reliefWindowFor(x0, y0, x1, y1, W, H, pad);
    // 창에 걸친 경사로는 통째로 바뀐 칸에 넣고 다시 잰다(계단 양식이 경사로 화면 높이 전체를 본다)
    let grown = false;
    for (const s of slopes) {
      if (s.x + s.w < main.cx || s.x >= main.cx + main.w || s.y + s.h < main.cy || s.y >= main.cy + main.h) continue;
      if (s.x >= dx0 && s.x + s.w - 1 <= dx1 && s.y >= dy0 && s.y + s.h - 1 <= dy1) continue;
      dx0 = Math.min(dx0, s.x); dy0 = Math.min(dy0, s.y);
      dx1 = Math.max(dx1, s.x + s.w - 1); dy1 = Math.max(dy1, s.y + s.h - 1);
      grown = true;
    }
    if (grown) continue;
    const windows = [main];
    // pad 가 바뀌면 그림은 세로로 밀리기만 한다. 다만 맨 위 줄(sy = 0)은 북쪽 외곽선·둑을 그리지 않는 경계라, 옛 경계였던 줄(밀린 뒤 shift 줄)과
    // 새 경계 줄 둘레를 다시 굽는다.
    const shift = pad - image.pad;
    if (shift !== 0) windows.push(reliefWindowFor(0, 0, PW, Math.min(SH, Math.max(0, shift) + 16 + 2 * REACH), W, H, pad));
    if (windows.reduce((sum, w) => sum + w.w * w.h, 0) > W * H * FULL_RATIO) return null;
    return { pad, windows };
  }
}

export const cropReliefGrid = (grid: HeightGrid, plan: ReliefWindowPlan): HeightGrid =>
  Array.from({ length: plan.h }, (_, y) => grid[plan.cy + y]!.slice(plan.cx, plan.cx + plan.w));

/** pad 가 바뀐 만큼 버퍼를 세로로 민다(그림은 땅 기준이라 밀기만 하면 같다). */
function shiftImage(image: ReliefImage, pad: number): void {
  const shift = pad - image.pad;
  if (shift === 0) return;
  const { PW } = image, SH = image.SH + shift, N = PW * SH;
  const rgba = new Uint8ClampedArray(N * 4), owner = new Int16Array(N).fill(-1), part = new Uint8Array(N);
  // 새 줄 r = 옛 줄 r - shift
  const from = Math.max(0, -shift), to = Math.min(image.SH, SH - shift);
  if (to > from) {
    const at = (from + shift) * PW;
    rgba.set(image.rgba.subarray(from * PW * 4, to * PW * 4), at * 4);
    owner.set(image.owner.subarray(from * PW, to * PW), at);
    part.set(image.part.subarray(from * PW, to * PW), at);
  }
  Object.assign(image, { SH, pad, rgba, owner, part });
}

/**
 * 계획대로 버퍼를 밀고 창을 굽어 덮어쓴다. 덮어쓴 화소의 이전·새 주인 줄과 버퍼를 민 줄 수(shift, 새 pad - 옛 pad)를 돌려준다 —
 * 편집기는 띠 상자를 shift 만큼 옮기고(월드 위치는 그대로) 그 줄 띠만 다시 올린다.
 */
export function applyReliefPatch(image: ReliefImage, next: ReliefScene, plan: ReliefPatchPlan): { readonly shift: number; readonly rows: Set<number> } {
  const shift = plan.pad - image.pad;
  shiftImage(image, plan.pad);
  const { PW, SH, pad } = image;
  const rows = new Set<number>();
  for (const win of plan.windows) {
    const render = renderRelief(cropReliefGrid(next.grids.eff, win), {
      ...next.opts,
      window: { cx: win.cx, cy: win.cy, pad, PW, SH, pruned: cropReliefGrid(next.grids.pruned, win) },
    });
    const ox = win.cx * T, oy = win.cy * T, lw = render.PW;
    const dst32 = new Uint32Array(image.rgba.buffer, image.rgba.byteOffset, image.rgba.length >> 2);
    const src32 = new Uint32Array(render.rgba.buffer, render.rgba.byteOffset, render.rgba.length >> 2);
    for (let sy = win.y0; sy < win.y1; sy++) {
      const ly = sy - oy;
      for (let sx = win.x0; sx < win.x1; sx++) {
        const i = sy * PW + sx, j = ly * lw + (sx - ox);
        const before = image.owner[i]!;
        if (before >= 0) rows.add(before);
        const p = reliefPartAt(render, j);
        image.part[i] = p;
        if (p) {
          const row = Math.floor(render.src[j]! / win.w) + win.cy;
          image.owner[i] = row;
          rows.add(row);
        } else image.owner[i] = -1;
        dst32[i] = src32[j]!;
      }
    }
  }
  return { shift, rows };
}
