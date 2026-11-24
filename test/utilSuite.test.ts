// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissBootLoader, failBootLoader, reportBootStage } from "@/app/bootLoader";
import { bootMark, bootSummary } from "@/util/bootMarks";
import { _resetBootSettledForTest, afterBootSettled, expectBootSettle } from "@/util/bootSettled";
import { cacheBustModuleUrl, failedDynamicImportUrl, importWithRetry, isEngineModuleLoadFailure, isFailedDynamicImport } from "@/util/dynamicImport";
import { resetToastsForTest, toast } from "@/util/toast";
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

/**
 * 토스트는 서로를 지우지 않고 쌓여야 한다.
 *
 * 회귀 배경: 모듈 전역 엘리먼트 하나를 재사용해 204개 호출 지점이 서로를 덮어썼다.
 * 일괄 작업(붙여넣기 실패 + 잠금 + 범위 밖)에서 마지막 한 줄만 남아 왜 실패했는지가
 * 사라졌고, 호출의 절반 가까이가 error 라 가장 필요한 정보가 가장 잘 지워졌다.
 *
 * 동시에 기존 계약을 깨면 안 된다 — e2e 는 getByTestId("toast") 가 **단일 요소**로
 * 풀리길 기대하고, 만료 후 `not.toHaveClass(/show/)` 를 본다.
 */
