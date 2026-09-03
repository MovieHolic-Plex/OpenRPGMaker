// 몬스터 배틀·야수·버프 계열. painter(f, p, rng) 규약은 impact.mjs 와 같다.
import {
  CENTER as C,
  decay,
  disc,
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
  wobbleRing,
} from "../raster.mjs";
import { clouds, column, core, motes, rays, shock, sigil, sparkles, spiralPath } from "../recipes.mjs";

const IMPACT = rgba(255, 236, 190);
const CLAW = rgba(255, 244, 210);
const ENERGY = rgba(120, 200, 255);
const LEAF = rgba(120, 210, 90);
const PSY = rgba(240, 130, 220);
const HOLY = rgba(255, 240, 180);
const SLEEP = rgba(190, 170, 255);
const GUARD = rgba(110, 190, 255);
const SEAL = rgba(255, 200, 90);

export function tackleImpact(f, p, rng) {
  const chunks = particles(rng, 10, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 2 + next() * 3 }));
  const noise = makeAngularNoise(rng, 3);
  const hit = pulse(p, 0, 0.18, 0.7);
  const fade = decay(p, 0.45, 0.08);
  // 돌진 잔상: 왼콽에서 들어오는 속도선
  const rush = 1 - ramp(p, 0, 0.35);
  if (rush > 0) {
    for (let i = -2; i <= 2; i += 1) {
      const y = C + i * 14;
      const len = 40 + 30 * rush;
      stroke(f, [[C - 90 - 20 * (1 - rush), y], [C - 90 - 20 * (1 - rush) + len, y]], 2.2 - Math.abs(i) * 0.4, rgba(255, 255, 255, 0.55 * rush), { add: true, soft: 1.5 });
    }
  }
  if (hit > 0) {
    core(f, C, C, 10 + 10 * hit, IMPACT, hit);
    rays(f, C, C, 7, 8, 30 + 34 * hit, 4, IMPACT, hit, { rotate: 0.2, lengths: [1, 0.55, 0.85, 0.6, 0.9] });
    shock(f, C, C, 6 + 48 * ramp(p, 0.05, 0.6), 4, rgba(255, 230, 180), 0.8 * fade, { soft: 8 });
  }
  // 먼지 구름
  const dust = pulse(p, 0.05, 0.45, 1);
  clouds(
    f,
    [-1, 1].map((k) => ({ x: C + k * 26, y: C + 26 - 8 * dust, r: 12 + 18 * dust, alpha: 0.45 * dust * fade, phase: k * 2 + p })),
    rgba(220, 205, 180),
    rng,
    { noise, amplitude: 0.35, softness: 0.6 }
  );
  if (p > 0.15) {
    const t = ramp(p, 0.15, 1);
    motes(
      f,
      chunks.map((c) => ({
        x: C + Math.cos(c.angle) * (10 + 60 * t * c.speed),
        y: C + Math.sin(c.angle) * (10 + 50 * t * c.speed) + 30 * t * t,
        size: c.size * (1 - t * 0.5),
        alpha: 0.85 * (1 - t) * fade,
      })),
      rgba(255, 240, 200)
    );
  }
}

export function clawRake(f, p, rng) {
  const sparks = particles(rng, 10, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.8, size: 1.4 + next() * 1.4 }));
  const fade = decay(p, 0.6, 0.1);
  // 세 줄기 발톱 자국이 위→아래로 순서대로 그어진다(좌상→우하).
  for (let i = 0; i < 3; i += 1) {
    const t = ramp(p, i * 0.07, i * 0.07 + 0.32);
    if (t <= 0) continue;
    const offset = (i - 1) * 22;
    const length = 30 + 96 * t;
    const cx = C + offset * 0.7;
    const cy = C - 6 + offset;
    const angle = -0.75;
    const thickness = 6.5 - i * 0.5;
    streak(f, cx, cy, angle, length, thickness, rgba(150, 40, 40, 0.8 * fade), { soft: thickness * 0.6, curve: 4 });
    streak(f, cx, cy, angle, length * 0.94, thickness * 0.6, rgba(255, 190, 150, 0.9 * fade), { soft: 1.5, curve: 4 });
    streak(f, cx, cy, angle, length * 0.85, thickness * 0.22, CLAW, { add: true, curve: 4 });
  }
  const flash = pulse(p, 0.2, 0.36, 0.7);
  if (flash > 0) core(f, C + 8, C, 8 + 6 * flash, CLAW, flash * 0.9);
  if (p > 0.3) {
    const t = ramp(p, 0.3, 1);
    motes(
      f,
      sparks.map((s) => ({
        x: C + 8 + Math.cos(s.angle) * (6 + 54 * t * s.speed),
        y: C + Math.sin(s.angle) * (6 + 54 * t * s.speed) + 14 * t * t,
        size: s.size * (1 - t * 0.6),
        alpha: 0.9 * (1 - t) * fade,
      })),
      rgba(255, 250, 235)
    );
  }
}

