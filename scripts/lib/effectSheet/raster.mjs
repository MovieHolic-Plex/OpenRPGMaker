// 고해상도 이펙트 프레임 래스터 — 부호 거리(SDF) 기반 안티에일리어싱 프리미티브.
//
// 좌표계: **디자인 단위 = 전투 무대 논리 px**(640×480). 프레임은 192×192 단위, 중심 (96, 96).
// 페인터는 화면에 보이는 크기로 생각하고 그린다. 래스터 해상도는 `pixelsPerUnit`(384px 시트 = 2).
// 이전 세대(canvas.mjs, 48 격자 → 2배 복제)는 한 픽셀이 화면에서 4 CSS px 로 보여 몬스터(384px
// 원본) 옆에서 10배 거친 격자를 드러냈다. 여기서는 최근접 복제가 없다 — 모든 가장자리는 1px 폭의
// 커버리지로 부드럽게 끝난다.
//
// 버퍼는 float 프리멀티플라이드 RGBA(0..1). `over` 는 보통 합성, `add` 는 빛을 쌓는다 —
// 가산으로 겹친 글로우는 코어가 흰색으로 타올라 CSS 블렌드 없이도 광원처럼 보인다.
// 모든 프리미티브는 자기 경계 상자만 순회하므로 비용은 그린 면적에 비례한다.

export const DESIGN_SIZE = 192;
export const CENTER = DESIGN_SIZE / 2;
export const TAU = Math.PI * 2;

/** @typedef {{ size: number, ppu: number, data: Float32Array }} Raster */

export function createRaster(pixelsPerUnit) {
  const size = Math.round(DESIGN_SIZE * pixelsPerUnit);
  return { size, ppu: pixelsPerUnit, data: new Float32Array(size * size * 4) };
}

/** 0..255 색 + 0..1 알파 → 프리미티브가 먹는 [r,g,b,a](0..1). */
export function rgba(r, g, b, a = 1) {
  return [r / 255, g / 255, b / 255, a];
}

export function withAlpha(color, alpha) {
  return [color[0], color[1], color[2], Math.max(0, Math.min(1, alpha))];
}

/** 두 색의 선형 보간(알파 포함). */
export function mix(a, b, t) {
  const k = clamp01(t);
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k];
}

