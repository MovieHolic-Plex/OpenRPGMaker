// 상태이상·지원·대형기처럼 여러 JRPG에서 재사용하기 좋은 범용 전투 이펙트 페인터.
// 특정 상용 게임의 기술 연출을 복제하지 않고, 읽기 쉬운 도형 문법으로 독립 제작한다.
import { arc, disc, fade, line, outline, plot, ring, streak } from "./canvas.mjs";

const CENTER = 24;
const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function decayFrom(progress, start, floor = 0.3) {
  if (progress <= start) return 1;
  return floor + (1 - floor) * clamp01(1 - (progress - start) / (1 - start));
}

function particles(rng, count, make) {
  return Array.from({ length: count }, (_unused, index) => make(rng, index));
}

function sparkle(frame, x, y, radius, color) {
  line(frame, x - radius, y, x + radius, y, color);
  line(frame, x, y - radius, x, y + radius, color);
  plot(frame, x, y, fade([255, 255, 255], color[3]));
}

function polygon(frame, cx, cy, radius, sides, rotation, color, thickness = 1) {
  for (let index = 0; index < sides; index += 1) {
    const a0 = rotation + (index / sides) * TAU;
    const a1 = rotation + ((index + 1) / sides) * TAU;
    line(
      frame,
      cx + Math.cos(a0) * radius,
      cy + Math.sin(a0) * radius,
      cx + Math.cos(a1) * radius,
      cy + Math.sin(a1) * radius,
      color,
      thickness
    );
  }
}

export function criticalBurst(frame, progress, rng) {
  const rays = particles(rng, 12, (next, index) => ({
    angle: (index / 12) * TAU + (next() - 0.5) * 0.12,
    length: 13 + next() * 12,
  }));
  const burst = clamp01(progress / 0.5);
  const decay = decayFrom(progress, 0.48, 0.28);
  disc(frame, CENTER, CENTER, 3 + 4 * (1 - progress), fade([255, 248, 208], 250 * decay));
  ring(frame, CENTER, CENTER, 4 + 22 * progress, 2.4, fade([255, 188, 54], 230 * decay));
  for (const ray of rays) {
    const inner = 4 + 7 * burst;
    const outer = inner + ray.length * burst;
    line(
      frame,
      CENTER + Math.cos(ray.angle) * inner,
      CENTER + Math.sin(ray.angle) * inner,
      CENTER + Math.cos(ray.angle) * outer,
      CENTER + Math.sin(ray.angle) * outer,
      fade([255, 225, 126], 245 * decay),
      1.5
    );
  }
  line(frame, 8, 38 - 16 * progress, 40, 10 + 12 * progress, fade([255, 104, 58], 210 * decay), 2.5);
  outline(frame, fade([82, 30, 18], 190 * decay));
}

export function sonicWave(frame, progress) {
  const decay = decayFrom(progress, 0.62, 0.34);
  const travel = 5 + 31 * progress;
  disc(frame, 7, CENTER, 2.5, fade([224, 252, 255], 240 * decay));
  line(frame, 3, CENTER - 4, 8, CENTER, fade([74, 166, 210], 220 * decay), 2);
  line(frame, 3, CENTER + 4, 8, CENTER, fade([74, 166, 210], 220 * decay), 2);
  for (let index = 0; index < 4; index += 1) {
    const x = travel - index * 7;
    const radius = 5 + index * 1.8;
    arc(frame, x, CENTER, radius, 2, -Math.PI / 2, Math.PI / 2, fade([126, 224, 246], (245 - index * 34) * decay));
  }
  if (progress > 0.48) {
    const hit = clamp01((progress - 0.48) / 0.52);
    ring(frame, 41, CENTER, 3 + 11 * hit, 1.8, fade([224, 252, 255], 220 * decay));
  }
  outline(frame, fade([20, 72, 104], 170 * decay));
}

