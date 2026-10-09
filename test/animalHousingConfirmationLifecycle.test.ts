/**
 * Expected-correct confirmation lifecycle regression (Task13 attempt4).
 *
 * Asserts ownership reset through real public UI boundaries:
 * - editor: openDatabaseModal / requestDatabaseModalClose
 * - project: store.replaceProject (same-ID wire reload)
 * - runtime: closeStatusMenu + startSession with the SAME placement id
 *
 * Ordinary same-context rerender may still confirm; explicit cancel clears pending.
 * Does NOT import private pending/arm reset helpers (those are the fix surface).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { openDatabaseModal, requestDatabaseModalClose } from "@/editor/panels/databaseModal";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { closeStatusMenu } from "@/player/playerStatusMenuMotion";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

function createFakeLocalStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => void values.delete(key),
    setItem: (key: string, value: string) => void values.set(key, value),
  } as Storage;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-09-06T12:00:00Z"));
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      clearTimeout,
      localStorage: createFakeLocalStorage(),
      setTimeout: (handler: TimerHandler, ms?: number): number => {
        // Keep modal grace/dock paths from hanging under fake time: run zero-delay work immediately.
        if (typeof handler === "function" && (ms ?? 0) === 0) {
          handler();
          return 0;
        }
        if (typeof handler === "function") {
          return setTimeout(handler, ms) as unknown as number;
        }
        return 0;
      },
      matchMedia: () => ({ matches: false, addEventListener: () => undefined, removeEventListener: () => undefined }),
    },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
});

afterEach(() => {
  requestDatabaseModalClose("battleTest");
  document.querySelector("[data-testid='database-modal']")?.remove();
  resetMapEditHistory();
  vi.clearAllTimers();
  vi.useRealTimers();
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function requireTestId(host: FakeElement | Document | HTMLElement, testid: string): FakeElement {
  const control = findByTestId(host as FakeElement, testid);
  if (!control) throw new Error(`missing control ${testid}`);
  return control;
}

function change(host: FakeElement, testid: string, value: string): void {
  const control = requireTestId(host, testid);
  control.value = value;
  control.dispatchEvent(new Event("change"));
}

function toggle(host: FakeElement, testid: string, checked: boolean): void {
  const control = requireTestId(host, testid);
  control.checked = checked;
  control.dispatchEvent(new Event("change"));
}

function click(host: FakeElement, testid: string): void {
  requireTestId(host, testid).click();
}

function modalBody(): FakeElement {
  const backdrop = document.querySelector("[data-testid='database-modal']");
  if (!(backdrop instanceof FakeElement)) throw new Error("database modal not open");
  const body = backdrop.querySelector(".database-modal-body");
  if (!(body instanceof FakeElement)) throw new Error("missing database-modal-body");
  return body;
}

function openSpatialModal(): FakeElement {
  openDatabaseModal("farmSpatial");
  return modalBody();
}

function seedSpecies(): void {
  const project = store.getCurrent();
  const feedId = project.database.items[0]?.id;
  const productId = project.database.items[1]?.id ?? feedId;
  if (!feedId) throw new Error("blank project needs items");
  store.update((draft) => {
    draft.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
    draft.database.farmAnimalSpecies = [
      {
        id: "chicken",
        name: "닭",
        feedItemId: feedId,
        productItemId: productId!,
        productCount: 1,
        productEveryDays: 1,
        petFriendship: 10,
      },
    ];
  });
}

function authorHousingWithTwoAnimals(host: FakeElement): { buildingId: string; placementId: string } {
  click(host, "db-spatial-add-building-type");
  const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id;
  if (!buildingId) throw new Error("no building type");
  toggle(host, `db-spatial-building-animal-housing-${buildingId}`, true);
  toggle(host, `db-spatial-building-housing-species-${buildingId}-chicken`, true);
  change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "2");
  // capacity increase applies immediately when no prior confirm path is needed
  const confirmCap = findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);
  if (confirmCap) confirmCap.click();
  click(host, "db-spatial-add-building-placement");
  const placementId = store.getCurrent().session.farmBuildingPlacements?.[0]?.instanceId;
  if (!placementId) throw new Error("no placement");
  store.update((draft) => {
    draft.session.farmAnimals = [
      { instanceId: "a1", speciesId: "chicken", name: "A", housingPlacementId: placementId },
      { instanceId: "a2", speciesId: "chicken", name: "B", housingPlacementId: placementId },
    ];
  });
  // Refresh modal body after animal seed so inspector reflects residents.
  requestDatabaseModalClose("battleTest");
  openDatabaseModal("farmSpatial");
  return { buildingId, placementId };
}

function proposeCapacityShrink(host: FakeElement, buildingId: string): void {
  const animalsBefore = structuredClone(store.getCurrent().session.farmAnimals);
  change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
  expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
  expect(store.getCurrent().session.farmAnimals).toEqual(animalsBefore);
  expect(requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`).textContent).toMatch(
    /미배정 1마리/,
  );
  expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeTruthy();
}

function renderLedgerSpaces(
  project: ReturnType<typeof store.getCurrent>,
  session: ReturnType<typeof startSession>,
) {
  const mutations: Array<{ ok: boolean; message: string }> = [];
  const panel = renderWithFakeDom(() =>
    renderStatusMenuDetailPanel(
      project,
      createStatusMenuDetail({
        project,
        session,
        selectedCommand: "life-ledger",
        lifeLedgerTab: "spaces",
        slots: [],
        waitModeEnabled: true,
        onLifeLedgerMutation: (ok, message) => mutations.push({ ok, message }),
      }),
    ),
  ) as FakeElement;
  return { panel, mutations };
}

function buildRuntimeSession(
  buildingId: string,
  placementId: string,
  seed: number,
): { project: ReturnType<typeof store.getCurrent>; session: ReturnType<typeof startSession> } {
  const project = deserialize(serialize(store.getCurrent()));
  const session = startSession(project, seed);
  session.farmBuildingPlacements = {
    [placementId]: {
      instanceId: placementId,
      typeId: buildingId,
      level: 1,
      mapId: project.startMapId,
      x: 3,
      y: 3,
      orientation: "down",
    },
  };
  session.farmAnimals = {
    a1: {
      instanceId: "a1",
      speciesId: "chicken",
      name: "A",
      housingPlacementId: placementId,
      friendship: 0,
      productionProgress: 0,
      readyProductCount: 0,
    },
    a2: {
      instanceId: "a2",
      speciesId: "chicken",
      name: "B",
      housingPlacementId: placementId,
      friendship: 0,
      productionProgress: 0,
      readyProductCount: 0,
    },
  };
  return { project, session };
}

describe("animal housing confirmation lifecycle (expected-correct)", () => {
  it("editor modal close/reopen cancels a pending capacity proposal", () => {
    seedSpecies();
    let host = openSpatialModal();
    const { buildingId } = authorHousingWithTwoAnimals(host);
    host = modalBody();
    proposeCapacityShrink(host, buildingId);

    // Real public close path (not bare host.remove / replaceChildren).
    requestDatabaseModalClose("battleTest");
    expect(document.querySelector("[data-testid='database-modal']")).toBeFalsy();

    host = openSpatialModal();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(store.getCurrent().session.farmAnimals).toHaveLength(2);
    // Correct: a closed modal must not resurrect an unconfirmed proposal for the same typeId.
    expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeFalsy();
  });

  it("same-ID Project replacement cancels a pending capacity proposal", () => {
    seedSpecies();
    let host = openSpatialModal();
    const { buildingId } = authorHousingWithTwoAnimals(host);
    host = modalBody();
    proposeCapacityShrink(host, buildingId);

    const wire = serialize(store.getCurrent());
    // Public full project switch — same IDs after remote reload / import stand-in.
    store.replaceProject(deserialize(wire));
    resetMapEditHistory();

    host = openSpatialModal();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeFalsy();
  });

  it("explicit cancel clears pending so reopen shows no confirm", () => {
    seedSpecies();
    let host = openSpatialModal();
    const { buildingId } = authorHousingWithTwoAnimals(host);
    host = modalBody();
    proposeCapacityShrink(host, buildingId);
    click(host, `db-spatial-building-animal-capacity-cancel-${buildingId}-1`);

    requestDatabaseModalClose("battleTest");
    host = openSpatialModal();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeFalsy();
  });

  it("menu close + new session with SAME placement id requires a fresh arm and preserves on first action", () => {
    seedSpecies();
    const host = openSpatialModal();
    const { buildingId, placementId } = authorHousingWithTwoAnimals(host);
    requestDatabaseModalClose("battleTest");

    const { project, session: sessionA } = buildRuntimeSession(buildingId, placementId, 1);
    const menuA = document.createElement("div") as unknown as FakeElement;
    menuA.dataset.statusMenuScreen = "function";
    (document.body as unknown as FakeElement).append(menuA);

    let spaces = renderLedgerSpaces(project, sessionA);
    menuA.append(spaces.panel);
    const removeId = `life-ledger-space-building-remove-${placementId}`;
    const remove = requireTestId(spaces.panel, removeId);
    expect(remove.textContent ?? "").toMatch(/미배정 2마리/);
    remove.click(); // arm
    expect(sessionA.farmBuildingPlacements?.[placementId]).toBeTruthy();
    expect(sessionA.farmAnimals!.a1!.housingPlacementId).toBe(placementId);
    expect(spaces.mutations.at(-1)?.message ?? "").toMatch(/미배정 2마리/);

    // Public status-menu close boundary (not bare panel drop that production never observes).
    closeStatusMenu(menuA as unknown as HTMLElement);
    // FakeDom has no element.animate — closeStatusMenu removes synchronously when animate is absent.

    // New PlaySession carrying the SAME placement instanceId (Save-Load / re-entry).
    const sessionB = startSession(project, 2);
    sessionB.farmBuildingPlacements = structuredClone(sessionA.farmBuildingPlacements);
    sessionB.farmAnimals = structuredClone(sessionA.farmAnimals);

    spaces = renderLedgerSpaces(project, sessionB);
    const afterBoundary = requireTestId(spaces.panel, removeId);
    // Correct: session/menu boundary invalidates the prior arm — no leftover "확인".
    expect(afterBoundary.textContent ?? "").toMatch(/미배정 2마리/);
    expect(afterBoundary.textContent ?? "").not.toMatch(/확인/);

    // First action after boundary only arms; animals + placement stay.
    afterBoundary.click();
    expect(sessionB.farmBuildingPlacements?.[placementId]).toBeTruthy();
    expect(sessionB.farmAnimals!.a1!.housingPlacementId).toBe(placementId);
    expect(sessionB.farmAnimals!.a2!.housingPlacementId).toBe(placementId);
    expect(spaces.mutations.at(-1)?.message ?? "").toMatch(/미배정 2마리/);
  });

  it("ordinary same-context rerender can still confirm a demolish arm", () => {
    seedSpecies();
    const host = openSpatialModal();
    const { buildingId, placementId } = authorHousingWithTwoAnimals(host);
    requestDatabaseModalClose("battleTest");

    const { project, session } = buildRuntimeSession(buildingId, placementId, 3);
    let spaces = renderLedgerSpaces(project, session);
    const removeId = `life-ledger-space-building-remove-${placementId}`;
    requireTestId(spaces.panel, removeId).click(); // arm
    expect(session.farmBuildingPlacements?.[placementId]).toBeTruthy();

    // Same session/context rerender — arm must survive so the player can confirm.
    spaces = renderLedgerSpaces(project, session);
    const armed = requireTestId(spaces.panel, removeId);
    expect(armed.textContent ?? "").toMatch(/미배정 2마리 · 확인/);
    armed.click();
    expect(session.farmBuildingPlacements?.[placementId]).toBeUndefined();
    expect(session.farmAnimals!.a1!.housingPlacementId).toBeUndefined();
    expect(session.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(Object.keys(session.farmAnimals ?? {}).sort()).toEqual(["a1", "a2"]);
  });

  it("TTL expiry after arm requires a fresh propose without demolishing", () => {
    seedSpecies();
    const host = openSpatialModal();
    const { buildingId, placementId } = authorHousingWithTwoAnimals(host);
    requestDatabaseModalClose("battleTest");

    const { project, session } = buildRuntimeSession(buildingId, placementId, 4);
    let spaces = renderLedgerSpaces(project, session);
    const removeId = `life-ledger-space-building-remove-${placementId}`;
    requireTestId(spaces.panel, removeId).click();
    spaces = renderLedgerSpaces(project, session);
    expect(requireTestId(spaces.panel, removeId).textContent ?? "").toMatch(/확인/);

    // Deterministic fake time — not a real sleep.
    vi.advanceTimersByTime(4001);
    spaces = renderLedgerSpaces(project, session);
    const expired = requireTestId(spaces.panel, removeId);
    expect(expired.textContent ?? "").toMatch(/미배정 2마리/);
    expect(expired.textContent ?? "").not.toMatch(/확인/);
    expect(session.farmBuildingPlacements?.[placementId]).toBeTruthy();
  });

  it("intervening allowed-species change invalidates pending shrink so stale confirm cannot apply new impact under old consent", () => {
    seedSpecies();
    let host = openSpatialModal();
    const { buildingId, placementId } = authorHousingWithTwoAnimals(host);
    host = modalBody();

    // Given: capacity 2 with two chicken residents — propose shrink to 1 (impact 1).
    const animalsBefore = structuredClone(store.getCurrent().session.farmAnimals);
    proposeCapacityShrink(host, buildingId);
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(store.getCurrent().session.farmAnimals).toEqual(animalsBefore);
    expect(requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`).textContent).toMatch(
      /미배정 1마리/,
    );

    // Capture the live confirm control before the meaning change (stale-element probe).
    const staleConfirm = requireTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);

    // When: uncheck chicken while the 1-animal shrink proposal remains pending.
    // Species exclusion would make a fresh shrink impact 2 (both residents), not the consented 1.
    toggle(host, `db-spatial-building-housing-species-${buildingId}-chicken`, false);
    host = modalBody();

    const afterSpecies = store.getCurrent();
    expect(afterSpecies.database.farmBuildingTypes?.[0]?.animalHousing?.allowedSpeciesIds ?? []).not.toContain("chicken");
    // Then: capacity and resident refs must stay pre-confirm; no silent reconcile under obsolete consent.
    expect(afterSpecies.database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(afterSpecies.session.farmAnimals).toEqual(animalsBefore);
    expect(afterSpecies.session.farmAnimals?.every((row) => row.housingPlacementId === placementId)).toBe(true);

    // Pending shrink arm must not survive the meaning change (invalidate or re-propose with new impact).
    // Invalidation: confirm control gone and impact no longer locked at consented 1.
    const freshConfirm = findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);
    const impactText = findByTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`)?.textContent ?? "";
    if (freshConfirm) {
      // Re-propose path: displayed impact must reflect current meaning (2), not stale consent (1).
      expect(impactText).toMatch(/미배정 2마리/);
      expect(impactText).not.toMatch(/미배정 1마리/);
    } else {
      expect(impactText).not.toMatch(/미배정 1마리/);
    }

    // Stale confirm element from the pre-species DOM must not apply capacity/ref mutation.
    staleConfirm.click();
    const afterStale = store.getCurrent();
    expect(afterStale.database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(afterStale.session.farmAnimals).toEqual(animalsBefore);

    // If a fresh confirm is offered under the new impact, it still requires explicit consent and
    // must not have already mutated; clicking it is allowed only after the new impact was shown.
    if (freshConfirm) {
      expect(afterStale.database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
      // Do not click fresh confirm here — this case locks pre-confirm invariance under obsolete consent.
    }
  });
});
