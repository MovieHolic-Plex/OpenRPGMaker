// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  SpatialAuthoringController,
  SpatialAuthoringDraft,
  SpatialAuthoringPreview,
  SpatialAuthoringRequest,
} from "@/editor/spatial/authoringTypes";
import type { SpatialAuthoringSession } from "@/editor/panels/spatialAuthoringSession";
import {
  popSpatialBreadcrumb,
  resetSpatialAuthoringSessions,
  selectSpatialDesign,
  spatialSession,
} from "@/editor/panels/spatialAuthoringSession";
import {
  bindSpatialAuthoringControllerFactory,
  renderSpatialPlacesCanvas,
  renderSpatialPlacesInspector,
  resetSpatialPlacesTabChrome,
  spatialPlacesChrome,
  visiblePlaceSelection,
} from "@/editor/panels/spatialPlacesTab";
import {
  hasAuthoringPreview,
  spatialAuthoringController,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import {
  connectLocal,
  containsPlace,
  nestChild,
  patchOccurrencePlace,
} from "@/editor/panels/spatialPlaceDraft";
import {
  libraryPlaceCardId,
  previewSpaceDependants,
} from "@/editor/panels/spatialPlaceQuery";
import { createSpatialAuthoringController } from "@/editor/spatial/actions";
import { assertNever } from "@/project/spatial/domain";
import { duplicateSpatialOccurrence } from "@/project/spatial/duplicate";
import { spatialId } from "@/project/spatial/domain";
import { store } from "@/project/store";
import type { PlaceDesign, SpatialLibrary } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";

const previous = store.getCurrent();
const issuedDrafts = new WeakSet<SpatialAuthoringDraft>();
const issuedPreviews = new WeakSet<SpatialAuthoringPreview>();
let lastRequest: SpatialAuthoringRequest | null = null;

function libraryOf(project: Project): SpatialLibrary {
  const library = project.spatialAuthoring?.library;
  if (!library) throw new Error("missing library");
  return library;
}

function villageOf(project: Project): PlaceDesign {
  const village = Object.values(libraryOf(project).places).find((place) => place.kind === "settlement");
  if (!village) throw new Error("missing village");
  return village;
}

function innOf(project: Project): PlaceDesign {
  const inn = Object.values(libraryOf(project).places).find((place) => place.kind === "facility");
  if (!inn) throw new Error("missing inn");
  return inn;
}

function sessionFor(place: PlaceDesign, mode: SpatialAuthoringSession["mode"] = "design"): SpatialAuthoringSession {
  return {
    tab: "places",
    mode,
    source: "own",
    designId: libraryPlaceCardId(place.id),
    occurrenceId: mode === "instances" ? placeRoot : null,
    camera: { x: 0, y: 0, zoom: 1 },
    breadcrumb: [],
    legacyOrigin: null,
    placeKindFilter: null,
    regionKindFilter: null,
    inspectorOpen: true,
  };
}

function placeCard(place: PlaceDesign, source: "own" | "placed" = "own") {
  return {
    id: source === "placed" ? placeRoot : libraryPlaceCardId(place.id),
    localId: source === "placed" ? String(place.id) : place.id,
    name: place.name,
    source,
    kind: "places" as const,
    usage: 0,
    placeKind: place.kind,
  };
}

function diamondLibrary(): SpatialLibrary {
  const node = (id: string, kids: readonly string[]): PlaceDesign => ({
    id: spatialId(id),
    name: id,
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    kind: "settlement",
    layout: "manual",
    ports: [],
    connections: [],
    children: kids.map((kid, index) => ({
      id: spatialId(`${id}-${index}`),
      source: { kind: "place" as const, id: spatialId(kid) },
      x: 0,
      y: 0,
      level: 0,
    })),
  });
  return {
    objects: {},
    spaces: {},
    places: {
      A: node("A", ["B", "D"]),
      B: node("B", ["C"]),
      C: node("C", []),
      D: node("D", ["C"]),
      E: node("E", []),
    },
    regions: {},
    worlds: {},
  };
}

function handleController(): SpatialAuthoringController {
  return {
    createDraft: (from) => {
      const draft = { project: structuredClone(from?.project ?? store.getCurrent()) };
      issuedDrafts.add(draft);
      return { kind: "ok", value: draft };
    },
    continueDraft: (preview) => {
      if (!issuedPreviews.has(preview)) {
        return { kind: "error", error: { code: "foreign-preview", message: "foreign-preview" } };
      }
      const draft = { project: structuredClone(preview.project) };
      issuedDrafts.add(draft);
      return { kind: "ok", value: draft };
    },
    preview: (draft, request) => {
      lastRequest = request;
      if (!issuedDrafts.has(draft)) {
        return { kind: "error", error: { code: "foreign-draft", message: "foreign-draft" } };
      }
      switch (request.operation.kind) {
        case "edit":
        case "edit-connection":
        case "instantiate":
        case "clone-occurrence":
        case "clone-design":
        case "delete-occurrence":
        case "delete-design":
        case "detach":
          break;
        case "refresh": {
          const compiledMembers = Object.values(draft.project.spatialAuthoring?.occurrences ?? {})
            .some((occurrence) => occurrence.bindings.length > 0);
          if (compiledMembers && request.compile === undefined) {
            return {
              kind: "error",
              error: { code: "invalid", message: "Refreshing compiled content requires explicit compilation" },
            };
          }
          break;
        }
        default:
          return assertNever(request.operation);
      }
      const preview = { project: draft.project, impact: { mapIds: [], occurrenceIds: [], events: [] } };
      issuedPreviews.add(preview);
      return { kind: "ok", value: preview };
    },
    apply: (preview) => {
      if (!issuedPreviews.has(preview)) {
        return { kind: "error", error: { code: "foreign-preview", message: "foreign-preview" } };
      }
      store.replace(preview.project);
      return { kind: "ok", value: { changed: true, impact: preview.impact } };
    },
    undo: () => false,
    redo: () => false,
  };
}

beforeEach(() => {
  lastRequest = null;
  store.replace(placeCompilerFixture(7));
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  bindSpatialAuthoringControllerFactory(() => handleController());
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialPlacesTabChrome();
  resetSpatialAuthoringSessions();
  store.replace(previous);
});

describe("spatial place actions", () => {
  it("keeps nested inn and square child identities when another inn slot is added", () => {
    const project = store.getCurrent();
    const village = villageOf(project);
    const inn = innOf(project);
    const before = village.children.map((child) => child.id);
    const result = nestChild(village, libraryOf(project), {
      id: spatialId("inn-again"),
      source: { kind: "place", id: inn.id },
      x: 8,
      y: 8,
      level: 0,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected nest");
    expect(result.place.children.map((child) => child.source.id)).toEqual([
      ...village.children.map((child) => child.source.id),
      inn.id,
    ]);
    expect(village.children.map((child) => child.id)).toEqual(before);
  });

  it("appends a floor connection without rewriting existing connection ids", () => {
    const inn = innOf(store.getCurrent());
    const first = inn.children[0];
    const second = inn.children[1];
    if (!first || !second) throw new Error("missing floors");
    const existing = inn.connections.map((link) => link.id);
    const result = connectLocal(inn, {
      id: spatialId("floor-link-1-2"),
      from: { childId: first.id, portId: spatialId("landing") },
      to: { childId: second.id, portId: spatialId("landing") },
      bidirectional: true,
    });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") throw new Error("expected link");
    expect(result.place.connections.map((link) => link.id)).toEqual([...existing, spatialId("floor-link-1-2")]);
    expect(inn.connections.map((link) => link.id)).toEqual(existing);
  });

  it("shows space dependants before a referenced room can be deleted", () => {
    const impact = previewSpaceDependants(store.getCurrent(), spaceDesign);
    expect(impact?.strong.length).toBeGreaterThan(0);
    expect(impact?.strong.some((entry) => entry.path.includes("children"))).toBe(true);
  });

  it("does not rewrite a sibling occurrence snapshot after duplicate", () => {
    const project = store.getCurrent();
    const document = project.spatialAuthoring;
    if (!document) throw new Error("missing document");
    const duplicated = duplicateSpatialOccurrence(document, project, {
      occurrenceId: placeRoot,
      rootId: "nested-village-b",
      externalConnections: "omit",
    });
    const sibling = spatialId("nested-village-b");
    store.replace({ ...project, spatialAuthoring: duplicated });
    const originalChildren = duplicated.occurrences[placeRoot]?.kind === "place"
      ? duplicated.occurrences[placeRoot].snapshot.library.places[villageOf(project).id]?.children.length
      : 0;
    const patched = patchOccurrencePlace(store.getCurrent(), placeRoot, (place) => ({ ...place, children: [] }));
    expect(patched.spatialAuthoring?.occurrences[placeRoot]?.kind === "place"
      ? patched.spatialAuthoring.occurrences[placeRoot].snapshot.library.places[villageOf(project).id]?.children
      : undefined).toEqual([]);
    expect(patched.spatialAuthoring?.occurrences[sibling]?.kind === "place"
      ? patched.spatialAuthoring.occurrences[sibling].snapshot.library.places[villageOf(project).id]?.children.length
      : 0).toBe(originalChildren);
    expect(patched.spatialAuthoring?.library.places[villageOf(project).id]?.children.length).toBe(originalChildren);
  });

  it("rejects ancestor nesting without mutating children", () => {
    const project = store.getCurrent();
    const village = villageOf(project);
    const inn = innOf(project);
    const before = inn.children.slice();
    const result = nestChild(inn, libraryOf(project), {
      id: spatialId("illegal-village"),
      source: { kind: "place", id: village.id },
      x: 0,
      y: 0,
      level: 1,
    });
    expect(result).toEqual({ kind: "rejected", code: "ancestor", place: inn });
    expect(inn.children).toEqual(before);
  });

  it("rejects a missing-floor link without appending connections", () => {
    const inn = innOf(store.getCurrent());
    const first = inn.children[0];
    if (!first) throw new Error("missing floor");
    const before = inn.connections.slice();
    const result = connectLocal(inn, {
      id: spatialId("ghost-floor"),
      from: { childId: first.id, portId: spatialId("landing") },
      to: { childId: spatialId("floor-missing"), portId: spatialId("landing") },
      bidirectional: true,
    });
    expect(result).toEqual({ kind: "rejected", code: "missing-floor", place: inn });
    expect(inn.connections).toEqual(before);
  });

  it("keeps source edits off the live store until apply", () => {
    bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
    const village = villageOf(store.getCurrent());
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialPlacesInspector(placeCard(village), true, paint));
    };
    paint();
    const layout = host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-layout-row']");
    expect(layout).not.toBeNull();
    layout?.click();
    expect(store.getCurrent().spatialAuthoring?.library.places[village.id]?.layout).toBe("manual");
    expect(visibleAuthoringProject().spatialAuthoring?.library.places[village.id]?.layout).toBe("row");
    spatialPlacesChrome(placeCard(village), () => undefined).preview?.();
    spatialPlacesChrome(placeCard(village), () => undefined).apply?.();
    expect(store.getCurrent().spatialAuthoring?.library.places[village.id]?.layout).toBe("row");
  });

  it("rejects a reconstructed draft handle on preview", () => {
    const controller = spatialAuthoringController();
    const created = controller?.createDraft();
    expect(created?.kind).toBe("ok");
    const foreign: SpatialAuthoringDraft = { project: structuredClone(store.getCurrent()) };
    const result = controller?.preview(foreign, { operation: { kind: "edit" } });
    expect(result?.kind).toBe("error");
    if (result?.kind === "error") expect(result.error.code).toBe("foreign-draft");
  });

  it("leaves clone, delete, refresh and detach on a proposal until apply", () => {
    const village = villageOf(store.getCurrent());
    const live = store.getCurrent();
    expect(spatialPlacesChrome(placeCard(village), () => undefined).apply).toBeUndefined();
    spatialPlacesChrome(placeCard(village), () => undefined).duplicate?.();
    expect(store.getCurrent()).toBe(live);
    expect(lastRequest?.operation.kind).toBe("clone-design");
    expect(hasAuthoringPreview()).toBe(true);
    expect(spatialPlacesChrome(placeCard(village), () => undefined).apply).toBeTypeOf("function");

    resetSpatialPlacesTabChrome();
    bindSpatialAuthoringControllerFactory(() => handleController());
    lastRequest = null;
    const placedLive = store.getCurrent();
    const placed = placeCard(village, "placed");
    spatialPlacesChrome(placed, () => undefined).refresh?.();
    expect(store.getCurrent()).toBe(placedLive);
    expect(lastRequest?.operation.kind).toBe("refresh");
    expect(lastRequest?.compile).toEqual({ occurrenceId: placeRoot });
    expect(hasAuthoringPreview()).toBe(true);

    lastRequest = null;
    spatialPlacesChrome(placed, () => undefined).detach?.();
    expect(store.getCurrent()).toBe(placedLive);
    expect(lastRequest?.operation.kind).toBe("detach");

    lastRequest = null;
    const deleting = spatialPlacesChrome(placeCard(village), () => undefined);
    deleting.delete?.();
    spatialPlacesChrome(placeCard(village), () => undefined).onDeleteConfirm?.();
    expect(store.getCurrent()).toBe(placedLive);
    expect(lastRequest?.operation.kind).toBe("delete-design");
  });

  it("renders floor strip, picker, port links and exterior controls", () => {
    const inn = innOf(store.getCurrent());
    const host = document.createElement("div");
    host.append(renderSpatialPlacesCanvas(sessionFor(inn), placeCard(inn), () => undefined));
    expect(host.querySelector("[data-testid='spatial-place-floors']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-place-floor-1']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-place-picker']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-place-exterior']")).not.toBeNull();
    expect(host.querySelector("[data-testid='spatial-places-board']")).not.toBeNull();
  });

  it("navigates into a nested place and restores selection on back", () => {
    const village = villageOf(store.getCurrent());
    const inn = innOf(store.getCurrent());
    const innChild = village.children.find((child) => child.source.id === inn.id);
    if (!innChild) throw new Error("missing inn child");
    selectSpatialDesign(libraryPlaceCardId(village.id));
    const host = document.createElement("div");
    document.body.append(host);
    const paint = (): void => {
      host.replaceChildren(renderSpatialPlacesCanvas({
        ...sessionFor(village),
        designId: spatialSession().designId,
        breadcrumb: spatialSession().breadcrumb,
      }, placeCard(village), paint));
    };
    paint();
    const token = host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${innChild.id}']`);
    expect(token).not.toBeNull();
    token?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
    board?.focus();
    board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(spatialSession().designId).toBe(libraryPlaceCardId(inn.id));
    expect(spatialSession().breadcrumb.length).toBe(1);
    popSpatialBreadcrumb();
    expect(spatialSession().designId).toBe(libraryPlaceCardId(village.id));
    host.remove();
  });

  it("disables refresh when the live source is missing", () => {
    const village = villageOf(store.getCurrent());
    const chrome = spatialPlacesChrome({
      ...placeCard(village, "placed"),
      missingSource: true,
    }, () => undefined);
    expect(chrome.refresh).toBeUndefined();
    expect(chrome.preview).toBeTypeOf("function");
  });

  it("does not treat a diamond revisit as reaching an unrelated place", () => {
    const library = diamondLibrary();
    const unrelated = library.places.E;
    const root = library.places.A;
    if (!unrelated || !root) throw new Error("missing diamond");
    expect(containsPlace(library, spatialId("A"), spatialId("E"))).toBe(false);
    const nested = nestChild(unrelated, library, {
      id: spatialId("nest-a"),
      source: { kind: "place", id: root.id },
      x: 0,
      y: 0,
      level: 0,
    });
    expect(nested.kind).toBe("ok");
  });

  it("rejects nesting an ancestor under a descendant", () => {
    const library = diamondLibrary();
    const root = library.places.A;
    const leaf = library.places.C;
    if (!root || !leaf) throw new Error("missing cycle pair");
    const cycle = nestChild(leaf, library, {
      id: spatialId("cycle-a"),
      source: { kind: "place", id: root.id },
      x: 0,
      y: 0,
      level: 0,
    });
    expect(cycle).toEqual({ kind: "rejected", code: "ancestor", place: leaf });
  });

  it("authors a first empty place on the detached draft", () => {
    const project = store.getCurrent();
    const spatial = project.spatialAuthoring;
    if (!spatial) throw new Error("missing document");
    store.replace({
      ...project,
      spatialAuthoring: { ...spatial, library: { ...spatial.library, places: {} } },
    });
    const live = store.getCurrent();
    spatialPlacesChrome(undefined, () => undefined).add?.();
    expect(store.getCurrent()).toBe(live);
    expect(Object.keys(live.spatialAuthoring?.library.places ?? {})).toEqual([]);
    const created = Object.values(visibleAuthoringProject().spatialAuthoring?.library.places ?? {});
    expect(created).toHaveLength(1);
    expect(created[0]?.children).toEqual([]);
    expect(created[0]?.ports).toEqual([]);
    expect(created[0]?.connections).toEqual([]);
    expect(created[0]?.tags).toEqual([]);
    const selected = visiblePlaceSelection(undefined);
    expect(selected?.localId).toBe(created[0]?.id);
    expect(spatialSession().designId).toBe(selected?.id);
    const host = document.createElement("div");
    const paint = (): void => {
      host.replaceChildren(renderSpatialPlacesInspector(visiblePlaceSelection(undefined), true, paint));
    };
    paint();
    const name = host.querySelector<HTMLInputElement>("[data-testid='spatial-place-name']");
    expect(name).not.toBeNull();
    name!.value = "호숫가";
    name!.dispatchEvent(new Event("change"));
    expect(store.getCurrent()).toBe(live);
    const named = Object.values(visibleAuthoringProject().spatialAuthoring?.library.places ?? {})[0];
    expect(named?.name).toBe("호숫가");
  });
});
