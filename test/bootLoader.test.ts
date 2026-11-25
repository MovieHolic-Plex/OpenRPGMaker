/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissBootLoader, failBootLoader, reportBootStage } from "@/app/bootLoader";
import { bootMark, bootSummary } from "@/util/bootMarks";
import { _resetBootSettledForTest, afterBootSettled, expectBootSettle } from "@/util/bootSettled";

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