export function drainOrbs(frame, progress, rng) {
  const orbs = particles(rng, 10, (next, index) => ({
    angle: (index / 10) * TAU + next() * 0.35,
    radius: 17 + next() * 9,
    size: 1.2 + next() * 1.5,
  }));
  const gather = clamp01(progress / 0.72);
  const decay = decayFrom(progress, 0.75, 0.4);
  for (const orb of orbs) {
    const radius = orb.radius * (1 - gather * 0.82);
    const angle = orb.angle + gather * 3.2;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius * 0.72;
    disc(frame, x, y, orb.size, fade([196, 68, 132], 225 * decay));
    plot(frame, x - 0.5, y - 0.5, fade([255, 188, 222], 235 * decay));
  }
  ring(frame, CENTER, CENTER, 4 + 8 * (1 - gather), 1.8, fade([102, 36, 112], 215 * decay));
  disc(frame, CENTER, CENTER, 2 + 5 * gather, fade([230, 102, 166], 230 * decay));
  outline(frame, fade([46, 12, 52], 185 * decay));
}

export function reviveRise(frame, progress, rng) {
  const motes = particles(rng, 12, (next) => ({
    x: 10 + next() * 28,
    phase: next() * 0.62,
    drift: (next() - 0.5) * 5,
  }));
  const reveal = clamp01(progress / 0.55);
  const decay = decayFrom(progress, 0.78, 0.46);
  ring(frame, CENTER, 40, 5 + 15 * reveal, 2.2, fade([130, 238, 160], 225 * decay));
  line(frame, CENTER, 40, CENTER, 37 - 29 * reveal, fade([244, 255, 210], 235 * decay), 3);
  line(frame, CENTER - 5, 22 - 8 * reveal, CENTER + 5, 22 - 8 * reveal, fade([255, 246, 174], 240 * decay), 2.5);
  for (const mote of motes) {
    const local = clamp01(progress + mote.phase);
    const y = 44 - 39 * local;
    const x = mote.x + mote.drift * local + Math.sin(local * 5) * 2;
    sparkle(frame, x, y, 1 + (mote.x % 2), fade([210, 255, 188], 220 * decay * (1 - local * 0.45)));
  }
  outline(frame, fade([42, 92, 56], 155 * decay));
}

export function cleanseSparkle(frame, progress, rng) {
  const motes = particles(rng, 11, (next) => ({
    angle: next() * TAU,
    radius: 6 + next() * 19,
    phase: next() * 0.35,
  }));
  const sweep = clamp01(progress / 0.64);
  const decay = decayFrom(progress, 0.72, 0.38);
  ring(frame, CENTER, CENTER, 5 + 20 * sweep, 2, fade([146, 238, 238], 225 * decay));
  arc(frame, CENTER, CENTER, 14 + 6 * sweep, 2.6, -Math.PI / 2, -Math.PI / 2 + TAU * sweep, fade([246, 255, 248], 245 * decay));
  for (const mote of motes) {
    const local = clamp01(progress + mote.phase);
    const angle = mote.angle - local * 1.2;
    const radius = mote.radius * (0.7 + 0.3 * sweep);
    sparkle(frame, CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius, 1.4, fade([196, 255, 226], 220 * decay));
  }
  line(frame, 17, CENTER, 22, CENTER + 5, fade([255, 255, 255], 235 * decay), 2);
  line(frame, 22, CENTER + 5, 32, CENTER - 7, fade([255, 255, 255], 235 * decay), 2);
  outline(frame, fade([42, 104, 104], 145 * decay));
}

export function paralysisBind(frame, progress) {
  const bind = clamp01(progress / 0.52);
  const decay = decayFrom(progress, 0.68, 0.36);
  const gap = 26 - 14 * bind;
  for (const side of [-1, 1]) {
    const x = CENTER + side * gap;
    line(frame, x, 8, x - side * 6, 17, fade([255, 226, 60], 240 * decay), 3);
    line(frame, x - side * 6, 17, x + side * 1, 25, fade([255, 246, 156], 250 * decay), 2);
    line(frame, x + side * 1, 25, x - side * 7, 38, fade([255, 198, 42], 240 * decay), 3);
  }
  ring(frame, CENTER, CENTER, 5 + 12 * bind, 1.8, fade([238, 186, 30], 215 * decay));
  line(frame, 10 + 10 * bind, 13, 38 - 10 * bind, 35, fade([255, 244, 188], 210 * decay), 1.5);
  line(frame, 38 - 10 * bind, 13, 10 + 10 * bind, 35, fade([255, 244, 188], 210 * decay), 1.5);
  const moteAngle = -Math.PI + progress * Math.PI * 1.7;
  disc(frame, CENTER + Math.cos(moteAngle) * 21, CENTER + Math.sin(moteAngle) * 17, 1.3, fade([255, 250, 196], 235 * decay));
  outline(frame, fade([88, 62, 8], 180 * decay));
}

