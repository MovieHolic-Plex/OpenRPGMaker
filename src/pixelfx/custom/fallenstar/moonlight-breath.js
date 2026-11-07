// 폴른 스타 전용 — 달빛 숨결(달빛 용). 전투 효과는 대상 발밑에 놓이므로 숨결은 왼쪽 밖에서 밀려 들어와
// 대상(원점)을 덮고 그 뒤로 번진 다음, 서리 결정과 달가루를 남기고 걷힌다. 대상이 왼쪽이면 엔진이 좌우를 뒤집는다.
import { fit, rng, clamp, ease, mix, WHITE, sparkle, band } from "../../../vendor/pixelfx/core/index.js";
import { soft, solid } from "../../../vendor/pixelfx/fx/fire/_lib.js";

export const meta = {
  name: "Moonlight breath",
  desc: "A dragon's breath of moonlight rolls in from the left: a white-silver core inside billowing blue haze, swallowing the target, washing past it in a frosted bloom with crescent glints, then settling as frost crystals and drifting moon dust.",
  tags: ["moon", "breath", "dragon", "ice", "stream", "directional", "aoe", "one-shot"],
  size: [300, 150],
  origin: [210, 122],
  duration: 2.1,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#0e1430", "#1d2e63", "#3256a0", "#5e8fd6", "#9cc6f2", "#d4ecff", "#f4fbff", "#ffffff"],
    seed: 31,
  },
};

const SRC = [-214, -34];
const ON = 0.12;
const OFF = 1.15;
const SPEED = 330;

function crescent(p, x, y, r, c, k) {
  for (let a = -2.2; a <= 2.2; a += 0.12) {
    const w = 1 - Math.abs(a) / 2.2;
    p.dot(x + Math.cos(a) * r, y + Math.sin(a) * r, c, k * (0.4 + 0.6 * w));
    if (w > 0.45) p.dot(x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1), c, k * w);
  }
}