export function biteCrunch(f, p, rng) {
  const bits = particles(rng, 8, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.8, size: 1.6 + next() * 1.6 }));
  const close = ramp(p, 0, 0.36);
  const fade = decay(p, 0.55, 0.08);
  const gap = 58 * (1 - close) + 6;
  // 위·아래 턱: 이빨 삼각형 5개씩이 호를 따라 늘어선다.
  const jaw = (dir) => {
    const y = C - dir * gap;
    const toothColor = rgba(255, 250, 235, fade);
    const gumColor = rgba(120, 30, 40, fade * 0.9);
    const pts = [];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const x = C - 60 + 120 * t;
      pts.push([x, y - dir * (10 * Math.sin(t * Math.PI))]);
    }
    stroke(f, pts, 6, gumColor, { soft: 3 });
    for (let i = 0; i < 5; i += 1) {
      const t = (i + 0.5) / 5;
      const x = C - 56 + 112 * t;
      const baseY = y - dir * (10 * Math.sin(t * Math.PI));
      const h = 14 + 6 * Math.sin(t * Math.PI);
      polygon(f, [[x - 7, baseY], [x + 7, baseY], [x, baseY + dir * h]], toothColor);
      polygon(f, [[x - 3, baseY], [x + 1, baseY], [x - 0.5, baseY + dir * h * 0.7]], rgba(200, 210, 230, fade * 0.7));
    }
  };
  jaw(1);
  jaw(-1);
  const crunch = pulse(p, 0.3, 0.42, 0.8);
  if (crunch > 0) {
    core(f, C, C, 8 + 8 * crunch, IMPACT, crunch * 0.9);
    rays(f, C, C, 6, 8, 26 + 26 * crunch, 3, IMPACT, crunch, { rotate: 0.5, lengths: [1, 0.6, 0.8] });
    shock(f, C, C, 8 + 40 * ramp(p, 0.34, 0.9), 3, rgba(255, 230, 180), 0.7 * fade, { soft: 6 });
  }
  if (p > 0.38) {
    const t = ramp(p, 0.38, 1);
    motes(
      f,
      bits.map((b) => ({
        x: C + Math.cos(b.angle) * (8 + 50 * t * b.speed),
        y: C + Math.sin(b.angle) * (8 + 40 * t * b.speed) + 20 * t * t,
        size: b.size,
        alpha: 0.9 * (1 - t) * fade,
      })),
      rgba(255, 245, 220)
    );
  }
}

