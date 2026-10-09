import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab } from "@/editor/panels/database";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { store } from "@/project/store";
import type { FarmAnimalStartInstance, FarmBuildingLevelDefinition, FarmBuildingTypeRecord } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date("2026-09-08T00:00:00Z"));
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

function renderAnimalsTab(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  const tab = findByTestId(host, "db-tab-farm-animals");
  if (!tab) throw new Error("missing farm animals tab");
  tab.click();
  return host;
}

function parseStats(host: FakeElement): {
  readonly homes: number;
  readonly free: number;
  readonly used: number;
  readonly capacity: number;
} {
  const strip = findByTestId(host, "db-farm-animals-stats");
  if (!strip) throw new Error("missing db-farm-animals-stats");
  const tiles = strip.querySelectorAll(".db-ws-stat");
  const byLabel = new Map<string, { value: string; hint: string }>();
  for (const tile of tiles) {
    const label = tile.querySelector(".db-ws-stat-label")?.textContent?.trim() ?? "";
    const value = tile.querySelector(".db-ws-stat-value")?.textContent?.trim() ?? "";
    const hint = tile.querySelector(".db-ws-stat-hint")?.textContent?.trim() ?? "";
    byLabel.set(label, { value, hint });
  }
  const homes = byLabel.get("축사");
  const free = byLabel.get("수용 여유");
  if (!homes || !free) throw new Error(`stats missing homes/free: ${[...byLabel.keys()].join(",")}`);
  const freeMatch = /^(-?\d+)/.exec(free.value);
  const usedMatch = /^(-?\d+)\s*\/\s*(-?\d+)/.exec(free.hint);
  if (!freeMatch || !usedMatch) {
    throw new Error(`unparseable free stats value=${free.value} hint=${free.hint}`);
  }
  return {
    homes: Number(homes.value),
    free: Number(freeMatch[1]),
    used: Number(usedMatch[1]),
    capacity: Number(usedMatch[2]),
  };
}

function seedSpecies(): void {
  const project = store.getCurrent();
  const feedId = project.database.items[0]?.id;
  const productId = project.database.items[1]?.id ?? feedId;
  if (!feedId || !productId) throw new Error("blank project needs items");
  store.update((draft) => {
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
  });
}

function level(partial: Partial<FarmBuildingLevelDefinition> & Pick<FarmBuildingLevelDefinition, "level" | "animalCapacity">): FarmBuildingLevelDefinition {
  return {
    footprint: { width: 2, height: 2 },
    capacity: 99,
    graphicResourceId: "gfx",
    ...partial,
  };
}

function seedHousingType(opts: {
  readonly id?: string;
  readonly name?: string;
  readonly levels: FarmBuildingLevelDefinition[];
  readonly allowedSpeciesIds?: string[];
  readonly animalHousing?: boolean;
}): string {
  const id = opts.id ?? "coop_type";
  const record: FarmBuildingTypeRecord = {
    id,
    name: opts.name ?? "우리",
    levels: opts.levels,
    ...(opts.animalHousing === false
      ? {}
      : { animalHousing: { allowedSpeciesIds: opts.allowedSpeciesIds ?? ["chicken"] } }),
  };
  store.update((draft) => {
    draft.database.farmBuildingTypes = [...(draft.database.farmBuildingTypes ?? []), record];
  });
  return id;
}

function seedPlacement(opts: {
  readonly instanceId: string;
  readonly typeId: string;
  readonly level?: number;
  readonly x?: number;
  readonly y?: number;
}): void {
  const project = store.getCurrent();
  store.update((draft) => {
    draft.session.farmBuildingPlacements = [
      ...(draft.session.farmBuildingPlacements ?? []),
      {
        instanceId: opts.instanceId,
        typeId: opts.typeId,
        level: opts.level ?? 1,
        mapId: project.startMapId,
        x: opts.x ?? 1,
        y: opts.y ?? 1,
        orientation: "down",
      },
    ];
  });
}

function seedLegacyBarn(opts?: { readonly id?: string; readonly capacity?: number; readonly species?: string[] }): void {
  store.update((draft) => {
    draft.system.farmAnimalBuildings = [
      ...(draft.system.farmAnimalBuildings ?? []),
      {
        id: opts?.id ?? "legacy_coop",
        name: "옛 축사",
        mapId: draft.startMapId,
        x: 2,
        y: 2,
        capacity: opts?.capacity ?? 3,
        allowedSpeciesIds: opts?.species ?? ["chicken"],
      },
    ];
  });
}

function seedAnimals(rows: FarmAnimalStartInstance[]): void {
  store.update((draft) => {
    draft.session.farmAnimals = rows;
  });
}

