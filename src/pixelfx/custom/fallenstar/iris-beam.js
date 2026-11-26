// 폴른 스타 전용 — 이리스 「충전 광선포」. 육각 조준 고리가 표적에 잠기고, 시안·보라 성광 빔이 꿰뚫는다.
import { fit, rng, clamp, ease, WHITE, READY, sparkle, flare, band } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Iris prism beam",
  desc: "A violet-cyan geometric lock-on ring snaps onto the target, charges up, and fires a piercing starlight beam that shatters into prism sparks.",
  tags: ["beam", "laser", "holy", "scifi", "pierce", "one-shot"],
  size: [220, 140],
  origin: [152, 86],
  duration: 1.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#161036", "#462888", "#8a4fd8", "#48b8e8", "#90f4ff", "#d8fbff", "#f6f0ff", "#ffffff"],
    seed: 53,
  },
};

export const act = {
  target: { x: 64 },
  poses: [[-0.4, { ...READY }], [0.42, { ...READY, lean: -3 }], [1.0, { ...READY }]],
  hits: [{ t: 0.42, stop: 0.1, shake: 0.25, amp: 3, push: 3, straw: 12 }],
};

const FIRE = 0.42;

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8), violet = C[2], cyan = C[4], pale = C[5], hot = C[7];

  // 조준 고리(잠금 단계)
  if (t < FIRE) {
    const q = ease.outCubic(clamp(t / FIRE));
    const r = 34 - 18 * q;
    const rot = (1 - q) * 1.4;
    for (let i = 0; i < 4; i += 1) {
      const a = rot + i * (Math.PI / 2);
      const x1 = Math.cos(a) * r, y1 = Math.sin(a) * r - 12;
      const x2 = Math.cos(a) * (r + 8), y2 = Math.sin(a) * (r + 8) - 12;
      for (let s = 0; s <= 8; s += 1) {
        const u = s / 8;
        p.dot(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, u < 0.4 ? hot : cyan, 0.9);
      }
    }
    band(p, 0, -12, r, 1, 1.5, 0.55 + 0.35 * q, [C[1], violet, cyan, WHITE], undefined, false);
    sparkle(p, 0, -12, 3 + 4 * q, hot, cyan, 0.75 * q);
    p.glow(0, -12, 26 + 14 * q, cyan, 0.45 * q);
    return;
  }

  const a = t - FIRE;
  // 관통 광선
  if (a < 0.36) {
    const k = 1 - a / 0.36;
    const h = 11 * k + 2;
    p.rect(-152, -12 - h * 1.35, 220, h * 2.7, violet, 0.35 * k);
    p.rect(-152, -12 - h * 0.7, 220, h * 1.4, cyan, 0.7 * k);
    p.rect(-152, -12 - h * 0.3, 220, h * 0.6, hot, k);
    flare(p, 0, -12, 54 * ease.outCubic(1 - a / 0.36 * 0.5), k, [violet, cyan, pale, WHITE]);
    p.glow(0, -12, 82, cyan, 0.9 * k);
  }

  // 프리즘 파편
  for (let i = 0; i < 18; i += 1) {
    const R = rng(o.seed + 11, i);
    const life = R.range(0.32, 0.68);
    if (a > life) continue;
    const ang = R.range(-Math.PI, Math.PI);
    const sp = R.range(36, 118);
    const x = Math.cos(ang) * sp * a;
    const y = -12 + Math.sin(ang) * sp * a * 0.75;
    const k = 1 - a / life;
    const col = i % 3 === 0 ? hot : i % 2 === 0 ? cyan : violet;
    if (i % 3 === 0) sparkle(p, x, y, 2.5 * k + 1, hot, col, 0.8 * k);
    else p.rect(x, y, 2, 2, col, Math.min(1, k * 1.5));
  }
}
