// 전투 이펙트 프레임을 그리는 픽셀 프리미티브.
//
// 48x48 논리 격자에 그린 뒤 2배로 확대해 스트립을 만든다(프레임 96x96). 확대는 최근접
// 복제라서 픽셀이 굵게 남는다 — RM2K3 이펙트의 질감이 이 굵기에서 나온다.
// 모든 좌표는 논리 픽셀 정수 단위이고, 부동소수 좌표는 내부에서 내림한다.

export const LOGICAL_SIZE = 48;
export const SCALE = 2;

/** @typedef {[number, number, number, number]} Rgba */

export function createFrame() {
  return new Uint8Array(LOGICAL_SIZE * LOGICAL_SIZE * 4);
}

/** 알파 오버 합성. 같은 좌표를 여러 번 찍어도 밝은 층이 아래를 완전히 지우지 않는다. */
export function plot(frame, x, y, color) {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= LOGICAL_SIZE || py >= LOGICAL_SIZE) return;
  const alpha = color[3];
  if (alpha <= 0) return;
  const index = (py * LOGICAL_SIZE + px) * 4;
  if (alpha >= 255) {
    frame[index] = color[0];
    frame[index + 1] = color[1];
    frame[index + 2] = color[2];
    frame[index + 3] = 255;
    return;
  }
  const srcWeight = alpha / 255;
  const dstAlpha = frame[index + 3] / 255;
  const outAlpha = srcWeight + dstAlpha * (1 - srcWeight);
  if (outAlpha <= 0) return;
  for (let channel = 0; channel < 3; channel += 1) {
    const src = color[channel] * srcWeight;
    const dst = frame[index + channel] * dstAlpha * (1 - srcWeight);
    frame[index + channel] = Math.round((src + dst) / outAlpha);
  }
  frame[index + 3] = Math.round(outAlpha * 255);
}

export function disc(frame, cx, cy, radius, color) {
  if (radius <= 0) return;
  const limit = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= limit) plot(frame, x, y, color);
    }
  }
}

export function ring(frame, cx, cy, radius, thickness, color) {
  const outer = radius * radius;
  const innerRadius = Math.max(0, radius - thickness);
  const inner = innerRadius * innerRadius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y += 1) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x += 1) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const distance = dx * dx + dy * dy;
      if (distance <= outer && distance >= inner) plot(frame, x, y, color);
    }
  }
}

/** 각도 구간만 남긴 호 — 초승달 참격에 쓴다. 각도는 라디안, y 는 아래로 증가. */
export function arc(frame, cx, cy, radius, thickness, startAngle, endAngle, color) {
  const steps = Math.max(8, Math.ceil(radius * (endAngle - startAngle) * 2));
  for (let step = 0; step <= steps; step += 1) {
    const angle = startAngle + ((endAngle - startAngle) * step) / steps;
    for (let depth = 0; depth < thickness; depth += 0.5) {
      const r = radius - depth;
      plot(frame, cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, color);
    }
  }
}

export function line(frame, x0, y0, x1, y1, color, thickness = 1) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  const half = (thickness - 1) / 2;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    for (let oy = -half; oy <= half; oy += 1) {
      for (let ox = -half; ox <= half; ox += 1) plot(frame, x + ox, y + oy, color);
    }
  }
}

/** 가운데가 굵고 양끝이 뾰족한 렌즈 모양 — 참격·칼바람의 기본 형태. */
export function streak(frame, cx, cy, angle, length, halfThickness, color, curve = 0) {
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);
  const steps = Math.max(8, Math.ceil(length * 2));
  for (let step = 0; step <= steps; step += 1) {
    const s = (step / steps) * 2 - 1;
    const taper = Math.sqrt(Math.max(0, 1 - s * s));
    const bend = curve * (1 - s * s);
    const baseX = cx + dirX * s * length - dirY * bend;
    const baseY = cy + dirY * s * length + dirX * bend;
    const spread = halfThickness * taper;
    for (let offset = -spread; offset <= spread; offset += 0.5) {
      plot(frame, baseX - dirY * offset, baseY + dirX * offset, color);
    }
  }
}

/** 바닥에서 솟는 뾰족한 기둥(암석 창·물기둥). baseY 에서 위로 height 만큼. */
export function spike(frame, baseX, baseY, height, halfWidth, color) {
  for (let step = 0; step <= height; step += 1) {
    const t = step / Math.max(1, height);
    const width = halfWidth * (1 - t);
    for (let offset = -width; offset <= width; offset += 0.5) {
      plot(frame, baseX + offset, baseY - step, color);
    }
  }
}

/** 불투명 영역 바깥 1픽셀에 어두운 외곽선 — 배경 위에서 실루엣이 죽지 않게. */
export function outline(frame, color) {
  const opaque = new Uint8Array(LOGICAL_SIZE * LOGICAL_SIZE);
  for (let index = 0; index < opaque.length; index += 1) {
    opaque[index] = frame[index * 4 + 3] > 40 ? 1 : 0;
  }
  for (let y = 0; y < LOGICAL_SIZE; y += 1) {
    for (let x = 0; x < LOGICAL_SIZE; x += 1) {
      if (opaque[y * LOGICAL_SIZE + x] === 1) continue;
      const touching =
        (x > 0 && opaque[y * LOGICAL_SIZE + x - 1] === 1) ||
        (x < LOGICAL_SIZE - 1 && opaque[y * LOGICAL_SIZE + x + 1] === 1) ||
        (y > 0 && opaque[(y - 1) * LOGICAL_SIZE + x] === 1) ||
        (y < LOGICAL_SIZE - 1 && opaque[(y + 1) * LOGICAL_SIZE + x] === 1);
      if (touching) plot(frame, x, y, color);
    }
  }
}

/** 논리 프레임들을 2배 확대해 가로 스트립 RGBA 버퍼로 합친다. */
export function toStrip(frames) {
  const frameSize = LOGICAL_SIZE * SCALE;
  const width = frameSize * frames.length;
  const strip = new Uint8Array(width * frameSize * 4);
  frames.forEach((frame, frameIndex) => {
    const originX = frameIndex * frameSize;
    for (let y = 0; y < LOGICAL_SIZE; y += 1) {
      for (let x = 0; x < LOGICAL_SIZE; x += 1) {
        const source = (y * LOGICAL_SIZE + x) * 4;
        for (let dy = 0; dy < SCALE; dy += 1) {
          for (let dx = 0; dx < SCALE; dx += 1) {
            const target = ((y * SCALE + dy) * width + originX + x * SCALE + dx) * 4;
            strip[target] = frame[source];
            strip[target + 1] = frame[source + 1];
            strip[target + 2] = frame[source + 2];
            strip[target + 3] = frame[source + 3];
          }
        }
      }
    }
  });
  return { width, height: frameSize, data: strip };
}

/** 고정 시드 PRNG — 같은 slug 는 항상 같은 파티클 배치를 낸다(재현성 게이트가 이걸 본다). */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function slugSeed(slug) {
  let hash = 0x811c9dc5;
  for (const char of slug) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function fade(color, alpha) {
  return [color[0], color[1], color[2], Math.max(0, Math.min(255, Math.round(alpha)))];
}
