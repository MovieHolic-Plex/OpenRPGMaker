import type { GameMap, Project, Rect, VillageDecorationRule } from "@/project/types";
import type { SpaceDesign, SpatialKitSnapshot } from "@/project/spatial/types";
import { snapshotGraphic } from "@/project/spatial/snapshotRaster";
import { computeReachableCells } from "@/project/lint/reachability";
import { isWaterChipsetTile } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { protectedHouseCells } from "../houseProtection";
import { ToolError } from "../types";
import { ROAD_TILES } from "./constants";
import { marketAisleCells } from "./market";

type Point = { x: number; y: number };
type Cell = SpatialKitSnapshot["cells"][number];
export interface VillageSpaceDecoration {
  space: SpaceDesign;
  objects: { objectId: string; revision: number; raster: SpatialKitSnapshot }[];
  zone: VillageDecorationRule["zone"];
  x: number; y: number;
  houseId?: string;
  cells: Cell[];
}

/** Outdoor attachment spaces preserve the existing terrain. Only their fixed object
 * slots are overlaid; ports must remain walkable. Each candidate is transactional,
 * retains every previously reachable cell except the actual prop footprint, and
 * freezes definitions/rasters for later audit. This is shared by AI and preview. */
export function decorateVillageSpaces(project: Project, map: GameMap, area: Rect,
  rules: readonly VillageDecorationRule[], start: Point, seed: number): VillageSpaceDecoration[] {
  const library = project.spatialAuthoring?.library;
  const tileset = project.tilesets[map.tilesetId]!;
  const key = (p: Point) => `${p.x},${p.y}`;
  const index = (p: Point) => p.y * map.width + p.x;
  const inside = (p: Point) => p.x >= area.x && p.y >= area.y && p.x < area.x + area.w && p.y < area.y + area.h;
  const blocked = new Set(protectedHouseCells(map).map(index));
  const regions = map.layoutPlan?.regions ?? [];
  const targets: Point[] = [start];
  for (const region of regions) {
    targets.push(...(region.objectExterior?.doorApproaches ?? []), ...(region.front ? [region.front] : []));
    for (const p of region.objectExterior?.privateAccess ?? []) blocked.add(index(p));
  }
  for (const event of map.events) { blocked.add(index(event)); targets.push(event); }
  for (const p of targets) blocked.add(index(p));
  const houses = regions.filter(r => r.objectExterior);
  const plaza = regions.find(r => r.role === "plaza");
  if (plaza) for (const p of marketAisleCells(plaza)) blocked.add(index(p));
  const water = new Set(map.lowerTiles.flatMap((t, i) => isWaterChipsetTile(t) ? [i] : []));
  const roads: Point[] = [];
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    if (ROAD_TILES.has(map.lowerTiles[y * map.width + x]!)) roads.push({ x, y });
  }
  let reachable = computeReachableCells(project, map, start.x, start.y);
  const result: VillageSpaceDecoration[] = [], occupied = new Set<number>();
  const prepared = rules.map(rule => {
    const space = library?.spaces[rule.spaceId];
    if (!space || space.environment !== "outdoor" || space.shape !== "rect" || space.wall !== "none"
      || space.tilesetId !== map.tilesetId || space.floorAreas.some(a => a.material !== "ground")
      || !space.ports.length || space.objectSlots.some(s => s.placement.mode !== "fixed" || s.quantity !== 1 || s.chipOverrides?.length)) {
      throw new ToolError(`장식 공간 ${rule.spaceId}: 같은 타일셋의 고정 오브젝트·진입구를 가진 실외 공간이 필요합니다.`, { code: "village-decoration-space" });
    }
    const objects: VillageSpaceDecoration["objects"] = [], cells: Cell[] = [];
    for (const slot of space.objectSlots) {
      const object = library!.objects[slot.objectDesignId];
      if (!object || slot.placement.mode !== "fixed") throw new ToolError("장식 공간 오브젝트를 찾을 수 없습니다.", { code: "village-decoration-object" });
      const raster = snapshotGraphic(project, object.graphic);
      if (raster.tilesetId !== map.tilesetId) throw new ToolError("장식 오브젝트 타일셋이 다릅니다.", { code: "village-decoration-object" });
      objects.push({ objectId: object.id, revision: object.revision, raster });
      for (const cell of raster.cells) {
        const p = { ...cell, x: slot.placement.x + cell.x, y: slot.placement.y + cell.y };
        const home = tileLayerHome(tileset, cell.tile);
        if (p.x < 0 || p.y < 0 || p.x >= space.width || p.y >= space.height || (home !== p.layer && home !== "both")) {
          throw new ToolError("장식 공간 크기 또는 타일 레이어가 올바르지 않습니다.", { code: "village-decoration-raster" });
        }
        cells.push(p);
      }
    }
    if (new Set(cells.map(c => `${c.layer}:${c.x},${c.y}`)).size !== cells.length) {
      throw new ToolError("장식 공간의 오브젝트 타일이 서로 겹칩니다.", { code: "village-decoration-raster" });
    }
    return { rule, space, objects, cells, count: 0 };
  });
  const tryAt = (entry: typeof prepared[number], origin: Point, houseId?: string): boolean => {
    const { space } = entry;
    if (!inside(origin) || !inside({ x: origin.x + space.width - 1, y: origin.y + space.height - 1 })) return false;
    const cells = entry.cells.map(c => ({ ...c, x: c.x + origin.x, y: c.y + origin.y }));
    const ports = space.ports.map(p => ({ x: p.x + origin.x, y: p.y + origin.y }));
    if (ports.some(p => !reachable.has(key(p)) || occupied.has(index(p)))) return false;
    const footprint = new Set(cells.map(index));
    const waterOverlay = entry.rule.zone === "shore" && space.tags.includes("water-overlay")
      && cells.every(c => c.layer === "lower") && cells.some(c => water.has(index(c)));
    if (space.tags.includes("water-overlay") && !waterOverlay) return false;
    if (ports.some(p => footprint.has(index(p)))) return false;
    if (cells.some(p => {
      const i = index(p);
      return blocked.has(i) || occupied.has(i) || (water.has(i) && !waterOverlay) || ROAD_TILES.has(map.lowerTiles[i]!)
        || map.upperTiles[i] !== TILE.EMPTY || map.lowerTileStacks?.[i]?.length || map.upperTileStacks?.[i]?.length
        || (!reachable.has(key(p)) && !(waterOverlay && water.has(i)));
    })) return false;
    const old = cells.map(p => ({ p, tile: (p.layer === "lower" ? map.lowerTiles : map.upperTiles)[index(p)]! }));
    for (const p of cells) (p.layer === "lower" ? map.lowerTiles : map.upperTiles)[index(p)] = p.tile;
    const after = computeReachableCells(project, map, start.x, start.y);
    if ((waterOverlay && cells.some(p => !after.has(key(p)))) || ports.some(p => !after.has(key(p))) || [...reachable].some(k => {
      const [x,y] = k.split(",").map(Number); return !footprint.has(y! * map.width + x!) && !after.has(k);
    })) {
      for (const {p,tile} of old) (p.layer === "lower" ? map.lowerTiles : map.upperTiles)[index(p)] = tile;
      return false;
    }
    reachable = after;
    for (const p of cells) occupied.add(index(p));
    for (const p of ports) { blocked.add(index(p)); targets.push(p); }
    result.push({ space: structuredClone(space), objects: structuredClone(entry.objects), zone: entry.rule.zone,
      ...origin, houseId, cells: entry.cells });
    map.layoutPlan?.regions.push({ id: `village-decoration-${result.length}`, role: "custom", label: space.name,
      x: origin.x, y: origin.y, w: space.width, h: space.height, front: ports[0],
      tags: ["village-decoration", `space:${space.id}`, `zone:${entry.rule.zone}`, ...(houseId ? [`house:${houseId}`] : [])] });
    entry.count++;
    return true;
  };
  // Round-robin across house types, so the first recipe cannot monopolize all yards.
  const homeEntries = prepared.filter(e => e.rule.zone === "house");
  for (const [n, house] of houses.entries()) {
    if (!homeEntries.length) break;
    const candidates: Point[] = [];
    for (let dy = 0; dy <= 4; dy++) for (let x = house.x - 2; x < house.x + house.w; x++) candidates.push({ x, y: house.y + house.h + dy });
    for (let y = house.y + Math.max(0, house.h - 3); y < house.y + house.h; y++) {
      candidates.push({ x: house.x - 3, y }, { x: house.x + house.w, y });
    }
    for (let k = 0; k < homeEntries.length; k++) {
      const entry = homeEntries[(n + k + Math.abs(seed)) % homeEntries.length]!;
      if (entry.count >= entry.rule.maxCount) continue;
      if (candidates.some(p => tryAt(entry, p, house.id))) { break; }
    }
  }
  for (const entry of prepared.filter(e => e.rule.zone !== "house")) {
    const candidates: (Point & { score: number })[] = [];
    for (let y = area.y + 1; y < area.y + area.h - entry.space.height; y++) for (let x = area.x + 1; x < area.x + area.w - entry.space.width; x++) {
      const p = { x, y }, zone = entry.rule.zone;
      const cx = x + entry.space.width / 2, cy = y + entry.space.height / 2;
      const plazaDistance = plaza ? Math.hypot(cx - plaza.x - plaza.w/2, cy - plaza.y - plaza.h/2) : Infinity;
      let score = plazaDistance;
      if (zone === "commons" && plazaDistance > 13) continue;
      if (zone !== "market" && plaza && x < plaza.x + plaza.w && x + entry.space.width > plaza.x
        && y < plaza.y + plaza.h && y + entry.space.height > plaza.y) continue;
      if (zone === "market" && (!plaza || x < plaza.x || y < plaza.y || x + entry.space.width > plaza.x + plaza.w || y + entry.space.height > plaza.y + plaza.h)) continue;
      if (zone === "shore") {
        let distance = Infinity;
        for (const i of water) distance = Math.min(distance, Math.abs(cx - i % map.width) + Math.abs(cy - Math.floor(i / map.width)));
        if (distance > 5) continue;
        score = distance;
      }
      if (zone === "road") {
        if (roads.every(r => Math.abs(r.x-cx)+Math.abs(r.y-cy)>3)) continue;
        score = ((x * 73 + y * 37 + seed) % 97) / 97;
      }
      if (result.some(r => r.zone === zone && Math.hypot(x-r.x,y-r.y) < (zone === "road" ? 9 : 4))) continue;
      candidates.push({ ...p, score });
    }
    candidates.sort((a,b)=>a.score-b.score || a.y-b.y || a.x-b.x);
    for (const p of candidates) {
      if (entry.count >= entry.rule.maxCount) break;
      if (result.some(r => r.zone === entry.rule.zone && Math.hypot(p.x-r.x,p.y-r.y) < (entry.rule.zone === "road" ? 9 : 4))) continue;
      tryAt(entry,p);
    }
  }
  return result;
}