export function clamp01(value) {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/** 0→1 로 올라가는 구간. start 이전 0, end 이후 1. */
export function ramp(p, start, end) {
  return clamp01((p - start) / Math.max(1e-6, end - start));
}

/** start 이후 1→floor 로 내려가는 소멸 곡선. 마지막 프레임을 완전히 비우지 않는다(빈 컷 방지). */
export function decay(p, start, floor = 0) {
  if (p <= start) return 1;
  return floor + (1 - floor) * clamp01(1 - (p - start) / Math.max(1e-6, 1 - start));
}

/** 올라갔다 내려오는 봉우리. peak 에서 1. */
export function pulse(p, start, peak, end) {
  if (p <= start || p >= end) return 0;
  return p < peak ? ramp(p, start, peak) : 1 - ramp(p, peak, end);
}

function blendPixel(data, index, r, g, b, a, add) {
  if (a <= 0) return;
  if (add) {
    data[index] += r * a;
    data[index + 1] += g * a;
    data[index + 2] += b * a;
    data[index + 3] = data[index + 3] + a - data[index + 3] * a;
    return;
  }
  const keep = 1 - a;
  data[index] = r * a + data[index] * keep;
  data[index + 1] = g * a + data[index + 1] * keep;
  data[index + 2] = b * a + data[index + 2] * keep;
  data[index + 3] = a + data[index + 3] * keep;
}

/**
 * SDF 하나를 경계 상자 안에서 래스터한다.
 * @param {Raster} raster
 * @param {number[]} bbox [x0,y0,x1,y1] 디자인 단위
 * @param {(x:number,y:number)=>number} sdf 디자인 단위 부호 거리(안쪽 음수)
 * @param {number[]} color [r,g,b,a]
 * @param {{soft?:number, falloff?:number, add?:boolean, alphaAt?:(x:number,y:number,d:number)=>number}} opts
 *   soft: 가장자리 안쪽으로 이만큼(단위) 알파가 0→1 로 오른다(글로우). falloff: 그 곡선의 지수.
 */
export function rasterSdf(raster, bbox, sdf, color, opts = {}) {
  const { size, ppu, data } = raster;
  const soft = opts.soft ?? 0;
  const falloff = opts.falloff ?? 1;
  const add = opts.add === true;
  const alphaAt = opts.alphaAt;
  const aa = 1 / ppu; // 1 래스터 px 폭의 커버리지 경사
  const x0 = Math.max(0, Math.floor(bbox[0] * ppu) - 1);
  const y0 = Math.max(0, Math.floor(bbox[1] * ppu) - 1);
  const x1 = Math.min(size - 1, Math.ceil(bbox[2] * ppu) + 1);
  const y1 = Math.min(size - 1, Math.ceil(bbox[3] * ppu) + 1);
  if (x1 < x0 || y1 < y0) return;
  const [r, g, b, baseAlpha] = color;
  if (baseAlpha <= 0) return;
  for (let py = y0; py <= y1; py += 1) {
    const uy = (py + 0.5) / ppu;
    let index = (py * size + x0) * 4;
    for (let px = x0; px <= x1; px += 1, index += 4) {
      const ux = (px + 0.5) / ppu;
      const d = sdf(ux, uy);
      if (d >= aa) continue;
      let coverage = d <= -aa ? 1 : 0.5 - d / (2 * aa);
      if (soft > 0) {
        const inner = clamp01(-d / soft);
        coverage *= falloff === 1 ? inner : Math.pow(inner, falloff);
      }
      let alpha = baseAlpha * coverage;
      if (alphaAt) alpha *= alphaAt(ux, uy, d);
      if (alpha <= 0.0005) continue;
      blendPixel(data, index, r, g, b, alpha, add);
    }
  }
}

// ── SDF 프리미티브 ─────────────────────────────────────────────────────────────

/** 원. soft>0 이면 가장자리→중심으로 알파가 오르는 글로우가 된다. */
export function disc(raster, cx, cy, radius, color, opts = {}) {
  if (radius <= 0) return;
  rasterSdf(raster, [cx - radius, cy - radius, cx + radius, cy + radius], (x, y) => Math.hypot(x - cx, y - cy) - radius, color, opts);
}

/** 가우시안풍 광원: soft=radius, falloff 로 퍼짐을 조절. 기본 add 합성. */
export function glow(raster, cx, cy, radius, color, opts = {}) {
  disc(raster, cx, cy, radius, color, { soft: radius, falloff: opts.falloff ?? 2, add: opts.add ?? true });
}

/** 링. thickness 는 전체 두께. */
export function ring(raster, cx, cy, radius, thickness, color, opts = {}) {
  if (radius <= 0 || thickness <= 0) return;
  const outer = radius + thickness / 2;
  rasterSdf(
    raster,
    [cx - outer, cy - outer, cx + outer, cy + outer],
    (x, y) => Math.abs(Math.hypot(x - cx, y - cy) - radius) - thickness / 2,
    color,
    opts
  );
}

/** 타원 링(원근 있는 마법진·차원문). sx/sy 는 반지름. */
export function ellipseRing(raster, cx, cy, sx, sy, thickness, color, opts = {}) {
  if (sx <= 0 || sy <= 0) return;
  const pad = thickness;
  rasterSdf(
    raster,
    [cx - sx - pad, cy - sy - pad, cx + sx + pad, cy + sy + pad],
    (x, y) => {
      // 정규화 거리의 근사 — 얇은 링에서는 충분히 정확하다.
      const nx = (x - cx) / sx;
      const ny = (y - cy) / sy;
      const k = Math.hypot(nx, ny);
      const scale = Math.hypot(nx / sx, ny / sy) || 1;
      return Math.abs((k - 1) * (k / scale)) - thickness / 2;
    },
    color,
    opts
  );
}

/** 타원 채움(차원문 안쪽·바닥 그림자). 얇은 링과 같은 정규화 거리 근사를 쓴다. */
export function ellipse(raster, cx, cy, sx, sy, color, opts = {}) {
  if (sx <= 0 || sy <= 0) return;
  rasterSdf(
    raster,
    [cx - sx - 1, cy - sy - 1, cx + sx + 1, cy + sy + 1],
    (x, y) => {
      const nx = (x - cx) / sx;
      const ny = (y - cy) / sy;
      const k = Math.hypot(nx, ny);
      const scale = Math.hypot(nx / sx, ny / sy) || 1;
      return (k - 1) * (k / scale);
    },
    color,
    opts
  );
}

/** 점 → 선분 거리와 투영 비율. */
function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq <= 0 ? 0 : clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSq);
  return { distance: Math.hypot(px - (ax + dx * t), py - (ay + dy * t)), t };
}

/**
 * 굵기가 변하는 스트로크 — 선분 사슬. `radii[i]` 는 점 i 에서의 반지름(선형 보간).
 * 참격·번개·나선·줄기 전부 이걸로 그린다. 끝을 0 으로 주면 뾰족해진다.
 */
