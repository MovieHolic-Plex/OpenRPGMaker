import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getThumbResult,
  invalidatePrefix,
  peekThumb,
  resetThumbCacheForTests,
  resetThumbCacheMemory,
  thumbCacheIdle,
} from "@/editor/thumbCache";

const png = (): Blob => new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], { type: "image/png" });

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetThumbCacheForTests();
});

describe("공용 썸네일 캐시(thumbCache)", () => {
  it("앱을 다시 켜도(메모리 비움) 디스크에서 적중하고 다시 굽지 않는다", async () => {
    // Given: 한 번 구워 디스크에 쓴 썸네일.
    const first = await getThumbResult("obj:sheet:def", 3, png);
    expect(first?.source).toBe("render");
    await thumbCacheIdle();

    // When: 메모리가 비워진 뒤(앱 재시작) 같은 키를 다시 찾는다.
    resetThumbCacheMemory();
    expect(peekThumb("obj:sheet:def", 3)).toBeUndefined();
    const render = vi.fn(png);
    const again = await getThumbResult("obj:sheet:def", 3, render);

    // Then: 디스크 적중이고 굽기 함수는 불리지 않는다. 다음 동기 조회는 메모리에서 바로 나온다.
    expect(again?.source).toBe("disk");
    expect(render).not.toHaveBeenCalled();
    expect(peekThumb("obj:sheet:def", 3)).toBe(again?.url);
  });

  it("크기가 다르면 다른 썸네일이다", async () => {
    await getThumbResult("obj:sheet:def", 3, png);
    await thumbCacheIdle();
    expect(peekThumb("obj:sheet:def", 2)).toBeUndefined();
    expect(await getThumbResult("obj:sheet:def", 2)).toBeNull();
  });

  it("접두사 무효화는 메모리와 디스크 모두에서 지운다", async () => {
    // Given: 맵 판본 두 개와 다른 맵 하나.
    await getThumbResult("map:m1:1", 160, png);
    await getThumbResult("map:m1:2", 160, png);
    await getThumbResult("map:m2:1", 160, png);
    await thumbCacheIdle();

    // When: m1 의 썸네일을 무효화한다.
    await invalidatePrefix("map:m1:");
    resetThumbCacheMemory();

    // Then: m1 은 사라지고 m2 는 남는다.
    expect(await getThumbResult("map:m1:1", 160)).toBeNull();
    expect(await getThumbResult("map:m1:2", 160)).toBeNull();
    expect((await getThumbResult("map:m2:1", 160))?.source).toBe("disk");
  });
});
