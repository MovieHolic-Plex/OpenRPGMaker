// 폴른 스타 전용 — 화염검. 기성 melee/sword-slash 와 같은 초승달 자리(몸 앞)에 불 띠를 휘두르고,
// 지나간 자리에서 불꽃 혀가 솟아 식으며 불티가 오른다.
import { fit, rng, clamp, smooth, ease, TAU, READY, sparkle } from "../../../vendor/pixelfx/core/index.js";
import { noiseFor, flameTongue, hotFirst, floorLight } from "../../../vendor/pixelfx/fx/fire/_lib.js";

export const meta = {
  name: "Flame sword",
  desc: "A sword sweeps a crescent of fire: white-hot at the edge, cooling to red at the tail, tongues of flame rising off the cut and embers drifting up.",
  tags: ["fire", "melee", "slash", "sword", "directional", "one-shot"],
  size: [150, 124],
  origin: [48, 104],
  duration: 0.95,
  loop: false,
  fps: 30,
  bg: "ground",
  actor: 2,
  options: {
    palette: ["#2a0a0a", "#6e1308", "#b8280c", "#e8541a", "#ff8a2a", "#ffc23d", "#ffe98a", "#fffbe6"],
    seed: 23,
  },
};

const GUARD = { ...READY, weapon: "sword", fx: 12, fy: -21, sa: -0.85 };
const WIND = { ...GUARD, x: -8, crouch: 4, lean: -4, fx: -7, fy: -35, sa: -2.65, bx: 9, by: -25, armsFront: true };
const CUT = { ...GUARD, crouch: 2, lean: 3, fx: 16, fy: -37, sa: -1.45, bx: -7, by: -24, ghost: 1 };
const DOWN = { ...GUARD, x: 2, crouch: 5, lean: 5, fx: 20, fy: -21, sa: 0.62, bx: -9, by: -24, toeB: true };
export const act = {
  target: { x: 58 },
  poses: [[-0.55, { ...GUARD, x: -8 }], [-0.3, WIND], [0, CUT, "snap"], [0.07, DOWN, "snap"], [0.4, { ...DOWN, x: 3, crouch: 6 }], [0.9, { ...GUARD, x: -8 }]],
  hits: [{ t: 0.07, stop: 0.14, shake: 0.2, amp: 2, push: 3, straw: 18 }],
};

const S = { cx: 8, cy: -30, R: 46, sy: 0.6, rot: -0.38, a0: -2.55, a1: 0.95, W: 14, sweep: 0.07, hold: 0.07, trail: 0.3 };
const onArc = (r, a) => {
  const lx = Math.cos(a) * r, ly = Math.sin(a) * r * S.sy, c = Math.cos(S.rot), n = Math.sin(S.rot);
  return [S.cx + lx * c - ly * n, S.cy + lx * n + ly * c];
};
const NL = noiseFor(0);

