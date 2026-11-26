// 폴른 스타 전용 — 「네 번째 대답」(4인 연계기). 카엘(금)·엘레나(하늘)·새라(진홍)·이리스(보라) 네 빛줄기가
// 한 점으로 모여 별빛 기둥으로 치솟고, 프리즘 충격파와 별 조각이 흩날린다.
import { fit, rng, clamp, ease, mix, WHITE, READY, sparkle, flare, band } from "../../../vendor/pixelfx/core/index.js";

export const meta = {
  name: "Fourth answer",
  desc: "Four colored starlight streams spiral into the target and erupt in a towering golden-prism beam, dual shockwave rings, and drifting star shards.",
  tags: ["star", "holy", "combo", "pillar", "aoe", "one-shot"],
  size: [240, 240],
  origin: [120, 204],
  duration: 1.85,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#1a1438", "#d0283c", "#8a4fd8", "#6ec8ff", "#ffd86b", "#fff1b8", "#e8fbff", "#ffffff"],
    seed: 41,
  },
};

export const act = {
  target: { x: 64 },
  poses: [[-0.6, { ...READY }], [0.6, { ...READY, crouch: 4 }], [1.5, { ...READY }]],
  hits: [{ t: 0.62, stop: 0.14, shake: 0.35, amp: 4, push: 4, straw: 16 }],
};

const CONVERGE = 0.62;
const STREAMS = [
  { sx: -102, sy: -150, colorIdx: 4 }, // 카엘 금빛
  { sx: 102, sy: -146, colorIdx: 3 },  // 엘레나 하늘빛
  { sx: -94, sy: -36, colorIdx: 1 },   // 새라 진홍
  { sx: 96, sy: -42, colorIdx: 2 },    // 이리스 보라
];

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8), gold = C[4], pale = C[5], cyan = C[6], hot = C[7];

  if (t < CONVERGE) {
    const q = ease.inQuad(clamp(t / CONVERGE));
    const swirl = (1 - q) * 1.15;
    for (let s = 0; s < STREAMS.length; s += 1) {
      const st = STREAMS[s];
      const col = C[st.colorIdx];
      for (let step = 0; step < 18; step += 1) {
        const u = clamp(q - step * 0.025);
        if (u <= 0) continue;
        const ang = Math.atan2(st.sy, st.sx) + (1 - u) * swirl * (s % 2 === 0 ? 1 : -1);
        const rad = Math.hypot(st.sx, st.sy) * (1 - u);
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad - 16 * u;
        const fade = (1 - step / 18) * (0.4 + 0.6 * q);
        p.circle(x, y, step < 3 ? 3.5 : 2, step < 2 ? hot : col, fade);
      }
      const headAng = Math.atan2(st.sy, st.sx) + (1 - q) * swirl * (s % 2 === 0 ? 1 : -1);
      const headRad = Math.hypot(st.sx, st.sy) * (1 - q);
      const hx = Math.cos(headAng) * headRad;
      const hy = Math.sin(headAng) * headRad - 16 * q;
      p.glow(hx, hy, 22, col, 0.7);
      sparkle(p, hx, hy, 4 + 2 * q, hot, col, 0.8);
    }
    p.ellipse(0, 0, 12 + 34 * q, 4 + 5 * q, mix(C[2], gold, q), 0.35 * q);
    return;
  }

  const a = t - CONVERGE;
  const fade = 1 - clamp((a - 0.85) / 0.38);

  // 바닥 별빛 진
  p.ellipse(0, 0, 38, 8, C[0], 0.75 * fade);
  p.ellipse(0, -1, 28, 5, mix(gold, C[3], clamp(a / 0.9)), 0.85 * fade);
  p.ellipse(0, -1, 14, 3, hot, fade);

  // 폭발 플래시
  if (a < 0.32) {
    const k = 1 - a / 0.32;
    p.circle(0, -14, 18 * (1 - k * 0.25) + 6, hot, k);
    flare(p, 0, -14, 68 * ease.outCubic(1 - a / 0.32 * 0.5), k, [C[2], C[3], pale, WHITE]);
    p.glow(0, -14, 108, WHITE, 0.92 * k);
  }

  // 거대한 별빛 기둥
  if (a < 0.82) {
    const k = 1 - clamp((a - 0.14) / 0.68);
    const h = 196 * ease.outCubic(clamp(a / 0.14));
    const w = 18 * k + 4;
    p.rect(-w * 1.4, -h, w * 2.8, h, C[3], 0.28 * k);
    p.rect(-w * 0.85, -h, w * 1.7, h, gold, 0.55 * k);
    p.rect(-w * 0.38, -h, w * 0.76, h, hot, 0.92 * k);
    p.glow(0, -h * 0.35, 64, pale, 0.55 * k);
  }

  // 3중 충격파
  for (const [delay, thick, colors] of [
    [0, 4.5, [C[1], gold, pale, WHITE]],
    [0.09, 3, [C[2], C[3], cyan, WHITE]],
    [0.19, 2, [C[3], gold, pale, WHITE]],
  ]) {
    const u = (a - delay) / 0.6;
    if (u > 0 && u < 1) band(p, 0, -2, 16 + 98 * ease.outCubic(u), 0.24, thick, 1 - u, colors, undefined, u < 0.22);
  }

  // 네 색깔 별 조각 상승
  for (let i = 0; i < 24; i += 1) {
    const R = rng(o.seed + 5, i);
    const life = R.range(0.55, 1.15);
    if (a > life) continue;
    const x = R.range(-48, 48) * (0.4 + 0.6 * ease.outCubic(a / life));
    const y = -4 - a * R.range(70, 175);
    const k = 1 - a / life;
    const col = C[1 + (i % 4)];
    if (i % 2 === 0) sparkle(p, x, y, 2.5 * k + 1.2, hot, col, 0.75 * k);
    else p.rect(x, y, 2, 3, col, Math.min(1, k * 1.4));
  }
}