export function projectileShot(f, p, rng) {
  const bits = particles(rng, 12, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 1.8 + next() * 2 }));
  const fly = ramp(p, 0, 0.5);
  const fade = decay(p, 0.62, 0.05);
  if (p < 0.55) {
    // 왼쪽 밖에서 중심으로 날아오는 에너지탄 + 꼬리
    const x = C - 120 + 120 * fly;
    const tail = 26 + 30 * fly;
    streak(f, x - tail / 2, C, 0, tail, 5, rgba(120, 200, 255, 0.55 * (1 - fly * 0.4)), { add: true, soft: 4 });
    streak(f, x - tail / 2.4, C, 0, tail * 0.8, 2.4, rgba(220, 240, 255, 0.85), { add: true, soft: 1.5 });
    core(f, x, C, 7 + 3 * fly, ENERGY, 1);
    // 회전하는 에너지 껍질
    ring(f, x, C, 9 + 2 * fly, 1.8, rgba(180, 230, 255, 0.9), { add: true });
  }
  const hit = pulse(p, 0.44, 0.56, 0.92);
  if (hit > 0) {
    core(f, C, C, 10 + 12 * hit, ENERGY, hit);
    rays(f, C, C, 8, 6, 24 + 30 * hit, 2.6, rgba(190, 235, 255), hit * 0.9, { rotate: p * 4, lengths: [1, 0.6, 0.85, 0.5] });
  }
  // 충격파·파편은 섬광이 꺼진 뒤에도 남아 마지막 컷이 비지 않는다.
  if (p > 0.46) {
    shock(f, C, C, 6 + 46 * ramp(p, 0.48, 1), 3.5, ENERGY, 0.8 * fade, { soft: 8 });
    motes(
      f,
      bits.map((b) => {
        const t = ramp(p, 0.5, 1);
        return {
          x: C + Math.cos(b.angle) * (6 + 54 * t * b.speed),
          y: C + Math.sin(b.angle) * (6 + 54 * t * b.speed),
          size: b.size * (1 - t * 0.5),
          alpha: 0.9 * (1 - t) * fade,
        };
      }),
      rgba(200, 240, 255)
    );
  }
}

export function leafVolley(f, p, rng) {
  const leaves = particles(rng, 12, (next, i) => ({
    delay: (i / 12) * 0.35 + (i === 0 ? 0 : next() * 0.05),
    y: (next() - 0.5) * 70,
    size: 8 + next() * 5,
    spin: next() * TAU,
    curve: (next() - 0.5) * 40,
  }));
  const fade = decay(p, 0.7, 0.1);
  for (const leaf of leaves) {
    const t = ramp(p, leaf.delay, leaf.delay + 0.45);
    if (t <= 0) continue;
    // 좌상단 밖 → 중심 근처로 포물선 비행, 도착하면 흩어진다
    const k = Math.min(1, t);
    const arrive = ramp(t, 0.75, 1);
    // 프레임 왼쪽 가장자리 안(x≈8)에서 출발해 첫 컷부터 잎이 보인다.
    const x = C - 88 + 93 * k + arrive * leaf.curve;
    const y = C - 60 + 60 * k + leaf.y * k + Math.sin(k * Math.PI) * -18 + arrive * 20;
    const angle = leaf.spin + t * 14;
    const alpha = fade * (1 - arrive * 0.8);
    streak(f, x, y, angle, leaf.size * 2, leaf.size * 0.6, rgba(50, 130, 60, alpha), { curve: leaf.size * 0.3 });
    streak(f, x, y, angle, leaf.size * 1.7, leaf.size * 0.36, rgba(120, 210, 90, alpha), { curve: leaf.size * 0.28 });
    stroke(f, [[x - Math.cos(angle) * leaf.size * 0.8, y - Math.sin(angle) * leaf.size * 0.8], [x + Math.cos(angle) * leaf.size * 0.8, y + Math.sin(angle) * leaf.size * 0.8]], 0.8, rgba(30, 90, 40, alpha * 0.8));
  }
  const hit = pulse(p, 0.42, 0.56, 0.95);
  if (hit > 0) {
    glow(f, C, C, 30 + 20 * hit, rgba(140, 230, 110, 0.5 * hit), { falloff: 1.8 });
    core(f, C, C, 6 + 6 * hit, rgba(200, 255, 170), hit * 0.8);
    shock(f, C, C, 8 + 44 * ramp(p, 0.45, 1), 3, LEAF, 0.7 * fade, { soft: 7 });
  }
}

