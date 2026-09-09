import { createSpatialAuthoringController } from "../../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../../src/editor/mapEditHistory";
import { own, requireOccurrenceAssociations, spatialId } from "../../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../../src/project/spatial/duplicate";
import { store } from "../../src/project/store";
import { authoringValue } from "./spatialAuthoringFixture";
import { fixtureDocument, reinstantiateSpace, spaceCompilerFixture, spaceRoot } from "./spatialSpaceCompilerFixture";

export const repeatedSlot = spatialId("repeated-hearth");
export const selectedMember = { slotId: repeatedSlot, index: 2 };
export const opaqueMemberId = spatialId("opaque selected member");

/** Re-instantiation is fixture setup only. Every action uses the real issued controller. */
export function placedSpaceFixture() {
  const project = reinstantiateSpace(spaceCompilerFixture(19), space => ({ ...space,
    objectSlots: [{ id: repeatedSlot, objectDesignId: spatialId("hearth-design"), quantity: 3,
      required: true, placement: { mode: "fixed", x: 1, y: 4 }, chipOverrides: [] }],
    ports: [space.ports[0] ?? { id: spatialId("entry"), name: "Entry", x: 8, y: 11 },
      { id: spatialId("west"), name: "West", x: 1, y: 10 }],
  }));
  const doc = fixtureDocument(project);
  const root = requireOccurrenceAssociations(own(doc.occurrences, spaceRoot));
  const children = Object.values(doc.occurrences).filter(child => child.parentId === spaceRoot).map(requireOccurrenceAssociations);
  project.spatialAuthoring = { ...doc, occurrences: Object.fromEntries([
    ...children.filter(child => child.parentSlot?.index !== 1).reverse().map(child => {
      const selected = child.parentSlot?.index === 2;
      const id = selected ? opaqueMemberId : spatialId("opaque first member");
      const object = own(child.snapshot.library.objects, child.source.id);
      return [id, { ...child, id, x: selected ? 8 : 1, snapshot: { ...child.snapshot,
        library: { ...child.snapshot.library, objects: { [object.id]: { ...object, chips: selected ? [] : ["event"] } } } } }];
    }),
    [spaceRoot, { ...root, snapshot: { ...root.snapshot, ports: root.snapshot.ports.map((port, index) =>
      ({ ...port, id: spatialId(`opaque landing ${index}`) })).reverse() } }],
  ]) };
  project.spatialAuthoring = duplicateSpatialOccurrence(project.spatialAuthoring, project,
    { occurrenceId: spaceRoot, rootId: "sibling room", externalConnections: "omit" });
  const compiled = compileSpatialOccurrence(compileSpatialOccurrence(project, { occurrenceId: spaceRoot }), { occurrenceId: spatialId("sibling room") });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compiled);
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  return { controller, draft: authoringValue(controller.createDraft()), occurrenceId: spaceRoot, compile: { occurrenceId: spaceRoot } };
}
