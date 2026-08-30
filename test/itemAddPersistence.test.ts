import { afterEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("editor-added item persistence", () => {
  it("marks a fresh-project item edit as non-persistent before the fresh session discards it", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", {
      addEventListener: () => undefined,
      location: {
        hostname: "127.0.0.1",
        pathname: "/",
        search: "?freshProject=1",
      },
      localStorage: storage,
    });
    vi.stubGlobal("fetch", async () => {
      throw new Error("fresh-project item persistence must not call Supabase");
    });
    vi.resetModules();

    const [{ createBlankProject }, storeModule, databaseActions] = await Promise.all([
      import("@/project/defaults"),
      import("@/project/store"),
      import("@/editor/databaseActions"),
    ]);
    storeModule.setDevProjectFactory(() => createBlankProject());
    await storeModule.store.load();

    const itemId = databaseActions.addDatabaseRecord("items");

    expect(storeModule.store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(true);
    expect(storeModule.store.getAutoSaveState()).toMatchObject({
      kind: "error",
      code: "session-not-persisted",
    });

    const flushResult = await storeModule.store.flush();
    expect(flushResult).toEqual({ kind: "saved-local" });
    expect(storeModule.store.getAutoSaveState()).toMatchObject({
      kind: "error",
      code: "session-not-persisted",
    });

    await storeModule.store.load();
    expect(storeModule.store.getCurrent().database.items.some((item) => item.id === itemId)).toBe(false);
    expect(storage.length).toBe(0);
  }, 30_000);
});