export function psychicWave(f, p, rng) {
  const noise = makeAngularNoise(rng, 5);
  const fade = decay(p, 0.6, 0.08);
  const grow = ramp(p, 0, 0.85);
  // 중심 눈동자 광원
  core(f, C, C, 10 + 6 * Math.sin(p * TAU * 2) ** 2, PSY, fade);
  ring(f, C, C, 16, 3, rgba(255, 220, 250, 0.9 * fade), { add: true });
  // 일렁이는 파동 링 4겹 — 각도 노이즈로 가장자리가 흔들린다
  for (let i = 0; i < 4; i += 1) {
    const t = ramp(grow, i * 0.16, i * 0.16 + 0.7);
    if (t <= 0) continue;
    const r = 14 + 78 * t;
    const alpha = fade * (1 - t) * 0.9;
    const wobble = (a) => noise(a * 1.5 + p * 4 + i);
    wobbleRing(f, C, C, r, 6.4 * (1 - t * 0.5) + 1.6, rgba(240, 130, 220, alpha * 0.8), wobble, { amplitude: 0.08, add: true, soft: 5 });
    wobbleRing(f, C, C, r, 2.4, rgba(255, 235, 255, alpha), wobble, { amplitude: 0.08, add: true });
  }
  // 왜곡 줄기: 중심에서 나가는 굽은 선
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * TAU + p * 2;
    const pts = spiralPath(C, C, 18, 40 + 30 * grow, 0.12, 8, a);
    stroke(f, pts, 1.4, rgba(255, 190, 245, 0.55 * fade), { add: true, soft: 1.5 });
  }
  glow(f, C, C, 70, rgba(240, 130, 220, 0.18 * fade), { falloff: 2.4 });
}

export function shadowPulse(f, p, rng) {
  const tendrils = particles(rng, 7, (next, i) => ({ angle: (i / 7) * TAU + next() * 0.4, bend: (next() - 0.5) * 1.2, length: 40 + next() * 30 }));
  const noise = makeAngularNoise(rng, 4);
  const fade = decay(p, 0.6, 0.06);
  const grow = ramp(p, 0, 0.8);
  // 어둠의 구체(불투명 어두운 코어 + 보라 림)
  const r = 14 + 10 * ramp(p, 0, 0.3);
  disc(f, C, C, r, rgba(24, 10, 40, 0.95 * fade), { soft: 3 });
  ring(f, C, C, r, 3, rgba(170, 100, 240, 0.9 * fade), { add: true, soft: 2 });
  glow(f, C, C, r * 2.2, rgba(120, 50, 200, 0.5 * fade), { falloff: 2 });
  // 어두운 촉수 — 굽은 스트로크, 끝이 가늘다
  for (const tendril of tendrils) {
    const len = tendril.length * grow;
    if (len <= 2) continue;
    const pts = [];
    const radii = [];
    const steps = 8;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = tendril.angle + tendril.bend * t + Math.sin(p * 5 + t * 6) * 0.12;
      const d = r * 0.8 + len * t;
      pts.push([C + Math.cos(a) * d, C + Math.sin(a) * d]);
      radii.push(5 * (1 - t) + 0.8);
    }
    stroke(f, pts, radii, rgba(40, 14, 70, 0.9 * fade), { soft: 2 });
    stroke(f, pts, radii.map((v) => v * 0.4), rgba(150, 80, 230, 0.8 * fade), { add: true });
  }
  // 어둠 파동 링
  for (let i = 0; i < 3; i += 1) {
    const t = ramp(grow, i * 0.2, i * 0.2 + 0.7);
    if (t <= 0) continue;
    const rr = 20 + 70 * t;
    ring(f, C, C, rr, 6 * (1 - t) + 1, rgba(60, 20, 100, 0.7 * fade * (1 - t)), { soft: 8 });
    ring(f, C, C, rr, 1.4, rgba(190, 120, 255, 0.8 * fade * (1 - t)), { add: true });
  }
  clouds(
    f,
    [0, 1, 2].map((k) => ({ x: C + Math.cos(k * 2.1 + p * 2) * 30 * grow, y: C + Math.sin(k * 2.1 + p * 2) * 24 * grow, r: 16 + 10 * grow, alpha: 0.35 * fade, phase: k * 1.3 + p })),
    rgba(50, 20, 80),
    rng,
    { noise, amplitude: 0.35, softness: 0.7 }
  );
}

