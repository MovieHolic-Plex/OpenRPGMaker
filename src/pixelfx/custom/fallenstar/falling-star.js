// 폴른 스타 전용 — 떨어지는 별. 하늘 왼쪽 위에서 별이 꼬리를 끌며 내리꽂히고, 닿는 순간 빛살·바닥 충격파,
// 튕겨 나간 별 조각이 떨어지며 패인 자리가 식어 간다(기성 arcane/star-fall 은 작은 별 여러 개가 흩뿌려진다).
import { fit, rng, clamp, ease, mix, WHITE, READY, sparkle, flare, band } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Falling star",
  desc: "One star plunges from the upper left trailing a long white-gold tail, bursts on the ground in a flare and a ground shockwave, and throws star shards that bounce and fade over a cooling crater.",
  tags: ["star", "meteor", "holy", "impact", "aoe", "one-shot"],
  size: [220, 240],
  origin: [120, 214],
  duration: 1.9,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#14123a", "#2b2f7a", "#3f6cc4", "#7fb4f0", "#c8e6ff", "#fff1b8", "#ffd86b", "#ffffff"],
    seed: 17,
  },
};

const POINT = { ...READY, lean: -5, hx: -3, fx: 5, fy: -44, bx: 9, by: -24 };
export const act = {
  target: { x: 64 },
  poses: [[-0.8, { ...READY }], [-0.3, POINT], [0.5, POINT], [0.62, { ...POINT, crouch: 5 }], [1.1, { ...READY, crouch: 3 }], [1.7, { ...READY }]],
  hits: [{ t: 0.55, stop: 0.12, shake: 0.3, amp: 3, push: 3, straw: 14 }],
};

const FALL = 0.55;
const START = [-96, -200];
const at = (q) => [START[0] * (1 - q), START[1] * (1 - q) - 4];

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8), gold = C[6], pale = C[5], hot = C[7];

  if (t < FALL) {
    const q = ease.inQuad(clamp(t / FALL)), [x, y] = at(q), len = 30 + 120 * Math.min(1, q * 1.6);
    const dx = -START[0], dy = -START[1], l = Math.hypot(dx, dy), ux = dx / l, uy = dy / l, nx = -uy, ny = ux;
    // 꼬리: 머리에서 멀어질수록 가늘고 차가워진다(금 → 하늘 → 남).
    for (let d = 0; d < len; d += 0.6) {
      const u = d / len, w = (5.5 * Math.pow(1 - u, 1.4)) + 0.4, c = u < 0.12 ? hot : u < 0.3 ? pale : u < 0.55 ? C[4] : u < 0.8 ? C[3] : C[2];
      const cx = x - ux * d, cy = y - uy * d;
      for (let s = -w; s <= w; s += 0.6) {
        const edge = Math.abs(s) / w;
        p.dot(cx + nx * s, cy + ny * s, edge > 0.7 ? C[Math.max(1, 3 - Math.round(u * 2))] : c, (1 - u * 0.85) * (edge > 0.7 ? 0.6 : 1));
      }
    }
    for (let i = 0; i < 14; i++) {
      const R = rng(o.seed, i), d = R.range(10, len), s = R.range(-9, 9);
      p.dot(x - ux * d + nx * s, y - uy * d + ny * s, R.chance(0.5) ? pale : C[4], 1 - d / len);
    }
    p.circle(x, y, 6, gold); p.circle(x - 1, y - 1, 4, hot);
    sparkle(p, x, y, 6 + 3 * Math.sin(t * 40), pale, gold, 0.7);
    p.glow(x, y, 34, gold, 0.65);
    // 다가올수록 바닥이 밝아진다
    p.ellipse(0, 0, 10 + 30 * q, 3 + 4 * q, mix(C[1], C[3], q), 0.35 * q);
    return;
  }

  const a = t - FALL;
  // 패인 자리: 뜨거운 금빛에서 남빛 재로 식는다.
  const cool = clamp(a / 1.1), fade = 1 - clamp((a - 0.95) / 0.4);
  p.ellipse(0, 0, 30, 6, C[0], 0.85 * fade);
  p.ellipse(0, -0.5, 22, 4, mix(gold, C[1], cool), fade);
  p.ellipse(0, -1, 11, 2, mix(hot, C[2], cool), fade);
  p.glow(0, -2, 40, gold, 0.5 * (1 - cool) * fade);

  // 번쩍임과 빛살
  if (a < 0.28) {
    const k = 1 - a / 0.28;
    p.circle(0, -8, 14 * (1 - k * 0.3) + 4, hot, k);
    flare(p, 0, -8, 50 * ease.outCubic(1 - a / 0.28 * 0.6), k, ["#3f6cc4", "#c8e6ff", "#fff1b8", "#ffffff"]);
    p.glow(0, -8, 90, WHITE, 0.9 * k);
  }
  // 바닥 충격파 두 겹
  for (const [d, th] of [[0, 4], [0.1, 2.5]]) {
    const u = (a - d) / 0.55;
    if (u > 0 && u < 1) band(p, 0, -1, 14 + 86 * ease.outCubic(u), 0.22, th, 1 - u, ["#2b2f7a", "#3f6cc4", "#c8e6ff", "#fff1b8"], undefined, u < 0.25);
  }
  // 위로 솟는 빛기둥
  if (a < 0.5) {
    const k = 1 - a / 0.5, h = 70 * ease.outCubic(Math.min(1, a / 0.12));
    p.rect(-3 * k - 1, -h, 6 * k + 2, h, pale, 0.6 * k);
    p.rect(-1, -h, 2, h, hot, k);
  }
  // 별 조각: 튀어 올랐다가 떨어져 한 번 튀고 꺼진다.
  for (let i = 0; i < 16; i++) {
    const R = rng(o.seed + 3, i), ang = R.range(-Math.PI + 0.25, -0.25), sp = R.range(60, 150), life = R.range(0.7, 1.25);
    if (a > life) continue;
    const vx = Math.cos(ang) * sp, vy = Math.sin(ang) * sp * 0.9, g = 320;
    const tLand = (-2 * vy) / g;
    let x = vx * a, y = vy * a + 0.5 * g * a * a;
    if (a > tLand) { const b = a - tLand; x = vx * tLand + vx * 0.5 * b; y = (vy * -0.35) * b + 0.5 * g * b * b; if (y > 0) y = 0; }
    const k = 1 - a / life, c = k > 0.6 ? hot : k > 0.3 ? pale : C[4];
    if (i % 3 === 0) sparkle(p, x, y - 1, 2.5 * k + 1, c, C[4], 0.25 * k);
    else p.rect(x, y - 2, 2, 2, c, Math.min(1, k * 1.6));
  }
  // 늦게 떠오르는 별가루
  for (let i = 0; i < 10; i++) {
    const R = rng(o.seed + 9, i), b = a - R.range(0.15, 0.6), life = R.range(0.5, 0.9);
    if (b < 0 || b > life) continue;
    p.dot(R.range(-22, 22) + Math.sin(b * 6 + i) * 2, -2 - b * R.range(20, 40), R.chance(0.5) ? pale : C[4], 1 - b / life);
  }
}
