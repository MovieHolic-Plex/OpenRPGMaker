import { isPassable, isPassableLanding } from "@/project/collision";
import { TILE } from "@/project/defaults/constants";
import { snapshotGraphic } from "@/project/spatial/snapshotRaster";
import type { ObjectDesign, SpatialKitSnapshot } from "@/project/spatial/types";
import type { GameMap, Project } from "@/project/types";
import { mulberry32 } from "@/util/rng";
import { protectedHouseCells } from "../houseProtection";
import { ToolError } from "../types";
import { environmentalRoadAt, ROAD_TILES, type BuiltHouse, type Point, type Rect, type VillageIntent, type Plaza } from "./constants";
import { paintRoadStrip } from "./roads";
import { compactHousePool, chooseCompactHouses } from "./compactComposition";

export interface VillageObjectHouse {
  readonly design: ObjectDesign;
  readonly raster: SpatialKitSnapshot;
  readonly approaches: readonly Point[];
  readonly access: readonly Point[];
  readonly gate: Point;
}

/** An explicit library pool never falls back to an unrelated parametric house. */
export function villageObjectHouseCatalog(project: Project, args: Readonly<Record<string, unknown>>): readonly VillageObjectHouse[] | undefined {
  const plans = Array.isArray(args.housePlans) ? args.housePlans as Record<string, unknown>[] : [];
  const fixed = plans.flatMap(plan => typeof plan?.objectId === "string" ? [plan.objectId] : []);
  if (args.houseObjectIds === undefined && fixed.length === 0) {
    if (args.composition === "compact") throw new ToolError("조밀한 마을에는 저장된 집의 houseObjectIds가 필요합니다.", { code: "village-compact-objects" });
    return undefined;
  }
  if (args.houseObjectIds !== undefined && (!Array.isArray(args.houseObjectIds) || args.houseObjectIds.length === 0
    || args.houseObjectIds.length > 128 || args.houseObjectIds.some(id => typeof id !== "string" || !id.trim()))) {
    throw new ToolError("houseObjectIds에는 저장된 건물 오브젝트 ID를 넣어 주세요.", { code: "village-object-invalid" });
  }
  if (args.interior === true) throw new ToolError("건물 외형에는 실내가 포함되지 않습니다. interior:false로 짓고 별도 공간·장소를 연결해 주세요.", { code: "village-object-interior" });
  if (plans.some(plan => plan?.kitId !== undefined || plan?.templateId !== undefined)) {
    throw new ToolError("저장된 오브젝트와 이전 집 템플릿을 한 번의 마을 시공에서 섞을 수 없습니다.", { code: "village-object-conflict" });
  }
  const presetId = typeof args.presetId === "string" ? args.presetId : project.defaultVillagePresetId;
  const preset = project.villagePresets?.find(entry => entry.id === presetId);
  if (preset?.design?.policies.appearance === "fixed") {
    throw new ToolError("마을 설계서의 고정 집 형태와 오브젝트 후보가 충돌합니다. 설계서의 외형 선택을 자유로 바꿔 주세요.", { code: "village-design-conflict" });
  }
  const ids = [...new Set([...(args.houseObjectIds as string[] | undefined ?? []), ...fixed])];
  const catalog = ids.map(id => {
    const design = project.spatialAuthoring?.library.objects[id];
    if (!design) throw new ToolError(`건물 오브젝트를 찾을 수 없습니다: ${id}`, { code: "village-object-missing" });
    const raster = snapshotGraphic(project, design.graphic);
    const lower = new Map(raster.cells.filter(cell => cell.layer === "lower").map(cell => [`${cell.x},${cell.y}`, cell.tile]));
    // These are authored semantic ports backed by a complete town doorway, not inferred floor counts.
    const approaches = design.anchors.filter(port => lower.get(`${port.x},${port.y - 1}`) === 146
      && lower.get(`${port.x},${port.y - 2}`) === 116).map(({ x, y }) => ({ x, y }));
    const doors = raster.cells.filter(cell => cell.layer === "lower" && cell.tile === 146);
    if (!approaches.length || doors.length !== approaches.length || new Set(approaches.map(p => `${p.x},${p.y}`)).size !== doors.length
      || !doors.every(door => approaches.some(p => p.x === door.x && p.y === door.y + 1)) || design.chips.length > 0) {
      throw new ToolError(`「${design.name}」에는 모든 현관 앞 앵커가 필요합니다. 상호작용 칩은 별도 공간에서 연결해 주세요.`, { code: "village-object-ports" });
    }
    const { access, gate } = planObjectAccess(raster, approaches);
    return { design, raster, approaches, access, gate };
  });
  return args.composition === "compact" ? compactHousePool(catalog, fixed) : catalog;
}

