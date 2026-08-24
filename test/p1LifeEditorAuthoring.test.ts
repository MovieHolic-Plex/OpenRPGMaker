import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderDatabasePanel, setDatabaseActiveTab, TAB_GROUPS } from "@/editor/panels/database";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { store } from "@/project/store";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;
let previousWindow: typeof globalThis.window | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  previousWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    },
  });
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
  if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
  else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
});

function renderPanel(): FakeElement {
  const host = document.createElement("div") as unknown as FakeElement;
  host.className = "database-modal-body";
  renderDatabasePanel(host as unknown as HTMLElement);
  return host;
}

describe("P1 life editor authoring", () => {
  it("exposes honest season/weather and animal/building tabs inside the life group", () => {
    const life = TAB_GROUPS.find((group) => group.label === "생활");
    expect(life?.tabs).toEqual(["crops", "characters", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial", "lifeCollections"]);

    const host = renderPanel();
    expect(findByTestId(host, "db-tab-daily-weather")?.textContent).toBe("계절·날씨");
    expect(findByTestId(host, "db-tab-farm-animals")?.textContent).toBe("동물·축사");
  });

  it("seeds a usable four-season weather table instead of leaving an empty shell", () => {
    const host = renderPanel();
    findByTestId(host, "db-tab-daily-weather")?.click();
    findByTestId(host, "db-weather-seed-defaults")?.click();

    const weather = store.getCurrent().system.dailyWeather;
    expect(weather?.enabled).toBe(true);
    expect(weather?.forecastDays).toBe(3);
    expect(Object.keys(weather?.seasons ?? {})).toEqual(["spring", "summer", "fall", "winter"]);
    expect(weather?.seasons.spring?.map((rule) => rule.kind)).toEqual(["none", "rain", "storm"]);
    expect(findByTestId(host, "db-weather-workspace")).toBeTruthy();
  });

  it("creates connected species, building, and starting-animal records from the empty state", () => {
    const host = renderPanel();
    findByTestId(host, "db-tab-farm-animals")?.click();
    findByTestId(host, "db-farm-animals-seed-defaults")?.click();

    const project = store.getCurrent();
    expect(project.database.farmAnimalSpecies).toHaveLength(2);
    expect(project.system.farmAnimalBuildings).toHaveLength(1);
    expect(project.session.farmAnimals).toHaveLength(2);
    expect(project.session.farmAnimals?.every((animal) => animal.buildingId === project.system.farmAnimalBuildings?.[0]?.id)).toBe(true);
    expect(findByTestId(host, "db-farm-animals-workspace")).toBeTruthy();

    const reloaded = deserialize(serialize(project));
    expect(reloaded.database.farmAnimalSpecies).toEqual(project.database.farmAnimalSpecies);
    expect(reloaded.system.farmAnimalBuildings).toEqual(project.system.farmAnimalBuildings);
    expect(reloaded.session.farmAnimals).toEqual(project.session.farmAnimals);
  });
});
