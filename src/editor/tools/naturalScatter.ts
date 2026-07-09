import type { Rng } from "@/util/rng";
import { lineCells, type Point } from "./mapHelpers";

export interface ScatterBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WobblePathResult {
  readonly path: Point[];
  readonly widthCells: Point[];
}

export interface PoissonScatterResult {
  readonly points: Point[];
  readonly missing: number;
}

interface InclusiveBounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const TWO_PI = Math.PI * 2;

export function wobblePath(points: readonly Point[], naturalness: number, rng: Rng): WobblePathResult {
  const cells = points.map(toCell);
  if (cells.length === 0) return { path: [], widthCells: [] };

  const n = clamp01(naturalness);
  if (n === 0) return { path: straightLinePath(cells), widthCells: [] };

  const padding = maxWobbleAmplitude(cells, n) + 2;
  const bounds = wobbleBounds(cells, padding);
  const controls = smoothControlPoints(wobbleControls(cells, n, bounds, rng), bounds);
  // 닫힌 폴리라인(시작=끝, 예: 광장 링)은 의도적 루프 — removeLoops가 경로 전체를
  // 삼켜 1칸으로 퇴화시키던 버그(2026-07-08 마을 시공에서 발견). 열린 경로만 루프 제거.
  const first = cells[0];
  const last = cells[cells.length - 1];
  const closed = cells.length > 2 && first.x === last.x && first.y === last.y;
  const connected = connectControls(controls, bounds, rng);
  const path = closed ? connected : removeLoops(connected);
  const widthCells = n >= 0.6 ? buildWidthCells(path, n, bounds, rng) : [];
  return { path, widthCells };
}

export function poissonScatter(bounds: ScatterBounds, count: number, minGap: number, rng: Rng): PoissonScatterResult {
  const requested = normalizeCount(count);
  if (requested === 0) return { points: [], missing: 0 };

  const candidates = enumerateCells(bounds);
  shuffle(candidates, rng);

  const points: Point[] = [];
  const minGapSq = Math.max(0, minGap) ** 2;
  for (const candidate of candidates) {
    if (points.length >= requested) break;
    if (points.every((point) => distanceSq(point, candidate) >= minGapSq)) points.push(candidate);
  }

  return { points, missing: Math.max(0, requested - points.length) };
}

export function clusterScatter(
  bounds: ScatterBounds,
  anchors: readonly Point[],
  count: number,
  falloff: number,
  rng: Rng
): Point[] {
  const requested = normalizeCount(count);
  if (requested === 0) return [];

  const allCells = enumerateCells(bounds);
  if (allCells.length === 0) return [];

  const inclusive = scatterInclusiveBounds(bounds);
  const clusterAnchors = normalizedAnchors(bounds, anchors, requested, rng);
  const spread = Math.max(0.35, falloff);
  const target = Math.min(requested, allCells.length);
  const points: Point[] = [];
  const seen = new Set<string>();
  const attempts = Math.max(80, target * 80);

  for (let attempt = 0; attempt < attempts && points.length < target; attempt += 1) {
    const anchor = clusterAnchors[randomInt(rng, clusterAnchors.length)];
    const candidate = clampPoint({
      x: Math.round(anchor.x + gaussian(rng) * spread),
      y: Math.round(anchor.y + gaussian(rng) * spread),
    }, inclusive);
    addUniquePoint(points, seen, candidate);
  }

  if (points.length < target) {
    const remaining = allCells
      .filter((point) => !seen.has(pointKey(point)))
      .map((point) => ({ point, score: nearestAnchorDistanceSq(point, clusterAnchors) + rng() * 0.0001 }))
      .sort((a, b) => a.score - b.score);
    for (const entry of remaining) {
      if (points.length >= target) break;
      addUniquePoint(points, seen, entry.point);
    }
  }

  return points;
}

export function jitterPlacement(pos: Point, maxOffset: number, rng: Rng, isValid: (candidate: Point) => boolean): Point {
  const origin = toCell(pos);
  const radius = Math.max(0, Math.floor(maxOffset));
  if (radius === 0) return origin;

  for (let ring = 1; ring <= radius; ring += 1) {
    const offsets = ringOffsets(ring);
    const start = randomInt(rng, offsets.length);
    const step = rng() < 0.5 ? 1 : -1;
    for (let index = 0; index < offsets.length; index += 1) {
      const offset = offsets[(start + index * step + offsets.length) % offsets.length];
      const candidate = { x: origin.x + offset.x, y: origin.y + offset.y };
      if (isValid(candidate)) return candidate;
    }
  }

  return origin;
}

function straightLinePath(points: readonly Point[]): Point[] {
  if (points.length <= 1) return [...points];
  const path: Point[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const segment = lineCells(points[index - 1], points[index]);
    for (const cell of segment) {
      const previous = path[path.length - 1];
      if (!previous || previous.x !== cell.x || previous.y !== cell.y) path.push(cell);
    }
  }
  return path;
}

