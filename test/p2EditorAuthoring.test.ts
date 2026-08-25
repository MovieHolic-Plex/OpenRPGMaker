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
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => null, setItem: () => undefined } } });
  store.replace(createBlankProject());
  setDatabaseActiveTab("actors");
});
afterEach(() => {
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

describe("P2 database authoring", () => {
  it("places a dedicated fishing, forage, and museum tab in the life group", () => {
    // Break caught: P2 definitions exist only as raw JSON with no discoverable editor route.
    const life = TAB_GROUPS.find((group) => group.label === "생활");
    expect(life?.tabs).toContain("lifeCollections");
    const host = renderPanel();
    const tab = findByTestId(host, "db-tab-life-collections");
    expect(tab?.textContent).toBe("낚시·채집·박물관");
    tab?.click();
    expect(findByTestId(host, "db-life-collections-hero-image")?.getAttribute("src")).toMatch(/foraging-card\.png$/);
  });

  it("seeds connected definitions and exposes all four authoring sections", () => {
    // Break caught: the custom tab creates empty shells or disconnected ids that fail reload.
    const host = renderPanel();
    findByTestId(host, "db-tab-life-collections")?.click();
    expect(findByTestId(host, "db-life-collections-workspace")).toBeTruthy();
    expect(findByTestId(host, "db-life-collections-empty")).toBeTruthy();
    for (const section of ["fish", "fishing", "forage", "museum"]) {
      expect(findByTestId(host, `db-life-collections-${section}`)).toBeFalsy();
    }
    findByTestId(host, "db-life-collections-seed-defaults")?.click();
    for (const section of ["fish", "fishing", "forage", "museum"]) {
      expect(findByTestId(host, `db-life-collections-${section}`)).toBeTruthy();
    }

    const project = store.getCurrent();
    expect(project.database.fishSpecies).toHaveLength(1);
    expect(project.system.fishing?.spots).toHaveLength(1);
    expect(project.system.seasonalForage?.areas).toHaveLength(1);
    expect(project.system.collections?.enabled).toBe(true);
    expect(project.system.museum?.rewards).toHaveLength(1);
    expect(() => deserialize(serialize(project))).not.toThrow();

    const fishName = findByTestId(host, "db-life-collections-name-fish-fish_river");
    if (!fishName) throw new Error("missing structured fish editor");
    fishName.value = "은빛 강 물고기";
    fishName.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.fishSpecies?.[0]?.name).toBe("은빛 강 물고기");

    findByTestId(host, "db-life-collections-delete-fishing-fishing_spot_river")?.click();
    expect(store.getCurrent().system.fishing?.spots).toEqual([]);
    expect(store.getCurrent().system.seasonalForage?.areas).toHaveLength(1);
    expect(store.getCurrent().system.museum?.rewards).toHaveLength(1);
  });
});
