import { resolveOverviewEndpoint } from "@/project/spatial/overview";
import { settlementVillageBuild } from "./settlementVillageBuild";
import { designNode, own, requireOccurrenceAssociations } from "@/project/spatial/domain";
import { compositionOf } from "@/project/spatial/composition";
import type { SpatialAssociatedOccurrence, SpatialCompiledBinding, SpatialId, SpatialLibrary, SpatialPoint } from "@/project/spatial/types";
import type { GameMap } from "@/project/types";
import { compileSpaces } from "./compileSpaces";
import { frozenObject, objectPorts, placedObject } from "./compileObjects";
import { geographyTerrain, settlementTerrain } from "./geographyTerrain";
import { PARAMETRIC_INTERIOR_TILESET_ID } from "./spaceLayout";
import { SpatialCompileError, type CompiledObject, type SpatialCompileContext, type SpatialRasterProposal } from "./compilerTypes";

export function hasMixedComposition(library: SpatialLibrary): boolean {
  return [library.spaces, library.places, library.regions, library.worlds].some(records => Object.values(records).some(design => design.composition));
}
export type MixedProjection = { readonly occurrence: SpatialAssociatedOccurrence; readonly rect: SpatialCompiledBinding["rect"]; readonly ports: SpatialCompiledBinding["ports"] };
export type MixedRaster = SpatialRasterProposal & { readonly projections: readonly MixedProjection[] };
function translateObject(object: CompiledObject, point: SpatialPoint): CompiledObject {
  const shift = <T extends SpatialPoint>(value: T): T => ({ ...value, x: value.x + point.x, y: value.y + point.y });
  return { ...object, origin: shift(object.origin), rect: shift(object.rect), placement: { ...object.placement,
    cells: object.placement.cells.map(shift), anchor: shift(object.placement.anchor) } };
}
/** Frozen occurrence tree -> one explicit tile canvas. Legacy records stay on their old compiler unless a composition is present. */
export function mixedCompositionRaster(context: SpatialCompileContext): MixedRaster {
  const { occurrence, project, document } = context;
  const node = designNode(occurrence.snapshot.library, occurrence.source);
  const composition = compositionOf(node);
  const directIds = new Set(composition?.members.map(member => member.id));
  const children = Object.values(document.occurrences).filter(child => child.parentId === occurrence.id).map(requireOccurrenceAssociations);
  if (children.some(child => child.level !== 0)) throw new SpatialCompileError("kind", "여러 층 설계는 한 캔버스로 합칠 수 없습니다. 기존 층별 편집을 사용해 주세요.");
  if ((node.kind === "region" && node.design.routes.length) || (node.kind === "world" && node.design.connections.length)) {
    throw new SpatialCompileError("connection", "개요 지도 경로가 있는 설계는 기존 지도 시공을 사용해 주세요. 복합 캔버스 전환 전에 경로를 정리해야 합니다.");
  }
  let base: GameMap | undefined;
  let entry: SpatialPoint | undefined;
  let objects: CompiledObject[] = [];
  const omitted: SpatialId[] = [];
  let projections: MixedProjection[] = [];
  let shellPadded = false;
  if (node.kind === "object") {
    const object = placedObject(occurrence, { x: 0, y: 0 }, false);
    const frozen = frozenObject(occurrence).raster;
    base = { id: `spatial:${occurrence.id}`, name: node.design.name, tilesetId: frozen.tilesetId,
      tileSize: own(project.tilesets, frozen.tilesetId).tileSize, width: frozen.width, height: frozen.height,
      lowerTiles: Array(frozen.width * frozen.height).fill(-1), upperTiles: Array(frozen.width * frozen.height).fill(-1), events: [] };
    for (const cell of frozen.cells) (cell.layer === "lower" ? base.lowerTiles : base.upperTiles)[cell.y * base.width + cell.x] = cell.tile;
    objects = [object];
  } else if (node.kind === "space" && composition && node.design.environment === "interior" && node.design.tilesetId !== PARAMETRIC_INTERIOR_TILESET_ID) {
    // A room captured from a painted map on another atlas: its canvas already holds every cell,
    // so there is no parametric shell to generate (spaceLayout only speaks the default atlas).
    if (node.design.objectSlots.length) throw new SpatialCompileError("atlas", `${occurrence.id}: object slots need ${PARAMETRIC_INTERIOR_TILESET_ID}`);
  } else if (node.kind === "space") {
    const raster = compileSpaces(context);
    shellPadded = node.design.environment === "interior";
    base = raster.map; entry = raster.entry; objects = [...raster.objects]; omitted.push(...raster.omitted);
    projections = objects.map(object => ({ occurrence: object.occurrence, rect: object.rect, ports: objectPorts(object) }));
  } else if (node.kind === "region" || node.kind === "world") {
    if (!composition || composition.tilesetId === node.design.terrain.tilesetId) {
      base = node.kind === "region" && node.design.settlement
        ? settlementTerrain(project, node.design.terrain, { id: `spatial:${occurrence.id}`, name: node.design.name })
        : geographyTerrain(project, node.design.terrain, { id: `spatial:${occurrence.id}`, name: node.design.name });
    }
    if (base && node.kind === "region" && node.design.settlement) {
      const draft = structuredClone(project);
      draft.maps[base.id] = base;
      settlementVillageBuild(draft, { mapId: base.id, presetId: node.design.settlement.presetId, seed: node.design.settlement.seed, interior: false });
      base = draft.maps[base.id];
    }
  } else if (node.design.exterior) {
    const frozen = own(occurrence.snapshot.kitCells, node.design.id);
    base = { id: `spatial:${occurrence.id}`, name: node.design.name, tilesetId: frozen.tilesetId,
      tileSize: own(project.tilesets, frozen.tilesetId).tileSize, width: frozen.width, height: frozen.height,
      lowerTiles: Array(frozen.width * frozen.height).fill(-1), upperTiles: Array(frozen.width * frozen.height).fill(-1), events: [] };
    for (const cell of frozen.cells) (cell.layer === "lower" ? base.lowerTiles : base.upperTiles)[cell.y * base.width + cell.x] = cell.tile;
  }
  const nested = children.filter(child => node.kind !== "space" || directIds.has(child.parentSlot?.slotId!))
    .map(child => ({ child, raster: mixedCompositionRaster({ ...context, occurrence: child }) }));
  const tilesetId = composition?.tilesetId ?? base?.tilesetId ?? nested[0]?.raster.map.tilesetId;
  if (!tilesetId) throw new SpatialCompileError("atlas", `${occurrence.id}: choose a canvas tileset`);
  const width = composition?.width ?? Math.max(base?.width ?? 1, ...nested.map(({ child, raster }) => child.x + raster.map.width));
  const height = composition?.height ?? Math.max(base?.height ?? 1, ...nested.map(({ child, raster }) => child.y + raster.map.height));
  const map: GameMap = { id: `spatial:${occurrence.id}`, name: node.design.name, tilesetId,
    tileSize: own(project.tilesets, tilesetId).tileSize, width, height,
    lowerTiles: Array(width * height).fill(-1), upperTiles: Array(width * height).fill(-1), events: [] };
  const copy = (source: GameMap, offset: SpatialPoint, clip: boolean): void => {
    if (source.tilesetId !== tilesetId) throw new SpatialCompileError("atlas", `${occurrence.id}: ${source.tilesetId} / ${tilesetId}`);
    for (const event of source.events) map.events.push({ ...structuredClone(event), x: event.x + offset.x, y: event.y + offset.y });
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      const dx = offset.x + x, dy = offset.y + y;
      if (dx < 0 || dy < 0 || dx >= width || dy >= height) {
        if (!clip) throw new SpatialCompileError("clipped", occurrence.id);
        continue;
      }
      for (const layer of ["lowerTiles", "upperTiles"] as const) {
        const tile = source[layer][y * source.width + x];
        if (tile !== -1) map[layer][dy * width + dx] = tile;
      }
    }
  };
  if (base) copy(base, { x: 0, y: 0 }, true);
  for (const cell of composition?.tiles ?? []) (cell.layer === "lower" ? map.lowerTiles : map.upperTiles)[cell.y * width + cell.x] = cell.tile;
  for (const { child, raster } of nested) {
    copy(raster.map, child, false);
    objects.push(...raster.objects.map(object => translateObject(object, child)));
    omitted.push(...raster.omitted);
    projections.push(...raster.projections.map(projection => ({ ...projection,
      rect: { ...projection.rect, x: projection.rect.x + child.x, y: projection.rect.y + child.y },
      ports: projection.ports.map(port => ({ ...port, x: port.x + child.x, y: port.y + child.y })) })));
  }
  const ports = occurrence.snapshot.ports.map(port => ({ portId: port.id, x: port.x, y: port.y }));
  // Ports on a generated interior shell are floor-local; painted canvases and direct members use canvas-local positions.
  if (shellPadded) for (const port of ports) { port.x += 2; port.y += 4; }
  const rect = { x: 0, y: 0, width, height };
  projections.unshift({ occurrence, rect, ports });
  if (projections.some(({ rect }) => rect.x < 0 || rect.y < 0 || rect.x + rect.width > width || rect.y + rect.height > height)) {
    throw new SpatialCompileError("clipped", `${occurrence.id}: 배치된 항목보다 캔버스를 작게 줄일 수 없습니다.`);
  }
  const selector = node.kind === "world" ? resolveOverviewEndpoint(document, occurrence.id, node.design.entryPort) : undefined;
  const selectedEntry = selector ? projections.find(item => item.occurrence.id === selector.occurrenceId)?.ports.find(port => port.portId === selector.portId) : undefined;
  return { map, entry: selectedEntry ?? ports[0] ?? entry ?? { x: 0, y: 0 }, rect, objects, ports, omitted, projections };
}
