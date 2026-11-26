// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissBootLoader, failBootLoader, reportBootStage } from "@/app/bootLoader";
import { bootMark, bootSummary } from "@/util/bootMarks";
import { _resetBootSettledForTest, afterBootSettled, expectBootSettle } from "@/util/bootSettled";
import { cacheBustModuleUrl, failedDynamicImportUrl, importWithRetry, isEngineModuleLoadFailure, isFailedDynamicImport } from "@/util/dynamicImport";
import { isolateTimers } from "./mergedTeardown";

describe("bootLoader", () => {
  isolateTimers();
  type Splash = { stage: ReturnType<typeof vi.fn>; fail: ReturnType<typeof vi.fn>; leave: ReturnType<typeof vi.fn> };
  function mountLoader(): HTMLElement {
    const loader = document.createElement("div");
    loader.id = "oprn-boot-loader";
    document.body.append(loader);
    return loader;
  }
  function installSplash(): Splash {
    const splash: Splash = { stage: vi.fn(), fail: vi.fn(), leave: vi.fn() };
    (window as unknown as { __oprnBootSplash?: Splash }).__oprnBootSplash = splash;
    return splash;
  }
  describe("부팅 스플래시 — 단계·실패·걷기", () => {
    beforeEach(() => {
      document.body.innerHTML = "";
      delete (window as unknown as { __oprnBootSplash?: unknown }).__oprnBootSplash;
      _resetBootSettledForTest();
    });
    afterEach(() => { vi.useRealTimers(); _resetBootSettledForTest(); });

    it("단계 신호를 스플래시 스크립트에 그대로 넘기고, 로더가 없으면 아무것도 넘기지 않는다", () => {
      const splash = installSplash();
      reportBootStage("shared");
      expect(splash.stage).not.toHaveBeenCalled();
      mountLoader();
      reportBootStage("shared");
      reportBootStage("project");
      expect(splash.stage.mock.calls).toEqual([["shared"], ["project"]]);
    });

    it("실패는 걷지 않고 스플래시에 종류와 상세를 알린다 — 첫 화면 신호는 켠다", () => {
      const loader = mountLoader();
      const splash = installSplash();
      expectBootSettle();
      const queued = vi.fn();
      afterBootSettled(queued);
      failBootLoader(new Error("공용 자료 실패"), "unknown");
      expect(splash.fail).toHaveBeenCalledTimes(1);
      expect(splash.fail.mock.calls[0]?.[0]).toBe("unknown");
      expect(String(splash.fail.mock.calls[0]?.[1])).toContain("공용 자료 실패");
      expect(queued).toHaveBeenCalledTimes(1);
      expect(loader.dataset.leaving).toBeUndefined();
    });

    it("실패 화면이 떠 있으면 dismiss 가 걷지 않는다(메시지와 다시 시도가 남는다)", () => {
      vi.useFakeTimers();
      const loader = mountLoader();
      loader.setAttribute("data-failed", "bundle");
      installSplash();
      dismissBootLoader();
      vi.advanceTimersByTime(500);
      expect(loader.isConnected).toBe(true);
      expect(loader.dataset.leaving).toBeUndefined();
    });

    it("정상 dismiss 는 스플래시에 알리고 한 번만 걷는다(멱등)", () => {
      vi.useFakeTimers();
      const loader = mountLoader();
      const splash = installSplash();
      dismissBootLoader();
      dismissBootLoader();
      expect(splash.leave).toHaveBeenCalledTimes(1);
      expect(loader.dataset.leaving).toBe("");
      vi.advanceTimersByTime(250);
      expect(loader.isConnected).toBe(false);
    });
  });
  describe("부팅 마크", () => {
    it("bootMark 는 oprn:boot: 접두 마크를 새기고 bootSummary 가 시간순으로 돌려준다", () => {
      bootMark("unit-test-a");
      bootMark("unit-test-b");
      const names = bootSummary().map((row) => row.stage);
      expect(names.indexOf("unit-test-a")).toBeGreaterThanOrEqual(0);
      expect(names.indexOf("unit-test-b")).toBeGreaterThan(names.indexOf("unit-test-a"));
    });
  });
});