describe("animal housing summary metrics", () => {
  it("linked-only homes count placement capacity and occupancy", () => {
    seedSpecies();
    const typeId = seedHousingType({
      levels: [level({ level: 1, animalCapacity: 2 })],
    });
    seedPlacement({ instanceId: "placementA", typeId, x: 1, y: 1 });
    seedPlacement({ instanceId: "placementB", typeId, x: 4, y: 1 });
    seedAnimals([
      { instanceId: "a1", speciesId: "chicken", name: "A1", housingPlacementId: "placementA" },
      { instanceId: "a2", speciesId: "chicken", name: "A2", housingPlacementId: "placementA" },
    ]);

    const before = serialize(store.getCurrent());
    const stats = parseStats(renderAnimalsTab());
    const after = serialize(store.getCurrent());

    expect(after).toBe(before);
    expect(stats.homes).toBe(2);
    expect(stats.capacity).toBe(4);
    expect(stats.used).toBe(2);
    expect(stats.free).toBe(2);
  });

  it("legacy-only homes keep barn capacity and occupancy", () => {
    seedSpecies();
    seedLegacyBarn({ capacity: 3 });
    seedAnimals([
      { instanceId: "a1", speciesId: "chicken", name: "A1", buildingId: "legacy_coop" },
      { instanceId: "u1", speciesId: "chicken", name: "U1" },
    ]);

    const stats = parseStats(renderAnimalsTab());
    expect(stats.homes).toBe(1);
    expect(stats.capacity).toBe(3);
    expect(stats.used).toBe(1);
    expect(stats.free).toBe(2);
  });

  it("mixed legacy and linked homes sum without pooling capacity across placements", () => {
    seedSpecies();
    seedLegacyBarn({ id: "legacy_coop", capacity: 2 });
    const typeId = seedHousingType({
      levels: [
        level({ level: 1, animalCapacity: 1 }),
        level({ level: 2, animalCapacity: 5 }),
      ],
    });
    seedPlacement({ instanceId: "p_low", typeId, level: 1, x: 1, y: 1 });
    seedPlacement({ instanceId: "p_high", typeId, level: 2, x: 5, y: 1 });
    seedAnimals([
      { instanceId: "l1", speciesId: "chicken", name: "L1", buildingId: "legacy_coop" },
      { instanceId: "h1", speciesId: "chicken", name: "H1", housingPlacementId: "p_high" },
      { instanceId: "h2", speciesId: "chicken", name: "H2", housingPlacementId: "p_high" },
      { instanceId: "loose", speciesId: "chicken", name: "Loose" },
    ]);

    const stats = parseStats(renderAnimalsTab());
    // legacy 2 + level1 1 + level2 5 = 8; used = legacy1 + high2 = 3; free = 5
    expect(stats.homes).toBe(3);
    expect(stats.capacity).toBe(8);
    expect(stats.used).toBe(3);
    expect(stats.free).toBe(5);
  });

  it("ignores unassigned animals and invalid home refs for occupancy used count", () => {
    seedSpecies();
    const typeId = seedHousingType({
      levels: [level({ level: 1, animalCapacity: 2 })],
    });
    seedPlacement({ instanceId: "home", typeId });
    seedLegacyBarn({ id: "legacy_coop", capacity: 4 });
    seedAnimals([
      { instanceId: "ok_link", speciesId: "chicken", name: "OKL", housingPlacementId: "home" },
      { instanceId: "ok_legacy", speciesId: "chicken", name: "OKB", buildingId: "legacy_coop" },
      { instanceId: "unassigned", speciesId: "chicken", name: "U" },
      { instanceId: "bad_link", speciesId: "chicken", name: "BL", housingPlacementId: "missing-home" },
      { instanceId: "bad_legacy", speciesId: "chicken", name: "BB", buildingId: "missing-barn" },
      {
        instanceId: "dual",
        speciesId: "chicken",
        name: "D",
        buildingId: "legacy_coop",
        housingPlacementId: "home",
      },
    ]);

    const stats = parseStats(renderAnimalsTab());
    expect(stats.homes).toBe(2);
    expect(stats.capacity).toBe(6);
    expect(stats.used).toBe(2);
    expect(stats.free).toBe(4);
  });

  it("excludes non-housing placements from home and capacity totals", () => {
    seedSpecies();
    const housingId = seedHousingType({
      id: "house",
      levels: [level({ level: 1, animalCapacity: 3 })],
    });
    const shedId = seedHousingType({
      id: "shed",
      animalHousing: false,
      levels: [level({ level: 1, animalCapacity: 9 })],
    });
    seedPlacement({ instanceId: "house1", typeId: housingId });
    seedPlacement({ instanceId: "shed1", typeId: shedId, x: 6, y: 1 });
    seedAnimals([
      { instanceId: "a1", speciesId: "chicken", name: "A1", housingPlacementId: "house1" },
      { instanceId: "s1", speciesId: "chicken", name: "S1", housingPlacementId: "shed1" },
    ]);

    const stats = parseStats(renderAnimalsTab());
    expect(stats.homes).toBe(1);
    expect(stats.capacity).toBe(3);
    expect(stats.used).toBe(1);
    expect(stats.free).toBe(2);
  });

  it("shows zero totals when no relevant homes exist", () => {
    seedSpecies();
    seedAnimals([{ instanceId: "a1", speciesId: "chicken", name: "A1" }]);
    const stats = parseStats(renderAnimalsTab());
    expect(stats.homes).toBe(0);
    expect(stats.capacity).toBe(0);
    expect(stats.used).toBe(0);
    expect(stats.free).toBe(0);
  });
});
