// 마법·지형·보조계 이펙트 페인터. 규약은 paintersImpact.mjs 와 같다.
import { arc, disc, fade, line, outline, plot, ring, spike, streak } from "./canvas.mjs";

const CENTER = 24;
const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

/** 마지막 프레임이 빈 컷이 되지 않게 floor 만큼 잔상을 남기는 소멸 곡선. */
function decayFrom(progress, start, floor = 0.3) {
  if (progress <= start) return 1;
  return floor + (1 - floor) * clamp01(1 - (progress - start) / (1 - start));
}

function particles(rng, count, make) {
  const list = [];
  for (let index = 0; index < count; index += 1) list.push(make(rng, index));
  return list;
}

export function windSlice(frame, progress, rng) {
  const specks = particles(rng, 6, (next) => ({ angle: next() * TAU, radius: 9 + next() * 9 }));
  const decay = decayFrom(progress, 0.5, 0.34);
  for (let index = 0; index < 3; index += 1) {
    const radius = 8 + index * 5 + 11 * progress;
    const rotation = progress * 2.6 + index * 0.85;
    const span = 1.5 - index * 0.18;
    arc(frame, CENTER, CENTER, radius, 2.5, rotation, rotation + span, fade([62, 132, 84], 220 * decay));
    arc(frame, CENTER, CENTER, radius - 1, 1.2, rotation + 0.06, rotation + span - 0.06, fade([172, 232, 176], 240 * decay));
    arc(frame, CENTER, CENTER, radius - 2, 0.6, rotation + 0.14, rotation + span - 0.16, fade([236, 255, 238], 250 * decay));
  }
  for (const speck of specks) {
    const angle = speck.angle + progress * 3.2;
    const radius = speck.radius + 8 * progress;
    plot(frame, CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius, fade([214, 250, 214], 230 * decay));
  }
  outline(frame, fade([26, 58, 36], 170 * decay));
}

export function earthSpike(frame, progress, rng) {
  const columns = particles(rng, 5, (next, index) => ({
    x: 10 + index * 7 + (next() - 0.5) * 3,
    height: 13 + next() * 12,
    delay: index * 0.1,
  }));
  const debris = particles(rng, 8, (next) => ({ x: 8 + next() * 32, speed: 0.5 + next() * 0.8 }));
  const groundY = 43;
  const crumble = progress <= 0.75 ? 0 : (progress - 0.75) / 0.25;
  for (const column of columns) {
    const local = clamp01((progress - column.delay) / 0.5);
    if (local <= 0) continue;
    const height = column.height * local * (1 - 0.45 * crumble);
    const halfWidth = 3.4;
    spike(frame, column.x, groundY + crumble * 3, height, halfWidth, fade([70, 46, 28], 250));
    spike(frame, column.x - 0.8, groundY + crumble * 3, height * 0.92, halfWidth * 0.62, fade([132, 92, 54], 250));
    spike(frame, column.x - 1.4, groundY + crumble * 3, height * 0.72, halfWidth * 0.3, fade([186, 144, 92], 250));
  }
  const dust = clamp01(progress / 0.6);
  for (let index = 0; index < 6; index += 1) {
    const x = 9 + index * 6.4;
    disc(frame, x, groundY + 1, 1.6 + 3.4 * dust, fade([158, 146, 124], 130 * (1 - progress * 0.55)));
  }
  if (crumble > 0) {
    for (const chunk of debris) {
      const y = groundY - 12 * chunk.speed * (1 - crumble) - 4;
      plot(frame, chunk.x, y + 14 * crumble, fade([104, 74, 44], 235 * (1 - crumble)));
    }
  }
  outline(frame, fade([34, 22, 14], 210));
}

export function healBloom(frame, progress, rng) {
  const sparkles = particles(rng, 8, (next) => ({
    x: 10 + next() * 28,
    phase: next() * 0.55,
    size: next() < 0.5 ? 1 : 2,
  }));
  const halo = clamp01(progress / 0.6);
  const decay = decayFrom(progress, 0.55, 0.34);
  const haloY = 30 - 15 * progress;
  ring(frame, CENTER, haloY, 6 + 12 * halo, 2, fade([84, 190, 118], 225 * decay));
  ring(frame, CENTER, haloY, 5 + 11 * halo, 1, fade([176, 244, 196], 240 * decay));
  // 회복은 부드러운 발광이다 — 솝채움과 어리지만 다 동시에 쓰면 고리 새기가 회색 공이 된다(실측).
  for (const sparkle of sparkles) {
    const travel = clamp01(progress + sparkle.phase);
    const y = 43 - 38 * travel;
    const alpha = 250 * (1 - travel * 0.85);
    const color = fade([214, 255, 224], alpha);
    line(frame, sparkle.x - sparkle.size, y, sparkle.x + sparkle.size, y, color);
    line(frame, sparkle.x, y - sparkle.size, sparkle.x, y + sparkle.size, color);
    plot(frame, sparkle.x, y, fade([255, 255, 255], alpha));
  }
}

