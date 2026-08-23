// 물리·원소 타격계 이펙트 페인터. painter(frame, progress, rng) 규약:
//   progress 는 0(첫 프레임)~1(마지막 프레임), rng 는 프레임마다 같은 시드로 새로 만든다.
// 그래서 같은 파티클이 프레임을 넘어 "같은 파티클로" 움직인다 — 프레임마다 재추첨하면
// 스트립이 튄다(실측: 시드를 프레임에 섞었을 때 불꽃이 매 컷 다른 곳에서 튀었다).
import { disc, fade, line, outline, plot, ring, spike, streak } from "./canvas.mjs";

const CENTER = 24;
const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

// 소멸 곡선. 마지막 프레임을 0 으로 떨어뜨리면 프레임 한 장이 통째로 빈 컷이 된다
// (실측: 5프레임 중 5번째가 완전 투명이라 재생이 4프레임처럼 보였다). floor 만큼은 남긴다.
function decayFrom(progress, start, floor = 0.3) {
  if (progress <= start) return 1;
  return floor + (1 - floor) * clamp01(1 - (progress - start) / (1 - start));
}

/** 파티클 파라미터를 프레임 시작에 한 번에 뽑는다 — 분기 안에서 뽑으면 시퀀스가 밀린다. */
function particles(rng, count, make) {
  const list = [];
  for (let index = 0; index < count; index += 1) list.push(make(rng, index));
  return list;
}

export function slashSteel(frame, progress, rng) {
  const sparks = particles(rng, 9, (next) => ({ angle: next() * TAU, speed: 0.6 + next() * 0.6 }));
  const grow = clamp01(progress / 0.4);
  const decay = decayFrom(progress, 0.5);
  drawSlash(frame, -0.62, 12 + 17 * grow, 2 + 2.5 * grow, decay);
  if (progress >= 0.25) {
    const second = clamp01((progress - 0.25) / 0.4);
    drawSlash(frame, 0.74, 11 + 16 * second, 1.5 + 2 * second, decay);
  }
  if (progress > 0.45) {
    const travel = (progress - 0.45) / 0.55;
    for (const spark of sparks) {
      const distance = 6 + 26 * travel * spark.speed;
      plot(
        frame,
        CENTER + Math.cos(spark.angle) * distance,
        CENTER + Math.sin(spark.angle) * distance,
        fade([255, 255, 255], 240 * (1 - travel))
      );
    }
  }
  outline(frame, fade([28, 34, 50], 190 * decay));
}

function drawSlash(frame, angle, length, thickness, decay) {
  streak(frame, CENTER, CENTER, angle, length, thickness, fade([96, 118, 150], 210 * decay), 4);
  streak(frame, CENTER, CENTER, angle, length * 0.94, thickness * 0.55, fade([205, 224, 245], 240 * decay), 4);
  streak(frame, CENTER, CENTER, angle, length * 0.82, Math.max(0.5, thickness * 0.24), fade([255, 255, 255], 255 * decay), 4);
}

export function fireBurst(frame, progress, rng) {
  const tongues = particles(rng, 7, (next, index) => ({
    angle: -Math.PI * 0.88 + (index / 6) * Math.PI * 0.76 + (next() - 0.5) * 0.24,
    power: 0.65 + next() * 0.5,
  }));
  const embers = particles(rng, 8, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.7 }));
  const grow = clamp01(progress / 0.5);
  const decay = decayFrom(progress, 0.6, 0.34);
  const cy = 27 - 7 * progress;
  const radius = 7 + 10 * grow;
  disc(frame, CENTER, cy, radius, fade([124, 26, 20], 235 * decay));
  disc(frame, CENTER, cy, radius * 0.72, fade([222, 66, 32], 245 * decay));
  disc(frame, CENTER, cy, radius * 0.45, fade([248, 148, 48], 250 * decay));
  disc(frame, CENTER, cy - 1, radius * 0.22, fade([255, 226, 120], 255 * decay));
  for (const tongue of tongues) {
    const length = (5 + 13 * grow) * tongue.power;
    const tipX = CENTER + Math.cos(tongue.angle) * length;
    const tipY = cy + Math.sin(tongue.angle) * length;
    streak(frame, (CENTER + tipX) / 2, (cy + tipY) / 2, tongue.angle, length / 2, 2.2, fade([232, 92, 34], 230 * decay));
    streak(frame, (CENTER + tipX) / 2, (cy + tipY) / 2, tongue.angle, length / 2.4, 1, fade([255, 200, 96], 240 * decay));
  }
  if (progress > 0.55) {
    const travel = (progress - 0.55) / 0.45;
    for (const ember of embers) {
      const distance = radius * 0.8 + 20 * travel * ember.speed;
      plot(
        frame,
        CENTER + Math.cos(ember.angle) * distance,
        cy + Math.sin(ember.angle) * distance * 0.8,
        fade([255, 190, 90], 235 * (1 - travel))
      );
    }
    disc(frame, CENTER, cy - radius - 3 * travel, 3 + 4 * travel, fade([74, 66, 72], 120 * (1 - travel)));
  }
  outline(frame, fade([48, 12, 10], 200 * decay));
}

