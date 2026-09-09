/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import {
  bindSpatialAuthoringControllerFactory,
  hasAuthoringPreview,
  visibleAuthoringProject,
} from "../src/editor/panels/spatialAuthoringAccess";
import {
  patchSpatialSession,
  popSpatialBreadcrumb,
  resetSpatialAuthoringSessions,
  spatialSession,
} from "../src/editor/panels/spatialAuthoringSession";
import { renderSpatialPlacesCanvas } from "../src/editor/panels/spatialPlaceCanvas";
import { placeChromeState, resetSpatialPlacesTabChrome } from "../src/editor/panels/spatialPlaceChromeState";
import { spatialPlacesChrome } from "../src/editor/panels/spatialPlaceCommands";
import { renderSpatialPlacesInspector } from "../src/editor/panels/spatialPlaceInspector";
import { libraryPlaceCardId } from "../src/editor/panels/spatialPlaceQuery";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { placedPlaceChildren } from "../src/editor/spatial/placedPlaceEdits";
import { own, resolveOccurrencePortId, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { placeChild, placeCompilerFixture, placeRoot, stairFloors } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(compileSpatialOccurrence(placeCompilerFixture(19), { occurrenceId: placeRoot }));
  resetMapEditHistory();
  resetSpatialAuthoringSessions();
  resetSpatialPlacesTabChrome();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
});

afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetSpatialPlacesTabChrome();
  resetSpatialAuthoringSessions();
  resetMapEditHistory();
  store.replace(previous);
  vi.clearAllTimers();
  vi.useRealTimers();
});

function villageCard() {
  const sourceId = own(fixtureDocument(store.getCurrent()).occurrences, placeRoot).source.id;
  return {
    id: placeRoot,
    localId: String(sourceId),
    name: "Village",
    source: "placed" as const,
    kind: "places" as const,
    usage: 0,
  };
}

function innCard() {
  const innId = placeChild(store.getCurrent(), placeRoot, "inn");
  const sourceId = own(fixtureDocument(store.getCurrent()).occurrences, innId).source.id;
  return {
    id: innId,
    localId: String(sourceId),
    name: "Inn",
    source: "placed" as const,
    kind: "places" as const,
    usage: 0,
    placeKind: "facility" as const,
  };
}

function mountVillage(rerender?: () => void) {
  patchSpatialSession({
    tab: "places",
    mode: "instances",
    occurrenceId: placeRoot,
    designId: null,
    camera: { x: 12, y: 8, zoom: 2 },
    inspectorOpen: true,
  });
  const host = document.createElement("div");
  document.body.append(host);
  const paint = rerender ?? ((): void => {
    host.replaceChildren(renderSpatialPlacesCanvas(spatialSession(), villageCard(), paint));
  });
  paint();
  return { host, paint, card: villageCard() };
}

it("renders and selects actual child occurrence ids rather than frozen slot ids", () => {
  const innId = placeChild(store.getCurrent(), placeRoot, "inn");
  const { host } = mountVillage();
  expect(host.querySelector(`[data-testid='spatial-place-child-${innId}']`)).not.toBeNull();
  expect(host.querySelector("[data-testid='spatial-place-child-inn']")).toBeNull();
  expect(host.querySelector("[data-testid='spatial-member-inn-0']")).not.toBeNull();
  host.remove();
});

it("sizes the raster world inside a board scrollport instead of stretching the board", () => {
  const { host } = mountVillage();
  const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
  const world = host.querySelector<HTMLElement>("[data-testid='spatial-places-world']");
  const viewport = host.querySelector("[data-testid='spatial-places-viewport']");
  const actions = host.querySelector("[data-testid='spatial-place-link-actions']");
  expect(board).not.toBeNull();
  expect(world).not.toBeNull();
  expect(viewport?.contains(board)).toBe(true);
  expect(board?.style.width).toBe("");
  expect(world?.style.width).toMatch(/px$/);
  expect(board?.contains(world)).toBe(true);
  expect(actions).not.toBeNull();
  expect(board?.contains(actions)).toBe(false);
  expect(viewport?.contains(actions)).toBe(false);
  host.remove();
});

it("keeps village tokens visible when a leftover nested floor filter is still selected", () => {
  const innId = placeChild(store.getCurrent(), placeRoot, "inn");
  placeChromeState.selectedFloor = 2;
  const { host } = mountVillage();
  expect(host.querySelector(`[data-testid='spatial-place-child-${innId}']`)).not.toBeNull();
  expect(placeChromeState.selectedFloor).toBeNull();
  host.remove();
});

