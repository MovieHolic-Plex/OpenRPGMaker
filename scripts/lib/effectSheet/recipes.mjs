// 이펙트가 공유하는 상위 어휘. 34종이 같은 글로우·파편·번개·파티클 언어를 쓰게 해 시각을 통일한다.
// 모든 좌표는 디자인 단위(전투 논리 px), 프레임 192×192, 중심 CENTER(96).
import {
  arc,
  blob,
  clamp01,
  disc,
  ellipseRing,
  glow,
  makeAngularNoise,
  polygon,
  rgba,
  ring,
  sparkle,
  streak,
  stroke,
  TAU,
  withAlpha,
} from "./raster.mjs";

/** 흰 코어 + 색 글로우 2겹. 광원의 기본형. */
export function core(f, x, y, radius, color, alpha = 1, opts = {}) {
  const white = rgba(255, 255, 255, alpha);
  glow(f, x, y, radius * 2.2, withAlpha(color, alpha * 0.45), { falloff: opts.spread ?? 2.4 });
  glow(f, x, y, radius * 1.2, withAlpha(color, alpha * 0.9), { falloff: 1.6 });
  glow(f, x, y, radius * 0.55, white, { falloff: 1.1 });
}

/** 충격파 링. 바깥은 선명, 안쪽으로 soft 하게 사라진다. */
export function shock(f, x, y, radius, thickness, color, alpha = 1, opts = {}) {
  if (radius <= 0) return;
  ring(f, x, y, radius, thickness, withAlpha(color, alpha), { soft: opts.soft ?? thickness * 0.8, add: opts.add ?? true });
  ring(f, x, y, radius, thickness * 0.35, rgba(255, 255, 255, alpha * 0.8), { add: true });
}

/** 방사선. count 개의 뾰족한 줄기가 inner→outer 로 뻗는다. lengths[i] 로 길이 편차. */
export function rays(f, x, y, count, inner, outer, halfWidth, color, alpha = 1, opts = {}) {
  const rotate = opts.rotate ?? 0;
  for (let i = 0; i < count; i += 1) {
    const angle = rotate + (i / count) * TAU;
    const scale = opts.lengths ? opts.lengths[i % opts.lengths.length] : 1;
    const length = (outer - inner) * scale;
    const mid = inner + length / 2;
    const cx = x + Math.cos(angle) * mid;
    const cy = y + Math.sin(angle) * mid;
    streak(f, cx, cy, angle, length, halfWidth, withAlpha(color, alpha), { add: opts.add ?? true, soft: opts.soft ?? halfWidth * 0.6 });
    streak(f, cx, cy, angle, length * 0.85, halfWidth * 0.4, rgba(255, 255, 255, alpha * 0.9), { add: true });
  }
}

/** 삼각 파편. list 는 {angle, size, spin, offset} 의 배열, dist 는 중심으로부터의 거리. */
export function shards(f, list, x, y, dist, color, edge, alpha = 1, opts = {}) {
  for (const shard of list) {
    const d = dist * (shard.offset ?? 1);
    const cx = x + Math.cos(shard.angle) * d;
    const cy = y + Math.sin(shard.angle) * d;
    const heading = shard.angle + (shard.spin ?? 0) * (opts.spinAmount ?? 0);
    const size = shard.size * (opts.sizeScale ?? 1);
    const tip = [cx + Math.cos(heading) * size, cy + Math.sin(heading) * size];
    const back = [cx - Math.cos(heading) * size * 0.6, cy - Math.sin(heading) * size * 0.6];
    const nx = -Math.sin(heading) * size * 0.32;
    const ny = Math.cos(heading) * size * 0.32;
    polygon(f, [tip, [back[0] + nx, back[1] + ny], [back[0] - nx, back[1] - ny]], withAlpha(edge, alpha));
    const inset = 0.55;
    polygon(
      f,
      [
        [cx + (tip[0] - cx) * inset, cy + (tip[1] - cy) * inset],
        [cx + (back[0] + nx - cx) * inset, cy + (back[1] + ny - cy) * inset],
        [cx + (back[0] - nx - cx) * inset, cy + (back[1] - ny - cy) * inset],
      ],
      withAlpha(color, alpha)
    );
  }
}

/** 번개: 넓은 글로우 + 좁은 흰 코어. path 는 boltPath 결과. */
export function bolt(f, path, width, glowColor, alpha = 1, opts = {}) {
  stroke(f, path, width * 4.5, withAlpha(glowColor, alpha * 0.4), { soft: width * 4.2, add: true });
  stroke(f, path, width * 1.6, withAlpha(glowColor, alpha * 0.9), { soft: width * 1.2, add: true });
  stroke(f, path, width * 0.5, rgba(255, 255, 255, alpha), { add: true, soft: width * 0.2 });
  if (opts.branches) {
    for (const branch of opts.branches) {
      stroke(f, branch, width * 0.6, withAlpha(glowColor, alpha * 0.8), { soft: width * 0.8, add: true });
      stroke(f, branch, width * 0.25, rgba(255, 255, 255, alpha * 0.9), { add: true });
    }
  }
}

/** 소프트 파티클(불티·먼지·빛 알갱이). list 는 {x, y, size, alpha} 의 배열(호출부가 계산). */
export function motes(f, list, color, opts = {}) {
  for (const mote of list) {
    if (mote.alpha <= 0.01 || mote.size <= 0) continue;
    glow(f, mote.x, mote.y, mote.size, withAlpha(color, mote.alpha), { falloff: opts.falloff ?? 1.4, add: opts.add ?? true });
  }
}

