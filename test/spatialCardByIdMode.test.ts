// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listSpatialGalleryCards, spatialCardById, spatialPresentationId } from "@/editor/panels/spatialCatalog";
import { visibleSpatialSelection } from "@/editor/panels/spatialStage";
import {
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  selectSpatialOccurrence,
  setSpatialTab,
  spatialSession,
  type SpatialAuthoringSession,
} from "@/editor/panels/spatialAuthoringSession";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { spatialFixture, spatialWire } from "./support/spatialSchemaFixture";

const previous = store.getCurrent();

function sessionFor(patch: Partial<SpatialAuthoringSession>): SpatialAuthoringSession {
  return { ...spatialSession(), ...patch };
}

function collidingSpaceProject(): {
  readonly presentationId: string;
  readonly sourceId: string;
} {
  const { project, document } = spatialFixture();
  const source = document.library.spaces.room;
  if (!source) throw new Error("fixture space missing");
  const presentationId = spatialPresentationId("library-space", "library", source.id);
  const first = document.occurrences["occ-a"];
  const second = document.occurrences["occ-b"];
  if (!first || !second) throw new Error("fixture occurrences missing");
  const colliding = { ...first, id: presentationId };
  const loaded = deserialize(spatialWire(project, {
    ...document,
    occurrences: { [presentationId]: colliding, "occ-b": second },
    rootOccurrenceIds: [presentationId, "occ-b"],
    connections: document.connections.map((link) => (
      link.from.occurrenceId === "occ-a"
        ? { ...link, from: { ...link.from, occurrenceId: presentationId } }
        : link
    )),
  }));
  store.replace(loaded, { preserveEventDrafts: false });
  return { presentationId, sourceId: source.id };
}

function deleteOccurrence(occurrenceId: string): void {
  store.update((draft) => {
    const document = draft.spatialAuthoring;
    if (!document) throw new Error("missing spatialAuthoring");
    const { [occurrenceId]: _removed, ...rest } = document.occurrences;
    draft.spatialAuthoring = {
      ...document,
      occurrences: rest,
      rootOccurrenceIds: document.rootOccurrenceIds.filter((id) => id !== occurrenceId),
      connections: document.connections.filter(
        (link) => link.from.occurrenceId !== occurrenceId && link.to.occurrenceId !== occurrenceId,
      ),
    };
  });
}

beforeEach(() => {
  resetSpatialAuthoringSessions();
  store.replace(createBlankProject(), { preserveEventDrafts: false });
});

afterEach(() => {
  resetSpatialAuthoringSessions();
  store.replace(previous, { preserveEventDrafts: false });
});

