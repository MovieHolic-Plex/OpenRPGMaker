// editor/tools/village/sketch.ts
// 스케치 프리패스 — 솔버가 집을 놓기 전에 시드 결정적 유기적 후보점을 먼저 뽑는다.
// 열·행 격자(동일 x 공유)를 깨는 것이 목적. 격자 폴백은 houses.ts가 맡는다.

import { mulberry32, type Rng } from "@/util/rng";
import { clusterScatter, poissonScatter } from "../naturalScatter";
import {
  expandRect,
  HOUSE_MARGIN,
  rectsOverlap,
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
  /** 대로 축(2026-09-17). 비우면 2축으로 피한다. */
  readonly axis?: "both" | "ew" | "ns";
};

export type SketchHouseSitesArgs = {
  readonly area: Rect;
  readonly plaza: Plaza;
  readonly seed: number;
  readonly targetHouses: number;
  readonly boulevard?: VillageSketchBoulevard | null;
};

/** 스케치 후보의 근사 집 footprint — canPlaceHouse와 같은 8×7 + HOUSE_MARGIN 규칙으로 겹침을 잰다. */
export const SKETCH_FOOTPRINT_W = 8;
export const SKETCH_FOOTPRINT_H = 7;

export function sketchSiteFootprint(site: Point): Rect {
  return {
    x: site.x - Math.floor(SKETCH_FOOTPRINT_W / 2),
    y: site.y,
    w: SKETCH_FOOTPRINT_W,
    h: SKETCH_FOOTPRINT_H,
  };
}
const SKETCH_FILL_ROUNDS = 8;
const SKETCH_FILL_SPREAD = 6;

export function sketchHouseSites(args: SketchHouseSitesArgs): readonly VillageSketchSite[] {
  const target = Math.max(0, Math.floor(args.targetHouses));
  if (target === 0) return [];
  const rng = mulberry32((args.seed ^ 0x51edbeef) >>> 0);
  const bounds = { x: args.area.x, y: args.area.y, width: args.area.w, height: args.area.h };
  const plazaBlock = expandRect(args.plaza.rect, HOUSE_MARGIN + 2);
  const accepts = (point: Point): boolean => {
    const box = footprintAt(point);
    if (box.x < args.area.x + HOUSE_MARGIN || box.y < args.area.y + HOUSE_MARGIN) return false;
    if (box.x + box.w > args.area.x + args.area.w - HOUSE_MARGIN) return false;
    if (box.y + box.h > args.area.y + args.area.h - HOUSE_MARGIN) return false;
    if (rectsOverlap(box, plazaBlock)) return false;
    const boulevard = args.boulevard ?? null;
    if (boulevard === null) return true;
    const axis = boulevard.axis ?? "both";
    const hitsEw = axis !== "ns" && box.y <= boulevard.ewRow + 1 && box.y + box.h - 1 >= boulevard.ewRow - 1;
    const hitsNs = axis !== "ew" && box.x <= boulevard.nsCol + 1 && box.x + box.w - 1 >= boulevard.nsCol - 1;
    return !hitsEw && !hitsNs;
  };
  const sites: VillageSketchSite[] = [];
  const seen = new Set<string>();
  const farEnough = (point: Point): boolean => {
    const box = expandRect(sketchSiteFootprint(point), HOUSE_MARGIN);
    return sites.every((site) => !rectsOverlap(box, expandRect(sketchSiteFootprint(site), HOUSE_MARGIN)));
  };
  const add = (point: Point): void => {
    const key = `${point.x},${point.y}`;
    if (seen.has(key) || !accepts(point) || !farEnough(point)) return;
    seen.add(key);
    sites.push({ x: point.x, y: point.y });
  };
  const scattered = poissonScatter(bounds, Math.max(64, target * 8), 0, rng);
  for (const point of scattered.points) add(point);
  for (let round = 0; round < SKETCH_FILL_ROUNDS && sites.length < target; round += 1) {
    const filled = clusterScatter(
      bounds,
      quadrantAnchors(args.area, rng),
      Math.max(target * 4, 32),
      SKETCH_FILL_SPREAD,
      rng,
    );
    for (const point of filled) {
      if (sites.length >= Math.max(target * 3, 24)) break;
      add(point);
    }
  }
  return sites;
}

function footprintAt(point: Point): Rect {
  return sketchSiteFootprint(point);
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
