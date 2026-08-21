// 부팅 실패 복구(도그푸딩 결함 ②) 회귀 테스트.
// - store.loadFallbackProject: 로드 실패 상태에서 예제/빈 프로젝트를 메모리로 열되
//   깨진 원격/로컬 사본을 덮어쓰지 않도록 원격 저장은 꺼진 채 시작한다.
// - devProjectPersistence.discardDevProjectOverride: 손상된 로컬 사본 폐기 액션.
import { afterEach, describe, expect, it, vi } from "vitest";

describe("store.loadFallbackProject — 로드 실패 복구", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("예제 프로젝트를 메모리로 열고, 원격 저장은 꺼진 채(loaded=true) 시작한다", async () => {
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined },
    });
    const fetchSpy = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchSpy);
    vi.resetModules();

    const { store } = await import("@/project/store");
    const { createSampleAdventureProject } = await import("@/project/defaults");
    expect(store.isLoaded()).toBe(false);

    await store.loadFallbackProject(createSampleAdventureProject());

    expect(store.isLoaded()).toBe(true);
    expect(Object.keys(store.getCurrent().maps).length).toBeGreaterThan(0);
    // 원격 저장이 꺼져 있어 flush가 disabled로 끝난다(깨진 원격 프로젝트 덮어쓰기 방지).
    const flushed = await store.flush();
    expect(flushed.kind).toBe("disabled");
    expect(fetchSpy).not.toHaveBeenCalled();
    // 상태 칩도 "꺼짐(load-failed)"으로 보인다.
    const status = store.getDbPersistenceStatus();
    expect(status.kind).toBe("disabled");
  });
});

describe("devProjectPersistence — 로컬 사본 폐기(복구 액션)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function stubWindowWithStorage(search: string, storage: Map<string, string>): void {
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search },
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => void storage.set(key, value),
        removeItem: (key: string) => void storage.delete(key),
      },
    });
  }

  it("손상된 로컬 사본이 있으면 감지하고, 폐기하면 저장소에서 제거된다", async () => {
    const storage = new Map<string, string>();
    stubWindowWithStorage("?devProject=1", storage);
    vi.resetModules();
    const { hasDevProjectOverride, discardDevProjectOverride } = await import("@/project/devProjectPersistence");

    expect(hasDevProjectOverride()).toBe(false);
    // 손상된(파싱 불가) 사본을 심는다 — loadDevProjectOverride가 throw하는 벽돌 상황.
    storage.set("oprn:dev-project:127.0.0.1/?devProject=1", "{broken json");
    expect(hasDevProjectOverride()).toBe(true);

    discardDevProjectOverride();
    expect(hasDevProjectOverride()).toBe(false);
    expect(storage.size).toBe(0);
  });

  it("freshProject/blankProject 위치에서는 로컬 사본을 취급하지 않는다", async () => {
    const storage = new Map<string, string>();
    stubWindowWithStorage("?freshProject=1", storage);
    vi.resetModules();
    const { hasDevProjectOverride } = await import("@/project/devProjectPersistence");
    expect(hasDevProjectOverride()).toBe(false);
  });
});