function wobbleControls(points: readonly Point[], naturalness: number, bounds: InclusiveBounds, rng: Rng): Point[] {
  if (points.length <= 1) return points.map((point) => clampPoint(point, bounds));

  const controls: Point[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const steps = Math.max(Math.abs(dx), Math.abs(dy));
    if (steps === 0) {
      if (controls.length === 0) controls.push(clampPoint(from, bounds));
      continue;
    }

    const length = Math.hypot(dx, dy);
    const perpendicularX = -dy / length;
    const perpendicularY = dx / length;
    const amplitude = jitterAmplitude(steps, naturalness);
    let lateral = 0;

    for (let step = 0; step <= steps; step += 1) {
      if (controls.length > 0 && step === 0) continue;
      const t = step / steps;
      if (step === 0 || step === steps) {
        lateral = 0;
      } else {
        const impulse = (rng() * 2 - 1) * amplitude;
        lateral = clamp(lateral * 0.7 + impulse * 0.55, -amplitude, amplitude);
      }

      const taper = Math.sin(Math.PI * t);
      const jitter = lateral * taper;
      controls.push(clampPoint({
        x: Math.round(from.x + dx * t + perpendicularX * jitter),
        y: Math.round(from.y + dy * t + perpendicularY * jitter),
      }, bounds));
    }
  }
  return controls;
}

function smoothControlPoints(points: readonly Point[], bounds: InclusiveBounds): Point[] {
  if (points.length < 3) return [...points];
  let current = [...points];
  for (let pass = 0; pass < 2; pass += 1) {
    const next: Point[] = [current[0]];
    for (let index = 1; index < current.length - 1; index += 1) {
      const previous = current[index - 1];
      const point = current[index];
      const following = current[index + 1];
      next.push(clampPoint({
        x: Math.round((previous.x + point.x * 2 + following.x) / 4),
        y: Math.round((previous.y + point.y * 2 + following.y) / 4),
      }, bounds));
    }
    next.push(current[current.length - 1]);
    current = next;
  }
  return current;
}

function connectControls(points: readonly Point[], bounds: InclusiveBounds, rng: Rng): Point[] {
  if (points.length === 0) return [];
  const path: Point[] = [points[0]];
  for (let index = 1; index < points.length; index += 1) connectManhattan(path, points[index], bounds, rng);
  return path;
}

function connectManhattan(path: Point[], target: Point, bounds: InclusiveBounds, rng: Rng): void {
  let current = path[path.length - 1];
  let guard = 0;
  while ((current.x !== target.x || current.y !== target.y) && guard < 10000) {
    const dx = target.x - current.x;
    const dy = target.y - current.y;
    let moveX = dy === 0;
    if (dx !== 0 && dy !== 0) {
      const horizontalWeight = Math.abs(dx) / (Math.abs(dx) + Math.abs(dy));
      moveX = rng() < horizontalWeight;
    } else if (dx === 0) {
      moveX = false;
    }

    const next = clampPoint({
      x: current.x + (moveX ? Math.sign(dx) : 0),
      y: current.y + (moveX ? 0 : Math.sign(dy)),
    }, bounds);
    if (next.x === current.x && next.y === current.y) break;
    path.push(next);
    current = next;
    guard += 1;
  }
}

function buildWidthCells(path: readonly Point[], naturalness: number, bounds: InclusiveBounds, rng: Rng): Point[] {
  const pathKeys = new Set(path.map(pointKey));
  const widthCells: Point[] = [];
  const seen = new Set<string>();
  const chance = 0.35 + (naturalness - 0.6) * 0.8;

  for (let index = 0; index < path.length; index += 1) {
    if (rng() > chance) continue;
    const directions = perpendicularDirections(path, index);
    const firstDirection = directions[randomInt(rng, directions.length)];
    const secondDirection = directions.find((direction) => direction.x !== firstDirection.x || direction.y !== firstDirection.y);
    const selected = secondDirection && rng() < 0.25 ? [firstDirection, secondDirection] : [firstDirection];
    const radius = naturalness >= 0.85 && rng() < 0.35 ? 2 : 1;
    for (const direction of selected) {
      for (let distance = 1; distance <= radius; distance += 1) {
        addWidthCell(widthCells, seen, pathKeys, {
          x: path[index].x + direction.x * distance,
          y: path[index].y + direction.y * distance,
        }, bounds);
      }
    }
  }

  if (path.length > 0 && widthCells.length === 0) {
    for (const direction of perpendicularDirections(path, 0)) {
      addWidthCell(widthCells, seen, pathKeys, { x: path[0].x + direction.x, y: path[0].y + direction.y }, bounds);
      if (widthCells.length > 0) break;
    }
  }

  return widthCells;
}

function perpendicularDirections(path: readonly Point[], index: number): readonly Point[] {
  const previous = path[Math.max(0, index - 1)];
  const next = path[Math.min(path.length - 1, index + 1)];
  const dx = Math.sign(next.x - previous.x);
  const dy = Math.sign(next.y - previous.y);
  if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) return [{ x: 0, y: 1 }, { x: 0, y: -1 }];
  if (dy !== 0) return [{ x: 1, y: 0 }, { x: -1, y: 0 }];
  return [{ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }];
}

