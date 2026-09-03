// 상태이상·보조·연출 계열. painter(f, p, rng) 규약은 impact.mjs 와 같다.
import {
  CENTER as C,
  decay,
  disc,
  ellipse,
  ellipseRing,
  glow,
  makeAngularNoise,
  particles,
  polygon,
  pulse,
  ramp,
  rgba,
  ring,
  streak,
  stroke,
  TAU,
} from "../raster.mjs";
import { bolt, clouds, column, core, motes, rays, shards, shock, sparkles, spiralPath } from "../recipes.mjs";

const CRIT = rgba(255, 230, 150);
const SONIC = rgba(150, 230, 255);
const REVIVE = rgba(255, 240, 200);
const CLEANSE = rgba(190, 250, 255);
const PARALYSIS = rgba(255, 230, 90);
const SILENCE = rgba(200, 170, 230);
const PORTAL = rgba(120, 90, 255);
const METEOR = rgba(255, 150, 70);

export function criticalBurst(f, p, rng) {
  const chunks = particles(rng, 16, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 1.8 + next() * 2.4, spin: next() * TAU }));
  const shardList = particles(rng, 8, (next, i) => ({ angle: (i / 8) * TAU + next() * 0.3, size: 9 + next() * 7, spin: next() - 0.5 }));
  const hit = pulse(p, 0, 0.16, 0.6);
  const expand = ramp(p, 0, 1);
  const fade = decay(p, 0.4, 0.06);
  core(f, C, C, 14 + 16 * hit, CRIT, Math.max(hit, 0.25 * fade));
  rays(f, C, C, 12, 10, 40 + 56 * ramp(p, 0, 0.35), 4.5 * (1 - expand * 0.5) + 0.5, CRIT, fade, { rotate: 0.15, lengths: [1, 0.55, 0.8, 0.45, 0.9, 0.6] });
  shock(f, C, C, 8 + 80 * ramp(p, 0.04, 0.8), 5 * (1 - expand * 0.6) + 1, rgba(255, 210, 120), 0.9 * fade, { soft: 10 });
  shock(f, C, C, 4 + 50 * ramp(p, 0.1, 0.8), 2.5, rgba(255, 255, 240), 0.7 * fade);
  shards(f, shardList, C, C, 20 + 60 * expand, rgba(255, 190, 90), rgba(255, 245, 210), fade * (1 - expand * 0.5), { spinAmount: 1.6 * expand, sizeScale: 1 - 0.3 * expand });
  motes(
    f,
    chunks.map((c) => ({
      x: C + Math.cos(c.angle) * (10 + 76 * expand * c.speed),
      y: C + Math.sin(c.angle) * (10 + 76 * expand * c.speed) + 12 * expand * expand,
      size: c.size * (1 - expand * 0.5),
      alpha: 0.95 * (1 - expand) * fade,
    })),
    rgba(255, 245, 220)
  );
  glow(f, C, C, 90, rgba(255, 200, 100, 0.3 * hit), { falloff: 2.2 });
}

export function sonicWave(f, p, rng) {
  const noise = makeAngularNoise(rng, 4);
  const fade = decay(p, 0.55, 0.06);
  // 왼쪽 발원지에서 오른쪽으로 퍼지는 음파 호(부분 링) — 넓게 퍼지며 흐려진다
  const originX = C - 70;
  for (let i = 0; i < 5; i += 1) {
    const t = ramp(p, i * 0.12, i * 0.12 + 0.6);
    if (t <= 0) continue;
    const r = 12 + 150 * t;
    const alpha = fade * (1 - t) * 0.9;
    const pts = [];
    for (let k = 0; k <= 30; k += 1) {
      const a = -0.55 + (k / 30) * 1.1;
      const wobble = 1 + 0.03 * noise(a * 6 + p * 10 + i);
      pts.push([originX + Math.cos(a) * r * wobble, C + Math.sin(a) * r * wobble]);
    }
    stroke(f, pts, 4.5 * (1 - t * 0.5) + 1, rgba(150, 230, 255, alpha * 0.8), { add: true, soft: 6 });
    stroke(f, pts, 1.6, rgba(240, 252, 255, alpha), { add: true });
  }
  // 발원 코어 + 진동선
  const hum = 0.6 + 0.4 * Math.sin(p * TAU * 3) ** 2;
  core(f, originX + 6, C, 6 + 4 * hum, SONIC, fade * pulse(p, 0, 0.2, 0.9));
  for (let i = -2; i <= 2; i += 1) {
    if (i === 0) continue;
    const y = C + i * 9;
    const len = 10 + 6 * hum;
    stroke(f, [[originX - 14, y], [originX - 14 + len, y]], 1.2, rgba(200, 245, 255, 0.5 * fade * pulse(p, 0, 0.3, 0.9)), { add: true });
  }
  glow(f, C, C, 80, rgba(150, 230, 255, 0.14 * fade * pulse(p, 0, 0.5, 1)), { falloff: 2.4 });
}

