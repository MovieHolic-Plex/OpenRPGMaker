import { checkedDocument, own, spatialId } from "@/project/spatial/domain";
import { isOwnedSpatialBinding } from "@/project/spatial/bindings";
import { choice } from "@/project/spatial/guardValues";
import { computeReachableCells } from "@/project/lint/reachability";
import { isPassableLanding } from "@/project/collision";
import type { Project } from "@/project/types";
import type { createHouseInteriorMap, HouseInteriorProgram, HouseInteriorScale, InteriorMapResult } from "../houseInteriors";
import { createHouseInteriorExitEvent } from "../houseInteriors";
import { resolveHouseConcept } from "../interiorConceptPlan";
import { authorizeSpatialToolChange } from "../tools/spatialToolState";
import { spatialReachableMaps } from "../tools/spatialConstructionScope";
import { ToolError } from "../tools/types";
import { canonicalConceptSource } from "./legacyConcepts";
import { previewSpatialAuthoring } from "./preview";
import { spatialRasterDigest } from "./compilerValidation";
import { spaceLayout } from "./spaceLayout";

type Input = Parameters<typeof createHouseInteriorMap>[0] & { readonly project: Project };
/** Legacy facade adds only its explicit outside return, after canonical frozen compilation. */
export function createCanonicalHouseInterior(input: Input, style: { readonly scale: HouseInteriorScale; readonly program: HouseInteriorProgram }): InteriorMapResult {
  const { project } = input;
  const resolved = resolveHouseConcept(project, style.program);
  const source = canonicalConceptSource(project, resolved.bundle.id, resolved.tilesetId);
  if (!source) throw new ToolError("Canonical facility unavailable", { code: "concept-not-found" });
  const rootId = spatialId(input.id);
  const preview = previewSpatialAuthoring(project, {
    operation: { kind: "instantiate", request: { source, rootId, x: 0, y: 0, level: 0, seed: input.seed, generatorVersion: "spatial-legacy-house-v1", origin: "ai" } },
    compile: { occurrenceId: rootId },
  }, { original: project, checkpoint: project });
  const compiled = structuredClone(preview.project);
  const document = checkedDocument(compiled.spatialAuthoring, compiled);
  const created = preview.impact.occurrenceIds.map(id => own(document.occurrences, id));
  const spaces = created.filter(occurrence => occurrence.kind === "space");
  const entrance = spaces.find(occurrence => {
    const space = own(occurrence.snapshot.library.spaces, occurrence.source.id);
    return space.environment === "interior" && space.role === "entrance";
  }) ?? spaces[0];
  if (!entrance) throw new ToolError("Canonical house has no interior space", { code: "spatial-empty" });
  const binding = entrance.bindings.find(isOwnedSpatialBinding);
  if (!binding) throw new ToolError("Canonical house has no owned entry map", { code: "spatial-entry" });
  const map = own(compiled.maps, binding.mapId);
  const space = own(entrance.snapshot.library.spaces, entrance.source.id);
  const layout = spaceLayout(compiled, space, { mapId: map.id, seed: entrance.seed });
  const reachable = computeReachableCells(compiled, map, layout.entry.x, layout.entry.y);
  const exit = [layout.entry, ...map.lowerTiles.map((_, index) => ({ x: index % map.width, y: Math.floor(index / map.width) }))]
    .find(cell => reachable.has(`${cell.x},${cell.y}`) && !map.events.some(event => event.x === cell.x && event.y === cell.y)
      && isPassableLanding(compiled, map, cell.x, cell.y));
  if (!exit || !isPassableLanding(project, own(project.maps, input.returnMapId), input.returnX, input.returnY)) {
    throw new ToolError("Linked house requires passable entry and return landings", { code: "spatial-entry" });
  }
  const entry = [{ x: exit.x, y: exit.y - 1 }, { x: exit.x - 1, y: exit.y }, { x: exit.x + 1, y: exit.y }, { x: exit.x, y: exit.y + 1 }]
    .find(cell => reachable.has(`${cell.x},${cell.y}`) && !map.events.some(event => event.x === cell.x && event.y === cell.y)
      && isPassableLanding(compiled, map, cell.x, cell.y));
  if (!entry) throw new ToolError("Linked house exit needs an adjacent landing", { code: "spatial-entry" });
  if (Object.values(compiled.maps).some(map => map.events.some(event => event.id === input.exitEventId))) throw new ToolError("Exit event id collision", { code: "spatial-ownership" });
  map.events.push(createHouseInteriorExitEvent({ eventId: input.exitEventId, ...exit, returnMapId: input.returnMapId,
    returnX: input.returnX, returnY: input.returnY, seed: input.seed }));
  const updatedBinding = { ...binding, eventIds: [...binding.eventIds, input.exitEventId] };
  compiled.spatialAuthoring = checkedDocument({ ...document, occurrences: { ...document.occurrences,
    [entrance.id]: { ...entrance, bindings: entrance.bindings.map(current => current === binding
      ? { ...updatedBinding, contentDigest: spatialRasterDigest(map, updatedBinding) } : current) },
  } }, compiled);
  const mapIds = [map.id, ...preview.impact.mapIds.filter(id => id !== map.id)];
  const reachableMaps = spatialReachableMaps(compiled, map.id);
  const disconnected = mapIds.find(id => !reachableMaps.has(id));
  if (disconnected) throw new ToolError(`Canonical interior needs authored port connections: ${disconnected}`, { code: "spatial-connection" });
  const floors = mapIds.map(mapId => ({ floor: Math.max(1, spaces.find(space => space.bindings.some(binding => binding.mapId === mapId))?.level ?? 1),
    mapId, map: own(compiled.maps, mapId) }));
  const stories = choice([1, 2, 3] as const)(Math.max(...floors.map(floor => floor.floor)), "canonical house stories");
  const upper = floors.find(floor => floor.floor === 2);
  const before = structuredClone(project);
  // Callers hold their in-progress exterior map object. Never replace that map/dictionary.
  for (const mapId of preview.impact.mapIds) {
    if (Object.hasOwn(project.maps, mapId)) throw new ToolError(`Map collision: ${mapId}`, { code: "spatial-ownership" });
  }
  for (const mapId of preview.impact.mapIds) project.maps[mapId] = own(compiled.maps, mapId);
  project.mapTree = compiled.mapTree;
  project.mapConnections = compiled.mapConnections;
  project.spatialAuthoring = compiled.spatialAuthoring;
  authorizeSpatialToolChange(project, before);
  return { ...style, map, entry, exit, stories, floors, interiorSource: "authored", ...(upper ? { upperMapId: upper.mapId, upperMap: upper.map } : {}) };
}
