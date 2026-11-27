// project/interactivePropAuthoring.ts
// AI 조수가 카탈로그에 없는 새 상호작용 오브젝트(5프레임 가로 PNG 스트립)를
// 브라우저·노드 어디서나 순수 TypeScript 로 직접 저작·검증·인코딩하는 엔진.
//
// 두 가지 저작 모드:
//   - 모드 A (framesGrid): 4~5프레임 문자 격자 + 팔레트를 직접 그려 스트립 합성
//   - 모드 B (baseGrid + motionRecipe): 0번 원본 격자 1장만 고퀄리티로 그리면
//     물리 모션 엔진(밀기문·여닫이·커튼·뚜껑·슬라이드·보로노이 파괴·공포 깜빡임·발광·덜컹)이
//     실제 픽셀을 변환해 5프레임 가로 PNG 스트립을 자동 합성
import { encodePngRgba } from "@/ai/dotTextImage";
import type { InteractivePropEntry } from "@/project/interactiveProps";

export const AUTHOR_MOTION_RECIPES = [
  "push-in-door",
  "swing-door",
  "curtain-part",
  "hinge-lid",
  "slide-door",
  "smash-break",
  "horror-flicker",
  "glow-activate",
  "rattle-scare",
] as const;

export type AuthorMotionRecipe = (typeof AUTHOR_MOTION_RECIPES)[number];

export interface PixelRect {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface AuthorPropPixelsInput {
  readonly palette: Readonly<Record<string, string | null>>;
  /** 모드 A: 프레임별 문자 격자 (4~6프레임). */
  readonly framesGrid?: readonly (readonly string[])[];
  /** 모드 B: 0번 정지 프레임 문자 격자 + motionRecipe 자동 합성. */
  readonly baseGrid?: readonly string[];
  readonly motionRecipe?: AuthorMotionRecipe;
  /** 모션이 적용될 사각형(생략 시 불투명 바운딩박스 기준 자동 추론). */
  readonly region?: PixelRect;
  /** 문 경첩 방향("left" | "right"). */
  readonly hingeSide?: "left" | "right";
  /** 강조/광원/안광 색 (hex "#rrggbb"). */
  readonly accentColor?: string;
  /** 공포 안광 점등 좌표 [[x,y], ...]. */
  readonly eyePoints?: readonly (readonly [number, number])[];
}

export interface AuthoredPropStrip {
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly frames: number;
  readonly dataUrl: string;
  readonly opaquePixelsPerFrame: readonly number[];
  readonly changedSteps: number;
}

type Rgba = readonly [number, number, number, number];

interface CanvasBuf {
  readonly w: number;
  readonly h: number;
  readonly data: Uint8ClampedArray;
}

function makeBuf(w: number, h: number): CanvasBuf {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) };
}

function cloneBuf(src: CanvasBuf): CanvasBuf {
  return { w: src.w, h: src.h, data: new Uint8ClampedArray(src.data) };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function getPx(buf: CanvasBuf, x: number, y: number): Rgba {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return [0, 0, 0, 0];
  const i = (y * buf.w + x) * 4;
  return [buf.data[i]!, buf.data[i + 1]!, buf.data[i + 2]!, buf.data[i + 3]!];
}

function setPx(buf: CanvasBuf, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h) return;
  const i = (y * buf.w + x) * 4;
  buf.data[i] = c[0];
  buf.data[i + 1] = c[1];
  buf.data[i + 2] = c[2];
  buf.data[i + 3] = c[3];
}

