import { checkedDocument } from "@/project/spatial/domain";
import type { Project } from "@/project/types";
import { assertSpatialToolChange } from "./spatialToolState";
import { ToolError } from "./types";

/** Containment alone is not navigation: inspect actual generated transfers. */
export function spatialReachableMaps(project: Project, startMapId: string): ReadonlySet<string> {
  const reached = new Set([startMapId]);
  for (const mapId of reached) {
    const map = project.maps[mapId];
    if (!map) continue;
    for (const event of map.events) for (const page of event.pages ?? []) for (const command of page.commands) {
      if (command.kind === "transfer") reached.add(command.mapId);
    }
  }
  return reached;
}

/** Permit only validated new canonical interiors within the facade's independently declared maps. */
export function spatialConstructionEnvelope(before: Project, after: Project, mapIds: readonly string[]): Project {
  if (before.spatialAuthoring === undefined && after.spatialAuthoring === undefined) return after;
  assertSpatialToolChange(after, before);
  const original = checkedDocument(before.spatialAuthoring, before);
  const proposed = checkedDocument(after.spatialAuthoring, after);
  const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
  const fail = () => { throw new ToolError("Construction changed existing spatial authoring", { code: "spatial-ownership" }); };
  if (!same(original.library, proposed.library) || !same(original.legacyImport, proposed.legacyImport)) fail();
  for (const [id, occurrence] of Object.entries(original.occurrences)) if (!same(occurrence, proposed.occurrences[id])) fail();
  if (!original.rootOccurrenceIds.every(id => proposed.rootOccurrenceIds.includes(id))) fail();
  for (const connection of original.connections) if (!proposed.connections.some(value => same(value, connection))) fail();
  const allowed = new Set(mapIds);
  for (const occurrence of Object.values(proposed.occurrences)) {
    if (Object.hasOwn(original.occurrences, occurrence.id)) continue;
    if (occurrence.bindings.some(binding => !allowed.has(binding.mapId))) fail();
  }
  for (const connection of before.mapConnections ?? []) if (!(after.mapConnections ?? []).some(value => same(value, connection))) fail();
  for (const connection of after.mapConnections ?? []) {
    if ((before.mapConnections ?? []).some(value => value.id === connection.id)) continue;
    if (!allowed.has(connection.from.mapId) || !allowed.has(connection.to.mapId)) fail();
  }
  return { ...after, spatialAuthoring: before.spatialAuthoring, mapConnections: before.mapConnections };
}
