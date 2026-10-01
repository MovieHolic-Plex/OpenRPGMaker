/** 번들 스프라이트 자동 검사. 사람 눈 검수(닮은꼴·자세)를 대신하지 않는다 — 기계로 잡을 수 있는 결함만. */
import { isOpaque, opaqueBounds, pixelAt, rgbKey, type Rgba, type RgbaImage } from "../pixel/image";
import { isMagentaCast, labDistance, oklabCached } from "../pixel/oklab";
import { SPRITE_CANVAS } from "../pixel/fit";

export type CheckIssue = { level: "error" | "warn"; message: string };

export type SpriteStats = {
  colors: number;
  ink: { width: number; height: number };
  /** 4방향 같은 색 이웃이 없는 점의 비율 */
  orphanRatio: number;
  /** 실루엣 가장자리 칸 중 어두운 선(L<0.35) 비율 */
  outlineRatio: number;
  magentaPixels: number;
};

const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

export function spriteStats(image: RgbaImage): SpriteStats {
  const colors = new Set<number>();
  let opaque = 0;
  let orphans = 0;
  let edges = 0;
  let darkEdges = 0;
  let magentaPixels = 0;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      opaque += 1;
      const p = pixelAt(image, x, y);
      colors.add(rgbKey(p[0], p[1], p[2]));
      const lab = oklabCached(p[0], p[1], p[2]);
      if (isMagentaCast(lab)) magentaPixels += 1;
      let same = false;
      let edge = false;
      for (const [ox, oy] of NEIGHBORS) {
        const nx = x + ox;
        const ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= image.width || ny >= image.height || !isOpaque(image, nx, ny)) {
          edge = true;
          continue;
        }
        const n = pixelAt(image, nx, ny);
        if (n[0] === p[0] && n[1] === p[1] && n[2] === p[2]) same = true;
      }
      if (!same) orphans += 1;
      if (edge) {
        edges += 1;
        if (lab[0] < 0.35) darkEdges += 1;
      }
    }
  }
  const box = opaqueBounds(image);
  return {
    colors: colors.size,
    ink: { width: box?.width ?? 0, height: box?.height ?? 0 },
    orphanRatio: opaque === 0 ? 0 : orphans / opaque,
    outlineRatio: edges === 0 ? 0 : darkEdges / edges,
    magentaPixels,
  };
}

export function checkSprite(image: RgbaImage, maxColors: number): { stats: SpriteStats; issues: CheckIssue[] } {
  const stats = spriteStats(image);
  const issues: CheckIssue[] = [];
  if (image.width !== SPRITE_CANVAS || image.height !== SPRITE_CANVAS) issues.push({ level: "error", message: `캔버스가 ${SPRITE_CANVAS}x${SPRITE_CANVAS} 가 아니다 (${image.width}x${image.height})` });
  if (stats.ink.width === 0) issues.push({ level: "error", message: "그림이 비었다" });
  const box = opaqueBounds(image);
  if (box && box.y + box.height !== image.height) issues.push({ level: "error", message: "바닥 정렬이 아니다 (발이 캔버스 바닥에 닿아야 한다)" });
  if (stats.colors > maxColors) issues.push({ level: "error", message: `색 ${stats.colors}개 > ${maxColors}` });
  if (stats.magentaPixels > 0) issues.push({ level: "error", message: `마젠타 기운 점 ${stats.magentaPixels}개` });
  if (stats.outlineRatio < 0.85) issues.push({ level: "warn", message: `윤곽이 약하다 (가장자리 어두운 칸 ${(stats.outlineRatio * 100).toFixed(0)}%)` });
  if (stats.orphanRatio > 0.12) issues.push({ level: "warn", message: `외톨이 점 ${(stats.orphanRatio * 100).toFixed(1)}% — 색이 잘게 갈라졌다` });
  if (Math.sqrt(stats.ink.width * stats.ink.height) < 55) issues.push({ level: "warn", message: `몸집이 작다 (${stats.ink.width}x${stats.ink.height})` });
  return { stats, issues };
}

