import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createMemoryRepository, type MemoryRepository } from "@/project/persistence/memoryRepository";
import type { ProjectTarget } from "@/project/persistence/target";

/**
 * 저장 기준본(persistedBaseline)의 소유권 계약.
 *
 * 왜 (2026-09-25): 저장 한 번이 같은 내용을 네 번 깊게 복제했다(제출본 · 수락본 ·
 * 커밋 로그 둘). 42MB 참고문서를 든 프로젝트에서 한 번이 약 0.5s 다. 에코가 없는 저장
 * (호스트가 제출한 것을 그대로 썼다는 뜻)에서는 수락본 복제를 없앴다 —
 * 그 값이 곧 제출본이기 때문이다.
 *
 * 이 테스트가 막는 것: (1) 에코 없는 저장에서 기준본이 제출본과 다른 객체가 되는 퇴행
 * (복제가 다시 들어오면 다음 저장의 문서 비교가 전부 «바뀌었다»가 된다),
 * (2) 저장 중 라이브 프로젝트를 제자리에서 고친 편집이 기준본에 새어 들어가는 것 —
 * 새면 다음 패치 diff 가 그 편집을 빼먹고 사용자 편집이 조용히 사라진다.
 */

type StoreModule = typeof import("@/project/store");
type RepositoryModule = typeof import("@/project/persistence/repository");

const target: ProjectTarget = { url: "memory://baseline-test", anonKey: "memory", projectId: "save-baseline-ownership" };

describe("저장 기준본 소유권", () => {
  let memory: MemoryRepository;
  let store: StoreModule["store"];
  let repositoryModule: RepositoryModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
    memory = createMemoryRepository({ target });
    repositoryModule = await import("@/project/persistence/repository");
    repositoryModule.setProjectRepositoryForTest(memory);
    ({ store } = await import("@/project/store"));
    // 선례(storeUsesRepository.test.ts)와 같은 방식: 원격 행을 심는 대신 저장 가능한 상태로 들어간다.
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
  });
  afterEach(() => {
    repositoryModule.setProjectRepositoryForTest(null);
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("에코 없는 저장은 기준본에 제출본을 그대로 쓴다 — 같은 내용을 두 번 복제하지 않는다", async () => {
    store.replaceProject(createBlankProject());
    await store.flush();
    expect(store._getPersistedBaselineForTest()).not.toBeNull();

    const mapId = store.getCurrent().startMapId;
    store.updateMapTiles(mapId, (map) => { map.lowerTiles[0] = 5; }, { cells: [{ x: 0, y: 0, layer: "lower" }] });
    await store.flush();

    const baseline = store._getPersistedBaselineForTest();
    expect(baseline).not.toBeNull();
    // 저장된 내용이 기준본에 반영돼 있다.
    expect(baseline?.maps[mapId]?.lowerTiles[0]).toBe(5);
    // 기준본은 라이브 프로젝트와 **다른 객체**다(라이브를 그대로 들고 있으면 안 된다).
    expect(baseline).not.toBe(store.getCurrent());
  });

  it("저장 뒤 라이브 프로젝트를 제자리에서 고쳐도 기준본은 변하지 않는다", async () => {
    store.replaceProject(createBlankProject());
    const mapId = store.getCurrent().startMapId;
    store.updateMapTiles(mapId, (map) => { map.lowerTiles[1] = 7; }, { cells: [{ x: 1, y: 0, layer: "lower" }] });
    await store.flush();

    const baseline = store._getPersistedBaselineForTest();
    expect(baseline?.maps[mapId]?.lowerTiles[1]).toBe(7);

    // 라이브 프로젝트를 store 를 거치지 않고 제자리에서 고친다(사람 편집·AI 적용 경로가 실제로 한다).
    store.getCurrent().maps[mapId]!.lowerTiles[1] = 99;

    // 기준본은 그 편집을 보지 못한다 — 보면 다음 diff 가 이 편집을 빼먹는다.
    expect(store._getPersistedBaselineForTest()?.maps[mapId]?.lowerTiles[1]).toBe(7);
  });
});
