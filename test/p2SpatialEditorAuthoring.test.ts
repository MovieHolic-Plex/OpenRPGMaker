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
    value: { localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } },
  });
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

describe("P2 spatial editor authoring", () => {
  it("exposes a discoverable life tab with a product asset and honest aggregate count", () => {
    // Break caught: the spatial schema exists but beginners cannot discover or distinguish it from P1 animal homes.
    const life = TAB_GROUPS.find((group) => group.label === "생활");
    expect(life?.tabs.at(-1)).toBe("farmSpatial");
    const host = renderPanel();
    const tab = findByTestId(host, "db-tab-farm-spatial");
    expect(tab?.textContent).toBe("농장 건물·집 꾸미기");
    expect(tab?.dataset.count).toBe("0");
    tab?.click();
    expect(findByTestId(host, "db-spatial-workspace")).toBeTruthy();
    expect(findByTestId(host, "db-spatial-hero-image")?.getAttribute("src"))
      .toBe("/assets/farming/life-ui/decorating-card.png");
    expect(findByTestId(host, "db-spatial-empty-state")).toBeTruthy();
  });

  it("creates structured building/decor definitions and independent authored placements", () => {
    // Break caught: the tab is a count-only shell or raw JSON instead of list/detail CRUD.
    const host = renderPanel();
    findByTestId(host, "db-tab-farm-spatial")?.click();
    findByTestId(host, "db-spatial-add-building-type")?.click();
    findByTestId(host, "db-spatial-add-decoration-type")?.click();

    let project = store.getCurrent();
    const buildingId = project.database.farmBuildingTypes?.[0]?.id;
    const decorationId = project.database.homeDecorationTypes?.[0]?.id;
    expect(buildingId).toBeTruthy();
    expect(decorationId).toBeTruthy();
    expect(project.database.farmBuildingTypes?.[0]?.levels).toHaveLength(1);
    expect(findByTestId(host, `db-spatial-building-type-${buildingId}`)).toBeTruthy();
    expect(findByTestId(host, `db-spatial-decoration-type-${decorationId}`)).toBeTruthy();

    findByTestId(host, "db-spatial-add-building-placement")?.click();
    findByTestId(host, "db-spatial-add-decoration-placement")?.click();
    project = store.getCurrent();
    expect(project.session.farmBuildingPlacements?.[0]).toMatchObject({ typeId: buildingId, level: 1 });
    expect(project.session.homeDecorationPlacements?.[0]).toMatchObject({ typeId: decorationId });
    expect(project.system.farmAnimalBuildings).toBeUndefined();
    expect(findByTestId(host, "db-tab-farm-spatial")?.dataset.count).toBe("4");

    const reloaded = deserialize(serialize(project));
    expect(reloaded.database.farmBuildingTypes).toEqual(project.database.farmBuildingTypes);
    expect(reloaded.database.homeDecorationTypes).toEqual(project.database.homeDecorationTypes);
    expect(reloaded.session.farmBuildingPlacements).toEqual(project.session.farmBuildingPlacements);
    expect(reloaded.session.homeDecorationPlacements).toEqual(project.session.homeDecorationPlacements);
  });

  it("edits footprint, capacity, level upgrades, placement orientation, and blocks referenced type deletion", () => {
    // Break caught: required spatial fields cannot round-trip through controls or type deletion leaves dangling placements.
    const host = renderPanel();
    findByTestId(host, "db-tab-farm-spatial")?.click();
    findByTestId(host, "db-spatial-add-building-type")?.click();
    findByTestId(host, "db-spatial-add-decoration-type")?.click();
    const buildingId = store.getCurrent().database.farmBuildingTypes?.[0]?.id ?? "";
    const decorationId = store.getCurrent().database.homeDecorationTypes?.[0]?.id ?? "";

    change(host, `db-spatial-building-width-${buildingId}-1`, "3");
    change(host, `db-spatial-building-capacity-${buildingId}-1`, "12");
    findByTestId(host, `db-spatial-building-add-level-${buildingId}`)?.click();
    change(host, `db-spatial-decoration-orientation-${decorationId}-left`, "true", true);
    findByTestId(host, "db-spatial-add-building-placement")?.click();
    const placementId = store.getCurrent().session.farmBuildingPlacements?.[0]?.instanceId ?? "";
    change(host, `db-spatial-building-placement-orientation-${placementId}`, "right");

    const project = store.getCurrent();
    expect(project.database.farmBuildingTypes?.[0]).toMatchObject({
      levels: [expect.objectContaining({ footprint: { width: 3, height: 2 }, capacity: 12 }), expect.objectContaining({ level: 2 })],
    });
    expect(project.database.homeDecorationTypes?.[0]?.allowedOrientations).toContain("left");
    expect(project.session.farmBuildingPlacements?.[0]?.orientation).toBe("right");

    findByTestId(host, `db-spatial-delete-building-type-${buildingId}`)?.click();
    expect(store.getCurrent().database.farmBuildingTypes).toHaveLength(1);
    findByTestId(host, `db-spatial-delete-building-placement-${placementId}`)?.click();
    findByTestId(host, `db-spatial-delete-building-type-${buildingId}`)?.click();
    expect(store.getCurrent().database.farmBuildingTypes).toEqual([]);
  });
});

function change(host: FakeElement, testid: string, value: string, checked = false): void {
  const control = findByTestId(host, testid);
  if (!control) throw new Error(`missing control ${testid}`);
  control.value = value;
  if (checked) control.checked = value === "true";
  control.dispatchEvent(new Event("change"));
}