export function drainOrbs(f, p, rng) {
  const orbs = particles(rng, 9, (next, i) => ({ angle: (i / 9) * TAU + next() * 0.5, dist: 50 + next() * 40, size: 4 + next() * 4, delay: next() * 0.25 }));
  const noise = makeAngularNoise(rng, 3);
  const fade = decay(p, 0.7, 0.1);
  const gather = ramp(p, 0, 0.55);
  // 어둠의 소용돌이 중심
  disc(f, C, C, 10 + 6 * gather, rgba(30, 10, 50, 0.9 * fade), { soft: 4 });
  ring(f, C, C, 12 + 6 * gather, 2.4, rgba(190, 120, 255, 0.9 * fade), { add: true, soft: 2 });
  for (let i = 0; i < 3; i += 1) {
    const pts = spiralPath(C, C, 14, 40 + 30 * gather, 0.6, 16, (i / 3) * TAU - p * 5);
    stroke(f, pts, [3, 0.5], rgba(120, 60, 200, 0.7 * fade), { add: true, soft: 2 });
  }
  // 구슬: 대상 주변에서 중심으로 모인 뒤 시전자(좌상단) 쪽으로 날아간다
  for (const orb of orbs) {
    const t = ramp(p, orb.delay, orb.delay + 0.5);
    const away = ramp(p, 0.55 + orb.delay * 0.4, 1);
    if (t <= 0) continue;
    const d = orb.dist * (1 - t);
    let x = C + Math.cos(orb.angle + t * 2) * d;
    let y = C + Math.sin(orb.angle + t * 2) * d * 0.8;
    if (away > 0) {
      x = C - 120 * away;
      y = C - 90 * away + Math.sin(away * 6 + orb.angle) * 8;
    }
    const alpha = fade * (away > 0 ? 1 - away * 0.7 : 0.4 + 0.6 * t);
    // 꼬리
    if (away > 0) {
      stroke(f, [[x + 26 * away, y + 20 * away], [x, y]], [0.5, orb.size * 0.6], rgba(170, 100, 240, 0.5 * alpha), { add: true, soft: 2 });
    }
    disc(f, x, y, orb.size, rgba(40, 10, 70, 0.9 * alpha), { soft: 1.5 });
    glow(f, x, y, orb.size * 1.6, rgba(180, 110, 255, 0.9 * alpha), { falloff: 1.5 });
    glow(f, x - orb.size * 0.3, y - orb.size * 0.3, orb.size * 0.45, rgba(255, 240, 255, 0.9 * alpha));
  }
  clouds(
    f,
    [0, 1].map((k) => ({ x: C + (k ? 20 : -18), y: C + 10, r: 22 + 10 * gather, alpha: 0.3 * fade, phase: k * 2 + p * 2 })),
    rgba(60, 20, 100),
    rng,
    { noise, amplitude: 0.35, softness: 0.7 }
  );
}

