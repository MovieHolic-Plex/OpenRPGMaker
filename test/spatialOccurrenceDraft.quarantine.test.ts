import { expect, it } from "vitest";
import { patchOccurrencePlace } from "@/editor/panels/spatialPlaceDraft";
import { patchOccurrenceSpace } from "@/editor/panels/spatialSpaceDraft";
import { own, requireOccurrenceAssociations } from "@/project/spatial/domain";
import type { SpatialOccurrence } from "@/project/spatial/types";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture } from "./support/spatialPlaceCompilerFixture";

it.each([
  ["space", "contained"], ["space", "root"], ["space", "legacy"],
  ["place", "contained"], ["place", "root"], ["place", "legacy"],
] as const)("preserves %s %s associations when its occurrence snapshot is edited", (kind, association) => {
  // Given: real contained occurrences plus root and historical association representations.
  const project = placeCompilerFixture();
  const document = fixtureDocument(project);
  const found = Object.values(document.occurrences).find(entry => entry.kind === kind && entry.parentId !== null);
  if (!found) throw new TypeError(`Missing contained ${kind}`);
  const contained = requireOccurrenceAssociations(found);
  const { parentSlot: _parentSlot, ...legacyBase } = contained;
  const occurrence: SpatialOccurrence = association === "contained" ? contained
    : association === "root" ? { ...contained, parentId: null, parentSlot: null }
    : { ...legacyBase, snapshot: { ...contained.snapshot,
      ports: contained.snapshot.ports.map(({ localPortId: _localPortId, ...port }) => port),
    } };
  const input = { ...project, spatialAuthoring: { ...document,
    occurrences: { ...document.occurrences, [occurrence.id]: occurrence },
  } };
  const records = kind === "space" ? occurrence.snapshot.library.spaces : occurrence.snapshot.library.places;
  const before = own(records, occurrence.source.id);

  // When: only the selected frozen design revision is edited.
  const output = kind === "space"
    ? patchOccurrenceSpace(input, occurrence.id, space => ({ ...space, revision: space.revision + 1 }))
    : patchOccurrencePlace(input, occurrence.id, place => ({ ...place, revision: place.revision + 1 }));

  // Then: the snapshot edit retains source and association identities without changing the live library.
  const updated = own(fixtureDocument(output).occurrences, occurrence.id);
  const updatedRecords = kind === "space" ? updated.snapshot.library.spaces : updated.snapshot.library.places;
  expect(own(updatedRecords, occurrence.source.id)).toEqual({ ...before, revision: before.revision + 1 });
  const { snapshot: _beforeSnapshot, ...beforeIdentity } = occurrence;
  const { snapshot: _afterSnapshot, ...afterIdentity } = updated;
  expect(afterIdentity).toEqual(beforeIdentity);
  expect(updated.source).toBe(occurrence.source);
  expect(updated.parentSlot).toBe(occurrence.parentSlot);
  expect(updated.snapshot.ports).toBe(occurrence.snapshot.ports);
  expect(updated.snapshot.root).toBe(occurrence.snapshot.root);
  expect(fixtureDocument(output).library).toBe(document.library);
});