export function draw(p, t, o) {
  if (t < 0 || t >= meta.duration) return;
  const C = fit(o.palette, 8);
  const flow = clamp((t - ON) / 0.25) * (1 - clamp((t - OFF) / 0.35));
  const reach = SPEED * Math.max(0, t - ON);

  // 숨결 구름: 왼쪽 밖에서 태어나 오른쪽으로 흐르며 부풀고 식는다. 대상에 닿으면 위아래로 퍼진다.
  const puffs = [];
  for (let i = 0; i < 260; i++) {
    const R = rng(o.seed, i), born = ON + R.range(0, OFF - ON), age = t - born, life = R.range(0.55, 0.85);
    if (age < 0 || age > life) continue;
    const e = R.range(-1, 1) * R.range(0.4, 1), sp = SPEED * R.range(0.85, 1.15), d = sp * age, lift = (-SRC[1] - 18) * Math.min(1, d / -SRC[0]);
    let x = SRC[0] + d, y = SRC[1] + lift + e * (3 + d * 0.11) + Math.sin(age * 9 + i) * 1.5;
    if (x > -12) { const over = x + 12; x = -12 + over * 0.55; y += e * over * 0.6 - over * 0.1; }
    const u = age / life;
    puffs.push([u, x, y, (1.6 + d * 0.022) * R.range(0.7, 1.3) * (0.8 + 1.1 * u), Math.abs(e)]);
  }
  puffs.sort((a, b) => b[0] - a[0]);
  for (const [u, x, y, s, edge] of puffs) {
    const heat = clamp(u * 1.1 + edge * 0.35);
    const idx = Math.round(7 - heat * 6);
    if (heat > 0.7) soft(p, x, y, s, C[Math.max(1, idx)], (1 - u) * 0.55);
    else { solid(p, x, y, s, C[Math.max(2, idx - 1)]); solid(p, x - s * 0.2, y - s * 0.25, s * 0.7, C[idx]); }
    if (idx >= 5) p.glow(x, y, s * 2.5, C[4], 0.08 * (1 - u));
  }

  // 한가운데 흰 줄기: 입에서 대상까지 곧게 뻗는다.
  if (flow > 0) {
    const x1 = Math.min(-6, SRC[0] + reach);
    for (let x = SRC[0]; x <= x1; x += 1) {
      const u = (x - SRC[0]) / (-SRC[0]), y = SRC[1] + (-SRC[1] - 18) * u + Math.sin(x * 0.15 + t * 20) * 0.8, w = 1 + 1.6 * u;
      p.rect(x, y - w, 1, w * 2, C[5], flow * (0.55 + 0.3 * (1 - u)));
      p.dot(x, y, WHITE, flow * (1 - u * 0.5));
    }
    p.glow(SRC[0] + 6, SRC[1], 26, C[5], 0.5 * flow);
    p.glow(Math.min(-10, x1), SRC[1] * 0.4 - 10, 40, C[4], 0.45 * flow);
  }

  // 대상을 덮는 달빛 덩이와 뒤로 번지는 서리 고리
  const hit = SRC[0] < 0 ? ON + -SRC[0] / SPEED : ON;
  const h = t - hit;
  if (h > 0) {
    const k = clamp(1 - (h - 0.8) / 0.5);
    p.glow(0, -20, 60, C[4], 0.4 * k * flow + 0.08 * k);
    soft(p, 0, -20, 14 + 4 * Math.sin(h * 7), mix(C[3], C[5], 0.5), 0.22 * k * flow);
    for (const [d, th] of [[0, 4], [0.35, 3], [0.7, 2]]) {
      const u = (h - d) / 0.7;
      if (u > 0 && u < 1) band(p, 0, -1, 12 + 70 * ease.outCubic(u), 0.24, th, 1 - u, ["#1d2e63", "#5e8fd6", "#d4ecff", "#ffffff"]);
    }
    // 바닥에 돋는 서리 결정
    const grow = ease.outBack(clamp(h / 0.3)), fade = 1 - clamp((h - 1.0) / 0.4);
    for (let i = 0; i < 9; i++) {
      const R = rng(o.seed + 5, i), x = R.range(-44, 50), ht = R.range(9, 22) * grow, lean = R.range(-5, 5);
      if (fade <= 0) break;
      p.tri(x - 4, 0, x + 4, 0, x + lean, -ht, C[2], fade);
      p.tri(x - 2, 0, x + 2.5, 0, x + lean * 0.9, -ht * 0.9, C[4], fade);
      p.tri(x - 0.5, -1, x + 1, -1, x + lean * 0.85, -ht * 0.75, C[6], fade);
      p.dot(x + lean, -ht, WHITE, fade);
    }
    // 초승달 반짝임
    for (let i = 0; i < 5; i++) {
      const R = rng(o.seed + 11, i), b = h - R.range(0.05, 0.6);
      if (b < 0 || b > 0.6) continue;
      const kk = Math.sin(Math.PI * b / 0.6);
      crescent(p, R.range(-36, 30), R.range(-58, -18), 3.5 + kk * 2, C[6], kk);
    }
  }

  // 달가루: 숨결을 따라 흐르다 대상 위로 천천히 떠오른다.
  for (let i = 0; i < 40; i++) {
    const R = rng(o.seed + 21, i), born = ON + R.range(0, OFF), age = t - born, life = R.range(0.7, 1.3);
    if (age < 0 || age > life) continue;
    const d = SPEED * 0.8 * Math.min(age, 0.6) + 20 * Math.max(0, age - 0.6);
    const x = Math.min(60, SRC[0] + d + R.range(-10, 10)), y = SRC[1] * (1 - Math.min(1, d / -SRC[0])) - 18 + R.range(-16, 16) - 18 * Math.max(0, age - 0.5);
    const k = 1 - age / life;
    if (i % 7 === 0) sparkle(p, x, y, 2 + 2 * k, C[6], C[4], 0.3 * k);
    else p.dot(x, y, k > 0.5 ? C[7] : C[5], k);
  }
}