export function blindVeil(frame, progress, rng) {
  const dust = particles(rng, 10, (next) => ({
    x: 5 + next() * 38,
    y: 18 + next() * 12,
    drift: (next() - 0.5) * 8,
  }));
  const close = progress < 0.65 ? clamp01(progress / 0.65) : 1;
  const decay = decayFrom(progress, 0.74, 0.46);
  const gap = 11 * (1 - close) + 1.5;
  arc(frame, CENTER, CENTER, 18, 2.4, Math.PI + 0.15, TAU - 0.15, fade([108, 90, 138], 230 * decay));
  arc(frame, CENTER, CENTER, 18, 2.4, 0.15, Math.PI - 0.15, fade([108, 90, 138], 230 * decay));
  line(frame, 7, CENTER - gap, 41, CENTER - gap, fade([38, 28, 54], 235 * decay), 4);
  line(frame, 7, CENTER + gap, 41, CENTER + gap, fade([38, 28, 54], 235 * decay), 4);
  disc(frame, CENTER, CENTER, Math.max(1.5, 5 * (1 - close)), fade([180, 142, 220], 225 * decay));
  for (const mote of dust) {
    plot(frame, mote.x + mote.drift * progress, mote.y + Math.sin(progress * 5 + mote.x) * 3, fade([116, 100, 136], 175 * decay));
  }
  outline(frame, fade([12, 8, 18], 200 * decay));
}

export function confusionSpiral(frame, progress, rng) {
  const dots = particles(rng, 12, (next, index) => ({
    phase: index / 12,
    wobble: 0.85 + next() * 0.35,
    size: 1.2 + next() * 1.2,
  }));
  const decay = decayFrom(progress, 0.72, 0.42);
  for (const dot of dots) {
    const angle = dot.phase * TAU * 2.2 + progress * 5.4;
    const radius = (4 + dot.phase * 20) * dot.wobble * (0.8 + 0.2 * Math.sin(progress * Math.PI));
    const color = dot.phase < 0.34 ? [250, 112, 180] : dot.phase < 0.67 ? [118, 218, 244] : [250, 218, 96];
    disc(frame, CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius * 0.72, dot.size, fade(color, 225 * decay));
  }
  ring(frame, CENTER, CENTER, 3 + 3 * progress, 1.5, fade([244, 228, 255], 230 * decay));
  arc(frame, CENTER, CENTER, 9 + 10 * progress, 1.4, progress * 2.2, progress * 2.2 + Math.PI * 1.4, fade([204, 154, 244], 205 * decay));
  outline(frame, fade([52, 30, 78], 150 * decay));
}

export function silenceLock(frame, progress) {
  const seal = clamp01(progress / 0.58);
  const decay = decayFrom(progress, 0.72, 0.4);
  ring(frame, CENTER, CENTER, 5 + 15 * seal, 2.2, fade([120, 156, 196], 225 * decay));
  arc(frame, CENTER, CENTER, 12 + 4 * seal, 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * seal, fade([214, 236, 246], 225 * decay));
  const waveWidth = 11 + 7 * seal;
  for (let segment = 0; segment < 4; segment += 1) {
    const x0 = CENTER - waveWidth + segment * (waveWidth / 2);
    const x1 = CENTER - waveWidth + (segment + 1) * (waveWidth / 2);
    line(frame, x0, CENTER + (segment % 2 === 0 ? -3 : 3), x1, CENTER + (segment % 2 === 0 ? 3 : -3), fade([178, 218, 236], 210 * decay), 1.5);
  }
  line(frame, 12 + 6 * seal, 12 + 6 * seal, 36 - 6 * seal, 36 - 6 * seal, fade([242, 112, 126], 245 * decay), 3);
  line(frame, 36 - 6 * seal, 12 + 6 * seal, 12 + 6 * seal, 36 - 6 * seal, fade([242, 112, 126], 245 * decay), 3);
  outline(frame, fade([28, 42, 64], 175 * decay));
}

