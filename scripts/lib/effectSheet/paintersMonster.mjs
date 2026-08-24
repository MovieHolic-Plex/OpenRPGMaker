// 몬스터 배틀러와 범용 JRPG에서 재사용하는 물리·상태·보조 이펙트 페인터.
// 특정 상용 게임의 기술 모양을 복제하지 않고, 장르 공통 문법만 기하학적으로 표현한다.
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

function sparkle(frame, x, y, radius, color) {
  line(frame, x - radius, y, x + radius, y, color);
  line(frame, x, y - radius, x, y + radius, color);
  plot(frame, x, y, fade([255, 255, 255], color[3]));
}

export function tackleImpact(frame, progress, rng) {
  const debris = particles(rng, 8, (next) => ({ angle: next() * TAU, speed: 0.65 + next() * 0.5 }));
  const approach = clamp01(progress / 0.48);
  const decay = decayFrom(progress, 0.6, 0.34);
  const x = 5 + 19 * approach;
  disc(frame, x, CENTER, 5.5, fade([70, 98, 132], 235 * decay));
  disc(frame, x + 1, CENTER - 1, 3, fade([172, 204, 232], 245 * decay));
  for (let trail = 0; trail < 4; trail += 1) {
    const y = 17 + trail * 5;
    line(frame, Math.max(1, x - 17 - trail * 2), y, x - 6, y, fade([150, 184, 214], 150 * decay));
  }
  if (progress >= 0.35) {
    const burst = clamp01((progress - 0.35) / 0.65);
    ring(frame, CENTER, CENTER, 5 + 21 * burst, 2.4, fade([238, 246, 255], 230 * (1 - burst * 0.68)));
    for (const bit of debris) {
      const distance = 5 + 22 * burst * bit.speed;
      plot(frame, CENTER + Math.cos(bit.angle) * distance, CENTER + Math.sin(bit.angle) * distance, fade([220, 232, 244], 235 * (1 - burst * 0.72)));
    }
  }
  outline(frame, fade([24, 34, 48], 190 * decay));
}

export function clawRake(frame, progress) {
  const grow = clamp01(progress / 0.48);
  const decay = decayFrom(progress, 0.55, 0.34);
  for (let index = 0; index < 3; index += 1) {
    const offset = (index - 1) * 7;
    const cx = CENTER + offset + 3 * progress;
    const cy = CENTER - offset * 0.35;
    streak(frame, cx, cy, -0.82, 5 + 20 * grow, 2.8, fade([128, 28, 38], 230 * decay), 3.5);
    streak(frame, cx, cy, -0.82, 4 + 18 * grow, 1.1, fade([255, 170, 132], 250 * decay), 3.5);
  }
  if (progress > 0.5) ring(frame, CENTER, CENTER, 8 + 18 * (progress - 0.5) * 2, 1.4, fade([255, 212, 176], 170 * decay));
  outline(frame, fade([54, 12, 18], 190 * decay));
}

export function biteCrunch(frame, progress) {
  const close = progress < 0.58 ? clamp01(progress / 0.58) : clamp01(1 - (progress - 0.58) / 0.42) * 0.45 + 0.55;
  const gap = 15 - 12 * close;
  const decay = decayFrom(progress, 0.65, 0.38);
  const jaw = fade([238, 224, 190], 245 * decay);
  const shade = fade([116, 78, 62], 230 * decay);
  arc(frame, CENTER, CENTER - gap, 16, 3.2, 0.2, Math.PI - 0.2, shade);
  arc(frame, CENTER, CENTER - gap, 14.5, 1.6, 0.25, Math.PI - 0.25, jaw);
  arc(frame, CENTER, CENTER + gap, 16, 3.2, Math.PI + 0.2, TAU - 0.2, shade);
  arc(frame, CENTER, CENTER + gap, 14.5, 1.6, Math.PI + 0.25, TAU - 0.25, jaw);
  for (const x of [14, 20, 28, 34]) {
    line(frame, x, CENTER - gap + 4, x + (x < CENTER ? 2 : -2), CENTER - gap + 10, jaw, 2);
    line(frame, x, CENTER + gap - 4, x + (x < CENTER ? 2 : -2), CENTER + gap - 10, jaw, 2);
  }
  if (progress > 0.48) disc(frame, CENTER, CENTER, 2 + 6 * (1 - progress), fade([255, 250, 222], 220 * decay));
  outline(frame, fade([46, 24, 20], 200 * decay));
}

