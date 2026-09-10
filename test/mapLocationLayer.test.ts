/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { installMapLocationLayer } from "@/editor/mapLocationLayer";
import {
  createLocationFromRect,
  currentLocations,
  deleteLocation,
  locationDeletionImpact,
  locationLayerState,
  renameSelectedLocation,
  repairBrokenLocationReferences,
  resizeLocation,
  selectLocation,
  setLocationLayerEnabled,
  toggleLocationLayer,
} from "@/editor/mapLocationLayerState";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { GameMap } from "@/project/types";

const MAP_ID = "layer_map";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function seedProject(): void {
  const project = createBlankProject();
  const map: GameMap = {
    id: MAP_ID,
    name: "레이어 맵",
    width: 20,
    height: 20,
    tilesetId: "easyrpg_chipset_combined_town",
    tileSize: 16,
    lowerTiles: new Array(400).fill(TILE.GRASS),
    upperTiles: new Array(400).fill(TILE.EMPTY),
    events: [],
  };
  project.maps[MAP_ID] = map;
  project.startMapId = MAP_ID;
  store.replace(project);
  editorState.set({ currentMapId: MAP_ID });
}

let dispose: (() => void) | null = null;

function mount(): HTMLElement {
  const host = document.createElement("div");
  host.className = "phaser-container";
  document.body.append(host);
  dispose = installMapLocationLayer();
  return host;
}

function testId(id: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
}

