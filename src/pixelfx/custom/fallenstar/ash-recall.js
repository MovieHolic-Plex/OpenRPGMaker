// 폴른 스타 전용 — 재의 회수자 「재의 회수」. 검은 재 소용돌이가 안으로 빨려 들었다가 붉은 불씨 폭발로 터진다.
import { fit, rng, clamp, ease, mix, WHITE, READY, flare, band } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Ash recall",
  desc: "A vortex of charcoal ash pulls inward around the target, then detonates in a crimson-ember nova with drifting ash flakes.",
  tags: ["fire", "ash", "boss", "aoe", "explosion", "one-shot"],
  size: [220, 180],
  origin: [110, 138],
  duration: 1.55,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#161314", "#362d2b", "#645652", "#9e3018", "#e8541a", "#ff9a3c", "#ffd88a", "#ffffff"],
    seed: 71,
  },
};

export const act = {
  target: { x: 64 },
  poses: [[-0.5, { ...READY }], [0.58, { ...READY, crouch: 4 }], [1.3, { ...READY }]],
  hits: [{ t: 0.58, stop: 0.14, shake: 0.35, amp: 5, push: 4, straw: 16 }],
};

const BURST = 0.58;

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8), dark = C[0], ash = C[2], ember = C[4], bright = C[5], hot = C[7];

  if (t < BURST) {
    const q = ease.inQuad(clamp(t / BURST));
    for (let i = 0; i < 28; i += 1) {
      const R = rng(o.seed, i);
      const baseAng = R.range(0, Math.PI * 2);
      const ang = baseAng + q * 4.4;
      const rad = R.range(48, 92) * (1 - q * 0.84);
      const x = Math.cos(ang) * rad;
      const y = -14 + Math.sin(ang) * rad * 0.45;
      p.rect(x, y, 2, 2, i % 3 === 0 ? ember : ash, 0.35 + 0.65 * q);
    }
    p.circle(0, -14, 4 + 14 * q, mix(dark, ember, q), 0.75 * q);
    p.glow(0, -14, 34 + 34 * q, ember, 0.55 * q);
    return;
  }

  const a = t - BURST;
  const fade = 1 - clamp((a - 0.6) / 0.37);

  p.ellipse(0, 0, 34, 7, dark, 0.85 * fade);
  p.ellipse(0, -1, 22, 4, mix(ember, C[1], clamp(a / 0.75)), 0.9 * fade);

  if (a < 0.3) {
    const k = 1 - a / 0.3;
    p.circle(0, -14, 18 * (1 - k * 0.25) + 6, hot, k);
    flare(p, 0, -14, 66 * ease.outCubic(1 - a / 0.3 * 0.45), k, [C[3], ember, bright, WHITE]);
    p.glow(0, -14, 102, ember, 0.95 * k);
  }

  for (const [delay, th] of [[0, 5], [0.1, 3]]) {
    const u = (a - delay) / 0.56;
    if (u > 0 && u < 1) band(p, 0, -2, 16 + 88 * ease.outCubic(u), 0.24, th, 1 - u, [C[1], C[3], ember, bright], undefined, u < 0.25);
  }

  // 재와 불티가 흩날리며 떨어진다
  for (let i = 0; i < 26; i += 1) {
    const R = rng(o.seed + 19, i);
    const life = R.range(0.45, 0.95);
    if (a > life) continue;
    const ang = R.range(-Math.PI, Math.PI);
    const sp = R.range(28, 105);
    const x = Math.cos(ang) * sp * ease.outCubic(a / life) + Math.sin(a * 7 + i) * 3;
    const y = -14 + Math.sin(ang) * sp * 0.55 * a + 38 * a * a;
    const k = 1 - a / life;
    const col = i % 3 === 0 ? bright : i % 2 === 0 ? ember : ash;
    p.rect(x, y, i % 4 === 0 ? 3 : 2, 2, col, Math.min(1, k * 1.4));
  }
}