/** Plan private paths through EMPTY exterior cells. Roofs/walls never become corridors. */
function planObjectAccess(raster: SpatialKitSnapshot, approaches: readonly Point[]): { access: Point[]; gate: Point } {
  const width = raster.width, height = raster.height;
  const occupied = new Set(raster.cells.map(cell => `${cell.x},${cell.y}`));
  const first = approaches[0]!;
  const gate = { x: Math.max(0, Math.min(width - 1, first.x)), y: height };
  const key = (p: Point): string => `${p.x},${p.y}`;
  const previous = new Map<string, Point | null>([[key(gate), null]]);
  const queue: Point[] = [gate];
  for (let i = 0; i < queue.length; i++) {
    const point = queue[i]!;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const next = { x: point.x + dx, y: point.y + dy };
      if (next.x < 0 || next.x >= width || next.y < 0 || next.y > height
        || occupied.has(key(next)) || previous.has(key(next))) continue;
      previous.set(key(next), point); queue.push(next);
    }
  }
  const cells = new Map<string, Point>();
  for (const approach of approaches) {
    if (!previous.has(key(approach))) throw new ToolError(`건물 ${raster.kitId}의 현관 앞(${approach.x},${approach.y})에서 남쪽 대문으로 나갈 수 없습니다.`, { code: "village-object-access" });
    for (let p: Point | null = approach; p; p = previous.get(key(p)) ?? null) cells.set(key(p), p);
  }
  return { access: [...cells.values()], gate };
}

interface PlannedHouse { readonly index: number; readonly house: VillageObjectHouse; readonly bbox: Rect }

/** Variable-sized packing reserves whole roofs, yards, water and the exact future boulevard. */
export function buildObjectHouses(project: Project, map: GameMap, area: Rect, plaza: Plaza, target: number,
  catalog: readonly VillageObjectHouse[], args: Readonly<Record<string, unknown>>, intent: VillageIntent,
  seed: number, blocked: ReadonlySet<number>): BuiltHouse[] {
  if (catalog.some(house => house.raster.tilesetId !== map.tilesetId)) throw new ToolError("건물과 마을의 타일셋이 다릅니다.", { code: "village-tileset-mismatch", mapId: map.id });
  const rng = mulberry32(seed);
  const pool = [...catalog].map(house => ({ house, order: rng() })).sort((a, b) => a.order - b.order).map(item => item.house);
  const plans = Array.isArray(args.housePlans) ? args.housePlans as Record<string, unknown>[] : [];
  const compact = args.composition === "compact";
  const compactSelection = compact ? chooseCompactHouses(pool, target, plans) : undefined;
  const selected = Array.from({ length: target }, (_, index) => {
    const id = plans[index]?.objectId;
    const house = compactSelection?.[index] ?? (typeof id === "string" ? catalog.find(entry => entry.design.id === id) : pool[index % pool.length]);
    if (!house) throw new ToolError(`건물 후보가 없습니다: ${String(id)}`, { code: "village-object-missing" });
    return { index, house };
  });
  const fixed = new Set(blocked);
  for (const p of protectedHouseCells(map)) fixed.add(p.y * map.width + p.x);
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    const i = y * map.width + x;
    if (map.lowerTiles[i] !== TILE.GRASS || map.upperTiles[i] !== TILE.EMPTY
      || map.lowerTileStacks?.[i]?.length || map.upperTileStacks?.[i]?.length
      || !isPassableLanding(project, map, x, y)) fixed.add(i);
  }
  for (const event of map.events) fixed.add(event.y * map.width + event.x);
  const plazaMargin = compact ? 1 : 3;
  for (let y = plaza.rect.y - plazaMargin; y < plaza.rect.y + plaza.rect.h + plazaMargin; y++) {
    for (let x = plaza.rect.x - plazaMargin; x < plaza.rect.x + plaza.rect.w + plazaMargin; x++) fixed.add(y * map.width + x);
  }
  let planned: PlannedHouse[] = [];
  // Retry only the cheap plan. Never stamp, clear or repair partially completed houses.
  for (let attempt = 0; attempt < (compact ? 32 : 12); attempt++) {
    const occupied = new Set(fixed), placed: PlannedHouse[] = [];
    const random = mulberry32(seed + attempt * 7919);
    const order = [...selected].sort((a, b) => b.house.raster.width * b.house.raster.height - a.house.raster.width * a.house.raster.height);
    for (const item of order) {
      const { width: w, height: h } = item.house.raster;
      const cols = Math.max(2, Math.round(Math.sqrt(target * area.w / area.h)));
      const rows = Math.ceil(target / cols);
      const slot = (item.index + attempt) % target;
      const inset = compact ? 5 : 0;
      const desired = { x: area.x + inset + ((slot % cols) + 0.5) * (area.w - inset * 2) / cols,
        y: area.y + inset + (Math.floor(slot / cols) + 0.5) * (area.h - inset * 2) / rows };
      const candidates: { bbox: Rect; score: number }[] = [];
      for (let y = area.y + (compact ? 5 : 3); y + h + 5 <= area.y + area.h; y += compact ? 1 : 2) {
        for (let x = area.x + (compact ? 5 : 3); x + w + (compact ? 5 : 3) <= area.x + area.w; x += compact ? 1 : 2) {
          const score = Math.abs(x + w / 2 - desired.x) + Math.abs(y + h / 2 - desired.y) * 1.3 + random() * 3;
          candidates.push({ bbox: { x, y, w, h }, score });
        }
      }
      candidates.sort((a, b) => a.score - b.score);
      const candidate = candidates.find(({ bbox }) => !lotCells(bbox, map.width, compact).some(i => occupied.has(i)));
      if (!candidate) { if (compact) continue; else break; }
      placed.push({ ...item, bbox: candidate.bbox });
      lotCells(candidate.bbox, map.width, compact).forEach(i => occupied.add(i));
    }
    if (placed.length > planned.length) planned = placed;
    if (planned.length === target) break;
  }
  const minimum = args.countPolicy === "best-effort" ? Math.min(target, Math.max(4, Math.ceil(target * 0.85))) : target;
  if (planned.length < minimum) throw new ToolError(`저장된 건물 ${target}채와 마당이 ${area.w}×${area.h}에 들어가지 않습니다(${planned.length}채). 맵을 넓히거나 집 수/큰집 수를 줄여 주세요.`, { code: "village-object-capacity", mapId: map.id });
  return planned.sort((a, b) => a.index - b.index).map(({ house, bbox, index }) => {
    const absolute = (p: Point): Point => ({ x: bbox.x + p.x, y: bbox.y + p.y });
    for (const cell of house.raster.cells) {
      const i = (bbox.y + cell.y) * map.width + bbox.x + cell.x;
      (cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[i] = cell.tile;
    }
    const approaches = house.approaches.map(absolute), access = house.access.map(absolute);
    paintRoadStrip(map, intent.pathStyle, access);
    const primary = approaches[0]!;
    return { bbox, doorAt: { x: primary.x, y: primary.y - 1 }, front: absolute(house.gate),
      doorTiles: { top: 116, bottom: 146 }, kitId: "bright-plaster", stories: 1,
      templateId: house.raster.kitId,
      ...(intent.houseOwners[index] ? { ownerName: intent.houseOwners[index] } : {}),
      ...(intent.housePrograms[index] ? { program: intent.housePrograms[index] } : {}),
      objectExterior: { objectId: house.design.id, revision: house.design.revision, name: house.design.name,
        raster: house.raster, approaches, access } };
  });
}

