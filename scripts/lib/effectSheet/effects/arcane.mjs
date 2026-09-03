// 원소·마법·회복·상태 계열. painter(f, p, rng) 규약은 impact.mjs 와 같다.
import {
  CENTER as C,
  decay,
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
import { clouds, core, motes, rays, shock, sigil, slashArc, sparkles } from "../recipes.mjs";

const WIND = rgba(196, 240, 224);
const EARTH_LIGHT = rgba(212, 176, 122);
const HEAL = rgba(150, 255, 190);
const HEAL_GOLD = rgba(255, 236, 150);
const ARCANE = rgba(150, 100, 255);
const ARCANE_LIGHT = rgba(228, 205, 255);

export function windSlice(f, p, rng) {
  const blades = particles(rng, 4, (next, i) => ({
    y: C - 36 + i * 24 + (next() - 0.5) * 8,
    delay: i * 0.09 + (i === 0 ? 0 : next() * 0.05),
    radius: 46 + next() * 24,
    thickness: 12 + next() * 6,
    span: 0.75 + next() * 0.3,
  }));
  const leaves = particles(rng, 9, (next) => ({ y: (next() - 0.5) * 120, speed: 0.6 + next() * 0.8, size: 7 + next() * 5, phase: next() * TAU, spin: next() * TAU }));
  const fade = decay(p, 0.6, 0.08);
  // 초승달 칼바람이 왼쪽에서 오른쪽으로 휩쓴다 — 호의 중심을 진행 방향 앞에 두면 볼록한 쪽이 앞을 향한다.
  for (const blade of blades) {
    const t = ramp(p, blade.delay, blade.delay + 0.45);
    if (t <= 0) continue;
    const x = C - 84 + 170 * t;
    const alpha = fade * Math.sin(Math.min(1, t) * Math.PI) ** 0.5;
    const cx = x - blade.radius * 0.55;
    // 흐릿한 잔상 → 본체 → 흰 날
    slashArc(f, cx - 14, blade.y, blade.radius, blade.thickness * 0.7, -blade.span * 0.9, blade.span * 0.9, rgba(150, 215, 200), alpha * 0.35);
    slashArc(f, cx, blade.y, blade.radius, blade.thickness, -blade.span, blade.span, WIND, alpha);
  }
  // 바람에 실린 잎 — 렌즈형, 어두운 잎맥 선
  const drift = ramp(p, 0.05, 1);
  for (const leaf of leaves) {
    const k = Math.min(1, drift * leaf.speed);
    const alpha = 0.95 * fade * Math.sin(k * Math.PI) ** 0.7;
    if (alpha <= 0.02) continue;
    const x = C - 84 + 180 * k;
    const y = C + leaf.y + Math.sin(p * 6 + leaf.phase) * 9;
    const angle = leaf.spin + p * 7;
    streak(f, x, y, angle, leaf.size * 2, leaf.size * 0.55, rgba(74, 150, 82, alpha), { curve: leaf.size * 0.25 });
    streak(f, x, y, angle, leaf.size * 1.7, leaf.size * 0.32, rgba(140, 220, 130, alpha), { curve: leaf.size * 0.22 });
    stroke(f, [[x - Math.cos(angle) * leaf.size * 0.8, y - Math.sin(angle) * leaf.size * 0.8], [x + Math.cos(angle) * leaf.size * 0.8, y + Math.sin(angle) * leaf.size * 0.8]], 0.7, rgba(40, 100, 50, alpha * 0.8));
  }
  // 흩날리는 흰 먼지
  motes(
    f,
    leaves.map((leaf) => ({
      x: C - 70 + 170 * Math.min(1, drift * leaf.speed * 1.1) + Math.sin(p * 9 + leaf.phase) * 6,
      y: C - leaf.y * 0.8 + Math.cos(p * 5 + leaf.phase) * 8,
      size: 2.2,
      alpha: 0.7 * fade * Math.sin(Math.min(1, drift * leaf.speed * 1.1) * Math.PI),
    })),
    rgba(235, 255, 245),
    { falloff: 1.2 }
  );
  glow(f, C, C, 70, rgba(190, 240, 220, 0.14 * fade * pulse(p, 0, 0.45, 1)), { falloff: 2.5 });
}

export function earthSpike(f, p, rng) {
  // feet 앵커: 프레임 중심이 발. 돌 창이 아래에서 위로 솟는다.
  const spikes = particles(rng, 5, (next, i) => ({
    x: C + (i - 2) * 22 + (next() - 0.5) * 10,
    // 발 앵커(C+6)에서 최대 86 → 꼭대기 y≈16. 더 높으면 프레임 위에서 창끝이 잘린다.
    height: 50 + next() * 36 - Math.abs(i - 2) * 10,
    width: 12 + next() * 8,
    delay: Math.abs(i - 2) * 0.09 + next() * 0.05,
    lean: (next() - 0.5) * 0.35,
  }));
  const debris = particles(rng, 14, (next) => ({ x: (next() - 0.5) * 2, speed: 0.5 + next() * 0.9, size: 2 + next() * 3, phase: next() * TAU }));
  const noise = makeAngularNoise(rng, 3);
  const baseY = C + 6;
  const fade = decay(p, 0.7, 0.15);
  // 먼지 구름
  const dust = pulse(p, 0, 0.3, 1);
  clouds(
    f,
    [-1, 0, 1].map((k) => ({ x: C + k * 34, y: baseY - 4 - 10 * dust, r: 14 + 22 * dust, alpha: 0.5 * dust * fade, phase: k * 2.1 + p * 2 })),
    rgba(180, 150, 110),
    rng,
    { noise, amplitude: 0.35, softness: 0.6 }
  );
  for (const spike of spikes) {
    const t = ramp(p, spike.delay, spike.delay + 0.3);
    if (t <= 0) continue;
    const height = spike.height * Math.sin(t * Math.PI / 2) * (1 - 0.15 * ramp(p, 0.8, 1));
    const tipX = spike.x + spike.lean * height;
    const tipY = baseY - height;
    const w = spike.width;
    polygon(f, [[tipX, tipY], [spike.x + w, baseY + 4], [spike.x - w, baseY + 4]], rgba(110, 74, 44, fade));
    polygon(f, [[tipX, tipY + 6], [spike.x + w * 0.35, baseY + 2], [spike.x - w * 0.55, baseY + 2]], rgba(150, 104, 62, fade));
    // 하이라이트 능선
    stroke(f, [[tipX - 1, tipY + 8], [spike.x - w * 0.25, baseY - 6]], 1.6, rgba(212, 176, 122, 0.9 * fade), { soft: 1 });
    // 뾰족한 끝 광택
    glow(f, tipX, tipY + 4, 5, rgba(255, 230, 190, 0.6 * fade * pulse(p, spike.delay + 0.15, spike.delay + 0.3, spike.delay + 0.6)));
  }
  if (p > 0.1) {
    const t = ramp(p, 0.1, 1);
    motes(
      f,
      debris.map((d) => ({
        x: C + d.x * (14 + 46 * t * d.speed),
        y: baseY - 60 * t * d.speed + 90 * t * t * d.speed,
        size: d.size * (1 - t * 0.5),
        alpha: 0.9 * (1 - t) * fade,
      })),
      EARTH_LIGHT,
      { add: false, falloff: 0.6 }
    );
  }
}

export function healBloom(f, p, rng) {
  // head 앵커: 프레임 중심이 머리. 빛이 머리 위에서 피어나 아래로 내려앉는다.
  const petalsList = particles(rng, 8, (next, i) => ({ angle: (i / 8) * TAU + (next() - 0.5) * 0.3, length: 22 + next() * 12, delay: next() * 0.1 }));
  const sparks = particles(rng, 14, (next) => ({ x: (next() - 0.5) * 110, y0: 30 + next() * 60, speed: 0.6 + next() * 0.7, size: 2.5 + next() * 3, rotate: next() * 1.5, phase: next() * TAU }));
  const open = ramp(p, 0, 0.5);
  const fade = decay(p, 0.62, 0.05);
  const cy = C - 10;
  glow(f, C, cy + 30, 56 + 20 * open, rgba(150, 255, 190, 0.22 * fade * open), { falloff: 2.4 });
  // 꽃잎: 중심에서 바깥으로 벌어지는 렌즈
  for (const petal of petalsList) {
    const t = ramp(p, petal.delay, petal.delay + 0.5);
    if (t <= 0) continue;
    const length = petal.length * Math.sin(t * Math.PI / 2);
    const dist = 6 + 26 * t;
    const x = C + Math.cos(petal.angle) * dist;
    const y = cy + Math.sin(petal.angle) * dist * 0.75;
    streak(f, x, y, petal.angle, length, 5.5, rgba(150, 255, 190, 0.9 * fade), { soft: 3, curve: 3 });
    streak(f, x, y, petal.angle, length * 0.8, 2.4, rgba(240, 255, 245, 0.9 * fade), { add: true, soft: 1.5, curve: 2.5 });
  }
  core(f, C, cy, 8 + 8 * pulse(p, 0.1, 0.4, 0.9), HEAL, fade * (0.6 + 0.4 * open));
  shock(f, C, cy + 10, 10 + 56 * ramp(p, 0.3, 1), 3, HEAL, 0.6 * fade * (1 - ramp(p, 0.3, 1) * 0.6), { soft: 8 });
  // 금빛 반짝임이 위로 떠오른다
  const rise = ramp(p, 0.15, 1);
  sparkles(
    f,
    sparks.map((s) => ({
      x: C + s.x + Math.sin(p * 5 + s.phase) * 4,
      y: cy + s.y0 - 70 * rise * s.speed,
      size: s.size * (0.6 + 0.4 * Math.sin(p * 10 + s.phase) ** 2),
      alpha: 0.95 * fade * Math.sin(Math.min(1, rise * s.speed) * Math.PI),
      rotate: s.rotate,
    })),
    HEAL_GOLD,
    { thickness: 1 }
  );
}

export function poisonMist(f, p, rng) {
  const puffs = particles(rng, 7, (next, i) => ({
    angle: (i / 7) * TAU + next() * 0.5,
    dist: 14 + next() * 26,
    r: 18 + next() * 14,
    phase: next() * TAU,
    drift: 0.4 + next() * 0.6,
  }));
  const bubbles = particles(rng, 12, (next) => ({ x: (next() - 0.5) * 90, y0: 20 + next() * 40, speed: 0.6 + next() * 0.8, size: 3 + next() * 4, pop: 0.5 + next() * 0.45 }));
  const noise = makeAngularNoise(rng, 4);
  const spread = ramp(p, 0, 0.55);
  const fade = decay(p, 0.55, 0.05);
  clouds(
    f,
    puffs.map((puff) => ({
      x: C + Math.cos(puff.angle + p * 1.2 * puff.drift) * puff.dist * spread,
      y: C + 6 + Math.sin(puff.angle + p * 1.2 * puff.drift) * puff.dist * spread * 0.7 - 20 * p * puff.drift,
      r: puff.r * (0.4 + 0.8 * spread),
      alpha: 0.55 * fade,
      phase: puff.phase + p * 2,
    })),
    rgba(120, 60, 180),
    rng,
    { noise, amplitude: 0.35, softness: 0.65 }
  );
  clouds(
    f,
    puffs.slice(0, 5).map((puff) => ({
      x: C + Math.cos(puff.angle + 1 + p * puff.drift) * puff.dist * 0.7 * spread,
      y: C + Math.sin(puff.angle + 1 + p * puff.drift) * puff.dist * 0.5 * spread - 16 * p,
      r: puff.r * 0.55 * (0.4 + 0.8 * spread),
      alpha: 0.5 * fade,
      phase: puff.phase + 3 + p * 2,
    })),
    rgba(190, 120, 235),
    rng,
    { noise, amplitude: 0.3, softness: 0.6 }
  );
  // 독기 거품: 올라가다 터진다
  for (const bubble of bubbles) {
    const t = ramp(p, 0.1, 1) * bubble.speed;
    if (t <= 0) continue;
    const x = C + bubble.x * (0.5 + 0.5 * spread);
    const y = C + bubble.y0 - 80 * t;
    if (t < bubble.pop) {
      ring(f, x, y, bubble.size, 1.4, rgba(200, 240, 140, 0.9 * fade), { add: true });
      glow(f, x - bubble.size * 0.3, y - bubble.size * 0.3, bubble.size * 0.4, rgba(255, 255, 255, 0.8 * fade));
    } else if (t < bubble.pop + 0.15) {
      const k = (t - bubble.pop) / 0.15;
      ring(f, x, y, bubble.size * (1 + k * 1.5), 1, rgba(200, 240, 140, 0.8 * fade * (1 - k)), { add: true });
    }
  }
  glow(f, C, C, 60, rgba(160, 80, 220, 0.16 * fade * spread), { falloff: 2.6 });
}

export function arcaneNova(f, p, rng) {
  // screen 앵커(전체). 셀 zoom 200 으로 무대 384px 를 덮는다 — 그래서 여백 없이 크게 그린다.
  const runes = particles(rng, 16, (next, i) => ({ angle: (i / 16) * TAU + next() * 0.2, len: 6 + next() * 8 }));
  const stars = particles(rng, 18, (next) => ({ angle: next() * TAU, dist: 0.25 + next() * 0.7, size: 2.5 + next() * 3.5, rotate: next() * 1.5, delay: next() * 0.3 }));
  const gather = ramp(p, 0, 0.3);
  const burst = ramp(p, 0.3, 1);
  const fade = decay(p, 0.55, 0.05);
  if (p < 0.34) {
    // 수렴: 바깥 마법진이 조여든다
    sigil(f, C, C, 84 - 40 * gather, ARCANE, 0.6 + 0.4 * gather, { rotate: p * 3, ticks: 16, thickness: 2.4, sides: 5 });
    core(f, C, C, 6 + 14 * gather, ARCANE_LIGHT, gather);
  }
  const flash = pulse(p, 0.26, 0.36, 0.7);
  if (flash > 0) {
    core(f, C, C, 20 + 20 * flash, ARCANE_LIGHT, flash);
    rays(f, C, C, 12, 10, 40 + 50 * flash, 3, rgba(220, 200, 255), flash, { rotate: p * 2, lengths: [1, 0.6, 0.8, 0.5, 0.9] });
  }
  if (burst > 0) {
    for (const [k, alpha] of [[1, 0.9], [0.72, 0.6], [0.45, 0.45]]) {
      const r = 10 + 78 * burst * k;
      shock(f, C, C, r, 4 * (1 - burst * 0.5), ARCANE, alpha * fade, { soft: 12 });
    }
    // 룬 눈금이 바깥 링에 붙어 돈다
    const r = 12 + 72 * burst;
    for (const rune of runes) {
      const a = rune.angle + p * 1.5;
      stroke(f, [[C + Math.cos(a) * (r - rune.len), C + Math.sin(a) * (r - rune.len)], [C + Math.cos(a) * (r + rune.len * 0.4), C + Math.sin(a) * (r + rune.len * 0.4)]], 1.6, rgba(228, 205, 255, 0.9 * fade), { add: true });
    }
    sparkles(
      f,
      stars.map((s) => {
        const t = ramp(burst, s.delay, 1);
        return { x: C + Math.cos(s.angle) * s.dist * 82 * t, y: C + Math.sin(s.angle) * s.dist * 82 * t, size: s.size, alpha: 0.9 * fade * Math.sin(t * Math.PI), rotate: s.rotate + p };
      }),
      rgba(240, 225, 255),
      { thickness: 1 }
    );
  }
  glow(f, C, C, 90, rgba(150, 100, 255, 0.2 * fade * (gather * 0.5 + flash)), { falloff: 2.4 });
}