export function poisonMist(frame, progress, rng) {
  const bubbles = particles(rng, 8, (next) => ({
    x: 9 + next() * 30,
    phase: next() * 0.6,
    radius: 2 + next() * 2.4,
  }));
  const band = clamp01(progress / 0.55);
  const decay = decayFrom(progress, 0.6, 0.34);
  // 안개는 사각 밴드가 아니라 타원 덩어리로 깐다 — 직사각형은 화면에서 버그처럼 보인다(실측).
  const mistCy = 36 - 8 * band;
  const mistRx = 8 + 12 * band;
  const mistRy = 5 + 8 * band;
  for (let y = Math.floor(mistCy - mistRy); y <= Math.ceil(mistCy + mistRy); y += 1) {
    for (let x = Math.floor(CENTER - mistRx); x <= Math.ceil(CENTER + mistRx); x += 1) {
      if ((x + y) % 2 !== 0) continue;
      const nx = (x + 0.5 - CENTER) / mistRx;
      const ny = (y + 0.5 - mistCy) / mistRy;
      const radial = nx * nx + ny * ny;
      if (radial > 1) continue;
      plot(frame, x, y, fade([116, 62, 156], (60 + 110 * (1 - radial)) * decay));
    }
  }
  for (const bubble of bubbles) {
    const travel = clamp01(progress + bubble.phase);
    const y = 42 - 34 * travel;
    const popping = travel > 0.82;
    const alpha = 245 * decay * (popping ? 1 - (travel - 0.82) / 0.18 : 1);
    if (popping) {
      arc(frame, bubble.x, y, bubble.radius + 1, 1.2, 0.4, 2.2, fade([182, 126, 226], alpha));
      arc(frame, bubble.x, y, bubble.radius + 1, 1.2, 3.5, 5.3, fade([182, 126, 226], alpha));
      continue;
    }
    ring(frame, bubble.x, y, bubble.radius, 1.4, fade([148, 92, 198], alpha));
    plot(frame, bubble.x - bubble.radius * 0.4, y - bubble.radius * 0.4, fade([214, 178, 246], alpha));
    disc(frame, bubble.x, y, Math.max(0.6, bubble.radius - 1.6), fade([150, 214, 120], alpha * 0.55));
  }
  outline(frame, fade([44, 20, 62], 140 * decay));
}

export function arcaneNova(frame, progress, rng) {
  const runes = particles(rng, 7, (next) => ({ angle: next() * TAU, radius: 10 + next() * 8 }));
  const decay = decayFrom(progress, 0.5, 0.36);
  const coreRadius = 9 * (1 - progress) + 2.5;
  disc(frame, CENTER, CENTER, coreRadius + 2, fade([48, 62, 152], 230 * decay));
  disc(frame, CENTER, CENTER, coreRadius, fade([104, 138, 246], 245 * decay));
  disc(frame, CENTER, CENTER, coreRadius * 0.55, fade([236, 244, 255], 250 * decay));
  ring(frame, CENTER, CENTER, 4 + 21 * progress, 2.2, fade([132, 172, 252], 235 * (1 - progress * 0.6)));
  ring(frame, CENTER, CENTER, 3 + 13 * progress, 1.4, fade([220, 234, 255], 240 * (1 - progress * 0.55)));
  for (let index = 0; index < 8; index += 1) {
    const angle = (index / 8) * TAU + progress * 0.5;
    const inner = coreRadius + 1;
    const length = 5 + 17 * progress;
    streak(
      frame,
      CENTER + Math.cos(angle) * (inner + length / 2),
      CENTER + Math.sin(angle) * (inner + length / 2),
      angle,
      length / 2,
      1.6,
      fade([158, 190, 255], 230 * decay)
    );
  }
  for (const rune of runes) {
    const angle = rune.angle + progress * 2.4;
    const radius = rune.radius + 9 * progress;
    const x = CENTER + Math.cos(angle) * radius;
    const y = CENTER + Math.sin(angle) * radius;
    plot(frame, x, y, fade([255, 255, 255], 245 * decay));
    plot(frame, x + 1, y, fade([176, 206, 255], 200 * decay));
  }
  outline(frame, fade([22, 26, 76], 190 * decay));
}
