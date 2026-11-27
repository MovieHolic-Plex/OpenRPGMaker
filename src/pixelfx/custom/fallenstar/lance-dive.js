// 폴른 스타 전용 — 새라 창 낙하(큰 도약 · 쌍창 돌파). 진홍 강철 창빛이 가파르게 내리꽂혀 바닥을 가른다.
import { fit, rng, clamp, ease, mix, WHITE, READY, sparkle, flare, band } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Lance dive",
  desc: "A crimson-steel spear plunges steeply from above, slamming into the target with a ruby flare, dual ground shockwaves, and flying stone splinters.",
  tags: ["spear", "pierce", "jump", "crimson", "impact", "one-shot"],
  size: [180, 220],
  origin: [90, 192],
  duration: 1.15,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#26080e", "#6e1424", "#b82438", "#e24858", "#ff8a7a", "#ffd0b8", "#e6eef8", "#ffffff"],
    seed: 29,
  },
};

export const act = {
  target: { x: 56 },
  poses: [[-0.4, { ...READY }], [0.35, { ...READY, crouch: 5 }], [1.0, { ...READY }]],
  hits: [{ t: 0.34, stop: 0.13, shake: 0.28, amp: 4, push: 4, straw: 14 }],
};

const HIT = 0.34;
const START = [44, -184];

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8), crimson = C[2], bright = C[3], steel = C[6], hot = C[7];

  if (t < HIT) {
    const q = ease.inQuad(clamp(t / HIT));
    const x = START[0] * (1 - q), y = START[1] * (1 - q) - 4;
    const dx = -START[0], dy = -START[1], l = Math.hypot(dx, dy);
    const ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    const len = 46 + 80 * q;
    for (let d = 0; d < len; d += 1) {
      const u = d / len;
      const w = 4.2 * Math.pow(1 - u, 1.3) + 0.5;
      const col = u < 0.18 ? hot : u < 0.38 ? steel : u < 0.7 ? bright : crimson;
      const cx = x - ux * d, cy = y - uy * d;
      for (let s = -w; s <= w; s += 0.8) p.dot(cx + nx * s, cy + ny * s, col, (1 - u * 0.85));
    }
    p.circle(x, y, 4.5, hot);
    p.glow(x, y, 28, bright, 0.75);
    p.ellipse(0, 0, 8 + 22 * q, 3 + 3 * q, crimson, 0.35 * q);
    return;
  }

  const a = t - HIT;
  const fade = 1 - clamp((a - 0.5) / 0.3);

  p.ellipse(0, 0, 28, 6, C[0], 0.8 * fade);
  p.ellipse(0, -1, 16, 3.5, mix(bright, C[1], clamp(a / 0.65)), fade);

  if (a < 0.24) {
    const k = 1 - a / 0.24;
    flare(p, 0, -10, 48 * ease.outCubic(1 - a / 0.24 * 0.4), k, [crimson, bright, steel, WHITE]);
    p.glow(0, -10, 74, bright, 0.85 * k);
  }

  for (const [delay, th] of [[0, 4], [0.08, 2.2]]) {
    const u = (a - delay) / 0.48;
    if (u > 0 && u < 1) band(p, 0, -1, 12 + 72 * ease.outCubic(u), 0.22, th, 1 - u, [C[1], crimson, C[4], WHITE], undefined, u < 0.25);
  }

  for (let i = 0; i < 16; i += 1) {
    const R = rng(o.seed + 7, i);
    const life = R.range(0.35, 0.75);
    if (a > life) continue;
    const ang = R.range(-Math.PI + 0.3, -0.3);
    const sp = R.range(55, 135);
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp;
    const x = vx * a, y = vy * a + 170 * a * a;
    if (y > 2) continue;
    const k = 1 - a / life;
    const col = i % 3 === 0 ? hot : i % 2 === 0 ? C[4] : bright;
    if (i % 4 === 0) sparkle(p, x, y, 2.5 * k + 1, hot, bright, 0.7 * k);
    else p.rect(x, y - 1, 2, 2, col, Math.min(1, k * 1.5));
  }
}