export function projectileShot(frame, progress, rng) {
  const sparks = particles(rng, 6, (next) => ({ angle: next() * TAU, speed: 0.7 + next() * 0.5 }));
  const travel = clamp01(progress / 0.7);
  const x = 4 + 40 * travel;
  const y = CENTER + Math.sin(travel * Math.PI) * -5;
  streak(frame, x - 8, y, 0, 10, 2.5, fade([54, 92, 188], 210), 0);
  disc(frame, x, y, 4, fade([86, 156, 246], 245));
  disc(frame, x + 1, y - 1, 1.8, [240, 250, 255, 255]);
  if (progress >= 0.62) {
    const impact = clamp01((progress - 0.62) / 0.38);
    ring(frame, 42, y, 4 + 15 * impact, 2, fade([154, 210, 255], 230 * (1 - impact * 0.7)));
    for (const spark of sparks) {
      const distance = 4 + 15 * impact * spark.speed;
      plot(frame, 42 + Math.cos(spark.angle) * distance, y + Math.sin(spark.angle) * distance, fade([220, 242, 255], 230 * (1 - impact * 0.72)));
    }
  }
  outline(frame, fade([20, 34, 82], 180));
}

export function leafVolley(frame, progress, rng) {
  const leaves = particles(rng, 9, (next, index) => ({
    phase: index / 9 + next() * 0.1,
    bend: (next() - 0.5) * 8,
    size: 2.5 + next() * 2.2,
  }));
  const decay = decayFrom(progress, 0.7, 0.34);
  for (const leaf of leaves) {
    const local = clamp01(progress * 1.35 - leaf.phase * 0.38);
    const x = 2 + 45 * local;
    const y = 35 - 19 * local + Math.sin(local * Math.PI * 2 + leaf.phase * 8) * leaf.bend;
    const angle = -0.45 + Math.sin(local * 5 + leaf.phase) * 0.7;
    streak(frame, x, y, angle, leaf.size, 1.8, fade([50, 124, 58], 235 * decay), 1.5);
    streak(frame, x, y, angle, leaf.size * 0.72, 0.7, fade([178, 232, 120], 240 * decay), 1.5);
  }
  outline(frame, fade([22, 58, 28], 175 * decay));
}

export function psychicWave(frame, progress, rng) {
  const nodes = particles(rng, 6, (next) => ({ angle: next() * TAU, radius: 8 + next() * 7 }));
  const decay = decayFrom(progress, 0.55, 0.38);
  disc(frame, CENTER, CENTER, 7 - 3 * progress, fade([120, 62, 186], 230 * decay));
  for (let index = 0; index < 3; index += 1) {
    const radius = 5 + index * 6 + 15 * progress;
    ring(frame, CENTER, CENTER, radius, 1.8, fade(index % 2 === 0 ? [224, 154, 255] : [102, 214, 238], (235 - index * 24) * decay));
  }
  for (const node of nodes) {
    const angle = node.angle + progress * 3.4;
    const radius = node.radius + progress * 9;
    disc(frame, CENTER + Math.cos(angle) * radius, CENTER + Math.sin(angle) * radius * 0.7, 1.6, fade([246, 220, 255], 230 * decay));
  }
  outline(frame, fade([42, 18, 74], 170 * decay));
}

export function shadowPulse(frame, progress, rng) {
  const wisps = particles(rng, 7, (next) => ({ angle: next() * TAU, curl: 0.5 + next() * 0.8 }));
  const decay = decayFrom(progress, 0.62, 0.42);
  const core = 4 + 8 * clamp01(progress / 0.45);
  disc(frame, CENTER, CENTER, core + 2, fade([34, 18, 58], 235 * decay));
  disc(frame, CENTER, CENTER, core * 0.65, fade([104, 42, 142], 220 * decay));
  ring(frame, CENTER, CENTER, 7 + 20 * progress, 2.2, fade([142, 68, 184], 210 * decay));
  for (const wisp of wisps) {
    const radius = core + 5 + progress * 14 * wisp.curl;
    const angle = wisp.angle - progress * 2.2;
    arc(frame, CENTER, CENTER, radius, 1.6, angle, angle + 0.6, fade([88, 52, 128], 210 * decay));
  }
  outline(frame, fade([12, 8, 24], 210 * decay));
}

export function holyBeam(frame, progress, rng) {
  const motes = particles(rng, 8, (next) => ({ x: 10 + next() * 28, phase: next() * 0.5 }));
  const reveal = clamp01(progress / 0.5);
  const decay = decayFrom(progress, 0.68, 0.38);
  const top = 2;
  const bottom = top + 42 * reveal;
  line(frame, CENTER, top, CENTER, bottom, fade([252, 238, 164], 180 * decay), 9);
  line(frame, CENTER, top, CENTER, bottom, fade([255, 252, 224], 245 * decay), 4);
  ring(frame, CENTER, 38, 5 + 16 * clamp01((progress - 0.3) / 0.7), 2, fade([250, 224, 126], 220 * decay));
  for (const mote of motes) {
    const local = clamp01(progress + mote.phase);
    sparkle(frame, mote.x, 44 - 38 * local, 1 + (mote.x % 2), fade([255, 246, 190], 220 * (1 - local * 0.7)));
  }
  outline(frame, fade([92, 70, 26], 150 * decay));
}