export function reviveRise(f, p, rng) {
  // feet 앵커. 발치에서 빛기둥이 솟고 깃털·빛알갱이가 떠오른다.
  const feathers = particles(rng, 10, (next) => ({ x: (next() - 0.5) * 80, delay: next() * 0.4, speed: 0.6 + next() * 0.4, size: 6 + next() * 4, sway: next() * TAU }));
  const glints = particles(rng, 14, (next) => ({ x: (next() - 0.5) * 100, y0: next(), speed: 0.5 + next() * 0.6, size: 2 + next() * 2.5, rotate: next() * 1.5 }));
  const noise = makeAngularNoise(rng, 3);
  const rise = ramp(p, 0, 0.5);
  const fade = decay(p, 0.65, 0.1);
  const baseY = C + 6;
  // 발 앵커(C+6)에서 88 → 꼭대기 y≈14. 150 이면 기둥이 프레임 위를 뚫고 잘렸다.
  const height = 88 * Math.sin(rise * Math.PI / 2);
  if (rise > 0) {
    column(f, C, baseY, height, 34, rgba(255, 230, 170, 0.32 * fade), 1, { noise, phase: p * 2, soft: 16, taper: 0.1 });
    column(f, C, baseY, height * 0.95, 14, rgba(255, 248, 225, 0.75 * fade), 1, { noise, phase: p * 2 + 1, soft: 7, taper: 0.15 });
  }
  ellipseRing(f, C, baseY, 40 * rise + 6, 12 * rise + 2, 3.5, rgba(255, 220, 140, 0.9 * fade), { add: true, soft: 4 });
  ellipseRing(f, C, baseY, 24 * rise + 4, 7 * rise + 1.5, 2, rgba(255, 255, 240, 0.85 * fade), { add: true });
  core(f, C, baseY - 4, 8 + 6 * pulse(p, 0.1, 0.4, 0.9), REVIVE, 0.8 * fade);
  // 깃털: 좌우로 흔들리며 떠오르는 렌즈
  for (const feather of feathers) {
    const t = ramp(p, feather.delay, feather.delay + 0.7);
    if (t <= 0) continue;
    const x = C + feather.x + Math.sin(t * 5 + feather.sway) * 10;
    const y = baseY - 10 - 76 * t * feather.speed;
    const alpha = fade * Math.sin(Math.min(1, t) * Math.PI) ** 0.6;
    const angle = -Math.PI / 2 + Math.sin(t * 5 + feather.sway) * 0.5;
    streak(f, x, y, angle, feather.size * 2.2, feather.size * 0.5, rgba(255, 255, 255, 0.95 * alpha), { curve: feather.size * 0.3, soft: 1 });
    stroke(f, [[x - Math.cos(angle) * feather.size, y - Math.sin(angle) * feather.size], [x + Math.cos(angle) * feather.size, y + Math.sin(angle) * feather.size]], 0.7, rgba(255, 220, 160, alpha * 0.8));
  }
  sparkles(
    f,
    glints.map((g) => ({
      x: C + g.x,
      y: baseY - (10 + 110 * g.y0) * ramp(p, 0.1, 1) * g.speed,
      size: g.size,
      alpha: 0.9 * fade * Math.sin(Math.min(1, ramp(p, 0.1, 1) * g.speed) * Math.PI),
      rotate: g.rotate,
    })),
    rgba(255, 250, 220),
    { thickness: 0.9 }
  );
  glow(f, C, baseY - height / 2, 80, rgba(255, 230, 160, 0.16 * fade * rise), { falloff: 2.4 });
}

export function cleanseSparkle(f, p, rng) {
  const stars = particles(rng, 22, (next) => ({ angle: next() * TAU, dist: 0.2 + next() * 0.8, size: 2.5 + next() * 4, rotate: next() * 1.5, delay: next() * 0.35, speed: 0.6 + next() * 0.6 }));
  const fade = decay(p, 0.6, 0.06);
  const burst = ramp(p, 0, 0.7);
  core(f, C, C, 8 + 10 * pulse(p, 0, 0.25, 0.7), CLEANSE, fade);
  // 나선 빛줄기 두 가닥
  for (let i = 0; i < 2; i += 1) {
    const pts = spiralPath(C, C, 6, 30 + 60 * burst, 1.1, 28, i * Math.PI + p * 4);
    stroke(f, pts, [3, 0.4], rgba(190, 250, 255, 0.75 * fade), { add: true, soft: 3 });
    stroke(f, pts, [1.2, 0.2], rgba(255, 255, 255, 0.9 * fade), { add: true });
  }
  shock(f, C, C, 10 + 76 * ramp(p, 0.05, 0.9), 3.5, CLEANSE, 0.8 * fade * (1 - ramp(p, 0.05, 0.9) * 0.6), { soft: 8 });
  sparkles(
    f,
    stars.map((s) => {
      const t = ramp(p, s.delay, s.delay + 0.6);
      return {
        x: C + Math.cos(s.angle) * s.dist * 90 * t,
        y: C + Math.sin(s.angle) * s.dist * 90 * t - 14 * t,
        size: s.size * (0.6 + 0.4 * Math.sin(p * 12 + s.angle) ** 2),
        alpha: 0.95 * fade * Math.sin(t * Math.PI),
        rotate: s.rotate + p,
      };
    }),
    rgba(240, 255, 255),
    { thickness: 0.9 }
  );
  glow(f, C, C, 80, rgba(190, 250, 255, 0.18 * fade * pulse(p, 0, 0.35, 1)), { falloff: 2.4 });
}