export function holyBeam(f, p, rng) {
  const motesList = particles(rng, 14, (next) => ({ x: (next() - 0.5) * 60, y0: next(), speed: 0.5 + next() * 0.8, size: 2 + next() * 2.5, rotate: next() * 1.5 }));
  const noise = makeAngularNoise(rng, 3);
  const descend = ramp(p, 0, 0.3);
  const hold = pulse(p, 0.2, 0.45, 0.85);
  const fade = decay(p, 0.6, 0.05);
  // 위에서 내려오는 빛기둥: 프레임 상단(-8)에서 중심 아래(C+40)까지
  const bottom = -8 + (C + 44 + 8) * descend;
  if (descend > 0) {
    column(f, C, bottom, bottom + 8, 30, rgba(255, 220, 140, 0.45 * fade), 1, { noise, phase: p * 2, soft: 14, taper: -0.05 });
    column(f, C, bottom, bottom + 8, 16, rgba(255, 245, 210, 0.85 * fade), 1, { noise, phase: p * 2 + 1, soft: 6, taper: -0.02 });
    column(f, C, bottom, bottom + 8, 6, rgba(255, 255, 255, 0.95 * fade), 1, { soft: 3, taper: 0 });
  }
  // 착지 원광(타원)과 코어
  if (hold > 0 || p > 0.28) {
    const k = ramp(p, 0.26, 0.5);
    ellipseRing(f, C, C + 40, 34 * k + 6, 10 * k + 2, 3, rgba(255, 236, 170, 0.85 * fade), { add: true, soft: 3 });
    ellipseRing(f, C, C + 40, 20 * k + 4, 6 * k + 1.5, 2, rgba(255, 255, 240, 0.8 * fade), { add: true });
    core(f, C, C + 8, 10 + 12 * hold, HOLY, Math.max(hold, 0.3 * fade));
    rays(f, C, C + 8, 8, 10, 30 + 30 * hold, 2.6, HOLY, hold * 0.9, { rotate: 0.2 + p, lengths: [1, 0.6, 0.85, 0.5] });
  }
  // 떠오르는 빛 알갱이
  const rise = ramp(p, 0.2, 1);
  sparkles(
    f,
    motesList.map((m) => ({
      x: C + m.x,
      y: C + 40 - (20 + 110 * m.y0) * rise * m.speed,
      size: m.size,
      alpha: 0.9 * fade * Math.sin(Math.min(1, rise * m.speed) * Math.PI),
      rotate: m.rotate,
    })),
    rgba(255, 250, 220),
    { thickness: 0.9 }
  );
  glow(f, C, C, 80, rgba(255, 230, 160, 0.16 * fade * (descend * 0.5 + hold * 0.5)), { falloff: 2.4 });
}

export function sleepDust(f, p, rng) {
  // head 앵커. 잠가루가 머리 위에서 흩날리고 Z 글자가 떠오른다.
  const dust = particles(rng, 16, (next) => ({ x: (next() - 0.5) * 100, y: (next() - 0.5) * 40, drift: next() * TAU, size: 3 + next() * 4, speed: 0.4 + next() * 0.6 }));
  const zs = particles(rng, 3, (next, i) => ({ delay: i * 0.18 + next() * 0.05, x: 10 + i * 14 + (next() - 0.5) * 8, size: 8 + i * 3 }));
  const fade = decay(p, 0.65, 0.08);
  const cy = C - 20;
  glow(f, C, cy + 10, 60, rgba(190, 170, 255, 0.16 * fade * pulse(p, 0, 0.4, 1)), { falloff: 2.6 });
  motes(
    f,
    dust.map((d) => ({
      x: C + d.x + Math.sin(p * 3 + d.drift) * 8,
      y: cy + d.y + 30 * ramp(p, 0, 1) * d.speed + Math.cos(p * 4 + d.drift) * 4,
      size: d.size * (0.7 + 0.3 * Math.sin(p * 8 + d.drift)),
      alpha: 0.75 * fade * Math.sin(Math.min(1, ramp(p, 0, 0.9) + 0.1) * Math.PI) ** 0.5,
    })),
    SLEEP,
    { falloff: 1.6 }
  );
  // Z 글자: 세 획 폴리라인, 위로 떠오르며 커진다
  for (const z of zs) {
    const t = ramp(p, z.delay, z.delay + 0.6);
    if (t <= 0) continue;
    const s = z.size * (0.7 + 0.5 * t);
    const x = C + z.x + Math.sin(t * 4) * 5;
    const y = cy - 10 - 50 * t;
    const alpha = fade * Math.sin(Math.min(1, t) * Math.PI) ** 0.6;
    const pts = [[x - s, y - s * 0.8], [x + s, y - s * 0.8], [x - s, y + s * 0.8], [x + s, y + s * 0.8]];
    stroke(f, pts, s * 0.24, rgba(90, 60, 170, alpha), { soft: 0.6 });
    stroke(f, pts, s * 0.12, rgba(235, 225, 255, alpha), { add: true });
  }
}