describe("spatialCardById mode-local resolution", () => {
  it("does not resolve a deleted occurrence to the live design that shares its opaque id", () => {
    // Given: valid live source and occurrence share only the opaque presentation ID.
    const { presentationId, sourceId } = collidingSpaceProject();
    const beforeDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
    expect(beforeDocument).toEqual(store.getCurrent().spatialAuthoring);
    expect(beforeDocument?.occurrences[presentationId]?.id).toBe(presentationId);
    expect(beforeDocument?.library.spaces[sourceId]?.id).toBe(sourceId);
    expect(presentationId).not.toBe(sourceId);
    setSpatialTab("spaces");
    selectSpatialOccurrence(presentationId);
    const before = spatialCardById(sessionFor({
      tab: "spaces",
      mode: "instances",
      source: "all",
      occurrenceId: presentationId,
    }), presentationId);
    expect(before?.id).toBe(presentationId);
    expect(before?.source).toBe("placed");

    const identity = store.getProjectIdentity();
    // When: delete the occurrence in the current project, including its live links.
    deleteOccurrence(presentationId);

    // Then: IO accepts the deletion without crossing modes or changing identity.
    const afterDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
    expect(afterDocument).toEqual(store.getCurrent().spatialAuthoring);
    expect(afterDocument?.occurrences["occ-b"]).toEqual(beforeDocument?.occurrences["occ-b"]);
    expect(store.getProjectIdentity()).toEqual(identity);
    expect(store.getCurrent().spatialAuthoring?.occurrences[presentationId]).toBeUndefined();
    expect(store.getCurrent().spatialAuthoring?.library.spaces[sourceId]).toBeDefined();

    const session = sessionFor({
      tab: "spaces",
      mode: "instances",
      source: "all",
      occurrenceId: presentationId,
    });
    const resolved = spatialCardById(session, presentationId);
    const visible = visibleSpatialSelection(session);

    expect(session.mode).toBe("instances");
    expect(resolved?.source).not.toBe("own");
    expect(resolved).toBeUndefined();
    expect(visible?.id).not.toBe(presentationId);
    expect(visible?.source).not.toBe("own");
  });

  it("does not resolve a missing design to a placed occurrence that reused the presentation id", () => {
    // Given: the valid source has live place references and frozen occurrence copies.
    const { presentationId, sourceId } = collidingSpaceProject();
    const beforeDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
    expect(beforeDocument).toEqual(store.getCurrent().spatialAuthoring);
    expect(beforeDocument?.library.spaces[sourceId]?.id).toBe(sourceId);
    expect(beforeDocument?.library.places.inn?.children.map((child) => child.source.id)).toEqual([sourceId, sourceId]);
    expect(beforeDocument?.occurrences[presentationId]?.snapshot.library.spaces[sourceId]?.id).toBe(sourceId);
    setSpatialTab("spaces");
    selectSpatialDesign(presentationId);
    const session = sessionFor({
      tab: "spaces",
      mode: "design",
      source: "all",
      designId: presentationId,
    });
    expect(spatialCardById(session, presentationId)?.source).toBe("own");
    const identity = store.getProjectIdentity();

    // When: remove the live strong references and their source in one store operation.
    // Spatial-library deletion has no dedicated domain command in this revision.
    store.update((draft) => {
      const document = draft.spatialAuthoring;
      if (!document) throw new Error("missing spatialAuthoring");
      const inn = document.library.places.inn;
      if (!inn) throw new Error("fixture place missing");
      const places = {
        ...document.library.places,
        inn: { ...inn, children: inn.children.filter((child) => child.source.id !== sourceId) },
      };
      const { [sourceId]: _removed, ...spaces } = document.library.spaces;
      draft.spatialAuthoring = {
        ...document,
        library: { ...document.library, places, spaces },
      };
    });

    // Then: IO accepts the missing live source while all historical occurrences survive.
    const afterDocument = deserialize(serialize(store.getCurrent())).spatialAuthoring;
    expect(afterDocument).toEqual(store.getCurrent().spatialAuthoring);
    expect(store.getProjectIdentity()).toEqual(identity);
    expect(afterDocument?.library.places.inn?.children).toEqual([]);
    expect(afterDocument?.library.spaces[sourceId]).toBeUndefined();
    expect(afterDocument?.occurrences[presentationId]?.id).toBe(presentationId);
    expect(afterDocument?.occurrences).toEqual(beforeDocument?.occurrences);
    const resolved = spatialCardById(session, presentationId);
    expect(session.mode).toBe("design");
    expect(resolved?.source).not.toBe("placed");
    expect(resolved).toBeUndefined();
    expect(spatialCardById(sessionFor({ ...session, mode: "instances" }), presentationId)?.source).toBe("placed");
  });

  it("still resolves a design hidden by the source filter within the same mode", () => {
    // Given: an existing design is hidden by the active source filter.
    setSpatialTab("objects");
    selectSpatialDesign("bed_v");
    const session = sessionFor({ tab: "objects", mode: "design", source: "own", designId: "bed_v" });
    expect(listSpatialGalleryCards(session).some((card) => card.id === "bed_v")).toBe(false);
    // When: resolve that design within the same mode.
    const resolved = spatialCardById(session, "bed_v");
    // Then: the hidden design still resolves without changing its source.
    expect(resolved?.id).toBe("bed_v");
    expect(resolved?.source).toBe("default");
  });
});