export function iceShatter(frame, progress, rng) {
  const shards = particles(rng, 6, (next, index) => ({
    angle: (index / 6) * TAU + (next() - 0.5) * 0.3,
    length: 6 + next() * 4,
    spin: (next() - 0.5) * 1.2,
  }));
  const converging = progress < 0.5;
  const phase = converging ? progress / 0.5 : (progress - 0.5) / 0.5;
  for (const shard of shards) {
    const distance = converging ? 22 - 15 * phase : 7 + 24 * phase;
    const alpha = converging ? 200 + 55 * phase : 255 * (1 - phase * 0.65);
    const angle = shard.angle + shard.spin * phase * (converging ? 0.4 : 1);
    const x = CENTER + Math.cos(angle) * distance;
    const y = CENTER + Math.sin(angle) * distance;
    streak(frame, x, y, angle, shard.length, 2.4, fade([58, 116, 176], alpha));
    streak(frame, x, y, angle, shard.length * 0.8, 1.2, fade([150, 214, 246], alpha));
    plot(frame, x, y, fade([238, 250, 255], alpha));
  }
  if (!converging) {
    const burst = 4 + 26 * phase;
    ring(frame, CENTER, CENTER, burst, 2, fade([176, 226, 250], 230 * (1 - phase * 0.7)));
    ring(frame, CENTER, CENTER, burst * 0.6, 1.5, fade([250, 254, 255], 220 * (1 - phase * 0.7)));
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * TAU + 0.3;
      const inner = burst * 0.35;
      const outer = burst * 0.95;
      line(
        frame,
        CENTER + Math.cos(angle) * inner,
        CENTER + Math.sin(angle) * inner,
        CENTER + Math.cos(angle) * outer,
        CENTER + Math.sin(angle) * outer,
        fade([222, 244, 255], 200 * (1 - phase * 0.7))
      );
    }
  }
  outline(frame, fade([22, 48, 84], converging ? 190 : 190 * (1 - phase * 0.7)));
}

export function thunderStrike(frame, progress, rng) {
  const zigzag = particles(rng, 13, (next) => ({ offset: (next() - 0.5) * 9 }));
  const sparks = particles(rng, 8, (next) => ({ angle: next() * TAU, speed: 0.5 + next() * 0.7 }));
  const reveal = clamp01(0.35 + progress * 2.2);
  const decay = decayFrom(progress, 0.35, 0.32);
  const impactY = 40;
  const segments = zigzag.length - 1;
  const visible = Math.max(1, Math.round(segments * reveal));
  for (let index = 0; index < visible; index += 1) {
    const y0 = (impactY * index) / segments;
    const y1 = (impactY * (index + 1)) / segments;
    const x0 = CENTER + zigzag[index].offset;
    const x1 = CENTER + zigzag[index + 1].offset;
    line(frame, x0, y0, x1, y1, fade([120, 96, 220], 210 * decay), 5);
    line(frame, x0, y0, x1, y1, fade([255, 238, 150], 240 * decay), 3);
    line(frame, x0, y0, x1, y1, fade([255, 255, 255], 255 * decay), 1);
  }
  if (progress >= 0.25) {
    const branchFrom = Math.floor(segments * 0.55);
    const base = zigzag[branchFrom];
    line(
      frame,
      CENTER + base.offset,
      (impactY * branchFrom) / segments,
      CENTER + base.offset - 11,
      (impactY * branchFrom) / segments + 9,
      fade([255, 236, 150], 220 * decay),
      2
    );
  }
  if (reveal >= 1) {
    const shock = clamp01((progress - 0.2) / 0.8);
    disc(frame, CENTER + zigzag[segments].offset, impactY, 7 * (1 - shock) + 2, fade([255, 252, 210], 250 * decay));
    ring(frame, CENTER, impactY, 6 + 20 * shock, 2, fade([255, 240, 160], 200 * (1 - shock * 0.7)));
    for (const spark of sparks) {
      const distance = 6 + 22 * shock * spark.speed;
      plot(
        frame,
        CENTER + Math.cos(spark.angle) * distance,
        impactY + Math.sin(spark.angle) * distance * 0.5,
        fade([255, 246, 190], 240 * (1 - shock))
      );
    }
  }
  outline(frame, fade([44, 32, 86], 190 * decay));
}

export function waterColumn(frame, progress, rng) {
  const droplets = particles(rng, 10, (next) => ({
    vx: (next() - 0.5) * 2.2,
    vy: 0.7 + next() * 0.8,
  }));
  const rise = clamp01(progress / 0.5);
  const collapse = progress <= 0.6 ? 0 : (progress - 0.6) / 0.4;
  const height = 40 * rise * (1 - 0.65 * collapse);
  const halfWidth = 7 - 2 * collapse;
  const groundY = 44;
  spike(frame, CENTER, groundY, height, halfWidth, fade([36, 86, 164], 245));
  spike(frame, CENTER, groundY, height * 0.94, halfWidth * 0.6, fade([76, 148, 228], 250));
  spike(frame, CENTER - 1, groundY, height * 0.82, halfWidth * 0.28, fade([152, 212, 248], 250));
  const crestY = groundY - height;
  disc(frame, CENTER, crestY + 1, 3 + 2 * rise, fade([228, 246, 255], 235));
  if (progress > 0.3) {
    const travel = (progress - 0.3) / 0.7;
    for (const droplet of droplets) {
      const x = CENTER + droplet.vx * travel * 22;
      const y = crestY - droplet.vy * travel * 26 + 34 * travel * travel;
      disc(frame, x, y, 1.4, fade([196, 232, 252], 240 * (1 - travel * 0.7)));
    }
  }
  ring(frame, CENTER, groundY, 6 + 14 * clamp01(progress / 0.8), 1.5, fade([170, 220, 250], 170 * (1 - progress * 0.7)));
  outline(frame, fade([16, 44, 92], 200));
}
