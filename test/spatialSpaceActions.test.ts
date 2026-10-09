// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import { bindSpatialAuthoringControllerFactory } from "@/editor/panels/spatialAuthoringAccess";
import { compileSpaces } from "@/editor/spatial/compileSpaces";
import { requireOccurrenceAssociations } from "@/project/spatial/domain";
import {
  freshSpatialId,
  librarySpaceCardId,
  spaceDraftTarget,
  usedSpatialIds,
} from "@/editor/panels/spatialSpaceDraft";
import { SPACE_TILE_PX, renderSpatialSpacesCanvas } from "@/editor/panels/spatialSpaceCanvas";
import {
  renderSpatialSpacesInspector,
  resetSpatialSpacesTabChrome,
  spatialSpacesChrome,
} from "@/editor/panels/spatialSpacesTab";
import { mutateWorkingSpace, workingProject } from "@/editor/panels/spatialSpaceCommands";
import { store } from "@/project/store";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { identityAuthoringController, reconstructDraft } from "./support/spatialAuthoringIdentity";
import {
  fixtureDocument,
  reinstantiateSpace,
  spaceCompilerFixture,
  spaceDesign,
  spaceRoot,
} from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();

function session(): SpatialAuthoringSession {
  return {
    tab: "spaces",
    mode: "design",
    source: "own",
    designId: librarySpaceCardId(spaceDesign),
    occurrenceId: null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
    inspectorOpen: true,
  };
}

function spaceCard() {
  return {
    id: librarySpaceCardId(spaceDesign),
    localId: spaceDesign,
    name: "Compiler room",
    source: "own" as const,
    kind: "spaces" as const,
    usage: 0,
  };
}

function placedCard() {
  return {
    id: spaceRoot,
    localId: spaceDesign,
    name: "Compiler room",
    source: "placed" as const,
    kind: "spaces" as const,
    usage: 0,
  };
}

beforeEach(() => {
  store.replace(spaceCompilerFixture(7));
  resetSpatialSpacesTabChrome();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialSpacesTabChrome();
  store.replace(previous);
});

