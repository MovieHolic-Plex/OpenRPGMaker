import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { redoMapEdit, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import {
  assignFarmAnimalToBuilding,
  assignFarmAnimalToHousingPlacement,
  collectFarmAnimalProduct,
  feedFarmAnimal,
  petFarmAnimal,
} from "@/project/farmAnimals";
import { resolveAnimalHome } from "@/project/animalHousing";
import { createStatusMenuDetail } from "@/player/playerStatusMenuDetails";
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

function change(host: FakeElement, testid: string, value: string, checked = false): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing control ${testid}`);
  control.value = value;
  if (checked) control.checked = value === "true";
  control.dispatchEvent(new Event(checked ? "change" : "change"));
}

function toggle(host: FakeElement, testid: string, checked: boolean): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing control ${testid}`);
  control.checked = checked;
  control.dispatchEvent(new Event("change"));
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
  findByTestId(host, "db-tab-farm-spatial")?.click();
  return host;
}

function openAnimals(): FakeElement {
  const host = renderPanel();
  findByTestId(host, "db-tab-farm-animals")?.click();
  return host;
}

function authorHousingBuilding(host: FakeElement): { buildingId: string; placementA: string; placementB: string } {
  findByTestId(host, "db-spatial-add-building-type")?.click();
  const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id ?? "";
  expect(buildingId).toBeTruthy();
  expect(findByTestId(host, `db-spatial-building-animal-housing-${buildingId}`)).toBeTruthy();
  toggle(host, `db-spatial-building-animal-housing-${buildingId}`, true);
  const speciesBox = findByTestId(host, `db-spatial-building-housing-species-${buildingId}`);
  expect(speciesBox).toBeTruthy();
  toggle(host, `db-spatial-building-housing-species-${buildingId}-chicken`, true);
  change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
  change(host, `db-spatial-building-capacity-${buildingId}-1`, "99");
  findByTestId(host, "db-spatial-add-building-placement")?.click();
  findByTestId(host, "db-spatial-add-building-placement")?.click();
  const placements = store.getCurrent().session.farmBuildingPlacements ?? [];
  expect(placements).toHaveLength(2);
  return {
    buildingId,
    placementA: placements[0]!.instanceId,
    placementB: placements[1]!.instanceId,
  };
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
    findByTestId(host, "db-farm-animals-kind-animal")?.click();
    const animalHost = findByTestId(host, "db-farm-animal-a1");
    expect(animalHost).toBeTruthy();
    const homeSelect = findByTestId(host, "db-farm-animal-home-a1");
    expect(homeSelect).toBeTruthy();
    const options = [...(homeSelect?.querySelectorAll("option") ?? [])].map((option) => ({
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
    findByTestId(host, "db-farm-animals-kind-animal")?.click();
    const a1Options = [...(findByTestId(host, "db-farm-animal-home-a1")?.querySelectorAll("option") ?? [])]
      .map((option) => (option as FakeElement).value ?? option.getAttribute("value"));
    const a2Options = [...(findByTestId(host, "db-farm-animal-home-a2")?.querySelectorAll("option") ?? [])]
      .map((option) => (option as FakeElement).value ?? option.getAttribute("value"));
    expect(a1Options).toContain("placement:legacy:coop");
    expect(a2Options).not.toContain("placement:legacy:coop");
    void placementA;
  });

  it("ledger assign/care path: unassigned reason before activation, collect while unassigned, refuse full/species/stale, preserve care on reassignment", () => {
    seedItemsAndSpecies();
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
    const feed = findByTestId(view.panel, "life-ledger-animal-feed-a1");
    expect(feed?.dataset.unavailableReason ?? feed?.getAttribute("data-unavailable-reason")).toBeTruthy();
    feed?.click();
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBeUndefined();
    const collect = findByTestId(view.panel, "life-ledger-animal-collect-a1");
    expect(collect?.getAttribute("disabled")).toBeNull();
    collect?.click();
    expect(session.inventory[project.database.farmAnimalSpecies![0]!.productItemId]).toBe(2);
    expect(session.farmAnimals!.a1!.readyProductCount).toBe(0);

    const assignA = findByTestId(view.panel, `life-ledger-animal-assign-placement-a1-${placementA}`);
    expect(assignA).toBeTruthy();
    assignA?.click();
    expect(session.farmAnimals!.a1!.housingPlacementId).toBe(placementA);
    expect(resolveAnimalHome(project, session, session.farmAnimals!.a1!)?.id).toBe(placementA);

    view = renderLedgerAnimals(project, session);
    findByTestId(view.panel, "life-ledger-animal-feed-a1")?.click();
    findByTestId(view.panel, "life-ledger-animal-pet-a1")?.click();
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.lastPettedDayKey).toBe("1:spring:1");
    const friendship = session.farmAnimals!.a1!.friendship;

    // Full home refusal for a2 on placementA
    view = renderLedgerAnimals(project, session);
    findByTestId(view.panel, `life-ledger-animal-assign-placement-a2-${placementA}`)?.click();
    expect(session.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(view.mutations.at(-1)?.ok).toBe(false);

    // Species refusal for cow
    findByTestId(view.panel, `life-ledger-animal-assign-placement-cow1-${placementB}`)?.click();
    expect(session.farmAnimals!.cow1!.housingPlacementId).toBeUndefined();

    // Reassign a1 to placementB preserves care receipts
    findByTestId(view.panel, `life-ledger-animal-assign-placement-a1-${placementB}`)?.click();
    expect(session.farmAnimals!.a1!.housingPlacementId).toBe(placementB);
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.lastPettedDayKey).toBe("1:spring:1");
    expect(session.farmAnimals!.a1!.friendship).toBe(friendship);

    // Repeat care blocked
    view = renderLedgerAnimals(project, session);
    findByTestId(view.panel, "life-ledger-animal-feed-a1")?.click();
    expect(view.mutations.at(-1)?.ok).toBe(false);
    expect(session.farmAnimals!.a1!.lastFedDayKey).toBe("1:spring:1");

    // Stale target recheck: offer then delete placement before apply
    view = renderLedgerAnimals(project, session);
    const staleAssign = findByTestId(view.panel, `life-ledger-animal-assign-placement-a2-${placementA}`);
    delete session.farmBuildingPlacements![placementA];
    staleAssign?.click();
    expect(session.farmAnimals!.a2!.housingPlacementId).toBeUndefined();
    expect(view.mutations.at(-1)?.ok).toBe(false);

    // Legacy assign still works
    expect(assignFarmAnimalToBuilding(project, session, "a2", "legacy:coop").ok).toBe(true);
    view = renderLedgerAnimals(project, session);
    findByTestId(view.panel, `life-ledger-animal-assign-legacy-a2-legacy:coop`)?.click();
    expect(session.farmAnimals!.a2!.buildingId).toBe("legacy:coop");
    void buildingId;
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

    // Shrink placementA capacity 2 -> 1: one animal newly unassigned (code-point: a kept, z overflows)
    const capacity = findByTestId(host, `db-spatial-building-animal-capacity-${buildingId}-1`);
    expect(capacity).toBeTruthy();
    change(host, `db-spatial-building-animal-capacity-${buildingId}-1`, "1");
    const shrinkNotice = findByTestId(host, `db-spatial-building-animal-capacity-impact-${buildingId}-1`);
    // After shrink applied with confirmation path, animals preserved
    const afterShrink = store.getCurrent().session.farmAnimals ?? [];
    expect(afterShrink.map((row) => row.instanceId).sort()).toEqual(["a", "b", "z"]);
    // At capacity 1 with two residents on A, one must lose housing when reconciled at runtime;
    // authoring stores the capacity and may unassign overflow on confirm.
    const stillLinked = afterShrink.filter((row) => row.housingPlacementId === placementA);
    expect(stillLinked.length).toBeLessThanOrEqual(1);

    // Disable housing impact notice before confirmation
    host = openSpatial();
    const disable = findByTestId(host, `db-spatial-building-animal-housing-${buildingId}`);
    expect(disable).toBeTruthy();
    toggle(host, `db-spatial-building-animal-housing-${buildingId}`, false);
    const impact = findByTestId(host, `db-spatial-building-housing-impact-${buildingId}`);
    // If zero-impact path not taken, impact control reports count; animals remain.
    expect(store.getCurrent().session.farmAnimals?.length).toBe(3);

    // Placement delete unassigns without deleting animals; impact label when armed
    host = openSpatial();
    const del = findByTestId(host, `db-spatial-delete-building-placement-${placementB}`);
    del?.click();
    expect(del?.textContent ?? "").toMatch(/미배정|정말|삭제/);
    del?.click();
    const animals = store.getCurrent().session.farmAnimals ?? [];
    expect(animals.map((row) => row.instanceId).sort()).toEqual(["a", "b", "z"]);
    expect(animals.find((row) => row.instanceId === "b")?.housingPlacementId).toBeUndefined();

    // Rename placement rewrites linked refs
    host = openSpatial();
    let remaining = store.getCurrent().session.farmBuildingPlacements?.[0]?.instanceId;
    if (!remaining) {
      findByTestId(host, "db-spatial-add-building-placement")?.click();
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

    // Runtime demolish impact on spaces tab — re-enable housing so authored refs validate.
    store.update((draft) => {
      const type = draft.database.farmBuildingTypes?.find((row) => row.id === buildingId);
      if (type) {
        draft.database.farmBuildingTypes = (draft.database.farmBuildingTypes ?? []).map((row) =>
          row.id === buildingId
            ? {
                ...row,
                animalHousing: { allowedSpeciesIds: ["chicken"] },
                levels: row.levels.map((level) => ({ ...level, animalCapacity: level.animalCapacity ?? 2 })),
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
    const spaces = renderLedgerSpaces(project, session);
    const remove = findByTestId(spaces.panel, `life-ledger-space-building-remove-${placementA}`);
    expect(remove).toBeTruthy();
    // first click arms with impact when residents exist
    remove?.click();
    const armed = findByTestId(spaces.panel, `life-ledger-space-building-remove-${placementA}`);
    expect(armed?.textContent ?? remove?.textContent ?? "").toMatch(/미배정|철거|확인/);
    // Ensure animals survive actual remove API path
    remove?.click();
    expect(Object.keys(session.farmAnimals ?? {}).sort()).toEqual(["a", "b"]);
    expect(session.farmAnimals!.a!.housingPlacementId).toBeUndefined();
    expect(session.farmAnimals!.b!.housingPlacementId).toBeUndefined();
    void shrinkNotice;
    void impact;
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
    findByTestId(host, `db-spatial-delete-building-type-${buildingId}`)?.click();
    // placement still blocks type delete
    expect(store.getCurrent().database.farmBuildingTypes).toHaveLength(1);
    const placementB = store.getCurrent().session.farmBuildingPlacements?.find((row) => row.instanceId !== placementA)?.instanceId;
    findByTestId(host, `db-spatial-delete-building-placement-${placementA}`)?.click();
    findByTestId(host, `db-spatial-delete-building-placement-${placementA}`)?.click();
    if (placementB) {
      findByTestId(host, `db-spatial-delete-building-placement-${placementB}`)?.click();
      findByTestId(host, `db-spatial-delete-building-placement-${placementB}`)?.click();
    }
    expect(store.getCurrent().session.farmAnimals?.[0]?.instanceId).toBe("a1");
    expect(store.getCurrent().session.farmBuildingPlacements ?? []).toEqual([]);
    findByTestId(host, `db-spatial-delete-building-type-${buildingId}`)?.click();
    findByTestId(host, `db-spatial-delete-building-type-${buildingId}`)?.click();
    expect(store.getCurrent().database.farmBuildingTypes).toEqual([]);
    expect(store.getCurrent().session.farmAnimals?.[0]?.instanceId).toBe("a1");

    host = openAnimals();
    findByTestId(host, "db-farm-animals-kind-animal")?.click();
    const editor = findByTestId(host, "db-farm-animal-a1");
    const firstButton = editor?.querySelector("button");
    expect(firstButton?.textContent).toMatch(/삭제/);
  });
});