function blendPx(buf: CanvasBuf, x: number, y: number, c: Rgba): void {
  if (x < 0 || y < 0 || x >= buf.w || y >= buf.h || c[3] === 0) return;
  if (c[3] >= 250) {
    setPx(buf, x, y, c);
    return;
  }
  const dst = getPx(buf, x, y);
  const sa = c[3] / 255;
  const da = dst[3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  setPx(buf, x, y, [
    clamp(Math.round((c[0] * sa + dst[0] * da * (1 - sa)) / oa), 0, 255),
    clamp(Math.round((c[1] * sa + dst[1] * da * (1 - sa)) / oa), 0, 255),
    clamp(Math.round((c[2] * sa + dst[2] * da * (1 - sa)) / oa), 0, 255),
    clamp(Math.round(oa * 255), 0, 255),
  ]);
}

function pasteOver(dst: CanvasBuf, src: CanvasBuf, ox: number, oy: number): void {
  for (let y = 0; y < src.h; y += 1) {
    for (let x = 0; x < src.w; x += 1) {
      const c = getPx(src, x, y);
      if (c[3] > 0) blendPx(dst, ox + x, oy + y, c);
    }
  }
}

function scaleRgb(c: Rgba, factor: number, alpha?: number): Rgba {
  return [
    clamp(Math.round(c[0] * factor), 0, 255),
    clamp(Math.round(c[1] * factor), 0, 255),
    clamp(Math.round(c[2] * factor), 0, 255),
    alpha ?? c[3],
  ];
}

function tintRgb(c: Rgba, target: readonly [number, number, number], t: number): Rgba {
  return [
    clamp(Math.round(c[0] + (target[0] - c[0]) * t), 0, 255),
    clamp(Math.round(c[1] + (target[1] - c[1]) * t), 0, 255),
    clamp(Math.round(c[2] + (target[2] - c[2]) * t), 0, 255),
    c[3],
  ];
}

export function parseHexColor(hex: string | null | undefined, fallback: readonly [number, number, number] = [128, 224, 255]): Rgba {
  if (!hex) return [0, 0, 0, 0];
  const clean = hex.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16), 255];
  }
  if (/^[0-9a-f]{8}$/i.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
      parseInt(clean.slice(6, 8), 16),
    ];
  }
  return [fallback[0], fallback[1], fallback[2], 255];
}

function parseGrid(grid: readonly string[], palette: Readonly<Record<string, string | null>>): CanvasBuf {
  if (!Array.isArray(grid) || grid.length < 8 || grid.length > 64) {
    throw new Error(`격자 높이는 8~64px 사이여야 합니다(현재 ${Array.isArray(grid) ? grid.length : 0}).`);
  }
  const h = grid.length;
  const w = Math.max(...grid.map((row) => row.length));
  if (w < 8 || w > 64) {
    throw new Error(`격자 폭은 8~64px 사이여야 합니다(현재 ${w}).`);
  }
  const colorMap = new Map<string, Rgba>();
  colorMap.set(".", [0, 0, 0, 0]);
  colorMap.set(" ", [0, 0, 0, 0]);
  for (const [key, val] of Object.entries(palette)) {
    if (!key) continue;
    const ch = key[0]!;
    colorMap.set(ch, val === null || val === "transparent" ? [0, 0, 0, 0] : parseHexColor(val));
  }
  const buf = makeBuf(w, h);
  for (let y = 0; y < h; y += 1) {
    const row = grid[y] ?? "";
    for (let x = 0; x < row.length; x += 1) {
      const c = colorMap.get(row[x]!);
      if (c && c[3] > 0) setPx(buf, x, y, c);
    }
  }
  return buf;
}

function opaqueBbox(buf: CanvasBuf): PixelRect {
  let x0 = buf.w;
  let y0 = buf.h;
  let x1 = 0;
  let y1 = 0;
  let found = false;
  for (let y = 0; y < buf.h; y += 1) {
    for (let x = 0; x < buf.w; x += 1) {
      if (getPx(buf, x, y)[3] >= 128) {
        found = true;
        if (x < x0) x0 = x;
        if (y < y0) y0 = y;
        if (x > x1) x1 = x;
        if (y > y1) y1 = y;
      }
    }
  }
  return found ? { x0, y0, x1, y1 } : { x0: 2, y0: 2, x1: buf.w - 3, y1: buf.h - 3 };
}

function cropBuf(src: CanvasBuf, r: PixelRect): CanvasBuf {
  const x0 = clamp(r.x0, 0, src.w - 1);
  const y0 = clamp(r.y0, 0, src.h - 1);
  const x1 = clamp(r.x1, x0, src.w - 1);
  const y1 = clamp(r.y1, y0, src.h - 1);
  const out = makeBuf(x1 - x0 + 1, y1 - y0 + 1);
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      setPx(out, x - x0, y - y0, getPx(src, x, y));
    }
  }
  return out;
}

function resizeNearest(src: CanvasBuf, nw: number, nh: number): CanvasBuf {
  const w = Math.max(1, Math.round(nw));
  const h = Math.max(1, Math.round(nh));
  const out = makeBuf(w, h);
  for (let y = 0; y < h; y += 1) {
    const sy = Math.min(src.h - 1, Math.floor((y * src.h) / h));
    for (let x = 0; x < w; x += 1) {
      const sx = Math.min(src.w - 1, Math.floor((x * src.w) / w));
      setPx(out, x, y, getPx(src, sx, sy));
    }
  }
  return out;
}

