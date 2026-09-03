import { afterEach, beforeEach, describe, expect, it } from "vitest";

const KEY = "oprn:map-panel-collapsed";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

async function loadModule() {
  return import("@/editor/workspace/mapPanelSection");
}

describe("맵 도크 섹션 접힘 상태", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: new MemoryStorage() });
  });

  afterEach(async () => {
    (await loadModule()).resetMapPanelSectionForTests();
    Reflect.deleteProperty(globalThis, "localStorage");
  });

  it("기본은 펼침이고 토글은 상태를 뒤집으며 구독자에게 한 번만 알린다", async () => {
    const mod = await loadModule();
    mod.resetMapPanelSectionForTests();
    expect(mod.isMapPanelCollapsed()).toBe(false);
    let notified = 0;
    const unsubscribe = mod.subscribeMapPanel(() => { notified += 1; });

    expect(mod.toggleMapPanelCollapsed()).toBe(true);
    expect(mod.isMapPanelCollapsed()).toBe(true);
    expect(notified).toBe(1);

    // 같은 값을 다시 넣으면 알리지 않는다 — 레이아웃 재계산이 헛돌지 않게.
    mod.setMapPanelCollapsed(true);
    expect(notified).toBe(1);

    unsubscribe();
    mod.toggleMapPanelCollapsed();
    expect(mod.isMapPanelCollapsed()).toBe(false);
    expect(notified).toBe(1);
  });

  it("접힘은 localStorage 한 키에 남고 펴면 지워진다", async () => {
    const mod = await loadModule();
    mod.resetMapPanelSectionForTests();
    mod.setMapPanelCollapsed(true);
    expect(localStorage.getItem(KEY)).toBe("1");
    mod.setMapPanelCollapsed(false);
    expect(localStorage.getItem(KEY)).toBeNull();
  });
});
