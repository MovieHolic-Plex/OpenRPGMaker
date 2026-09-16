import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";
import type { ProjectRepository } from "@/project/persistence/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

let restoreDom: (() => void) | null = null;
let storage: MemoryStorage;

type MapEditLocksModule = typeof import("@/editor/mapEditLocks") & {
  readonly takeoverMapLock?: (mapId: string, mapName: string) => Promise<void>;
};

function fakeBody(): FakeElement {
  if (document.body instanceof FakeElement) return document.body;
  throw new Error("Expected fake body");
}

beforeEach(() => {
  vi.resetModules();
  restoreDom = installFakeDom();
  storage = new MemoryStorage();
  storage.setItem(
    "oprn:supabase-project-config",
    JSON.stringify({ anonKey: "anon", projectId: "proj", source: "custom", url: "https://db.test" }),
  );
  storage.setItem("oprn:editor-session-id", "session-self");
  storage.setItem("oprn:editor-owner-label", "나");
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
  vi.restoreAllMocks();
  vi.resetModules();
});


describe("로컬 폴더 세션", () => {
  it("원격 대상이 아니면 잠금 API 를 부르지 않고 idle 로 남는다", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    // 로컬 폴더 정본 세션. 예전에는 `isRemotePersistenceEnabled()` 가 이 경우에도 참이라
    // dbserver 로 잠금 요청이 나갔다(실제 앱 부팅에서 재현).
    const { setProjectRepositoryForTest } = await import("@/project/persistence/repository");
    setProjectRepositoryForTest({
      kind: "local",
      currentTarget: () => ({ kind: "local", projectDir: "/tmp/oprn-local", projectId: "uuid-local" }),
    } as unknown as ProjectRepository);
    const { checkoutMapForEditing, getMapEditLockStatus } = await import("@/editor/mapEditLocks");

    await checkoutMapForEditing("map_1", "시작 마을");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getMapEditLockStatus().kind).toBe("idle");
  });
});