export function powerAura(f, p, rng) {
  const flames = particles(rng, 10, (next, i) => ({ x: (i / 9 - 0.5) * 100, phase: next() * TAU, h: 40 + next() * 50, w: 8 + next() * 8, speed: 0.7 + next() * 0.6 }));
  const rise = ramp(p, 0, 0.45);
  const fade = decay(p, 0.65, 0.15);
  const intensity = 0.7 + 0.3 * Math.sin(p * TAU * 1.5) ** 2;
  // 발치 링(타원)
  ellipseRing(f, C, C + 50, 48 * rise + 6, 14 * rise + 2, 3.5, rgba(255, 130, 80, 0.85 * fade), { add: true, soft: 4 });
  ellipseRing(f, C, C + 50, 30 * rise + 4, 9 * rise + 1.5, 2, rgba(255, 220, 180, 0.8 * fade), { add: true });
  // 몸을 감싸 위로 흐르는 불꽃 줄기
  for (const flame of flames) {
    const k = ((p * flame.speed * 1.4 + flame.phase / TAU) % 1);
    const h = flame.h * rise;
    const x = C + flame.x * (0.55 + 0.25 * rise) + Math.sin(p * 6 + flame.phase) * 5;
    const baseY = C + 50 - 6;
    const topY = baseY - h * (0.6 + 0.4 * k);
    const alpha = fade * intensity * (1 - k * 0.5);
    streak(f, x, (baseY + topY) / 2, -Math.PI / 2 + Math.sin(k * 5) * 0.12, baseY - topY, flame.w * (1 - k * 0.3), rgba(200, 50, 40, 0.6 * alpha), { soft: flame.w * 0.6, curve: 3 });
    streak(f, x, (baseY + topY) / 2 - 2, -Math.PI / 2 + Math.sin(k * 5) * 0.12, (baseY - topY) * 0.85, flame.w * 0.5, rgba(255, 150, 80, 0.85 * alpha), { add: true, soft: 2, curve: 3 });
  }
  // 상승 광 알갱이
  motes(
    f,
    flames.map((flame, i) => {
      const k = (p * 1.6 + i * 0.13) % 1;
      return { x: C + flame.x * 0.6, y: C + 50 - 120 * k, size: 2.5, alpha: 0.8 * fade * Math.sin(k * Math.PI) };
    }),
    rgba(255, 220, 150)
  );
  glow(f, C, C + 10, 70, rgba(255, 110, 70, 0.22 * fade * rise * intensity), { falloff: 2.4 });
}

