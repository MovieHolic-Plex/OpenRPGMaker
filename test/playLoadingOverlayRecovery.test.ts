/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountPlayLoadingOverlay } from "@/player/playLoadingOverlay";

function mountHost(): HTMLElement {
  const host = document.createElement("div");
  document.body.append(host);
  return host;
}

describe("playLoadingOverlay recovery", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("renders an announced recovery panel with diagnostics and repairs", () => {
    const host = mountHost();
    const reason = "BOOT_PREFLIGHT_FAILED: map/start-point@0:0";
    const loading = mountPlayLoadingOverlay(host);

    loading.showRecovery({
      title: "테스트 플레이를 시작하지 못했습니다",
      reason,
      repairs: ["시작 위치를 가장 가까운 통행 가능 타일로 옮겼습니다"],
      diagnostics: "boot-id=boot-17\nphase=preflight",
      onRetry: () => undefined,
      onSafeMode: () => undefined,
    });

    const testIds = [
      "play-recovery-panel",
      "play-recovery-reason",
      "play-recovery-retry",
      "play-recovery-safe-mode",
      "play-recovery-copy",
      "play-recovery-repairs",
    ];
    for (const testId of testIds) {
      expect(host.querySelector(`[data-testid='${testId}']`)).toBeTruthy();
    }
    expect(host.querySelector("[data-testid='play-recovery-panel']")?.getAttribute("role")).toBe("alert");
    expect(host.querySelector("[data-testid='play-recovery-reason']")?.textContent).toBe(reason);
    expect(host.querySelector("[data-testid='play-recovery-repairs']")?.textContent).toContain("시작 위치");

    const buttons = Array.from(host.querySelectorAll("[data-testid='play-recovery-panel'] button"));
    expect(buttons.map((button) => button.getAttribute("data-testid"))).toEqual([
      "play-recovery-retry",
      "play-recovery-safe-mode",
      "play-recovery-copy",
    ]);
  });

  it("omits callback actions when their callbacks are not supplied", () => {
    const host = mountHost();
    const loading = mountPlayLoadingOverlay(host);

    loading.showRecovery({
      title: "복구 필요",
      reason: "ENGINE_IMPORT_FAILED",
      diagnostics: "engine import rejected",
    });

    expect(host.querySelector("[data-testid='play-recovery-retry']")).toBeNull();
    expect(host.querySelector("[data-testid='play-recovery-safe-mode']")).toBeNull();
  });

  it("invokes retry and safe-mode callbacks from their buttons", () => {
    const host = mountHost();
    const onRetry = vi.fn();
    const onSafeMode = vi.fn();
    const loading = mountPlayLoadingOverlay(host);

    loading.showRecovery({
      title: "복구 필요",
      reason: "ASSET_LOAD_FAILED",
      onRetry,
      onSafeMode,
    });

    host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-retry']")?.click();
    host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-safe-mode']")?.click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onSafeMode).toHaveBeenCalledOnce();
  });

  it("copies the supplied diagnostics text", async () => {
    const host = mountHost();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const loading = mountPlayLoadingOverlay(host);
    const diagnostics = "boot-id=boot-17\nphase=preflight";

    loading.showRecovery({
      title: "복구 필요",
      reason: "PREFLIGHT_FAILED",
      diagnostics,
    });

    host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-copy']")?.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(diagnostics));
  });

  it("does not throw when diagnostics are copied without a clipboard API", () => {
    const host = mountHost();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const loading = mountPlayLoadingOverlay(host);

    loading.showRecovery({
      title: "복구 필요",
      reason: "MAP_LOAD_FAILED",
      diagnostics: "map=field_01\nreason=missing tileset",
    });

    const copy = host.querySelector<HTMLButtonElement>("[data-testid='play-recovery-copy']");
    expect(copy).toBeTruthy();
    expect(() => copy?.click()).not.toThrow();
  });
});