describe("map location editor layer", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: new MemoryStorage() });
    seedProject();
    setLocationLayerEnabled(false);
    selectLocation(null);
  });

  afterEach(() => {
    dispose?.();
    dispose = null;
    document.body.innerHTML = "";
    setLocationLayerEnabled(false);
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("is inert until toggled on: no pointer target and no inspector", () => {
    mount();
    const overlay = testId("map-location-layer");
    const inspector = testId("map-location-inspector");
    expect(overlay).not.toBeNull();
    expect(overlay?.classList.contains("is-active")).toBe(false);
    expect(inspector?.classList.contains("is-active")).toBe(false);
    // 꺼진 상태에서는 아무것도 그리지 않는다 — 캔버스 위에 남는 잔상이 없다.
    expect(overlay?.children).toHaveLength(0);
  });

  it("toggling on activates the layer and persists across reinstall", () => {
    mount();
    toggleLocationLayer();
    expect(locationLayerState().enabled).toBe(true);
    expect(testId("map-location-layer")?.classList.contains("is-active")).toBe(true);
    expect(testId("map-location-inspector")?.classList.contains("is-active")).toBe(true);
    expect(localStorage.getItem("oprn:map-location-layer")).toBe("1");

    toggleLocationLayer();
    expect(testId("map-location-layer")?.classList.contains("is-active")).toBe(false);
    expect(localStorage.getItem("oprn:map-location-layer")).toBeNull();
  });

  it("draws, names, renames, resizes and deletes a location through the layer surface", () => {
    mount();
    setLocationLayerEnabled(true);

    expect(createLocationFromRect({ x: 2, y: 3, w: 5, h: 4 }).ok).toBe(true);
    const created = currentLocations()[0]!;
    expect(created).toMatchObject({ x: 2, y: 3, w: 5, h: 4 });
    // 그린 직후 자동 선택 + 인스펙터에 이름 칸이 뜬다(그리자마자 이름을 붙이는 흐름).
    expect(locationLayerState().selectedId).toBe(created.id);
    const nameInput = testId("map-location-name-input") as HTMLInputElement | null;
    expect(nameInput?.value).toBe(created.name);
    expect(testId(`map-location-box-${created.id}`)).not.toBeNull();
    expect(testId(`map-location-label-${created.id}`)?.textContent).toBe(created.name);

    expect(renameSelectedLocation(created.id, "정문 광장").ok).toBe(true);
    expect(testId(`map-location-label-${created.id}`)?.textContent).toBe("정문 광장");
    expect(testId("map-location-id")?.textContent).toContain(created.id);

    expect(resizeLocation(created.id, { x: 1, y: 1, w: 9, h: 9 }).ok).toBe(true);
    expect((testId("map-location-rect-w") as HTMLInputElement).value).toBe("9");
    // ID 는 이름·크기 변경을 모두 견딘다.
    expect(currentLocations()[0]?.id).toBe(created.id);

    expect(deleteLocation(created.id).ok).toBe(true);
    expect(currentLocations()).toHaveLength(0);
    expect(locationLayerState().selectedId).toBeNull();
    expect(testId("map-location-list")?.textContent).toContain("아직 구역이 없습니다");
  });

  it("renders the box geometry at the current zoom", () => {
    mount();
    setLocationLayerEnabled(true);
    editorState.set({ zoom: 2 });
    createLocationFromRect({ x: 2, y: 3, w: 4, h: 5 });
    const id = currentLocations()[0]!.id;
    const box = testId(`map-location-box-${id}`)!;
    // 16px 타일 × zoom 2
    expect(box.style.left).toBe("64px");
    expect(box.style.top).toBe("96px");
    expect(box.style.width).toBe("128px");
    expect(box.style.height).toBe("160px");
  });

  it("warns about overlap without blocking it", () => {
    mount();
    setLocationLayerEnabled(true);
    createLocationFromRect({ x: 0, y: 0, w: 10, h: 10 }, "상점가");
    createLocationFromRect({ x: 4, y: 4, w: 2, h: 2 }, "좌판");
    expect(currentLocations()).toHaveLength(2);
    expect(testId("map-location-overlap")?.textContent).toContain("상점가");
  });

  it("shows the reference impact before deletion and a repair path after it", () => {
    mount();
    setLocationLayerEnabled(true);
    createLocationFromRect({ x: 2, y: 2, w: 4, h: 4 }, "정문 광장");
    createLocationFromRect({ x: 12, y: 12, w: 4, h: 4 }, "뒷골목");
    const plaza = currentLocations()[0]!;
    const alley = currentLocations()[1]!;
    store.update((project) => {
      project.maps[MAP_ID].encounterTable = [{ troopId: "troop_slime", weight: 1, conditions: { locationId: plaza.id } }];
    }, { scope: "map", mapId: MAP_ID, label: "test encounter" });

    selectLocation(plaza.id);
    expect(testId("map-location-refs")?.textContent).toContain("1건");
    const impact = locationDeletionImpact(plaza.id);
    expect(impact?.sites).toHaveLength(1);
    expect(impact?.sites[0]).toContain("인카운터");

    expect(deleteLocation(plaza.id).ok).toBe(true);
    // 참조는 남아 있고 복구 UI 가 드러난다.
    expect(store.getCurrent().maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(plaza.id);
    const broken = testId("map-location-broken");
    expect(broken).not.toBeNull();
    expect(broken?.textContent).toContain(plaza.id);
    expect(testId(`map-location-repair-remap-${plaza.id}`)).not.toBeNull();
    expect(testId(`map-location-repair-detach-${plaza.id}`)).not.toBeNull();

    expect(repairBrokenLocationReferences(plaza.id, { kind: "remap", locationId: alley.id }).ok).toBe(true);
    expect(store.getCurrent().maps[MAP_ID].encounterTable?.[0]?.conditions?.locationId).toBe(alley.id);
    expect(testId("map-location-broken")).toBeNull();
  });

  it("turning the layer off drops selection and stops rendering boxes", () => {
    mount();
    setLocationLayerEnabled(true);
    createLocationFromRect({ x: 2, y: 2, w: 3, h: 3 }, "구역");
    const id = currentLocations()[0]!.id;
    expect(testId(`map-location-box-${id}`)).not.toBeNull();

    setLocationLayerEnabled(false);
    expect(locationLayerState().selectedId).toBeNull();
    expect(testId(`map-location-box-${id}`)).toBeNull();
    // 데이터는 그대로다 — 레이어를 끈다고 저작물이 사라지지 않는다.
    expect(store.getCurrent().maps[MAP_ID].locations).toHaveLength(1);
  });
});
