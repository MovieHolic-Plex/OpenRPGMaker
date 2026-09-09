import { commitGeographyEdit, geographyFromProject } from "../../src/editor/panels/spatialGeographyDraft";
import { moveGeographyChild } from "../../src/editor/panels/spatialGeographyGeometry";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../../src/editor/spatial/compilerValidation";
import { deserialize, serialize } from "../../src/project/io";
import { isOwnedSpatialBinding } from "../../src/project/spatial/bindings";
import { assertNever, findOccurrenceChildId, own, spatialId } from "../../src/project/spatial/domain";
import type { SpatialId } from "../../src/project/spatial/types";
import type { Project } from "../../src/project/types";
import { geographyControllerInput } from "./spatialGeographyControllerFixture";
import { geographyRoot } from "./spatialGeographyFixture";
import { fixtureDocument } from "./spatialSpaceCompilerFixture";

export function geographyMotionFixture(): Project {
  const input = deserialize(serialize(geographyControllerInput("world")));
  const document = fixtureDocument(input);
  const third = motionChild(input, geographyRoot, "third");
  input.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
    [third]: { ...own(document.occurrences, third), x: 53 } } };
  const project = compileSpatialOccurrence(input, { occurrenceId: geographyRoot });
  const compiled = fixtureDocument(project);
  // Legal persisted pair identities deliberately differ from compiler-generated spellings.
  const ids = new Map<string, string>();
  for (const owner of Object.values(compiled.occurrences)) for (const binding of owner.bindings.filter(isOwnedSpatialBinding)) {
    for (const entry of binding.overviewEntries ?? []) {
      ids.set(entry.eventId, `opaque-enter-${ids.size}`);
      ids.set(entry.returnEventId, `opaque-return-${ids.size}`);
    }
  }
  for (const map of Object.values(project.maps)) map.events = map.events.map(event => ids.has(event.id)
    ? { ...event, id: ids.get(event.id) ?? event.id, name: `Saved ${event.id}` }
    : event);
  project.mapConnections = project.mapConnections?.map(link => ({ ...link, id: ids.get(link.id) ?? link.id }));
  project.spatialAuthoring = { ...compiled, occurrences: Object.fromEntries(Object.values(compiled.occurrences).map(owner => [owner.id,
    { ...owner, bindings: owner.bindings.map(binding => {
      if (!isOwnedSpatialBinding(binding)) return binding;
      const next = { ...binding, eventIds: binding.eventIds.map(id => ids.get(id) ?? id),
        ...(binding.overviewEntries ? { overviewEntries: binding.overviewEntries.map(entry => ({ ...entry,
          eventId: ids.get(entry.eventId) ?? entry.eventId, returnEventId: ids.get(entry.returnEventId) ?? entry.returnEventId })) } : {}) };
      return { ...next, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), next) };
    }) }])) };
  return deserialize(serialize(project));
}

export function motionChild(project: Project, parentId: SpatialId, slot: string): SpatialId {
  const id = findOccurrenceChildId(fixtureDocument(project), parentId, { slotId: spatialId(slot), index: 0 });
  if (!id) throw new TypeError("Missing associated child");
  return id;
}

export function moveMotionChild(project: Project, move: { readonly parentId: SpatialId; readonly slot: string; readonly x: number }): Project {
  const parent = own(fixtureDocument(project).occurrences, move.parentId);
  switch (parent.kind) {
    case "world": case "region": break;
    case "object": case "space": case "place": throw new TypeError("Expected geography parent");
    default: return assertNever(parent);
  }
  const target = { cardId: parent.id, localId: parent.source.id, name: "Motion", source: "placed", kind: parent.kind, occurrenceId: parent.id } as const;
  const design = geographyFromProject(project, target);
  if (!design) throw new TypeError("Missing frozen geography");
  const children = "places" in design ? design.places : design.regions;
  const child = children.find(child => child.id === move.slot);
  if (!child) throw new TypeError("Missing frozen child slot");
  return commitGeographyEdit(project, target, "places" in design
    ? moveGeographyChild(design, spatialId(move.slot), move.x, child.y)
    : moveGeographyChild(design, spatialId(move.slot), move.x, child.y));
}