export function stroke(raster, points, radii, color, opts = {}) {
  if (points.length < 2) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const rad = (i) => (typeof radii === "number" ? radii : radii[Math.min(i, radii.length - 1)]);
  for (let i = 0; i < points.length; i += 1) {
    const r = rad(i) + (opts.soft ?? 0) * 0;
    x0 = Math.min(x0, points[i][0] - r);
    y0 = Math.min(y0, points[i][1] - r);
    x1 = Math.max(x1, points[i][0] + r);
    y1 = Math.max(y1, points[i][1] + r);
  }
  // 선분별 경계 상자를 미리 계산해 픽셀마다 먼 선분을 싸게 거른다 — 48점 폴리라인이 10초 걸리던 원인.
  const margin = 2;
  const boxes = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const r = Math.max(rad(i), rad(i + 1)) + margin;
    boxes.push([
      Math.min(points[i][0], points[i + 1][0]) - r,
      Math.min(points[i][1], points[i + 1][1]) - r,
      Math.max(points[i][0], points[i + 1][0]) + r,
      Math.max(points[i][1], points[i + 1][1]) + r,
    ]);
  }
  rasterSdf(
    raster,
    [x0, y0, x1, y1],
    (x, y) => {
      let best = Infinity;
      for (let i = 0; i < points.length - 1; i += 1) {
        const box = boxes[i];
        if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
        const [ax, ay] = points[i];
        const [bx, by] = points[i + 1];
        const { distance, t } = segmentDistance(x, y, ax, ay, bx, by);
        const r = rad(i) + (rad(i + 1) - rad(i)) * t;
        const d = distance - r;
        if (d < best) best = d;
      }
      return best;
    },
    color,
    opts
  );
}

/** 반지름이 각도 노이즈로 일렁이는 링(정신 파동·음파). blob 의 링 판. */
export function wobbleRing(raster, cx, cy, radius, thickness, color, noise, opts = {}) {
  const amp = opts.amplitude ?? 0.1;
  const pad = radius * (1 + amp) + thickness;
  rasterSdf(
    raster,
    [cx - pad, cy - pad, cx + pad, cy + pad],
    (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const r = radius * (1 + amp * noise(Math.atan2(dy, dx)));
      return Math.abs(Math.hypot(dx, dy) - r) - thickness / 2;
    },
    color,
    opts
  );
}

/** 양끝이 뾰족한 렌즈형 줄기(참격 조각·꽃잎·잎·파편). angle 방향, 총 길이 length. */
export function streak(raster, cx, cy, angle, length, halfThickness, color, opts = {}) {
  const dx = Math.cos(angle) * length / 2;
  const dy = Math.sin(angle) * length / 2;
  const curve = opts.curve ?? 0;
  const nx = -Math.sin(angle) * curve;
  const ny = Math.cos(angle) * curve;
  const steps = 6;
  const points = [];
  const radii = [];
  for (let i = 0; i <= steps; i += 1) {
    const s = i / steps * 2 - 1;
    const bend = 1 - s * s;
    points.push([cx + dx * s + nx * bend, cy + dy * s + ny * bend]);
    radii.push(halfThickness * Math.sqrt(Math.max(0, bend)) + 0.01);
  }
  stroke(raster, points, radii, color, opts);
}

/** 초승달 호(참격·충격파 조각·소리 파동). 각도 구간 [a0,a1], 끝은 taper 로 가늘어진다. */
export function arc(raster, cx, cy, radius, thickness, a0, a1, color, opts = {}) {
  const span = a1 - a0;
  const steps = Math.max(6, Math.ceil(Math.abs(span) * radius / 6));
  const points = [];
  const radii = [];
  const taper = opts.taper ?? 1;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = a0 + span * t;
    points.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
    const edge = 1 - Math.pow(Math.abs(t * 2 - 1), 2 / Math.max(0.1, taper));
    radii.push(thickness / 2 * (taper >= 1 ? Math.max(0.05, edge) : 1) + 0.01);
  }
  stroke(raster, points, radii, color, opts);
}

/** 볼록/오목 다각형(파편·톱니·육각 방패·나뭇잎). */
export function polygon(raster, vertices, color, opts = {}) {
  if (vertices.length < 3) return;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of vertices) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  const n = vertices.length;
  rasterSdf(
    raster,
    [x0, y0, x1, y1],
    (px, py) => {
      let dist = Infinity;
      let sign = 1;
      for (let i = 0, j = n - 1; i < n; j = i, i += 1) {
        const [ax, ay] = vertices[i];
        const [bx, by] = vertices[j];
        const ex = bx - ax;
        const ey = by - ay;
        const wx = px - ax;
        const wy = py - ay;
        const t = clamp01((wx * ex + wy * ey) / (ex * ex + ey * ey || 1));
        const dx = wx - ex * t;
        const dy = wy - ey * t;
        dist = Math.min(dist, dx * dx + dy * dy);
        const c1 = py >= ay;
        const c2 = py < by;
        const c3 = ex * wy > ey * wx;
        if ((c1 && c2 && c3) || (!c1 && !c2 && !c3)) sign = -sign;
      }
      return sign * Math.sqrt(dist);
    },
    color,
    opts
  );
}