// 불 띠: 앞날 바로 뒤가 가장 두껍고 꼬리로 가늘어진다. 바깥 테가 흰빛, 안쪽과 꼬리로 갈수록 붉게 식는다.
function crescent(p, H, t) {
  const span = S.a1 - S.a0, head = ease.outExpo(clamp(t / S.sweep)), tail = smooth(S.sweep + S.hold, S.sweep + S.hold + S.trail, t);
  if (tail >= 1) return;
  const ta = S.a0 + span * tail, L = span * (head - tail), W = S.W * (1 - tail * 0.5), age = clamp(t / (S.sweep + S.hold + S.trail));
  if (L < 0.02) return;
  const c = Math.cos(S.rot), sn = Math.sin(S.rot), B = S.R + 4, n = H.length;
  p.shade(S.cx - B, S.cy - B, S.cx + B, S.cy + B, (x, y, out) => {
    const dx = x - S.cx, dy = y - S.cy, lx = dx * c + dy * sn, ly = (-dx * sn + dy * c) / S.sy, r = Math.hypot(lx, ly);
    if (r > S.R + 0.5 || r < S.R - W - 1) return;
    let u = (Math.atan2(ly, lx) - ta) % TAU;
    if (u < 0) u += TAU;
    if (u > L) return;
    const v = u / L, w = W * Math.pow(Math.sin(Math.PI * Math.pow(v, 2.1)), 0.55);
    if (w < 0.4) return;
    const q = (S.R - r) / w;
    if (q < 0 || q > 1) return;
    const ci = q < 0.16 && age < 0.45 ? 0 : Math.round(q * (n - 2) * 0.7 + age * 3.2 + (1 - v) * 1.4 + 0.5);
    out.c = H[clamp(ci, 0, n - 1)];
    out.a = Math.min(1, v / 0.3);
    out.k = 0.18 * (1 - age);
  });
  for (let u = 0.2; u <= 1; u += 0.2) {
    const [x, y] = onArc(S.R - W * 0.4, ta + L * u);
    p.glow(x, y, 10 + W, H[3], 0.3 * (1 - age) * u);
  }
}

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const H = hotFirst(fit(o.palette, 8)), N = (rate, seed = 0, off = 0) => NL(t, rate, seed, off), span = S.a1 - S.a0;

  // 바닥: 베인 자리 아래 그을음과 불빛
  const gk = clamp(t / 0.08) * (1 - clamp((t - 0.3) / 0.6));
  if (gk > 0) {
    floorLight(p, 30, 0, 34, 6, H[3], 0.4 * gk);
    p.ellipse(30, 0, 24 * gk + 4, 3, H[7], 0.55 * gk);
  }

  // 지나간 자리에서 솟는 불꽃 혀: 앞날이 지나는 순간 켜져 올라가며 식는다.
  for (let i = 0; i < 9; i++) {
    const R = rng(o.seed, i), f = clamp(0.2 + (i / 8) * 0.78 + R.range(-0.05, 0.05)), born = S.sweep * Math.pow(f, 0.35), life = R.range(0.38, 0.62), age = t - born;
    if (age < 0 || age > life) continue;
    const k = 1 - age / life, [x, y] = onArc(S.R - 3, S.a0 + span * f);
    const h = (6 + 16 * Math.pow(Math.sin(Math.PI * f), 2)) * Math.pow(k, 0.7) * R.range(0.55, 1.2);
    const layers = k > 0.55 ? undefined : [[1, 1, 7], [0.72, 0.82, 5], [0.44, 0.58, 4]];
    flameTongue(p, x, y - age * 14, h, 3.4 * (0.5 + 0.5 * k), R.range(-4, 4), N, i * 3 + 1, H, layers);
  }

  crescent(p, H, t);

  // 칼끝이 닿는 순간의 번쩍임
  const [tx, ty] = onArc(S.R - 4, S.a1), g = t - S.sweep * 0.7;
  if (g > 0 && g < 0.22) sparkle(p, tx, ty, 10 * ease.outBack(Math.min(1, g / 0.05)) * (1 - g / 0.22), H[1], H[3], 0.7);
  if (t < 0.35) {
    const [hx, hy] = onArc(S.R - 5, S.a0 + span * ease.outExpo(clamp(t / S.sweep)));
    p.glow(hx, hy, 46, H[3], 0.55 * (1 - t / 0.35));
  }

  // 불티: 띠에서 튀어 위로 떠오르며 붉게 식는다.
  for (let i = 0; i < 26; i++) {
    const R = rng(o.seed + 7, i), f = R.range(0.25, 1), born = S.sweep * f + R.range(0, 0.12), life = R.range(0.35, 0.8), age = t - born;
    if (age < 0 || age > life) continue;
    const [x0, y0] = onArc(S.R + R.range(-6, 2), S.a0 + span * f), a = R.range(-2.6, -0.4), sp = R.range(30, 90);
    const x = x0 + Math.cos(a) * sp * age + N(3, i, 0) * 3, y = y0 + Math.sin(a) * sp * age - 18 * age * age, k = age / life;
    const c = H[clamp(Math.round(1 + k * 5), 0, H.length - 1)];
    p.dot(x, y, c, 1 - k * 0.6);
    if (i % 4 === 0 && k < 0.5) p.dot(x, y - 1, H[1], 1 - k);
  }
}
