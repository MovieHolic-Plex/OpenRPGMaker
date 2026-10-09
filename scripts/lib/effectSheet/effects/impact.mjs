// 물리·원소 타격계. painter(f, p, rng) — p 는 0(첫 프레임)~1(마지막), rng 는 프레임마다 같은 시드.
// 파티클 파라미터는 프레임 시작에 한 번에 뽑는다(분기 안에서 뽑으면 시퀀스가 밀려 스트립이 튄다).
import {
  blob,
  boltPath,
  CENTER as C,
  decay,
  glow,
  makeAngularNoise,
  particles,
  pulse,
  ramp,
  rgba,
  streak,
  stroke,
  TAU,
} from "../raster.mjs";
import { bolt, clouds, column, core, motes, rays, shards, shock, slashArc, sparkles } from "../recipes.mjs";

const STEEL = rgba(150, 178, 215);
const ICE = rgba(120, 190, 245);
const ICE_DEEP = rgba(48, 110, 190);
const BOLT = rgba(150, 120, 255);
const BOLT_HOT = rgba(220, 230, 255);
const WATER_LIGHT = rgba(150, 210, 255);

export function slashSteel(f, p, rng) {
  const sparks = particles(rng, 14, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 1.4 + next() * 1.6 }));
  const first = ramp(p, 0, 0.3);
  const second = ramp(p, 0.2, 0.5);
  const fade = decay(p, 0.55, 0.1);
  // 두 줄기가 중심에서 X 로 교차한다. 렌즈형 줄기(양끝 뾰족) + 살짝 휘어진 곡률.
  const cut = (angle, grow, curve, thickness) => {
    if (grow <= 0) return;
    const length = 40 + 120 * grow;
    const a = fade * (0.5 + 0.5 * grow);
    streak(f, C, C - 4, angle, length, thickness, rgba(70, 92, 130, 0.85 * a), { soft: thickness * 0.7, curve });
    streak(f, C, C - 4, angle, length * 0.96, thickness * 0.62, rgba(170, 196, 232, a), { soft: thickness * 0.3, curve });
    streak(f, C, C - 4, angle, length * 0.9, thickness * 0.24, rgba(255, 255, 255, a), { add: true, curve });
  };
  cut(-0.62, first, 9, 7.5);
  cut(-2.35, second, -8, 6.5);
  // 교차점 섬광
  const flash = pulse(p, 0.24, 0.4, 0.75);
  if (flash > 0) {
    core(f, C, C - 4, 9 + 9 * flash, STEEL, flash);
    rays(f, C, C - 4, 8, 6, 28 + 28 * flash, 2.2, rgba(220, 235, 255), flash * 0.9, { rotate: 0.3, lengths: [1, 0.55, 0.8, 0.6] });
  }
  // 불꽃 파편
  if (p > 0.34) {
    const travel = ramp(p, 0.34, 1);
    motes(
      f,
      sparks.map((s) => ({
        x: C + Math.cos(s.angle) * (8 + 64 * travel * s.speed),
        y: C - 4 + Math.sin(s.angle) * (8 + 64 * travel * s.speed) + 18 * travel * travel,
        size: s.size * (1 - travel * 0.6),
        alpha: 0.95 * (1 - travel),
      })),
      rgba(255, 250, 230)
    );
  }
  }