it("instantiates a picker add through the adapter without adopting the live store", () => {
  const before = structuredClone(store.getCurrent());
  const innSource = own(fixtureDocument(before).occurrences, placeChild(before, placeRoot, "inn")).source.id;
  const { host, paint } = mountVillage();
  const pick = host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-pick-${innSource}']`);
  expect(pick).not.toBeNull();
  pick?.click();
  paint();
  expect(store.getCurrent()).toEqual(before);
  expect(hasAuthoringPreview()).toBe(true);
  const added = placedPlaceChildren(visibleAuthoringProject(), placeRoot)
    .filter((child) => child.source.id === innSource);
  expect(added).toHaveLength(2);
  expect(new Set(added.map((child) => child.occurrenceId)).size).toBe(2);
  for (const child of added) {
    expect(host.querySelector(`[data-testid='spatial-place-child-${child.occurrenceId}']`)).not.toBeNull();
  }
  host.remove();
});

it("nudges only the selected actual repeated child and keeps siblings frozen until apply", () => {
  const before = structuredClone(store.getCurrent());
  const innId = placeChild(before, placeRoot, "inn");
  const squareId = placeChild(before, placeRoot, "square");
  const origin = own(fixtureDocument(before).occurrences, innId);
  const { host, paint } = mountVillage();
  host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${innId}']`)
    ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
  board?.focus();
  board?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  paint();
  expect(store.getCurrent()).toEqual(before);
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, innId)).toMatchObject({
    x: origin.x + 1, y: origin.y,
  });
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, squareId)).toEqual(
    own(fixtureDocument(before).occurrences, squareId),
  );
  spatialPlacesChrome(villageCard(), () => undefined).apply?.();
  expect(own(fixtureDocument(store.getCurrent()).occurrences, innId)).toMatchObject({ x: origin.x + 1 });
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  host.remove();
});

it("changes the selected facility room floor through validators and deletes only that room", () => {
  const before = structuredClone(store.getCurrent());
  const innId = placeChild(before, placeRoot, "inn");
  const room1 = placeChild(before, innId, "floor-1");
  const room2 = placeChild(before, innId, "floor-2");
  patchSpatialSession({ tab: "places", mode: "instances", occurrenceId: innId, designId: null });
  const host = document.createElement("div");
  const card = innCard();
  const paint = (): void => {
    host.replaceChildren(
      renderSpatialPlacesCanvas(spatialSession(), card, paint),
      renderSpatialPlacesInspector(card, true, paint),
    );
  };
  paint();
  host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${room2}']`)
    ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  paint();
  const level = host.querySelector<HTMLInputElement>("[data-testid='spatial-place-child-level']");
  expect(level).not.toBeNull();
  level!.value = "3";
  level!.dispatchEvent(new Event("change"));
  paint();
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, room2)).toMatchObject({ level: 3 });
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, room1).level).toBe(
    own(fixtureDocument(before).occurrences, room1).level,
  );
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-child-delete']")?.click();
  paint();
  expect(fixtureDocument(visibleAuthoringProject()).occurrences[room2]).toBeUndefined();
  expect(fixtureDocument(visibleAuthoringProject()).occurrences[room1]).toBeDefined();
  expect(store.getCurrent()).toEqual(before);
  host.remove();
});

it("creates retargets and removes an actual floor link without hardcoded landing endpoints", () => {
  const before = structuredClone(store.getCurrent());
  const floors = stairFloors(before);
  const lower = floors[0];
  const upper = floors[1];
  const other = floors[2];
  if (!lower || !upper || !other) throw new TypeError("missing stair floors");
  const innId = placeChild(before, placeRoot, "inn");
  patchSpatialSession({ tab: "places", mode: "instances", occurrenceId: innId, designId: null });
  const host = document.createElement("div");
  const card = innCard();
  const paint = (): void => {
    host.replaceChildren(renderSpatialPlacesCanvas(spatialSession(), card, paint));
  };
  paint();
  const from = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-from']");
  const fromPort = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-from-port']");
  const to = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-to']");
  const toPort = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-to-port']");
  expect(from && fromPort && to && toPort).toBeTruthy();
  from!.value = lower.upId;
  from!.dispatchEvent(new Event("change"));
  fromPort!.value = "landing";
  fromPort!.dispatchEvent(new Event("change"));
  to!.value = upper.stairId;
  to!.dispatchEvent(new Event("change"));
  toPort!.value = "landing";
  toPort!.dispatchEvent(new Event("change"));
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-connect']")?.click();
  paint();
  const created = fixtureDocument(visibleAuthoringProject()).connections.find((link) =>
    link.from.occurrenceId === lower.upId && link.to.occurrenceId === upper.stairId);
  expect(created).toMatchObject({
    from: { occurrenceId: lower.upId, portId: lower.upPortId },
    to: { occurrenceId: upper.stairId, portId: upper.portId },
  });
  expect(created?.from.portId).toBe(resolveOccurrencePortId(
    own(fixtureDocument(visibleAuthoringProject()).occurrences, lower.upId), spatialId("landing"),
  ));
  placeChromeState.selectedConnectionId = created!.id;
  paint();
  const retargetTo = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-to']");
  const retargetPort = host.querySelector<HTMLSelectElement>("[data-testid='spatial-place-connect-to-port']");
  retargetTo!.value = other.stairId;
  retargetTo!.dispatchEvent(new Event("change"));
  retargetPort!.value = "landing";
  retargetPort!.dispatchEvent(new Event("change"));
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-connect']")?.click();
  paint();
  const replaced = own(
    Object.fromEntries(fixtureDocument(visibleAuthoringProject()).connections.map((link) => [link.id, link])),
    created!.id,
  );
  expect(replaced.to.occurrenceId).toBe(other.stairId);
  host.querySelector<HTMLButtonElement>("[data-testid='spatial-place-disconnect']")?.click();
  paint();
  expect(fixtureDocument(visibleAuthoringProject()).connections.some((link) => link.id === created!.id)).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  host.remove();
});