export function summonPortal(frame, progress, rng) {
  const runes = particles(rng, 12, (next, index) => ({
    angle: (index / 12) * TAU,
    phase: next() * 0.4,
  }));
  const open = progress < 0.7 ? clamp01(progress / 0.7) : 1;
  const decay = decayFrom(progress, 0.82, 0.52);
  const radius = 4 + 21 * open;
  disc(frame, CENTER, CENTER, Math.max(2, radius - 8), fade([34, 18, 68], 190 * decay));
  ring(frame, CENTER, CENTER, radius, 3, fade([158, 90, 238], 235 * decay));
  ring(frame, CENTER, CENTER, Math.max(2, radius - 6), 1.5, fade([100, 214, 242], 225 * decay));
  polygon(frame, CENTER, CENTER, Math.max(3, radius - 2), 6, progress * 2.1, fade([220, 176, 255], 215 * decay), 1.3);
  for (const rune of runes) {
    const angle = rune.angle - progress * 2.5;
    const r = radius + 3 + rune.phase * 5;
    const x = CENTER + Math.cos(angle) * r;
    const y = CENTER + Math.sin(angle) * r;
    line(frame, x - 1.5, y, x + 1.5, y, fade([230, 210, 255], 220 * decay));
  }
  sparkle(frame, CENTER, CENTER, 2 + 3 * open, fade([238, 250, 255], 235 * decay));
  outline(frame, fade([30, 12, 54], 190 * decay));
}

export function smokeVanish(frame, progress, rng) {
  const clouds = particles(rng, 12, (next, index) => ({
    angle: next() * TAU,
    radius: 2 + next() * 10,
    size: 3 + next() * 4,
    lift: 5 + next() * 10,
    phase: index / 12,
  }));
  const spread = clamp01(progress / 0.72);
  const decay = decayFrom(progress, 0.55, 0.22);
  for (const cloud of clouds) {
    const radius = cloud.radius + 15 * spread * (0.5 + cloud.phase);
    const x = CENTER + Math.cos(cloud.angle) * radius;
    const y = CENTER + Math.sin(cloud.angle) * radius * 0.62 - cloud.lift * progress;
    disc(frame, x, y, cloud.size * (0.75 + 0.45 * spread), fade([146, 154, 164], 190 * decay));
    disc(frame, x - 1, y - 1, cloud.size * 0.55, fade([216, 220, 222], 165 * decay));
  }
  ring(frame, CENTER, CENTER - 4 * progress, 4 + 20 * spread, 1.5, fade([226, 230, 232], 170 * decay));
  outline(frame, fade([52, 56, 64], 125 * decay));
}

export function meteorFall(frame, progress, rng) {
  const debris = particles(rng, 12, (next) => ({
    angle: -Math.PI + next() * Math.PI,
    speed: 0.65 + next() * 0.55,
    size: next() < 0.72 ? 1 : 2,
  }));
  const travel = clamp01(progress / 0.68);
  const impact = clamp01((progress - 0.58) / 0.42);
  const x = 6 + 32 * travel;
  const y = 5 + 34 * travel;
  const decay = decayFrom(progress, 0.78, 0.38);
  if (progress < 0.78) {
    streak(frame, x - 8, y - 8, Math.PI / 4, 13, 4.5, fade([176, 54, 28], 220 * decay), 1.5);
    streak(frame, x - 6, y - 6, Math.PI / 4, 11, 2.2, fade([255, 160, 52], 245 * decay), 1.5);
    disc(frame, x, y, 5.5, fade([112, 66, 50], 245 * decay));
    disc(frame, x - 1, y - 1, 2.5, fade([255, 210, 94], 240 * decay));
  }
  if (progress >= 0.58) {
    ring(frame, 38, 39, 4 + 20 * impact, 2.5, fade([255, 174, 64], 235 * decay));
    line(frame, 8, 42, 45, 42, fade([106, 58, 38], 235 * decay), 3);
    for (const bit of debris) {
      const distance = 4 + 22 * impact * bit.speed;
      const bx = 38 + Math.cos(bit.angle) * distance;
      const by = 39 + Math.sin(bit.angle) * distance * 0.62;
      disc(frame, bx, by, bit.size, fade([164, 86, 42], 225 * decay));
    }
    disc(frame, 38, 39, 3 + 5 * (1 - impact), fade([255, 232, 146], 240 * decay));
  }
  outline(frame, fade([58, 24, 18], 190 * decay));
}
