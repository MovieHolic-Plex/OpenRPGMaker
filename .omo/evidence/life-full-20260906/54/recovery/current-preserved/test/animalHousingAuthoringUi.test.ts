import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetFarmSpatialTabTestState } from "@/editor/panels/databaseFarmSpatialView";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import {
  assignFarmAnimalToHousingPlacement,
  feedFarmAnimal,
  petFarmAnimal,
} from "@/project/farmAnimals";
import { resolveAnimalHome } from "@/project/animalHousing";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
import { resetLifeLedgerTestState } from "@/player/lifeLedger";
import { renderStatusMenuDetailPanel } from "@/player/playerStatusMenuDetailRenderer";
import { FakeElement, findByTestId, installFakeDom, renderWithFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-09-06T00:00:00Z"));
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } },
  });
  store.replace(createBlankProject());
  resetMapEditHistory();
  resetFarmSpatialTabTestState();
  resetLifeLedgerTestState();
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  resetMapEditHistory();
  vi.clearAllTimers();
  vi.useRealTimers();
  restoreDom?.();
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderPanel(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

function requireTestId(host: FakeElement, testid: string): FakeElement {
  const control = findByTestId(host, testid);
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

function click(host: FakeElement, testid: string): FakeElement {
  const control = requireTestId(host, testid);
  control.click();
  return control;
}

function seedItemsAndSpecies(): { feedId: string; productId: string } {
  const project = store.getCurrent();
  const feedId = project.database.items[0]?.id;
  const productId = project.database.items[1]?.id ?? feedId;
  if (!feedId || !productId) throw new Error("blank project needs items");
  store.update((draft) => {
    draft.system.timeSystem = { enabled: true, dayStartHour: 6, dayEndHour: 26, daysPerSeason: 28 };
    draft.database.farmAnimalSpecies = [
      {
        id: "chicken",
        name: "닭",
        feedItemId: feedId,
        productItemId: productId,
        productCount: 1,
        productEveryDays: 1,
        petFriendship: 10,
      },
      {
        id: "cow",
        name: "소",
        feedItemId: feedId,
        productItemId: productId,
        productCount: 1,
        productEveryDays: 1,
        petFriendship: 8,
      },
    ];
    draft.system.farmAnimalBuildings = [{
      id: "legacy:coop",
      name: "옛 축사",
      mapId: draft.startMapId,
      x: 1,
      y: 1,
      capacity: 2,
      allowedSpeciesIds: ["chicken"],
    }];
  });
  return { feedId, productId };
}

function openSpatial(): FakeElement {
  const host = renderPanel();
  click(host, "db-tab-farm-spatial");
  return host;
}

function openAnimals(): FakeElement {
  const host = renderPanel();
  click(host, "db-tab-farm-animals");
  return host;
}

function authorHousingBuilding(host: FakeElement): { buildingId: string; placementA: string; placementB: string } {
  click(host, "db-spatial-add-building-type");
  const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id ?? "";
  expect(buildingId).toBeTruthy();
  expect(findByTestId(host, `db-spatial-building-animal-housing-${buildingId}`)).toBeTruthy();
  toggle(host, `db-spatial-building-animal-housing-${buildingId}`, true);
  expect(findByTestId(host, `db-spatial-building-housing-species-${buildingId}`)).toBeTruthy();
  toggle(host, `db-spatial-building-housing-species-${buildingId}-chicken`, true);
  change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
  // Capacity increases apply immediately; shrink proposals need confirm when impactful.
  const confirmCap = findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);
  if (confirmCap) confirmCap.click();
  change(host, `db-spatial-building-capacity-${buildingId}-1`, "99");
  click(host, "db-spatial-add-building-placement");
  click(host, "db-spatial-add-building-placement");
  const placements = store.getCurrent().session.farmBuildingPlacements ?? [];
  expect(placements).toHaveLength(2);
  return {
    buildingId,
    placementA: placements[0]!.instanceId,
    placementB: placements[1]!.instanceId,
  };
}

function snapshotAnimals() {
  return structuredClone(store.getCurrent().session.farmAnimals ?? []);
}

function snapshotBuildingType(buildingId: string) {
  return structuredClone(
    store.getCurrent().database.farmBuildingTypes?.find((row) => row.id === buildingId),
  );
}

function renderLedgerAnimals(project = store.getCurrent(), session = startSession(project, 13)) {
  const mutations: Array<{ ok: boolean; message: string }> = [];
  const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
    project,
    session,
    selectedCommand: "life-ledger",
    lifeLedgerTab: "animals",
    slots: [],
    waitModeEnabled: true,
    onLifeLedgerMutation: (ok, message) => mutations.push({ ok, message }),
  })));
  return { project, session, panel, mutations };
}

