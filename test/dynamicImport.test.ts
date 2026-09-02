/** @vitest-environment happy-dom */
// 실패한 동적 import 는 브라우저가 같은 specifier 의 거부를 페이지 수명 동안 캐시한다.
// 「다시 시도」가 같은 import() 를 다시 부르면 네트워크에 안 가고 즉시 같은 TypeError 가 난다.
// 이 모듈은 그 오류를 판정하고, 캐시를 우회하는 URL 로 재시도하는 계약이다.

import { describe, expect, it, vi } from "vitest";
import {
  cacheBustModuleUrl,
  failedDynamicImportUrl,
  importWithRetry,
  isEngineModuleLoadFailure,
  isFailedDynamicImport,
} from "@/util/dynamicImport";

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
