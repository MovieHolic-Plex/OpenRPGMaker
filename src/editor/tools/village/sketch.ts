// editor/tools/village/sketch.ts
// 스케치 프리패스 — 솔버가 집을 놓기 전에 시드 결정적 유기적 후보점을 먼저 뽑는다.
// 열·행 격자(동일 x 공유)와 십자 간선 위 배치를 깨는 것이 목적. 격자 폴백은 건드리지 않는다.

import { mulberry32, type Rng } from "@/util/rng";
import { clusterScatter, poissonScatter } from "../naturalScatter";
import {
  expandRect,
  HOUSE_MARGIN,
  pointInRect,
  type Plaza,
  type Point,
  type Rect,
} from "./constants";

export type VillageSketchSite = {
  readonly x: number;
  readonly y: number;
};

export type VillageSketchBoulevard = {
  readonly ewRow: number;
  readonly nsCol: number;
};

export type SketchHouseSitesArgs = {
  readonly area: Rect;
  readonly plaza: Plaza;
  readonly seed: number;
  readonly targetHouses: number;
  readonly boulevard?: VillageSketchBoulevard | null;
};

const SKETCH_MIN_GAP = 7;
const SKETCH_FILL_ROUNDS = 4;
const SKETCH_FILL_SPREAD = 6;

export function sketchHouseSites(args: SketchHouseSitesArgs): readonly VillageSketchSite[] {
  const target = Math.max(0, Math.floor(args.targetHouses));
  if (target === 0) return [];
  const rng = mulberry32((args.seed ^ 0x51edbeef) >>> 0);
  const bounds = { x: args.area.x, y: args.area.y, width: args.area.w, height: args.area.h };
  const forbidden = expandRect(args.plaza.rect, HOUSE_MARGIN + 2);
  const accepts = (point: Point): boolean => {
    if (pointInRect(point, forbidden)) return false;
    if (point.x < args.area.x + HOUSE_MARGIN || point.x > args.area.x + args.area.w - 1 - HOUSE_MARGIN) return false;
    if (point.y < args.area.y + HOUSE_MARGIN || point.y > args.area.y + args.area.h - 1 - HOUSE_MARGIN) return false;
    const boulevard = args.boulevard ?? null;
    if (boulevard !== null
      && (Math.abs(point.y - boulevard.ewRow) <= 1 || Math.abs(point.x - boulevard.nsCol) <= 1)) return false;
    return true;
  };
  const sites: VillageSketchSite[] = [];
  const seen = new Set<string>();
  const add = (point: Point): void => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    sites.push({ x: point.x, y: point.y });
  };
  const scattered = poissonScatter(bounds, Math.max(12, target * 2), SKETCH_MIN_GAP, rng);
  for (const point of scattered.points) {
    if (accepts(point)) add(point);
  }
  for (let round = 0; round < SKETCH_FILL_ROUNDS && sites.length < target; round += 1) {
    const filled = clusterScatter(bounds, quadrantAnchors(args.area, rng), target - sites.length, SKETCH_FILL_SPREAD, rng);
    for (const point of filled) {
      if (sites.length >= target) break;
      if (accepts(point)) add(point);
    }
  }
  return sites;
}

function quadrantAnchors(area: Rect, rng: Rng): readonly Point[] {
  const jitter = (): number => Math.floor(rng() * 7) - 3;
  return [
    { x: area.x + Math.floor(area.w * 0.25) + jitter(), y: area.y + Math.floor(area.h * 0.25) + jitter() },
    { x: area.x + Math.floor(area.w * 0.75) + jitter(), y: area.y + Math.floor(area.h * 0.25) + jitter() },
    { x: area.x + Math.floor(area.w * 0.25) + jitter(), y: area.y + Math.floor(area.h * 0.75) + jitter() },
    { x: area.x + Math.floor(area.w * 0.75) + jitter(), y: area.y + Math.floor(area.h * 0.75) + jitter() },
  ];
}