export function fireBurst(f, p, rng) {
  const tongues = particles(rng, 8, (next, i) => ({
    x: (i / 7 - 0.5) * 1.4,
    lift: 0.7 + next() * 0.5,
    curve: (next() - 0.5) * 22,
    phase: next() * TAU,
  }));
  const embers = particles(rng, 16, (next) => ({
    angle: -Math.PI / 2 + (next() - 0.5) * Math.PI * 1.3,
    speed: 0.5 + next() * 0.7,
    size: 1.3 + next() * 1.9,
    phase: next() * TAU,
  }));
  const noiseA = makeAngularNoise(rng, 4);
  const noiseB = makeAngularNoise(rng, 3);
  const grow = ramp(p, 0, 0.4);
  const fade = decay(p, 0.55, 0.08);
  const cy = C + 16 - 24 * p;
  const radius = 12 + 40 * Math.sqrt(grow);
  const spin = p * 2.4;
  // 화염 덩이 3겹(어두운 → 밝은)
  blob(f, C, cy, radius * 1.05, rgba(128, 22, 14, 0.9 * fade), (a) => noiseA(a + spin), { amplitude: 0.32, soft: radius * 0.4 });
  blob(f, C, cy - 3, radius * 0.8, rgba(232, 78, 26, 0.95 * fade), (a) => noiseB(a - spin * 0.7), { amplitude: 0.3, soft: radius * 0.32 });
  blob(f, C, cy - 5, radius * 0.52, rgba(255, 160, 50, fade), (a) => noiseA(a * 1.3 + spin), { amplitude: 0.24, soft: radius * 0.26 });
  glow(f, C, cy - 6, radius * 0.5, rgba(255, 236, 150, 0.95 * fade), { falloff: 1.5 });
  glow(f, C, cy - 6, radius * 0.22, rgba(255, 255, 235, 0.95 * fade), { falloff: 1.1 });
  // 위로 솟는 불꽃 혀 — 휘어진 렌즈. 아래에서 시작해 위로 뻗고 흔들린다.
  for (const t of tongues) {
    // 혀 끝이 프레임 위(y<0)로 나가지 않게: by(≈76) - len(≤54) > 0.
    const len = (10 + 36 * grow) * t.lift;
    const bx = C + t.x * radius * 0.7;
    const by = cy - radius * 0.35;
    const angle = -Math.PI / 2 + t.x * 0.35 + Math.sin(p * 8 + t.phase) * 0.16;
    streak(f, bx + Math.cos(angle) * len / 2, by + Math.sin(angle) * len / 2, angle, len, 5.5 * t.lift, rgba(236, 96, 30, 0.92 * fade), { soft: 3.2, curve: t.curve * grow });
    streak(f, bx + Math.cos(angle) * len / 2.2, by + Math.sin(angle) * len / 2.2, angle, len * 0.78, 2.6 * t.lift, rgba(255, 214, 110, 0.95 * fade), { add: true, soft: 1.6, curve: t.curve * grow * 0.9 });
  }
  // 불티
  if (p > 0.3) {
    const travel = ramp(p, 0.3, 1);
    motes(
      f,
      embers.map((e) => ({
        x: C + Math.cos(e.angle) * (radius * 0.6 + 40 * travel * e.speed) + Math.sin(p * 7 + e.phase) * 4,
        y: cy + Math.sin(e.angle) * (radius * 0.6 + 40 * travel * e.speed) * 0.9 - 10 * travel,
        size: e.size * (1.5 - travel),
        alpha: 0.9 * (1 - travel * 0.85),
      })),
      rgba(255, 205, 105)
    );
  }
  // 연기
  if (p > 0.45) {
    const s = ramp(p, 0.45, 1);
    clouds(
      f,
      // 프레임 위쪽(y<0)으로 나가지 않게 상승폭을 묶는다 — 잘린 연기는 직선으로 끊겨 보인다.
      [
        { x: C - 8, y: cy - radius * 0.5 - 14 * s, r: 8 + 16 * s, alpha: 0.32 * (1 - s), phase: 1.7 },
        { x: C + 14, y: cy - radius * 0.4 - 10 * s, r: 6 + 12 * s, alpha: 0.26 * (1 - s), phase: 3.1 },
      ],
      rgba(70, 58, 64),
      rng,
      { noise: noiseB }
    );
  }
  glow(f, C, cy, radius * 1.9, rgba(255, 120, 40, 0.26 * fade * (0.6 + 0.4 * pulse(p, 0.15, 0.4, 0.8))), { falloff: 2.2 });
}