function palette(image: RgbaImage): Rgba[] {
  const seen = new Map<number, Rgba>();
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      const p = pixelAt(image, x, y);
      seen.set(rgbKey(p[0], p[1], p[2]), p);
    }
  }
  return [...seen.values()];
}

/** 뒷모습 색이 앞모습 팔레트에서 얼마나 먼가 — 평균 최근접 거리. 다른 종처럼 보이는 뒷모습을 잡는다. */
export function paletteDrift(front: RgbaImage, back: RgbaImage): number {
  const frontLabs = palette(front).map((p) => oklabCached(p[0], p[1], p[2]));
  const backColors = palette(back);
  if (frontLabs.length === 0 || backColors.length === 0) return Infinity;
  let sum = 0;
  for (const p of backColors) {
    const lab = oklabCached(p[0], p[1], p[2]);
    sum += Math.min(...frontLabs.map((f) => labDistance(f, lab)));
  }
  return sum / backColors.length;
}

export function checkPair(front: RgbaImage, back: RgbaImage): CheckIssue[] {
  const drift = paletteDrift(front, back);
  return drift > 0.06 ? [{ level: "warn", message: `앞·뒤 색이 다르다 (팔레트 거리 ${drift.toFixed(3)} > 0.06)` }] : [];
}

/**
 * 애니메이션 프레임 검사. 대기(kind idle)는 0번이 스프라이트와 같고 발 줄이 움직이지 않아야 한다.
 * 큰 동작(kind action)은 다시 생성한 그림이라 같을 수 없다 — 색이 기준과 가까운지, 몸집이 줄지 않았는지만 본다.
 */
export function checkFrames(frames: RgbaImage[], base: RgbaImage, maxColors: number, kind: "idle" | "action"): CheckIssue[] {
  const issues: CheckIssue[] = [];
  const baseStats = spriteStats(base);
  const baseBody = Math.sqrt(baseStats.ink.width * baseStats.ink.height);
  frames.forEach((frame, k) => {
    const label = `프레임 ${k}`;
    if (frame.width !== SPRITE_CANVAS || frame.height !== SPRITE_CANVAS) issues.push({ level: "error", message: `${label}: 캔버스가 ${SPRITE_CANVAS}x${SPRITE_CANVAS} 가 아니다` });
    const stats = spriteStats(frame);
    if (stats.ink.width === 0) issues.push({ level: "error", message: `${label}: 비었다` });
    if (stats.colors > maxColors) issues.push({ level: "error", message: `${label}: 색 ${stats.colors}개 > ${maxColors}` });
    if (stats.magentaPixels > 0) issues.push({ level: "error", message: `${label}: 마젠타 기운 점 ${stats.magentaPixels}개` });
    if (kind === "action") {
      const body = Math.sqrt(stats.ink.width * stats.ink.height);
      if (k === 0 && body < baseBody * 0.85) issues.push({ level: "warn", message: `${label}: 기준 스프라이트보다 작다 (몸집 ${body.toFixed(0)} < ${baseBody.toFixed(0)}의 85%) — 대기에서 넘어갈 때 크기가 튄다` });
      const drift = paletteDrift(base, frame);
      if (drift > 0.06) issues.push({ level: "warn", message: `${label}: 기준과 색이 다르다 (팔레트 거리 ${drift.toFixed(3)})` });
    }
  });
  if (kind === "idle") {
    const first = frames[0];
    if (!first || !first.data.every((v, i) => v === base.data[i])) issues.push({ level: "error", message: "대기 0번 프레임이 스프라이트와 다르다" });
    const box = opaqueBounds(base);
    if (box) {
      const y = box.y + box.height - 1;
      frames.forEach((frame, k) => {
        for (let x = 0; x < base.width; x += 1) {
          const a = pixelAt(base, x, y);
          const b = pixelAt(frame, x, y);
          if (a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) {
            issues.push({ level: "error", message: `대기 프레임 ${k}: 발(맨 아래 줄)이 움직였다` });
            return;
          }
        }
      });
    }
  }
  return issues;
}