export function guardBarrier(f, p, rng) {
  const facets = particles(rng, 11, (next, i) => ({ angle: (i / 11) * TAU + next() * 0.15, dist: 34 + next() * 8, delay: next() * 0.3 }));
  const appear = ramp(p, 0, 0.4);
  const fade = decay(p, 0.65, 0.2);
  const shimmer = pulse(p, 0.35, 0.55, 0.85);
  // 반구 방패: 육각 패싯이 돔을 따라 나타난다
  for (const facet of facets) {
    const t = ramp(appear, facet.delay, facet.delay + 0.6);
    if (t <= 0) continue;
    const x = C + Math.cos(facet.angle) * facet.dist;
    const y = C - 6 + Math.sin(facet.angle) * facet.dist * 1.15;
    const size = 15 * t;
    const verts = [];
    for (let k = 0; k < 6; k += 1) {
      const a = (k / 6) * TAU + Math.PI / 6;
      verts.push([x + Math.cos(a) * size, y + Math.sin(a) * size]);
    }
    polygon(f, verts, rgba(90, 170, 255, 0.28 * fade * t), { soft: 3 });
    for (let k = 0; k < 6; k += 1) stroke(f, [verts[k], verts[(k + 1) % 6]], 1.1, rgba(200, 235, 255, 0.85 * fade * t), { add: true });
  }
  // 바깥 윤곽 링 + 흰 하이라이트 sweep
  ellipseRing(f, C, C - 6, 50 * appear + 2, 58 * appear + 2, 3, GUARD, { add: true, soft: 3 });
  if (shimmer > 0) {
    const sweepX = C - 60 + 120 * ramp(p, 0.35, 0.85);
    stroke(f, [[sweepX - 10, C - 70], [sweepX + 10, C + 60]], 4, rgba(255, 255, 255, 0.55 * shimmer * fade), { add: true, soft: 5 });
  }
  core(f, C, C - 6, 6 + 4 * shimmer, GUARD, 0.5 * fade * appear);
  glow(f, C, C - 6, 64, rgba(110, 190, 255, 0.18 * fade * appear), { falloff: 2.4 });
}

export function captureSeal(f, p, rng) {
  const beams = particles(rng, 6, (next, i) => ({ angle: (i / 6) * TAU + next() * 0.3, delay: next() * 0.15 }));
  const stars = particles(rng, 12, (next) => ({ angle: next() * TAU, dist: 0.4 + next() * 0.6, size: 2.5 + next() * 3, rotate: next() * 1.5 }));
  const open = ramp(p, 0, 0.3);
  const squeeze = ramp(p, 0.3, 0.75);
  const fade = decay(p, 0.8, 0.1);
  const radius = (20 + 60 * open) * (1 - 0.7 * squeeze);
  // 회전하며 조여드는 봉인 마법진
  sigil(f, C, C, radius, SEAL, fade * (0.7 + 0.3 * open), { rotate: p * 4, ticks: 12, thickness: 2.8, sides: 6 });
  // 수렴하는 빛줄기
  for (const beam of beams) {
    const t = ramp(p, 0.3 + beam.delay, 0.75 + beam.delay * 0.5);
    if (t <= 0) continue;
    const outer = 90 - 30 * t;
    const inner = radius * 1.05;
    if (outer <= inner) continue;
    const a = beam.angle + p * 1.5;
    stroke(f, [[C + Math.cos(a) * outer, C + Math.sin(a) * outer], [C + Math.cos(a) * inner, C + Math.sin(a) * inner]], [1.2, 3.6], rgba(255, 220, 120, 0.9 * fade * t), { add: true, soft: 2 });
  }
  const seal = pulse(p, 0.62, 0.78, 1);
  if (seal > 0) {
    core(f, C, C, 10 + 14 * seal, rgba(255, 240, 200), seal);
    rays(f, C, C, 10, 8, 26 + 40 * seal, 2.8, SEAL, seal, { rotate: p * 3, lengths: [1, 0.55, 0.8] });
    shock(f, C, C, 8 + 60 * ramp(p, 0.7, 1), 3.5, SEAL, 0.8 * (1 - ramp(p, 0.7, 1) * 0.7), { soft: 8 });
  }
  sparkles(
    f,
    stars.map((s) => ({
      x: C + Math.cos(s.angle + p * 2) * s.dist * (radius + 14),
      y: C + Math.sin(s.angle + p * 2) * s.dist * (radius + 14),
      size: s.size,
      alpha: 0.9 * fade * open,
      rotate: s.rotate + p * 2,
    })),
    rgba(255, 240, 200),
    { thickness: 0.9 }
  );
  glow(f, C, C, 70, rgba(255, 200, 90, 0.16 * fade * (open * 0.6 + seal)), { falloff: 2.4 });
}
