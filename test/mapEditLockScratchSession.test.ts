import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installFakeDom } from "./fakeDom";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

let restoreDom: (() => void) | null = null;

beforeEach(() => {
  vi.resetModules();
  restoreDom = installFakeDom();
  const storage = new MemoryStorage();
  storage.setItem(
    "oprn:legacyDb-project-config",
    JSON.stringify({ anonKey: "anon", projectId: "proj", source: "custom", url: "https://db.test" }),
  );
  storage.setItem("oprn:editor-session-id", "session-self");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: { localStorage: storage },
  });
});

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  vi.unstubAllGlobals();
});

describe("스크래치 세션(원격 저장 비활성)의 맵 편집 락", () => {
  it("remotePersistenceEnabled=false 세션은 락을 취득하지 않고 idle을 유지한다", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { store } = await import("@/project/store");
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    const locks = await import("@/editor/mapEditLocks");
    await locks.checkoutMapForEditing("map_scratch", "스크래치");
    expect(fetchMock, "스크래치 세션은 원격 락 REST를 호출하면 안 된다").not.toHaveBeenCalled();
    expect(locks.getMapEditLockStatus().kind).toBe("idle");
  });

  it("스크래치 세션은 강제 탈취(takeover)도 원격 호출 없이 무시된다", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("{}", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { store } = await import("@/project/store");
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: false });
    const locks = await import("@/editor/mapEditLocks");
    await locks.takeoverMapLock("map_scratch", "스크래치");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(locks.getMapEditLockStatus().kind).toBe("idle");
  });

});