export function sleepDust(frame, progress, rng) {
  const motes = particles(rng, 11, (next) => ({ x: 7 + next() * 34, phase: next() * 0.7, size: next() < 0.75 ? 1 : 2 }));
  const decay = decayFrom(progress, 0.7, 0.4);
  for (const mote of motes) {
    const local = clamp01(progress + mote.phase);
    const y = 43 - 36 * local;
    const x = mote.x + Math.sin(local * 6 + mote.phase * 4) * 4;
    disc(frame, x, y, mote.size, fade([166, 138, 224], 220 * decay * (1 - local * 0.55)));
  }
  const crescentY = 28 - 10 * progress;
  arc(frame, CENTER, crescentY, 8 + 3 * progress, 2.2, 0.35, Math.PI * 1.65, fade([218, 204, 250], 230 * decay));
  sparkle(frame, CENTER + 10, crescentY - 7, 2, fade([244, 238, 255], 220 * decay));
  outline(frame, fade([48, 34, 82], 140 * decay));
}

export function powerAura(frame, progress, rng) {
  const tongues = particles(rng, 8, (next, index) => ({ x: 9 + index * 4.2, height: 9 + next() * 14, phase: next() * 0.3 }));
  const rise = clamp01(progress / 0.5);
  const decay = decayFrom(progress, 0.72, 0.38);
  ring(frame, CENTER, 42, 5 + 16 * rise, 2, fade([250, 186, 68], 220 * decay));
  for (const tongue of tongues) {
    const local = clamp01(progress + tongue.phase);
    const height = tongue.height * (0.45 + 0.55 * rise);
    streak(frame, tongue.x, 42 - height / 2 - local * 4, -Math.PI / 2, height / 2, 2, fade([214, 82, 42], 210 * decay), 2);
    streak(frame, tongue.x, 42 - height / 2 - local * 4, -Math.PI / 2, height / 2.4, 0.8, fade([255, 222, 112], 235 * decay), 2);
  }
  sparkle(frame, CENTER, 19 - 4 * progress, 3, fade([255, 248, 204], 240 * decay));
  outline(frame, fade([78, 28, 18], 170 * decay));
}

export function guardBarrier(frame, progress, rng) {
  const glints = particles(rng, 5, (next) => ({ angle: next() * TAU, phase: next() * 0.4 }));
  const grow = clamp01(progress / 0.48);
  const decay = decayFrom(progress, 0.72, 0.48);
  const radius = 5 + 16 * grow;
  polygon(frame, CENTER, CENTER, radius, 6, -Math.PI / 2, fade([42, 102, 174], 240 * decay), 4);
  polygon(frame, CENTER, CENTER, radius - 3, 6, -Math.PI / 2, fade([144, 218, 250], 245 * decay), 1.5);
  disc(frame, CENTER, CENTER, 3 + 3 * grow, fade([224, 250, 255], 150 * decay));
  for (const glint of glints) {
    const angle = glint.angle + progress * 1.4;
    const r = radius + 3 + glint.phase * 5;
    sparkle(frame, CENTER + Math.cos(angle) * r, CENTER + Math.sin(angle) * r, 1.5, fade([224, 248, 255], 210 * decay));
  }
  outline(frame, fade([18, 48, 84], 175 * decay));
}

export function captureSeal(frame, progress, rng) {
  const motes = particles(rng, 10, (next) => ({ angle: next() * TAU, radius: 17 + next() * 10 }));
  const locking = progress < 0.62;
  const phase = locking ? progress / 0.62 : (progress - 0.62) / 0.38;
  const decay = locking ? 1 : 1 - phase * 0.58;
  const outer = locking ? 28 - 12 * phase : 16 + 8 * phase;
  ring(frame, CENTER, CENTER, outer, 2.2, fade([238, 214, 112], 235 * decay));
  polygon(frame, CENTER, CENTER, Math.max(6, outer - 5), 8, progress * 1.2, fade([120, 202, 232], 225 * decay), 1.6);
  ring(frame, CENTER, CENTER, 5 + 3 * (locking ? phase : 1 - phase), 2, fade([252, 248, 218], 245 * decay));
  line(frame, CENTER - 6, CENTER, CENTER + 6, CENTER, fade([255, 255, 238], 240 * decay), 2);
  line(frame, CENTER, CENTER - 6, CENTER, CENTER + 6, fade([255, 255, 238], 240 * decay), 2);
  for (const mote of motes) {
    const radius = locking ? mote.radius * (1 - 0.55 * phase) : outer + phase * 7;
    plot(frame, CENTER + Math.cos(mote.angle + progress) * radius, CENTER + Math.sin(mote.angle + progress) * radius, fade([250, 238, 168], 225 * decay));
  }
  outline(frame, fade([46, 54, 70], 170 * decay));
}