// 실패한 동적 import 는 브라우저가 같은 specifier 의 거부를 페이지 수명 동안 캐시한다.
// 「다시 시도」가 같은 import() 를 다시 부르면 네트워크에 안 가고 즉시 같은 TypeError 가 난다.
// 이 모듈은 그 오류를 판정하고, 캐시를 우회하는 URL 로 재시도하는 계약이다.
describe("dynamicImport", () => {
  isolateTimers();
  function chromeDynamicImportError(url: string): TypeError {
    return new TypeError(`Failed to fetch dynamically imported module: ${url}`);
  }
  describe("dynamic import failure detection", () => {
    it("recognizes Chrome/Vite hashed-chunk fetch failures", () => {
      const error = chromeDynamicImportError("http://mdc-server:9888/assets/PlayScene-Dga2dGc8.js");
      expect(isFailedDynamicImport(error)).toBe(true);
      expect(isEngineModuleLoadFailure(error)).toBe(true);
      expect(failedDynamicImportUrl(error)).toBe("http://mdc-server:9888/assets/PlayScene-Dga2dGc8.js");
    });

    it("recognizes Firefox module-load wording", () => {
      const error = new TypeError("error loading dynamically imported module: http://host/assets/EditScene-abc.js");
      expect(isFailedDynamicImport(error)).toBe(true);
      expect(failedDynamicImportUrl(error)).toBe("http://host/assets/EditScene-abc.js");
    });

    it("treats Phaser script load failure as an engine module-load failure", () => {
      const error = new Error("Failed to load http://host/node_modules/phaser/dist/phaser.min.js");
      expect(isFailedDynamicImport(error)).toBe(false);
      expect(isEngineModuleLoadFailure(error)).toBe(true);
    });

    it("does not classify ordinary boot errors as module-load failures", () => {
      expect(isFailedDynamicImport(new Error("WebGL 컨텍스트 생성 실패"))).toBe(false);
      expect(isEngineModuleLoadFailure(new Error("WebGL 컨텍스트 생성 실패"))).toBe(false);
      expect(failedDynamicImportUrl(new Error("no url here"))).toBeUndefined();
    });
  });
  describe("cacheBustModuleUrl", () => {
    it("adds a t query so the browser cannot reuse a cached rejected import", () => {
      expect(cacheBustModuleUrl("http://mdc-server:9888/assets/PlayScene-Dga2dGc8.js", 1_700_000_000_000))
        .toBe("http://mdc-server:9888/assets/PlayScene-Dga2dGc8.js?t=1700000000000");
    });

    it("replaces an existing t param instead of stacking them", () => {
      expect(cacheBustModuleUrl("http://host/assets/PlayScene.js?t=1", 2))
        .toBe("http://host/assets/PlayScene.js?t=2");
    });
  });
  describe("importWithRetry", () => {
    it("returns the first successful import without retrying", async () => {
      const importer = vi.fn(async () => ({ ok: true }));
      const imported = await importWithRetry(importer, { sleep: async () => undefined });
      expect(imported).toEqual({ ok: true });
      expect(importer).toHaveBeenCalledOnce();
    });

    it("cache-busts the failed module URL on retry instead of reusing the cached specifier", async () => {
      const url = "http://mdc-server:9888/assets/PlayScene-Dga2dGc8.js";
      const importer = vi.fn(async () => {
        throw chromeDynamicImportError(url);
      });
      const importUrl = vi.fn(async (nextUrl: string) => {
        expect(nextUrl).toContain("t=");
        expect(nextUrl).toContain("PlayScene-Dga2dGc8.js");
        return { PlayScene: "recovered" };
      });

      const imported = await importWithRetry(importer, {
        importUrl,
        sleep: async () => undefined,
        now: () => 42,
      });

      expect(imported).toEqual({ PlayScene: "recovered" });
      expect(importer).toHaveBeenCalledOnce();
      expect(importUrl).toHaveBeenCalledWith(`${url}?t=42`);
    });

    it("rethrows non-module errors immediately", async () => {
      const importer = vi.fn(async () => {
        throw new Error("WebGL 컨텍스트 생성 실패");
      });
      await expect(importWithRetry(importer, { sleep: async () => undefined }))
        .rejects.toThrow("WebGL 컨텍스트 생성 실패");
      expect(importer).toHaveBeenCalledOnce();
    });

    it("rethrows the last module-load error after retries are exhausted", async () => {
      const url = "http://host/assets/PlayScene-gone.js";
      const importer = vi.fn(async () => {
        throw chromeDynamicImportError(url);
      });
      const importUrl = vi.fn(async () => {
        throw chromeDynamicImportError(`${url}?t=1`);
      });
      await expect(importWithRetry(importer, {
        retries: 1,
        importUrl,
        sleep: async () => undefined,
        now: () => 1,
      })).rejects.toThrow(/PlayScene-gone/);
      expect(importUrl).toHaveBeenCalledOnce();
    });
  });
});