describe("spatial space actions", () => {
  it("keeps the issued draft handle so reconstructed wrappers are foreign-draft", () => {
    const controller = identityAuthoringController();
    const created = controller.createDraft();
    if (created.kind !== "ok") throw new Error("draft");
    const rebuilt = reconstructDraft(created.value.project);
    expect(controller.preview(rebuilt, { operation: { kind: "edit" } }).kind).toBe("error");
    expect(controller.preview(created.value, { operation: { kind: "edit" } }).kind).toBe("ok");
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialSpacesInspector(spaceCard(), true, paint));
    };
    paint();
    const input = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
    const baseline = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width;
    input!.value = "14";
    input!.dispatchEvent(new Event("change"));
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(baseline);
    expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
    chrome.preview?.();
    expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
    spatialSpacesChrome(spaceCard(), paint).apply?.();
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.width).toBe(14);
  });

  it("does not apply clone/delete/refresh until explicit preview", () => {
    const before = JSON.stringify(store.getCurrent().spatialAuthoring);
    const placed = spatialSpacesChrome(placedCard(), () => undefined);
    placed.duplicate?.();
    placed.refresh?.();
    expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
    const owned = spatialSpacesChrome(spaceCard(), () => undefined);
    owned.delete?.();
    spatialSpacesChrome(spaceCard(), () => undefined).onDeleteConfirm?.();
    expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
    owned.preview?.();
    expect(JSON.stringify(store.getCurrent().spatialAuthoring)).toBe(before);
  });

  it("refuses apply without a visible preview", () => {
    const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
    chrome.add?.();
    const current = spatialSpacesChrome(spaceCard(), () => undefined);
    expect(current.apply).toBeUndefined();
    current.apply?.();
    expect(store.getCurrent().spatialAuthoring?.library.spaces["untitled-space-1"]).toBeUndefined();
  });

  it("compiles placed edits through the preview request", () => {
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialSpacesInspector(placedCard(), true, paint));
    };
    paint();
    const width = host.querySelector<HTMLInputElement>("[data-testid='spatial-space-width']");
    width!.value = "16";
    width!.dispatchEvent(new Event("change"));
    spatialSpacesChrome(placedCard(), paint).preview?.();
    spatialSpacesChrome(placedCard(), paint).apply?.();
    const project = store.getCurrent();
    const spatialDocument = fixtureDocument(project);
    const compiled = compileSpaces({
      project,
      document: spatialDocument,
      occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
    });
    expect(compiled.ports.length).toBeGreaterThan(0);
    expect(compiled.map.width).toBeGreaterThan(0);
  });

  it("empties slots through preview/apply then compile", () => {
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
    };
    paint();
    const before = store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots.length ?? 0;
    expect(before).toBeGreaterThan(0);
    mutateWorkingSpace(spaceDraftTarget(spaceCard()), (space) => ({ ...space, objectSlots: [] }));
    spatialSpacesChrome(spaceCard(), paint).preview?.();
    spatialSpacesChrome(spaceCard(), paint).apply?.();
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots).toEqual([]);
    const rebuilt = reinstantiateSpace(store.getCurrent(), (space) => space);
    const spatialDocument = fixtureDocument(rebuilt);
    const compiled = compileSpaces({
      project: rebuilt,
      document: spatialDocument,
      occurrence: requireOccurrenceAssociations(spatialDocument.occurrences[spaceRoot]!),
    });
    expect(compiled.objects).toEqual([]);
  });

  it("nudges a slot by pointer tiles and Escape restores the origin", () => {
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      host.replaceChildren(renderSpatialSpacesCanvas(session(), spaceCard(), paint));
    };
    paint();
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-space-board']");
    const slot = host.querySelector<HTMLButtonElement>("[data-testid='spatial-slot-hearth']");
    expect(board).not.toBeNull();
    expect(slot).not.toBeNull();
    board!.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 288, width: 480, height: 288, toJSON: () => undefined,
    });
    const origin = workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
      .find((entry) => entry.id === "hearth");
    expect(origin?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
    slot!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 12, clientY: 12 }));
    board!.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 3 * SPACE_TILE_PX + 1, clientY: 5 * SPACE_TILE_PX + 1 }));
    expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
      .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 3, y: 5 });
    board!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(workingProject().spatialAuthoring?.library.spaces[spaceDesign]?.objectSlots
      .find((entry) => entry.id === "hearth")?.placement).toEqual({ mode: "fixed", x: 1, y: 4 });
    host.remove();
  });

  it("adds a source space and clones a placed occurrence without silent no-op", () => {
    const source = spatialSpacesChrome(spaceCard(), () => undefined);
    expect(source.add).toBeTypeOf("function");
    const before = new Set(Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}));
    source.add?.();
    spatialSpacesChrome(spaceCard(), () => undefined).preview?.();
    spatialSpacesChrome(spaceCard(), () => undefined).apply?.();
    const added = Object.keys(store.getCurrent().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
    expect(added).toHaveLength(1);
    expect(store.getCurrent().spatialAuthoring?.library.spaces[added[0] ?? ""]?.objectSlots).toEqual([]);
    resetSpatialSpacesTabChrome();
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const placed = spatialSpacesChrome(placedCard(), () => undefined);
    expect(placed.duplicate).toBeTypeOf("function");
    expect(placed.delete).toBeTypeOf("function");
  });

  it("does not reuse a library-wide id on repeated add or clone allocation", () => {
    const project = store.getCurrent();
    const objectId = Object.keys(project.spatialAuthoring?.library.objects ?? {})[0];
    expect(objectId).toBeTruthy();
    const first = freshSpatialId(project, "space");
    const second = freshSpatialId(project, "space");
    expect(first).not.toBe(second);
    expect(usedSpatialIds(project).has(first)).toBe(false);
    expect(first).not.toBe(objectId);
    const occupied = structuredClone(project);
    if (!occupied.spatialAuthoring) throw new Error("missing document");
    occupied.spatialAuthoring.library.objects = {
      ...occupied.spatialAuthoring.library.objects,
      [first]: occupied.spatialAuthoring.library.objects[objectId!],
    };
    expect(freshSpatialId(occupied, "space")).not.toBe(first);
    const chrome = spatialSpacesChrome(spaceCard(), () => undefined);
    const before = new Set(Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}));
    chrome.add?.();
    chrome.add?.();
    const added = Object.keys(workingProject().spatialAuthoring?.library.spaces ?? {}).filter((id) => !before.has(id));
    expect(added).toHaveLength(2);
    expect(added[0]).not.toBe(added[1]);
    chrome.duplicate?.();
    chrome.duplicate?.();
    expect(store.getCurrent().spatialAuthoring?.library.spaces[spaceDesign]?.id).toBe(spaceDesign);
  });
});