export function paralysisBind(f, p, rng) {
  // 번개 고리 세 개가 몸을 감고(타원 궤도의 지그재그), 불규칙하게 깜빡인다.
  const arcs = particles(rng, 3, (next, i) => ({ y: C - 30 + i * 30, phase: next() * TAU, rx: 40 + next() * 12, ry: 12 + next() * 5 }));
  const sparks = particles(rng, 12, (next) => ({ angle: next() * TAU, dist: 0.5 + next() * 0.6, size: 1.6 + next() * 1.6, delay: next() }));
  const fade = decay(p, 0.7, 0.15);
  const flicker = 0.55 + 0.45 * Math.abs(Math.sin(p * 37 + 1) * Math.cos(p * 23));
  for (const [i, band] of arcs.entries()) {
    const t = ramp(p, i * 0.08, i * 0.08 + 0.3);
    if (t <= 0) continue;
    const pts = [];
    const steps = 22;
    for (let k = 0; k <= steps; k += 1) {
      const a = band.phase + (k / steps) * TAU * t + p * 3;
      const jitter = (k % 2 === 0 ? 1 : -1) * (2.5 + 2 * Math.sin(k * 3 + p * 20));
      pts.push([C + Math.cos(a) * (band.rx + jitter), band.y + Math.sin(a) * (band.ry + jitter * 0.4)]);
    }
    bolt(f, pts, 1.6, PARALYSIS, fade * flicker * (0.6 + 0.4 * t));
  }
  // 튀는 스파크
  motes(
    f,
    sparks.map((s) => {
      const k = (p * 3 + s.delay) % 1;
      return {
        x: C + Math.cos(s.angle + k * 2) * s.dist * 52,
        y: C + Math.sin(s.angle + k * 2) * s.dist * 40,
        size: s.size,
        alpha: 0.9 * fade * (k < 0.35 ? 1 : 0),
      };
    }),
    rgba(255, 250, 200)
  );
  const zap = pulse(p, 0.3, 0.42, 0.7) + pulse(p, 0.6, 0.66, 0.8);
  if (zap > 0) core(f, C, C, 8 + 8 * Math.min(1, zap), PARALYSIS, Math.min(1, zap) * 0.8);
  glow(f, C, C, 70, rgba(255, 230, 90, 0.16 * fade * flicker), { falloff: 2.4 });
}