export function iceShatter(f, p, rng) {
  const shardList = particles(rng, 9, (next, i) => ({
    angle: (i / 9) * TAU + (next() - 0.5) * 0.35,
    size: 11 + next() * 9,
    spin: (next() - 0.5) * 2,
    offset: 0.8 + next() * 0.4,
  }));
  const glints = particles(rng, 12, (next) => ({ angle: next() * TAU, dist: 0.3 + next() * 0.7, size: 2.5 + next() * 3, rotate: next() * 1.5 }));
  const converging = p < 0.45;
  const phase = converging ? ramp(p, 0, 0.45) : ramp(p, 0.45, 1);
  const cold = rgba(120, 190, 245);
  if (converging) {
    // 파편이 바깥에서 모여든다. 안쪽으로 뾰족한 방향(각도+π)으로 향한다.
    const dist = 70 - 52 * phase;
    shards(f, shardList.map((s) => ({ ...s, angle: s.angle })), C, C, dist, ICE, rgba(230, 245, 255), 0.55 + 0.45 * phase, { spinAmount: 0.3 * phase });
    glow(f, C, C, 10 + 22 * phase, rgba(170, 220, 255, 0.5 * phase), { falloff: 1.6 });
  } else {
    const burst = ramp(p, 0.45, 0.7);
    const fade = decay(p, 0.62, 0.1);
    // 결정 응결 → 산산이
    core(f, C, C, 14 * (1 - phase) + 4, cold, pulse(p, 0.42, 0.5, 0.8));
    shock(f, C, C, 10 + 62 * phase, 5 * (1 - phase * 0.6) + 1, ICE, 0.85 * fade, { soft: 10 });
    shock(f, C, C, 6 + 40 * phase, 2.5, rgba(240, 250, 255), 0.6 * fade);
    shards(f, shardList, C, C, 14 + 62 * phase, ICE_DEEP, rgba(225, 242, 255), fade, { spinAmount: 1.2 * phase, sizeScale: 1 - 0.35 * phase });
    rays(f, C, C, 6, 8, 22 + 40 * burst, 2.6, rgba(210, 236, 255), 0.85 * fade * (1 - phase * 0.5), { rotate: 0.4 });
    sparkles(
      f,
      glints.map((g) => ({
        x: C + Math.cos(g.angle) * g.dist * (20 + 60 * phase),
        y: C + Math.sin(g.angle) * g.dist * (20 + 60 * phase) + 10 * phase * phase,
        size: g.size * (1 - phase * 0.4),
        alpha: 0.9 * fade,
        rotate: g.rotate,
      })),
      rgba(240, 250, 255)
    );
  }
}

export function thunderStrike(f, p, rng) {
  // head 앵커: 프레임 중심이 대상의 머리. 번개는 위(y=0)에서 중심으로 떨어진다.
  const path = boltPath(rng, C + 12, -4, C, C, 9, 20);
  const branchA = boltPath(rng, path[3][0], path[3][1], path[3][0] + 34, path[3][1] + 18, 4, 8);
  const branchB = boltPath(rng, path[5][0], path[5][1], path[5][0] - 30, path[5][1] + 12, 4, 7);
  const sparks = particles(rng, 12, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.9, size: 1.6 + next() * 1.6 }));
  const lead = ramp(p, 0, 0.22);
  const strike = pulse(p, 0.18, 0.3, 0.62);
  const flicker = p > 0.34 && p < 0.42 ? 0.35 : 1;
  const fade = decay(p, 0.5, 0.06);
  if (lead > 0 && p < 0.22) {
    // 선도 방전: 가늘게 내려온다.
    const cut = Math.max(2, Math.round(path.length * lead));
    stroke(f, path.slice(0, cut), 1.6, rgba(210, 200, 255, 0.9), { add: true, soft: 1 });
  }
  if (p >= 0.2 && p < 0.72) {
    const width = 1.8 + 2.2 * strike;
    bolt(f, path, width * flicker, BOLT, (0.5 + 0.5 * strike) * fade * (0.6 + 0.4 * flicker), { branches: strike > 0.3 ? [branchA, branchB] : [] });
    glow(f, C + 8, 44, 70, rgba(150, 120, 255, 0.3 * strike * fade), { falloff: 2.2 });
  }
  // 착탄 섬광·지면 파열
  const hit = pulse(p, 0.24, 0.34, 0.8);
  if (hit > 0) {
    core(f, C, C, 10 + 12 * hit, BOLT_HOT, hit);
    rays(f, C, C, 10, 8, 26 + 30 * hit, 2.4, rgba(200, 210, 255), 0.9 * hit, { rotate: p * 3, lengths: [1, 0.6, 0.85, 0.5] });
    shock(f, C, C + 4, 8 + 52 * ramp(p, 0.3, 0.9), 3.5, rgba(190, 170, 255), 0.7 * fade, { soft: 6 });
  }
  if (p > 0.4) {
    const travel = ramp(p, 0.4, 1);
    motes(
      f,
      sparks.map((s) => ({
        x: C + Math.cos(s.angle) * (10 + 58 * travel * s.speed),
        y: C + Math.sin(s.angle) * (10 + 40 * travel * s.speed) - 6 * travel,
        size: s.size * (1 - travel * 0.5),
        alpha: 0.9 * (1 - travel),
      })),
      rgba(255, 245, 190)
    );
  }
}

