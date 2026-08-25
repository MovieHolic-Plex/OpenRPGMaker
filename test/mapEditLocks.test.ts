import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

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

describe("잠금 소유자 라벨", () => {
  it("내부 '브라우저 xxxx' 라벨을 사람이 읽을 문구로 바꾼다", async () => {
    const { lockOwnerPhrase } = await import("@/editor/mapEditLocks");
    expect(lockOwnerPhrase("브라우저 481e")).toBe("다른 브라우저 탭(481e)에서 편집 중");
    expect(lockOwnerPhrase("동료 A")).toBe("동료 A 세션이 편집 중");
  });
});

describe("맵 편집 잠금 가져오기", () => {
  it("기존 소유자 조회 없이 현재 세션으로 upsert하고 held 상태로 바꾼다", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response("", { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const mapEditLocks: MapEditLocksModule = await import("@/editor/mapEditLocks");
    const { getMapEditLockStatus, takeoverMapLock } = mapEditLocks;
    if (!takeoverMapLock) throw new Error("takeoverMapLock export missing");

    await takeoverMapLock("map_1", "시작 마을");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = fetchMock.mock.calls[0];
    const init = request?.[1];
    expect(init?.method).toBe("POST");
    expect(String(init?.body)).toContain("\"owner_session_id\":\"session-self\"");
    expect(getMapEditLockStatus()).toMatchObject({ kind: "held", mapId: "map_1", mapName: "시작 마을" });
    expect(findByTestId(fakeBody(), "toast")?.textContent).toContain("편집 권한");
  });
});