export function blindVeil(f, p, rng) {
  // head 앵커. 어둠의 장막이 머리로 모여들어 시야를 덮는다.
  const puffs = particles(rng, 8, (next, i) => ({ angle: (i / 8) * TAU + next() * 0.4, dist: 60 + next() * 30, r: 16 + next() * 10, phase: next() * TAU }));
  const wisps = particles(rng, 6, (next) => ({ angle: next() * TAU, len: 20 + next() * 20, phase: next() * TAU }));
  const noise = makeAngularNoise(rng, 4);
  const gather = ramp(p, 0, 0.55);
  const fade = decay(p, 0.65, 0.1);
  const cy = C - 6;
  clouds(
    f,
    puffs.map((puff) => ({
      x: C + Math.cos(puff.angle + p) * puff.dist * (1 - gather * 0.75),
      y: cy + Math.sin(puff.angle + p) * puff.dist * 0.6 * (1 - gather * 0.75),
      r: puff.r * (0.6 + 0.6 * gather),
      alpha: 0.85 * fade,
      phase: puff.phase + p * 2,
    })),
    rgba(40, 18, 64),
    rng,
    { noise, amplitude: 0.35, softness: 0.6 }
  );
  clouds(
    f,
    puffs.slice(0, 4).map((puff) => ({
      x: C + Math.cos(puff.angle + 2 + p) * puff.dist * 0.5 * (1 - gather * 0.7),
      y: cy + Math.sin(puff.angle + 2 + p) * puff.dist * 0.3 * (1 - gather * 0.7),
      r: puff.r * 0.7 * (0.6 + 0.6 * gather),
      alpha: 0.6 * fade,
      phase: puff.phase + 1 + p * 2,
    })),
    rgba(110, 60, 150),
    rng,
    { noise, amplitude: 0.3, softness: 0.65 }
  );
  // 어둠의 실오라기가 중심으로 감긴다
  for (const wisp of wisps) {
    const pts = spiralPath(C, cy, 4 + 20 * (1 - gather), 30 + wisp.len * (1 - gather * 0.5), 0.35, 10, wisp.angle - p * 4);
    stroke(f, pts, [2.6, 0.3], rgba(150, 90, 200, 0.6 * fade), { add: true, soft: 2 });
  }
  // 가운데 눈을 덮는 어두운 코어(장막이 닫힌 뒤 진해진다)
  disc(f, C, cy, 14 + 22 * gather, rgba(20, 8, 36, 0.85 * fade * gather), { soft: 12 });
  glow(f, C, cy, 60, rgba(80, 30, 120, 0.2 * fade), { falloff: 2.4 });
}

export function confusionSpiral(f, p, rng) {
  // head 앵커. 별들이 머리 위 타원 궤도를 빙글빙글 돈다.
  const starsList = particles(rng, 6, (next, i) => ({ phase: (i / 6) * TAU, size: 6 + next() * 3, wobble: next() * TAU }));
  const fade = decay(p, 0.7, 0.15);
  const appear = ramp(p, 0, 0.25);
  const cy = C - 26;
  const rx = 44 * appear;
  const ry = 12 * appear;
  // 궤도 자취(희미한 나선 리본)
  const pts = spiralPath(C, cy, rx * 0.9, rx, 1, 40, -p * TAU * 1.5, ry / Math.max(1, rx));
  stroke(f, pts, 1.6, rgba(255, 220, 110, 0.35 * fade), { add: true, soft: 2 });
  // 별 — 5각 별 폴리곤(십자 반짝임보다 만화적)
  for (const star of starsList) {
    const a = star.phase - p * TAU * 1.5;
    const x = C + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry + Math.sin(p * 8 + star.wobble) * 2;
    const depth = 0.7 + 0.3 * (Math.sin(a) + 1) / 2;
    const s = star.size * depth * appear;
    if (s <= 0.5) continue;
    const verts = [];
    for (let k = 0; k < 10; k += 1) {
      const r = k % 2 === 0 ? s : s * 0.45;
      const ang = -Math.PI / 2 + (k / 10) * TAU + p * 6;
      verts.push([x + Math.cos(ang) * r, y + Math.sin(ang) * r]);
    }
    const alpha = fade * depth;
    // 외곽선 → 채움 → 하이라이트
    for (let k = 0; k < 10; k += 1) stroke(f, [verts[k], verts[(k + 1) % 10]], 1.1, rgba(150, 90, 20, alpha));
    polygon(f, verts, rgba(255, 220, 110, alpha));
    glow(f, x - s * 0.2, y - s * 0.25, s * 0.35, rgba(255, 255, 230, 0.8 * alpha));
  }
  // 어지러운 물음표 대신 노란 잔광
  glow(f, C, cy, 50, rgba(255, 220, 110, 0.14 * fade * appear), { falloff: 2.4 });
}

