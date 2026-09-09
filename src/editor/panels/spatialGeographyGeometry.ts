import { WORLD_TERRAIN_BLOCKS } from "@/project/defaults/worldTerrainAutotiles";
import type {
  RegionDesign,
  SpatialChildSlot,
  SpatialFloorArea,
  SpatialId,
  SpatialLocalConnection,
  SpatialLocalEndpoint,
  SpatialPoint,
  SpatialPort,
  SpatialRoute,
  SpatialTerrain,
  WorldDesign,
} from "@/project/spatial/types";
import type {
  GeographyDesign,
  GeographyEditResult,
  GeographyRejection,
} from "@/editor/panels/spatialGeographyDraft";

export const GEOGRAPHY_MATERIALS = [
  "ground",
  "water",
  ...WORLD_TERRAIN_BLOCKS.map((block) => block.key),
  "mountain:grass",
  "mountain:dirt",
  "mountain:snow",
] as const;
export type GeographyMaterial = (typeof GEOGRAPHY_MATERIALS)[number];

export function geographyChildren(design: GeographyDesign): readonly SpatialChildSlot<"place" | "region">[] {
  return "places" in design ? design.places : design.regions;
}

export function worldCrossingPoints(from: SpatialPoint, to: SpatialPoint): readonly SpatialPoint[] {
  if (from.x === to.x || from.y === to.y) return [from, to];
  return [from, { x: to.x, y: from.y }, to];
}

function rejected<T extends GeographyDesign>(design: T, code: GeographyRejection): GeographyEditResult<T> {
  return { kind: "rejected", code, design };
}

export function inTerrainBounds(terrain: SpatialTerrain, x: number, y: number): boolean {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < terrain.width && y < terrain.height;
}

export function isSupportedMaterial(material: string): material is GeographyMaterial {
  for (const entry of GEOGRAPHY_MATERIALS) {
    if (entry === material) return true;
  }
  return false;
}

function polylineIssue(terrain: SpatialTerrain, points: readonly SpatialPoint[]): GeographyRejection | null {
  if (points.length < 2) return "endpoint";
  for (const [index, to] of points.entries()) {
    if (!inTerrainBounds(terrain, to.x, to.y)) return "clipped";
    const from = points[index - 1];
    if (!from) continue;
    if (from.x !== to.x && from.y !== to.y) return "diagonal";
  }
  return null;
}

function endpointAt(
  children: readonly SpatialChildSlot<"place" | "region">[],
  ports: readonly SpatialPort[],
  end: SpatialLocalEndpoint,
): SpatialPoint | undefined {
  if (end.childId === null) return ports.find((port) => port.id === end.portId);
  const child = children.find((entry) => entry.id === end.childId);
  return child ? { x: child.x, y: child.y } : undefined;
}

function samePoint(a: SpatialPoint | undefined, b: SpatialPoint | undefined): boolean {
  return Boolean(a && b && a.x === b.x && a.y === b.y);
}

export function moveGeographyChild(
  design: RegionDesign,
  childId: SpatialId,
  x: number,
  y: number,
): GeographyEditResult<RegionDesign>;
export function moveGeographyChild(
  design: WorldDesign,
  childId: SpatialId,
  x: number,
  y: number,
): GeographyEditResult<WorldDesign>;
export function moveGeographyChild(
  design: GeographyDesign,
  childId: SpatialId,
  x: number,
  y: number,
): GeographyEditResult {
  const nx = Math.trunc(x);
  const ny = Math.trunc(y);
  if ("places" in design) {
    const child = design.places.find((entry) => entry.id === childId);
    if (!child) return rejected(design, "unknown-child");
    if (child.level !== 0) return rejected(design, "level");
    if (!inTerrainBounds(design.terrain, nx, ny)) return rejected(design, "clipped");
    const places: RegionDesign["places"] = design.places.map((entry) => (
      entry.id === childId ? { ...entry, x: nx, y: ny } : entry
    ));
    const routes: SpatialRoute[] = [];
    for (const route of design.routes) {
      const points = route.points.map((point, index) => {
        if (route.from.childId === childId && index === 0) return { x: nx, y: ny };
        if (route.to.childId === childId && index === route.points.length - 1) return { x: nx, y: ny };
        return point;
      });
      const issue = polylineIssue(design.terrain, points);
      if (issue) return rejected(design, issue);
      const from = endpointAt(places, design.ports, route.from);
      const to = endpointAt(places, design.ports, route.to);
      if (!samePoint(points[0], from) || !samePoint(points[points.length - 1], to)) {
        return rejected(design, "endpoint");
      }
      routes.push({ ...route, points });
    }
    return { kind: "ok", design: { ...design, places, routes } };
  }
  const child = design.regions.find((entry) => entry.id === childId);
  if (!child) return rejected(design, "unknown-child");
  if (child.level !== 0) return rejected(design, "level");
  if (!inTerrainBounds(design.terrain, nx, ny)) return rejected(design, "clipped");
  const regions: WorldDesign["regions"] = design.regions.map((entry) => (
    entry.id === childId ? { ...entry, x: nx, y: ny } : entry
  ));
  return { kind: "ok", design: { ...design, regions } };
}

