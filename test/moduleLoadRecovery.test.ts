/** @vitest-environment happy-dom */
// 해시가 바뀐 Vite 청크(PlayScene-xxxx.js 404)는 캐시 버스트로도 살아나지 않는다.
// 그때는 새 HTML/새 해시를 받도록 페이지를 한 번만 새로고침한다. 루프 방지가 계약이다.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  STALE_MODULE_RELOAD_KEY,
  clearStaleModuleReloadMark,
  consumeStaleModuleReload,
  installVitePreloadRecovery,
  markStaleModuleReloaded,
  uninstallVitePreloadRecoveryForTest,
} from "@/app/moduleLoadRecovery";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  };
}

let storage: Storage;

beforeEach(() => {
  storage = memoryStorage();
  uninstallVitePreloadRecoveryForTest();
});

afterEach(() => {
  uninstallVitePreloadRecoveryForTest();
});

describe("stale module reload-once", () => {
  it("allows exactly one automatic reload per session", () => {
    expect(consumeStaleModuleReload(storage)).toBe(true);
    markStaleModuleReloaded(storage);
    expect(storage.getItem(STALE_MODULE_RELOAD_KEY)).toBe("1");
    expect(consumeStaleModuleReload(storage)).toBe(false);
  });

  it("can be cleared after a successful boot so a later deploy mismatch can reload again", () => {
    markStaleModuleReloaded(storage);
    clearStaleModuleReloadMark(storage);
    expect(consumeStaleModuleReload(storage)).toBe(true);
  });
});

describe("vite:preloadError recovery", () => {
  it("reloads once and prevents the default throw", () => {
    const reload = vi.fn();
    installVitePreloadRecovery({ reload, storage });
    const event = new Event("vite:preloadError");
    Object.defineProperty(event, "payload", {
      value: new TypeError("Failed to fetch dynamically imported module: http://host/assets/PlayScene-aaa.js"),
    });
    const prevented = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);

    expect(prevented).toHaveBeenCalledOnce();
    expect(reload).toHaveBeenCalledOnce();
    expect(storage.getItem(STALE_MODULE_RELOAD_KEY)).toBe("1");
  });

  it("does not reload again after the one-shot mark is consumed", () => {
    const reload = vi.fn();
    markStaleModuleReloaded(storage);
    installVitePreloadRecovery({ reload, storage });
    window.dispatchEvent(new Event("vite:preloadError"));
    expect(reload).not.toHaveBeenCalled();
  });
});