export function silenceLock(f, p, rng) {
  // 말풍선에 X 가 그어지고 자물쇠 고리가 잠긴다.
  const motesList = particles(rng, 10, (next) => ({ angle: next() * TAU, dist: 0.4 + next() * 0.6, size: 1.8 + next() * 2, phase: next() }));
  const appear = ramp(p, 0, 0.3);
  const cross = ramp(p, 0.3, 0.55);
  const lock = ramp(p, 0.5, 0.75);
  const fade = decay(p, 0.75, 0.15);
  const cy = C - 30;
  // 말풍선(타원 + 꼬리)
  const rx = 40 * appear;
  const ry = 26 * appear;
  if (appear > 0) {
    const pts = [];
    for (let k = 0; k <= 40; k += 1) {
      const a = (k / 40) * TAU;
      pts.push([C + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    stroke(f, pts, 3, rgba(200, 170, 230, 0.9 * fade), { soft: 1 });
    stroke(f, [[C - 12, cy + ry - 4], [C - 22, cy + ry + 16], [C - 2, cy + ry - 2]], 2.6, rgba(200, 170, 230, 0.9 * fade), { soft: 1 });
    disc(f, C, cy, Math.max(0, rx - 4), rgba(60, 40, 90, 0.5 * fade), { soft: 3 });
    // 점점점(말하려던 말)
    for (let k = -1; k <= 1; k += 1) disc(f, C + k * 12, cy, 3 * appear * (1 - cross), rgba(230, 220, 245, 0.9 * fade));
  }
  // 붉은 X
  if (cross > 0) {
    const s = 24 * cross;
    for (const sign of [1, -1]) {
      stroke(f, [[C - s, cy - s * sign], [C + s, cy + s * sign]], 5, rgba(220, 60, 70, 0.95 * fade), { soft: 1.5 });
      stroke(f, [[C - s, cy - s * sign], [C + s, cy + s * sign]], 2, rgba(255, 170, 170, 0.9 * fade), { add: true });
    }
  }
  // 자물쇠 고리가 아래에서 올라와 잠긴다
  if (lock > 0) {
    const ly = C + 36 - 20 * lock;
    const pts = [];
    for (let k = 0; k <= 20; k += 1) {
      const a = Math.PI + (k / 20) * Math.PI;
      pts.push([C + Math.cos(a) * 12, ly - 8 + Math.sin(a) * 12]);
    }
    stroke(f, pts, 3.4, rgba(230, 210, 120, 0.95 * fade * lock), { soft: 1 });
    polygon(f, [[C - 16, ly - 8], [C + 16, ly - 8], [C + 16, ly + 14], [C - 16, ly + 14]], rgba(230, 210, 120, 0.95 * fade * lock));
    disc(f, C, ly + 2, 3, rgba(90, 70, 30, 0.9 * fade * lock));
    core(f, C, ly, 6, rgba(255, 240, 200), pulse(p, 0.7, 0.78, 0.95) * 0.8);
  }
  motes(
    f,
    motesList.map((m) => ({
      x: C + Math.cos(m.angle + p * 2) * m.dist * 60,
      y: cy + Math.sin(m.angle + p * 2) * m.dist * 40,
      size: m.size,
      alpha: 0.7 * fade * appear * (0.4 + 0.6 * Math.sin((p * 3 + m.phase) * TAU) ** 2),
    })),
    SILENCE
  );
}

export function summonPortal(f, p, rng) {
  // screen 앵커, 셀 zoom 200. 차원문이 열리며(세로로 벌어지며) 빛과 입자를 뿜는다.
  const emitted = particles(rng, 18, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 2 + next() * 3, delay: next() * 0.4 }));
  const open = ramp(p, 0, 0.45);
  const fade = decay(p, 0.7, 0.15);
  // 문틀 바깥 룬 눈금(+16)까지 프레임 안(반지름 88 미만)에 든다.
  const rx = 22 + 52 * open;
  const ry = 6 + 66 * Math.sin(open * Math.PI / 2);
  // 문 안쪽: 어두운 심연 + 소용돌이
  if (open > 0) {
    ellipse(f, C, C, rx, ry, rgba(20, 8, 50, 0.92 * fade), { soft: 6 });
    for (let i = 0; i < 4; i += 1) {
      const sp = spiralPath(C, C, 4, Math.min(rx, ry) * 0.9, 1.4, 30, (i / 4) * TAU + p * 6, ry / rx);
      stroke(f, sp, [2.6, 0.4], rgba(120, 90, 255, 0.7 * fade), { add: true, soft: 3 });
    }
    core(f, C, C, 6 + 8 * open, rgba(200, 190, 255), 0.6 * fade);
  }
  // 문틀: 밝은 타원 링 2겹 + 룬
  ellipseRing(f, C, C, rx + 2, ry + 2, 4, PORTAL, { add: true, soft: 4 });
  ellipseRing(f, C, C, rx + 6, ry + 6, 1.6, rgba(220, 210, 255, 0.85 * fade), { add: true });
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * TAU + p * 2;
    const x0 = C + Math.cos(a) * (rx + 8);
    const y0 = C + Math.sin(a) * (ry + 8);
    const x1 = C + Math.cos(a) * (rx + 16);
    const y1 = C + Math.sin(a) * (ry + 16);
    stroke(f, [[x0, y0], [x1, y1]], 1.4, rgba(200, 190, 255, 0.8 * fade * open), { add: true });
  }
  // 방사 빛줄기(열리는 순간 강함)
  const flare = pulse(p, 0.3, 0.45, 0.8);
  if (flare > 0) rays(f, C, C, 10, Math.min(rx, ry) * 0.9, Math.min(88, Math.max(rx, ry) + 30 * flare), 3, rgba(200, 190, 255), flare * 0.8, { rotate: p * 2, lengths: [1, 0.6, 0.8, 0.5] });
  // 뿜어지는 입자
  motes(
    f,
    emitted.map((e) => {
      const t = ramp(p, 0.35 + e.delay * 0.5, 1);
      return {
        x: C + Math.cos(e.angle) * (rx * 0.5 + 34 * t * e.speed),
        y: C + Math.sin(e.angle) * (ry * 0.5 + 34 * t * e.speed),
        size: e.size,
        alpha: 0.9 * fade * (t > 0 ? 1 - t : 0),
      };
    }),
    rgba(200, 190, 255)
  );
  glow(f, C, C, 90, rgba(120, 90, 255, 0.2 * fade * open), { falloff: 2.4 });
}