export function setRegionRoute(
  region: RegionDesign,
  routeId: SpatialId,
  points: readonly SpatialPoint[],
): GeographyEditResult<RegionDesign> {
  const route = region.routes.find((entry) => entry.id === routeId);
  if (!route) return rejected(region, "unknown-child");
  const issue = polylineIssue(region.terrain, points);
  if (issue) return rejected(region, issue);
  const from = endpointAt(region.places, region.ports, route.from);
  const to = endpointAt(region.places, region.ports, route.to);
  if (!samePoint(points[0], from) || !samePoint(points[points.length - 1], to)) return rejected(region, "endpoint");
  return {
    kind: "ok",
    design: {
      ...region,
      routes: region.routes.map((entry) => (entry.id === routeId ? { ...entry, points } : entry)),
    },
  };
}

export function setWorldEntry(world: WorldDesign, entry: SpatialLocalEndpoint): GeographyEditResult<WorldDesign> {
  if (!endpointAt(world.regions, world.ports, entry)) return rejected(world, "port");
  return { kind: "ok", design: { ...world, entryPort: entry } };
}

export function setWorldCrossing(
  world: WorldDesign,
  connectionId: SpatialId,
  from: SpatialLocalEndpoint,
  to: SpatialLocalEndpoint,
): GeographyEditResult<WorldDesign> {
  if (!world.connections.some((entry) => entry.id === connectionId)) return rejected(world, "unknown-child");
  if (!endpointAt(world.regions, world.ports, from) || !endpointAt(world.regions, world.ports, to)) {
    return rejected(world, "port");
  }
  const next: SpatialLocalConnection = { id: connectionId, from, to, bidirectional: true };
  return {
    kind: "ok",
    design: {
      ...world,
      connections: world.connections.map((entry) => (entry.id === connectionId ? next : entry)),
    },
  };
}

export function setGeographyPort<T extends GeographyDesign>(
  design: T,
  portId: SpatialId,
  x: number,
  y: number,
): GeographyEditResult<T> {
  const nx = Math.trunc(x);
  const ny = Math.trunc(y);
  if (!design.ports.some((port) => port.id === portId)) return rejected(design, "port");
  if (!inTerrainBounds(design.terrain, nx, ny)) return rejected(design, "clipped");
  return {
    kind: "ok",
    design: {
      ...design,
      ports: design.ports.map((port) => (port.id === portId ? { ...port, x: nx, y: ny } : port)),
    },
  };
}

export function setTerrainFloor<T extends GeographyDesign>(design: T, floor: string): GeographyEditResult<T> {
  if (!isSupportedMaterial(floor)) return rejected(design, "material");
  return { kind: "ok", design: { ...design, terrain: { ...design.terrain, floor } } };
}

export function setTerrainAreas<T extends GeographyDesign>(
  design: T,
  areas: readonly SpatialFloorArea[],
): GeographyEditResult<T> {
  if (areas.some((area) => !isSupportedMaterial(area.material))) return rejected(design, "material");
  return { kind: "ok", design: { ...design, terrain: { ...design.terrain, areas } } };
}