function addWidthCell(
  widthCells: Point[],
  seen: Set<string>,
  pathKeys: ReadonlySet<string>,
  point: Point,
  bounds: InclusiveBounds
): void {
  const clamped = clampPoint(point, bounds);
  const key = pointKey(clamped);
  if (pathKeys.has(key) || seen.has(key)) return;
  seen.add(key);
  widthCells.push(clamped);
}

function normalizedAnchors(bounds: ScatterBounds, anchors: readonly Point[], count: number, rng: Rng): Point[] {
  const inclusive = scatterInclusiveBounds(bounds);
  const valid = anchors.map(toCell).filter((point) => inInclusiveBounds(point, inclusive));
  if (valid.length > 0) return valid;

  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  const anchorCount = Math.max(1, Math.min(3, Math.ceil(Math.sqrt(count) / 3)));
  const seeded = poissonScatter(bounds, anchorCount, Math.max(1, Math.min(width, height) / Math.max(2, anchorCount + 1)), rng).points;
  if (seeded.length > 0) return seeded;

  return [clampPoint({
    x: Math.floor(bounds.x + width / 2),
    y: Math.floor(bounds.y + height / 2),
  }, inclusive)];
}

function ringOffsets(radius: number): Point[] {
  const offsets: Point[] = [];
  for (let x = -radius; x <= radius; x += 1) offsets.push({ x, y: -radius });
  for (let y = -radius + 1; y <= radius; y += 1) offsets.push({ x: radius, y });
  for (let x = radius - 1; x >= -radius; x -= 1) offsets.push({ x, y: radius });
  for (let y = radius - 1; y > -radius; y -= 1) offsets.push({ x: -radius, y });
  return offsets;
}

function addUniquePoint(points: Point[], seen: Set<string>, point: Point): boolean {
  const key = pointKey(point);
  if (seen.has(key)) return false;
  seen.add(key);
  points.push(point);
  return true;
}

function removeLoops(points: readonly Point[]): Point[] {
  const result: Point[] = [];
  const indexByKey = new Map<string, number>();
  for (const point of points) {
    const key = pointKey(point);
    const existingIndex = indexByKey.get(key);
    if (existingIndex === undefined) {
      indexByKey.set(key, result.length);
      result.push(point);
      continue;
    }

    for (let index = result.length - 1; index > existingIndex; index -= 1) indexByKey.delete(pointKey(result[index]));
    result.length = existingIndex + 1;
  }
  return result;
}

function maxWobbleAmplitude(points: readonly Point[], naturalness: number): number {
  let amplitude = 1;
  for (let index = 1; index < points.length; index += 1) {
    amplitude = Math.max(amplitude, jitterAmplitude(Math.max(
      Math.abs(points[index].x - points[index - 1].x),
      Math.abs(points[index].y - points[index - 1].y)
    ), naturalness));
  }
  return amplitude;
}

function jitterAmplitude(segmentSteps: number, naturalness: number): number {
  return Math.max(1, Math.ceil(naturalness * Math.min(4, Math.max(1, segmentSteps / 5))));
}

function wobbleBounds(points: readonly Point[], padding: number): InclusiveBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.max(0, Math.min(...xs) - padding),
    minY: Math.max(0, Math.min(...ys) - padding),
    maxX: Math.max(...xs) + padding,
    maxY: Math.max(...ys) + padding,
  };
}

function scatterInclusiveBounds(bounds: ScatterBounds): InclusiveBounds {
  const x = Math.floor(bounds.x);
  const y = Math.floor(bounds.y);
  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  return { minX: x, minY: y, maxX: x + width - 1, maxY: y + height - 1 };
}

function enumerateCells(bounds: ScatterBounds): Point[] {
  const x0 = Math.floor(bounds.x);
  const y0 = Math.floor(bounds.y);
  const width = Math.max(0, Math.floor(bounds.width));
  const height = Math.max(0, Math.floor(bounds.height));
  const cells: Point[] = [];
  for (let y = y0; y < y0 + height; y += 1) {
    for (let x = x0; x < x0 + width; x += 1) cells.push({ x, y });
  }
  return cells;
}

function nearestAnchorDistanceSq(point: Point, anchors: readonly Point[]): number {
  return Math.min(...anchors.map((anchor) => distanceSq(point, anchor)));
}

function gaussian(rng: Rng): number {
  const u = Math.max(Number.EPSILON, rng());
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TWO_PI * v);
}

function shuffle<T>(values: T[], rng: Rng): void {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(rng, index + 1);
    const value = values[index];
    values[index] = values[swapIndex];
    values[swapIndex] = value;
  }
}

function randomInt(rng: Rng, exclusiveMax: number): number {
  return Math.floor(rng() * exclusiveMax);
}

function toCell(point: Point): Point {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

function clampPoint(point: Point, bounds: InclusiveBounds): Point {
  return { x: clamp(point.x, bounds.minX, bounds.maxX), y: clamp(point.y, bounds.minY, bounds.maxY) };
}

function inInclusiveBounds(point: Point, bounds: InclusiveBounds): boolean {
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, 0, 1);
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count)) return 0;
  return Math.max(0, Math.floor(count));
}

function distanceSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function pointKey(point: Point): string {
  return `${point.x},${point.y}`;
}