export function smokeVanish(f, p, rng) {
  const puffs = particles(rng, 9, (next, i) => ({ angle: (i / 9) * TAU + next() * 0.5, speed: 0.6 + next() * 0.8, r: 12 + next() * 10, phase: next() * TAU }));
  const noise = makeAngularNoise(rng, 4);
  const spread = ramp(p, 0, 0.7);
  const fade = decay(p, 0.4, 0);
  const pop = pulse(p, 0, 0.12, 0.4);
  if (pop > 0) {
    core(f, C, C, 10 + 10 * pop, rgba(240, 240, 250), pop * 0.8);
    shock(f, C, C, 6 + 50 * ramp(p, 0, 0.4), 3, rgba(230, 230, 240), 0.7 * (1 - ramp(p, 0, 0.5)), { soft: 6 });
  }
  clouds(
    f,
    // 퍼짐 반경 + 덩이 반지름(노이즈 35% 포함)이 96 을 넘지 않게 — 넘으면 연기가 프레임 가장자리에서 직선으로 잘린다.
    puffs.map((puff) => ({
      x: C + Math.cos(puff.angle) * (8 + 26 * spread * puff.speed),
      y: C + Math.sin(puff.angle) * (8 + 20 * spread * puff.speed) - 12 * spread,
      r: puff.r * (0.5 + 0.9 * spread),
      alpha: 0.75 * fade,
      phase: puff.phase + p * 3,
    })),
    rgba(200, 200, 212),
    rng,
    { noise, amplitude: 0.35, softness: 0.55 }
  );
  clouds(
    f,
    puffs.slice(0, 5).map((puff) => ({
      x: C + Math.cos(puff.angle + 1.2) * (6 + 22 * spread * puff.speed),
      y: C + Math.sin(puff.angle + 1.2) * (6 + 18 * spread * puff.speed) - 10 * spread,
      r: puff.r * 0.6 * (0.5 + 0.9 * spread),
      alpha: 0.7 * fade,
      phase: puff.phase + 2 + p * 3,
    })),
    rgba(240, 240, 248),
    rng,
    { noise, amplitude: 0.3, softness: 0.55 }
  );
}