function fillInterior(buf: CanvasBuf, r: PixelRect, warm = false): void {
  const h = Math.max(1, r.y1 - r.y0 + 1);
  for (let y = r.y0; y <= r.y1; y += 1) {
    const v = (y - r.y0) / h;
    for (let x = r.x0; x <= r.x1; x += 1) {
      if (y <= r.y0 + 1 || x === r.x0 || x === r.x1) {
        setPx(buf, x, y, [16, 14, 22, 255]);
      } else if (warm && v > 0.72) {
        setPx(buf, x, y, [62, 46, 36, 255]);
      } else {
        setPx(buf, x, y, [26, 22, 32, 255]);
      }
    }
  }
}

function synthesizeMotion(
  base: CanvasBuf,
  recipe: AuthorMotionRecipe,
  opts: Pick<AuthorPropPixelsInput, "region" | "hingeSide" | "accentColor" | "eyePoints">,
): CanvasBuf[] {
  const bbox = opaqueBbox(base);
  const reg: PixelRect = opts.region ?? {
    x0: clamp(bbox.x0 + 1, 0, base.w - 1),
    y0: clamp(bbox.y0 + 1, 0, base.h - 1),
    x1: clamp(bbox.x1 - 1, 0, base.w - 1),
    y1: clamp(bbox.y1 - 1, 0, base.h - 1),
  };
  const side = opts.hingeSide ?? "left";
  const accentRgba = parseHexColor(opts.accentColor ?? "#7ee8ff");
  const accentRgb: readonly [number, number, number] = [accentRgba[0], accentRgba[1], accentRgba[2]];

  if (recipe === "push-in-door" || recipe === "swing-door") {
    const inward = recipe === "push-in-door";
    const door = cropBuf(base, reg);
    const angles = inward ? [0, 26, 52, 72, 82] : [0, 32, 68, 108, 134];
    return angles.map((ang, fi) => {
      if (fi === 0) return cloneBuf(base);
      const fr = cloneBuf(base);
      fillInterior(fr, reg, inward);
      const rad = (ang * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const horiz = Math.max(2, door.w * Math.abs(cosA));
      const sign = inward ? 1 : cosA >= 0 ? 1 : -1;
      const hingeX = side === "left" ? reg.x0 : reg.x1;
      const tipX = Math.round(hingeX + (side === "left" ? 1 : -1) * sign * horiz);
      const step = tipX >= hingeX ? 1 : -1;
      const cols: number[] = [];
      for (let px = hingeX; step > 0 ? px <= tipX : px >= tipX; px += step) cols.push(px);
      const total = Math.max(1, cols.length - 1);
      const yShift = sinA * Math.max(1.5, Math.min(5, door.w * 0.25)) * (inward ? -1 : 1);
      cols.forEach((px, idx) => {
        const u = idx / total;
        const sx = side === "left" ? Math.round(u * (door.w - 1)) : Math.round((1 - u) * (door.w - 1));
        const shade = inward ? 1 - sinA * (0.15 + 0.22 * u) : 0.88 + 0.12 * Math.abs(cosA);
        for (let y = 0; y < door.h; y += 1) {
          const c = getPx(door, sx, y);
          if (c[3] < 128) continue;
          const v = y / Math.max(1, door.h - 1);
          const dy = inward ? Math.round(u * yShift * (0.6 + 0.4 * v)) : Math.round(u * yShift);
          const py = reg.y0 + y + dy;
          if (inward && py < reg.y0) continue;
          setPx(fr, px, py, scaleRgb(c, shade));
        }
      });
      return fr;
    });
  }

  if (recipe === "curtain-part") {
    const mid = Math.floor((reg.x0 + reg.x1) / 2);
    const leftC = cropBuf(base, { x0: reg.x0, y0: reg.y0, x1: mid, y1: reg.y1 });
    const rightC = cropBuf(base, { x0: Math.min(reg.x1, mid + 1), y0: reg.y0, x1: reg.x1, y1: reg.y1 });
    const scales = [1, 0.76, 0.54, 0.38, 0.30];
    return scales.map((sc, fi) => {
      if (fi === 0) return cloneBuf(base);
      const fr = cloneBuf(base);
      fillInterior(fr, reg, false);
      const ls = resizeNearest(leftC, Math.max(2, leftC.w * sc), leftC.h);
      const rs = resizeNearest(rightC, Math.max(2, rightC.w * sc), rightC.h);
      pasteOver(fr, ls, reg.x0, reg.y0);
      pasteOver(fr, rs, reg.x1 - rs.w + 1, reg.y0);
      return fr;
    });
  }

  if (recipe === "hinge-lid") {
    const seamY = clamp(Math.floor(reg.y0 + (reg.y1 - reg.y0) * 0.42), reg.y0 + 2, reg.y1 - 2);
    const lid = cropBuf(base, { x0: reg.x0, y0: reg.y0, x1: reg.x1, y1: seamY });
    const states = [
      { sy: 1, cav: 0, sparkle: false },
      { sy: 0.92, cav: 2, sparkle: false },
      { sy: 0.78, cav: 4, sparkle: false },
      { sy: 0.84, cav: 5, sparkle: true },
      { sy: 0.84, cav: 5, sparkle: false },
    ];
    return states.map((st, fi) => {
      if (fi === 0) return cloneBuf(base);
      const fr = makeBuf(base.w, base.h);
      // Lower body intact
      for (let y = seamY; y < base.h; y += 1) {
        for (let x = 0; x < base.w; x += 1) setPx(fr, x, y, getPx(base, x, y));
      }
      const cy0 = Math.max(0, seamY - st.cav);
      fillInterior(fr, { x0: reg.x0, y0: cy0, x1: reg.x1, y1: seamY - 1 }, true);
      const nh = Math.max(3, Math.round(lid.h * st.sy));
      const lRes = resizeNearest(lid, lid.w, nh);
      const ly = Math.max(0, cy0 - nh + 1);
      pasteOver(fr, lRes, reg.x0, ly);
      if (st.sparkle) {
        const cx = Math.floor((reg.x0 + reg.x1) / 2);
        const sy = Math.max(1, seamY - 2);
        for (const [dx, dy] of [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          setPx(fr, cx + dx, sy + dy, dx === 0 && dy === 0 ? [255, 252, 224, 255] : [accentRgb[0], accentRgb[1], accentRgb[2], 225]);
        }
      }
      return fr;
    });
  }

  if (recipe === "slide-door") {
    const span = Math.max(4, Math.floor((reg.x1 - reg.x0 + 1) * 0.7));
    const door = cropBuf(base, reg);
    const fracs = [0, 0.22, 0.50, 0.78, 1.0];
    return fracs.map((f, fi) => {
      if (fi === 0) return cloneBuf(base);
      const fr = cloneBuf(base);
      fillInterior(fr, reg, false);
      const dx = Math.round(span * f);
      for (let y = 0; y < door.h; y += 1) {
        for (let x = 0; x < door.w; x += 1) {
          const tx = reg.x0 + x + dx;
          if (tx <= reg.x1) {
            const c = getPx(door, x, y);
            if (c[3] >= 128) setPx(fr, tx, reg.y0 + y, c);
          }
        }
      }
      return fr;
    });
  }

  if (recipe === "smash-break") {
    // Deterministic Voronoi fracture preserving exact Frame 0 pixels!
    const opaque: Array<{ x: number; y: number; c: Rgba }> = [];
    for (let y = 0; y < base.h; y += 1) {
      for (let x = 0; x < base.w; x += 1) {
        const c = getPx(base, x, y);
        if (c[3] >= 128) opaque.push({ x, y, c });
      }
    }
    const cx = opaque.reduce((s, p) => s + p.x, 0) / Math.max(1, opaque.length);
    const cy = opaque.reduce((s, p) => s + p.y, 0) / Math.max(1, opaque.length);
    const numShards = 8;
    const centers = Array.from({ length: numShards }, (_, k) => {
      const a = (Math.PI * 2 * k) / numShards + 0.2;
      const r = Math.max(2.5, Math.min(base.w, base.h) * 0.24);
      return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
    });
    const shards: Array<Array<{ x: number; y: number; c: Rgba }>> = Array.from({ length: numShards }, () => []);
    for (const p of opaque) {
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < numShards; k += 1) {
        const d = (p.x - centers[k]!.x) ** 2 + (p.y - centers[k]!.y) ** 2;
        if (d < bestD) { bestD = d; best = k; }
      }
      shards[best]!.push(p);
    }
    const f1 = makeBuf(base.w, base.h);
    pasteOver(f1, base, 1, 0);
    for (let t = -3; t <= 3; t += 1) {
      setPx(f1, Math.round(cx + t), Math.round(cy + t * 0.7), [26, 18, 16, 255]);
      setPx(f1, Math.round(cx + t * 0.5), Math.round(cy - t * 0.8), [26, 18, 16, 255]);
    }
    setPx(f1, Math.round(cx), Math.round(cy), [255, 250, 214, 255]);

    const groundY = bbox.y1;
    const renderBurst = (t: number, settle: boolean): CanvasBuf => {
      const fr = makeBuf(base.w, base.h);
      for (let k = 0; k < numShards; k += 1) {
        const vx = (centers[k]!.x - cx) * 0.75;
        const vy = -Math.max(1.8, Math.abs(centers[k]!.y - cy) * 0.65);
        for (const p of shards[k]!) {
          const nx = Math.round(p.x + vx * t);
          let ny = Math.round(p.y + vy * t + 3.4 * t * t);
          if (settle) ny = clamp(groundY - ((k + p.x) % 3), 0, base.h - 1);
          else ny = Math.min(groundY, ny);
          if (nx >= 0 && nx < base.w && ny >= 0 && ny < base.h) {
            setPx(fr, nx, ny, settle ? scaleRgb(p.c, 0.86) : p.c);
          }
        }
      }
      return fr;
    };
    return [cloneBuf(base), f1, renderBurst(0.65, false), renderBurst(1.15, false), renderBurst(1.35, true)];
  }

  if (recipe === "horror-flicker") {
    const cx = Math.floor((reg.x0 + reg.x1) / 2);
    const cy = Math.floor((reg.y0 + reg.y1) / 2);
    const applyBox = (fn: (c: Rgba, x: number, y: number) => Rgba): CanvasBuf => {
      const fr = cloneBuf(base);
      for (let y = reg.y0; y <= reg.y1; y += 1) {
        for (let x = reg.x0; x <= reg.x1; x += 1) {
          const c = getPx(fr, x, y);
          if (c[3] >= 128) setPx(fr, x, y, fn(c, x, y));
        }
      }
      return fr;
    };
    const f1 = applyBox((c) => scaleRgb(c, 0.38));
    const f2 = applyBox((c) => tintRgb(c, [255, 252, 236], 0.65));
    for (const [dx, dy] of [[-2, -2], [2, -1], [2, 2], [-2, 2]] as const) {
      blendPx(f2, cx + dx, cy + dy, [255, 248, 198, 220]);
    }
    const f3 = applyBox((c) => tintRgb(c, accentRgb, 0.72));
    const f4 = applyBox((c) => tintRgb(scaleRgb(c, 0.58), accentRgb, 0.38));
    return [cloneBuf(base), f1, f2, f3, f4];
  }

  if (recipe === "glow-activate") {
    const cx = Math.floor((reg.x0 + reg.x1) / 2);
    const cy = Math.floor((reg.y0 + reg.y1) / 2);
    const strengths = [0, 0.25, 0.55, 0.75, 0.45];
    return strengths.map((s, fi) => {
      if (fi === 0) return cloneBuf(base);
      const fr = cloneBuf(base);
      for (let y = reg.y0; y <= reg.y1; y += 1) {
        for (let x = reg.x0; x <= reg.x1; x += 1) {
          const c = getPx(fr, x, y);
          if (c[3] >= 128) setPx(fr, x, y, tintRgb(c, accentRgb, s));
        }
      }
      for (const [dx, dy] of [[-2, -fi], [2, -fi - 1], [0, -fi - 2]] as const) {
        blendPx(fr, cx + dx, cy + dy, [accentRgb[0], accentRgb[1], accentRgb[2], 215]);
      }
      return fr;
    });
  }

  // rattle-scare
  const shifts = [0, -1, 1, -1, 0];
  const eyes = opts.eyePoints && opts.eyePoints.length > 0
    ? opts.eyePoints
    : [[Math.floor((reg.x0 + reg.x1) / 2) - 1, Math.floor((reg.y0 + reg.y1) / 2)], [Math.floor((reg.x0 + reg.x1) / 2) + 1, Math.floor((reg.y0 + reg.y1) / 2)]] as const;
  return shifts.map((dx, fi) => {
    if (fi === 0) return cloneBuf(base);
    const fr = makeBuf(base.w, base.h);
    pasteOver(fr, base, dx, 0);
    if (fi >= 2) {
      for (const [ex, ey] of eyes) {
        setPx(fr, clamp(ex + dx, 0, base.w - 1), clamp(ey, 0, base.h - 1), [accentRgb[0], accentRgb[1], accentRgb[2], 255]);
      }
    }
    return fr;
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

/**
 * AI 조수의 격자/레시피 입력으로부터 4~6프레임 가로 PNG 스트립(dataUrl)을 생성하고
 * 기계 품질 게이트(해상도 일치·최소 불투명 화소·프레임 간 모션 변화)를 자동 검증한다.
 */
export function buildAuthoredPropStrip(input: AuthorPropPixelsInput): AuthoredPropStrip {
  let frames: CanvasBuf[];
  if (Array.isArray(input.framesGrid) && input.framesGrid.length > 0) {
    if (input.framesGrid.length < 3 || input.framesGrid.length > 8) {
      throw new Error(`framesGrid 는 3~8프레임이어야 합니다(현재 ${input.framesGrid.length}).`);
    }
    frames = input.framesGrid.map((g) => parseGrid(g, input.palette));
    const fw = frames[0]!.w;
    const fh = frames[0]!.h;
    if (frames.some((f) => f.w !== fw || f.h !== fh)) {
      throw new Error("모든 프레임 격자의 가로·세로 크기가 동일해야 합니다.");
    }
  } else if (Array.isArray(input.baseGrid) && input.baseGrid.length > 0) {
    const base = parseGrid(input.baseGrid, input.palette);
    const recipe = input.motionRecipe ?? "glow-activate";
    frames = synthesizeMotion(base, recipe, input);
  } else {
    throw new Error("framesGrid(직접 멀티프레임) 또는 baseGrid + motionRecipe(자동 합성) 중 하나가 필요합니다.");
  }

  const fw = frames[0]!.w;
  const fh = frames[0]!.h;
  const nf = frames.length;

  // Mechanical gate: opaque pixel count & frame-to-frame motion delta
  const opaqueCounts: number[] = [];
  for (let i = 0; i < nf; i += 1) {
    let op = 0;
    const d = frames[i]!.data;
    for (let p = 3; p < d.length; p += 4) if (d[p]! >= 128) op += 1;
    if (op < 16) throw new Error(`프레임 ${i} 이 거의 비어 있습니다(불투명 ${op}px < 16px).`);
    opaqueCounts.push(op);
  }
  let changedSteps = 0;
  for (let i = 0; i < nf - 1; i += 1) {
    const a = frames[i]!.data;
    const b = frames[i + 1]!.data;
    let diff = 0;
    for (let k = 0; k < a.length; k += 4) {
      if (a[k] !== b[k] || a[k + 1] !== b[k + 1] || a[k + 2] !== b[k + 2] || a[k + 3] !== b[k + 3]) diff += 1;
    }
    if (diff >= 3) changedSteps += 1;
  }
  const minChanges = Math.max(1, nf - 2);
  if (changedSteps < minChanges) {
    throw new Error(`애니메이션 변화가 부족합니다(${changedSteps}/${nf - 1}단계 변화, 최소 ${minChanges}단계 필요).`);
  }

  // Pack horizontal strip
  const strip = makeBuf(fw * nf, fh);
  for (let i = 0; i < nf; i += 1) {
    pasteOver(strip, frames[i]!, i * fw, 0);
  }
  const pngBytes = encodePngRgba(strip.w, strip.h, strip.data);
  const dataUrl = `data:image/png;base64,${bytesToBase64(pngBytes)}`;
  return {
    frameWidth: fw,
    frameHeight: fh,
    frames: nf,
    dataUrl,
    opaquePixelsPerFrame: opaqueCounts,
    changedSteps,
  };
}

/** 프로젝트의 `assets.uploaded` 에 저장된 커스텀 인터랙티브 프롭 엔트리를 복원한다. */
export function extractCustomInteractivePropsFromUploaded(
  uploaded: Readonly<Record<string, { readonly id: string; readonly dataUrl?: string; readonly meta?: Record<string, unknown> }>> | undefined,
): InteractivePropEntry[] {
  if (!uploaded) return [];
  const out: InteractivePropEntry[] = [];
  for (const asset of Object.values(uploaded)) {
    const raw = asset?.meta?.interactiveProp as InteractivePropEntry | undefined;
    if (raw && typeof raw.id === "string" && typeof raw.frameWidth === "number" && typeof raw.frames === "number") {
      out.push(raw);
    }
  }
  return out;
}