/** 4점 반짝임 파티클. */
export function sparkles(f, list, color, opts = {}) {
  for (const spark of list) {
    if (spark.alpha <= 0.01 || spark.size <= 0) continue;
    sparkle(f, spark.x, spark.y, spark.size, withAlpha(color, spark.alpha), { rotate: spark.rotate ?? 0, thickness: opts.thickness });
  }
}

/** 마법진: 링 2겹 + 방사 눈금 + 안쪽 다각형. rotate 로 돈다. */
export function sigil(f, x, y, radius, color, alpha = 1, opts = {}) {
  const rotate = opts.rotate ?? 0;
  const ticks = opts.ticks ?? 12;
  const thickness = opts.thickness ?? 2.6;
  const sy = opts.squash ?? 1;
  const ringAt = (r, t, a) => (sy === 1 ? ring(f, x, y, r, t, withAlpha(color, a), { add: true }) : ellipseRing(f, x, y, r, r * sy, t, withAlpha(color, a), { add: true }));
  ringAt(radius, thickness, alpha);
  ringAt(radius * 0.78, thickness * 0.6, alpha * 0.8);
  for (let i = 0; i < ticks; i += 1) {
    const angle = rotate + (i / ticks) * TAU;
    const r0 = radius * 0.8;
    const r1 = radius * 0.98;
    stroke(
      f,
      [[x + Math.cos(angle) * r0, y + Math.sin(angle) * r0 * sy], [x + Math.cos(angle) * r1, y + Math.sin(angle) * r1 * sy]],
      thickness * 0.45,
      withAlpha(color, alpha * 0.9),
      { add: true }
    );
  }
  const sides = opts.sides ?? 6;
  const vertices = [];
  for (let i = 0; i < sides; i += 1) {
    const angle = -rotate * 0.7 + (i / sides) * TAU;
    vertices.push([x + Math.cos(angle) * radius * 0.62, y + Math.sin(angle) * radius * 0.62 * sy]);
  }
  for (let i = 0; i < sides; i += 1) {
    stroke(f, [vertices[i], vertices[(i + 1) % sides]], thickness * 0.4, withAlpha(color, alpha * 0.75), { add: true });
  }
}

/** 바닥에서 솟는 기둥(물기둥·빛기둥). 가장자리는 noise 로 일렁인다. */
export function column(f, x, baseY, height, halfWidth, color, alpha = 1, opts = {}) {
  if (height <= 1) return;
  const top = baseY - height;
  const noise = opts.noise;
  const cap = opts.cap ?? halfWidth;
  const polyPoints = [];
  const steps = 14;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = baseY - height * t;
    const w = halfWidth * (1 - (opts.taper ?? 0.25) * t) * (1 + (noise ? noise(t * 5 + (opts.phase ?? 0)) * 0.18 : 0));
    polyPoints.push([x - w, y]);
  }
  for (let i = steps; i >= 0; i -= 1) {
    const t = i / steps;
    const y = baseY - height * t;
    const w = halfWidth * (1 - (opts.taper ?? 0.25) * t) * (1 + (noise ? noise(t * 5 + 2.1 + (opts.phase ?? 0)) * 0.18 : 0));
    polyPoints.push([x + w, y]);
  }
  polygon(f, polyPoints, withAlpha(color, alpha), { soft: opts.soft ?? halfWidth * 0.5 });
  if (opts.highlight) {
    stroke(f, [[x - halfWidth * 0.25, baseY - 4], [x - halfWidth * 0.2, top + cap * 0.6]], halfWidth * 0.14, withAlpha(opts.highlight, alpha * 0.9), { add: true, soft: 2 });
  }
}

/** 안개/연기 덩이 여러 개. list 는 {x, y, r, alpha, phase} — 호출부가 계산. */
export function clouds(f, list, color, rng, opts = {}) {
  const noise = opts.noise ?? makeAngularNoise(rng, 3);
  for (const cloud of list) {
    if (cloud.alpha <= 0.01 || cloud.r <= 0) continue;
    blob(f, cloud.x, cloud.y, cloud.r, withAlpha(color, cloud.alpha), (a) => noise(a + (cloud.phase ?? 0)), {
      amplitude: opts.amplitude ?? 0.3,
      soft: cloud.r * (opts.softness ?? 0.55),
    });
  }
}

/** 나선 경로 점열. turns 바퀴, r0→r1. */
export function spiralPath(x, y, r0, r1, turns, steps, phase = 0, squash = 1) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = phase + t * turns * TAU;
    const r = r0 + (r1 - r0) * t;
    points.push([x + Math.cos(angle) * r, y + Math.sin(angle) * r * squash]);
  }
  return points;
}

/** 초승달 참격 한 줄기: 두꺼운 색 호 + 얇은 흰 호. */
export function slashArc(f, x, y, radius, thickness, a0, a1, color, alpha = 1) {
  arc(f, x, y, radius, thickness, a0, a1, withAlpha(color, alpha * 0.75), { soft: thickness * 0.5, taper: 1.4 });
  arc(f, x, y, radius, thickness * 0.55, a0, a1, withAlpha(color, alpha), { taper: 1.4, add: true });
  arc(f, x, y, radius, thickness * 0.22, a0, a1, rgba(255, 255, 255, alpha), { taper: 1.6, add: true });
}

export { clamp01, disc, TAU };