it("drills the actual child destination and restores the nondefault camera on Back", () => {
  const innId = placeChild(store.getCurrent(), placeRoot, "inn");
  const { host, paint } = mountVillage();
  host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${innId}']`)
    ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
  board?.focus();
  board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  expect(spatialSession()).toMatchObject({
    tab: "places",
    mode: "instances",
    occurrenceId: innId,
    designId: null,
  });
  expect(spatialSession().designId).not.toBe(libraryPlaceCardId(
    own(fixtureDocument(store.getCurrent()).occurrences, innId).source.id,
  ));
  popSpatialBreadcrumb();
  expect(spatialSession()).toMatchObject({
    tab: "places",
    mode: "instances",
    occurrenceId: placeRoot,
    camera: { x: 12, y: 8, zoom: 2 },
  });
  paint();
  host.remove();
});

it("cancels an in-progress pointer gesture with Escape before any preview", () => {
  const before = structuredClone(store.getCurrent());
  const innId = placeChild(before, placeRoot, "inn");
  const origin = own(fixtureDocument(before).occurrences, innId);
  const { host, paint } = mountVillage();
  const token = host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${innId}']`);
  const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
  board!.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: 480, bottom: 480, width: 480, height: 480, toJSON: () => ({}),
  });
  token?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: origin.x * 24, clientY: origin.y * 24 }));
  board?.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: (origin.x + 3) * 24, clientY: origin.y * 24 }));
  board?.focus();
  board?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  paint();
  expect(hasAuthoringPreview()).toBe(false);
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, innId)).toMatchObject({ x: origin.x, y: origin.y });
  expect(store.getCurrent()).toEqual(before);
  host.remove();
});

it("keeps a placed clone uncompiled until an explicit later compile and shows deletion impacts", () => {
  const card = villageCard();
  spatialPlacesChrome(card, () => undefined).duplicate?.();
  const cloneId = spatialSession().occurrenceId;
  expect(cloneId).not.toBe(placeRoot);
  expect(own(fixtureDocument(visibleAuthoringProject()).occurrences, cloneId ?? "missing").bindings).toEqual([]);
  placeChromeState.deleteOpen = true;
  const host = document.createElement("div");
  host.append(renderSpatialPlacesInspector(card, true, () => undefined));
  const impact = host.querySelector("[data-testid='spatial-delete-impact']")?.textContent ?? "";
  expect(impact).toMatch(/맵|이벤트|연결/);
  host.remove();
});

it("rejects apply after a foreign live edit without adopting the stale preview", () => {
  const innId = placeChild(store.getCurrent(), placeRoot, "inn");
  const { host, paint } = mountVillage();
  host.querySelector<HTMLButtonElement>(`[data-testid='spatial-place-child-${innId}']`)
    ?.dispatchEvent(new Event("pointerdown", { bubbles: true }));
  const board = host.querySelector<HTMLElement>("[data-testid='spatial-places-board']");
  board?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  paint();
  expect(hasAuthoringPreview()).toBe(true);
  store.replace({ ...store.getCurrent(), meta: { ...store.getCurrent().meta, title: "foreign-live" } });
  const before = structuredClone(store.getCurrent());
  const result = authoringValue;
  void result;
  const applied = spatialPlacesChrome(villageCard(), () => undefined);
  applied.apply?.();
  expect(store.getCurrent().meta.title).toBe("foreign-live");
  expect(store.getCurrent()).toEqual(before);
  host.remove();
});