describe("toastStack", () => {
  isolateTimers();
  const q = (selector: string) => [...document.querySelectorAll<HTMLElement>(selector)];
  const taggedToast = () => q("[data-testid='toast']");
  const visible = () => q(".toast.show");
  const dismissButton = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('[aria-label="닫기"]');
  beforeEach(() => {
    document.body.innerHTML = "";
    resetToastsForTest();
  });
  afterEach(() => {
    resetToastsForTest();
    vi.useRealTimers();
  });
  describe("토스트 스택", () => {
    it("연달아 띄운 메시지가 서로를 지우지 않는다", () => {
      toast("붙여넣기 실패", "error");
      toast("맵이 잠겨 있습니다", "error");
      toast("범위 밖입니다", "error");

      const shown = visible().map((el) => el.textContent);
      expect(shown).toHaveLength(3);
      expect(shown.join(" ")).toContain("붙여넣기 실패");
      expect(shown.join(" ")).toContain("맵이 잠겨 있습니다");
      expect(shown.join(" ")).toContain("범위 밖입니다");
    });

    it("상한을 넘으면 오래된 것부터 걷는다", () => {
      for (let index = 0; index < 8; index += 1) toast(`메시지 ${index}`, "info");
      const shown = visible();
      expect(shown.length).toBeLessThanOrEqual(4);
      // 가장 오래된 것이 밀려나고 최신은 남는다.
      expect(document.body.textContent).toContain("메시지 7");
      expect(document.body.textContent).not.toContain("메시지 0");
    });

    it("일시 알림 네 개와 지속 오류를 함께 표시한다", () => {
      vi.useFakeTimers();
      const action = { label: "다시 시도", onClick: vi.fn() };
      toast("저장 실패", { kind: "error", action });
      const error = taggedToast()[0]!;
      const latest: HTMLElement[] = [];
      for (let index = 0; index < 5; index += 1) {
        toast(`메시지 ${index}`, { action });
        latest.push(taggedToast()[0]!);
      }

      expect(visible()).toEqual([error, ...latest.slice(1)]);
      vi.advanceTimersByTime(60_000);
      expect(visible()).toEqual([error]);
    });

    it("지속 오류가 네 개면 가장 오래된 오류만 걷는다", () => {
      const action = { label: "다시 시도", onClick: vi.fn() };
      toast("진행 중");
      const info = taggedToast()[0]!;
      const errors: HTMLElement[] = [];
      for (let index = 0; index < 4; index += 1) {
        toast(`오류 ${index}`, { kind: "error", action });
        errors.push(taggedToast()[0]!);
      }

      expect(visible()).toEqual([info, ...errors.slice(1)]);
      expect(errors[0]!.isConnected).toBe(false);
    });
  });
  describe("기존 계약 유지", () => {
    it("같은 문구를 연달아 띄우면 하나만 남고 시간이 다시 잰다", () => {
      // Break: 되돌리기 연타의 같은 안내가 넷씩 쌓여 캔버스 아래를 가린다.
      vi.useFakeTimers();
      for (let index = 0; index < 5; index += 1) {
        toast("되돌릴 것이 없습니다", "info");
        vi.advanceTimersByTime(1_500);
      }
      expect(visible()).toHaveLength(1);
      expect(visible()[0]?.classList.contains("show")).toBe(true);
      vi.advanceTimersByTime(500);
      expect(visible()).toHaveLength(0);
    });

    it("data-testid='toast' 는 항상 정확히 하나다", () => {
      toast("첫째");
      expect(taggedToast()).toHaveLength(1);
      toast("둘째");
      toast("셋째");
      expect(taggedToast(), "e2e 가 단일 요소를 기대한다").toHaveLength(1);
    });

    it("data-testid='toast' 는 가장 최근 메시지를 가리킨다", () => {
      toast("옛날 것");
      toast("최신 것");
      expect(taggedToast()[0]?.textContent).toContain("최신 것");
    });

    it("만료되면 최신 토스트는 남되 show 만 떨어진다", () => {
      vi.useFakeTimers();
      toast("사라질 것", "info");
      const element = taggedToast()[0]!;
      expect(element.classList.contains("show")).toBe(true);

      vi.advanceTimersByTime(1_999);
      expect(element.classList.contains("show")).toBe(true);
      vi.advanceTimersByTime(1);

      // 요소 자체는 남아야 한다 — not.toHaveClass 가 요소 존재를 전제한다.
      expect(taggedToast()).toHaveLength(1);
      expect(element.classList.contains("show")).toBe(false);
    });

    it("kind 별 클래스와 지속시간을 그대로 쓴다", () => {
      vi.useFakeTimers();
      toast("에러", "error");
      const element = taggedToast()[0]!;
      expect(element.className).toContain("error");

      vi.advanceTimersByTime(3_999);
      expect(element.classList.contains("show"), "error 는 4초까지 버틴다").toBe(true);
      vi.advanceTimersByTime(1);
      expect(element.classList.contains("show")).toBe(false);
    });

    it("지속 오류의 action 버튼은 오래 기다린 뒤에도 동작하고 알림을 닫는다", () => {
      vi.useFakeTimers();
      const onClick = vi.fn();
      toast("저장 실패", { kind: "error", action: { label: "다시 시도", onClick } });

      const element = taggedToast()[0]!;
      vi.advanceTimersByTime(60_000);
      expect(visible()).toEqual([element]);
      expect(element.className).toContain("has-action");
      const button = element.querySelector<HTMLButtonElement>("[data-testid='toast-action']");
      expect(button).not.toBeNull();

      button!.click();
      expect(onClick).toHaveBeenCalledTimes(1);
      expect(element.classList.contains("show")).toBe(false);
    });

    it.each(["error", "ok"] as const)("%s 알림의 닫기 버튼은 action 을 호출하지 않는다", (kind) => {
      const onClick = vi.fn();
      toast("알림", { kind, action: { label: "열기", onClick } });
      const dismiss = dismissButton(taggedToast()[0]!);
      expect(dismiss?.textContent).toBe("×");
      dismiss!.click();
      expect(visible()).toHaveLength(0);
      expect(onClick).not.toHaveBeenCalled();
    });

    it.each([
      { kind: "error", durationMs: 10_000, expiresAt: 10_000 },
      { kind: "ok", durationMs: 15_000, expiresAt: 15_000 },
      { kind: "info", durationMs: undefined, expiresAt: 6_000 },
    ] as const)("$kind action 알림은 $expiresAt ms 에 만료된다", ({ kind, durationMs, expiresAt }) => {
      vi.useFakeTimers();
      const onClick = vi.fn();
      toast("알림", { kind, durationMs, action: { label: "맵에 놓기", onClick } });
      const element = taggedToast()[0]!;

      vi.advanceTimersByTime(expiresAt - 1);
      expect(visible()).toEqual([element]);
      vi.advanceTimersByTime(1);
      expect(visible()).toHaveLength(0);
      expect(onClick).not.toHaveBeenCalled();
    });

    it("body 가 교체돼도 고아 노드를 붙잡지 않는다", () => {
      toast("이전 body");
      document.body.innerHTML = "";
      toast("새 body");
      expect(taggedToast()).toHaveLength(1);
      expect(taggedToast()[0]?.textContent).toContain("새 body");
    });

    it("document 가 없으면 조용히 무시한다", () => {
      const original = globalThis.document;
      // @ts-expect-error 테스트에서 document 를 잠시 제거한다.
      delete globalThis.document;
      expect(() => toast("노드 환경")).not.toThrow();
      globalThis.document = original;
    });
  });
});
