// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderLifeCollectionsTab } from "@/editor/panels/databaseLifeCollectionsView";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

function control<T extends HTMLElement = HTMLInputElement>(host: HTMLElement, testid: string): T {
  const node = host.querySelector<T>(`[data-testid="${testid}"]`);
  if (!node) throw new Error(`Missing ${testid}`);
  return node;
}

function inputSearch(host: HTMLElement, value: string): HTMLInputElement {
  const search = control(host, "db-life-collections-search");
  search.value = value;
  search.dispatchEvent(new Event("input", { bubbles: true }));
  vi.advanceTimersByTime(100);
  return search;
}

function mount() {
  const host = document.createElement("div");
  document.body.append(host);
  let renders = 0;
  const rerender = (): void => {
    renders++;
    host.replaceChildren();
    renderLifeCollectionsTab(host, rerender);
  };
  rerender();
  control<HTMLButtonElement>(host, "db-life-collections-chip-all").click();
  inputSearch(host, "");
  control<HTMLButtonElement>(host, "db-life-collections-row-fish-fish_ux2_0").click();
  return { host, renders: () => renders, rerender };
}

beforeEach(() => {
  vi.useFakeTimers();
  const project = createBlankProject();
  const item = project.database.items[0]!;
  while (project.database.items.length < 1000) {
    const index = project.database.items.length;
    project.database.items.push({ ...structuredClone(item), id: `item_ux2_${index}`, name: `Item ${index}` });
  }
  project.database.fishSpecies = Array.from({ length: 100 }, (_, index) => ({
    id: `fish_ux2_${index}`, name: `Fish ${index}`, itemId: item.id, skillXp: 1,
  }));
  project.system.fishing = { enabled: true, spots: [{
    id: "spot_ux2", name: "UX spot", mapId: project.startMapId, area: { x: 0, y: 0, w: 2, h: 2 },
    catches: [{ fishId: "fish_ux2_0", weight: 1 }],
  }] };
  project.system.seasonalForage = { enabled: true, areas: [{
    id: "area_ux2", name: "UX forage", mapId: project.startMapId, area: { x: 0, y: 0, w: 2, h: 2 },
    entries: [{ id: "entry_ux2", itemId: item.id, weight: 1 }], dailySpawnCount: 1, maxActive: 1, despawnAfterDays: 1,
  }] };
  project.system.museum = { enabled: true, eligibleItemIds: [], rewards: [{ id: "museum_ux2", name: "UX museum", minDonations: 1 }] };
  project.system.collections = { enabled: true, trackedItemIds: [] };
  store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
  store.replace(project);
  resetMapEditHistory();
});
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("UX round 2: retained Life search and selected inspectors", () => {
  it("retains search identity, midpoint caret and inspector drafts through paused and no-match typing", () => {
    const { host, renders } = mount();
    const search = control(host, "db-life-collections-search");
    const inspector = control(host, "db-life-collections-panel-fish-fish_ux2_0");
    const name = control(host, "db-life-collections-name-fish-fish_ux2_0");
    name.value = "Uncommitted DOM draft";
    search.focus();
    search.value = "Fih 0";
    search.setSelectionRange(2, 2);
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const count = renders();
    vi.advanceTimersByTime(180);
    expect(document.activeElement).toBe(search);
    expect(control(host, "db-life-collections-search")).toBe(search);
    expect([search.selectionStart, search.selectionEnd]).toEqual([2, 2]);
    search.value = "Fish 0";
    search.setSelectionRange(3, 3);
    search.dispatchEvent(new Event("input", { bubbles: true }));
    vi.advanceTimersByTime(180);
    expect(document.activeElement).toBe(search);
    expect([search.selectionStart, search.selectionEnd]).toEqual([3, 3]);
    expect(host.querySelectorAll('[data-testid^="db-life-collections-row-fish-"]')).toHaveLength(1);
    inputSearch(host, "absent-name");
    expect(host.querySelectorAll('[data-testid^="db-life-collections-row-"]')).toHaveLength(0);
    expect(control(host, "db-life-collections-list-pane").querySelector(".db-ws-count")?.textContent).toBe("0/103개");
    expect(control(host, "db-life-collections-panel-fish-fish_ux2_0")).toBe(inspector);
    expect(name.value).toBe("Uncommitted DOM draft");
    expect(renders()).toBe(count);
    expect(host.querySelectorAll('[data-testid^="db-life-collections-fish-item-"] option')).toHaveLength(store.getCurrent().database.items.length);
    expect(host.querySelectorAll('[data-testid^="db-life-collections-panel-"][hidden]')).toHaveLength(0);
  });

  it("does not steal focus when a debounce completes after the user changes controls", () => {
    const { host } = mount();
    const search = control(host, "db-life-collections-search");
    search.focus();
    search.value = "Fish";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    const name = control(host, "db-life-collections-name-fish-fish_ux2_0");
    name.focus();
    name.setSelectionRange(1, 3);
    vi.advanceTimersByTime(100);
    expect(document.activeElement).toBe(name);
    expect([name.selectionStart, name.selectionEnd]).toEqual([1, 3]);
  });

  it("filters before creating rows and mounts one inspector of any kind only when selected", () => {
    const { host, renders } = mount();
    const before = renders();
    control<HTMLButtonElement>(host, "db-life-collections-chip-fishing").click();
    expect(renders()).toBe(before);
    expect(host.querySelectorAll('[data-testid^="db-life-collections-row-fish-"]')).toHaveLength(0);
    expect(control(host, "db-life-collections-chip-fishing").getAttribute("aria-pressed")).toBe("true");
    for (const [kind, id] of [["fishing", "spot_ux2"], ["forage", "area_ux2"], ["museum", "museum_ux2"], ["fish", "fish_ux2_1"]]) {
      control<HTMLButtonElement>(host, `db-life-collections-chip-${kind}`).click();
      control<HTMLButtonElement>(host, `db-life-collections-row-${kind}-${id}`).click();
      expect(control(host, `db-life-collections-panel-${kind}-${id}`).hidden).toBe(false);
      expect(host.querySelectorAll('[data-testid^="db-life-collections-panel-"]')).toHaveLength(1);
    }
  });

  it("creates collapsed item chips on first expansion and retains them through search", () => {
    const { host } = mount();
    const card = control(host, "db-life-collections-museum-eligible-card");
    expect(host.querySelector('[data-testid="db-life-collections-museum-eligible"]')).toBeNull();
    card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
    const chips = control(host, "db-life-collections-museum-eligible");
    expect(chips.children).toHaveLength(store.getCurrent().database.items.length);
    inputSearch(host, "absent");
    expect(control(host, "db-life-collections-museum-eligible")).toBe(chips);
    card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
    card.querySelector<HTMLButtonElement>(".db-ws-card-toggle")!.click();
    expect(chips.children).toHaveLength(store.getCurrent().database.items.length);
  });

  it("preserves pre-debounce input across rendering and ignores the detached search callback", () => {
    const { host, rerender } = mount();
    const oldSearch = control(host, "db-life-collections-search");
    oldSearch.value = "Fish 1";
    oldSearch.dispatchEvent(new Event("input", { bubbles: true }));
    rerender();
    const search = inputSearch(host, "Fish 2");
    expect(search.value).toBe("Fish 2");
    expect(host.querySelector('[data-testid="db-life-collections-row-fish-fish_ux2_2"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="db-life-collections-row-fish-fish_ux2_1"]')).toBeNull();
  });
});