export function meteorFall(f, p, rng) {
  // screen 앵커, 셀 zoom 200. 운석 셋이 우상단에서 좌하단으로 떨어져 터진다.
  const meteors = particles(rng, 3, (next, i) => ({
    delay: i * 0.16 + (i === 0 ? 0 : next() * 0.05),
    x1: C - 40 + i * 40 + (next() - 0.5) * 20,
    y1: C + 20 + (next() - 0.5) * 30,
    size: 8 + next() * 5,
  }));
  const debris = particles(rng, 18, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 2 + next() * 3, which: Math.floor(next() * 3) }));
  const noise = makeAngularNoise(rng, 3);
  const fade = decay(p, 0.8, 0.1);
  for (const [i, m] of meteors.entries()) {
    const fall = ramp(p, m.delay, m.delay + 0.3);
    const boom = pulse(p, m.delay + 0.28, m.delay + 0.38, m.delay + 0.75);
    const after = ramp(p, m.delay + 0.3, 1);
    if (fall > 0 && fall < 1) {
      // 출발점은 프레임 위 가장자리 바로 안 — 첫 컷부터 운석 머리가 보인다.
      const x0 = m.x1 + 70;
      const y0 = m.y1 - 118;
      const x = x0 + (m.x1 - x0) * fall;
      const y = y0 + (m.y1 - y0) * fall;
      const tail = 40 + 30 * fall;
      const dx = (x0 - m.x1) / Math.hypot(x0 - m.x1, y0 - m.y1);
      const dy = (y0 - m.y1) / Math.hypot(x0 - m.x1, y0 - m.y1);
      stroke(f, [[x + dx * tail, y + dy * tail], [x, y]], [0.5, m.size * 0.9], rgba(255, 140, 60, 0.6), { add: true, soft: 5 });
      stroke(f, [[x + dx * tail * 0.7, y + dy * tail * 0.7], [x, y]], [0.3, m.size * 0.45], rgba(255, 230, 170, 0.9), { add: true, soft: 2 });
      disc(f, x, y, m.size, rgba(90, 50, 40, 1), { soft: 1 });
      glow(f, x, y, m.size * 1.6, rgba(255, 150, 70, 0.9), { falloff: 1.4 });
      glow(f, x - m.size * 0.3, y - m.size * 0.3, m.size * 0.5, rgba(255, 240, 210, 0.9));
    }
    if (boom > 0) {
      core(f, m.x1, m.y1, 10 + 16 * boom, METEOR, boom);
      rays(f, m.x1, m.y1, 8, 8, 24 + 30 * boom, 3, rgba(255, 200, 120), boom * 0.9, { rotate: i, lengths: [1, 0.55, 0.8] });
    }
    if (after > 0) {
      ellipseRing(f, m.x1, m.y1 + 4, 8 + 56 * after, 3 + 18 * after, 3 * (1 - after * 0.6) + 0.6, rgba(255, 190, 110, 0.85 * (1 - after) * fade), { add: true, soft: 5 });
      clouds(
        f,
        [-1, 1].map((k) => ({ x: m.x1 + k * 16 * (1 + after), y: m.y1 - 6 - 20 * after, r: 10 + 22 * after, alpha: 0.5 * (1 - after) * fade, phase: k + i * 2 + p })),
        rgba(120, 90, 80),
        rng,
        { noise, amplitude: 0.35, softness: 0.6 }
      );
      motes(
        f,
        debris.filter((d) => d.which === i).map((d) => ({
          x: m.x1 + Math.cos(d.angle) * (8 + 60 * after * d.speed),
          y: m.y1 + Math.sin(d.angle) * (8 + 40 * after * d.speed) - 30 * after + 60 * after * after,
          size: d.size * (1 - after * 0.5),
          alpha: 0.9 * (1 - after) * fade,
        })),
        rgba(255, 210, 150)
      );
    }
  }
  glow(f, C, C, 96, rgba(255, 130, 60, 0.14 * fade * pulse(p, 0.2, 0.6, 1)), { falloff: 2.4 });
}
