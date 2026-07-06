// 미저장 변경 경고 근거(도그푸딩 결함 ⑧) 회귀 테스트.
// store.hasUnsavedChanges(): 마지막 "실제 저장" 이후 변경 여부 —
// fresh/blank(저장 스킵) 모드에서는 flush가 saved-local을 돌려줘도 true로 남아야 한다.
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function stubWindow(search: string, storage: Map<string, string>): void {
  vi.stubGlobal("window", {
    location: { hostname: "127.0.0.1", pathname: "/", search },
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, String(value)),
      removeItem: (key: string) => void storage.delete(key),
    },
  });
}

describe("store.hasUnsavedChanges", () => {
  it("devProject 모드: 변경→true, flush(로컬 기록)→false", async () => {
    const storage = new Map<string, string>();
    stubWindow("?devProject=1&logCabinShowcase=1", storage);
    vi.resetModules();
    const { store } = await import("@/project/store");
    await store.load(); // dev-showcase 경로 — 네트워크 불필요.
    expect(store.hasUnsavedChanges()).toBe(false);

    store.update((draft) => {
      draft.meta.title = "미저장 변경";
    });
    expect(store.hasUnsavedChanges()).toBe(true);

    const flushed = await store.flush();
    expect(flushed.kind).toBe("saved-local");
    expect(store.hasUnsavedChanges()).toBe(false); // 실제 localStorage 기록됨.
    expect(storage.size).toBeGreaterThan(0);
  });

  it("freshProject(저장 스킵) 모드: flush가 saved-local이어도 미저장으로 남는다", async () => {
    const storage = new Map<string, string>();
    stubWindow("?freshProject=1", storage);
    vi.resetModules();
    const { store } = await import("@/project/store");
    await store.load();
    expect(store.hasUnsavedChanges()).toBe(false);

    store.update((draft) => {
      draft.meta.title = "증발 위험 변경";
    });
    expect(store.hasUnsavedChanges()).toBe(true);

    const flushed = await store.flush();
    expect(flushed.kind).toBe("saved-local");
    // 기록이 스킵됐으므로 여전히 미저장 — beforeunload 경고 대상.
    expect(store.hasUnsavedChanges()).toBe(true);
    expect(storage.size).toBe(0);
  });
});