export function waterColumn(f, p, rng) {
  // feet 앵커: 프레임 중심이 대상의 발. 기둥은 중심에서 위로 솟는다.
  const noise = makeAngularNoise(rng, 4);
  const drops = particles(rng, 14, (next) => ({ x: (next() - 0.5) * 2, speed: 0.6 + next() * 0.8, size: 1.8 + next() * 2.4, phase: next() * TAU }));
  const rise = ramp(p, 0, 0.45);
  const fall = ramp(p, 0.55, 1);
  const fade = decay(p, 0.6, 0.05);
  const baseY = C + 6;
  // 발 앵커(C+6)에서 위로 86 → 꼭대기 y≈16. 128 로 두면 프레임 위를 뚫고 나가 물마루가 잘렸다.
  const height = (86 * Math.sin(rise * Math.PI / 2)) * (1 - 0.35 * fall);
  const halfWidth = 14 + 8 * rise;
  if (rise > 0) {
    column(f, C, baseY, height, halfWidth * 1.15, rgba(40, 100, 190, 0.7 * fade), 1, { noise, phase: p * 4, soft: 9, taper: 0.3 });
    column(f, C, baseY, height * 0.98, halfWidth * 0.8, rgba(90, 160, 235, 0.9 * fade), 1, { noise, phase: p * 4 + 1, soft: 5, taper: 0.35, highlight: rgba(225, 245, 255) });
    // 물마루 거품
    const topY = baseY - height;
    clouds(
      f,
      // 거품 덩이(노이즈 35% 포함)가 프레임 위로 나가지 않게 물마루 살짝 아래에 둔다.
      [
        { x: C - 8, y: topY + 12, r: 9 + 4 * rise, alpha: 0.85 * fade, phase: p * 3 },
        { x: C + 10, y: topY + 15, r: 8 + 3 * rise, alpha: 0.8 * fade, phase: p * 3 + 2 },
        { x: C, y: topY + 8, r: 7 + 3 * rise, alpha: 0.9 * fade, phase: p * 3 + 4 },
      ],
      rgba(235, 248, 255),
      rng,
      { noise, amplitude: 0.35, softness: 0.4 }
    );
  }
  // 바닥 물보라 링(타원)
  const splash = pulse(p, 0.05, 0.4, 1);
  if (splash > 0) {
    const r = 18 + 40 * ramp(p, 0.05, 0.9);
    for (const [k, alpha] of [[1, 0.8], [0.7, 0.5]]) {
      const points = [];
      for (let i = 0; i <= 36; i += 1) {
        const a = (i / 36) * TAU;
        points.push([C + Math.cos(a) * r * k, baseY + 2 + Math.sin(a) * r * k * 0.32]);
      }
      stroke(f, points, 3 * k, rgba(180, 225, 255, alpha * fade * (1 - fall * 0.6)), { add: true, soft: 3 });
    }
  }
  // 낙하 물방울
  if (p > 0.35) {
    const t = ramp(p, 0.35, 1);
    motes(
      f,
      drops.map((d) => ({
        x: C + d.x * (halfWidth + 30 * t * d.speed),
        y: baseY - height * 0.9 + (height * 0.9 + 10) * t * t * d.speed + Math.sin(d.phase) * 6,
        size: d.size,
        alpha: 0.9 * (1 - t * 0.7) * fade,
      })),
      WATER_LIGHT,
      { falloff: 1.1 }
    );
  }
  glow(f, C, baseY - height / 2, 40 + height * 0.3, rgba(80, 150, 230, 0.2 * fade * rise), { falloff: 2.4 });
}