function lotCells(bbox: Rect, width: number, compact = false): number[] {
  const cells: number[] = [];
  const side = compact ? 1 : 2, front = compact ? 2 : 4;
  for (let y = bbox.y - side; y < bbox.y + bbox.h + front; y++) {
    for (let x = bbox.x - side; x < bbox.x + bbox.w + side; x++) cells.push(y * width + x);
  }
  return cells;
}

/** Independent readback: every source layer cell and every authored doorway must survive. */
export function inspectObjectHouseAccess(project: Project, map: GameMap, houses: readonly BuiltHouse[]): { doors: number; reachable: number; intact: number } {
  const isRoad = environmentalRoadAt(map);
  let doors = 0, reachable = 0, intact = 0;
  for (const house of houses) {
    if (!house.objectExterior) continue;
    const source = house.objectExterior;
    for (const cell of source.raster.cells) {
      const i = (house.bbox.y + cell.y) * map.width + house.bbox.x + cell.x;
      if ((cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[i] !== cell.tile) {
        throw new ToolError(`저장된 건물 외형이 바뀌었습니다: ${source.objectId}@${cell.x},${cell.y}`, { code: "village-object-damaged", mapId: map.id });
      }
    }
    const access = new Set(source.access.filter(p => ROAD_TILES.has(map.lowerTiles[p.y * map.width + p.x] ?? -1)
      && isPassable(project, map, p.x, p.y)).map(p => `${p.x},${p.y}`));
    const seen = new Set<string>(), queue: Point[] = isRoad(house.front.x, house.front.y) ? [house.front] : [];
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!, key = `${p.x},${p.y}`;
      if (seen.has(key) || !access.has(key)) continue;
      seen.add(key);
      for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) queue.push({ x: p.x + dx, y: p.y + dy });
    }
    for (const p of source.approaches) {
      doors++;
      if (seen.has(`${p.x},${p.y}`)) reachable++;
      if (map.lowerTiles[(p.y - 1) * map.width + p.x] === 146 && map.lowerTiles[(p.y - 2) * map.width + p.x] === 116) intact++;
    }
  }
  return { doors, reachable, intact };
}
