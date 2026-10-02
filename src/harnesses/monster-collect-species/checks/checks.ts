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

/**
 * 윗몸(잉크 상자 위 절반)의 앞 끝 x — dir>0 이면 가장 오른쪽, dir<0 이면 가장 왼쪽 칸.
 * 무게중심으로 재면 큰 꼬리·잎 귀가 반대로 휘두르는 종(리프링)에서 머리가 덤벼도 −9칸이 나왔다(2026-10-01).
 * 공격은 머리·앞발 끝이 앞으로 나가는 것이라 앞 끝을 잰다. 발은 0번에 맞춰 두므로 몸 전체 이동은 섞이지 않는다.
 */
function leadingEdgeX(image: RgbaImage, dir: number): number | null {
  const box = opaqueBounds(image);
  if (!box) return null;
  let edge: number | null = null;
  for (let y = box.y; y < box.y + Math.ceil(box.height / 2); y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      if (!isOpaque(image, x, y)) continue;
      if (edge === null || (dir > 0 ? x > edge : x < edge)) edge = x;
    }
  }
  return edge;
}

/**
 * 방향 검사: 공격 자세는 어느 프레임이든 윗몸 앞 끝이 0번보다 공격 방향으로 minShift 칸 이상 나가야 하고,
 * 피격은 공격자 쪽 앞 끝이 반대로 물러나야 한다. 반대로 덤비는 후보를 사람이 보기 전에 거른다. 가장 많이 간 칸 수를 돌려준다.
 * sign: 움직임을 기대하는 가로 부호. edgeSide: 앞 끝을 재는 쪽 (공격은 sign 과 같다. 피격은 공격자 쪽 끝을 재고 sign 은 그 반대)
 */
export function directionShift(frames: RgbaImage[], sign: number, edgeSide = sign): number {
  const base = leadingEdgeX(frames[0]!, edgeSide);
  if (base === null) return 0;
  let best = -Infinity;
  for (const frame of frames.slice(1)) {
    const e = leadingEdgeX(frame, edgeSide);
    if (e !== null) best = Math.max(best, (e - base) * Math.sign(sign));
  }
  return best === -Infinity ? 0 : best;
}

export function checkDirection(frames: RgbaImage[], sign: number, label: string, minShift = 2, edgeSide = sign): CheckIssue[] {
  const shift = directionShift(frames, sign, edgeSide);
  return shift >= minShift ? [] : [{ level: "warn", message: `${label} 방향(${sign > 0 ? "오른쪽" : "왼쪽"})으로 나가지 않는다 (윗몸 앞 끝 최대 ${shift.toFixed(0)}칸 < ${minShift})` }];
}
