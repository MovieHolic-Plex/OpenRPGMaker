import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAP_BACKGROUND_PREVIEW_STORAGE_KEY,
  mapBackgroundPreviewEnabled,
  resetMapBackgroundPreviewForTests,
  setMapBackgroundPreview,
  subscribeMapBackgroundPreview,
  toggleMapBackgroundPreview,
} from "@/editor/mapBackgroundPreviewState";
import { installFakeDom } from "./fakeDom";

/**
 * 맵 배경 미리보기 토글 상태.
 *
 * 기본값이 «꺼짐» 인 것이 계약이다 — 빈 칸 체커가 "바닥 없음" 신호를 계속 말해야 한다
 * (2026-08-27 결정). 캔버스는 이 모듈을 구독해 다시 그리므로, 구독이 안 불리면 토글이
 * 아무 일도 안 한 것처럼 보인다.
 */
describe("맵 배경 미리보기 상태", () => {
  let restoreDom: () => void;

  let store: Map<string, string>;

  beforeEach(() => {
    restoreDom = installFakeDom();
    store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    });
    resetMapBackgroundPreviewForTests();
  });

  afterEach(() => {
    resetMapBackgroundPreviewForTests();
    vi.unstubAllGlobals();
    restoreDom();
  });

  it("기본값은 꺼짐이다", () => {
    expect(mapBackgroundPreviewEnabled()).toBe(false);
    expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBeNull();
  });

  it("토글은 구독자에게 알리고 저장한다", () => {
    const seen: boolean[] = [];
    const off = subscribeMapBackgroundPreview((enabled) => seen.push(enabled));
    try {
      toggleMapBackgroundPreview();
      expect(mapBackgroundPreviewEnabled()).toBe(true);
      expect(seen).toEqual([true]);
      expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBe("1");

      toggleMapBackgroundPreview();
      expect(mapBackgroundPreviewEnabled()).toBe(false);
      expect(seen).toEqual([true, false]);
      expect(globalThis.localStorage.getItem(MAP_BACKGROUND_PREVIEW_STORAGE_KEY)).toBeNull();
    } finally {
      off();
    }
  });

  it("같은 값으로 다시 설정하면 알리지 않는다", () => {
    const listener = vi.fn();
    const off = subscribeMapBackgroundPreview(listener);
    try {
      setMapBackgroundPreview(false);
      expect(listener).not.toHaveBeenCalled();
      setMapBackgroundPreview(true);
      setMapBackgroundPreview(true);
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      off();
    }
  });

  it("구독을 해제하면 더는 알리지 않는다", () => {
    const listener = vi.fn();
    subscribeMapBackgroundPreview(listener)();
    setMapBackgroundPreview(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