/** 4점 별(반짝임). arm 은 팔 길이, core 는 중심 광 반지름. */
export function sparkle(raster, cx, cy, arm, color, opts = {}) {
  const thickness = opts.thickness ?? arm * 0.22;
  for (const angle of [0, Math.PI / 2]) {
    streak(raster, cx, cy, angle + (opts.rotate ?? 0), arm * 2, thickness, color, { add: opts.add ?? true });
  }
  glow(raster, cx, cy, arm * 0.6, color, { falloff: 1.5 });
}

/**
 * 가장자리가 각도 노이즈로 흔들리는 원(불꽃·연기·안개·구름).
 * noise 는 makeAngularNoise 로 만든 함수 — 프레임마다 같은 시드로 같은 모양이 나온다.
 */
export function blob(raster, cx, cy, radius, color, noise, opts = {}) {
  const amp = opts.amplitude ?? 0.25;
  const pad = radius * (1 + amp) + 1;
  rasterSdf(
    raster,
    [cx - pad, cy - pad, cx + pad, cy + pad],
    (x, y) => {
      const dx = x - cx;
      const dy = y - cy;
      const angle = Math.atan2(dy, dx);
      return Math.hypot(dx, dy) - radius * (1 + amp * noise(angle));
    },
    color,
    opts
  );
}

/** 각도 주기 노이즈(-1..1). harmonics 개의 사인파를 시드된 위상으로 합친다. phase 로 회전시킨다. */
export function makeAngularNoise(rng, harmonics = 3, phase = 0) {
  const terms = [];
  let norm = 0;
  for (let k = 0; k < harmonics; k += 1) {
    const frequency = k + 2;
    const amplitude = 1 / (k + 1);
    terms.push({ frequency, amplitude, offset: rng() * TAU });
    norm += amplitude;
  }
  return (angle) => {
    let value = 0;
    for (const term of terms) value += Math.sin(angle * term.frequency + term.offset + phase * term.frequency) * term.amplitude;
    return value / norm;
  };
}

/** 지그재그 번개 경로. 시작→끝을 segments 로 나눠 수직 방향으로 jitter 만큼 흔든다. */
export function boltPath(rng, x0, y0, x1, y1, segments, jitter) {
  const points = [[x0, y0]];
  const dx = x1 - x0;
  const dy = y1 - y0;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  for (let i = 1; i < segments; i += 1) {
    const t = i / segments;
    const offset = (rng() * 2 - 1) * jitter * Math.sin(t * Math.PI) ** 0.5;
    points.push([x0 + dx * t + nx * offset, y0 + dy * t + ny * offset]);
  }
  points.push([x1, y1]);
  return points;
}

/** 시드 PRNG(mulberry32) — 같은 slug 는 항상 같은 파티클 배치. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugSeed(slug) {
  let hash = 0x811c9dc5;
  for (const char of slug) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** 파티클 파라미터를 프레임 시작에 한 번에 뽑는다 — 분기 안에서 뽑으면 시퀀스가 밀린다. */
export function particles(rng, count, make) {
  const list = [];
  for (let index = 0; index < count; index += 1) list.push(make(rng, index));
  return list;
}

/**
 * float 프리멀티 프레임들을 8비트 스트레이트 알파 RGBA 가로 스트립으로 합친다.
 *
 * `quantizeBits`(기본 6): 채널을 2^bits 단계로 양자화한다. 글로우 그라디언트는 8비트 그대로면
 * PNG 가 거의 압축되지 않는다(실측 3840×384 스트립 956KB). 6비트(64단계)는 무대에서 절반으로
 * 축소돼 보이는 384px 시트에서 밴딩이 보이지 않고, 적응 필터와 합쳐 1/5 이하로 준다.
 */
export function toStrip(rasters, quantizeBits = 6) {
  const size = rasters[0].size;
  const width = size * rasters.length;
  const out = new Uint8Array(width * size * 4);
  const levels = (1 << quantizeBits) - 1;
  const quantize = (unit) => Math.round((Math.round(Math.min(1, unit) * levels) / levels) * 255);
  rasters.forEach((raster, frameIndex) => {
    const { data } = raster;
    const originX = frameIndex * size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const source = (y * size + x) * 4;
        const alpha = Math.min(1, data[source + 3]);
        const target = (y * width + originX + x) * 4;
        if (alpha <= 1 / levels / 2) continue;
        out[target] = quantize(data[source] / alpha);
        out[target + 1] = quantize(data[source + 1] / alpha);
        out[target + 2] = quantize(data[source + 2] / alpha);
        out[target + 3] = quantize(alpha);
      }
    }
  });
  return { width, height: size, data: out };
}