function renderLedgerSpaces(project = store.getCurrent(), session = startSession(project, 13)) {
  const mutations: Array<{ ok: boolean; message: string }> = [];
  const panel = renderWithFakeDom(() => renderStatusMenuDetailPanel(project, createStatusMenuDetail({
    project,
    session,
    selectedCommand: "life-ledger",
    lifeLedgerTab: "spaces",
    slots: [],
    waitModeEnabled: true,
    onLifeLedgerMutation: (ok, message) => mutations.push({ ok, message }),
  })));
  return { project, session, panel, mutations };
}

describe("animal housing authoring UI", () => {
  it("authors opt-in housing and per-level animalCapacity distinct from generic capacity through serialize/parse", () => {
    seedItemsAndSpecies();
    const host = openSpatial();
    const { buildingId } = authorHousingBuilding(host);
    const project = store.getCurrent();
    const type = project.database.farmBuildingTypes?.[0];
    expect(type?.animalHousing?.allowedSpeciesIds).toEqual(["chicken"]);
    expect(type?.levels[0]).toMatchObject({ capacity: 99, animalCapacity: 1 });
    expect(findByTestId(host, `db-spatial-building-capacity-${buildingId}-1`)).toBeTruthy();
    expect(findByTestId(host, `db-spatial-building-animal-capacity-${buildingId}-1`)).toBeTruthy();
    const reloaded = deserialize(serialize(project));
    expect(reloaded.database.farmBuildingTypes?.[0]?.animalHousing).toEqual({ allowedSpeciesIds: ["chicken"] });
    expect(reloaded.database.farmBuildingTypes?.[0]?.levels[0]).toMatchObject({ capacity: 99, animalCapacity: 1 });
  });

  it("start animal home picker is mutually exclusive with opaque legacy/placement ids including equal spellings and colons", () => {
    seedItemsAndSpecies();
    let host = openSpatial();
    const { placementA } = authorHousingBuilding(host);
    // Force placement id that collides in spelling with a legacy id and contains a colon.
    store.update((draft) => {
      const row = draft.session.farmBuildingPlacements?.[0];
      if (row) draft.session.farmBuildingPlacements![0] = { ...row, instanceId: "legacy:coop" };
      draft.session.farmAnimals = [
        { instanceId: "a1", speciesId: "chicken", name: "보리" },
        { instanceId: "a2", speciesId: "chicken", name: "콩" },
      ];
    });
    host = openAnimals();
    click(host, "db-farm-animals-kind-animal");
    expect(findByTestId(host, "db-farm-animal-a1")).toBeTruthy();
    const homeSelect = requireTestId(host, "db-farm-animal-home-a1");
    const options = [...(homeSelect.querySelectorAll("option") ?? [])].map((option) => ({
      value: (option as FakeElement).value ?? option.getAttribute("value"),
      label: option.textContent,
    }));
    expect(options.some((entry) => entry.value === "")).toBe(true);
    expect(options.some((entry) => entry.value === "legacy:legacy:coop")).toBe(true);
    expect(options.some((entry) => entry.value === "placement:legacy:coop")).toBe(true);

    change(host, "db-farm-animal-home-a1", "placement:legacy:coop");
    expect(store.getCurrent().session.farmAnimals?.[0]).toEqual({
      instanceId: "a1",
      speciesId: "chicken",
      name: "보리",
      housingPlacementId: "legacy:coop",
    });
    expect(store.getCurrent().session.farmAnimals?.[0]?.buildingId).toBeUndefined();

    change(host, "db-farm-animal-home-a1", "legacy:legacy:coop");
    expect(store.getCurrent().session.farmAnimals?.[0]).toEqual({
      instanceId: "a1",
      speciesId: "chicken",
      name: "보리",
      buildingId: "legacy:coop",
    });
    expect(store.getCurrent().session.farmAnimals?.[0]?.housingPlacementId).toBeUndefined();

    change(host, "db-farm-animal-home-a1", "");
    expect(store.getCurrent().session.farmAnimals?.[0]?.buildingId).toBeUndefined();
    expect(store.getCurrent().session.farmAnimals?.[0]?.housingPlacementId).toBeUndefined();

    // Full home exclusion: capacity 1, a1 already on placement — a2 must not offer that full placement,
    // but a1 keeps its currently selected full home.
    store.update((draft) => {
      draft.session.farmAnimals = [
        { instanceId: "a1", speciesId: "chicken", name: "보리", housingPlacementId: "legacy:coop" },
        { instanceId: "a2", speciesId: "chicken", name: "콩" },
      ];
    });
    host = openAnimals();
    click(host, "db-farm-animals-kind-animal");
    const a1Options = [...(requireTestId(host, "db-farm-animal-home-a1").querySelectorAll("option") ?? [])]
      .map((option) => (option as FakeElement).value ?? option.getAttribute("value"));
    const a2Options = [...(requireTestId(host, "db-farm-animal-home-a2").querySelectorAll("option") ?? [])]
      .map((option) => (option as FakeElement).value ?? option.getAttribute("value"));
    expect(a1Options).toContain("placement:legacy:coop");
    expect(a2Options).not.toContain("placement:legacy:coop");
    expect(placementA).toBeTruthy();
  });

  it("ledger assign/care path: unassigned reason before activation, collect while unassigned, refuse full/species/stale, preserve care on reassignment", () => {
    const { feedId } = seedItemsAndSpecies();
    let host = openSpatial();
    const { placementA, placementB, buildingId } = authorHousingBuilding(host);
    store.update((draft) => {
      draft.session.farmAnimals = [
        { instanceId: "a1", speciesId: "chicken", name: "보리" },
        { instanceId: "a2", speciesId: "chicken", name: "콩" },
        { instanceId: "cow1", speciesId: "cow", name: "두부" },
      ];
      // second placement also capacity 1
      const type = draft.database.farmBuildingTypes?.[0];
      if (type) {
        draft.database.farmBuildingTypes![0] = {
          ...type,
          levels: type.levels.map((level) => ({ ...level, animalCapacity: 1 })),
        };
      }
    });
    const project = deserialize(serialize(store.getCurrent()));
    const session = startSession(project, 42);
    session.inventory[feedId] = 10;
    session.farmAnimals!.a1 = {
      ...session.farmAnimals!.a1!,
      readyProductCount: 2,
    };

    let view = renderLedgerAnimals(project, session);
    const feed = requireTestId(view.panel, "life-ledger-animal-feed-a1");
    expect(feed.dataset.unavailableReason ?? feed.getAttribute("data-unavailable-reason")).toBeTruthy();
    feed.click();
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBeUndefined();
    const collect = requireTestId(view.panel, "life-ledger-animal-collect-a1");
    expect(collect.getAttribute("disabled")).toBeNull();
    collect.click();
    expect(session.inventory[project.database.farmAnimalSpecies![0]!.productItemId]).toBe(2);
    expect(session.farmAnimals!.a1!.readyProductCount).toBe(0);

    const assignA = requireTestId(view.panel, `life-ledger-animal-assign-placement-a1-${placementA}`);
    assignA.click();
    expect(session.farmAnimals!.a1!.housingPlacementId).toBe(placementA);
    expect(resolveAnimalHome(project, session, session.farmAnimals!.a1!)?.id).toBe(placementA);

    view = renderLedgerAnimals(project, session);
    requireTestId(view.panel, "life-ledger-animal-feed-a1").click();
    requireTestId(view.panel, "life-ledger-animal-pet-a1").click();
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.lastPettedDayKey).toBe("1:spring:1");
    const friendship = session.farmAnimals!.a1!.friendship;
    const feedAfterCare = session.inventory[feedId];

    // Full home refusal for a2 on placementA
    view = renderLedgerAnimals(project, session);
    const fullAssign = requireTestId(view.panel, `life-ledger-animal-assign-placement-a2-${placementA}`);
    fullAssign.click();
    expect(session.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(session.farmAnimals!.a2!.buildingId).toBeUndefined();
    expect(view.mutations.at(-1)?.ok).toBe(false);

    // Species refusal for cow — control must exist, refuse, leave full animal state unchanged
    const cowBefore = structuredClone(session.farmAnimals!.cow1!);
    const speciesAssign = requireTestId(view.panel, `life-ledger-animal-assign-placement-cow1-${placementB}`);
    speciesAssign.click();
    expect(view.mutations.at(-1)?.ok).toBe(false);
    expect(session.farmAnimals!.cow1).toEqual(cowBefore);
    expect(session.farmAnimals!.cow1!.housingPlacementId).toBeUndefined();

    // Reassign a1 to placementB preserves care receipts
    requireTestId(view.panel, `life-ledger-animal-assign-placement-a1-${placementB}`).click();
    expect(session.farmAnimals!.a1!.housingPlacementId).toBe(placementB);
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.lastPettedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.friendship).toBe(friendship);

    // Duplicate feed AND pet after reassignment must not add costs/friendship/receipts
    view = renderLedgerAnimals(project, session);
    requireTestId(view.panel, "life-ledger-animal-feed-a1").click();
    expect(view.mutations.at(-1)?.ok).toBe(false);
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");
    expect(session.inventory[feedId]).toBe(feedAfterCare);
    requireTestId(view.panel, "life-ledger-animal-pet-a1").click();
    expect(view.mutations.at(-1)?.ok).toBe(false);
    expect(session.farmAnimals!.a1!.lastPettedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.friendship).toBe(friendship);

    // Stale target recheck: offered-then-deleted
    view = renderLedgerAnimals(project, session);
    const staleAssign = requireTestId(view.panel, `life-ledger-animal-assign-placement-a2-${placementA}`);
    delete session.farmBuildingPlacements![placementA];
    staleAssign.click();
    expect(session.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(view.mutations.at(-1)?.ok).toBe(false);

    // Stale target recheck: offered-then-filled (target was empty when offered, filled before click)
    session.farmBuildingPlacements![placementA] = structuredClone(
      project.session.farmBuildingPlacements?.find((row) => row.instanceId === placementA)
        ?? {
          instanceId: placementA,
          typeId: buildingId,
          level: 1,
          mapId: project.startMapId,
          x: 4,
          y: 4,
          orientation: "down" as const,
        },
    );
    // Restore placementA into live session maps for resolve
    const restored = startSession(deserialize(serialize(store.getCurrent())), 42);
    // Use dedicated session for fill race on placementB capacity 1 with a1 already there.
    const fillProject = deserialize(serialize(store.getCurrent()));
    const fillSession = startSession(fillProject, 77);
    fillSession.farmAnimals!.a1 = {
      ...fillSession.farmAnimals!.a1!,
      housingPlacementId: undefined,
      buildingId: undefined,
    };
    fillSession.farmAnimals!.a2 = {
      ...fillSession.farmAnimals!.a2!,
      housingPlacementId: undefined,
      buildingId: undefined,
    };
    // Offer placementA to a2 while empty
    let fillView = renderLedgerAnimals(fillProject, fillSession);
    const offered = requireTestId(fillView.panel, `life-ledger-animal-assign-placement-a2-${placementA}`);
    // Fill placementA with a1 before a2 clicks the stale offer
    expect(assignFarmAnimalToHousingPlacement(fillProject, fillSession, "a1", placementA).ok).toBe(true);
    offered.click();
    expect(fillSession.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(fillView.mutations.at(-1)?.ok).toBe(false);
    expect(fillSession.farmAnimals!.a1!.housingPlacementId).toBe(placementA);

    // Legacy UI assignment must start from a DIFFERENT home and use the UI (not pre-assign via core)
    fillSession.farmAnimals!.a2 = {
      ...fillSession.farmAnimals!.a2!,
      housingPlacementId: placementB,
      buildingId: undefined,
    };
    expect(fillSession.farmAnimals!.a2!.housingPlacementId).toBe(placementB);
    fillView = renderLedgerAnimals(fillProject, fillSession);
    const legacyAssign = requireTestId(fillView.panel, "life-ledger-animal-assign-legacy-a2-legacy:coop");
    legacyAssign.click();
    expect(fillView.mutations.at(-1)?.ok).toBe(true);
    expect(fillSession.farmAnimals!.a2!.buildingId).toBe("legacy:coop");
    expect(fillSession.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(buildingId).toBeTruthy();
    expect(restored.farmAnimals).toBeTruthy();
  });

  it("demolition and capacity shrink show only newly unassigned counts, preserve animals, and keep undo/reference integrity", () => {
    seedItemsAndSpecies();
    let host = openSpatial();
    const { buildingId, placementA, placementB } = authorHousingBuilding(host);
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes![0]!;
      draft.database.farmBuildingTypes![0] = {
        ...type,
        levels: [{ ...type.levels[0]!, animalCapacity: 2, capacity: 99 }],
      };
      draft.session.farmAnimals = [
        { instanceId: "z", speciesId: "chicken", name: "Z", housingPlacementId: placementA },
        { instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: placementA },
        { instanceId: "b", speciesId: "chicken", name: "B", housingPlacementId: placementB },
      ];
    });
    host = openSpatial();

    // --- Capacity shrink: propose exact impact BEFORE mutation; cancel preserves ---
    const beforeShrinkAnimals = snapshotAnimals();
    const beforeShrinkType = snapshotBuildingType(buildingId);
    change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
    // Pre-confirm invariance: no model/ref mutation yet
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(store.getCurrent().session.farmAnimals).toEqual(beforeShrinkAnimals);
    const shrinkNotice = requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`);
    expect(shrinkNotice.textContent).toMatch(/미배정 1마리/);
    const shrinkCancel = requireTestId(host, `db-spatial-building-animal-capacity-cancel-${buildingId}-1`);
    shrinkCancel.click();
    host = openSpatial();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(store.getCurrent().session.farmAnimals).toEqual(beforeShrinkAnimals);
    expect(snapshotBuildingType(buildingId)).toEqual(beforeShrinkType);

    // Confirm shrink: exact newly-unassigned (code-point: a kept, z overflows on placementA)
    change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
    expect(store.getCurrent().session.farmAnimals).toEqual(beforeShrinkAnimals);
    expect(requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`).textContent).toMatch(/미배정 1마리/);
    click(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);
    host = openSpatial();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(1);
    const afterShrink = store.getCurrent().session.farmAnimals ?? [];
    expect(afterShrink.map((row) => row.instanceId).sort()).toEqual(["a", "b", "z"]);
    const linkedA = afterShrink.filter((row) => row.housingPlacementId === placementA);
    expect(linkedA).toHaveLength(1);
    expect(linkedA[0]?.instanceId).toBe("a");
    expect(afterShrink.find((row) => row.instanceId === "z")?.housingPlacementId).toBeUndefined();
    expect(afterShrink.find((row) => row.instanceId === "b")?.housingPlacementId).toBe(placementB);
    expect(requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`).textContent).toMatch(/미배정 1마리/);

    // Zero-impact shrink (capacity 1 -> 0 with one resident on B only after we free A side): capacity 1->1 no-op already covered;
    // raise then shrink with single resident => impact 0 still goes through confirm when shrinking
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes![0]!;
      draft.database.farmBuildingTypes![0] = {
        ...type,
        levels: [{ ...type.levels[0]!, animalCapacity: 3, capacity: 99 }],
      };
      draft.session.farmAnimals = [
        { instanceId: "solo", speciesId: "chicken", name: "Solo", housingPlacementId: placementA },
      ];
    });
    host = openSpatial();
    const zeroBefore = snapshotAnimals();
    change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "2");
    // shrink 3->2 with 1 resident => impact 0, still propose+confirm
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(3);
    expect(store.getCurrent().session.farmAnimals).toEqual(zeroBefore);
    expect(requireTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`).textContent).toMatch(/미배정 0마리/);
    click(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`);
    host = openSpatial();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(store.getCurrent().session.farmAnimals).toEqual(zeroBefore);

    // --- Disable housing: propose exact impact, cancel, then confirm ---
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes![0]!;
      draft.database.farmBuildingTypes![0] = {
        ...type,
        animalHousing: { allowedSpeciesIds: ["chicken"] },
        levels: [{ ...type.levels[0]!, animalCapacity: 2, capacity: 99 }],
      };
      draft.session.farmAnimals = [
        { instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: placementA },
        { instanceId: "b", speciesId: "chicken", name: "B", housingPlacementId: placementB },
      ];
    });
    host = openSpatial();
    const beforeDisableAnimals = snapshotAnimals();
    const beforeDisableType = snapshotBuildingType(buildingId);
    toggle(host, `db-spatial-building-animal-housing-${buildingId}`, false);
    // Pre-confirm: housing still enabled, refs unchanged
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.animalHousing).toEqual({ allowedSpeciesIds: ["chicken"] });
    expect(store.getCurrent().session.farmAnimals).toEqual(beforeDisableAnimals);
    expect(requireTestId(host, `db-spatial-building-housing-impact-${buildingId}`).textContent).toMatch(/미배정 2마리/);
    click(host, `db-spatial-building-housing-cancel-${buildingId}`);
    host = openSpatial();
    expect(snapshotBuildingType(buildingId)).toEqual(beforeDisableType);
    expect(store.getCurrent().session.farmAnimals).toEqual(beforeDisableAnimals);

    // Unrelated proposal must not reuse prior arm: start capacity proposal then switch to disable
    change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
    expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeTruthy();
    toggle(host, `db-spatial-building-animal-housing-${buildingId}`, false);
    // Capacity confirm for the superseded proposal must be gone; disable confirm present
    expect(findByTestId(host, `db-spatial-building-animal-capacity-confirm-${buildingId}-1`)).toBeFalsy();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.levels[0]?.animalCapacity).toBe(2);
    expect(requireTestId(host, `db-spatial-building-housing-impact-${buildingId}`).textContent).toMatch(/미배정 2마리/);
    click(host, `db-spatial-building-housing-confirm-${buildingId}`);
    host = openSpatial();
    expect(store.getCurrent().database.farmBuildingTypes?.[0]?.animalHousing).toBeUndefined();
    const afterDisable = store.getCurrent().session.farmAnimals ?? [];
    expect(afterDisable).toHaveLength(2);
    expect(afterDisable.every((row) => row.housingPlacementId === undefined)).toBe(true);
    expect(requireTestId(host, `db-spatial-building-housing-impact-${buildingId}`).textContent).toMatch(/미배정 2마리/);

    // Placement delete unassigns without deleting animals; impact label when armed
    // Re-enable housing for remaining placement workflows
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes?.find((row) => row.id === buildingId);
      if (type) {
        draft.database.farmBuildingTypes = (draft.database.farmBuildingTypes ?? []).map((row) =>
          row.id === buildingId
            ? {
                ...row,
                animalHousing: { allowedSpeciesIds: ["chicken"] },
                levels: row.levels.map((level) => ({ ...level, animalCapacity: 2 })),
              }
            : row,
        );
      }
      draft.session.farmAnimals = [
        { instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: placementA },
        { instanceId: "b", speciesId: "chicken", name: "B", housingPlacementId: placementB },
        { instanceId: "z", speciesId: "chicken", name: "Z", housingPlacementId: placementA },
      ];
      if (!draft.session.farmBuildingPlacements?.some((row) => row.instanceId === placementB)) {
        draft.session.farmBuildingPlacements = [
          ...(draft.session.farmBuildingPlacements ?? []),
          {
            instanceId: placementB,
            typeId: buildingId,
            level: 1,
            mapId: draft.startMapId,
            x: 6,
            y: 6,
            orientation: "down",
          },
        ];
      }
      if (!draft.session.farmBuildingPlacements?.some((row) => row.instanceId === placementA)) {
        draft.session.farmBuildingPlacements = [
          ...(draft.session.farmBuildingPlacements ?? []),
          {
            instanceId: placementA,
            typeId: buildingId,
            level: 1,
            mapId: draft.startMapId,
            x: 4,
            y: 4,
            orientation: "down",
          },
        ];
      }
    });
    host = openSpatial();
    const del = requireTestId(host, `db-spatial-delete-building-placement-${placementB}`);
    expect(del.textContent ?? "").toMatch(/미배정/);
    del.click();
    expect(del.textContent ?? "").toMatch(/미배정|정말|삭제/);
    del.click();
    const animals = store.getCurrent().session.farmAnimals ?? [];
    expect(animals.map((row) => row.instanceId).sort()).toEqual(["a", "b", "z"]);
    expect(animals.find((row) => row.instanceId === "b")?.housingPlacementId).toBeUndefined();

    // Rename placement rewrites linked refs
    host = openSpatial();
    let remaining = store.getCurrent().session.farmBuildingPlacements?.[0]?.instanceId;
    if (!remaining) {
      click(host, "db-spatial-add-building-placement");
      remaining = store.getCurrent().session.farmBuildingPlacements?.[0]?.instanceId;
    }
    expect(remaining).toBeTruthy();
    store.update((draft) => {
      draft.session.farmAnimals = (draft.session.farmAnimals ?? []).map((row, index) =>
        index === 0 ? { ...row, housingPlacementId: remaining!, buildingId: undefined } : row,
      );
    });
    host = openSpatial();
    change(host, `db-spatial-building-placement-id-${remaining}`, "renamed-home");
    expect(store.getCurrent().session.farmAnimals?.some((row) => row.housingPlacementId === "renamed-home")).toBe(true);

    // Undo restores prior linked state
    expect(undoMapEdit()).toBe(true);

    // Runtime demolish: real rerendered confirmation with exact impact
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes?.find((row) => row.id === buildingId);
      if (type) {
        draft.database.farmBuildingTypes = (draft.database.farmBuildingTypes ?? []).map((row) =>
          row.id === buildingId
            ? {
                ...row,
                animalHousing: { allowedSpeciesIds: ["chicken"] },
                levels: [
                  { ...row.levels[0]!, level: 1, animalCapacity: 2, capacity: 99 },
                  {
                    level: 2,
                    capacity: 99,
                    animalCapacity: 1,
                    footprint: row.levels[0]!.footprint,
                    graphicResourceId: row.levels[0]!.graphicResourceId,
                  },
                ],
              }
            : row,
        );
      }
      draft.session.farmAnimals = [
        { instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: placementA },
        { instanceId: "b", speciesId: "chicken", name: "B", housingPlacementId: placementA },
      ];
      if (!draft.session.farmBuildingPlacements?.some((row) => row.instanceId === placementA)) {
        draft.session.farmBuildingPlacements = [
          ...(draft.session.farmBuildingPlacements ?? []),
          {
            instanceId: placementA,
            typeId: buildingId,
            level: 1,
            mapId: draft.startMapId,
            x: 4,
            y: 4,
            orientation: "down",
          },
        ];
      }
    });
    const project = deserialize(serialize(store.getCurrent()));
    const session = startSession(project, 99);
    let spaces = renderLedgerSpaces(project, session);
    const removeId = `life-ledger-space-building-remove-${placementA}`;
    const remove = requireTestId(spaces.panel, removeId);
    expect(remove.textContent ?? "").toMatch(/미배정 2마리/);
    // first click arms — must not demolish yet
    remove.click();
    expect(session.farmBuildingPlacements?.[placementA]).toBeTruthy();
    expect(session.farmAnimals!.a!.housingPlacementId).toBe(placementA);
    expect(spaces.mutations.at(-1)?.message ?? "").toMatch(/미배정 2마리/);
    // Real rerendered confirmation control
    spaces = renderLedgerSpaces(project, session);
    const armed = requireTestId(spaces.panel, removeId);
    expect(armed.textContent ?? "").toMatch(/미배정 2마리 · 확인/);
    armed.click();
    expect(Object.keys(session.farmAnimals ?? {}).sort()).toEqual(["a", "b"]);
    expect(session.farmAnimals!.a!.housingPlacementId).toBeUndefined();
    expect(session.farmAnimals!.b!.housingPlacementId).toBeUndefined();
    expect(session.farmBuildingPlacements?.[placementA]).toBeUndefined();

    // Upgrade impact preview must use reconcile on proposed state (exact newly-unassigned, not fork)
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes?.find((row) => row.id === buildingId);
      if (type) {
        draft.database.farmBuildingTypes = (draft.database.farmBuildingTypes ?? []).map((row) =>
          row.id === buildingId
            ? {
                ...row,
                animalHousing: { allowedSpeciesIds: ["chicken"] },
                levels: [
                  { ...row.levels[0]!, level: 1, animalCapacity: 2, capacity: 99 },
                  {
                    level: 2,
                    capacity: 99,
                    animalCapacity: 1,
                    footprint: row.levels[0]!.footprint,
                    graphicResourceId: row.levels[0]!.graphicResourceId,
                  },
                ],
              }
            : row,
        );
      }
      draft.session.farmAnimals = [
        { instanceId: "a", speciesId: "chicken", name: "A", housingPlacementId: placementA },
        { instanceId: "z", speciesId: "chicken", name: "Z", housingPlacementId: placementA },
      ];
      draft.session.farmBuildingPlacements = [
        {
          instanceId: placementA,
          typeId: buildingId,
          level: 1,
          mapId: draft.startMapId,
          x: 4,
          y: 4,
          orientation: "down",
        },
      ];
    });
    const upgradeProject = deserialize(serialize(store.getCurrent()));
    const upgradeSession = startSession(upgradeProject, 100);
    const upgradeSpaces = renderLedgerSpaces(upgradeProject, upgradeSession);
    const upgrade = requireTestId(upgradeSpaces.panel, `life-ledger-space-building-upgrade-${placementA}`);
    // 2 residents, next animalCapacity 1 => exactly 1 newly unassigned via reconcile retention order
    expect(upgrade.textContent ?? "").toMatch(/미배정 1마리/);
  });

  it("preserves type-delete placement guards without cascading animal deletion and keeps first inspector delete button", () => {
    seedItemsAndSpecies();
    let host = openSpatial();
    const { buildingId, placementA } = authorHousingBuilding(host);
    store.update((draft) => {
      draft.session.farmAnimals = [
        { instanceId: "a1", speciesId: "chicken", name: "보리", housingPlacementId: placementA },
      ];
    });
    host = openSpatial();
    const typeDelete = requireTestId(host, `db-spatial-delete-building-type-${buildingId}`);
    typeDelete.click();
    // placement still blocks type delete
    expect(store.getCurrent().database.farmBuildingTypes).toHaveLength(1);
    const placementB = store.getCurrent().session.farmBuildingPlacements?.find((row) => row.instanceId !== placementA)?.instanceId;
    host = openSpatial();
    const delA = requireTestId(host, `db-spatial-delete-building-placement-${placementA}`);
    delA.click();
    delA.click();
    if (placementB) {
      host = openSpatial();
      const delB = requireTestId(host, `db-spatial-delete-building-placement-${placementB}`);
      delB.click();
      delB.click();
    }
    expect(store.getCurrent().session.farmAnimals?.[0]?.instanceId).toBe("a1");
    expect(store.getCurrent().session.farmBuildingPlacements ?? []).toEqual([]);
    host = openSpatial();
    const typeDeleteFinal = requireTestId(host, `db-spatial-delete-building-type-${buildingId}`);
    typeDeleteFinal.click();
    typeDeleteFinal.click();
    expect(store.getCurrent().database.farmBuildingTypes).toEqual([]);
    expect(store.getCurrent().session.farmAnimals?.[0]?.instanceId).toBe("a1");

    host = openAnimals();
    click(host, "db-farm-animals-kind-animal");
    const editor = requireTestId(host, "db-farm-animal-a1");
    const firstButton = editor.querySelector("button");
    expect(firstButton?.textContent).toMatch(/삭제/);
  });
});
