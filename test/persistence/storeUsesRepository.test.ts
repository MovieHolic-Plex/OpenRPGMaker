import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHouseTemplateGalleryProject } from "@/project/defaults/defaultProject";
import { createMemoryRepository, type MemoryRepository } from "@/project/persistence/memoryRepository";
import type { ProjectTarget } from "@/project/persistence/target";

// store 는 모듈 싱글턴이다. vi.resetModules() 뒤에는 store 가 **새 모듈 그래프**의
// persistence/repository 를 쓰므로, 주입도 같은 그래프에서 dynamic import 한 함수로 해야 한다.
// 이 파일 상단의 static import 로 setProjectRepositoryForTest 를 부르면 다른 인스턴스에 주입된다.
type StoreModule = typeof import("@/project/store");
type RepositoryModule = typeof import("@/project/persistence/repository");

const target: ProjectTarget = { url: "memory://store-test", anonKey: "memory", projectId: "store-uses-repository" };

describe("store 는 저장소 포트로 저장·읽기·상태를 얻는다", () => {
  let memory: MemoryRepository;
  let store: StoreModule["store"];
  let repositoryModule: RepositoryModule;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.stubEnv("VITE_EDIT_ACTIVITY_DISK_MIRROR", "0");
    vi.stubGlobal("window", {
      location: { hostname: "127.0.0.1", pathname: "/", search: "" },
      localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    });
    memory = createMemoryRepository({ target });
    repositoryModule = await import("@/project/persistence/repository");
    repositoryModule.setProjectRepositoryForTest(memory);
    ({ store } = await import("@/project/store"));
  });
  afterEach(() => {
    repositoryModule.setProjectRepositoryForTest(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("상태는 주입한 저장소의 것이다", () => {
    const status = store.getDbPersistenceStatus();
    expect(status.kind).toBe("ready");
    if (status.kind === "ready") expect(status.projectId).toBe(target.projectId);
  });

  it("flush 는 주입한 저장소에 쓰고 그 sha256 을 돌려준다", async () => {
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });
    store.replaceProject(createHouseTemplateGalleryProject());

    const result = await store.flush();

    expect(result.kind).toBe("saved");
    if (result.kind !== "saved") return;
    expect(memory.rows.get(target.projectId)?.sha256).toBe(result.sha256);
  });

  it("reloadFromRemote 는 주입한 저장소에서 읽는다", async () => {
    const project = createHouseTemplateGalleryProject();
    await memory.save(project, target);
    store._setPersistenceStateForTest({ loaded: true, remotePersistenceEnabled: true, disabledReason: null });

    const result = await store.reloadFromRemote({ force: true });

    expect(result.kind).toBe("reloaded");
    // 정규화기가 맵을 더할 수 있어 맵 키 목록은 비교하지 않는다 — 제목으로 같은 문서임을 본다.
    expect(store.getCurrent().meta.title).toBe(project.meta.title);
  });
});
